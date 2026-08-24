import { type RoomPeer } from "./room-channel";
import { VersusLink } from "./versus-link";
import { stepAi, type GreenControl } from "./ai";
import { loadAssets, type Assets } from "./assets";
import { GameAudio } from "./audio";
import { FIXED_DT, MARGIN, playFeel, SAVE_KEY, WORLD_H, WORLD_W } from "./constants";
import {
  applyState,
  makeRoomCode,
  normalizeCode,
  packState,
  roomIdFromCode,
  type NetMsg,
} from "./net";
import { render, worldFromClient } from "./render";
import { aimFromKid, clamp, createState, isOut, living, stepSim, throwSnowball } from "./sim";
import type {
  AllyMode,
  GameState,
  Grab,
  Kid,
  NetRole,
  NetStatus,
  Screen,
  Team,
  UiSnapshot,
  View,
} from "./types";

export class SnowCraftGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onUi: (s: UiSnapshot) => void;
  private audio = new GameAudio();
  private assets: Assets | null = null;
  private state: GameState = createState(1);
  private screen: Screen = "title";
  private grab: Grab | null = null;
  private grabGuest: Grab | null = null;
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
  private allyMode: AllyMode = "off";
  private guestAlly: AllyMode = "off";

  private netRole: NetRole = "solo";
  private netStatus: NetStatus = "off";
  private netCode: string | null = null;
  private netError: string | null = null;
  private p2p: VersusLink | null = null;
  private rematchMine = false;
  private rematchTheirs = false;
  private versusResult: "win" | "lose" | null = null;
  private botTakeover = false;
  private matchStarted = false;
  private snapAcc = 0;
  private disconnectAt = 0;
  private netRtt: number | null = null;
  private versus = false;
  private seat: Team = "red";
  private lastPeerAt = 0;
  private lobbyAt = 0;
  private hbAcc = 0;
  private lastMoveSend = 0;
  private keepBallsUntil = 0;

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
    this.closeNet();
  }

  play() {
    this.closeNet();
    this.versus = false;
    this.audio.unlock();
    this.audio.startMusic();
    this.screen = "playing";
    this.startLevel(1, false);
  }

  async createVersus() {
    this.audio.unlock();
    this.closeNet();
    const code = makeRoomCode();
    this.netCode = code;
    this.netRole = "host";
    this.seat = "red";
    this.netStatus = "waiting";
    this.netError = null;
    this.versus = true;
    this.botTakeover = false;
    this.matchStarted = false;
    this.lastPeerAt = 0;
    this.lobbyAt = performance.now();
    this.screen = "lobby";
    this.p2p = this.openLink(code, "host", "Maltese");
    this.emit();
    try {
      await this.p2p.join();
    } catch {
      this.netError = "Could not open the room. Try again.";
    }
    this.emit();
  }

  async joinVersus(raw: string) {
    this.audio.unlock();
    const code = normalizeCode(raw);
    if (code.length !== 6) {
      this.netError = "Enter a 6-letter code.";
      this.emit();
      return;
    }
    this.closeNet();
    this.netCode = code;
    this.netRole = "guest";
    this.seat = "green";
    this.netStatus = "connecting";
    this.netError = null;
    this.versus = true;
    this.botTakeover = false;
    this.matchStarted = false;
    this.lastPeerAt = 0;
    this.lobbyAt = performance.now();
    this.screen = "lobby";
    this.p2p = this.openLink(code, "guest", "Retriever");
    this.emit();
    try {
      await this.p2p.join();
    } catch {
      this.netError = "Could not reach the room.";
    }
    this.emit();
  }

  cancelLobby() {
    this.closeNet();
    this.screen = "title";
    this.emit();
  }

  leaveRoom() {
    this.sendNet({ t: "bye" });
    this.closeNet();
    this.screen = "title";
    this.versus = false;
    this.emit();
  }

  takeBot() {
    this.sendNet({ t: "bot" });
    this.botTakeover = true;
    this.netStatus = "live";
    this.disconnectAt = 0;
    this.p2p?.close();
    this.p2p = null;
    this.netRole = "solo";
    if (this.screen !== "gameover") this.screen = "playing";
    this.emit();
  }

  waitForFriend() {
    this.netStatus = "connecting";
    this.disconnectAt = performance.now();
    this.emit();
  }

  pause() {
    if (this.screen !== "playing") return;
    if (this.versus && this.netStatus === "live" && !this.botTakeover) return;
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
    if (this.versus && this.p2p && !this.botTakeover) {
      this.voteRematch(true);
      return;
    }
    this.screen = "playing";
    this.startLevel(1, this.versus);
  }

  voteRematch(yes: boolean) {
    this.rematchMine = yes;
    this.sendNet({ t: "rematch", yes });
    if (!yes) {
      this.leaveRoom();
      return;
    }
    this.netStatus = "rematch";
    this.tryRematch();
    this.emit();
  }

  nextLevel() {
    this.startLevel(this.state.level + 1, this.versus);
  }

  setMuted(v: boolean) {
    this.audio.unlock();
    this.audio.setMuted(v);
    this.emit();
  }

  toggleMute() {
    this.setMuted(!this.audio.muted);
  }

  setAllyMode(mode: AllyMode) {
    this.allyMode = mode;
    if (this.netRole === "guest") this.sendNet({ t: "ally", mode });
    this.emit();
  }

  cycleAllyMode() {
    this.allyMode = this.allyMode === "off" ? "defend" : this.allyMode === "defend" ? "attack" : "off";
    this.setAllyMode(this.allyMode);
  }

  myTeam(): Team {
    return this.seat;
  }

  private startLevel(level: number, versus = this.versus) {
    this.versus = versus;
    this.state = createState(level, versus);
    this.grab = null;
    this.grabGuest = null;
    this.outcomeHandled = false;
    this.versusResult = null;
    this.rematchMine = false;
    this.rematchTheirs = false;
    this.audio.level();
    if (!versus && level > this.best) {
      this.best = level;
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ best: this.best }));
      } catch {
        /* ignore */
      }
    }
    this.emit();
  }

  private beginVersus() {
    if (this.matchStarted) return;
    this.matchStarted = true;
    this.netStatus = "live";
    this.botTakeover = false;
    this.p2p?.setFast(true);
    this.audio.startMusic();
    this.screen = "playing";
    this.startLevel(1, true);
    this.sendNet({ t: "start" });
    this.sendSnap();
  }

  private tryRematch() {
    if (!this.rematchMine || !this.rematchTheirs) return;
    if (this.netRole === "host") {
      this.netStatus = "live";
      this.screen = "playing";
      this.startLevel(1, true);
      this.sendNet({ t: "start" });
      this.sendSnap();
    }
  }

  private closeNet(reset = true) {
    this.p2p?.close();
    this.p2p = null;
    if (!reset) return;
    this.netRole = "solo";
    this.netStatus = "off";
    this.netCode = null;
    this.netError = null;
    this.matchStarted = false;
    this.botTakeover = false;
    this.rematchMine = false;
    this.rematchTheirs = false;
    this.guestAlly = "off";
    this.grabGuest = null;
    this.seat = "red";
  }

  private sendNet(msg: NetMsg) {
    this.p2p?.send(msg, "event");
  }

  private sendSnap() {
    if (this.netRole !== "host" || !this.p2p) return;
    this.p2p.send({ t: "snap", s: packState(this.state) }, "snap");
  }

  private openLink(code: string, role: "host" | "guest", name: string) {
    const prefix = role === "host" ? "h" : "g";
    return new VersusLink({
      room: roomIdFromCode(code),
      selfId: `${prefix}${Math.random().toString(36).slice(2, 10)}`,
      name,
      onPeers: (peers) => this.onPeers(peers),
      onMessage: (msg) => this.onNet(msg),
      onError: (message) => {
        this.netError = message;
        this.emit();
      },
      onRtc: () => this.emit(),
    });
  }

  private onPeers(peers: RoomPeer[]) {
    if (this.destroyed) return;
    if (peers.length > 0) {
      this.lastPeerAt = performance.now();
      this.disconnectAt = 0;
      this.netError = null;
    }
    if (this.netRole === "host" && !this.matchStarted && peers.length > 0) {
      this.beginVersus();
    }
    if (this.matchStarted && this.netStatus === "connecting" && peers.length > 0 && !this.botTakeover) {
      this.netStatus = "live";
      if (this.screen !== "gameover") this.screen = "playing";
    }
    this.emit();
  }

  private onNet(data: NetMsg) {
    switch (data.t) {
      case "start":
        if (this.netRole === "guest") {
          this.matchStarted = true;
          this.netStatus = "live";
          this.screen = "playing";
          this.audio.startMusic();
          this.versus = true;
        }
        break;
      case "snap":
        if (this.netRole === "guest" && !this.botTakeover) {
          this.lastPeerAt = performance.now();
          this.p2p?.setFast(true);
          if (!this.matchStarted) {
            this.matchStarted = true;
            this.netStatus = "live";
            this.screen = "playing";
            this.audio.startMusic();
            this.versus = true;
          }
          applyState(this.state, data.s, {
            grabId: this.grab?.id ?? null,
            keepTeam: this.seat,
            keepBallsUntil: this.keepBallsUntil,
          });
          this.maybeOutcomeFromSnap();
        }
        break;
      case "input":
        if (this.netRole === "host") this.applyGuestInput(data);
        break;
      case "ally":
        this.guestAlly = data.mode;
        break;
      case "rematch":
        this.rematchTheirs = data.yes;
        if (!data.yes) {
          this.netError = "Friend left the rematch.";
        }
        this.tryRematch();
        break;
      case "bye":
      case "bot":
        if (!this.botTakeover && this.matchStarted) this.enterDisconnect();
        break;
      case "hb":
        this.lastPeerAt = performance.now();
        break;
      default:
        break;
    }
    this.emit();
  }

  private applyGuestInput(msg: Extract<NetMsg, { t: "input" }>) {
    if (this.botTakeover) return;
    if (msg.kind === "down") {
      if (this.grabGuest) return;
      const kid = this.pickTeam("green", msg.x, msg.y);
      if (!kid) return;
      this.grabGuest = {
        id: kid.id,
        pointerId: -1,
        startedAt: performance.now(),
        lastX: msg.x,
        lastY: msg.y,
        vx: 0,
        vy: 0,
        packLeft: kid.packT,
      };
      kid.state = "grabbed";
      this.audio.grab();
      return;
    }
    if (!this.grabGuest) return;
    const kid = this.state.kids.find((k) => k.id === this.grabGuest!.id);
    if (!kid || isOut(kid)) {
      this.grabGuest = null;
      return;
    }
    if (msg.kind === "move") {
      this.grabGuest.vx = msg.x - kid.x;
      this.grabGuest.vy = msg.y - kid.y;
      kid.x = clamp(msg.x, MARGIN, WORLD_W - MARGIN);
      kid.y = clamp(msg.y, MARGIN, WORLD_H - MARGIN);
      this.grabGuest.lastX = msg.x;
      this.grabGuest.lastY = msg.y;
      return;
    }
    const grab = this.grabGuest;
    this.grabGuest = null;
    if (this.state.phase !== "fight") {
      kid.state = kid.packT > 0 ? "pack" : "idle";
      return;
    }
    if (kid.packT > 0) {
      kid.state = "pack";
      return;
    }
    const seconds =
      typeof msg.hold === "number"
        ? Math.max(0, msg.hold)
        : Math.max(0, (performance.now() - grab.startedAt) / 1000 - grab.packLeft);
    const aimVx = msg.vx ?? grab.vx;
    const aimVy = msg.vy ?? grab.vy;
    const { dx, dy } = aimFromKid(kid, this.state.kids, aimVx, aimVy);
    const power = throwSnowball(this.state, kid, seconds, dx, dy);
    this.audio.throw(power);
  }

  private enterDisconnect() {
    if (this.botTakeover) return;
    this.netStatus = "disconnect";
    this.grab = null;
    this.grabGuest = null;
    this.emit();
  }

  private maybeOutcomeFromSnap() {
    if (this.outcomeHandled || this.state.phase === "fight" || this.state.phase === "intro") return;
    this.handleOutcome();
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
    if (this.netStatus === "disconnect") return;
    if (this.grab) return;
    const w = this.toWorld(e);
    const kid = this.pickTeam(this.myTeam(), w.x, w.y);
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
      packLeft: kid.packT,
    };
    kid.state = "grabbed";
    this.audio.grab();
    if (this.netRole === "guest") this.sendNet({ t: "input", kind: "down", x: w.x, y: w.y });
  };

  private onMove = (e: PointerEvent) => {
    const w = this.toWorld(e);
    this.pointer = w;
    this.hoverId = this.pickTeam(this.myTeam(), w.x, w.y)?.id ?? null;
    if (!this.grab || e.pointerId !== this.grab.pointerId) return;
    const kid = this.state.kids.find((k) => k.id === this.grab!.id);
    if (!kid || isOut(kid)) return;
    this.grab.vx = w.x - kid.x;
    this.grab.vy = w.y - kid.y;
    kid.x = clamp(w.x, MARGIN, WORLD_W - MARGIN);
    kid.y = clamp(w.y, MARGIN, WORLD_H - MARGIN);
    this.grab.lastX = w.x;
    this.grab.lastY = w.y;
    if (this.netRole === "guest") {
      const t = performance.now();
      const gap = this.p2p?.rtcOpen ? 20 : 40;
      if (t - this.lastMoveSend > gap) {
        this.lastMoveSend = t;
        this.sendNet({ t: "input", kind: "move", x: w.x, y: w.y });
      }
    }
  };

  private onUp = (e: PointerEvent) => {
    if (!this.grab || e.pointerId !== this.grab.pointerId) return;
    if (this.netRole === "guest") {
      const grab = this.grab;
      const hold = Math.max(0, (performance.now() - grab.startedAt) / 1000 - grab.packLeft);
      this.sendNet({
        t: "input",
        kind: "up",
        x: grab.lastX,
        y: grab.lastY,
        hold,
        vx: grab.vx,
        vy: grab.vy,
      });
      this.keepBallsUntil = performance.now() + 220;
    }
    this.releaseThrow();
  };

  private pickTeam(team: Team, x: number, y: number): Kid | null {
    const pick = playFeel(this.canvas.clientWidth).pick;
    let best: Kid | null = null;
    let bestD = pick;
    for (const kid of this.state.kids) {
      if (kid.team !== team || isOut(kid)) continue;
      const d = Math.hypot(kid.x - x, kid.y - 12 - y);
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
      if (kid && kid.state === "grabbed") kid.state = kid.packT > 0 ? "pack" : "idle";
      return;
    }
    if (kid.packT > 0) {
      kid.state = "pack";
      return;
    }
    const seconds = Math.max(0, (performance.now() - grab.startedAt) / 1000 - grab.packLeft);
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

    if (this.p2p && !this.botTakeover && this.netStatus !== "off") {
      this.hbAcc += dt;
      if (this.hbAcc >= 1) {
        this.hbAcc = 0;
        this.sendNet({ t: "hb" });
      }
      if (this.screen === "lobby" && this.netRole === "guest" && !this.matchStarted && this.lobbyAt) {
        if (performance.now() - this.lobbyAt > 10000 && this.lastPeerAt === 0 && !this.netError) {
          this.netError = "No host with that code. Open the same game page as your friend, then join again.";
          this.emit();
        }
      }
      if (this.matchStarted && this.netStatus === "live" && this.lastPeerAt) {
        if (performance.now() - this.lastPeerAt > 4500) this.enterDisconnect();
      }
    }

    const netHold =
      this.netStatus === "disconnect" ||
      this.netStatus === "rematch" ||
      (this.netStatus === "connecting" && this.matchStarted && !this.botTakeover);

    const paused =
      this.screen === "paused" ||
      this.screen === "title" ||
      this.screen === "lobby" ||
      netHold;

    if (!paused && this.screen !== "gameover") {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= FIXED_DT && steps < 5) {
        this.step(FIXED_DT);
        this.acc -= FIXED_DT;
        steps++;
      }
    } else if (this.screen === "title" || this.screen === "lobby") {
      this.state.time += dt;
      for (const flake of this.state.flakes) {
        flake.y += flake.vy * dt * 0.6;
        if (flake.y > WORLD_H) {
          flake.y = -4;
          flake.x = Math.random() * WORLD_W;
        }
      }
    }

    if (this.netRole === "host" && this.netStatus === "live" && this.screen === "playing") {
      this.snapAcc += dt;
      const interval = this.p2p?.rtcOpen ? 0.05 : 0.08;
      if (this.snapAcc >= interval) {
        this.snapAcc = 0;
        this.sendSnap();
      }
    }

    this.audio.tick(dt);
    this.draw();
  };

  private greenControl(): GreenControl {
    if (!this.versus) return "enemy";
    if (this.botTakeover) {
      if (this.seat === "red") return "enemy";
      return this.allyMode;
    }
    if (this.netRole === "host") return this.guestAlly;
    return "off";
  }

  private step(dt: number) {
    const guestView = this.netRole === "guest" && !this.botTakeover;
    if (guestView) {
      const phase = this.state.phase;
      stepSim(
        this.state,
        dt,
        (heavy) => {
          if (heavy) this.audio.bury();
          else {
            this.audio.hit();
            this.audio.splat();
          }
        },
        {
          onClash: () => this.audio.clash(),
          onFort: () => this.audio.fort(),
        },
      );
      if (phase === "fight" && (this.state.phase === "won" || this.state.phase === "lost")) {
        this.state.phase = phase;
      }
      return;
    }

    const redMode = this.botTakeover && this.seat === "green" ? "attack" : this.allyMode;
    stepAi(this.state, dt, (power) => this.audio.throw(power), redMode, this.greenControl());
    stepSim(
      this.state,
      dt,
      (heavy) => {
        if (heavy) this.audio.bury();
        else {
          this.audio.hit();
          this.audio.splat();
        }
        this.emit();
      },
      {
        onClash: () => this.audio.clash(),
        onFort: () => this.audio.fort(),
      },
    );
    this.handleOutcome();
  }

  private handleOutcome() {
    if (this.outcomeHandled) return;
    if (this.state.phase === "won") {
      this.outcomeHandled = true;
      this.audio.win();
      if (this.versus) {
        this.versusResult = this.myTeam() === "red" ? "win" : "lose";
        this.screen = "gameover";
        this.netStatus = this.p2p && !this.botTakeover ? "rematch" : this.netStatus;
        this.emit();
        return;
      }
      window.setTimeout(() => {
        if (this.destroyed || this.screen !== "playing") return;
        this.startLevel(this.state.level + 1, false);
      }, 1100);
    }
    if (this.state.phase === "lost") {
      this.outcomeHandled = true;
      this.audio.lose();
      this.versusResult = this.versus ? (this.myTeam() === "red" ? "lose" : "win") : "lose";
      this.screen = "gameover";
      if (this.versus && this.p2p && !this.botTakeover) this.netStatus = "rematch";
      this.emit();
    }
  }

  private draw() {
    const feel = playFeel(this.canvas.clientWidth);
    const view: View = {
      grab: this.grab,
      pointer: this.pointer,
      hoverId: this.hoverId,
      shakeEnabled: this.shakeEnabled,
      reducedMotion: this.reducedMotion,
      drawSize: feel.draw,
      buriedSize: feel.buried,
      pickRadius: feel.pick,
      ballSize: feel.ball,
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
      allyMode: this.allyMode,
      net: {
        role: this.netRole,
        status: this.netStatus,
        code: this.netCode,
        team: this.myTeam(),
        error: this.netError,
        rematchMine: this.rematchMine,
        rematchTheirs: this.rematchTheirs,
        result: this.versusResult,
        rttMs: this.p2p?.rttMs ?? this.netRtt,
        link: this.p2p?.rtcOpen ? "direct" : "relay",
      },
    });
  }
}
