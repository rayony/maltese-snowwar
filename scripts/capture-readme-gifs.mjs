#!/usr/bin/env node
/** Record zoomed README action GIFs (Christmas skin). node scripts/capture-readme-gifs.mjs */
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.APP_URL || "http://127.0.0.1:8080";
const OUT = "/workspace/public/readme";
const TMP = "/tmp/readme-gif-frames";
const VW = 400;
const VH = 225;

function gifFromFrames(dir, dest, fps = 10) {
  const r = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-framerate",
      String(fps),
      "-i",
      join(dir, "%03d.png"),
      "-vf",
      "scale=480:270:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=full[p];[s1][p]paletteuse=dither=bayer",
      "-loop",
      "0",
      dest,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    console.error(r.stderr);
    throw new Error(`ffmpeg failed for ${dest}`);
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
await page.addInitScript(() => {
  localStorage.setItem("msw-skin-v2", "xmas");
});
await page.goto(`${BASE}/?capture=1`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector('[data-testid="play-vs-ai"]', { timeout: 30000 });
await page.click('[data-testid="play-vs-ai"]');
await page.click('[data-testid="play-easy"]');
await page.waitForFunction(() => window.__snow && window.__snow.screen === "playing", { timeout: 40000 });

await page.evaluate(() => {
  const g = window.__snow;
  g.state.introT = 0;
  g.state.phase = "fight";
  g.state.balls.length = 0;
  g.state.pickup = null;
  g.state.pickupCd = 9999;
  g.state.particles.length = 0;
  for (const k of g.state.kids) {
    if (k.team === "green") {
      k.stun = 99;
      k.cooldown = 99;
      k.packT = 0;
    }
  }
});
await page.waitForTimeout(120);

async function layout() {
  return page.evaluate(() => {
    const g = window.__snow;
    const r = g.canvas.getBoundingClientRect();
    const scale = Math.min(r.width / 960, r.height / 540);
    return { left: r.left, top: r.top, w: r.width, h: r.height, scale, ox: (r.width - 960 * scale) / 2, oy: (r.height - 540 * scale) / 2 };
  });
}

async function kidWorld(id) {
  return page.evaluate((id) => {
    const k = window.__snow.state.kids.find((x) => x.id === id);
    return k ? { x: k.x, y: k.y, state: k.state } : null;
  }, id);
}

function clipAround(lay, wx, wy, zoom = 1) {
  const vw = VW / zoom;
  const vh = VH / zoom;
  let cx = lay.left + lay.ox + wx * lay.scale;
  let cy = lay.top + lay.oy + wy * lay.scale;
  let x = cx - vw / 2;
  let y = cy - vh / 2;
  x = Math.max(lay.left, Math.min(x, lay.left + lay.w - vw));
  y = Math.max(lay.top, Math.min(y, lay.top + lay.h - vh));
  return { x, y, width: vw, height: vh };
}

function cropFrame(raw, out, wx, wy, zoom) {
  const r = spawnSync(
    "python3",
    [
      "-c",
      `
from PIL import Image
im=Image.open(${JSON.stringify(raw)})
iw,ih=im.size
cw=max(32,int(${VW}/${zoom}))
ch=max(32,int(${VH}/${zoom}))
x=int(${wx}/960*iw - cw/2)
y=int(${wy}/540*ih - ch/2)
x=max(0,min(x,iw-cw)); y=max(0,min(y,ih-ch))
im.crop((x,y,x+cw,y+ch)).save(${JSON.stringify(out)})
`,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    throw new Error("crop failed");
  }
}

async function grabZoom(dir, n, delay, centerFn) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const canvas = page.locator("canvas");
  await canvas.waitFor({ state: "visible", timeout: 20000 });
  for (let i = 0; i < n; i++) {
    const c = await centerFn();
    const raw = join(dir, `full-${String(i + 1).padStart(3, "0")}.png`);
    const out = join(dir, `${String(i + 1).padStart(3, "0")}.png`);
    const dataUrl = await page.evaluate(() => window.__snow.canvas.toDataURL("image/png"));
    writeFileSync(raw, Buffer.from(dataUrl.split(",")[1], "base64"));
    cropFrame(raw, out, c.x, c.y, c.zoom ?? 1);
    if (i < n - 1) await page.waitForTimeout(delay);
  }
}

const reds = await page.evaluate(() =>
  window.__snow.state.kids.filter((k) => k.team === "red" && k.state !== "buried").map((k) => k.id),
);
const greens = await page.evaluate(() =>
  window.__snow.state.kids.filter((k) => k.team === "green" && k.state !== "buried").map((k) => k.id),
);
const rid = reds[1] ?? reds[0];
const gid = greens[1] ?? greens[0];

async function cssKid(id) {
  const w = await kidWorld(id);
  const lay = await layout();
  return { x: lay.left + lay.ox + w.x * lay.scale, y: lay.top + lay.oy + w.y * lay.scale, ...w };
}

// --- hold / dodge: drag one maltese, no balls ---
{
  const p = await cssKid(rid);
  const rec = grabZoom(join(TMP, "hold"), 12, 85, async () => {
    const k = await kidWorld(rid);
    return { x: k.x, y: k.y, zoom: 1.35 };
  });
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (let i = 0; i < 10; i++) {
    await page.mouse.move(p.x - 14 * i, p.y + (i % 2 === 0 ? -10 : 10), { steps: 2 });
    await page.waitForTimeout(65);
  }
  await rec;
  await page.mouse.up();
  gifFromFrames(join(TMP, "hold"), join(OUT, "hold-dodge.gif"), 11);
  console.log("hold-dodge.gif");
}

await page.evaluate(() => {
  window.__snow.state.balls.length = 0;
});
await page.waitForTimeout(250);

// --- throw: hold then release, zoom on thrower ---
{
  const p = await cssKid(rid);
  const rec = grabZoom(join(TMP, "throw"), 10, 95, async () => {
    const k = await kidWorld(rid);
    return { x: k.x - 40, y: k.y, zoom: 1.25 };
  });
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await rec;
  gifFromFrames(join(TMP, "throw"), join(OUT, "throw.gif"), 10);
  console.log("throw.gif");
}

await page.waitForTimeout(280);

await page.evaluate(() => {
  window.__snow.state.balls.length = 0;
});

// --- pack: packing ring on the thrower ---
{
  await grabZoom(join(TMP, "pack"), 8, 100, async () => {
    const k = await kidWorld(rid);
    return { x: k.x, y: k.y - 8, zoom: 1.45 };
  });
  gifFromFrames(join(TMP, "pack"), join(OUT, "pack.gif"), 9);
  console.log("pack.gif");
}

// --- brawl: unfreeze AI, zoom on a clash ---
{
  await page.evaluate((ids) => {
    const g = window.__snow;
    g.state.balls.length = 0;
    g.state.pickup = null;
    const red = g.state.kids.find((k) => k.id === ids.rid);
    const green = g.state.kids.find((k) => k.id === ids.gid);
    if (red && green) {
      green.stun = 0;
      green.cooldown = 0;
      green.x = red.x - 90;
      green.y = red.y;
      red.state = "idle";
      // spawn a ball from green into red
      g.state.balls.push({
        id: g.state.nextId++,
        x: green.x + 20,
        y: green.y,
        vx: 220,
        vy: 0,
        team: "green",
        r: 12,
        fromId: green.id,
        grace: 0,
        spin: 0,
        alive: true,
        range: 400,
        traveled: 0,
        local: true,
        born: performance.now(),
        big: false,
      });
    }
  }, { rid, gid });
  await grabZoom(join(TMP, "brawl"), 12, 90, async () => {
    const a = await kidWorld(rid);
    const b = await kidWorld(gid);
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, zoom: 1.3 };
  });
  gifFromFrames(join(TMP, "brawl"), join(OUT, "brawl.gif"), 10);
  console.log("brawl.gif");
}

// --- big snowball: only this clip shows the orb ---
{
  await page.evaluate(() => {
    const g = window.__snow;
    g.state.balls.length = 0;
    for (const k of g.state.kids) {
      if (k.team === "green") {
        k.stun = 99;
        k.cooldown = 99;
      }
    }
    g.tapScoreHud();
    g.tapScoreHud();
  });
  await page.waitForTimeout(180);
  await grabZoom(join(TMP, "big"), 10, 110, async () => {
    const orb = await page.evaluate(() => {
      const p = window.__snow.state.pickup;
      return p ? { x: p.x, y: p.y } : { x: 480, y: 270 };
    });
    return { x: orb.x, y: orb.y, zoom: 1.35 };
  });
  gifFromFrames(join(TMP, "big"), join(OUT, "big-snowball.gif"), 9);
  console.log("big-snowball.gif");
}

// --- victory: result card only ---
{
  await page.evaluate(() => {
    const g = window.__snow;
    g.versusResult = "win";
    g.screen = "gameover";
    g.outcomeHandled = true;
    g.emit();
  });
  await page.waitForTimeout(500);
  const card = page.locator("div.fixed.z-\\[60\\] div.rounded-xl").first();
  await card.waitFor({ state: "visible", timeout: 8000 });
  rmSync(join(TMP, "win"), { recursive: true, force: true });
  mkdirSync(join(TMP, "win"), { recursive: true });
  for (let i = 0; i < 8; i++) {
    const buf = await card.screenshot({ type: "png" });
    writeFileSync(join(TMP, "win", `${String(i + 1).padStart(3, "0")}.png`), buf);
    await page.waitForTimeout(140);
  }
  gifFromFrames(join(TMP, "win"), join(OUT, "victory.gif"), 7);
  console.log("victory.gif");
}

await browser.close();
if (!existsSync(join(OUT, "victory.gif"))) process.exit(1);
console.log("done", OUT);
