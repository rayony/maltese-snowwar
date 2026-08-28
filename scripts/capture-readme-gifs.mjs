#!/usr/bin/env node
/** Record README action GIFs. node scripts/capture-readme-gifs.mjs */
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.APP_URL || "http://127.0.0.1:8080";
const OUT = "/workspace/public/readme";
const TMP = "/tmp/readme-gif-frames";

function compose(metaPath, dest, fps) {
  const r = spawnSync("python3", ["/workspace/scripts/compose-readme-gif.py", metaPath, dest, String(fps)], {
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    throw new Error(`compose failed for ${dest}`);
  }
  console.log(r.stdout.trim());
}

function dumpCanvas(page) {
  return page.evaluate(() => window.__snow.canvas.toDataURL("image/png"));
}

function writePng(path, dataUrl) {
  writeFileSync(path, Buffer.from(dataUrl.split(",")[1], "base64"));
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
await page.waitForTimeout(80);

async function layout() {
  return page.evaluate(() => {
    const g = window.__snow;
    const r = g.canvas.getBoundingClientRect();
    const scale = Math.min(r.width / 960, r.height / 540);
    return { left: r.left, top: r.top, scale, ox: (r.width - 960 * scale) / 2, oy: (r.height - 540 * scale) / 2 };
  });
}
async function kidWorld(id) {
  return page.evaluate((id) => {
    const k = window.__snow.state.kids.find((x) => x.id === id);
    return k ? { x: k.x, y: k.y, state: k.state, hp: k.hp } : null;
  }, id);
}
async function cssOf(wx, wy) {
  const lay = await layout();
  return { x: lay.left + lay.ox + wx * lay.scale, y: lay.top + lay.oy + wy * lay.scale };
}

const reds = await page.evaluate(() =>
  window.__snow.state.kids.filter((k) => k.team === "red" && k.state !== "buried").map((k) => k.id),
);
const greens = await page.evaluate(() =>
  window.__snow.state.kids.filter((k) => k.team === "green" && k.state !== "buried").map((k) => k.id),
);
const rid = reds[1] ?? reds[0];
const gid = greens[1] ?? greens[0];

async function recordWorld(dir, n, delay, centerFn) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames = [];
  for (let i = 0; i < n; i++) {
    const c = await centerFn(i);
    writePng(join(dir, `${String(i + 1).padStart(3, "0")}.png`), await dumpCanvas(page));
    frames.push(c);
    if (i < n - 1) await page.waitForTimeout(delay);
  }
  const meta = join(dir, "meta.json");
  writeFileSync(meta, JSON.stringify({ dir, mode: "world", frames }));
  return meta;
}

// ---------- 1. hold / dodge: finger + incoming ball ----------
{
  await page.evaluate((ids) => {
    const g = window.__snow;
    g.state.balls.length = 0;
    const red = g.state.kids.find((k) => k.id === ids.rid);
    const green = g.state.kids.find((k) => k.id === ids.gid);
    red.x = 640;
    red.y = 300;
    red.packT = 0;
    red.state = "idle";
    g.state.balls.push({
      x: 380,
      y: 300,
      vx: 220,
      vy: 0,
      team: "green",
      r: 12,
      fromId: green.id,
      grace: 0,
      spin: 0,
      alive: true,
      range: 700,
      traveled: 0,
      local: true,
      born: performance.now(),
      big: false,
    });
  }, { rid, gid });
  const start = await kidWorld(rid);
  const p = await cssOf(start.x, start.y);
  const rec = recordWorld(join(TMP, "hold"), 18, 70, async () => {
    const k = await kidWorld(rid);
    const ball = await page.evaluate(() => {
      const b = window.__snow.state.balls.find((x) => x.alive);
      return b ? { x: b.x, y: b.y } : null;
    });
    const cx = ball ? (k.x + ball.x) / 2 : k.x;
    return { x: cx, y: k.y, zoom: 1.18, finger: true, fx: k.x + 22, fy: k.y + 26 };
  });
  await page.waitForTimeout(180);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (let i = 0; i < 12; i++) {
    await page.mouse.move(p.x - i * 4, p.y - 16 * Math.min(i, 8), { steps: 2 });
    await page.waitForTimeout(55);
  }
  await rec;
  await page.mouse.up();
  compose(join(TMP, "hold", "meta.json"), join(OUT, "hold-dodge.gif"), 13);
}

await page.evaluate(() => {
  window.__snow.state.balls.length = 0;
});
await page.waitForTimeout(200);

// ---------- 2. throw + pack: long hold, then pack ----------
{
  await page.evaluate((id) => {
    const k = window.__snow.state.kids.find((x) => x.id === id);
    k.packT = 0;
    k.state = "idle";
    k.cooldown = 0;
  }, rid);
  const start = await kidWorld(rid);
  const p = await cssOf(start.x, start.y);
  const rec = recordWorld(join(TMP, "throw"), 24, 85, async (i) => {
    const k = await kidWorld(rid);
    return { x: k.x - 70, y: k.y, zoom: 1.22, finger: i < 14, fx: k.x + 20, fy: k.y + 24 };
  });
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(1150); // long hold → max range ring
  await page.mouse.up();
  await rec;
  compose(join(TMP, "throw", "meta.json"), join(OUT, "throw.gif"), 12);
}

await page.evaluate(() => {
  window.__snow.state.balls.length = 0;
});

// ---------- 3. brawl: first hit (hurt) then bury ----------
{
  await page.evaluate((ids) => {
    const g = window.__snow;
    const red = g.state.kids.find((k) => k.id === ids.rid);
    const green = g.state.kids.find((k) => k.id === ids.gid);
    for (const k of g.state.kids) {
      if (k.id !== red.id && k.id !== green.id) {
        k.x = 30;
        k.y = 30;
      }
    }
    green.stun = 0;
    green.x = red.x - 120;
    green.y = red.y;
    green.hp = 2;
    green.maxHp = 2;
    green.state = "idle";
    green.flash = 0;
    red.state = "idle";
    red.hp = 2;
  }, { rid, gid });
  const rec = recordWorld(join(TMP, "brawl"), 16, 90, async () => {
    const a = await kidWorld(rid);
    const b = await kidWorld(gid);
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, zoom: 1.4 };
  });
  await page.waitForTimeout(120);
  await page.evaluate((id) => {
    const k = window.__snow.state.kids.find((x) => x.id === id);
    k.hp = 1;
    k.state = "hurt";
    k.stateT = 0.42;
    k.flash = 0.25;
    k.stun = 0.3;
  }, gid);
  await page.waitForTimeout(700);
  await page.evaluate((id) => {
    const k = window.__snow.state.kids.find((x) => x.id === id);
    k.hp = 0;
    k.state = "buried";
    k.stateT = 0;
    k.flash = 0.2;
  }, gid);
  await rec;
  compose(join(TMP, "brawl", "meta.json"), join(OUT, "brawl.gif"), 11);
}

// ---------- 4. big snowball: field orb then in-use HUD ----------
{
  await page.evaluate((ids) => {
    const g = window.__snow;
    g.state.balls.length = 0;
    const red = g.state.kids.find((k) => k.id === ids.rid);
    red.x = 560;
    red.y = 300;
    g.tapScoreHud();
    g.tapScoreHud();
    if (g.state.pickup) {
      g.state.pickup.x = 480;
      g.state.pickup.y = 300;
    }
    g.emit();
  }, { rid, gid });
  await page.waitForTimeout(250);
  rmSync(join(TMP, "big"), { recursive: true, force: true });
  mkdirSync(join(TMP, "big"), { recursive: true });
  const bigFrames = [];
  for (let i = 0; i < 8; i++) {
    const buf = await page.screenshot({ type: "png", clip: { x: 240, y: 160, width: 480, height: 270 } });
    writeFileSync(join(TMP, "big", `${String(i + 1).padStart(3, "0")}.png`), buf);
    bigFrames.push({ x: 480, y: 300, zoom: 1 });
    await page.waitForTimeout(110);
  }
  await page.evaluate(() => {
    window.__snow.tryClaimPickup();
  });
  await page.waitForTimeout(200);
  for (let i = 8; i < 16; i++) {
    const buf = await page.screenshot({ type: "png", clip: { x: 240, y: 220, width: 480, height: 270 } });
    writeFileSync(join(TMP, "big", `${String(i + 1).padStart(3, "0")}.png`), buf);
    await page.waitForTimeout(120);
  }
  // already 480x270 page clips — copy as RGB gif
  spawnSync(
    "ffmpeg",
    [
      "-y",
      "-framerate",
      "9",
      "-i",
      join(TMP, "big", "%03d.png"),
      "-vf",
      "scale=480:270:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=full[p];[s1][p]paletteuse=dither=bayer",
      "-loop",
      "0",
      join(OUT, "big-snowball.gif"),
    ],
    { encoding: "utf8" },
  );
  console.log("big-snowball.gif");
}

// ---------- 5. victory: modal contained in 16:9 ----------
{
  await page.evaluate(() => {
    const g = window.__snow;
    g.versusResult = "win";
    g.screen = "gameover";
    g.outcomeHandled = true;
    g.emit();
  });
  await page.waitForTimeout(450);
  const card = page.locator("div.fixed.z-\\[60\\] div.rounded-xl").first();
  await card.waitFor({ state: "visible", timeout: 8000 });
  rmSync(join(TMP, "win"), { recursive: true, force: true });
  mkdirSync(join(TMP, "win"), { recursive: true });
  const frames = [];
  for (let i = 0; i < 8; i++) {
    const buf = await card.screenshot({ type: "png" });
    writeFileSync(join(TMP, "win", `${String(i + 1).padStart(3, "0")}.png`), buf);
    frames.push({ x: 480, y: 270 });
    await page.waitForTimeout(140);
  }
  writeFileSync(join(TMP, "win", "meta.json"), JSON.stringify({ dir: join(TMP, "win"), mode: "contain", frames }));
  compose(join(TMP, "win", "meta.json"), join(OUT, "victory.gif"), 7);
}

await browser.close();
if (!existsSync(join(OUT, "victory.gif"))) process.exit(1);
console.log("done", OUT);
