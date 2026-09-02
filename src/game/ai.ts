import { aiInterval, aiMoveSpeed, BIG_HELD_TIME, MARGIN, MAX_CHARGE, PACK_TIME, throwSpeed, WORLD_H, WORLD_W } from "./constants";
import { aimFromKid, canEnterFort, canTeamClaimPickup, closestEnemy, closestHittableEnemy, ensureAi, foeHittable, inFort, isOut, lineHitsFort, living, rand, teamNeedsHeal, throwSnowball } from "./sim";
import type { AllyMode, Fort, GameState, Kid, Snowball, Team } from "./types";

export type GreenControl = "enemy" | AllyMode;

const EMPTY_ROLES = { holdFire: new Set<number>(), intercept: new Set<number>() };

function foeTeam(team: Team): Team {
  return team === "red" ? "green" : "red";
}

function speedMul(state: GameState) {
  return state.hard ? 1.45 : 1;
}

export type AiJob = "press" | "wrap" | "loot";

export function teamJob(state: GameState, kid: Kid): AiJob {
  const mates = livingMates(state, kid.team);
  const i = Math.max(0, mates.findIndex((k) => k.id === kid.id));
  const rot = Math.floor(state.time / 2.4) % 3;
  return (["press", "wrap", "loot"] as const)[(i + rot) % 3]!;
}

export function teamSurging(state: GameState, team: Team) {
  const buff = state.buffs[team];
  return !!(buff && buff.t > BIG_HELD_TIME - 0.85);
}

export function mateThrewRecently(state: GameState, kid: Kid, window = 0.4) {
  return livingMates(state, kid.team).some(
    (m) => m.id !== kid.id && (m.ai?.lastThrowAt ?? -99) > state.time - window,
  );
}

export const ARENA_BALL_MAX = 5;

export function arenaBalls(state: GameState) {
  return state.balls.filter((b) => b.alive && !b.ghost).length;
}

export function arenaCanThrow(state: GameState, intercepting = false) {
  return intercepting || arenaBalls(state) < ARENA_BALL_MAX;
}

function arenaHunger(state: GameState) {
  const n = arenaBalls(state);
  if (n <= 0) return 0.92;
  if (n <= 1) return 0.7;
  return 0;
}

/** Easy: 1 dog may fire at a dragged foe. Hard / PvP: 2. */
export function grabShooters(state: GameState, team: Kid["team"], hard: boolean) {
  const prey = living(state.kids).find((k) => k.team !== team && k.state === "grabbed") ?? null;
  if (!prey) return null;
  const n = hard || state.pvp ? 2 : 1;
  const mates = livingMates(state, team).sort((a, b) => {
    const da = Math.hypot(a.x - prey.x, a.y - prey.y);
    const db = Math.hypot(b.x - prey.x, b.y - prey.y);
    return da - db || a.id - b.id;
  });
  return new Set(mates.slice(0, n).map((k) => k.id));
}

function foeHasBigBuff(state: GameState, team: Team): boolean {
  const buff = state.buffs[foeTeam(team)];
  return !!(buff && buff.shots > 0 && buff.t > 0);
}

function foeBigBalls(state: GameState, team: Team): Snowball[] {
  return state.balls.filter((b) => b.alive && b.big && b.team !== team);
}

/** Hard retrievers, or both sides in PvP. */
export function teamReactsToBig(team: Team, hard: boolean, state: GameState): boolean {
  if (state.pvp) return true;
  return team === "green" && (hard || state.hard);
}

/** Two blockers hold a charged long shot while the foe has the buff; they fire only after the big ball is thrown. */
export function bigBallRoles(state: GameState, team: Team): { holdFire: Set<number>; intercept: Set<number> } {
  const mates = livingMates(state, team);
  const intercept = new Set<number>();
  const holdFire = new Set<number>();
  const primed = foeHasBigBuff(state, team) || foeBigBalls(state, team).length > 0;
  if (primed && mates.length) {
    for (const k of mates.slice(0, Math.min(2, mates.length))) intercept.add(k.id);
    if (foeHasBigBuff(state, team)) {
      for (const id of intercept) holdFire.add(id);
    }
  }
  return { holdFire, intercept };
}

function aimAtBigBall(kid: Kid, state: GameState): { dx: number; dy: number } | null {
  const balls = foeBigBalls(state, kid.team);
  if (!balls.length) return null;
  const ball = balls.reduce((best, b) => {
    const d = Math.hypot(b.x - kid.x, b.y - kid.y);
    const bd = Math.hypot(best.x - kid.x, best.y - kid.y);
    return d < bd ? b : best;
  });
  const speed = throwSpeed(0.35);
  let t = 0.22;
  for (let i = 0; i < 5; i++) {
    const px = ball.x + ball.vx * t;
    const py = ball.y + ball.vy * t;
    t = Math.hypot(px - kid.x, py - kid.y) / Math.max(80, speed);
  }
  return { dx: ball.x + ball.vx * t - kid.x, dy: ball.y + ball.vy * t - kid.y };
}

export function stepAi(
  state: GameState,
  dt: number,
  onThrow: (power: number, kid: Kid, hold: number, dx: number, dy: number) => void,
  allyMode: AllyMode = "off",
  greenControl: GreenControl = "enemy",
  localBalls = false,
  hard = false,
) {
  if (state.phase !== "fight" || state.freeze > 0) return;
  const level = state.level;
  const roles = {
    red: teamReactsToBig("red", hard, state) ? bigBallRoles(state, "red") : EMPTY_ROLES,
    green: teamReactsToBig("green", hard, state) ? bigBallRoles(state, "green") : EMPTY_ROLES,
  };

  for (const kid of state.kids) {
    if (isOut(kid)) continue;
    ensureAi(kid);
    if (!kid.ai) continue;
    if (kid.state === "throw" || kid.state === "hurt") continue;
    if (kid.team === "red") {
      if (allyMode === "off" || kid.state === "grabbed") continue;
    } else if (kid.team === "green") {
      if (greenControl !== "enemy") {
        if (greenControl === "off" || kid.state === "grabbed") continue;
      }
    } else {
      continue;
    }

    const defend =
      kid.team === "red" ? allyMode === "defend" : greenControl === "defend";
    const stance: "defend" | "attack" | "enemy" =
      kid.team === "green" && greenControl === "enemy"
        ? "enemy"
        : defend
          ? "defend"
          : "attack";

    const lastStand = living(state.kids, kid.team).length <= 1;
    const hunting = !lastStand && living(state.kids, kid.team === "red" ? "green" : "red").length <= 1;
    const huntPress = hunting && stance === "enemy" ? huntPressers(state, kid.team, hard) : null;
    const mayCross = stance === "enemy" && (hard || !!(huntPress && huntPress.has(kid.id)));
    const longDodge = (hard && stance === "enemy") || (stance === "attack" && kid.team === "green") || lastStand;

    const forbidFort = tickFortRoam(state, kid, dt, stance, lastStand, hunting);
    tickCamp(state, kid, dt, stance, hard);

    const incoming = incomingBall(state, kid, lastStand ? 240 : longDodge ? 210 : stance === "defend" ? 150 : 95, hard && stance === "enemy" || lastStand);
    const teamRoles = kid.team === "red" ? roles.red : roles.green;
    const intercepting = !lastStand && teamRoles.intercept.has(kid.id);
    const holding = teamRoles.holdFire.has(kid.id) && !intercepting;

    const charging = kid.ai.phase === "windup" && !lastStand;
    const prey = living(state.kids).find((k) => k.team !== kid.team && k.state === "grabbed") ?? null;
    const mate = draggedMate(state, kid);
    const punishers = grabShooters(state, kid.team, hard);
    const mayPunish = !punishers || punishers.has(kid.id);
    if (incoming && kid.stun <= 0 && kid.ai.phase !== "dodge" && (charging || !intercepting)) {
      const dist = charging ? 72 : longDodge ? 118 : stance === "defend" ? 88 : 64;
      const step = dodgeDest(state, kid, incoming, dist, mayCross);
      kid.ai.destX = step.x;
      kid.ai.destY = step.y;
      if (lastStand && canEnterFort(kid)) {
        const fort = lastStandPile(state, kid);
        if (fort) {
          const hide = hideSpot(kid, fort, state);
          kid.ai.destX = hide.x;
          kid.ai.destY = hide.y;
        }
      } else if (!hunting && stance === "defend" && canEnterFort(kid)) {
        const fort = fortForKid(state, kid);
        if (fort) {
          const hide = hideSpot(kid, fort, state);
          kid.ai.destX = hide.x;
          kid.ai.destY = hide.y;
        }
      } else if (!charging && !hunting && stance !== "defend") {
        const pile = shouldHideInPile(state, kid, stance, hard);
        if (pile) {
          const hide = hideSpot(kid, pile, state);
          kid.ai.destX = hide.x;
          kid.ai.destY = hide.y;
        }
      }
      if (!charging) {
        kid.ai.phase = "dodge";
        kid.ai.t = longDodge ? 0.5 : stance === "defend" ? 0.55 : 0.34;
      }
    }

    if (
      prey &&
      !lastStand &&
      !intercepting &&
      !holding &&
      kid.stun <= 0 &&
      kid.packT <= 0 &&
      kid.cooldown <= 0 &&
      kid.ai.phase !== "dodge" &&
      kid.ai.phase !== "windup" &&
      !inFort(kid.x, kid.y, state.forts) &&
      arenaCanThrow(state) &&
      mayPunish
    ) {
      const aim = throwAimForStance(kid, state, stance, hard);
      if (aim) {
        kid.ai.phase = "windup";
        kid.ai.t = rand(0.12, 0.22);
        kid.ai.charge = 0.35;
        kid.ai.fake = false;
      }
    }

    if (
      stance === "defend" &&
      mate &&
      !lastStand &&
      !intercepting &&
      !holding &&
      kid.stun <= 0 &&
      kid.packT <= 0 &&
      kid.cooldown <= 0 &&
      kid.ai.phase !== "dodge" &&
      kid.ai.phase !== "windup" &&
      arenaCanThrow(state)
    ) {
      if (inFort(kid.x, kid.y, state.forts)) {
        const fort = inFort(kid.x, kid.y, state.forts)!;
        const next = peekSpot(kid, fort, state);
        kid.ai.phase = "move";
        kid.ai.t = 0.28;
        kid.ai.destX = next.x;
        kid.ai.destY = next.y;
        kid.ai.charge = 0;
      } else if (throwAimForStance(kid, state, stance, hard)) {
        kid.ai.phase = "windup";
        kid.ai.t = rand(0.1, 0.2);
        kid.ai.charge = 0.4;
        kid.ai.fake = false;
      }
    }

    if (intercepting && inFort(kid.x, kid.y, state.forts)) {
      const fort = inFort(kid.x, kid.y, state.forts);
      if (fort) {
        const peek = peekSpot(kid, fort, state);
        kid.ai.destX = peek.x;
        kid.ai.destY = peek.y;
        if (kid.ai.phase !== "windup" && kid.ai.phase !== "move") {
          kid.ai.phase = "move";
          kid.ai.t = 0.45;
        }
      }
    } else if (
      intercepting &&
      kid.packT <= 0 &&
      kid.stun <= 0 &&
      kid.cooldown <= 0 &&
      kid.ai.phase !== "windup"
    ) {
      kid.ai.phase = "windup";
      kid.ai.t = 9;
    }

    kid.ai.t -= dt;
    if (kid.ai.phase === "move" || kid.ai.phase === "dodge") {
      const spd =
        aiMoveSpeed(level) *
        speedMul(state) *
        (kid.ai.phase === "dodge" ? (longDodge ? 1.75 : 1.5) : stance === "attack" || teamSurging(state, kid.team) ? 1.2 : 0.9);
      moveToward(kid, kid.ai.destX, kid.ai.destY, spd, dt);
      if (kid.ai.t <= 0 || Math.hypot(kid.x - kid.ai.destX, kid.y - kid.ai.destY) < 10) {
        const wasDodge = kid.ai.phase === "dodge";
        if (wasDodge) {
          if (inFort(kid.x, kid.y, state.forts) && kid.ai.awayT > 0) {
            const fort = inFort(kid.x, kid.y, state.forts)!;
            kid.ai.phase = "move";
            kid.ai.t = 0.4;
            const next = peekSpot(kid, fort, state);
            kid.ai.destX = next.x;
            kid.ai.destY = next.y;
          } else if ((stance === "attack" || (stance === "enemy" && hard)) && !lastStand) {
            const foe = closestHittableEnemy(kid, state.kids, state.forts);
            kid.ai.phase = foe && foeIsOpen(foe) ? "windup" : "idle";
            kid.ai.fake = false;
            if (kid.ai.phase === "windup") kid.ai.t = 0.14;
          } else {
            kid.ai.phase = "idle";
          }
        } else if (inFort(kid.x, kid.y, state.forts) && kid.ai.awayT > 0) {
          const fort = inFort(kid.x, kid.y, state.forts)!;
          kid.ai.phase = "move";
          kid.ai.t = 0.4;
          const next = peekSpot(kid, fort, state);
          kid.ai.destX = next.x;
          kid.ai.destY = next.y;
        } else if (inFort(kid.x, kid.y, state.forts)) {
          kid.ai.phase = "idle";
        } else if (lastStand || stance === "defend") {
          kid.ai.phase = "idle";
        } else if (throwAimForStance(kid, state, stance, hard) && Math.random() < 0.5) {
          kid.ai.phase = "windup";
          kid.ai.fake = canFake(stance, hard);
        } else {
          kid.ai.phase = "idle";
        }
        if (!(kid.ai.phase === "move" && kid.ai.t > 0.3 && kid.ai.t < 0.45)) {
          kid.ai.t =
            kid.ai.phase === "windup"
              ? wasDodge
                ? 0.14
                : rand(stance === "attack" ? 0.16 : 0.32, stance === "attack" ? 0.4 : 0.8)
              : rand(0.12, aiInterval(level) * 0.5);
        }
        kid.ai.charge = 0;
      }
      continue;
    }

    if (kid.packT > 0 || kid.stun > 0) continue;

    if (kid.ai.phase === "windup") {
      if (holding) {
        kid.ai.phase = "idle";
        kid.ai.t = rand(0.15, 0.35);
        kid.ai.charge = 0;
        continue;
      }
      if (lastStand && canEnterFort(kid) && !inFort(kid.x, kid.y, state.forts) && !nearFortRim(kid, state)) {
        const pile = lastStandPile(state, kid);
        kid.ai.phase = "move";
        kid.ai.t = 0.55;
        kid.ai.charge = 0;
        if (pile) {
          const hide = hideSpot(kid, pile, state);
          kid.ai.destX = hide.x;
          kid.ai.destY = hide.y;
        }
        continue;
      }
      if (!intercepting && kid.ai.t > 4) {
        kid.ai.t = 0;
      }
      kid.ai.charge = Math.min(1, kid.ai.charge + dt / (stance === "defend" ? 1.15 : 0.85));
      if (kid.ai.fake && kid.ai.charge >= 0.2 && !intercepting) {
        kid.ai.fake = false;
        kid.ai.phase = "dodge";
        kid.ai.t = 0.28;
        kid.ai.charge = 0;
        const step = dodgeDest(state, kid, incomingBall(state, kid, 240, true) ?? { x: kid.x + kid.facing * 40, y: kid.y, vx: kid.facing * 80, vy: 0 }, 90, hard && stance === "enemy");
        kid.ai.destX = step.x;
        kid.ai.destY = step.y;
        continue;
      }
      const holdWalk = aiMoveSpeed(level) * speedMul(state);
      if (Math.hypot(kid.x - kid.ai.destX, kid.y - kid.ai.destY) > 8) {
        moveToward(kid, kid.ai.destX, kid.ai.destY, holdWalk, dt);
      }
      if (kid.cooldown > 0 || kid.packT > 0) {
        if (kid.ai.t <= 0) kid.ai.phase = "idle";
        continue;
      }
      const flyingBig = intercepting && foeBigBalls(state, kid.team).length > 0;
      if (intercepting && !flyingBig) {
        kid.ai.t = 9;
        continue;
      }
      if (kid.ai.t <= 0 || flyingBig) {
        if (!arenaCanThrow(state, intercepting)) {
          kid.ai.phase = "idle";
          kid.ai.t = rand(0.2, 0.4);
          kid.ai.charge = 0;
          continue;
        }
        if (inFort(kid.x, kid.y, state.forts)) {
          const fort = inFort(kid.x, kid.y, state.forts)!;
          kid.ai.phase = "move";
          kid.ai.t = 0.4;
          const next = stance === "defend" ? peekSpot(kid, fort, state) : awayFromFort(kid, fort);
          kid.ai.destX = next.x;
          kid.ai.destY = next.y;
          kid.ai.charge = flyingBig ? kid.ai.charge : 0;
          continue;
        }
        const aim = intercepting
          ? aimAtBigBall(kid, state)
          : throwAimForStance(kid, state, stance, hard);
        if (!aim) {
          if (intercepting) {
            kid.ai.t = 9;
            continue;
          }
          kid.ai.phase = "idle";
          kid.ai.t = rand(0.12, 0.3);
          continue;
        }
        if (!intercepting && stance !== "defend" && shotHitsFort(kid, aim.dx, aim.dy, state.forts, fortOfGrabbed(state, kid))) {
          kid.ai.phase = "move";
          kid.ai.t = rand(0.28, 0.5);
          pickDest(state, kid, stance, false, mayCross, hard);
          continue;
        }
        const { dx, dy } = aim;
        const hold = intercepting
          ? MAX_CHARGE * Math.max(0.9, kid.ai.charge)
          : MAX_CHARGE *
            (stance === "defend" ? 0.42 + 0.35 * kid.ai.charge : 0.58 + 0.42 * kid.ai.charge);
        const power = throwSnowball(state, kid, hold, dx, dy, localBalls);
        if (!power) {
          kid.ai.phase = intercepting ? "windup" : "idle";
          kid.ai.t = intercepting ? 9 : 0.2;
          continue;
        }
        onThrow(power, kid, hold, dx, dy);
        kid.ai.lastThrowAt = state.time;
        kid.ai.fake = false;
        if (stance === "defend" && !intercepting && !draggedMate(state, kid)) {
          const fort = fortForKid(state, kid) ?? nearestFort(state, kid);
          kid.ai.phase = "move";
          kid.ai.t = 0.52;
          if (fort) {
            const hide = hideSpot(kid, fort, state);
            kid.ai.destX = hide.x;
            kid.ai.destY = hide.y;
          }
        } else {
          kid.ai.phase = "idle";
          kid.ai.t = (stance === "attack" ? 0.55 : 1) * aiInterval(level) * rand(0.7, 1.15) + PACK_TIME * 0.25;
        }
        kid.ai.charge = 0;
      }
      continue;
    }

    if (kid.ai.t <= 0) {
      const cover = !!inFort(kid.x, kid.y, state.forts);
      const panic = !cover && !intercepting && shouldHideInPile(state, kid, stance, hard);
      let throwChance = 0.55;
      if (cover) {
        throwChance = 0;
      } else if (lastStand && canEnterFort(kid)) {
        throwChance = 0;
      } else if (lastStand) {
        throwChance = 0.8;
      } else if (hunting) {
        const foe = closestHittableEnemy(kid, state.kids, state.forts);
        throwChance = foe ? 0.88 : 0.2;
      } else if (panic && arenaBalls(state) > 1) {
        throwChance = 0;
      } else if (stance === "defend") {
        throwChance = draggedMate(state, kid) ? 0.84 : nearFortRim(kid, state) ? 0.78 : 0.42;
      } else if (stance === "attack") {
        const foe = living(state.kids).find((k) => k.team !== kid.team && k.state === "grabbed") ?? assignedFoe(state, kid);
        const punish = foeIsOpen(foe);
        const blocked = foe
          ? shotHitsFort(kid, foe.x - kid.x, foe.y - kid.y, state.forts, fortOfGrabbed(state, kid))
          : true;
        if (blocked) throwChance = 0;
        else throwChance = punish ? 0.92 : 0.16;
      } else if (stance === "enemy") {
        const foe = closestHittableEnemy(kid, state.kids, state.forts);
        throwChance = !foe ? 0 : foeIsOpen(foe) ? 0.7 : 0.35;
      }
      if (holding) throwChance = 0;
      else if (!intercepting && !arenaCanThrow(state)) throwChance = 0;
      else if (!intercepting && !mayPunish) throwChance = 0;
      else {
        const hunger = arenaHunger(state);
        if (hunger) throwChance = Math.max(throwChance, stance === "enemy" ? hunger * 0.82 : hunger);
      }
      if (!hunting && !intercepting && arenaBalls(state) > 1 && !draggedMate(state, kid) && mateThrewRecently(state, kid)) {
        throwChance = Math.min(throwChance, 0.1);
      }
      if (Math.random() < throwChance && !(forbidFort && cover)) {
        kid.ai.phase = "windup";
        kid.ai.t = rand(0.2, stance === "attack" ? 0.48 : 0.7);
        kid.ai.charge = 0;
        kid.ai.fake = canFake(stance, hard) && !intercepting;
      } else {
        kid.ai.phase = "move";
        kid.ai.t = rand(0.35, stance === "defend" ? 1.3 : 0.95);
        if (cover && forbidFort) {
          const fort = inFort(kid.x, kid.y, state.forts)!;
          const next = peekSpot(kid, fort, state);
          kid.ai.destX = next.x;
          kid.ai.destY = next.y;
        } else if (cover && !forbidFort) {
          kid.ai.phase = "idle";
          kid.ai.t = 0.22;
        } else if (lastStand) {
          const pile = lastStandPile(state, kid);
          if (pile) {
            const hide = hideSpot(kid, pile, state);
            kid.ai.destX = hide.x;
            kid.ai.destY = hide.y;
          } else pickDest(state, kid, stance, mayCross, mayCross, hard);
        } else if (hunting) {
          surroundLast(state, kid, hard);
        } else if (panic) {
          const pile = shouldHideInPile(state, kid, stance, hard)!;
          const hide = hideSpot(kid, pile, state);
          kid.ai.destX = hide.x;
          kid.ai.destY = hide.y;
        } else if (forbidFort) pickAwayFromFort(state, kid);
        else pickDest(state, kid, stance, mayCross, mayCross, hard);
      }
    }
  }
}

function hideMax(_stance: "defend" | "attack" | "enemy", lastStand = false, hunting = false) {
  if (hunting) return 0;
  if (lastStand) return 1;
  return 3;
}

function tickFortRoam(
  state: GameState,
  kid: Kid,
  _dt: number,
  stance: "defend" | "attack" | "enemy",
  lastStand = false,
  hunting = false,
) {
  if (!kid.ai) return false;
  const cover = !!inFort(kid.x, kid.y, state.forts);
  const blocked = hunting || !canEnterFort(kid) || hideMax(stance, lastStand, hunting) <= 0;
  if (blocked) {
    if (cover && kid.ai.phase !== "dodge") {
      const fort = inFort(kid.x, kid.y, state.forts)!;
      const next = peekSpot(kid, fort, state);
      kid.ai.phase = "move";
      kid.ai.t = Math.max(kid.ai.t, 0.4);
      kid.ai.destX = next.x;
      kid.ai.destY = next.y;
    }
    return true;
  }
  return false;
}

function tickCamp(state: GameState, kid: Kid, dt: number, stance: "defend" | "attack" | "enemy", hard: boolean) {
  if (!kid.ai || kid.state === "grabbed") return;
  if (inFort(kid.x, kid.y, state.forts)) {
    kid.ai.campT = 0;
    kid.ai.campX = kid.x;
    kid.ai.campY = kid.y;
    return;
  }
  const d = Math.hypot(kid.x - (kid.ai.campX ?? kid.x), kid.y - (kid.ai.campY ?? kid.y));
  if (d > 48) {
    kid.ai.campX = kid.x;
    kid.ai.campY = kid.y;
    kid.ai.campT = 0;
    return;
  }
  kid.ai.campT = (kid.ai.campT ?? 0) + dt;
  if (kid.ai.campT < 3) return;
  kid.ai.campT = 0;
  kid.ai.campX = kid.x;
  kid.ai.campY = kid.y;
  const ang = rand(0, Math.PI * 2);
  kid.ai.phase = "move";
  kid.ai.t = 0.65;
  kid.ai.destX = clampSide(kid.x + Math.cos(ang) * rand(110, 160), kid.team, hard && stance === "enemy");
  kid.ai.destY = clamp(kid.y + Math.sin(ang) * rand(90, 140), MARGIN, WORLD_H - MARGIN);
  bumpDestOutOfFort(state, kid);
}

function pickAwayFromFort(state: GameState, kid: Kid) {
  const fort = nearestFort(state, kid);
  const ox = kid.x - (fort?.x ?? kid.x);
  const oy = kid.y - (fort?.y ?? kid.y);
  const len = Math.hypot(ox, oy) || 1;
  const dist = rand(100, 160);
  let x = clampSide(kid.x + (ox / len) * dist, kid.team);
  let y = clamp(kid.y + (oy / len) * dist, MARGIN, WORLD_H - MARGIN);
  if (inFort(x, y, state.forts) || Math.hypot(x - (fort?.x ?? x), y - (fort?.y ?? y)) < 70) {
    x = clampSide(rand(MARGIN + 12, WORLD_W * 0.34), kid.team);
    y = clamp(kid.y + rand(-90, 90), MARGIN, WORLD_H - MARGIN);
  }
  kid.ai!.destX = x;
  kid.ai!.destY = y;
}

function pickDest(state: GameState, kid: Kid, stance: "defend" | "attack" | "enemy", scatter = false, cross = false, hard = false) {
  if (kid.ai && kid.ai.awayT > 0) {
    pickAwayFromFort(state, kid);
    return;
  }
  if (kid.team === "green" && stance === "enemy" && !hard) {
    const behind = closestEnemy(kid, state.kids);
    if (behind && behind.x < kid.x - 8) {
      kid.ai!.destX = clamp(behind.x - rand(36, 88), MARGIN, behind.x - 10);
      kid.ai!.destY = clamp(behind.y + rand(-28, 28), MARGIN, WORLD_H - MARGIN);
      bumpDestOutOfFort(state, kid);
      return;
    }
  }
  if (living(state.kids, kid.team).length <= 1 && canEnterFort(kid)) {
    const pile = lastStandPile(state, kid);
    if (pile && !inFort(kid.x, kid.y, state.forts)) {
      const hide = hideSpot(kid, pile, state);
      kid.ai!.destX = hide.x;
      kid.ai!.destY = hide.y;
      return;
    }
  }
  if (living(state.kids, kid.team).length > 1 && living(state.kids, kid.team === "red" ? "green" : "red").length <= 1) {
    surroundLast(state, kid, state.hard || state.pvp);
    return;
  }
  if (teamSurging(state, kid.team)) {
    pressDest(state, kid, stance === "enemy" && cross);
    return;
  }
  if (state.pickup && kid.ai && canTeamClaimPickup(state, kid.team) && (stance !== "defend" || Math.random() < 0.32)) {
    const crowded = nearbyFoes(state, kid, 170).length >= 2;
    const d = Math.hypot(kid.x - state.pickup.x, kid.y - state.pickup.y);
    if (!crowded && d < (stance === "attack" ? 280 : 240) && Math.random() < (stance === "attack" ? 0.85 : 0.7)) {
      kid.ai.destX = clampSide(state.pickup.x + rand(-6, 6), kid.team, cross);
      kid.ai.destY = state.pickup.y + rand(-6, 6);
      return;
    }
  }
  if (state.kit && kid.ai && canTeamClaimPickup(state, kid.team) && teamNeedsHeal(state, kid.team)) {
    const d = Math.hypot(kid.x - state.kit.x, kid.y - state.kit.y);
    if (d < 260 && Math.random() < 0.7) {
      kid.ai.destX = clamp(state.kit.x + rand(-8, 8), MARGIN, WORLD_W - MARGIN);
      kid.ai.destY = clamp(state.kit.y + rand(-8, 8), MARGIN, WORLD_H - MARGIN);
      return;
    }
  }
  const panicFort = shouldHideInPile(state, kid, stance, cross);
  if (panicFort) {
    const hide = hideSpot(kid, panicFort, state);
    kid.ai!.destX = hide.x;
    kid.ai!.destY = hide.y;
    return;
  }
  const foes = living(state.kids).filter((k) => k.team !== kid.team);
  const target =
    scatter && foes.length && Math.random() < 0.72
      ? foes[(Math.random() * foes.length) | 0]!
      : closestEnemy(kid, state.kids);
  const fort = nearestFort(state, kid);

  if (stance === "defend") {
    const mate = draggedMate(state, kid);
    if (mate) {
      const foe = closestEnemy(mate, state.kids) ?? closestEnemy(kid, state.kids);
      const y = foe ? clearShotY(kid, foe, state.forts) : mate.y;
      kid.ai!.destX = clampSide(mate.x + (kid.team === "red" ? 70 : -70), kid.team, cross);
      kid.ai!.destY = clamp(y + laneOffset(state, kid, 14), MARGIN, WORLD_H - MARGIN);
      bumpDestOutOfFort(state, kid);
      return;
    }
    const fort = fortForKid(state, kid);
    if (fort) {
      const peek = peekSpot(kid, fort, state);
      kid.ai!.destX = peek.x;
      kid.ai!.destY = peek.y;
      return;
    }
    kid.ai!.destX = kid.team === "red" ? clampSide(rand(WORLD_W * 0.7, WORLD_W - MARGIN - 8), kid.team) : clampSide(rand(MARGIN + 8, WORLD_W * 0.3), kid.team);
    kid.ai!.destY = clamp(laneY(state, kid) + rand(-24, 24), MARGIN, WORLD_H - MARGIN);
    return;
  }

  if (stance === "attack") {
    pressDest(state, kid, false);
    return;
  }

  if (stance === "enemy" && cross) {
    const job = teamJob(state, kid);
    if (job === "wrap") {
      const fort = nearestFort(state, kid);
      if (fort) {
        const peek = peekSpot(kid, fort, state);
        kid.ai!.destX = peek.x;
        kid.ai!.destY = peek.y;
        return;
      }
    } else if (job === "loot" && state.pickup && canTeamClaimPickup(state, kid.team)) {
      kid.ai!.destX = clamp(state.pickup.x + rand(-8, 8), MARGIN, WORLD_W - MARGIN);
      kid.ai!.destY = clamp(state.pickup.y + rand(-8, 8), MARGIN, WORLD_H - MARGIN);
      bumpDestOutOfFort(state, kid);
      return;
    }
    pressDest(state, kid, true);
    return;
  }

  if (fort && Math.random() < 0.28) {
    kid.ai!.destX = clampSide(fort.x + rand(-30, 30), kid.team, cross);
    kid.ai!.destY = clamp(fort.y + rand(-16, 16), MARGIN, WORLD_H - MARGIN);
  } else if (target && Math.random() < 0.45) {
    const chase = cross
      ? clamp(target.x - rand(70, 150), MARGIN, WORLD_W - MARGIN)
      : clampSide(target.x * 0.35 + 80, kid.team);
    kid.ai!.destX = chase;
    kid.ai!.destY = clamp(target.y + rand(-40, 40), MARGIN, WORLD_H - MARGIN);
  } else {
    kid.ai!.destX = cross
      ? rand(MARGIN + 10, WORLD_W * 0.72)
      : rand(MARGIN + 10, WORLD_W * 0.42);
    kid.ai!.destY = rand(MARGIN, WORLD_H - MARGIN);
  }
  bumpDestOutOfFort(state, kid);
}

function nearestFort(state: GameState, kid: Kid) {
  let best = state.forts[0] ?? null;
  let bestD = Infinity;
  for (const f of state.forts) {
    if (f.maxHp > 0 && f.hp <= 0) continue;
    const d = (f.x - kid.x) ** 2 + (f.y - kid.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

function livingMates(state: GameState, team: Kid["team"]) {
  return living(state.kids).filter((k) => k.team === team).sort((a, b) => a.y - b.y || a.id - b.id);
}

export function draggedMate(state: GameState, kid: Kid) {
  return living(state.kids).find((k) => k.team === kid.team && k.id !== kid.id && k.state === "grabbed") ?? null;
}

function focusFoe(state: GameState, kid: Kid) {
  const mate = draggedMate(state, kid);
  if (mate) return closestEnemy(mate, state.kids) ?? closestEnemy(kid, state.kids);
  return assignedFoe(state, kid) ?? closestEnemy(kid, state.kids);
}

function assignedFoe(state: GameState, kid: Kid): Kid | null {
  const mates = livingMates(state, kid.team);
  const foes = living(state.kids)
    .filter((k) => k.team !== kid.team)
    .sort((a, b) => a.hp - b.hp || a.y - b.y);
  if (!foes.length) return null;
  const slot = mates.findIndex((k) => k.id === kid.id);
  if (slot < 0) return closestEnemy(kid, state.kids);
  if (foes.length === 1) return foes[0]!;
  const t = mates.length <= 1 ? 0 : slot / (mates.length - 1);
  const idx = Math.round(t * (foes.length - 1));
  return foes[idx] ?? foes[0]!;
}

function laneY(state: GameState, kid: Kid) {
  const mates = livingMates(state, kid.team);
  const slot = Math.max(0, mates.findIndex((k) => k.id === kid.id));
  const n = Math.max(1, mates.length);
  const band = (WORLD_H - 2 * MARGIN) / n;
  return MARGIN + band * (slot + 0.5);
}

function laneOffset(state: GameState, kid: Kid, jitter: number) {
  const mates = livingMates(state, kid.team);
  const slot = Math.max(0, mates.findIndex((k) => k.id === kid.id));
  const n = Math.max(1, mates.length);
  const spread = n === 1 ? 0 : (slot - (n - 1) / 2) * 26;
  return spread + rand(-jitter, jitter);
}

function fortForKid(state: GameState, kid: Kid) {
  const y = laneY(state, kid);
  let best: Fort | null = null;
  let bestD = Infinity;
  for (const f of state.forts) {
    if (f.maxHp > 0 && f.hp <= 0) continue;
    const d = Math.abs(f.y - y) * 1.6 + Math.abs(f.x - kid.x) * 0.55;
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best ?? nearestFort(state, kid);
}

function lastStandPile(state: GameState, kid: Kid): Fort | null {
  if (!canEnterFort(kid)) return null;
  return safeHideFort(state, kid) ?? nearestFort(state, kid);
}

function pressDest(state: GameState, kid: Kid, cross: boolean) {
  const target = assignedFoe(state, kid) ?? closestEnemy(kid, state.kids);
  if (!target || !kid.ai) return;
  const y = clearShotY(kid, target, state.forts);
  const gap = rand(150, 230);
  const pressX =
    kid.team === "red"
      ? clamp(target.x + gap, WORLD_W * 0.46, WORLD_W * 0.68)
      : clamp(target.x - gap, WORLD_W * 0.32, WORLD_W * 0.54);
  kid.ai.destX = kid.team === "red" ? pressX : clampSide(pressX, kid.team, cross);
  kid.ai.destY = clamp(y + laneOffset(state, kid, 10), MARGIN, WORLD_H - MARGIN);
  bumpDestOutOfFort(state, kid);
}

export function huntPressers(state: GameState, team: Kid["team"], hard: boolean) {
  const mates = livingMates(state, team);
  if (hard || state.pvp || mates.length <= 2) return new Set(mates.map((k) => k.id));
  const foe = living(state.kids).find((k) => k.team !== team) ?? null;
  const ranked = [...mates].sort((a, b) => {
    const da = foe ? Math.hypot(a.x - foe.x, a.y - foe.y) : a.y;
    const db = foe ? Math.hypot(b.x - foe.x, b.y - foe.y) : b.y;
    return da - db || a.id - b.id;
  });
  return new Set(ranked.slice(0, 2).map((k) => k.id));
}

export function surroundLast(state: GameState, kid: Kid, hard = false) {
  const foe = closestEnemy(kid, state.kids);
  if (!foe || !kid.ai) {
    pickAwayFromFort(state, kid);
    return;
  }
  const press = huntPressers(state, kid.team, hard);
  if (!press.has(kid.id)) {
    kid.ai.destX = clamp(WORLD_W * 0.4 + rand(-18, 18), MARGIN, WORLD_W * 0.48);
    kid.ai.destY = clamp(clearShotY(kid, foe, state.forts) + laneOffset(state, kid, 16), MARGIN, WORLD_H - MARGIN);
    bumpDestOutOfFort(state, kid);
    return;
  }
  const mates = livingMates(state, kid.team);
  const i = Math.max(0, mates.findIndex((k) => k.id === kid.id));
  const n = Math.max(1, mates.length);
  const blocker = [...press].map((id) => mates.find((k) => k.id === id)!).filter(Boolean)[0];
  const pile = nearestFort(state, foe);
  if (blocker && kid.id === blocker.id && pile) {
    const dx = pile.x - foe.x;
    const dy = pile.y - foe.y;
    const len = Math.hypot(dx, dy) || 1;
    const dist = Math.max(48, len - pile.rx - 36);
    kid.ai.destX = clamp(foe.x + (dx / len) * dist, MARGIN, WORLD_W - MARGIN);
    kid.ai.destY = clamp(foe.y + (dy / len) * dist, MARGIN, WORLD_H - MARGIN);
    bumpDestOutOfFort(state, kid);
    return;
  }
  const side = kid.team === "red" ? 1 : -1;
  const lane = (i - (n - 1) / 2) * 36;
  const y = clearShotY(kid, foe, state.forts) + lane;
  const gap = 96 + (i % 3) * 28;
  kid.ai.destX = clamp(foe.x + side * gap, MARGIN, WORLD_W - MARGIN);
  kid.ai.destY = clamp(y, MARGIN, WORLD_H - MARGIN);
  bumpDestOutOfFort(state, kid);
}

function nearbyFoes(state: GameState, kid: Kid, radius: number) {
  return living(state.kids).filter((k) => k.team !== kid.team && Math.hypot(k.x - kid.x, k.y - kid.y) <= radius);
}

/** Pile on our side of the fight — not behind the enemy pack. */
function safeHideFort(state: GameState, kid: Kid): Fort | null {
  const pack = nearbyFoes(state, kid, 220);
  const foes = pack.length ? pack : living(state.kids).filter((k) => k.team !== kid.team);
  if (!foes.length) return null;
  const cx = foes.reduce((s, k) => s + k.x, 0) / foes.length;
  const towardPack = cx - kid.x;
  let best: Fort | null = null;
  let bestD = Infinity;
  for (const f of state.forts) {
    if (f.maxHp > 0 && f.hp <= 0) continue;
    if (towardPack > 40 && f.x > cx + 24) continue;
    if (towardPack < -40 && f.x < cx - 24) continue;
    const d = Math.hypot(f.x - kid.x, f.y - kid.y);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

/**
 * Hide in a pile when the local fight is crowded and cover is closer than
 * running through the pack. Easy only if the pile is strictly nearer.
 */
export function shouldHideInPile(
  state: GameState,
  kid: Kid,
  stance: "defend" | "attack" | "enemy",
  hard: boolean,
): Fort | null {
  if (inFort(kid.x, kid.y, state.forts)) return null;
  if ((kid.ai?.awayT ?? 0) > 0) return null;
  if (!canEnterFort(kid)) return null;
  if (living(state.kids, kid.team).length > 1 && living(state.kids, kid.team === "red" ? "green" : "red").length <= 1) {
    return null;
  }
  const fort = safeHideFort(state, kid);
  if (!fort) return null;
  const dFort = Math.hypot(fort.x - kid.x, fort.y - kid.y);
  if (dFort > 250) return null;
  const foe = closestEnemy(kid, state.kids);
  const dFoe = foe ? Math.hypot(foe.x - kid.x, foe.y - kid.y) : Infinity;
  const near = nearbyFoes(state, kid, stance === "defend" ? 200 : 170);
  if (near.length >= 2) {
    if (stance === "attack" || (stance === "enemy" && !hard)) return dFort <= 200 ? fort : null;
    return fort;
  }
  if (stance === "defend" && dFoe < 155) return fort;
  if (near.length === 1 && dFoe < 108 && dFort <= dFoe + 48) return fort;
  return null;
}

function hideSpot(kid: Kid, fort: Fort, state: GameState): { x: number; y: number } {
  return fortCoverSpot(fort, threatCentroid(state, kid), "hide");
}

function peekSpot(kid: Kid, fort: Fort, state: GameState): { x: number; y: number } {
  return fortCoverSpot(fort, threatCentroid(state, kid), "peek");
}

function threatCentroid(state: GameState, kid: Kid): { x: number; y: number } {
  const foes = living(state.kids).filter((k) => k.team !== kid.team);
  if (!foes.length) return { x: kid.team === "red" ? 0 : WORLD_W, y: kid.y };
  let sx = 0;
  let sy = 0;
  let w = 0;
  for (const f of foes) {
    const wt = 1 / Math.max(40, Math.hypot(f.x - kid.x, f.y - kid.y));
    sx += f.x * wt;
    sy += f.y * wt;
    w += wt;
  }
  return { x: sx / w, y: sy / w };
}

/** Stand on the far side of the pile from the threat — left, right, above, or below. */
export function fortCoverSpot(
  fort: Fort,
  threat: { x: number; y: number },
  mode: "hide" | "peek",
): { x: number; y: number } {
  let dx = fort.x - threat.x;
  let dy = fort.y - threat.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  const rim = 1 / Math.sqrt((dx / Math.max(8, fort.rx)) ** 2 + (dy / Math.max(8, fort.ry)) ** 2);
  const dist = mode === "hide" ? rim * 0.3 : rim + 26;
  return {
    x: clamp(fort.x + dx * dist, MARGIN, WORLD_W - MARGIN),
    y: clamp(fort.y + dy * dist, MARGIN, WORLD_H - MARGIN),
  };
}

function awayFromFort(kid: Kid, fort: Fort): { x: number; y: number } {
  const ox = kid.x - fort.x;
  const oy = kid.y - fort.y;
  const len = Math.hypot(ox, oy) || 1;
  return {
    x: clampSide(fort.x + (ox / len) * (fort.rx + 48), kid.team),
    y: clamp(fort.y + (oy / len) * (fort.ry + 36), MARGIN, WORLD_H - MARGIN),
  };
}

function nearFortRim(kid: Kid, state: GameState): boolean {
  if (inFort(kid.x, kid.y, state.forts)) return false;
  const fort = nearestFort(state, kid);
  if (!fort) return false;
  const dx = (kid.x - fort.x) / (fort.rx + 48);
  const dy = (kid.y - fort.y) / (fort.ry + 36);
  const d = dx * dx + dy * dy;
  return d > 1 && d < 2.4;
}

function bumpDestOutOfFort(state: GameState, kid: Kid) {
  const wall = inFort(kid.ai!.destX, kid.ai!.destY, state.forts);
  if (!wall) return;
  const above = wall.y - wall.ry - 40;
  const below = wall.y + wall.ry + 40;
  kid.ai!.destY = Math.abs(kid.ai!.destY - above) <= Math.abs(kid.ai!.destY - below) ? above : below;
  kid.ai!.destY = clamp(kid.ai!.destY, MARGIN, WORLD_H - MARGIN);
  if (inFort(kid.ai!.destX, kid.ai!.destY, state.forts)) {
    const side = Math.sign(kid.x - wall.x) || (kid.team === "green" ? -1 : 1);
    kid.ai!.destX = clamp(wall.x + side * (wall.rx + 44), MARGIN, WORLD_W - MARGIN);
  }
}

export function throwAimForStance(kid: Kid, state: GameState, stance: "defend" | "attack" | "enemy", hard: boolean) {
  const dragged = living(state.kids).find((k) => k.team !== kid.team && k.state === "grabbed") ?? null;
  if (dragged && foeHittable(kid, dragged, state.forts)) {
    const dx = dragged.x - kid.x;
    const dy = dragged.y - kid.y;
    if (!(kid.team === "green" && !hard && dx < 1)) return { dx, dy };
  }
  if (stance === "defend") {
    const foe = focusFoe(state, kid);
    if (!foe) return null;
    const dx = foe.x - kid.x;
    const miss = ((kid.id % 5) - 2) * 14;
    const dy = foe.y - kid.y + miss;
    if (kid.team === "green" && !hard && dx < 1) return null;
    return { dx, dy };
  }
  const clear = closestHittableEnemy(kid, state.kids, state.forts);
  let foe = clear;
  if (stance === "attack") {
    const assigned = assignedFoe(state, kid);
    const ignore = fortOfGrabbed(state, kid);
    if (
      assigned &&
      !isOut(assigned) &&
      !shotHitsFort(kid, assigned.x - kid.x, assigned.y - kid.y, state.forts, ignore)
    ) {
      foe = assigned;
    }
  }
  if (!foe) return null;
  const dx = foe.x - kid.x;
  const dy = foe.y - kid.y;
  if (kid.team === "green" && !hard && dx < 1) return null;
  return { dx, dy };
}

function canFake(stance: "defend" | "attack" | "enemy", hard: boolean) {
  return stance === "attack" || (stance === "enemy" && hard);
}

function dodgeDest(
  state: GameState,
  kid: Kid,
  incoming: { x: number; y: number; vx?: number; vy?: number },
  dist: number,
  cross: boolean,
) {
  const px = -(incoming.y - kid.y);
  const py = incoming.x - kid.x;
  const len = Math.hypot(px, py) || 1;
  const a = { x: kid.x + (px / len) * dist, y: kid.y + (py / len) * dist };
  const b = { x: kid.x - (px / len) * dist, y: kid.y - (py / len) * dist };
  const next = incomingBall(state, kid, 320, true);
  const score = (p: { x: number; y: number }) => {
    let s = Math.hypot(p.x - incoming.x, p.y - incoming.y);
    for (const ball of state.balls) {
      if (!ball.alive || ball.team === kid.team) continue;
      if (next && ball === next) s += Math.hypot(p.x - ball.x, p.y - ball.y) * 0.8;
      else s += Math.hypot(p.x - ball.x, p.y - ball.y) * 0.25;
    }
    return s;
  };
  const best = score(a) >= score(b) ? a : b;
  return {
    x: clampSide(best.x, kid.team, cross),
    y: clamp(best.y, MARGIN, WORLD_H - MARGIN),
  };
}

function foeIsOpen(foe: Kid | null) {
  if (!foe) return false;
  return (
    foe.state === "grabbed" ||
    foe.packT > 0.08 ||
    foe.state === "throw" ||
    foe.state === "hurt" ||
    foe.stun > 0 ||
    foe.cooldown > 0.02 ||
    (foe.ai?.phase === "dodge" && (foe.ai.t ?? 0) > 0)
  );
}

function fortOfGrabbed(state: GameState, kid: Kid): Fort | null {
  const prey = living(state.kids).find((k) => k.team !== kid.team && k.state === "grabbed");
  return prey ? inFort(prey.x, prey.y, state.forts) : null;
}

function shotHitsFort(kid: Kid, dx: number, dy: number, forts: Fort[], ignore: Fort | null = null) {
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  const reach = Math.max(40, Math.min(420, len + 16));
  const home = inFort(kid.x, kid.y, forts);
  return lineHitsFort(kid.x + nx * 22, kid.y + ny * 6, kid.x + nx * reach, kid.y + ny * reach, forts, home, ignore);
}

function clearShotY(from: Kid, to: Kid, forts: Fort[]) {
  if (!lineHitsFort(from.x, from.y, to.x, to.y, forts)) return to.y;
  let hit: Fort | null = null;
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(6, Math.ceil(dist / 18));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const f = inFort(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, forts);
    if (f) {
      hit = f;
      break;
    }
  }
  if (!hit) return to.y;
  const above = hit.y - hit.ry - 40;
  const below = hit.y + hit.ry + 40;
  return Math.abs(from.y - above) <= Math.abs(from.y - below) ? above : below;
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

/** Easy retrievers only fire toward the Maltese half (never left / backward). */
export function aiThrowAim(kid: Kid, kids: Kid[], hard: boolean, scatter: boolean) {
  if (kid.team === "green" && !hard) {
    let best: Kid | null = null;
    let bestD = Infinity;
    for (const k of kids) {
      if (k.team === kid.team || isOut(k)) continue;
      if (k.x < kid.x - 8) continue;
      const d = (k.x - kid.x) ** 2 + (k.y - kid.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    if (!best) return null;
    return { dx: Math.max(1, best.x - kid.x), dy: best.y - kid.y };
  }
  return aimFromKid(kid, kids, 0, 0, scatter);
}

function clampSide(x: number, team: Kid["team"], cross = false) {
  if (team === "green") {
    if (cross) return clamp(x, MARGIN, WORLD_W - MARGIN);
    return clamp(x, MARGIN, WORLD_W * 0.48);
  }
  return clamp(x, WORLD_W * 0.52, WORLD_W - MARGIN);
}

function moveToward(kid: Kid, tx: number, ty: number, speed: number, dt: number) {
  const dx = tx - kid.x;
  const dy = ty - kid.y;
  const d = Math.hypot(dx, dy) || 1;
  kid.x += (dx / d) * speed * dt;
  kid.y += (dy / d) * speed * dt;
  if (Math.abs(dx) > 2) kid.facing = dx < 0 ? -1 : 1;
}

function incomingBall(state: GameState, kid: Kid, range: number, leaveCover = false) {
  for (const b of state.balls) {
    if (!b.alive || b.team === kid.team) continue;
    const dx = kid.x - b.x;
    const dy = kid.y - b.y;
    const dist = Math.hypot(dx, dy);
    if (dist > range) continue;
    const closing = (b.vx * dx + b.vy * dy) / (dist || 1);
    if (closing > (leaveCover ? 18 : 40) && (leaveCover || !inFort(kid.x, kid.y, state.forts))) return b;
  }
  return null;
}