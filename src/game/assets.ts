export interface SpriteSet {
  idle: HTMLImageElement[];
  throw: HTMLImageElement[];
  hurt: HTMLImageElement[];
  dance: HTMLImageElement[];
  wave: HTMLImageElement[];
  walk: HTMLImageElement[];
  pack: HTMLImageElement[];
  buried: HTMLImageElement;
}

export interface Assets {
  red: SpriteSet;
  green: SpriteSet;
  ball: HTMLImageElement[];
  impact: HTMLImageElement[];
  fort: HTMLImageElement;
  ready: boolean;
}

export type SkinId = "classic" | "xmas";

const SKIN_KEY = "msw-skin-v2";
const SKIN_VER = "9";

let skin: SkinId = "classic";

export function currentSkin() {
  return skin;
}

export function classicAvailable() {
  return true;
}

/** classic = public/sprites (Line Puppy on Grok). xmas = public/skins/xmas. Shared FX stay at /sprites/fx. */
export function spriteUrl(path: string) {
  const root = skin === "xmas" ? "/skins/xmas/sprites" : "/sprites";
  return `${root}/${path}?v=${SKIN_VER}`;
}

export function dogUrl(team: "red" | "green", pose: string, frame = 1) {
  return spriteUrl(`${team}/${pose}-${frame}.png`);
}

export function buriedUrl(team: "red" | "green") {
  return spriteUrl(`fx/buried-${team}.png`);
}

export async function initSkin(): Promise<SkinId> {
  let saved: SkinId | null = null;
  try {
    const raw = localStorage.getItem(SKIN_KEY);
    if (raw === "classic" || raw === "xmas") saved = raw;
  } catch {
    /* private mode */
  }
  skin = saved === "xmas" ? "xmas" : "classic";
  return skin;
}

export function setSkin(id: SkinId): SkinId {
  skin = id;
  try {
    localStorage.setItem(SKIN_KEY, id);
  } catch {
    /* ignore */
  }
  return skin;
}

export function toggleSkin(): SkinId {
  return setSkin(skin === "xmas" ? "classic" : "xmas");
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    let settled = false;
    const ok = () => {
      if (settled) return;
      settled = true;
      resolve(img);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      reject(new Error(`Failed to load ${src}`));
    };
    img.onload = ok;
    img.onerror = fail;
    img.src = src;
    window.setTimeout(fail, 8000);
  });
}

function frames(team: "red" | "green", pose: string) {
  return [1, 2, 3, 4].map((i) => dogUrl(team, pose, i));
}

export function coreUrls() {
  return [dogUrl("red", "idle", 1), dogUrl("green", "idle", 1), "/sprites/fx/fort.png?v=3"];
}

/** Title-screen English boot — no action poses, no music. */
export function bootUrls() {
  return [
    "/images/title-bg.jpg?v=3",
    "/fonts/Caveat-script.woff2",
    dogUrl("red", "idle", 1),
    dogUrl("green", "idle", 1),
  ];
}

export async function loadBootAssets(onProgress?: (done: number, total: number) => void) {
  const urls = bootUrls();
  const total = urls.length;
  let done = 0;
  await Promise.all(
    urls.map(async (src) => {
      try {
        if (src.endsWith(".woff2")) {
          const buf = await fetch(src).then((r) => r.arrayBuffer());
          if (typeof FontFace !== "undefined") {
            const face = new FontFace("Caveat", buf);
            await face.load();
            document.fonts.add(face);
          }
        } else {
          await loadImage(src);
        }
      } catch {
        /* still count so the title can open */
      } finally {
        done += 1;
        onProgress?.(done, total);
      }
    }),
  );
}

export function restUrls() {
  const poses = ["throw", "hurt", "dance", "wave", "walk", "pack"] as const;
  return [
    ...poses.flatMap((p) => frames("red", p)),
    ...poses.flatMap((p) => frames("green", p)),
    ...[1, 2, 3, 4].map((i) => `/sprites/fx/projectile-${i}.png?v=3`),
    ...[1, 2, 3, 4].map((i) => `/sprites/fx/impact-${i}.png?v=3`),
    buriedUrl("red"),
    buriedUrl("green"),
  ];
}

export const ASSET_TOTAL = 3 + 6 * 4 * 2 + 4 + 4 + 2;

async function loadTracked(urls: string[], onProgress?: (done: number, total: number) => void, start = 0, total = urls.length) {
  let done = start;
  const imgs = await Promise.all(
    urls.map(async (src) => {
      try {
        return await loadImage(src);
      } finally {
        done += 1;
        onProgress?.(done, total);
      }
    }),
  );
  return imgs;
}

/** Idle only — enough to paint Maltese / retriever instead of placeholder blobs. */
export async function loadCoreAssets(onProgress?: (done: number, total: number) => void): Promise<Assets> {
  const urls = coreUrls();
  const imgs = await loadTracked(urls, onProgress, 0, ASSET_TOTAL);
  const empty = [] as HTMLImageElement[];
  const redIdle = imgs[0]!;
  const greenIdle = imgs[1]!;
  const fort = imgs[2]!;
  return {
    red: {
      idle: [redIdle],
      throw: empty,
      hurt: empty,
      dance: empty,
      wave: empty,
      walk: empty,
      pack: empty,
      buried: redIdle,
    },
    green: {
      idle: [greenIdle],
      throw: empty,
      hurt: empty,
      dance: empty,
      wave: empty,
      walk: empty,
      pack: empty,
      buried: greenIdle,
    },
    ball: empty,
    impact: empty,
    fort,
    ready: false,
  };
}

/** Remaining poses. Idle-2/3/4 are unused (only idle-1 is drawn). */
export async function loadRestAssets(
  assets: Assets,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const urls = restUrls();
  const imgs = await loadTracked(urls, onProgress, coreUrls().length, ASSET_TOTAL);
  let i = 0;
  const take = (n: number) => imgs.slice(i, (i += n));
  assets.red.throw = take(4);
  assets.red.hurt = take(4);
  assets.red.dance = take(4);
  assets.red.wave = take(4);
  assets.red.walk = take(4);
  assets.red.pack = take(4);
  assets.green.throw = take(4);
  assets.green.hurt = take(4);
  assets.green.dance = take(4);
  assets.green.wave = take(4);
  assets.green.walk = take(4);
  assets.green.pack = take(4);
  assets.ball = take(4);
  assets.impact = take(4);
  assets.red.buried = imgs[i++]!;
  assets.green.buried = imgs[i++]!;
  assets.ready = true;
}
