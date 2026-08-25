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
  redAlive: number;
  greenAlive: number;
  greenTotal: number;
  muted: boolean;
  ready: boolean;
  loadDone: number;
  loadTotal: number;
  allyMode: AllyMode;
  difficulty: Difficulty;
  net: NetUi;
  fps: number;
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
}
