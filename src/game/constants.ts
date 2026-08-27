export const WORLD_W = 960;
export const WORLD_H = 540;
export const FIXED_DT = 1 / 60;
export const KID_RADIUS = 26;
export const BALL_RADIUS = 12;
export const PLAYER_COUNT = 3;
export const HP = 2;
export const STAR_HP = 10;
export const MAX_CHARGE = 1.2;
export const MIN_RANGE = 58;
export const MAX_RANGE = 820;
export const MIN_THROW_SPEED = 360;
export const MAX_THROW_SPEED = 500;
export const THROW_COOLDOWN = 0.12;
export const PACK_TIME = 0.92;
export const STAR_PACK_TIME = 0.32;
export const STAR_CHARGE = 0.4;
export const PVP_RANGE = 520;
export const PVP_SPEED = 440;
export const BIG_BALL_RADIUS = 36;
export const BIG_HELD_TIME = 10;
export const BIG_SHOTS = 3;
export const BIG_SPEED = 0.8;
export const BIG_CHARGE = 1.2;
export const PICKUP_LIFE = 10;
export const PICKUP_CD_MIN = 8;
export const PICKUP_CD_MAX = 12;
export const INTRO_TIME = 3;
export const MARGIN = 34;
export const SAVE_KEY = "snowcraft-v1";
export const MAX_ENEMIES = 15;
export const FORT_HP = 10;
export const AI_WIN_LEVEL = 5;

export function holdPower(seconds: number, star = false, big = false) {
  const cap = (star ? STAR_CHARGE : MAX_CHARGE) * (big ? BIG_CHARGE : 1);
  const t = Math.max(0, Math.min(1, seconds / cap));
  return t;
}

export function throwRange(power: number) {
  return MIN_RANGE + (MAX_RANGE - MIN_RANGE) * power;
}

export function throwSpeed(power: number) {
  return MIN_THROW_SPEED + (MAX_THROW_SPEED - MIN_THROW_SPEED) * power;
}

export function enemyCountForLevel(level: number) {
  return Math.min(MAX_ENEMIES, 3 + 2 * (level - 1));
}

export function aiInterval(level: number) {
  return Math.max(0.42, 1.55 - level * 0.1);
}

export function aiSpread(level: number) {
  return Math.max(8, 70 - level * 6);
}

export function aiMoveSpeed(level: number) {
  return 46 + Math.min(level, 10) * 7;
}

export interface PlayFeel {
  compact: boolean;
  draw: number;
  buried: number;
  pick: number;
  hit: number;
  ball: number;
}

export function isCompactPlay(cssW = 0) {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const short = Math.min(window.innerWidth, window.innerHeight) < 760;
  const narrow = cssW > 0 && cssW < 720;
  return coarse || short || narrow;
}

export function playFeel(cssW = 0): PlayFeel {
  const compact = isCompactPlay(cssW);
  return {
    compact,
    draw: compact ? 90 : 64,
    buried: compact ? 84 : 60,
    pick: compact ? 84 : 48,
    hit: compact ? 34 : 28,
    ball: compact ? 36 : 32,
  };
}
