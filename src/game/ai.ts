import { aiInterval, aiMoveSpeed, MARGIN, MAX_CHARGE, PACK_TIME, WORLD_H, WORLD_W } from "./constants";
import { aimFromKid, closestEnemy, ensureAi, inFort, isOut, living, rand, throwSnowball } from "./sim";
import type { AllyMode, GameState, Kid } from "./types";

export type GreenControl = "enemy" | AllyMode;

const FORT_STAY = 5;
const FORT_LEAVE = 5;

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

    const forbidFort = tickFortRoam(state, kid, dt, stance === "enemy");

    const incoming = incomingBall(state, kid, hard && stance === "enemy" ? 210 : stance === "defend" ? 150 : 95, hard && stance === "enemy");
    if (incoming && kid.ai.phase !== "dodge" && kid.stun <= 0) {
      kid.ai.phase = "dodge";
      kid.ai.t = hard && stance === "enemy" ? 0.5 : stance === "defend" ? 0.55 : 0.34;
      const px = -(incoming.y - kid.y);
      const py = incoming.x - kid.x;
      const len = Math.hypot(px, py) || 1;
      const dist = hard && stance === "enemy" ? 118 : stance === "defend" ? 88 : 64;
      kid.ai.destX = clampSide(kid.x + (px / len) * dist, kid.team, hard && stance === "enemy");
      kid.ai.destY = clamp(kid.y + (py / len) * dist, MARGIN, WORLD_H - MARGIN);
      if (stance === "defend" && !forbidFort) {
        const fort = nearestFort(state, kid);
        if (fort) {
          kid.ai.destX = clampSide(fort.x + rand(-18, 18), kid.team);
          kid.ai.destY = clamp(fort.y + rand(-10, 10), MARGIN, WORLD_H - MARGIN);
        }
      }
    }

    kid.ai.t -= dt;
    if (kid.ai.phase === "move" || kid.ai.phase === "dodge") {
      const spd =
        aiMoveSpeed(level) *
        (hard ? 3 : 1) *
        (kid.ai.phase === "dodge" ? (hard ? 1.75 : 1.5) : stance === "attack" ? 1.12 : 0.9);
      moveToward(kid, kid.ai.destX, kid.ai.destY, spd, dt);
      if (kid.ai.t <= 0 || Math.hypot(kid.x - kid.ai.destX, kid.y - kid.ai.destY) < 10) {
        kid.ai.phase = kid.ai.phase === "dodge" ? "idle" : "windup";
        kid.ai.t =
          kid.ai.phase === "windup"
            ? rand(stance === "attack" ? 0.18 : 0.32, stance === "attack" ? 0.45 : 0.8)
            : rand(0.12, aiInterval(level) * 0.5);
        kid.ai.charge = 0;
      }
      continue;
    }

    if (kid.packT > 0 || kid.stun > 0) continue;

    if (kid.ai.phase === "windup") {
      kid.ai.charge = Math.min(1, kid.ai.charge + dt / (stance === "defend" ? 1.15 : 0.85));
      if (kid.cooldown > 0 || kid.packT > 0) {
        if (kid.ai.t <= 0) kid.ai.phase = "idle";
        continue;
      }
      if (kid.ai.t <= 0) {
        const aim = aiThrowAim(kid, state.kids, hard && stance === "enemy", hard && stance === "enemy");
        if (!aim) {
          kid.ai.phase = "idle";
          kid.ai.t = rand(0.12, 0.3);
          continue;
        }
        const { dx, dy } = aim;
        const holdScale = stance === "defend" ? 0.42 + 0.35 * kid.ai.charge : 0.58 + 0.42 * kid.ai.charge;
        const hold = MAX_CHARGE * holdScale;
        const power = throwSnowball(state, kid, hold, dx, dy, localBalls);
        onThrow(power, kid, hold, dx, dy);
        kid.ai.phase = "idle";
        kid.ai.t = (stance === "attack" ? 0.55 : 1) * aiInterval(level) * rand(0.7, 1.15) + PACK_TIME * 0.25;
        kid.ai.charge = 0;
      }
      continue;
    }

    if (kid.ai.t <= 0) {
      const cover = !!inFort(kid.x, kid.y, state.forts);
      const throwChance =
        stance === "defend" ? (cover ? 0.64 : 0.28) : stance === "attack" ? 0.72 : 0.55;
      if (Math.random() < throwChance && !(forbidFort && cover)) {
        kid.ai.phase = "windup";
        kid.ai.t = rand(0.2, stance === "attack" ? 0.48 : 0.7);
        kid.ai.charge = 0;
      } else {
        kid.ai.phase = "move";
        kid.ai.t = rand(0.35, stance === "defend" ? 1.3 : 0.95);
        if (forbidFort) pickAwayFromFort(state, kid);
        else pickDest(state, kid, stance, hard && stance === "enemy", hard && stance === "enemy");
      }
    }
  }
}

function tickFortRoam(state: GameState, kid: Kid, dt: number, isEnemy: boolean) {
  if (!isEnemy || !kid.ai) return false;
  const cover = !!inFort(kid.x, kid.y, state.forts);
  if (kid.ai.awayT > 0) {
    kid.ai.awayT = Math.max(0, kid.ai.awayT - dt);
    kid.ai.coverT = 0;
    if (cover && kid.ai.phase !== "dodge") {
      kid.ai.phase = "move";
      kid.ai.t = Math.max(kid.ai.t, 0.8);
      pickAwayFromFort(state, kid);
    }
    return true;
  }
  if (cover) {
    kid.ai.coverT += dt;
    if (kid.ai.coverT >= FORT_STAY) {
      kid.ai.coverT = 0;
      kid.ai.awayT = FORT_LEAVE;
      kid.ai.phase = "move";
      kid.ai.t = FORT_LEAVE;
      pickAwayFromFort(state, kid);
      return true;
    }
  } else {
    kid.ai.coverT = 0;
  }
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
  if (state.pickup && kid.ai) {
    const d = Math.hypot(kid.x - state.pickup.x, kid.y - state.pickup.y);
    if (d < 240 && Math.random() < 0.7) {
      kid.ai.destX = clampSide(state.pickup.x + rand(-6, 6), kid.team, cross);
      kid.ai.destY = state.pickup.y + rand(-6, 6);
      return;
    }
  }
  const foes = living(state.kids).filter((k) => k.team !== kid.team);
  const target =
    scatter && foes.length && Math.random() < 0.72
      ? foes[(Math.random() * foes.length) | 0]!
      : closestEnemy(kid, state.kids);
  const fort = nearestFort(state, kid);
  const cover = inFort(kid.x, kid.y, state.forts);

  if (stance === "defend") {
    if (!cover && fort && Math.random() < 0.72) {
      kid.ai!.destX = clampSide(fort.x + rand(-22, 22), kid.team);
      kid.ai!.destY = clamp(fort.y + rand(-12, 12), MARGIN, WORLD_H - MARGIN);
      return;
    }
    if (kid.team === "red") {
      kid.ai!.destX = clampSide(rand(WORLD_W * 0.62, WORLD_W - MARGIN - 8), kid.team);
    } else {
      kid.ai!.destX = clampSide(rand(MARGIN + 8, WORLD_W * 0.38), kid.team);
    }
    kid.ai!.destY = clamp((target?.y ?? kid.y) + rand(-50, 50), MARGIN, WORLD_H - MARGIN);
    return;
  }

  if (stance === "attack") {
    if (fort && !cover && Math.random() < 0.12) {
      kid.ai!.destX = clampSide(fort.x + rand(-16, 16), kid.team);
      kid.ai!.destY = clamp(fort.y + rand(-10, 10), MARGIN, WORLD_H - MARGIN);
      return;
    }
    if (target) {
      kid.ai!.destX = clampSide(target.x * 0.25 + WORLD_W * 0.58, kid.team);
      kid.ai!.destY = clamp(target.y + rand(-28, 28), MARGIN, WORLD_H - MARGIN);
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
}

function nearestFort(state: GameState, kid: Kid) {
  let best = state.forts[0] ?? null;
  let bestD = Infinity;
  for (const f of state.forts) {
    const d = (f.x - kid.x) ** 2 + (f.y - kid.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
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