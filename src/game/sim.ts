import {
  BALL_RADIUS,
  enemyCountForLevel,
  holdPower,
  HP,
  KID_RADIUS,
  MARGIN,
  PLAYER_COUNT,
  THROW_COOLDOWN,
  throwRange,
  throwSpeed,
  WORLD_H,
  WORLD_W,
} from "./constants";
import type { Fort, GameState, Kid, Snowball, Team } from "./types";

export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function nextId(state: GameState) {
  return state.nextId++;
}

function makeKid(state: GameState, team: Team, x: number, y: number): Kid {
  return {
    id: nextId(state),
    team,
    x,
    y,
    hp: HP,
    maxHp: HP,
    state: "idle",
    stateT: 0,
    cooldown: rand(0, 0.4),
    animT: Math.random(),
    flash: 0,
    stun: 0,
    facing: team === "red" ? -1 : 1,
    ai:
      team === "green"
        ? {
            phase: "idle",
            t: rand(0.2, 0.9),
            destX: x,
            destY: y,
            charge: 0,
          }
        : null,
  };
}

export function makeForts(): Fort[] {
  return [
    { x: 390, y: 168, rx: 92, ry: 40 },
    { x: 545, y: 372, rx: 108, ry: 46 },
  ];
}

export function createState(level: number): GameState {
  const state: GameState = {
    kids: [],
    balls: [],
    forts: makeForts(),
    particles: [],
    footprints: [],
    flakes: [],
    level,
    freeze: 0,
    introT: 1.25,
    phase: "intro",
    nextId: 1,
    time: 0,
    trauma: 0,
  };

  const redYs = [128, 270, 412];
  for (let i = 0; i < PLAYER_COUNT; i++) {
    state.kids.push(makeKid(state, "red", 790 + (i % 2) * 36, redYs[i]!));
  }

  const n = enemyCountForLevel(level);
  const cols = n <= 5 ? 2 : n <= 9 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  for (let i = 0; i < n; i++) {
    const col = Math.floor(i / rows);
    const row = i % rows;
    const x = 70 + col * 78;
    const y = 90 + ((row + 0.5) * (WORLD_H - 140)) / rows + rand(-10, 10);
    state.kids.push(makeKid(state, "green", x, y));
  }

  for (let i = 0; i < 70; i++) {
    state.flakes.push({
      x: Math.random() * WORLD_W,
      y: Math.random() * WORLD_H,
      vx: rand(-12, 12),
      vy: rand(18, 48),
      life: 1,
      maxLife: 1,
      size: rand(1.2, 3.2),
      kind: "flake",
    });
  }

  return state;
}

export function inFort(x: number, y: number, forts: Fort[]) {
  for (const f of forts) {
    const dx = (x - f.x) / f.rx;
    const dy = (y - f.y) / f.ry;
    if (dx * dx + dy * dy <= 1) return f;
  }
  return null;
}

export function living(kids: Kid[], team?: Team) {
  return kids.filter((k) => !isOut(k) && (team ? k.team === team : true));
}

export function isOut(k: Kid) {
  return k.state === "buried" || k.hp <= 0;
}

export function closestEnemy(kid: Kid, kids: Kid[]) {
  const other: Team = kid.team === "red" ? "green" : "red";
  let best: Kid | null = null;
  let bestD = Infinity;
  for (const k of kids) {
    if (k.team !== other || isOut(k)) continue;
    const d = (k.x - kid.x) ** 2 + (k.y - kid.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}

export function throwSnowball(
  state: GameState,
  kid: Kid,
  charge: number,
  dirX: number,
  dirY: number,
) {
  const power = holdPower(charge);
  let len = Math.hypot(dirX, dirY);
  if (len < 0.001) {
    dirX = kid.team === "red" ? -1 : 1;
    dirY = 0;
    len = 1;
  }
  const nx = dirX / len;
  const ny = dirY / len;
  const speed = throwSpeed(power);
  const range = throwRange(power);
  const ball: Snowball = {
    x: kid.x + nx * 30,
    y: kid.y + ny * 10 - 6,
    vx: nx * speed,
    vy: ny * speed,
    team: kid.team,
    r: BALL_RADIUS,
    fromId: kid.id,
    grace: 0.1,
    spin: Math.random() * Math.PI * 2,
    alive: true,
    range,
    traveled: 0,
  };
  state.balls.push(ball);
  kid.state = "throw";
  kid.stateT = 0.38;
  kid.cooldown = THROW_COOLDOWN;
  kid.facing = nx < 0 ? -1 : 1;
  burst(state, kid.x + nx * 22, kid.y, nx * 40, 8, "puff");
  return power;
}

export function burst(
  state: GameState,
  x: number,
  y: number,
  push: number,
  n: number,
  kind: "puff" | "spark" = "puff",
) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = rand(20, 90);
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * s + push,
      vy: Math.sin(a) * s - 20,
      life: rand(0.25, 0.55),
      maxLife: 0.55,
      size: rand(2, 5.5),
      kind,
    });
  }
}

function separate(state: GameState, dt: number) {
  const kids = state.kids;
  for (let i = 0; i < kids.length; i++) {
    const a = kids[i]!;
    if (isOut(a) || a.state === "grabbed") continue;
    for (let j = i + 1; j < kids.length; j++) {
      const b = kids[j]!;
      if (isOut(b)) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const min = KID_RADIUS * 1.85;
      if (d >= min) continue;
      const push = ((min - d) / min) * 90 * dt;
      const nx = dx / d;
      const ny = dy / d;
      if (b.state !== "grabbed") {
        b.x += nx * push;
        b.y += ny * push;
      }
      a.x -= nx * push;
      a.y -= ny * push;
    }
    a.x = clamp(a.x, MARGIN, WORLD_W - MARGIN);
    a.y = clamp(a.y, MARGIN, WORLD_H - MARGIN);
  }
}

function stepBalls(state: GameState, dt: number, onHit: (heavy: boolean) => void) {
  for (const ball of state.balls) {
    if (!ball.alive) continue;
    const stepX = ball.vx * dt;
    const stepY = ball.vy * dt;
    ball.x += stepX;
    ball.y += stepY;
    ball.traveled += Math.hypot(stepX, stepY);
    ball.spin += dt * 10;
    ball.grace = Math.max(0, ball.grace - dt);
    if (ball.x < -20 || ball.x > WORLD_W + 20 || ball.y < -20 || ball.y > WORLD_H + 20) {
      ball.alive = false;
      continue;
    }
    if (ball.traveled >= ball.range) {
      ball.alive = false;
      burst(state, ball.x, ball.y, 0, 12, "puff");
      continue;
    }
    if (inFort(ball.x, ball.y, state.forts)) {
      ball.alive = false;
      burst(state, ball.x, ball.y, 0, 10, "puff");
      continue;
    }
    for (const kid of state.kids) {
      if (isOut(kid) || kid.team === ball.team) continue;
      if (kid.id === ball.fromId && ball.grace > 0) continue;
      if (inFort(kid.x, kid.y, state.forts)) continue;
      const dx = kid.x - ball.x;
      const dy = kid.y - 6 - ball.y;
      if (dx * dx + dy * dy > (KID_RADIUS + ball.r) ** 2) continue;
      ball.alive = false;
      hitKid(state, kid, ball, onHit);
      break;
    }
  }
  state.balls = state.balls.filter((b) => b.alive);
}

function hitKid(
  state: GameState,
  kid: Kid,
  ball: Snowball,
  onHit: (heavy: boolean) => void,
) {
  kid.hp -= 1;
  kid.flash = 0.12;
  kid.stun = 0.35;
  kid.state = kid.hp <= 0 ? "buried" : "hurt";
  kid.stateT = kid.hp <= 0 ? 0 : 0.42;
  kid.x += Math.sign(ball.vx) * 10;
  kid.y += ball.vy * 0.02;
  burst(state, kid.x, kid.y, ball.vx * 0.05, 14, "puff");
  state.trauma = Math.min(1, state.trauma + (kid.hp <= 0 ? 0.55 : 0.32));
  state.freeze = kid.hp <= 0 ? 0.07 : 0.045;
  onHit(kid.hp <= 0);
}

function stepKids(state: GameState, dt: number) {
  for (const kid of state.kids) {
    kid.animT += dt;
    kid.flash = Math.max(0, kid.flash - dt);
    kid.stun = Math.max(0, kid.stun - dt);
    kid.cooldown = Math.max(0, kid.cooldown - dt);
    if (kid.state === "buried") continue;
    if (kid.state === "throw" || kid.state === "hurt") {
      kid.stateT -= dt;
      if (kid.stateT <= 0) kid.state = "idle";
    }
    if (kid.state === "grabbed") continue;
    if (Math.hypot(0, 0) === 0 && Math.random() < dt * 2.2) {
      state.footprints.push({ x: kid.x, y: kid.y + 16, life: 1.6 });
    }
  }
}

function stepFx(state: GameState, dt: number) {
  state.trauma = Math.max(0, state.trauma - dt * 1.8);
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 40 * dt;
    p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
  for (const f of state.footprints) f.life -= dt;
  state.footprints = state.footprints.filter((f) => f.life > 0);
  for (const flake of state.flakes) {
    flake.x += flake.vx * dt + Math.sin(state.time * 2 + flake.y) * 8 * dt;
    flake.y += flake.vy * dt;
    if (flake.y > WORLD_H) {
      flake.y = -4;
      flake.x = Math.random() * WORLD_W;
    }
  }
}

export function stepSim(state: GameState, dt: number, onHit: (heavy: boolean) => void) {
  state.time += dt;
  if (state.freeze > 0) {
    state.freeze -= dt;
    stepFx(state, dt * 0.2);
    return;
  }
  if (state.phase === "intro") {
    state.introT -= dt;
    if (state.introT <= 0) state.phase = "fight";
    stepFx(state, dt);
    return;
  }
  if (state.phase !== "fight") {
    stepFx(state, dt);
    return;
  }

  stepKids(state, dt);
  stepBalls(state, dt, onHit);
  separate(state, dt);
  stepFx(state, dt);

  const reds = living(state.kids, "red").length;
  const greens = living(state.kids, "green").length;
  if (reds === 0) state.phase = "lost";
  else if (greens === 0) state.phase = "won";
}

export function aimFromKid(kid: Kid, kids: Kid[], extraX = 0, extraY = 0) {
  void extraX;
  void extraY;
  const target = closestEnemy(kid, kids);
  if (!target) {
    return { dx: kid.team === "red" ? -1 : 1, dy: 0 };
  }
  let dx = target.x - kid.x;
  let dy = target.y - kid.y;
  if (kid.team === "red") dx = Math.min(dx, -28);
  else dx = Math.max(dx, 28);
  return { dx, dy };
}
