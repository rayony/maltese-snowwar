import { BALL_RADIUS, BIG_BALL_RADIUS, holdPower, isCompactPlay, MARGIN, PACK_TIME, PVP_RANGE, STAR_PACK_TIME, throwRange, WORLD_H, WORLD_W } from "./constants";
import { readLang, tr } from "./i18n";
import type { Assets } from "./assets";
import { aimFromKid, clamp, inFort, isOut } from "./sim";
import type { Fort, GameState, Grab, Kid, Snowball, View } from "./types";

let field: HTMLCanvasElement | null = null;

function snowField() {
  if (field) return field;
  const c = document.createElement("canvas");
  c.width = WORLD_W;
  c.height = WORLD_H;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  g.addColorStop(0, "#eaf2f7");
  g.addColorStop(0.55, "#dce8f0");
  g.addColorStop(1, "#c9d8e4");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  for (let i = 0; i < 5200; i++) {
    const x = Math.random() * WORLD_W;
    const y = Math.random() * WORLD_H;
    const a = 0.04 + Math.random() * 0.1;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(150,180,200,${a})`;
    ctx.fillRect(x, y, Math.random() > 0.8 ? 2 : 1, 1);
  }
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#f7fbfd";
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.ellipse(80 + i * 160, 40 + (i % 2) * 18, 140, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  field = c;
  return c;
}

export function playLayout(
  cssW: number,
  cssH: number,
  mirror = false,
  compact = false,
) {
  const landscapePhone = compact && cssW > cssH && cssH < 520;
  let scale = Math.min(cssW / WORLD_W, cssH / WORLD_H);
  if (compact && !landscapePhone) scale *= 1.12;
  const worldWcss = WORLD_W * scale;
  const worldHcss = WORLD_H * scale;
  let ox = (cssW - worldWcss) / 2;
  const oy = (cssH - worldHcss) / 2;
  if (compact && !landscapePhone && worldWcss > cssW + 1) {
    const minOx = cssW - worldWcss;
    ox = minOx * 0.84;
  }
  return { scale, ox, oy, mirror };
}

export function worldFromClient(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  mirror = false,
) {
  const rect = canvas.getBoundingClientRect();
  const cssW = rect.width;
  const cssH = rect.height;
  const { scale, ox, oy } = playLayout(cssW, cssH, mirror, isCompactPlay(cssW));
  let x = (clientX - rect.left - ox) / scale;
  if (mirror) x = WORLD_W - x;
  return {
    x,
    y: (clientY - rect.top - oy) / scale,
  };
}

function frameOf(frames: HTMLImageElement[], t: number, fps = 7) {
  if (!frames.length) return null;
  const i = Math.floor(t * fps) % frames.length;
  return frames[i] ?? frames[0]!;
}

function kidFrame(kid: Kid, assets: Assets, star = false) {
  const set = kid.team === "red" ? assets.red : assets.green;
  const idle = set.idle[0] ?? null;
  if (kid.state === "buried") return set.buried ?? idle;
  if (kid.state === "throw") {
    const i = Math.min(3, Math.floor((1 - kid.stateT / 0.38) * 4));
    return set.throw[i] ?? set.throw[0] ?? idle;
  }
  if (kid.state === "hurt") {
    const i = Math.min(3, Math.floor((1 - kid.stateT / 0.42) * 4));
    return set.hurt[i] ?? set.hurt[0] ?? idle;
  }
  if (kid.ai?.phase === "windup" && kid.ai.charge > 0.35 && set.throw[0]) {
    return set.throw[0] ?? idle;
  }
  if (kid.moving && set.walk.length) {
    return frameOf(set.walk, kid.animT, 8) ?? idle;
  }
  if ((kid.state === "pack" || kid.packT > 0) && set.pack.length) {
    const packMax = star && kid.team === "red" ? STAR_PACK_TIME : PACK_TIME;
    const u = 1 - kid.packT / packMax;
    const i = Math.min(3, Math.max(0, Math.floor(u * 4)));
    return set.pack[i] ?? set.pack[0] ?? idle;
  }
  if (kid.fidget === "dance" && set.dance.length) {
    return frameOf(set.dance, kid.animT, 8) ?? idle;
  }
  if (kid.fidget === "wave" && set.wave.length) {
    return frameOf(set.wave, kid.animT, 7) ?? idle;
  }
  return idle;
}

type Box = { x: number; y: number; w: number; h: number; headW: number };
const boxCache = new WeakMap<HTMLImageElement, Box | null>();

function contentBox(img: HTMLImageElement): Box | null {
  const hit = boxCache.get(img);
  if (hit !== undefined) return hit;
  if (!img.complete || img.naturalWidth === 0) return null;
  try {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext("2d", { willReadFrequently: true });
    if (!g) {
      boxCache.set(img, null);
      return null;
    }
    g.drawImage(img, 0, 0);
    const data = g.getImageData(0, 0, c.width, c.height).data;
    let minX = c.width;
    let minY = c.height;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        if (data[(y * c.width + x) * 4 + 3]! > 28) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY - minY < 8) {
      boxCache.set(img, null);
      return null;
    }
    const h = maxY - minY + 1;
    const hy = minY + Math.max(4, Math.floor(h * 0.34));
    let hx0 = c.width;
    let hx1 = 0;
    for (let y = minY; y < hy; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (data[(y * c.width + x) * 4 + 3]! > 28) {
          if (x < hx0) hx0 = x;
          if (x > hx1) hx1 = x;
        }
      }
    }
    const headW = hx1 >= hx0 ? hx1 - hx0 + 1 : maxX - minX + 1;
    const box = { x: minX, y: minY, w: maxX - minX + 1, h, headW };
    boxCache.set(img, box);
    return box;
  } catch {
    boxCache.set(img, null);
    return null;
  }
}

function drawAlignedSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dest: number,
  fit: "height" | "width" = "height",
  ref: Box | null = null,
) {
  const box = contentBox(img);
  if (!box) {
    ctx.drawImage(img, -dest / 2, -dest + 16, dest, dest);
    return;
  }
  let s: number;
  if (fit === "width") {
    s = dest / Math.max(8, (ref ?? box).w);
  } else {
    const refH = Math.max(8, (ref ?? box).h);
    const refHead = Math.max(8, (ref ?? box).headW);
    const head = Math.max(8, box.headW);
    const base = dest / refH;
    s = base * (refHead / head);
    s = Math.max(base * 0.72, Math.min(base * 2.35, s));
  }
  const dw = box.w * s;
  const dh = box.h * s;
  ctx.drawImage(img, box.x, box.y, box.w, box.h, -dw / 2, -dh + 16, dw, dh);
}

export function render(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: GameState,
  assets: Assets | null,
  view: View,
) {
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const bw = Math.max(1, Math.floor(cssW * dpr));
  const bh = Math.max(1, Math.floor(cssH * dpr));
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }

  const compact = isCompactPlay(cssW);
  const { scale, ox, oy } = playLayout(cssW, cssH, view.mirror, compact);

  let shakeX = 0;
  let shakeY = 0;
  if (view.shakeEnabled && !view.reducedMotion && state.trauma > 0) {
    const mag = state.trauma * state.trauma * 9;
    shakeX = (Math.random() * 2 - 1) * mag;
    shakeY = (Math.random() * 2 - 1) * mag;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#9bb4c6";
  ctx.fillRect(0, 0, cssW, cssH);

  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (ox + shakeX), dpr * (oy + shakeY));
  ctx.save();
  if (view.mirror) {
    ctx.translate(WORLD_W, 0);
    ctx.scale(-1, 1);
  }
  ctx.beginPath();
  ctx.rect(0, 0, WORLD_W, WORLD_H);
  ctx.clip();

  ctx.drawImage(snowField(), 0, 0, WORLD_W, WORLD_H);

  for (const f of state.footprints) {
    ctx.globalAlpha = Math.max(0, f.life / 1.6) * 0.18;
    ctx.fillStyle = "#7a93a6";
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const layers: { y: number; draw: () => void }[] = [];
  for (const fort of state.forts) {
    if (fort.maxHp > 0 && fort.hp <= 0) continue;
    layers.push({
      y: fort.y - fort.ry * 0.45,
      draw: () => drawFortLayer(ctx, fort, assets, "back"),
    });
    layers.push({
      y: fort.y + fort.ry * 0.55,
      draw: () => drawFortLayer(ctx, fort, assets, "front"),
    });
  }
  for (const kid of state.kids) {
    const y = kid.viewY ?? kid.y;
    layers.push({
      y,
      draw: () => drawKid(ctx, kid, assets, view, state.forts),
    });
  }
  layers.sort((a, b) => a.y - b.y);
  for (const layer of layers) layer.draw();

  if (state.pickup) {
    drawGoldOrb(ctx, state.pickup.x, state.pickup.y, goldOrbRadius(view.ballSize), state.time, state.time * 1.2);
  }
  for (const kid of state.kids) {
    const buff = state.buffs[kid.team];
    if (!buff || isOut(kid)) continue;
    ctx.save();
    ctx.strokeStyle = "rgba(255,226,138,0.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(kid.x, kid.y - 18, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (assets) {
    for (const ball of state.balls) {
      const hop = ballHop(ball);
      if (ball.big) {
        const rad = goldOrbRadius(view.ballSize, ball.r);
        drawGoldOrb(ctx, ball.x, ball.y - hop, rad, state.time, ball.spin);
        continue;
      }
      const img = frameOf(assets.ball, ball.spin, 8);
      const s = view.ballSize;
      ctx.save();
      ctx.translate(ball.x, ball.y - hop);
      ctx.rotate(ball.spin * 0.4);
      if (img) ctx.drawImage(img, -s / 2, -s / 2, s, s);
      else {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.38, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  } else {
    ctx.fillStyle = "#fff";
    for (const ball of state.balls) {
      if (ball.big) {
        const rad = goldOrbRadius(view.ballSize, ball.r);
        drawGoldOrb(ctx, ball.x, ball.y - ballHop(ball), rad, state.time, ball.spin);
        continue;
      }
      ctx.beginPath();
      ctx.arc(ball.x, ball.y - ballHop(ball), view.ballSize * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const p of state.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    if (p.kind === "note") {
      drawNote(ctx, p.x, p.y, p.size, Math.abs(Math.floor(p.x * 3 + p.size)) % 4);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  for (const flake of state.flakes) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (view.grab && state.phase === "fight") {
    const kid = state.kids.find((k) => k.id === view.grab!.id);
    if (kid && !isOut(kid)) {
      drawThrowPreview(ctx, kid, view.grab, state.kids, state.forts, view.pvp, view.godSpeed, view.bigCharge);
    }
  }

  drawOffscreenArrows(ctx, state, view, cssW, cssH, scale, ox, oy);

  ctx.restore();

  if (state.phase === "intro") {
    const n = Math.max(1, Math.ceil(state.introT));
    const lang = readLang();
    drawCountdown(ctx, view.pvp ? tr(lang, "pvpMode") : tr(lang, "level", { n: state.level }), String(n));
  }
}

function visibleWorld(
  cssW: number,
  cssH: number,
  scale: number,
  ox: number,
  oy: number,
  mirror: boolean,
) {
  const y0 = -oy / scale;
  const y1 = (cssH - oy) / scale;
  if (!mirror) {
    return { x0: -ox / scale, x1: (cssW - ox) / scale, y0, y1 };
  }
  const a = WORLD_W + ox / scale;
  const b = WORLD_W - (cssW - ox) / scale;
  return { x0: Math.min(a, b), x1: Math.max(a, b), y0, y1 };
}

export function clampWorldToView(
  x: number,
  y: number,
  cssW: number,
  cssH: number,
  mirror: boolean,
  pad = 28,
) {
  const compact = isCompactPlay(cssW);
  const { scale, ox, oy } = playLayout(cssW, cssH, mirror, compact);
  const vis = visibleWorld(cssW, cssH, scale, ox, oy, mirror);
  const x0 = Math.max(MARGIN, vis.x0 + pad);
  const x1 = Math.min(WORLD_W - MARGIN, vis.x1 - pad);
  const y0 = Math.max(MARGIN, vis.y0 + pad);
  const y1 = Math.min(WORLD_H - MARGIN, vis.y1 - pad);
  if (x1 <= x0 || y1 <= y0) {
    return { x: clamp(x, MARGIN, WORLD_W - MARGIN), y: clamp(y, MARGIN, WORLD_H - MARGIN) };
  }
  return { x: clamp(x, x0, x1), y: clamp(y, y0, y1) };
}

function drawOffscreenArrows(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  view: View,
  cssW: number,
  cssH: number,
  scale: number,
  ox: number,
  oy: number,
) {
  const mine = view.mirror ? "green" : "red";
  const vis = visibleWorld(cssW, cssH, scale, ox, oy, view.mirror);
  const pad = 28;
  const x0 = vis.x0 + pad;
  const x1 = vis.x1 - pad;
  const y0 = vis.y0 + pad;
  const y1 = vis.y1 - pad;
  if (x1 - x0 < 40 || y1 - y0 < 40) return;
  for (const kid of state.kids) {
    if (kid.team === mine || isOut(kid)) continue;
    const x = kid.viewX ?? kid.x;
    const y = kid.viewY ?? kid.y;
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) continue;
    const cx = clamp(x, x0, x1);
    const cy = clamp(y, y0, y1);
    const ang = Math.atan2(y - cy, x - cx);
    drawEdgeArrow(ctx, cx, cy, ang, kid.team === "green" ? "#c4965a" : "#c43b3b");
  }
}

function drawEdgeArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ang: number,
  fill: string,
) {
  const len = 16;
  const w = 11;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(len, 0);
  ctx.lineTo(-len * 0.45, w);
  ctx.lineTo(-len * 0.18, 0);
  ctx.lineTo(-len * 0.45, -w);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.strokeStyle = "rgba(255,248,240,0.95)";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawCountdown(ctx: CanvasRenderingContext2D, kicker: string, n: string) {
  const lang = readLang();
  const kickerFont = lang === "ja"
    ? '600 22px "Klee One","YuKyokasho","Yu Kyokasho",sans-serif'
    : lang === "ko"
      ? '700 22px "Gaegu","Apple SD Gothic Neo","Noto Sans KR",sans-serif'
      : lang === "zh-CN"
        ? '400 22px "Ma Shan Zheng","Noto Sans SC",sans-serif'
        : lang === "zh"
          ? '600 22px "ChenYuluoyan","PingFang TC",sans-serif'
        : "600 22px Fraunces, Georgia, serif";
  const numFont = lang === "ja"
    ? '600 96px "Klee One","YuKyokasho","Yu Kyokasho",sans-serif'
    : lang === "ko"
      ? '700 96px "Gaegu","Apple SD Gothic Neo",sans-serif'
      : lang === "zh-CN"
        ? '400 96px "Ma Shan Zheng","Noto Sans SC",sans-serif'
        : lang === "zh"
          ? '700 96px "ChenYuluoyan","PingFang TC",sans-serif'
        : "700 96px Fraunces, Georgia, serif";
  ctx.save();
  ctx.fillStyle = "rgba(21,32,43,0.4)";
  ctx.fillRect(0, WORLD_H / 2 - 88, WORLD_W, 176);
  ctx.fillStyle = "rgba(244,247,250,0.85)";
  ctx.font = kickerFont;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(kicker, WORLD_W / 2, WORLD_H / 2 - 52);
  ctx.fillStyle = "#f4f7fa";
  ctx.font = numFont;
  ctx.fillText(n, WORLD_W / 2, WORLD_H / 2 + 18);
  ctx.restore();
}

function drawKid(
  ctx: CanvasRenderingContext2D,
  kid: Kid,
  assets: Assets | null,
  view: View,
  forts: Fort[],
) {
  const lifted = kid.state === "grabbed" ? 8 : 0;
  const buried = kid.state === "buried";
  const px = kid.viewX ?? kid.x;
  const py = kid.viewY ?? kid.y;
  const cover = !buried && !!inFort(px, py, forts);
  const hideFort = cover ? inFort(px, py, forts) : null;
  const duck = 0;
  const size = buried ? view.buriedSize : view.drawSize;
  ctx.save();
  ctx.translate(px, py + duck);
  ctx.fillStyle = "rgba(40,60,80,0.22)";
  ctx.beginPath();
  ctx.ellipse(0, 16, buried ? size * 0.42 : lifted ? size * 0.18 : size * 0.24, buried ? 8 : 6, 0, 0, Math.PI * 2);
  ctx.fill();

  const img = assets ? kidFrame(kid, assets, view.godSpeed) : null;
  if (img) {
    ctx.save();
    ctx.translate(0, -lifted);
    if (hideFort) {
      const crest = Math.max(-size * 0.3, hideFort.y - py - hideFort.ry * 0.22);
      ctx.beginPath();
      ctx.rect(-size, -size * 1.4, size * 2, size * 1.4 + crest);
      ctx.clip();
    }
    if (kid.team === "red" ? kid.facing === -1 : kid.facing === 1) ctx.scale(-1, 1);
    if (kid.flash > 0) ctx.filter = "brightness(2.4)";
    const set = assets ? (kid.team === "red" ? assets.red : assets.green) : null;
    const sharedIdle = assets?.red.idle[0] ?? assets?.green.idle[0] ?? set?.idle[0];
    const idleBox = !buried && sharedIdle ? contentBox(sharedIdle) : !buried && set?.idle[0] ? contentBox(set.idle[0]) : null;
    drawAlignedSprite(ctx, img, size, buried ? "width" : "height", idleBox);
    ctx.filter = "none";
    ctx.restore();
  }

  if (!isOut(kid)) drawPips(ctx, kid, cover);
  if (!cover && kid.packT > 0 && !isOut(kid) && kid.state !== "throw") {
    const packMax = view.godSpeed && kid.team === "red" ? STAR_PACK_TIME : PACK_TIME;
    drawPackMeter(ctx, kid.packT, packMax);
  }

  const hovered = view.hoverId === kid.id || view.grab?.id === kid.id;
  if (!cover && hovered && kid.team === "red" && !isOut(kid)) {
    const power = view.pvp
      ? 0.7
      : view.grab?.id === kid.id
        ? holdPower((performance.now() - view.grab.startedAt) / 1000, view.godSpeed, view.bigCharge)
        : 0;
    drawBullseye(ctx, power, view.pickRadius);
  }
  ctx.restore();
}

function fortRect(fort: Fort) {
  const w = fort.rx * 2.15;
  const h = fort.ry * 2.5;
  return { x: fort.x - w / 2, y: fort.y - h * 0.62, w, h };
}

function drawFortLayer(
  ctx: CanvasRenderingContext2D,
  fort: Fort,
  assets: Assets | null,
  layer: "back" | "front",
) {
  const r = fortRect(fort);
  if (assets) {
    const img = assets.fort;
    if (layer === "back") {
      ctx.drawImage(img, r.x, r.y, r.w, r.h);
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(fort.x, fort.y + fort.ry * 0.2, fort.rx * 1.04, fort.ry * 0.88, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, r.x, r.y, r.w, r.h);
      ctx.restore();
    }
  } else if (layer === "front") {
    ctx.fillStyle = "#eef6fb";
    ctx.beginPath();
    ctx.ellipse(fort.x, fort.y + 8, fort.rx, fort.ry * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#e4eef5";
    ctx.beginPath();
    ctx.ellipse(fort.x, fort.y, fort.rx, fort.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (layer === "front" && fort.hitFlash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.5, fort.hitFlash * 1.8);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(fort.x, fort.y + 6, fort.rx * 0.95, fort.ry * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (layer === "front" && fort.maxHp > 0 && fort.hp > 0) {
    const w = Math.max(28, fort.rx * 0.9);
    const x = fort.x - w / 2;
    const y = fort.y + fort.ry * 0.85;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "rgba(21,32,43,0.55)";
    ctx.fillRect(x, y, w, 5);
    ctx.fillStyle = "#f4f7fa";
    ctx.fillRect(x, y, w * (fort.hp / fort.maxHp), 5);
    ctx.restore();
  }
}

function drawPips(ctx: CanvasRenderingContext2D, kid: Kid, cover: boolean) {
  const n = kid.maxHp;
  const y = 22;
  const compact = n > 4;
  const w = compact ? 5 : 8;
  const gap = compact ? 2 : 4;
  const total = n * w + (n - 1) * gap;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i < kid.hp ? (kid.team === "red" ? "#c43b3b" : "#c4965a") : "rgba(21,32,43,0.18)";
    ctx.beginPath();
    ctx.roundRect(-total / 2 + i * (w + gap), y, w, 4, 2);
    ctx.fill();
  }
  if (cover) {
    ctx.fillStyle = "rgba(244,247,250,0.9)";
    ctx.strokeStyle = "rgba(21,32,43,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, y + 11, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawPackMeter(ctx: CanvasRenderingContext2D, packT: number, packMax = PACK_TIME) {
  const u = 1 - packT / Math.max(0.05, packMax);
  ctx.save();
  ctx.translate(0, -48);
  ctx.strokeStyle = "rgba(21,32,43,0.28)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#8fb4cc";
  ctx.beginPath();
  ctx.arc(0, 0, 9, -Math.PI / 2, -Math.PI / 2 + u * Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBullseye(ctx: CanvasRenderingContext2D, power: number, pick: number) {
  ctx.save();
  ctx.translate(0, -10);
  const r = Math.max(28, pick * 0.55);
  ctx.strokeStyle = "rgba(196,59,59,0.55)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(196,59,59,0.85)";
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.stroke();
  if (power > 0) {
    ctx.strokeStyle = power >= 0.98 ? "#f4f7fa" : "#c43b3b";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, r + 8, -Math.PI / 2, -Math.PI / 2 + power * Math.PI * 2, false);
    ctx.stroke();
  }
  ctx.restore();
}

function drawThrowPreview(
  ctx: CanvasRenderingContext2D,
  kid: Kid,
  grab: Grab,
  kids: Kid[],
  forts: Fort[],
  pvp: boolean,
  godSpeed = false,
  big = false,
) {
  const packing = kid.packT > 0;
  const seconds = packing ? 0 : Math.max(0, (performance.now() - grab.startedAt) / 1000 - grab.packLeft);
  const power = pvp ? 1 : holdPower(seconds, godSpeed && kid.team === "red", big);
  const range = packing ? 0 : pvp ? PVP_RANGE : throwRange(power);
  const extraX = kid.x - grab.originX + grab.vx;
  const extraY = kid.y - grab.originY + grab.vy;
  const dir = aimFromKid(kid, kids, extraX, extraY, false, godSpeed && kid.team === "red", forts);
  if (!dir.ok) return;
  const len = Math.hypot(dir.dx, dir.dy) || 1;
  const nx = dir.dx / len;
  const ny = dir.dy / len;
  const px = kid.viewX ?? kid.x;
  const py = kid.viewY ?? kid.y;
  const ex = px + nx * range;
  const ey = py + ny * range;
  ctx.save();
  ctx.strokeStyle = "rgba(21,32,43,0.45)";
  ctx.setLineDash([7, 7]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px + nx * 26, py + ny * 8);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(ex, ey, 7 + power * 5, 0, Math.PI * 2);
  ctx.strokeStyle = power >= 0.98 ? "rgba(196,59,59,0.9)" : "rgba(21,32,43,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function ballHop(ball: Snowball) {
  const u = Math.max(0, Math.min(1, ball.traveled / Math.max(1, ball.range)));
  return Math.sin(u * Math.PI) * (10 + ball.range * 0.03);
}

function goldOrbRadius(ballSize: number, r = BIG_BALL_RADIUS) {
  return ballSize * (r / BALL_RADIUS) * 0.48;
}

/** White snowball with a pulsing gold rim — field pickup and thrown big balls. */
function drawGoldOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  time: number,
  spin = 0,
) {
  const pulse = 0.94 + 0.06 * Math.sin(time * 6);
  const r = radius * pulse;
  const glow = 0.55 + 0.45 * Math.sin(time * 5);
  ctx.save();
  ctx.translate(x, y);

  ctx.shadowColor = `rgba(255, 196, 64, ${0.55 + 0.35 * glow})`;
  ctx.shadowBlur = r * 0.7;
  ctx.strokeStyle = `rgba(255, 210, 72, ${0.45 + 0.4 * glow})`;
  ctx.lineWidth = Math.max(5, r * 0.2);
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.02, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.rotate(spin * 0.25);
  const snow = ctx.createRadialGradient(-r * 0.28, -r * 0.34, r * 0.08, 0, 0, r);
  snow.addColorStop(0, "#ffffff");
  snow.addColorStop(0.42, "#f3f7fb");
  snow.addColorStop(0.82, "#d4e0ea");
  snow.addColorStop(1, "#b8c8d4");
  ctx.fillStyle = snow;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(255, 196, 48, ${0.75 + 0.25 * glow})`;
  ctx.lineWidth = Math.max(2.4, r * 0.1);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.28, -r * 0.34, r * 0.28, r * 0.16, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const NOTE_COLORS = ["#f5a3c7", "#8fd4e8", "#f0c14b", "#9dcea8"];

function drawNote(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, variant: number) {
  ctx.fillStyle = NOTE_COLORS[variant] ?? NOTE_COLORS[0]!;
  const s = size;
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.45, s * 0.3, -0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x + s * 0.32, y - s * 1.05, 1.7, s);
  ctx.beginPath();
  ctx.moveTo(x + s * 0.32 + 1.7, y - s * 1.05);
  ctx.quadraticCurveTo(x + s * 1.05, y - s * 0.75, x + s * 0.42, y - s * 0.42);
  ctx.lineTo(x + s * 0.32 + 1.7, y - s * 0.55);
  ctx.closePath();
  ctx.fill();
}
