import { aiInterval, aiMoveSpeed, MARGIN, MAX_CHARGE, PACK_TIME, WORLD_H, WORLD_W } from "./constants";
import { aimFromKid, closestEnemy, ensureAi, inFort, isOut, living, rand, throwSnowball } from "./sim";
import type { AllyMode, Fort, GameState, Kid } from "./types";

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
      if (stance === "defend") {
        const fort = fortForKid(state, kid);
        if (fort) {
          kid.ai.destX = coverDestX(kid, fort);
          kid.ai.destY = clamp(fort.y + rand(-14, 14), MARGIN, WORLD_H - MARGIN);
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
        if (kid.ai.phase === "dodge") {
          kid.ai.phase = "idle";
        } else if (stance === "defend" && inFort(kid.x, kid.y, state.forts)) {
          kid.ai.phase = "idle";
        } else if (stance === "defend") {
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
      kid.ai.charge = Math.min(1, kid.ai.charge + dt / (stance === "defend" ? 1.15 : 0.85));
      if (kid.cooldown > 0 || kid.packT > 0) {
        if (kid.ai.t <= 0) kid.ai.phase = "idle";
        continue;
      }
      if (kid.ai.t <= 0) {
        const aim = throwAimForStance(kid, state, stance, hard);
        if (!aim) {
          kid.ai.phase = "idle";
          kid.ai.t = rand(0.12, 0.3);
          continue;
        }
        if (stance === "attack" && shotHitsFort(kid, aim.dx, aim.dy, state.forts)) {
          kid.ai.phase = "move";
          kid.ai.t = rand(0.28, 0.5);
          pickDest(state, kid, stance, false, false);
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
      let throwChance = 0.55;
      if (stance === "defend") {
        throwChance = cover ? 0.7 : 0.08;
      } else if (stance === "attack") {
        const foe = assignedFoe(state, kid);
        const punish = foeIsOpen(foe);
        const blocked = foe ? lineHitsFort(kid.x, kid.y, foe.x, foe.y, state.forts) : true;
        if (blocked) throwChance = 0;
        else throwChance = punish ? 0.92 : 0.16;
      }
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
  if (state.pickup && kid.ai && (stance !== "defend" || Math.random() < 0.32)) {
    const d = Math.hypot(kid.x - state.pickup.x, kid.y - state.pickup.y);
    if (d < (stance === "attack" ? 280 : 240) && Math.random() < (stance === "attack" ? 0.85 : 0.7)) {
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
    const fort = fortForKid(state, kid);
    const cover = !!inFort(kid.x, kid.y, state.forts);
    if (fort && (!cover || Math.random() < 0.55)) {
      kid.ai!.destX = coverDestX(kid, fort);
      kid.ai!.destY = clamp(fort.y + laneOffset(state, kid, 22), MARGIN, WORLD_H - MARGIN);
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

function coverDestX(kid: Kid, fort: { x: number }) {
  const behind = kid.team === "red" ? 42 : -42;
  return clampSide(fort.x + behind + rand(-10, 10), kid.team);
}

function throwAimForStance(kid: Kid, state: GameState, stance: "defend" | "attack" | "enemy", hard: boolean) {
  if (stance === "attack" || stance === "defend") {
    const foe = assignedFoe(state, kid) ?? closestEnemy(kid, state.kids);
    if (!foe) return aiThrowAim(kid, state.kids, hard, false);
    const aimY = stance === "attack" ? clearShotY(kid, foe, state.forts) : foe.y;
    const dx = foe.x - kid.x;
    const dy = aimY - kid.y;
    if (kid.team === "green" && !hard && dx < 1) return aiThrowAim(kid, state.kids, false, false);
    if (kid.team === "red" && dx > 12 && stance === "defend") {
      const front = closestEnemy(kid, state.kids);
      if (front) return { dx: front.x - kid.x, dy: front.y - kid.y };
    }
    return { dx, dy };
  }
  return aiThrowAim(kid, state.kids, hard && stance === "enemy", hard && stance === "enemy");
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
  return lineHitsFort(kid.x + nx * 28, kid.y + ny * 8, kid.x + nx * 420, kid.y + ny * 420, forts);
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