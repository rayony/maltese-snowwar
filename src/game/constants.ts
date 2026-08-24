export const WORLD_W = 960;
export const WORLD_H = 540;
export const FIXED_DT = 1 / 60;
export const KID_RADIUS = 26;
export const BALL_RADIUS = 8;
export const PLAYER_COUNT = 3;
export const HP = 2;
/** Seconds of hold to reach a full-field throw. */
export const MAX_CHARGE = 1.2;
/** Tap / short hold lands close; full hold crosses the field. */
export const MIN_RANGE = 58;
export const MAX_RANGE = 820;
export const MIN_THROW_SPEED = 360;
export const MAX_THROW_SPEED = 500;
export const THROW_COOLDOWN = 0.32;
export const MARGIN = 34;
export const SAVE_KEY = "snowcraft-v1";
export const MAX_ENEMIES = 15;

export function holdPower(seconds: number) {
  const t = Math.max(0, Math.min(1, seconds / MAX_CHARGE));
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
