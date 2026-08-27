#!/usr/bin/env node
/** Record README action GIFs with the Christmas skin. Usage: node scripts/capture-readme-gifs.mjs */
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.APP_URL || "http://127.0.0.1:8080";
const OUT = "/workspace/public/readme";
const TMP = "/tmp/readme-gif-frames";

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

async function grab(page, dir, n, delay) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const canvas = page.locator("canvas");
  await canvas.waitFor({ state: "visible", timeout: 20000 });
  for (let i = 0; i < n; i++) {
    const buf = await canvas.screenshot({ type: "png" });
    writeFileSync(join(dir, `${String(i + 1).padStart(3, "0")}.png`), buf);
    if (i < n - 1) await page.waitForTimeout(delay);
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
await page.waitForTimeout(2200); // intro countdown

async function clientOf(kid) {
  return page.evaluate((id) => {
    const g = window.__snow;
    const k = g.state.kids.find((x) => x.id === id);
    const c = g.canvas;
    const r = c.getBoundingClientRect();
    const cssW = r.width;
    const cssH = r.height;
    const compact = cssW < 720;
    const landscapePhone = compact && cssW > cssH && cssH < 520;
    let scale = Math.min(cssW / 960, cssH / 540);
    if (compact && !landscapePhone) scale *= 1.12;
    const ox = (cssW - 960 * scale) / 2;
    const oy = (cssH - 540 * scale) / 2;
    return { x: r.left + ox + k.x * scale, y: r.top + oy + k.y * scale, id: k.id };
  }, kid);
}

const reds = await page.evaluate(() =>
  window.__snow.state.kids.filter((k) => k.team === "red" && k.state !== "buried").map((k) => k.id),
);
const rid = reds[1] ?? reds[0];

// hold-dodge: drag a maltese
{
  const p = await clientOf(rid);
  const rec = grab(page, join(TMP, "hold"), 12, 90);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (let i = 0; i < 10; i++) {
    await page.mouse.move(p.x - 18 * i, p.y + (i % 2 === 0 ? -12 : 12), { steps: 2 });
    await page.waitForTimeout(70);
  }
  await rec;
  await page.mouse.up();
  gifFromFrames(join(TMP, "hold"), join(OUT, "hold-dodge.gif"), 11);
  console.log("hold-dodge.gif");
}

await page.waitForTimeout(400);

// throw: hold then release
{
  const p = await clientOf(rid);
  const rec = grab(page, join(TMP, "throw"), 10, 100);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await rec;
  gifFromFrames(join(TMP, "throw"), join(OUT, "throw.gif"), 10);
  console.log("throw.gif");
}

await page.waitForTimeout(500);

// pack: after a throw, dogs pack
{
  await grab(page, join(TMP, "pack"), 8, 110);
  gifFromFrames(join(TMP, "pack"), join(OUT, "pack.gif"), 9);
  console.log("pack.gif");
}

// big snowball cheat
{
  await page.evaluate(() => {
    window.__snow.tapScoreHud();
    window.__snow.tapScoreHud();
  });
  await page.waitForTimeout(200);
  await grab(page, join(TMP, "big"), 10, 110);
  gifFromFrames(join(TMP, "big"), join(OUT, "big-snowball.gif"), 9);
  console.log("big-snowball.gif");
}

// brawl: wait a bit for exchanges
{
  await page.waitForTimeout(800);
  await grab(page, join(TMP, "brawl"), 12, 100);
  gifFromFrames(join(TMP, "brawl"), join(OUT, "brawl.gif"), 10);
  console.log("brawl.gif");
}

// victory overlay
{
  await page.evaluate(() => {
    const g = window.__snow;
    g.versusResult = "win";
    g.screen = "gameover";
    g.outcomeHandled = true;
    g.emit();
  });
  await page.waitForTimeout(400);
  await grab(page, join(TMP, "win"), 8, 140);
  gifFromFrames(join(TMP, "win"), join(OUT, "victory.gif"), 7);
  console.log("victory.gif");
}

await browser.close();
if (!existsSync(join(OUT, "victory.gif"))) process.exit(1);
console.log("done", OUT);
