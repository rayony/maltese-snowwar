import {
  BALL_RADIUS,
  enemyCountForLevel,
  holdPower,
  HP,
  INTRO_TIME,
  MARGIN,
  PACK_TIME,
  STAR_PACK_TIME,
  PLAYER_COUNT,
  PVP_RANGE,
  PVP_SPEED,
  playFeel,
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

function makeBrain(x: number, y: number) {
  return {
    phase: "idle" as const,
    t: rand(0.2, 0.9),
    destX: x,
    destY: y,
    charge: 0,
    coverT: 0,
    awayT: 0,
  };
}

export function ensureAi(kid: Kid) {
  if (!kid.ai) kid.ai = makeBrain(kid.x, kid.y);
  else {
    kid.ai.coverT ??= 0;
    kid.ai.awayT ??= 0;
  }
  return kid;
}

function makeKid(state: GameState, team: Team, x: number, y: number): Kid {
  return {
    id: nextId(state),
    team,
    x,
    y,
    lastX: x,
    lastY: y,
    hp: HP,
    maxHp: HP,
    state: "idle",
    stateT: 0,
    cooldown: rand(0, 0.4),
    packT: 0,
    animT: Math.random(),
    flash: 0,
    stun: 0,
    facing: team === "red" ? -1 : 1,
    fidget: null,
    fidgetT: 0,
    fidgetWait: rand(0.35, 2.6),
    moving: false,
    ai: makeBrain(x, y),
  };
}

export function makeForts(hp = 0): Fort[] {
  return [
    { x: 390, y: 168, rx: 92, ry: 40, hitFlash: 0, hp, maxHp: hp },
    { x: 545, y: 372, rx: 108, ry: 46, hitFlash: 0, hp, maxHp: hp },
  ];
}

export function createState(
  level: number,
  versus = false,
  opts: { fortHp?: number; buriedRed?: boolean[]; hard?: boolean } = {},
): GameState {
  const state: GameState = {
    kids: [],
    balls: [],
    forts: makeForts(opts.fortHp ?? 0),
    particles: [],
    footprints: [],
    flakes: [],
    level,
    freeze: 0,
    introT: INTRO_TIME,
    phase: "intro",
    nextId: 1,
    time: 0,
    trauma: 0,
    hard: !!opts.hard,
    pvp: versus,
    godSpeed: false,
  };

  const redYs = [128, 270, 412];
  for (let i = 0; i < PLAYER_COUNT; i++) {
    const kid = makeKid(state, "red", 790 + (i % 2) * 36, redYs[i]!);
    if (opts.buriedRed?.[i]) {
      kid.hp = 0;
      kid.state = "buried";
      kid.stateT = 0;
      kid.fidget = null;
    }
    state.kids.push(kid);
  }

  const n = versus ? PLAYER_COUNT : enemyCountForLevel(level);
  const greenYs = [128, 270, 412];
  if (versus) {
    for (let i = 0; i < PLAYER_COUNT; i++) {
      state.kids.push(makeKid(state, "green", 170 - (i % 2) * 36, greenYs[i]!));
    }
  } else {
    const cols = n <= 5 ? 2 : n <= 9 ? 3 : 4;
    const rows = Math.ceil(n / cols);
    for (let i = 0; i < n; i++) {
      const col = Math.floor(i / rows);
      const row = i % rows;
      const x = 70 + col * 78;
      const y = 90 + ((row + 0.5) * (WORLD_H - 140)) / rows + rand(-10, 10);
      state.kids.push(makeKid(state, "green", x, y));
    }
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
    if (f.maxHp > 0 && f.hp <= 0) continue;
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
  local = false,
) {
  if (kid.packT > 0 || kid.state === "pack") return 0;
  const power = state.pvp ? 1 : holdPower(charge, state.godSpeed && kid.team === "red");
  let len = Math.hypot(dirX, dirY);
  if (len < 0.001) {
    dirX = kid.team === "red" ? -1 : 1;
    dirY = 0;
    len = 1;
  }
  const nx = dirX / len;
  const ny = dirY / len;
  let speed = state.pvp ? PVP_SPEED : throwSpeed(power) * (state.hard ? 2 : 1);
  if (state.godSpeed && kid.team === "red") speed *= 3;
  const range = state.pvp ? PVP_RANGE : throwRange(power);
  const cover = inFort(kid.x, kid.y, state.forts);
  const ball: Snowball = {
    x: kid.x + nx * 30,
    y: kid.y + ny * 10 - 6,
    vx: nx * speed,
    vy: ny * speed,
    team: kid.team,
    r: BALL_RADIUS,
    fromId: kid.id,
    grace: cover ? 0.24 : 0.12,
    spin: Math.random() * Math.PI * 2,
    alive: true,
    range,
    traveled: 0,
    local,
    born: typeof performance !== "undefined" ? performance.now() : 0,
  };
  state.balls.push(ball);
  kid.state = "throw";
  kid.stateT = 0.38;
  kid.cooldown = THROW_COOLDOWN;
  kid.packT = state.godSpeed && kid.team === "red" ? STAR_PACK_TIME : PACK_TIME;
  kid.facing = nx < 0 ? -1 : 1;
  clearFidget(kid);
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

type BallHint = { alive: boolean; team: Team; fromId: number; x: number; y: number; traveled: number };

export function snapCombatFx(
  state: GameState,
  wire: { balls: BallHint[]; kids: { id: number; hp: number; state: string; x: number; y: number }[] },
  myTeam: Team,
) {
  const other = myTeam === "red" ? "green" : "red";
  let hits = 0;
  const lands = puffMissingBalls(state, wire, other);
  for (const w of wire.balls) {
    if (!w.alive || w.team === myTeam || w.traveled > 55) continue;
    const known = state.balls.some(
      (b) => b.alive && b.fromId === w.fromId && Math.hypot(b.x - w.x, b.y - w.y) < 80,
    );
    if (!known) burst(state, w.x, w.y, 0, 8, "puff");
  }
  for (const w of wire.kids) {
    const prev = state.kids.find((k) => k.id === w.id);
    if (!prev) continue;
    if (w.hp < prev.hp || (w.state === "hurt" && prev.state !== "hurt") || (w.state === "buried" && prev.state !== "buried")) {
      burst(state, w.x, w.y, 0, w.state === "buried" ? 16 : 12, "puff");
      hits += 1;
      state.trauma = Math.max(state.trauma, w.state === "buried" ? 0.55 : 0.32);
    }
  }
  return { hits, lands };
}

export function puffMissingBalls(
  state: GameState,
  incoming: { balls: BallHint[] },
  team: Team,
) {
  let n = 0;
  for (const b of state.balls) {
    if (!b.alive || b.team !== team || b.traveled < 28) continue;
    const still = incoming.balls.some(
      (w) => w.alive && w.team === team && w.fromId === b.fromId && Math.hypot(w.x - b.x, w.y - b.y) < 90,
    );
    if (!still) {
      burst(state, b.x, b.y, 0, 12, "spark");
      n += 1;
    }
  }
  return n;
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
      const min = playFeel().hit * 1.85;
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

function clashBalls(state: GameState, onClash?: () => void) {
  const balls = state.balls;
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i]!;
    if (!a.alive || a.ghost) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j]!;
      if (!b.alive || b.ghost || a.team === b.team) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const rr = a.r + b.r + 8;
      if (dx * dx + dy * dy > rr * rr) continue;
      a.alive = false;
      b.alive = false;
      burst(state, (a.x + b.x) / 2, (a.y + b.y) / 2, 0, 18, "spark");
      burst(state, (a.x + b.x) / 2, (a.y + b.y) / 2, 0, 10, "puff");
      state.trauma = Math.min(1, state.trauma + 0.18);
      onClash?.();
    }
  }
}

function stepBalls(
  state: GameState,
  dt: number,
  onHit: (heavy: boolean) => void,
  extra?: { onClash?: () => void; onFort?: () => void },
) {
  clashBalls(state, extra?.onClash);
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
    if (ball.ghost) continue;
    if (ball.grace <= 0) {
      const wall = inFort(ball.x, ball.y, state.forts);
      if (wall) {
        ball.alive = false;
        wall.hitFlash = 0.28;
        if (wall.maxHp > 0 && wall.hp > 0) {
          wall.hp -= 1;
          if (wall.hp <= 0) {
            wall.hp = 0;
            burst(state, wall.x, wall.y, 0, 22, "puff");
          }
        }
        burst(state, ball.x, ball.y, 0, 16, "puff");
        extra?.onFort?.();
        continue;
      }
    }
    for (const kid of state.kids) {
      if (isOut(kid) || kid.team === ball.team) continue;
      if (kid.id === ball.fromId && ball.grace > 0) continue;
      if (inFort(kid.x, kid.y, state.forts)) continue;
      const dx = kid.x - ball.x;
      const dy = kid.y - 10 - ball.y;
      const hitR = playFeel().hit + ball.r;
      if (dx * dx + dy * dy > hitR * hitR) continue;
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
  kid.packT = 0;
  clearFidget(kid);
  kid.x += Math.sign(ball.vx) * 10;
  kid.y += ball.vy * 0.02;
  burst(state, kid.x, kid.y, ball.vx * 0.05, 14, "puff");
  state.trauma = Math.min(1, state.trauma + (kid.hp <= 0 ? 0.55 : 0.32));
  state.freeze = kid.hp <= 0 ? 0.07 : 0.045;
  onHit(kid.hp <= 0);
}

/** Fly one ball for catch-up, hitting kids at historical (or current) positions. */
export function stepOneBall(
  state: GameState,
  ball: Snowball,
  dt: number,
  kidPos: (id: number) => { x: number; y: number } | null,
  onHit: (heavy: boolean) => void,
) {
  if (!ball.alive) return;
  const stepX = ball.vx * dt;
  const stepY = ball.vy * dt;
  ball.x += stepX;
  ball.y += stepY;
  ball.traveled += Math.hypot(stepX, stepY);
  ball.spin += dt * 10;
  ball.grace = Math.max(0, ball.grace - dt);
  if (ball.x < -20 || ball.x > WORLD_W + 20 || ball.y < -20 || ball.y > WORLD_H + 20) {
    ball.alive = false;
    return;
  }
  if (ball.traveled >= ball.range) {
    ball.alive = false;
    burst(state, ball.x, ball.y, 0, 12, "puff");
    return;
  }
  if (ball.ghost) return;
  if (ball.grace <= 0 && inFort(ball.x, ball.y, state.forts)) {
    const wall = inFort(ball.x, ball.y, state.forts);
    ball.alive = false;
    if (wall) {
      wall.hitFlash = 0.28;
      burst(state, ball.x, ball.y, 0, 16, "puff");
    }
    return;
  }
  for (const kid of state.kids) {
    if (isOut(kid) || kid.team === ball.team) continue;
    if (kid.id === ball.fromId && ball.grace > 0) continue;
    const p = kidPos(kid.id) ?? kid;
    if (inFort(p.x, p.y, state.forts)) continue;
    const dx = p.x - ball.x;
    const dy = p.y - 10 - ball.y;
    const hitR = playFeel().hit + ball.r;
    if (dx * dx + dy * dy > hitR * hitR) continue;
    ball.alive = false;
    const saved = { x: kid.x, y: kid.y };
    kid.x = p.x;
    kid.y = p.y;
    hitKid(state, kid, ball, onHit);
    kid.x = saved.x;
    kid.y = saved.y;
    break;
  }
}

function clearFidget(kid: Kid) {
  kid.fidget = null;
  kid.fidgetT = 0;
  kid.fidgetWait = rand(0.9, 2.4);
}

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function stepFidget(state: GameState, kid: Kid, dt: number) {
  if (kid.state === "throw" || kid.state === "hurt" || kid.state === "buried" || kid.state === "pack" || kid.moving) {
    if (kid.fidget) clearFidget(kid);
    return;
  }
  if (kid.fidgetT > 0) {
    kid.fidgetT -= dt;
    if (kid.fidget === "dance" && Math.random() < dt * 2.6) {
      state.particles.push({
        x: kid.x + rand(-16, 16),
        y: kid.y - 38,
        vx: rand(-22, 22),
        vy: rand(-46, -20),
        life: rand(0.55, 0.85),
        maxLife: 0.85,
        size: rand(5.5, 8.5),
        kind: "note",
      });
    }
    if (kid.fidgetT <= 0) {
      kid.fidget = null;
      kid.fidgetWait = rand(1.6, 4.2);
    }
    return;
  }
  if (reducedMotion()) return;
  kid.fidgetWait -= dt;
  if (kid.fidgetWait > 0) return;
  if (Math.random() < 0.64) {
    kid.fidget = Math.random() < 0.58 ? "dance" : "wave";
    kid.fidgetT = rand(2.7, 4.1);
  } else {
    kid.fidgetWait = rand(1.1, 2.6);
  }
}

export function stepPresentation(state: GameState, dt: number) {
  if (state.freeze > 0) state.freeze = Math.max(0, state.freeze - dt);
  for (const kid of state.kids) {
    kid.animT += dt;
    kid.flash = Math.max(0, kid.flash - dt);
    kid.stun = Math.max(0, kid.stun - dt);
    kid.cooldown = Math.max(0, kid.cooldown - dt);
    kid.packT = Math.max(0, kid.packT - dt);
    if (kid.state === "throw" || kid.state === "hurt") {
      kid.stateT -= dt;
      if (kid.stateT <= 0) {
        kid.state = kid.state === "throw" && kid.packT > 0 ? "pack" : "idle";
      }
    } else if (kid.state === "pack" && kid.packT <= 0) {
      kid.state = "idle";
    }
    if (kid.state === "idle" && kid.packT > 0) kid.state = "pack";
    if (kid.state === "pack" && Math.random() < dt * 7) {
      burst(state, kid.x + rand(-8, 8), kid.y + 10, 0, 2, "puff");
    }
    stepFidget(state, kid, dt);
  }
  state.trauma = Math.max(0, state.trauma - dt * 1.8);
  for (const flake of state.flakes) {
    flake.x += flake.vx * dt + Math.sin(state.time * 2 + flake.y) * 8 * dt;
    flake.y += flake.vy * dt;
    if (flake.y > WORLD_H) {
      flake.y = -4;
      flake.x = Math.random() * WORLD_W;
    }
  }
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
  state.time += dt;
}

function stepKids(state: GameState, dt: number) {
  for (const kid of state.kids) {
    const dist = Math.hypot(kid.x - kid.lastX, kid.y - kid.lastY);
    kid.moving = dist > 0.55 && kid.state !== "buried";
    kid.lastX = kid.x;
    kid.lastY = kid.y;
    kid.animT += dt;
    kid.flash = Math.max(0, kid.flash - dt);
    kid.stun = Math.max(0, kid.stun - dt);
    kid.cooldown = Math.max(0, kid.cooldown - dt);
    kid.packT = Math.max(0, kid.packT - dt);
    stepFidget(state, kid, dt);
    if (kid.state === "buried") continue;
    if (kid.state === "throw" || kid.state === "hurt") {
      kid.stateT -= dt;
      if (kid.stateT <= 0) {
        kid.state = kid.state === "throw" && kid.packT > 0 ? "pack" : "idle";
      }
    } else if (kid.state === "pack") {
      if (kid.packT <= 0) kid.state = "idle";
    }
    if (kid.state === "idle" && kid.packT > 0) kid.state = "pack";
    if (kid.state === "pack" && Math.random() < dt * 7) {
      burst(state, kid.x + rand(-8, 8), kid.y + 10, 0, 2, "puff");
    }
    if (kid.state === "grabbed") continue;
    if (kid.moving && Math.random() < dt * 6) {
      state.footprints.push({ x: kid.x, y: kid.y + 16, life: 1.6 });
    }
  }
}

function stepFx(state: GameState, dt: number) {
  state.trauma = Math.max(0, state.trauma - dt * 1.8);
  for (const f of state.forts) f.hitFlash = Math.max(0, f.hitFlash - dt);
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.kind === "note" ? 12 : 40) * dt;
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

export function stepSim(
  state: GameState,
  dt: number,
  onHit: (heavy: boolean) => void,
  extra?: { onClash?: () => void; onFort?: () => void },
) {
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
  stepBalls(state, dt, onHit, extra);
  separate(state, dt);
  stepFx(state, dt);

  const reds = living(state.kids, "red").length;
  const greens = living(state.kids, "green").length;
  if (reds === 0) state.phase = "lost";
  else if (greens === 0) state.phase = "won";
}

export function aimFromKid(kid: Kid, kids: Kid[], extraX = 0, extraY = 0, scatter = false, allowBack = false) {
  const foes = kids.filter((k) => k.team !== kid.team && !isOut(k));
  const target = scatter && foes.length ? foes[(Math.random() * foes.length) | 0]! : closestEnemy(kid, kids);
  const back =
    allowBack && kid.team === "red" && extraX > 10 && Math.hypot(extraX, extraY) > 12;
  if (back) return { dx: extraX, dy: extraY };
  if (!target) {
    return { dx: kid.team === "red" ? -1 : 1, dy: 0 };
  }
  let dx = target.x - kid.x;
  let dy = target.y - kid.y;
  if (!allowBack) {
    if (kid.team === "red") dx = Math.min(dx, -28);
    else dx = Math.max(dx, 28);
  }
  return { dx, dy };
}
