export interface SpriteSet {
  idle: HTMLImageElement[];
  throw: HTMLImageElement[];
  hurt: HTMLImageElement[];
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
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

async function loadMany(urls: string[]) {
  return Promise.all(urls.map(loadImage));
}

export async function loadAssets(): Promise<Assets> {
  const [redIdle, redThrow, redHurt, greenIdle, greenThrow, greenHurt, ball, impact, fort, buriedRed, buriedGreen] =
    await Promise.all([
      loadMany([1, 2, 3, 4].map((i) => `/sprites/red/idle-${i}.png?v=3`)),
      loadMany([1, 2, 3, 4].map((i) => `/sprites/red/throw-${i}.png?v=3`)),
      loadMany([1, 2, 3, 4].map((i) => `/sprites/red/hurt-${i}.png?v=3`)),
      loadMany([1, 2, 3, 4].map((i) => `/sprites/green/idle-${i}.png?v=3`)),
      loadMany([1, 2, 3, 4].map((i) => `/sprites/green/throw-${i}.png?v=3`)),
      loadMany([1, 2, 3, 4].map((i) => `/sprites/green/hurt-${i}.png?v=3`)),
      loadMany([1, 2, 3, 4].map((i) => `/sprites/fx/projectile-${i}.png?v=3`)),
      loadMany([1, 2, 3, 4].map((i) => `/sprites/fx/impact-${i}.png?v=3`)),
      loadImage("/sprites/fx/fort.png?v=3"),
      loadImage("/sprites/fx/buried-red.png?v=3"),
      loadImage("/sprites/fx/buried-green.png?v=3"),
    ]);

  return {
    red: { idle: redIdle, throw: redThrow, hurt: redHurt, buried: buriedRed },
    green: { idle: greenIdle, throw: greenThrow, hurt: greenHurt, buried: buriedGreen },
    ball,
    impact,
    fort,
    ready: true,
  };
}
