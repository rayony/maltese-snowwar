import { stepAi } from "./ai";
import { loadAssets, type Assets } from "./assets";
import { GameAudio } from "./audio";
import {
  FIXED_DT,
  KID_RADIUS,
  MARGIN,
  SAVE_KEY,
  WORLD_H,
  WORLD_W,
} from "./constants";
import { render, worldFromClient } from "./render";
import { aimFromKid, clamp, createState, isOut, living, stepSim, throwSnowball } from "./sim";
import type { GameState, Grab, Screen, UiSnapshot, View } from "./types";

export class SnowCraftGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onUi: (s: UiSnapshot) => void;
  private audio = new GameAudio();
  private assets: Assets | null = null;
  private state: GameState = createState(1);
  private screen: Screen = "title";
  private grab: Grab | null = null;
  private pointer: { x: number; y: number } | null = null;
  private hoverId: number | null = null;
  private raf = 0;
  private acc = 0;
  private last = 0;
  private best = 0;
  private shakeEnabled = true;
  private reducedMotion = false;
  private destroyed = false;
  private outcomeHandled = false;
  private loaded = false;

  constructor(canvas: HTMLCanvasElement, onUi: (s: UiSnapshot) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.onUi = onUi;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { best?: number };
        if (parsed.best) this.best = parsed.best;
      }
    } catch {
      /* ignore */
    }
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.bind();
    this.emit();
  }

  async start() {
    try {
      this.assets = await loadAssets();
    } catch (err) {
      console.warn("Sprites failed to load, using fallbacks", err);
    }
    this.loaded = true;
    this.emit();
    this.last = performance.now() / 1000;
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.unbind();
    this.audio.stopMusic();
  }

  play() {
    this.audio.unlock();
    this.audio.startMusic();
    this.screen = "playing";
    this.startLevel(1);
  }

  pause() {
    if (this.screen !== "playing") return;
    this.screen = "paused";
    this.emit();
  }

  resume() {
    if (this.screen !== "paused") return;
    this.screen = "playing";
    this.emit();
  }

  retry() {
    this.audio.unlock();
    this.screen = "playing";
    this.startLevel(1);
  }

  nextLevel() {
    this.startLevel(this.state.level + 1);
  }

  setMuted(v: boolean) {
    this.audio.unlock();
    this.audio.setMuted(v);
    this.emit();
  }

  toggleMute() {
    this.setMuted(!this.audio.muted);
  }

  private startLevel(level: number) {
    this.state = createState(level);
    this.grab = null;
    this.outcomeHandled = false;
    this.audio.level();
    if (level > this.best) {
      this.best = level;
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ best: this.best }));
      } catch {
        /* ignore */
      }
    }
    this.emit();
  }

  private bind() {
    const c = this.canvas;
    c.addEventListener("pointerdown", this.onDown);
    c.addEventListener("pointermove", this.onMove);
    c.addEventListener("pointerup", this.onUp);
    c.addEventListener("pointercancel", this.onUp);
    c.addEventListener("contextmenu", this.onMenu);
    window.addEventListener("keydown", this.onKey);
    document.addEventListener("visibilitychange", this.onVis);
  }

  private unbind() {
    const c = this.canvas;
    c.removeEventListener("pointerdown", this.onDown);
    c.removeEventListener("pointermove", this.onMove);
    c.removeEventListener("pointerup", this.onUp);
    c.removeEventListener("pointercancel", this.onUp);
    c.removeEventListener("contextmenu", this.onMenu);
    window.removeEventListener("keydown", this.onKey);
    document.removeEventListener("visibilitychange", this.onVis);
  }

  private onMenu = (e: Event) => e.preventDefault();

  private onVis = () => {
    if (document.visibilityState === "visible") this.audio.unlock();
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.code === "Escape" || e.code === "KeyP") {
      if (this.screen === "playing") this.pause();
      else if (this.screen === "paused") this.resume();
    }
    if (e.code === "KeyM") this.toggleMute();
  };

  private toWorld(e: PointerEvent) {
    return worldFromClient(this.canvas, e.clientX, e.clientY);
  }

  private onDown = (e: PointerEvent) => {
    this.audio.unlock();
    if (this.screen !== "playing" || this.state.phase !== "fight") return;
    if (this.grab) return;
    const w = this.toWorld(e);
    const kid = this.pickRed(w.x, w.y);
    if (!kid) return;
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.grab = {
      id: kid.id,
      pointerId: e.pointerId,
      startedAt: performance.now(),
      lastX: w.x,
      lastY: w.y,
      vx: 0,
      vy: 0,
    };
    kid.state = "grabbed";
    this.audio.grab();
  };

  private onMove = (e: PointerEvent) => {
    const w = this.toWorld(e);
    this.pointer = w;
    this.hoverId = this.pickRed(w.x, w.y)?.id ?? null;
    if (!this.grab || e.pointerId !== this.grab.pointerId) return;
    const kid = this.state.kids.find((k) => k.id === this.grab!.id);
    if (!kid || isOut(kid)) return;
    this.grab.vx = w.x - kid.x;
    this.grab.vy = w.y - kid.y;
    kid.x = clamp(w.x, MARGIN, WORLD_W - MARGIN);
    kid.y = clamp(w.y, MARGIN, WORLD_H - MARGIN);
    this.grab.lastX = w.x;
    this.grab.lastY = w.y;
  };

  private onUp = (e: PointerEvent) => {
    if (!this.grab || e.pointerId !== this.grab.pointerId) return;
    this.releaseThrow();
  };

  private pickRed(x: number, y: number) {
    let best: (typeof this.state.kids)[number] | null = null;
    let bestD = KID_RADIUS + 18;
    for (const kid of this.state.kids) {
      if (kid.team !== "red" || isOut(kid)) continue;
      const d = Math.hypot(kid.x - x, kid.y - y);
      if (d < bestD) {
        bestD = d;
        best = kid;
      }
    }
    return best;
  }

  private releaseThrow() {
    const grab = this.grab;
    this.grab = null;
    if (!grab) return;
    const kid = this.state.kids.find((k) => k.id === grab.id);
    if (!kid || isOut(kid) || this.state.phase !== "fight") {
      if (kid && kid.state === "grabbed") kid.state = "idle";
      return;
    }
    const seconds = (performance.now() - grab.startedAt) / 1000;
    const { dx, dy } = aimFromKid(kid, this.state.kids, grab.vx, grab.vy);
    const power = throwSnowball(this.state, kid, seconds, dx, dy);
    this.audio.throw(power);
  }

  private loop = (nowMs: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = nowMs / 1000;
    let dt = this.last ? now - this.last : 0;
    this.last = now;
    dt = Math.min(dt, 0.1);

    if (this.screen !== "paused" && this.screen !== "title") {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= FIXED_DT && steps < 5) {
        this.step(FIXED_DT);
        this.acc -= FIXED_DT;
        steps++;
      }
    } else if (this.screen === "title") {
      this.state.time += dt;
      for (const flake of this.state.flakes) {
        flake.y += flake.vy * dt * 0.6;
        if (flake.y > WORLD_H) {
          flake.y = -4;
          flake.x = Math.random() * WORLD_W;
        }
      }
    }

    this.audio.tick(dt);
    this.draw();
  };

  private step(dt: number) {
    stepAi(this.state, dt, (power) => this.audio.throw(power));
    stepSim(this.state, dt, (heavy) => {
      if (heavy) this.audio.bury();
      else {
        this.audio.hit();
        this.audio.splat();
      }
      this.emit();
    });
    if (!this.outcomeHandled && this.state.phase === "won") {
      this.outcomeHandled = true;
      this.audio.win();
      window.setTimeout(() => {
        if (this.destroyed || this.screen !== "playing") return;
        this.startLevel(this.state.level + 1);
      }, 1100);
    }
    if (!this.outcomeHandled && this.state.phase === "lost") {
      this.outcomeHandled = true;
      this.audio.lose();
      this.screen = "gameover";
      this.emit();
    }
  }

  private draw() {
    const view: View = {
      grab: this.grab,
      pointer: this.pointer,
      hoverId: this.hoverId,
      shakeEnabled: this.shakeEnabled,
      reducedMotion: this.reducedMotion,
    };
    render(this.ctx, this.canvas, this.state, this.assets, view);
  }

  private emit() {
    this.onUi({
      screen: this.screen,
      level: this.state.level,
      best: this.best,
      redAlive: living(this.state.kids, "red").length,
      greenAlive: living(this.state.kids, "green").length,
      greenTotal: this.state.kids.filter((k) => k.team === "green").length,
      muted: this.audio.muted,
      ready: this.loaded,
    });
  }
}
