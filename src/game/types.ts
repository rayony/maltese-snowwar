export type Team = "red" | "green";
export type KidState = "idle" | "throw" | "hurt" | "grabbed" | "buried";
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
  hp: number;
  maxHp: number;
  state: KidState;
  stateT: number;
  cooldown: number;
  animT: number;
  flash: number;
  stun: number;
  facing: 1 | -1;
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
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  kind: "flake" | "puff" | "spark";
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
}

export interface View {
  grab: Grab | null;
  pointer: { x: number; y: number } | null;
  hoverId: number | null;
  shakeEnabled: boolean;
  reducedMotion: boolean;
}
