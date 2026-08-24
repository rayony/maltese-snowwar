export type Team = "red" | "green";
export type KidState = "idle" | "throw" | "hurt" | "grabbed" | "buried" | "pack";
export type Fidget = "dance" | "wave" | null;
export type AllyMode = "off" | "defend" | "attack";
export type Screen = "title" | "playing" | "paused" | "gameover";
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
}

export interface Fort {
  x: number;
  y: number;
  rx: number;
  ry: number;
  hitFlash: number;
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
  allyMode: AllyMode;
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
}
