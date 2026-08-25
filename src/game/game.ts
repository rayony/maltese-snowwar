import { type RoomPeer } from "./room-channel";
import { VersusLink } from "./versus-link";
import { stepAi, type GreenControl } from "./ai";
import { ASSET_TOTAL, loadCoreAssets, loadRestAssets, type Assets } from "./assets";
import { GameAudio } from "./audio";
import { FORT_HP, FIXED_DT, MARGIN, playFeel, SAVE_KEY, WORLD_H, WORLD_W } from "./constants";
import {
  applyState,
  makeRoomCode,
  normalizeCode,
  packState,
  roomIdFromCode,
  type NetMsg,
} from "./net";
import { render, worldFromClient } from "./render";
import { aimFromKid, burst, clamp, createState, isOut, living, puffMissingBalls, snapCombatFx, stepPresentation, stepSim, throwSnowball } from "./sim";
import type {
  AllyMode,
  Difficulty,
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
  private difficulty: Difficulty = "easy";
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
  private lastAiSend = 0;
  private round = 0;
  private lastCount = -1;
  private lastOver: Extract<NetMsg, { t: "over" }> | null = null;
  private overAcc = 0;
  private restLoading = false;
  private restPromise: Promise<void> | null = null;
  private loadDone = 0;
  private loadTotal = ASSET_TOTAL;
  private fps = 0;
  private fpsFrames = 0;
  private fpsAcc = 0;
  private pendingDifficulty: Difficulty = "easy";

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
    this.loaded = true;
    this.emit();
    this.last = performance.now() / 1000;
    this.raf = requestAnimationFrame(this.loop);
    window.setTimeout(() => {
      if (!this.destroyed && !this.assets) void this.hydrateCore();
    }, 400);
  }

  private onLoadProgress = (done: number, total: number) => {
    this.loadDone = done;
    this.loadTotal = total;
    if (this.screen === "loading" || done >= total) this.emit();
  };

  /** Idle dogs only — title already preloaded these. */
  private async hydrateCore() {
    if (this.assets) return this.assets;
    try {
      this.assets = await loadCoreAssets(this.onLoadProgress);
      this.loadDone = Math.max(this.loadDone, 3);
      if (this.screen !== "title") this.emit();
    } catch (err) {
      console.warn("Sprites failed to load, using fallbacks", err);
    }
    return this.assets;
  }

  /** Full pose set. Resolves when match sprites are in. */
  private hydrateRest(): Promise<void> {
    if (this.assets?.ready) return Promise.resolve();
    if (this.restPromise) return this.restPromise;
    this.restLoading = true;
    this.restPromise = (async () => {
      const core = await this.hydrateCore();
      if (!core) return;
      if (core.ready) return;
      try {
        await loadRestAssets(core, this.onLoadProgress);
        this.loadDone = this.loadTotal;
        if (this.screen !== "title") this.emit();
      } catch (err) {
        console.warn("Extra sprites failed", err);
      }
    })();
    return this.restPromise;
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.unbind();
    this.audio.stopMusic();
    this.closeNet();
  }

  play(difficulty: Difficulty = "easy") {
    if (this.screen === "playing" || this.screen === "loading") return;
    this.closeNet();
    this.versus = false;
    this.difficulty = difficulty;
    this.pendingDifficulty = difficulty;
    this.audio.unlock();
    this.audio.startMenuMusic();
    if (this.assets?.ready) {
      this.beginSolo();
      return;
    }
    this.screen = "loading";
    this.emit();
    const go = () => {
      if (this.destroyed || this.screen !== "loading") return;
      this.beginSolo();
    };
    void this.hydrateRest().then(go, go);
    window.setTimeout(go, 6000);
  }

  /** Start packing sprites while the difficulty panel is open. */
  preparePlay() {
    this.audio.unlock();
    void this.hydrateRest();
  }

  private beginSolo() {
    if (this.screen === "playing") return;
    this.audio.startMusic();
    this.screen = "playing";
    this.startLevel(1, false);
  }

  async createVersus() {
    this.audio.unlock();
    this.audio.startMenuMusic();
    this.hydrateRest();
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
    this.audio.startMenuMusic();
    this.hydrateRest();
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
    this.audio.startMenuMusic();
    this.emit();
  }

  leaveRoom() {
    this.sendNet({ t: "bye" });
    this.closeNet();
    this.screen = "title";
    this.versus = false;
    this.audio.startMenuMusic();
    this.emit();
  }

  toTitle() {
    if (this.versus && this.p2p && !this.botTakeover) this.sendNet({ t: "bye" });
    this.closeNet();
    this.versus = false;
    this.screen = "title";
    this.audio.startMenuMusic();
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

  private startLevel(level: number, versus = this.versus, buriedRed?: boolean[]) {
    this.versus = versus;
    this.round += 1;
    this.lastCount = -1;
    this.state = createState(level, versus, {
      fortHp: !versus && this.difficulty === "hard" ? FORT_HP : 0,
      buriedRed: !versus && this.difficulty === "hard" ? buriedRed : undefined,
      hard: !versus && this.difficulty === "hard",
    });
    this.grab = null;
    this.grabGuest = null;
    this.outcomeHandled = false;
    this.versusResult = null;
    this.rematchMine = false;
    this.rematchTheirs = false;
    this.lastOver = null;
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
    this.lastOver = null;
  }

  private sendNet(msg: NetMsg) {
    const pose =
      msg.t === "allypose" || msg.t === "hb" || (msg.t === "input" && msg.kind === "move");
    this.p2p?.send(msg, pose ? "pose" : "event");
  }

  private sendOver() {
    const winner: Team = this.state.phase === "won" ? "red" : "green";
    this.lastOver = { t: "over", winner, s: packState(this.state), round: this.round };
    this.overAcc = 0;
    this.sendNet(this.lastOver);
    this.sendNet(this.lastOver);
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
          this.versus = true;
          this.lastOver = null;
          this.audio.startMusic();
          if (this.screen !== "playing") this.startLevel(1, true);
          this.screen = "playing";
        }
        break;
      case "over":
        if (this.netRole === "guest" && !this.botTakeover) {
          this.lastPeerAt = performance.now();
          this.lastOver = data;
          applyState(this.state, data.s, { hard: true });
          this.grab = null;
          this.keepBallsUntil = 0;
          this.applyHostWinner(data.winner);
        }
        break;
      case "snap":
        if (this.netRole === "guest" && !this.botTakeover) {
          const rematchGo = this.rematchMine && this.rematchTheirs;
          if (this.screen === "gameover" && !rematchGo) break;
          if (this.netStatus === "rematch" && !rematchGo) break;
          this.lastPeerAt = performance.now();
          this.p2p?.setFast(true);
          if (rematchGo && this.screen === "gameover") {
            this.startLevel(1, true);
            this.netStatus = "live";
            this.screen = "playing";
            this.audio.startMusic();
            this.versus = true;
          }
          if (!this.matchStarted) {
            this.matchStarted = true;
            this.netStatus = "live";
            this.screen = "playing";
            this.audio.startMusic();
            this.versus = true;
          }
          if (performance.now() >= this.keepBallsUntil) {
            const mine = puffMissingBalls(this.state, data.s, this.seat);
            const fx = snapCombatFx(this.state, data.s, this.seat);
            for (let i = 0; i < mine + fx.hits; i++) {
              this.audio.hit();
              this.audio.splat();
            }
            for (let i = 0; i < fx.lands; i++) this.audio.splat();
          }
          applyState(this.state, data.s, {
            grabId: this.grab?.id ?? null,
            keepTeam: this.seat,
            keepBallsUntil: this.keepBallsUntil,
            predictTeam: this.seat,
            rttMs: this.p2p?.rttMs,
          });
          this.maybeOutcomeFromSnap();
        }
        break;
      case "input":
        if (this.netRole === "host") this.applyGuestInput(data);
        break;
      case "allypose":
        if (this.netRole === "host") this.applyAllyPose(data);
        break;
      case "allythrow":
        if (this.netRole === "host") this.applyAllyThrow(data);
        break;
      case "ally":
        this.guestAlly = data.mode;
        break;
      case "rematch":
        this.lastPeerAt = performance.now();
        this.rematchTheirs = data.yes;
        if (!data.yes) {
          this.netError = "Friend left the rematch.";
          this.leaveRoom();
          break;
        }
        this.netStatus = "rematch";
        if (this.screen === "playing" || this.screen === "paused") {
          this.screen = "gameover";
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

  private applyAllyPose(msg: Extract<NetMsg, { t: "allypose" }>) {
    if (this.botTakeover) return;
    const grabbed = this.grabGuest?.id;
    for (const p of msg.kids) {
      const kid = this.state.kids.find((k) => k.id === p.id && k.team === "green");
      if (!kid || isOut(kid) || kid.id === grabbed) continue;
      if (kid.state === "hurt" || kid.state === "buried" || kid.state === "grabbed") continue;
      kid.x = clamp(p.x, MARGIN, WORLD_W - MARGIN);
      kid.y = clamp(p.y, MARGIN, WORLD_H - MARGIN);
    }
  }

  private applyAllyThrow(msg: Extract<NetMsg, { t: "allythrow" }>) {
    if (this.botTakeover) return;
    const kid = this.state.kids.find((k) => k.id === msg.id && k.team === "green");
    if (!kid || isOut(kid) || kid.id === this.grabGuest?.id) return;
    if (kid.packT > 0 || kid.state === "pack" || kid.state === "hurt" || kid.state === "buried") return;
    kid.x = clamp(msg.x, MARGIN, WORLD_W - MARGIN);
    kid.y = clamp(msg.y, MARGIN, WORLD_H - MARGIN);
    const power = throwSnowball(this.state, kid, Math.max(0, msg.hold), msg.dx, msg.dy);
    if (power > 0) this.audio.throw(power);
  }

  private sendAllyPose() {
    if (this.allyMode === "off" || this.netRole !== "guest") return;
    const t = performance.now();
    if (t - this.lastAiSend < (this.p2p?.rtcOpen ? 32 : 50)) return;
    this.lastAiSend = t;
    const kids = this.state.kids
      .filter((k) => k.team === "green" && !isOut(k) && k.id !== this.grab?.id)
      .map((k) => ({ id: k.id, x: k.x, y: k.y }));
    if (kids.length) this.sendNet({ t: "allypose", kids });
  }

  private enterDisconnect() {
    if (this.botTakeover) return;
    this.netStatus = "disconnect";
    this.grab = null;
    this.grabGuest = null;
    this.emit();
  }

  private maybeOutcomeFromSnap() {
    if (this.outcomeHandled) return;
    if (this.state.phase !== "won" && this.state.phase !== "lost") return;
    this.applyHostWinner(this.state.phase === "won" ? "red" : "green");
  }

  /** Guest/host UI from the host's declared winner — never guess locally. */
  private applyHostWinner(winner: Team) {
    const result = this.myTeam() === winner ? "win" : "lose";
    if (this.outcomeHandled && this.versusResult === result && this.screen === "gameover") return;
    const fresh = !this.outcomeHandled;
    this.outcomeHandled = true;
    this.versusResult = result;
    this.screen = "gameover";
    if (this.p2p && !this.botTakeover) this.netStatus = "rematch";
    if (fresh) {
      if (result === "win") this.audio.win();
      else this.audio.lose();
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
    window.addEventListener("pointerdown", this.onPrimeAudio);
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
    window.removeEventListener("pointerdown", this.onPrimeAudio);
    document.removeEventListener("visibilitychange", this.onVis);
  }

  private onMenu = (e: Event) => e.preventDefault();

  private onPrimeAudio = () => {
    try {
      this.audio.unlock();
      if (this.screen === "title" || this.screen === "lobby" || this.screen === "loading") {
        this.audio.startMenuMusic();
      }
    } catch {
      /* gesture unlock must never block UI clicks */
    }
  };

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
    return worldFromClient(this.canvas, e.clientX, e.clientY, this.mirrored());
  }

  private mirrored() {
    return this.versus && this.seat === "green" && !this.botTakeover;
  }

  private onDown = (e: PointerEvent) => {
    this.audio.unlock();
    if (this.screen !== "playing" || (this.state.phase !== "fight" && this.state.phase !== "intro")) return;
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
    const power = throwSnowball(this.state, kid, seconds, dx, dy, this.netRole === "guest");
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
      this.screen === "loading" ||
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
      const rtt = this.p2p?.rttMs ?? 80;
      const interval = this.p2p?.rtcOpen ? (rtt < 50 ? 0.07 : 0.1) : 0.22;
      if (this.snapAcc >= interval) {
        this.snapAcc = 0;
        this.sendSnap();
      }
    }

    if (this.netRole === "host" && this.lastOver && this.screen === "gameover") {
      this.overAcc += dt;
      if (this.overAcc >= 0.35) {
        this.overAcc = 0;
        this.sendNet(this.lastOver);
      }
    }

    this.fpsFrames += 1;
    this.fpsAcc += dt;
    if (this.fpsAcc >= 0.4) {
      this.fps = Math.round(this.fpsFrames / this.fpsAcc);
      this.fpsFrames = 0;
      this.fpsAcc = 0;
    }

    this.audio.tick(dt);
    this.tickCount();
    this.draw();
  };

  private tickCount() {
    if (this.screen !== "playing" || this.state.phase !== "intro") return;
    if (this.state.introT <= 0) {
      if (this.lastCount !== 0) {
        this.lastCount = 0;
        this.audio.go();
      }
      return;
    }
    const n = Math.max(1, Math.ceil(this.state.introT));
    if (n !== this.lastCount) {
      this.lastCount = n;
      this.audio.count(n);
    }
  }

  private flyPredictedBalls(dt: number) {
    for (const b of this.state.balls) {
      if (!b.alive || !b.local || b.team !== this.seat) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.traveled += Math.hypot(b.vx, b.vy) * dt;
      b.spin += dt * 10;
      if (b.traveled >= b.range || b.x < -40 || b.x > WORLD_W + 40 || b.y < -20 || b.y > WORLD_H + 20) {
        b.alive = false;
        burst(this.state, b.x, b.y, 0, 12, "spark");
        this.audio.splat();
      }
    }
  }

  private greenControl(): GreenControl {
    if (!this.versus) return "enemy";
    if (this.botTakeover) {
      if (this.seat === "red") return "enemy";
      return this.allyMode;
    }
    if (this.netRole === "host") return "off";
    return this.allyMode;
  }

  private step(dt: number) {
    const guestView = this.netRole === "guest" && !this.botTakeover;
    if (guestView) {
      stepAi(
        this.state,
        dt,
        (power, kid, hold, dx, dy) => {
          this.audio.throw(power);
          this.keepBallsUntil = performance.now() + Math.min(220, 48 + (this.p2p?.rttMs ?? 90));
          this.sendNet({
            t: "allythrow",
            id: kid.id,
            x: kid.x,
            y: kid.y,
            hold,
            dx,
            dy,
          });
        },
        "off",
        this.allyMode,
        true,
      );
      for (const kid of this.state.kids) {
        if (kid.team !== this.seat) continue;
        const dist = Math.hypot(kid.x - kid.lastX, kid.y - kid.lastY);
        kid.moving = dist > 0.55 && kid.state !== "buried";
        kid.lastX = kid.x;
        kid.lastY = kid.y;
      }
      this.flyPredictedBalls(dt);
      stepPresentation(this.state, dt);
      this.sendAllyPose();
      return;
    }

    const redMode = this.botTakeover && this.seat === "green" ? "attack" : this.allyMode;
    stepAi(
      this.state,
      dt,
      (power) => this.audio.throw(power),
      redMode,
      this.greenControl(),
      false,
      this.difficulty === "hard" && !this.versus,
    );
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
        if (this.netRole === "host" && this.versus) this.sendSnap();
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
    if (this.versus && this.netRole === "guest" && !this.botTakeover) return;
    if (this.state.phase === "won") {
      if (this.versus) {
        this.applyHostWinner("red");
        if (this.netRole === "host") this.sendOver();
        return;
      }
      this.outcomeHandled = true;
      this.audio.win();
      window.setTimeout(() => {
        if (this.destroyed || this.screen !== "playing") return;
        const carry =
          this.difficulty === "hard"
            ? this.state.kids.filter((k) => k.team === "red").map((k) => isOut(k))
            : undefined;
        this.startLevel(this.state.level + 1, false, carry);
      }, 1100);
    }
    if (this.state.phase === "lost") {
      if (this.versus) {
        this.applyHostWinner("green");
        if (this.netRole === "host") this.sendOver();
        return;
      }
      this.outcomeHandled = true;
      this.audio.lose();
      this.versusResult = "lose";
      this.screen = "gameover";
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
      mirror: this.mirrored(),
      pvp: this.versus,
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
      loadDone: this.loadDone,
      loadTotal: this.loadTotal,
      allyMode: this.allyMode,
      difficulty: this.versus ? "easy" : this.difficulty,
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
      fps: this.fps,
    });
  }
}
