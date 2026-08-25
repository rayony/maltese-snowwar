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

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

function frames(team: "red" | "green", pose: string) {
  return [1, 2, 3, 4].map((i) => `/sprites/${team}/${pose}-${i}.png?v=5`);
}

export const CORE_URLS = [
  "/sprites/red/idle-1.png?v=5",
  "/sprites/green/idle-1.png?v=5",
  "/sprites/fx/fort.png?v=3",
] as const;

export function restUrls() {
  const poses = ["throw", "hurt", "dance", "wave", "walk", "pack"] as const;
  return [
    ...poses.flatMap((p) => frames("red", p)),
    ...poses.flatMap((p) => frames("green", p)),
    ...[1, 2, 3, 4].map((i) => `/sprites/fx/projectile-${i}.png?v=3`),
    ...[1, 2, 3, 4].map((i) => `/sprites/fx/impact-${i}.png?v=3`),
    "/sprites/fx/buried-red.png?v=3",
    "/sprites/fx/buried-green.png?v=3",
  ];
}

export const ASSET_TOTAL = CORE_URLS.length + restUrls().length;

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
  const imgs = await loadTracked([...CORE_URLS], onProgress, 0, ASSET_TOTAL);
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
  const imgs = await loadTracked(urls, onProgress, CORE_URLS.length, ASSET_TOTAL);
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
