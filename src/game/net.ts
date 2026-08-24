import type { AllyMode, FightPhase, Fidget, GameState, Kid, KidState, Team } from "./types";

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
  | { t: "snap"; s: WireState }
  | { t: "input"; kind: "down" | "move" | "up"; x: number; y: number; hold?: number; vx?: number; vy?: number }
  | { t: "ally"; mode: AllyMode }
  | { t: "rematch"; yes: boolean }
  | { t: "bye" }
  | { t: "bot" }
  | { t: "hb" };

export interface WireKid {
  id: number;
  team: Team;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  state: KidState;
  stateT: number;
  packT: number;
  animT: number;
  flash: number;
  stun: number;
  facing: 1 | -1;
  fidget: Fidget;
  fidgetT: number;
  fidgetWait: number;
  moving: boolean;
  cooldown: number;
}

export interface WireState {
  kids: WireKid[];
  balls: GameState["balls"];
  forts: GameState["forts"];
  particles: GameState["particles"];
  footprints: GameState["footprints"];
  level: number;
  freeze: number;
  introT: number;
  phase: FightPhase;
  nextId: number;
  time: number;
  trauma: number;
}

function packKid(k: Kid): WireKid {
  return {
    id: k.id,
    team: k.team,
    x: k.x,
    y: k.y,
    hp: k.hp,
    maxHp: k.maxHp,
    state: k.state,
    stateT: k.stateT,
    packT: k.packT,
    animT: k.animT,
    flash: k.flash,
    stun: k.stun,
    facing: k.facing,
    fidget: k.fidget,
    fidgetT: k.fidgetT,
    fidgetWait: k.fidgetWait,
    moving: k.moving,
    cooldown: k.cooldown,
  };
}

export function packState(state: GameState): WireState {
  return {
    kids: state.kids.map(packKid),
    balls: state.balls,
    forts: state.forts,
    particles: [],
    footprints: [],
    level: state.level,
    freeze: state.freeze,
    introT: state.introT,
    phase: state.phase,
    nextId: state.nextId,
    time: state.time,
    trauma: state.trauma,
  };
}

export function applyState(
  state: GameState,
  wire: WireState,
  opts: { grabId?: number | null; keepTeam?: Team | null; keepBallsUntil?: number } = {},
) {
  const brains = new Map(state.kids.map((k) => [k.id, k.ai]));
  const prevById = new Map(state.kids.map((k) => [k.id, k]));
  const now = performance.now();
  state.kids = wire.kids.map((w) => {
    const prev = prevById.get(w.id);
    const ai = brains.get(w.id) ?? prev?.ai ?? null;
    if (opts.grabId === w.id && prev) {
      return {
        ...w,
        x: prev.x,
        y: prev.y,
        state: prev.state === "grabbed" ? "grabbed" : w.state,
        lastX: prev.x,
        lastY: prev.y,
        ai,
      };
    }
    if (prev) {
      const d = Math.hypot(prev.x - w.x, prev.y - w.y);
      const a = d > 88 ? 1 : 0.55;
      return {
        ...w,
        x: prev.x + (w.x - prev.x) * a,
        y: prev.y + (w.y - prev.y) * a,
        lastX: prev.x,
        lastY: prev.y,
        ai,
      };
    }
    return { ...w, lastX: w.x, lastY: w.y, ai };
  });
  if (opts.keepTeam && now < (opts.keepBallsUntil ?? 0)) {
    state.balls = [
      ...wire.balls.filter((b) => b.team !== opts.keepTeam),
      ...state.balls.filter((b) => b.team === opts.keepTeam && b.alive),
    ];
  } else {
    state.balls = wire.balls;
  }
  state.forts = wire.forts;
  state.particles = wire.particles;
  state.footprints = wire.footprints;
  state.level = wire.level;
  state.freeze = wire.freeze;
  state.introT = wire.introT;
  state.phase = wire.phase;
  state.nextId = wire.nextId;
  state.time = wire.time;
  state.trauma = wire.trauma;
}

export function isNetMsg(v: unknown): v is NetMsg {
  return !!v && typeof v === "object" && "t" in v && typeof (v as { t: unknown }).t === "string";
}
