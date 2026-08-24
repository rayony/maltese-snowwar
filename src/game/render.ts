import { holdPower, KID_RADIUS, throwRange, WORLD_H, WORLD_W } from "./constants";
import type { Assets } from "./assets";
import { aimFromKid, isOut } from "./sim";
import type { GameState, Grab, Kid, Snowball, View } from "./types";

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

export function worldFromClient(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
) {
  const rect = canvas.getBoundingClientRect();
  const cssW = rect.width;
  const cssH = rect.height;
  const scale = Math.min(cssW / WORLD_W, cssH / WORLD_H);
  const ox = (cssW - WORLD_W * scale) / 2;
  const oy = (cssH - WORLD_H * scale) / 2;
  return {
    x: (clientX - rect.left - ox) / scale,
    y: (clientY - rect.top - oy) / scale,
  };
}

function frameOf(frames: HTMLImageElement[], t: number, fps = 7) {
  if (!frames.length) return null;
  const i = Math.floor(t * fps) % frames.length;
  return frames[i] ?? frames[0]!;
}

function kidFrame(kid: Kid, assets: Assets) {
  const set = kid.team === "red" ? assets.red : assets.green;
  if (kid.state === "buried") return set.buried;
  if (kid.state === "throw") {
    const i = Math.min(3, Math.floor((1 - kid.stateT / 0.38) * 4));
    return set.throw[i] ?? set.throw[0]!;
  }
  if (kid.state === "hurt") {
    const i = Math.min(3, Math.floor((1 - kid.stateT / 0.42) * 4));
    return set.hurt[i] ?? set.hurt[0]!;
  }
  return frameOf(set.idle, kid.animT, 6) ?? set.idle[0]!;
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

  const scale = Math.min(cssW / WORLD_W, cssH / WORLD_H);
  const ox = (cssW - WORLD_W * scale) / 2;
  const oy = (cssH - WORLD_H * scale) / 2;

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

  for (const fort of state.forts) {
    if (assets) {
      const img = assets.fort;
      const w = fort.rx * 2.15;
      const h = fort.ry * 2.5;
      ctx.drawImage(img, fort.x - w / 2, fort.y - h * 0.62, w, h);
    } else {
      ctx.fillStyle = "#eef6fb";
      ctx.beginPath();
      ctx.ellipse(fort.x, fort.y, fort.rx, fort.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const drawList = [...state.kids].sort((a, b) => a.y - b.y);
  for (const kid of drawList) drawKid(ctx, kid, assets, view);

  if (assets) {
    for (const ball of state.balls) {
      const img = frameOf(assets.ball, ball.spin, 8);
      if (!img) continue;
      const hop = ballHop(ball);
      const s = 22;
      ctx.save();
      ctx.translate(ball.x, ball.y - hop);
      ctx.rotate(ball.spin * 0.4);
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.restore();
    }
  } else {
    ctx.fillStyle = "#fff";
    for (const ball of state.balls) {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y - ballHop(ball), 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const p of state.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
    ctx.fill();
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

  if (view.grab) {
    const kid = state.kids.find((k) => k.id === view.grab!.id);
    if (kid && !isOut(kid)) {
      drawThrowPreview(ctx, kid, view.grab, state.kids);
    }
  }

  if (state.phase === "intro") {
    drawBanner(ctx, `Level ${state.level}`);
  } else if (state.phase === "won") {
    drawBanner(ctx, "Clear");
  }

  ctx.restore();
}

function drawBanner(ctx: CanvasRenderingContext2D, text: string) {
  ctx.save();
  ctx.fillStyle = "rgba(21,32,43,0.45)";
  ctx.fillRect(0, WORLD_H / 2 - 44, WORLD_W, 88);
  ctx.fillStyle = "#f4f7fa";
  ctx.font = "600 42px Fraunces, Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, WORLD_W / 2, WORLD_H / 2);
  ctx.restore();
}

function drawKid(ctx: CanvasRenderingContext2D, kid: Kid, assets: Assets | null, view: View) {
  const lifted = kid.state === "grabbed" ? 8 : 0;
  ctx.save();
  ctx.translate(kid.x, kid.y);
  ctx.fillStyle = "rgba(40,60,80,0.22)";
  ctx.beginPath();
  ctx.ellipse(0, 16, lifted ? 11 : 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  const img = assets ? kidFrame(kid, assets) : null;
  const size = kid.state === "buried" ? 64 : 58;
  if (img) {
    ctx.save();
    ctx.translate(0, -lifted);
    // Maltese art faces right-of-frame by default; flip when throwing left.
    if (kid.team === "red" ? kid.facing === -1 : kid.facing === 1) ctx.scale(-1, 1);
    if (kid.flash > 0) ctx.filter = "brightness(2.4)";
    ctx.drawImage(img, -size / 2, -size + 16, size, size);
    ctx.filter = "none";
    ctx.restore();
  } else {
    ctx.translate(0, -lifted);
    ctx.fillStyle = kid.team === "red" ? "#f4f7fa" : "#d4a574";
    ctx.beginPath();
    ctx.arc(0, -6, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!isOut(kid)) drawPips(ctx, kid);

  const hovered = view.hoverId === kid.id || view.grab?.id === kid.id;
  if (hovered && kid.team === "red" && !isOut(kid)) {
    const power = view.grab?.id === kid.id ? holdPower((performance.now() - view.grab.startedAt) / 1000) : 0;
    drawBullseye(ctx, power);
  }
  ctx.restore();
}

function drawPips(ctx: CanvasRenderingContext2D, kid: Kid) {
  const n = kid.maxHp;
  const y = 22;
  const w = 8;
  const gap = 4;
  const total = n * w + (n - 1) * gap;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i < kid.hp ? (kid.team === "red" ? "#c43b3b" : "#c4965a") : "rgba(21,32,43,0.18)";
    ctx.beginPath();
    ctx.roundRect(-total / 2 + i * (w + gap), y, w, 4, 2);
    ctx.fill();
  }
}

function drawBullseye(ctx: CanvasRenderingContext2D, power: number) {
  ctx.save();
  ctx.translate(0, -10);
  ctx.strokeStyle = "rgba(196,59,59,0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, KID_RADIUS + 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.stroke();
  if (power > 0) {
    ctx.strokeStyle = power >= 0.98 ? "#f4f7fa" : "#c43b3b";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, KID_RADIUS + 16, -Math.PI / 2, -Math.PI / 2 + power * Math.PI * 2, false);
    ctx.stroke();
  }
  ctx.restore();
}

function drawThrowPreview(ctx: CanvasRenderingContext2D, kid: Kid, grab: Grab, kids: Kid[]) {
  const seconds = (performance.now() - grab.startedAt) / 1000;
  const power = holdPower(seconds);
  const range = throwRange(power);
  const dir = aimFromKid(kid, kids);
  const len = Math.hypot(dir.dx, dir.dy) || 1;
  const nx = dir.dx / len;
  const ny = dir.dy / len;
  const ex = kid.x + nx * range;
  const ey = kid.y + ny * range;
  ctx.save();
  ctx.strokeStyle = "rgba(21,32,43,0.45)";
  ctx.setLineDash([7, 7]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(kid.x + nx * 26, kid.y + ny * 8);
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
