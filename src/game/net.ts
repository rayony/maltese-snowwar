import type { AllyMode, FightPhase, Fidget, GameState, Kid, KidState, Team } from "./types";
import { BALL_RADIUS } from "./constants";

const ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function makeRoomCode() {
  let s = "";
  for (let i = 0; i < 6; i++) s += ABC[(Math.random() * ABC.length) | 0]!;
  return s;
}

export function normalizeCode(raw: string) {
  return raw
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

export function roomIdFromCode(code: string) {
  return `SC${code}`;
}

export type NetMsg =
  | { t: "hello"; role: "host" | "guest" }
  | { t: "start" }
  | { t: "over"; winner: Team; s: WireState; round?: number }
  | { t: "snap"; s: WireState }
  | { t: "input"; kind: "down" | "move" | "up"; x: number; y: number; hold?: number; vx?: number; vy?: number; at?: number }
  | { t: "ally"; mode: AllyMode }
  | { t: "allypose"; kids: { id: number; x: number; y: number }[] }
  | { t: "allythrow"; id: number; x: number; y: number; hold: number; dx: number; dy: number }
  | { t: "pose"; kids: PoseKid[]; intro: number; phase: FightPhase; t0: number }
  | { t: "throw"; id: number; x: number; y: number; vx: number; vy: number; team: Team }
  | { t: "hit"; id: number; hp: number; heavy: boolean }
  | { t: "rematch"; yes: boolean }
  | { t: "bye" }
  | { t: "bot" }
  | { t: "packed" }
  | { t: "hb" }
  | { t: "ping"; t0: number }
  | { t: "pong"; t0: number; t1?: number };

export interface WireKid {
  id: number;
  team: Team;
  x: number;
  y: number;
  hp: number;
  maxHp?: number;
  state: KidState;
  stateT: number;
  packT: number;
  animT?: number;
  flash?: number;
  stun?: number;
  facing: 1 | -1;
  fidget?: Fidget;
  fidgetT?: number;
  fidgetWait?: number;
  moving: boolean;
  cooldown?: number;
}

export interface WireBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  team: Team;
  fromId: number;
  alive: boolean;
  range: number;
  traveled: number;
}

export interface PoseKid {
  i: number;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  f: 1 | -1;
  s: KidState;
  h: number;
  m: boolean;
}

export interface WireState {
  kids: WireKid[];
  balls: WireBall[];
  forts?: GameState["forts"];
  particles?: GameState["particles"];
  footprints?: GameState["footprints"];
  level: number;
  freeze: number;
  introT: number;
  phase: FightPhase;
  nextId: number;
  time: number;
  trauma?: number;
}

function q(n: number) {
  return Math.round(n);
}

function packKid(k: Kid): WireKid {
  return {
    id: k.id,
    team: k.team,
    x: q(k.x),
    y: q(k.y),
    hp: k.hp,
    state: k.state,
    stateT: Math.round(k.stateT * 40) / 40,
    packT: Math.round(k.packT * 40) / 40,
    facing: k.facing,
    moving: k.moving,
  };
}

export function packState(state: GameState): WireState {
  const forts =
    state.phase === "intro" || state.forts.some((f) => f.hitFlash > 0.02)
      ? state.forts.map((f) => ({
          x: f.x,
          y: f.y,
          rx: f.rx,
          ry: f.ry,
          hitFlash: Math.round(f.hitFlash * 20) / 20,
          hp: f.hp,
          maxHp: f.maxHp,
        }))
      : undefined;
  return {
    kids: state.kids.map(packKid),
    balls: state.balls.filter((b) => b.alive).map((b) => ({
      x: q(b.x),
      y: q(b.y),
      vx: q(b.vx),
      vy: q(b.vy),
      team: b.team,
      fromId: b.fromId,
      alive: true,
      range: q(b.range),
      traveled: q(b.traveled),
    })),
    forts,
    level: state.level,
    freeze: Math.round(state.freeze * 40) / 40,
    introT: Math.round(state.introT * 20) / 20,
    phase: state.phase,
    nextId: state.nextId,
    time: Math.round(state.time * 20) / 20,
  };
}

export function packPose(
  state: GameState,
  prev: Map<number, { x: number; y: number; t: number }>,
  now = performance.now(),
): Extract<NetMsg, { t: "pose" }> {
  return {
    t: "pose",
    t0: now,
    kids: state.kids.map((k) => {
      const p = prev.get(k.id);
      const dt = p ? Math.max(0.016, (now - p.t) / 1000) : 0.06;
      const vx = p ? (k.x - p.x) / dt : 0;
      const vy = p ? (k.y - p.y) / dt : 0;
      prev.set(k.id, { x: k.x, y: k.y, t: now });
      return {
        i: k.id,
        x: q(k.x),
        y: q(k.y),
        vx: q(vx),
        vy: q(vy),
        f: k.facing,
        s: k.state,
        h: k.hp,
        m: k.moving,
      };
    }),
    intro: Math.round(state.introT * 20) / 20,
    phase: state.phase,
  };
}

export function applyPose(
  state: GameState,
  msg: Extract<NetMsg, { t: "pose" }>,
  opts: {
    grabId?: number | null;
    predictTeam?: Team | null;
    rttMs?: number | null;
    hostNow?: number | null;
  } = {},
) {
  const lan = (opts.rttMs ?? 200) < 55;
  const a = lan ? 0.82 : 0.58;
  const age = opts.hostNow != null ? Math.max(0, (opts.hostNow - msg.t0) / 1000) : 0;
  const leadT = Math.min(0.05, age * 0.35 + 0.02);
  for (const w of msg.kids) {
    const kid = state.kids.find((k) => k.id === w.i);
    if (!kid) continue;
    if (opts.grabId === w.i) {
      kid.hp = w.h;
      continue;
    }
    const keep = opts.predictTeam === kid.team && kid.state !== "hurt" && kid.state !== "buried";
    const tx = w.x + (w.vx ?? 0) * leadT;
    const ty = w.y + (w.vy ?? 0) * leadT;
    if (!keep) {
      kid.x = kid.x + (tx - kid.x) * a;
      kid.y = kid.y + (ty - kid.y) * a;
      kid.facing = w.f;
      kid.moving = w.m;
      if (w.s === "hurt" || w.s === "buried" || w.s === "throw" || w.s === "pack") {
        kid.state = w.s;
      } else if (kid.state !== "grabbed") {
        kid.state = w.s;
      }
    }
    kid.hp = w.h;
  }
  if (msg.phase === "intro" || msg.phase === "fight") {
    state.introT = msg.intro;
    if (state.phase === "intro" || state.phase === "fight") state.phase = msg.phase;
  }
}

export function applyState(
  state: GameState,
  wire: WireState,
  opts: {
    grabId?: number | null;
    keepTeam?: Team | null;
    keepBallsUntil?: number;
    hard?: boolean;
    predictTeam?: Team | null;
    rttMs?: number | null;
  } = {},
) {
  const brains = new Map(state.kids.map((k) => [k.id, k.ai]));
  const prevById = new Map(state.kids.map((k) => [k.id, k]));
  const now = performance.now();
  const lead = Math.min(1.1, (opts.rttMs ?? 0) / 2 / 280);
  state.kids = wire.kids.map((w) => {
    const prev = prevById.get(w.id);
    const ai = brains.get(w.id) ?? prev?.ai ?? null;
    const flash = w.flash ?? prev?.flash ?? 0;
    const stun = w.stun ?? prev?.stun ?? 0;
    if (!opts.hard && opts.grabId === w.id && prev) {
      return {
        id: w.id,
        team: w.team,
        x: prev.x,
        y: prev.y,
        lastX: prev.x,
        lastY: prev.y,
        hp: w.hp,
        maxHp: w.maxHp ?? prev.maxHp,
        state: prev.state === "grabbed" ? "grabbed" : w.state,
        stateT: w.stateT,
        cooldown: w.cooldown ?? prev.cooldown,
        packT: prev.packT > 0.04 ? prev.packT : w.packT,
        animT: prev.animT,
        flash,
        stun,
        facing: w.facing,
        fidget: prev.fidget,
        fidgetT: prev.fidgetT,
        fidgetWait: prev.fidgetWait,
        moving: prev.moving,
        ai,
      };
    }
    if (!opts.hard && prev) {
      const d = Math.hypot(prev.x - w.x, prev.y - w.y);
      const lan = (opts.rttMs ?? 200) < 55;
      const a = d > 88 ? 1 : lan ? 0.88 : 0.55;
      const keepPos =
        opts.predictTeam === w.team && w.state !== "hurt" && w.state !== "buried";
      let x = keepPos ? prev.x : prev.x + (w.x - prev.x) * a;
      let y = keepPos ? prev.y : prev.y + (w.y - prev.y) * a;
      if (!keepPos && lead > 0 && d < 88) {
        x += (w.x - prev.x) * lead;
        y += (w.y - prev.y) * lead;
      }
      return {
        id: w.id,
        team: w.team,
        x,
        y,
        lastX: prev.x,
        lastY: prev.y,
        hp: w.hp,
        maxHp: w.maxHp ?? prev.maxHp,
        state: w.state,
        stateT: w.stateT,
        cooldown: w.cooldown ?? prev.cooldown,
        packT: prev.packT > 0.04 ? prev.packT : w.packT,
        animT: prev.animT,
        flash,
        stun,
        facing: w.facing,
        fidget: prev.fidget,
        fidgetT: prev.fidgetT,
        fidgetWait: prev.fidgetWait,
        moving: keepPos ? prev.moving : w.moving,
        ai,
      };
    }
    return {
      id: w.id,
      team: w.team,
      x: w.x,
      y: w.y,
      lastX: w.x,
      lastY: w.y,
      hp: w.hp,
      maxHp: w.maxHp ?? 2,
      state: w.state,
      stateT: w.stateT,
      cooldown: w.cooldown ?? 0,
      packT: w.packT,
      animT: w.animT ?? 0,
      flash: w.flash ?? 0,
      stun: w.stun ?? 0,
      facing: w.facing,
      fidget: w.fidget ?? null,
      fidgetT: w.fidgetT ?? 0,
      fidgetWait: w.fidgetWait ?? 0,
      moving: w.moving,
      ai,
    };
  });
  if (!opts.hard) {
    const hostBalls = wire.balls.map((b) => ({
      x: b.x,
      y: b.y,
      vx: b.vx,
      vy: b.vy,
      team: b.team,
      r: BALL_RADIUS,
      fromId: b.fromId,
      grace: 0,
      spin: 0,
      alive: b.alive,
      range: b.range,
      traveled: b.traveled,
      local: false as const,
    }));
    const locals = state.balls.filter((b) => b.alive && (b.local || b.ghost));
    const kept = locals.filter(
      (loc) =>
        !hostBalls.some(
          (h) => h.fromId === loc.fromId && Math.hypot(h.x - loc.x, h.y - loc.y) < 140,
        ),
    );
    state.balls = [...hostBalls, ...kept];
  } else {
    state.balls = wire.balls.map((b) => ({
      x: b.x,
      y: b.y,
      vx: b.vx,
      vy: b.vy,
      team: b.team,
      r: BALL_RADIUS,
      fromId: b.fromId,
      grace: 0,
      spin: 0,
      alive: b.alive,
      range: b.range,
      traveled: b.traveled,
    }));
  }
  if (wire.forts) state.forts = wire.forts;
  if (opts.hard) {
    state.particles = wire.particles ?? [];
    state.footprints = wire.footprints ?? [];
  }
  state.level = wire.level;
  state.freeze = wire.freeze;
  state.introT = wire.introT;
  state.phase = wire.phase;
  state.nextId = wire.nextId;
  state.time = wire.time;
  if (opts.hard && wire.trauma != null) state.trauma = wire.trauma;
}

export function isNetMsg(v: unknown): v is NetMsg {
  return !!v && typeof v === "object" && "t" in v && typeof (v as { t: unknown }).t === "string";
}
