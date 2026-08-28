import { aiInterval, aiMoveSpeed, MARGIN, MAX_CHARGE, PACK_TIME, throwSpeed, WORLD_H, WORLD_W } from "./constants";
import { aimFromKid, closestEnemy, closestHittableEnemy, ensureAi, inFort, isOut, living, rand, throwSnowball } from "./sim";
import type { AllyMode, Fort, GameState, Kid, Snowball, Team } from "./types";

export type GreenControl = "enemy" | AllyMode;

const EMPTY_ROLES = { holdFire: new Set<number>(), intercept: new Set<number>() };

function foeTeam(team: Team): Team {
  return team === "red" ? "green" : "red";
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
    const longDodge = (hard && stance === "enemy") || (stance === "attack" && kid.team === "green") || lastStand;

    const forbidFort = tickFortRoam(state, kid, dt, stance);

    const incoming = incomingBall(state, kid, lastStand ? 240 : longDodge ? 210 : stance === "defend" ? 150 : 95, hard && stance === "enemy" || lastStand);
    const teamRoles = kid.team === "red" ? roles.red : roles.green;
    const intercepting = !lastStand && teamRoles.intercept.has(kid.id);
    const holding = teamRoles.holdFire.has(kid.id) && !intercepting;

    const charging = kid.ai.phase === "windup" && !lastStand;
    if (incoming && kid.stun <= 0 && kid.ai.phase !== "dodge" && (charging || !intercepting)) {
      const px = -(incoming.y - kid.y);
      const py = incoming.x - kid.x;
      const len = Math.hypot(px, py) || 1;
      const dist = charging ? 72 : longDodge ? 118 : stance === "defend" ? 88 : 64;
      kid.ai.destX = clampSide(kid.x + (px / len) * dist, kid.team, hard && stance === "enemy");
      kid.ai.destY = clamp(kid.y + (py / len) * dist, MARGIN, WORLD_H - MARGIN);
      if ((lastStand || stance === "defend") && (kid.ai.awayT ?? 0) <= 0) {
        const fort = lastStand ? lastStandPile(state, kid) : fortForKid(state, kid);
        if (fort) {
          const hide = hideSpot(kid, fort, state);
          kid.ai.destX = hide.x;
          kid.ai.destY = hide.y;
        }
      } else if (!charging && stance !== "defend") {
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
        (hard ? 3 : 1) *
        (kid.ai.phase === "dodge" ? (longDodge ? 1.75 : 1.5) : stance === "attack" ? 1.12 : 0.9);
      moveToward(kid, kid.ai.destX, kid.ai.destY, spd, dt);
      if (kid.ai.t <= 0 || Math.hypot(kid.x - kid.ai.destX, kid.y - kid.ai.destY) < 10) {
        if (kid.ai.phase === "dodge") {
          kid.ai.phase = "idle";
          if (inFort(kid.x, kid.y, state.forts) && kid.ai.awayT > 0) {
            const fort = inFort(kid.x, kid.y, state.forts)!;
            kid.ai.phase = "move";
            kid.ai.t = 0.4;
            const next = peekSpot(kid, fort, state);
            kid.ai.destX = next.x;
            kid.ai.destY = next.y;
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
        } else {
          kid.ai.phase = "windup";
        }
        kid.ai.t =
          kid.ai.phase === "windup"
            ? rand(stance === "attack" ? 0.16 : 0.32, stance === "attack" ? 0.4 : 0.8)
            : rand(0.12, aiInterval(level) * 0.5);
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
      if (lastStand && (kid.ai.awayT ?? 0) <= 0 && !inFort(kid.x, kid.y, state.forts) && !nearFortRim(kid, state)) {
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
      const holdWalk = aiMoveSpeed(level) * (hard ? 3 : 1);
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
        if (!intercepting && shotHitsFort(kid, aim.dx, aim.dy, state.forts)) {
          kid.ai.phase = "move";
          kid.ai.t = rand(0.28, 0.5);
          pickDest(state, kid, stance, false, hard && stance === "enemy");
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
        kid.ai.phase = "idle";
        kid.ai.t = (stance === "attack" ? 0.55 : 1) * aiInterval(level) * rand(0.7, 1.15) + PACK_TIME * 0.25;
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
      } else if (lastStand && (kid.ai.awayT ?? 0) <= 0) {
        throwChance = 0;
      } else if (lastStand) {
        throwChance = 0.8;
      } else if (panic) {
        throwChance = 0;
      } else if (stance === "defend") {
        throwChance = nearFortRim(kid, state) ? 0.72 : 0.1;
      } else if (stance === "attack") {
        const foe = assignedFoe(state, kid);
        const punish = foeIsOpen(foe);
        const blocked = foe ? lineHitsFort(kid.x, kid.y, foe.x, foe.y, state.forts) : true;
        if (blocked) throwChance = 0;
        else throwChance = punish ? 0.92 : 0.16;
      }
      if (holding) throwChance = 0;
      if (Math.random() < throwChance && !(forbidFort && cover)) {
        kid.ai.phase = "windup";
        kid.ai.t = rand(0.2, stance === "attack" ? 0.48 : 0.7);
        kid.ai.charge = 0;
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
          } else pickDest(state, kid, stance, hard && stance === "enemy", hard && stance === "enemy");
        } else if (panic) {
          const pile = shouldHideInPile(state, kid, stance, hard)!;
          const hide = hideSpot(kid, pile, state);
          kid.ai.destX = hide.x;
          kid.ai.destY = hide.y;
        } else if (forbidFort) pickAwayFromFort(state, kid);
        else pickDest(state, kid, stance, hard && stance === "enemy", hard && stance === "enemy");
      }
    }
  }
}

function hideMax(stance: "defend" | "attack" | "enemy") {
  return stance === "defend" ? 8 : 5;
}

function hideCooldown(stance: "defend" | "attack" | "enemy") {
  return stance === "defend" ? 3 : 5;
}

function tickFortRoam(state: GameState, kid: Kid, dt: number, stance: "defend" | "attack" | "enemy") {
  if (!kid.ai) return false;
  const cover = !!inFort(kid.x, kid.y, state.forts);
  if (kid.ai.awayT > 0) {
    kid.ai.awayT = Math.max(0, kid.ai.awayT - dt);
    if (cover && kid.ai.phase !== "dodge") {
      const fort = inFort(kid.x, kid.y, state.forts)!;
      const next = peekSpot(kid, fort, state);
      kid.ai.phase = "move";
      kid.ai.t = Math.max(kid.ai.t, 0.4);
      kid.ai.destX = next.x;
      kid.ai.destY = next.y;
    }
    return kid.ai.awayT > 0;
  }
  if (cover) {
    kid.ai.coverT += dt;
    if (kid.ai.coverT >= hideMax(stance)) {
      kid.ai.coverT = 0;
      kid.ai.awayT = hideCooldown(stance);
      const fort = inFort(kid.x, kid.y, state.forts)!;
      const next = peekSpot(kid, fort, state);
      kid.ai.phase = "move";
      kid.ai.t = 0.5;
      kid.ai.destX = next.x;
      kid.ai.destY = next.y;
      return true;
    }
    return false;
  }
  kid.ai.coverT = 0;
  return false;
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

function pickDest(state: GameState, kid: Kid, stance: "defend" | "attack" | "enemy", scatter = false, cross = false) {
  if (kid.ai && kid.ai.awayT > 0) {
    pickAwayFromFort(state, kid);
    return;
  }
  if (living(state.kids, kid.team).length <= 1 && (kid.ai?.awayT ?? 0) <= 0) {
    const pile = lastStandPile(state, kid);
    if (pile && !inFort(kid.x, kid.y, state.forts)) {
      const hide = hideSpot(kid, pile, state);
      kid.ai!.destX = hide.x;
      kid.ai!.destY = hide.y;
      return;
    }
  }
  if (state.pickup && kid.ai && (stance !== "defend" || Math.random() < 0.32)) {
    const crowded = nearbyFoes(state, kid, 170).length >= 2;
    const d = Math.hypot(kid.x - state.pickup.x, kid.y - state.pickup.y);
    if (!crowded && d < (stance === "attack" ? 280 : 240) && Math.random() < (stance === "attack" ? 0.85 : 0.7)) {
      kid.ai.destX = clampSide(state.pickup.x + rand(-6, 6), kid.team, cross);
      kid.ai.destY = state.pickup.y + rand(-6, 6);
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
    const target = assignedFoe(state, kid) ?? closestEnemy(kid, state.kids);
    if (target) {
      const y = clearShotY(kid, target, state.forts);
      const gap = rand(150, 230);
      const pressX =
        kid.team === "red"
          ? clamp(target.x + gap, WORLD_W * 0.46, WORLD_W * 0.68)
          : clamp(target.x - gap, WORLD_W * 0.32, WORLD_W * 0.54);
      kid.ai!.destX = kid.team === "red" ? pressX : clampSide(pressX, kid.team, cross);
      kid.ai!.destY = clamp(y + laneOffset(state, kid, 10), MARGIN, WORLD_H - MARGIN);
      bumpDestOutOfFort(state, kid);
      return;
    }
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
  if ((kid.ai?.awayT ?? 0) > 0) return null;
  return safeHideFort(state, kid) ?? nearestFort(state, kid);
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
  const peek = peekSpot(kid, wall, state);
  kid.ai!.destX = peek.x;
  kid.ai!.destY = peek.y;
}

export function throwAimForStance(kid: Kid, state: GameState, stance: "defend" | "attack" | "enemy", hard: boolean) {
  const clear = closestHittableEnemy(kid, state.kids, state.forts);
  if (stance === "attack" || stance === "defend") {
    const assigned = assignedFoe(state, kid);
    const foe =
      assigned && !isOut(assigned) && !shotHitsFort(kid, assigned.x - kid.x, assigned.y - kid.y, state.forts)
        ? assigned
        : clear;
    if (!foe) return null;
    const dx = foe.x - kid.x;
    const dy = foe.y - kid.y;
    if (kid.team === "green" && !hard && dx < 1) return null;
    return { dx, dy };
  }
  if (!clear) return null;
  if (kid.team === "green" && !hard && clear.x <= kid.x) return null;
  return { dx: clear.x - kid.x, dy: clear.y - kid.y };
}

function foeIsOpen(foe: Kid | null) {
  if (!foe) return false;
  return foe.packT > 0.08 || foe.state === "throw" || foe.state === "hurt" || foe.stun > 0;
}

function lineHitsFort(x0: number, y0: number, x1: number, y1: number, forts: Fort[]) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(6, Math.ceil(dist / 18));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (inFort(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, forts)) return true;
  }
  return false;
}

function shotHitsFort(kid: Kid, dx: number, dy: number, forts: Fort[]) {
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  const reach = Math.max(40, Math.min(420, len + 16));
  return lineHitsFort(kid.x + nx * 22, kid.y + ny * 6, kid.x + nx * reach, kid.y + ny * reach, forts);
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