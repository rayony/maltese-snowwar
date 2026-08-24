import { aiInterval, aiMoveSpeed, MARGIN, MAX_CHARGE, WORLD_H, WORLD_W } from "./constants";
import { aimFromKid, closestEnemy, inFort, isOut, rand, throwSnowball } from "./sim";
import type { GameState, Kid } from "./types";

export function stepAi(
  state: GameState,
  dt: number,
  onThrow: (power: number) => void,
) {
  if (state.phase !== "fight" || state.freeze > 0) return;
  const level = state.level;

  for (const kid of state.kids) {
    if (kid.team !== "green" || isOut(kid) || !kid.ai) continue;
    if (kid.stun > 0 || kid.state === "throw" || kid.state === "hurt") continue;

    const incoming = incomingBall(state, kid);
    if (incoming && kid.ai.phase !== "dodge") {
      kid.ai.phase = "dodge";
      kid.ai.t = 0.38;
      const px = -(incoming.y - kid.y);
      const py = incoming.x - kid.x;
      const len = Math.hypot(px, py) || 1;
      kid.ai.destX = kid.x + (px / len) * 70;
      kid.ai.destY = kid.y + (py / len) * 70;
    }

    kid.ai.t -= dt;
    if (kid.ai.phase === "move" || kid.ai.phase === "dodge") {
      moveToward(kid, kid.ai.destX, kid.ai.destY, aiMoveSpeed(level) * (kid.ai.phase === "dodge" ? 1.45 : 1), dt);
      if (kid.ai.t <= 0 || Math.hypot(kid.x - kid.ai.destX, kid.y - kid.ai.destY) < 10) {
        kid.ai.phase = kid.ai.phase === "dodge" ? "idle" : "windup";
        kid.ai.t = kid.ai.phase === "windup" ? rand(0.28, 0.7) : rand(0.15, aiInterval(level) * 0.5);
        kid.ai.charge = 0;
      }
      continue;
    }

    if (kid.ai.phase === "windup") {
      kid.ai.charge = Math.min(1, kid.ai.charge + dt);
      if (kid.cooldown > 0) continue;
      if (kid.ai.t <= 0) {
        const { dx, dy } = aimFromKid(kid, state.kids);
        const hold = MAX_CHARGE * (0.52 + 0.48 * kid.ai.charge);
        const power = throwSnowball(state, kid, hold, dx, dy);
        onThrow(power);
        kid.ai.phase = "idle";
        kid.ai.t = aiInterval(level) * rand(0.7, 1.2);
        kid.ai.charge = 0;
      }
      continue;
    }

    if (kid.ai.t <= 0) {
      const roll = Math.random();
      if (roll < 0.55) {
        kid.ai.phase = "windup";
        kid.ai.t = rand(0.25, 0.65);
        kid.ai.charge = 0;
      } else {
        kid.ai.phase = "move";
        kid.ai.t = rand(0.4, 1.1);
        const target = closestEnemy(kid, state.kids);
        const fort = state.forts[(Math.random() * state.forts.length) | 0];
        if (fort && Math.random() < 0.28) {
          kid.ai.destX = fort.x + rand(-30, 30);
          kid.ai.destY = fort.y + rand(-16, 16);
        } else if (target && Math.random() < 0.45) {
          kid.ai.destX = clampAi(target.x * 0.35 + 80, true);
          kid.ai.destY = target.y + rand(-40, 40);
        } else {
          kid.ai.destX = rand(MARGIN + 10, WORLD_W * 0.42);
          kid.ai.destY = rand(MARGIN, WORLD_H - MARGIN);
        }
      }
    }
  }
}

function clampAi(x: number, left: boolean) {
  if (left) return Math.max(MARGIN, Math.min(WORLD_W * 0.48, x));
  return x;
}

function moveToward(kid: Kid, tx: number, ty: number, speed: number, dt: number) {
  const dx = tx - kid.x;
  const dy = ty - kid.y;
  const d = Math.hypot(dx, dy) || 1;
  kid.x += (dx / d) * speed * dt;
  kid.y += (dy / d) * speed * dt;
  kid.facing = dx < 0 ? -1 : 1;
}

function incomingBall(state: GameState, kid: Kid) {
  for (const b of state.balls) {
    if (!b.alive || b.team === kid.team) continue;
    const dx = kid.x - b.x;
    const dy = kid.y - b.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 110) continue;
    const closing = (b.vx * dx + b.vy * dy) / (dist || 1);
    if (closing > 40 && !inFort(kid.x, kid.y, state.forts)) return b;
  }
  return null;
}
