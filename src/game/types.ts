export type Team = "red" | "green";
export type KidState = "idle" | "throw" | "hurt" | "grabbed" | "buried" | "pack";
export type Fidget = "dance" | "wave" | null;
export type AllyMode = "off" | "defend" | "attack";
export type Difficulty = "easy" | "hard";
export type Screen = "title" | "loading" | "playing" | "paused" | "gameover" | "lobby";
export type FightPhase = "intro" | "fight" | "won" | "lost";

export interface AiBrain {
  phase: "idle" | "move" | "windup" | "dodge";
  t: number;
  destX: number;
  destY: number;
  charge: number;
  coverT: number;
  awayT: number;
  campX?: number;
  campY?: number;
  campT?: number;
  fake?: boolean;
  lastThrowAt?: number;
}

export interface Kid {
  id: number;
  team: Team;
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  hp: number;
  maxHp: number;
  state: KidState;
  stateT: number;
  cooldown: number;
  packT: number;
  animT: number;
  flash: number;
  stun: number;
  facing: 1 | -1;
  fidget: Fidget;
  fidgetT: number;
  fidgetWait: number;
  moving: boolean;
  hideFuel?: number;
  hideSession?: boolean;
  ai: AiBrain | null;
  viewX?: number;
  viewY?: number;
}

export interface Snowball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  team: Team;
  r: number;
  fromId: number;
  grace: number;
  spin: number;
  alive: boolean;
  range: number;
  traveled: number;
  local?: boolean;
  ghost?: boolean;
  born?: number;
  big?: boolean;
}

export interface Fort {
  x: number;
  y: number;
  rx: number;
  ry: number;
  hitFlash: number;
  hp: number;
  maxHp: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  kind: "flake" | "puff" | "spark" | "note";
}

export interface Pickup {
  x: number;
  y: number;
  kind: "big";
  life: number;
  maxLife: number;
}

export interface TeamBuff {
  kind: "big";
  shots: number;
  t: number;
}

export interface Footprint {
  x: number;
  y: number;
  life: number;
}

export interface Grab {
  id: number;
  pointerId: number;
  startedAt: number;
  lastX: number;
  lastY: number;
  vx: number;
  vy: number;
  packLeft: number;
  originX: number;
  originY: number;
}

export interface GameState {
  kids: Kid[];
  balls: Snowball[];
  forts: Fort[];
  particles: Particle[];
  footprints: Footprint[];
  flakes: Particle[];
  level: number;
  freeze: number;
  introT: number;
  phase: FightPhase;
  nextId: number;
  time: number;
  trauma: number;
  hard: boolean;
  pvp: boolean;
  godSpeed: boolean;
  pickup: Pickup | null;
  pickupCd: number;
  buffs: { red: TeamBuff | null; green: TeamBuff | null };
}

export type NetRole = "solo" | "host" | "guest";
export type NetStatus = "off" | "waiting" | "connecting" | "live" | "disconnect" | "rematch";

export interface NetUi {
  role: NetRole;
  status: NetStatus;
  code: string | null;
  team: Team;
  error: string | null;
  rematchMine: boolean;
  rematchTheirs: boolean;
  result: "win" | "lose" | null;
  rttMs: number | null;
  link: "direct" | "relay";
}

export interface UiSnapshot {
  screen: Screen;
  level: number;
  best: number;
  clearEasyMs: number | null;
  clearHardMs: number | null;
  clearEasyStar: boolean;
  clearHardStar: boolean;
  redAlive: number;
  greenAlive: number;
  greenTotal: number;
  muted: boolean;
  ready: boolean;
  loadDone: number;
  loadTotal: number;
  allyMode: AllyMode;
  difficulty: Difficulty;
  godSpeed: boolean;
  net: NetUi;
  fps: number;
  pickup: {
    field: boolean;
    held: boolean;
    foeHeld: boolean;
    life: number;
    maxLife: number;
    shots: number;
    maxShots: number;
  } | null;
}

export interface View {
  grab: Grab | null;
  pointer: { x: number; y: number } | null;
  hoverId: number | null;
  shakeEnabled: boolean;
  reducedMotion: boolean;
  drawSize: number;
  buriedSize: number;
  pickRadius: number;
  ballSize: number;
  mirror: boolean;
  pvp: boolean;
  godSpeed: boolean;
  bigCharge: boolean;
}
