import {
  BALL_RADIUS,
  BIG_BALL_RADIUS,
  BIG_HELD_TIME,
  BIG_SHOTS,
  BIG_SPEED,
  COMEBACK_WAIT,
  enemyCountForLevel,
  HP,
  INTRO_TIME,
  KIT_CHANCE,
  KIT_LIFE,
  KIT_MIN_LEVEL,
  KID_RADIUS,
  MARGIN,
  MAX_RANGE,
  MAX_THROW_SPEED,
  PACK_TIME,
  PICKUP_CD_MAX,
  PICKUP_CD_MIN,
  PICKUP_LIFE,
  pickupRadius,
  STAR_PACK_TIME,
  PLAYER_COUNT,
  PVP_RANGE,
  PVP_SPEED,
  playFeel,
  counterSweet,
  SWEET_WINDOW,
  SWEET_WINDOW_PVP,
  THROW_COOLDOWN,
  WORLD_H,
  WORLD_W,
} from "./constants";
import type { Fort, GameState, Kid, Pickup, Snowball, Team, TeamBuff } from "./types";

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
    campX: x,
    campY: y,
    campT: 0,
  };
}

export function ensureAi(kid: Kid) {
  if (!kid.ai) kid.ai = makeBrain(kid.x, kid.y);
  else {
    kid.ai.coverT ??= 0;
    kid.ai.awayT ??= 0;
    kid.ai.campX ??= kid.x;
    kid.ai.campY ??= kid.y;
    kid.ai.campT ??= 0;
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
    hideFuel: 1,
    hideSession: false,
    lastThrowAt: -99,
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
    pickup: null,
    kit: null,
    pickupCd: 2.5,
    lootPop: null,
    buffs: { red: null, green: null },
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

/** True if the segment crosses a fort other than `ignore` (the shooter's own pile). */
export function lineHitsFort(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  forts: Fort[],
  ignore: Fort | null = null,
  ignore2: Fort | null = null,
) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  if (dist < 8) return false;
  const steps = Math.max(6, Math.ceil(dist / 18));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const wall = inFort(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, forts);
    if (wall && wall !== ignore && wall !== ignore2) return true;
  }
  return false;
}

export function foeHittable(from: Kid, foe: Kid, forts: Fort[]): boolean {
  if (foe.team === from.team || isOut(foe)) return false;
  const cover = inFort(foe.x, foe.y, forts);
  if (cover && foe.state !== "grabbed") return false;
  const home = inFort(from.x, from.y, forts);
  return !lineHitsFort(from.x, from.y, foe.x, foe.y, forts, home, foe.state === "grabbed" ? cover : null);
}

export function closestHittableEnemy(kid: Kid, kids: Kid[], forts: Fort[]): Kid | null {
  const other: Team = kid.team === "red" ? "green" : "red";
  let best: Kid | null = null;
  let bestD = Infinity;
  for (const k of kids) {
    if (k.team !== other || !foeHittable(kid, k, forts)) continue;
    const d = (k.x - kid.x) ** 2 + (k.y - kid.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}

export function living(kids: Kid[], team?: Team) {
  return kids.filter((k) => !isOut(k) && (team ? k.team === team : true));
}

export function isOut(k: Kid) {
  return k.state === "buried" || k.hp <= 0;
}

export function hideStayTime(state: GameState, kid: Kid) {
  const mates = living(state.kids, kid.team).length;
  const foes = living(state.kids, kid.team === "red" ? "green" : "red").length;
  if (mates > 1 && foes <= 1) return 0;
  if (mates <= 1) return 1;
  return 3;
}

export function hideRechargeTime(_state: GameState, _kid: Kid) {
  return 3;
}

export function canEnterFort(kid: Kid) {
  return (kid.hideFuel ?? 1) >= 0.999;
}

function grabbedFoeInFort(state: GameState, ballTeam: Team, wall: Fort) {
  return state.kids.some(
    (k) =>
      k.state === "grabbed" &&
      !isOut(k) &&
      k.team !== ballTeam &&
      inFort(k.x, k.y, state.forts) === wall,
  );
}

function ejectFromFort(kid: Kid, forts: Fort[]) {
  const fort = inFort(kid.x, kid.y, forts);
  if (!fort) return;
  const dx = kid.x - fort.x;
  const dy = kid.y - fort.y;
  const len = Math.hypot(dx, dy) || 1;
  kid.x = fort.x + (dx / len) * (fort.rx + 30);
  kid.y = clamp(fort.y + (dy / len) * (fort.ry + 26), MARGIN, WORLD_H - MARGIN);
  kid.hideSession = false;
}

export function tickHideFuel(state: GameState, dt: number) {
  for (const kid of state.kids) {
    if (isOut(kid)) {
      kid.hideFuel = 1;
      kid.hideSession = false;
      continue;
    }
    kid.hideFuel ??= 1;
    const stay = hideStayTime(state, kid);
    const rec = hideRechargeTime(state, kid);
    const cover = !!inFort(kid.x, kid.y, state.forts);
    if (stay <= 0) {
      kid.hideFuel = 1;
      kid.hideSession = false;
      if (cover) ejectFromFort(kid, state.forts);
    } else if (cover) {
      if (!kid.hideSession) {
        if (!canEnterFort(kid)) {
          ejectFromFort(kid, state.forts);
        } else {
          kid.hideSession = true;
        }
      }
      if (kid.hideSession) {
        kid.hideFuel = Math.max(0, kid.hideFuel - dt / stay);
        if (kid.hideFuel <= 0) {
          kid.hideFuel = 0;
          ejectFromFort(kid, state.forts);
        }
      }
    } else {
      kid.hideSession = false;
      kid.hideFuel = Math.min(1, kid.hideFuel + dt / rec);
      if (kid.hideFuel >= 0.995) kid.hideFuel = 1;
    }
    if (kid.ai) {
      kid.ai.awayT = canEnterFort(kid) ? 0 : (1 - kid.hideFuel) * rec;
      kid.ai.coverT = cover && kid.hideSession ? (1 - kid.hideFuel) * stay : 0;
    }
  }
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

export function incomingAt(state: GameState, kid: Kid) {
  const other: Team = kid.team === "red" ? "green" : "red";
  const win = state.pvp ? SWEET_WINDOW_PVP : SWEET_WINDOW;
  for (const b of state.balls) {
    if (!b.alive || b.ghost || b.team !== other || b.big) continue;
    const dx = kid.x - b.x;
    const dy = kid.y - b.y;
    const sp2 = b.vx * b.vx + b.vy * b.vy;
    if (sp2 < 1) continue;
    const t = (dx * b.vx + dy * b.vy) / sp2;
    if (t < 0 || t > win) continue;
    const cx = dx - b.vx * t;
    const cy = dy - b.vy * t;
    const hit = KID_RADIUS + b.r + 18;
    if (cx * cx + cy * cy <= hit * hit) return true;
  }
  return false;
}

export function sweetReady(state: GameState, kid: Kid) {
  if (incomingAt(state, kid)) return true;
  const foe = closestHittableEnemy(kid, state.kids, state.forts);
  if (!foe) return false;
  const at = foe.lastThrowAt ?? foe.ai?.lastThrowAt ?? -99;
  return counterSweet(state.time - at, state.pvp);
}

export function throwSnowball(
  state: GameState,
  kid: Kid,
  _charge: number,
  dirX: number,
  dirY: number,
  local = false,
  user = false,
  consume = true,
) {
  if (kid.packT > 0 || kid.state === "pack") return 0;
  if (inFort(kid.x, kid.y, state.forts)) return 0;
  const star = state.godSpeed && kid.team === "red";
  const wantBig = user && !!state.buffs[kid.team] && state.buffs[kid.team]!.shots > 0 && state.buffs[kid.team]!.t > 0;
  let len = Math.hypot(dirX, dirY);
  if (len < 0.001) {
    dirX = kid.team === "red" ? -1 : 1;
    dirY = 0;
    len = 1;
  }
  const nx = dirX / len;
  const ny = dirY / len;
  const big = user && takeBigBuff(state, kid.team, consume);
  const sweet = user && !big && sweetReady(state, kid);
  let speed = state.pvp ? PVP_SPEED : MAX_THROW_SPEED * (state.hard ? 2 : 1);
  if (star) speed *= 3;
  const range = state.pvp ? PVP_RANGE : MAX_RANGE;
  const cover = inFort(kid.x, kid.y, state.forts);
  const ball: Snowball = {
    x: kid.x + nx * 30,
    y: kid.y + ny * 10 - 6,
    vx: nx * speed * (big ? BIG_SPEED : 1),
    vy: ny * speed * (big ? BIG_SPEED : 1),
    team: kid.team,
    r: big ? BIG_BALL_RADIUS : BALL_RADIUS,
    fromId: kid.id,
    grace: cover ? 0.24 : 0.12,
    spin: Math.random() * Math.PI * 2,
    alive: true,
    range,
    traveled: 0,
    local,
    born: typeof performance !== "undefined" ? performance.now() : 0,
    big,
    sweet,
  };
  state.balls.push(ball);
  if (sweet) burst(state, kid.x, kid.y, 0, 10, "spark");
  kid.state = "throw";
  kid.stateT = 0.38;
  kid.cooldown = THROW_COOLDOWN;
  kid.packT = state.godSpeed && kid.team === "red" ? STAR_PACK_TIME : PACK_TIME;
  kid.facing = faceFromDir(nx, ny, kid.facing);
  kid.lastThrowAt = state.time;
  if (kid.ai) kid.ai.lastThrowAt = state.time;
  clearFidget(kid);
  burst(state, kid.x + nx * 22, kid.y, nx * 40, big ? 16 : 8, "puff");
  if (big) burst(state, kid.x + nx * 22, kid.y, nx * 20, 10, "spark");
  return 1;
}

export function burst(
  state: GameState,
  x: number,
  y: number,
  push: number,
  n: number,
  kind: "puff" | "spark" | "gold" = "puff",
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

function shrinkBigBall(ball: Snowball) {
  if (!ball.big) return;
  ball.big = false;
  ball.r = BALL_RADIUS;
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
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const aSweet = !!a.sweet && !a.big;
      const bSweet = !!b.sweet && !b.big;
      if (aSweet && bSweet) continue;
      burst(state, mx, my, 0, 18, "spark");
      burst(state, mx, my, 0, 10, "puff");
      state.trauma = Math.min(1, state.trauma + 0.18);
      onClash?.();
      if (a.big || b.big) {
        if (a.big && b.big) {
          a.alive = false;
          b.alive = false;
        } else if (a.big) {
          shrinkBigBall(a);
          b.alive = false;
        } else {
          shrinkBigBall(b);
          a.alive = false;
        }
        continue;
      }
      if (aSweet) {
        b.alive = false;
        continue;
      }
      if (bSweet) {
        a.alive = false;
        continue;
      }
      a.alive = false;
      b.alive = false;
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
      if (wall && !grabbedFoeInFort(state, ball.team, wall)) {
        ball.alive = false;
        wall.hitFlash = 0.28;
        if (wall.maxHp > 0 && wall.hp > 0) {
          wall.hp -= ball.big ? 2 : 1;
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
      if (inFort(kid.x, kid.y, state.forts) && kid.state !== "grabbed") continue;
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
  kid.hp -= ball.big ? 2 : 1;
  kid.flash = 0.12;
  kid.stun = ball.big ? 0.5 : 0.35;
  if (kid.hp <= 0) {
    kid.state = "buried";
    kid.stateT = 0;
  } else if (kid.state !== "grabbed") {
    kid.state = "hurt";
    kid.stateT = 0.42;
  }
  kid.packT = 0;
  clearFidget(kid);
  kid.x += Math.sign(ball.vx) * 10;
  kid.y += ball.vy * 0.02;
  burst(state, kid.x, kid.y, ball.vx * 0.05, ball.big ? 22 : 14, "puff");
  if (ball.big) burst(state, kid.x, kid.y, 0, 12, "spark");
  state.trauma = Math.min(1, state.trauma + (kid.hp <= 0 ? 0.55 : 0.32));
  state.freeze = kid.hp <= 0 ? 0.07 : 0.045;
  onHit(kid.hp <= 0);
  if (kid.hp <= 0) {
    if (kid.team === "red") maybeArmComeback(state);
    maybeDropKit(state, kid.x, kid.y, ball.team);
    maybeComebackKit(state);
  }
}

export function playerComeback(state: GameState) {
  if (state.pvp) return false;
  return living(state.kids, "red").length === 1;
}

export function teamNeedsHeal(state: GameState, team: Team) {
  return living(state.kids, team).some((k) => k.hp < (k.maxHp || HP));
}

function healLowest(state: GameState, team: Team) {
  const hurt = living(state.kids, team).filter((k) => k.hp < (k.maxHp || HP)).sort((a, b) => a.hp - b.hp || a.id - b.id);
  const dog = hurt[0];
  if (!dog) return false;
  dog.hp = Math.min(dog.maxHp || HP, dog.hp + 1);
  burst(state, dog.x, dog.y, 0, 12, "spark");
  return true;
}

export function maybeArmComeback(state: GameState) {
  if (!playerComeback(state) || state.pickup) return;
  state.pickupCd = Math.max(state.pickupCd, COMEBACK_WAIT + Math.random() * 1.5);
}

export function maybeComebackKit(state: GameState) {
  if (state.pvp || state.kit || !playerComeback(state) || !teamNeedsHeal(state, "red")) return;
  const last = living(state.kids, "red")[0];
  if (!last) return;
  placeKit(state, last.x + rand(-50, 20), last.y + rand(-36, 36));
}

export function maybeDropKit(state: GameState, x: number, y: number, killer: Team, chance = KIT_CHANCE) {
  if (state.kit) return null;
  if (!state.pvp && (killer !== "red" || state.level < KIT_MIN_LEVEL)) return null;
  if (!teamNeedsHeal(state, killer)) return null;
  if (Math.random() > chance) return null;
  const ox = x + rand(-56, 56);
  const oy = y + rand(-40, 40);
  return placeKit(state, ox, oy);
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
  if (ball.grace <= 0) {
    const wall = inFort(ball.x, ball.y, state.forts);
    if (wall && !grabbedFoeInFort(state, ball.team, wall)) {
      ball.alive = false;
      wall.hitFlash = 0.28;
      burst(state, ball.x, ball.y, 0, 16, "puff");
      return;
    }
  }
  for (const kid of state.kids) {
    if (isOut(kid) || kid.team === ball.team) continue;
    if (kid.id === ball.fromId && ball.grace > 0) continue;
    const p = kidPos(kid.id) ?? kid;
    if (inFort(p.x, p.y, state.forts) && kid.state !== "grabbed") continue;
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
  if (state.lootPop) {
    state.lootPop.t -= dt;
    if (state.lootPop.t <= 0) state.lootPop = null;
  }
  for (const f of state.forts) f.hitFlash = Math.max(0, f.hitFlash - dt);
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.kind === "note" ? 12 : p.kind === "gold" ? -18 : 40) * dt;
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


export function grantBigBuff(state: GameState, team: Team): TeamBuff {
  const buff: TeamBuff = { kind: "big", shots: BIG_SHOTS, t: BIG_HELD_TIME };
  state.buffs[team] = buff;
  return buff;
}

export function canTeamClaimPickup(state: GameState, team: Team) {
  return state.pvp || team === "red";
}

export function burstLoot(state: GameState, x: number, y: number) {
  burst(state, x, y, 0, 18, "puff");
  burst(state, x, y, 0, 16, "spark");
  burst(state, x, y, 0, 20, "gold");
  state.lootPop = { x, y, t: 0.55 };
  state.trauma = Math.min(1, state.trauma + 0.18);
}

export function claimPickup(state: GameState, team: Team): boolean {
  if (!state.pickup || (state.phase !== "fight" && state.phase !== "intro")) return false;
  if (!canTeamClaimPickup(state, team)) return false;
  grantBigBuff(state, team);
  burstLoot(state, state.pickup.x, state.pickup.y);
  state.pickup = null;
  state.pickupCd = PICKUP_CD_MIN + Math.random() * (PICKUP_CD_MAX - PICKUP_CD_MIN);
  return true;
}

export function claimKit(state: GameState, team: Team): boolean {
  if (!state.kit || (state.phase !== "fight" && state.phase !== "intro")) return false;
  if (!canTeamClaimPickup(state, team)) return false;
  healLowest(state, team);
  burst(state, state.kit.x, state.kit.y, 0, 14, "puff");
  burst(state, state.kit.x, state.kit.y, 0, 10, "spark");
  state.lootPop = { x: state.kit.x, y: state.kit.y, t: 0.45 };
  state.kit = null;
  return true;
}

export function placeKit(state: GameState, x: number, y: number): Pickup {
  const kit: Pickup = {
    x: clamp(x, MARGIN + 20, WORLD_W - MARGIN - 20),
    y: clamp(y, MARGIN + 20, WORLD_H - MARGIN - 20),
    kind: "heal",
    life: KIT_LIFE,
    maxLife: KIT_LIFE,
  };
  if (inFort(kit.x, kit.y, state.forts)) {
    kit.x = clamp(kit.x + 50, MARGIN + 20, WORLD_W - MARGIN - 20);
  }
  state.kit = kit;
  burst(state, kit.x, kit.y, 0, 10, "puff");
  return kit;
}

export function takeBigBuff(state: GameState, team: Team, consume: boolean) {
  const buff = state.buffs[team];
  if (!buff || buff.shots <= 0 || buff.t <= 0) return false;
  if (consume) {
    buff.shots -= 1;
    if (buff.shots <= 0) state.buffs[team] = null;
  }
  return true;
}

export function placePickup(state: GameState, x = 480, y = 270): Pickup {
  const orb: Pickup = { x, y, kind: "big", life: PICKUP_LIFE, maxLife: PICKUP_LIFE };
  state.pickup = orb;
  state.pickupCd = PICKUP_CD_MIN;
  burst(state, x, y, 0, 18, "spark");
  return orb;
}

function spawnPickup(state: GameState): Pickup {
  const comeback = playerComeback(state);
  for (let i = 0; i < 8; i++) {
    const x = comeback ? 620 + rand(-40, 80) : 480 + rand(-80, 80);
    const y = 270 + rand(-100, 100);
    if (inFort(x, y, state.forts)) continue;
    return placePickup(state, x, y);
  }
  return placePickup(state, comeback ? 640 : 480, 270);
}

/** spawn=true on host/solo. Guest only ticks buff timers and the visible orb. */
export function stepPickups(state: GameState, dt: number, spawn: boolean) {
  for (const team of ["red", "green"] as const) {
    const buff = state.buffs[team];
    if (!buff) continue;
    buff.t -= dt;
    if (buff.t <= 0 || buff.shots <= 0) state.buffs[team] = null;
  }
  if (state.pickup) {
    state.pickup.life -= dt;
    if (state.pickup.life <= 0) {
      state.pickup = null;
      if (spawn) state.pickupCd = PICKUP_CD_MIN + Math.random() * (PICKUP_CD_MAX - PICKUP_CD_MIN);
    } else if (spawn) {
      for (const kid of state.kids) {
        if (isOut(kid)) continue;
        if (!canTeamClaimPickup(state, kid.team)) continue;
        if (Math.hypot(kid.x - state.pickup.x, kid.y - state.pickup.y) > pickupRadius()) continue;
        claimPickup(state, kid.team);
        break;
      }
    }
  }
  if (state.kit) {
    state.kit.life -= dt;
    if (state.kit.life <= 0) state.kit = null;
    else if (spawn) {
      for (const kid of state.kids) {
        if (isOut(kid)) continue;
        if (!canTeamClaimPickup(state, kid.team)) continue;
        if (Math.hypot(kid.x - state.kit.x, kid.y - state.kit.y) > pickupRadius()) continue;
        claimKit(state, kid.team);
        break;
      }
    }
  }
  if (state.pickup || !spawn || state.phase !== "fight") return;
  state.pickupCd -= dt;
  if (state.pickupCd <= 0) spawnPickup(state);
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
  tickHideFuel(state, dt);
  stepPickups(state, dt, true);
  stepBalls(state, dt, onHit, extra);
  separate(state, dt);
  faceNearest(state);
  stepFx(state, dt);

  const reds = living(state.kids, "red").length;
  const greens = living(state.kids, "green").length;
  if (reds === 0) state.phase = "lost";
  else if (greens === 0) state.phase = "won";
}

export function faceFromDir(dx: number, dy: number, fallback: 1 | -1): 1 | -1 {
  if (Math.abs(dx) < Math.max(0.12, Math.abs(dy) * 0.35)) return fallback;
  return dx < 0 ? -1 : 1;
}

/** Face the nearest living foe. Straight up/down keeps the last facing. */
export function faceNearest(state: GameState, team?: Team) {
  for (const kid of state.kids) {
    if (team && kid.team !== team) continue;
    if (isOut(kid) || kid.state === "hurt") continue;
    const { dx, dy } = aimFromKid(kid, state.kids);
    kid.facing = faceFromDir(dx, dy, kid.facing);
  }
}

export function aimFromKid(
  kid: Kid,
  kids: Kid[],
  _extraX = 0,
  _extraY = 0,
  scatter = false,
  _allowBack = false,
  forts?: Fort[],
): { dx: number; dy: number; ok: boolean } {
  const useCover = !!(forts && forts.length);
  if (useCover && inFort(kid.x, kid.y, forts!)) return { dx: 0, dy: 0, ok: false };
  const foes = kids.filter((k) => k.team !== kid.team && !isOut(k));
  let target: Kid | null = null;
  if (scatter && foes.length) {
    const pool = useCover ? foes.filter((k) => foeHittable(kid, k, forts!)) : foes;
    if (pool.length) target = pool[(Math.random() * pool.length) | 0]!;
  } else if (useCover) {
    target = closestHittableEnemy(kid, kids, forts!);
  } else {
    target = closestEnemy(kid, kids);
  }
  if (!target) {
    if (useCover) return { dx: 0, dy: 0, ok: false };
    return { dx: kid.team === "red" ? -1 : 1, dy: 0, ok: false };
  }
  return { dx: target.x - kid.x, dy: target.y - kid.y, ok: true };
}
