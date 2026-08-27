import { type RoomPeer } from "./room-channel";
import { VersusLink } from "./versus-link";
import { stepAi, type GreenControl } from "./ai";
import { ASSET_TOTAL, loadCoreAssets, loadRestAssets, type Assets } from "./assets";
import { GameAudio } from "./audio";
import { FORT_HP, FIXED_DT, MARGIN, BALL_RADIUS, BIG_BALL_RADIUS, BIG_HELD_TIME, BIG_SHOTS, playFeel, PVP_RANGE, SAVE_KEY, STAR_HP, WORLD_H, WORLD_W, AI_WIN_LEVEL } from "./constants";
import {
  applyState,
  applyPose,
  INTERP_MS,
  HIST_MS,
  makeRoomCode,
  normalizeCode,
  packPose,
  packState,
  posAt,
  pushPoseSample,
  roomIdFromCode,
  type NetMsg,
  type PoseSample,
} from "./net";
import { render, worldFromClient, clampWorldToView } from "./render";
import { aimFromKid, burst, claimPickup, clamp, createState, faceNearest, isOut, living, placePickup, puffMissingBalls, snapCombatFx, stepOneBall, stepPickups, stepPresentation, stepSim, throwSnowball } from "./sim";
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
  private clearEasyMs: number | null = null;
  private clearHardMs: number | null = null;
  private clearEasyStar = false;
  private clearHardStar = false;
  private runMs = 0;
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
  private lastHostDragSend = 0;
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
  private buffHudAcc = 0;
  private pendingDifficulty: Difficulty = "easy";
  private selfPacked = false;
  private peerPacked = false;
  private throwQ: { at: number; id: number; hold: number; dx: number; dy: number; ghost?: boolean }[] = [];
  private poseBuf: { t: number; msg: Extract<NetMsg, { t: "pose" }> }[] = [];
  private posePrev = new Map<number, { x: number; y: number; t: number }>();
  private keyframeAcc = 0;
  private guestInQ: { at: number; msg: Extract<NetMsg, { t: "input" }> }[] = [];
  private predHits: { id: number; at: number; hp: number; state: Kid["state"]; kind: "spark" | "pose" | "sfx" }[] = [];
  private poseHist: PoseSample[] = [];
  private rttSmooth = 0;
  private hitTier: "tight" | "mid" | "loose" = "tight";
  private hitTierHoldUntil = 0;
  private godSpeed = false;
  private levelTaps: number[] = [];
  private scoreTaps: number[] = [];

  private titleArm: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement, onUi: (s: UiSnapshot) => void) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false }) ?? canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is not available");
    this.ctx = ctx;
    this.onUi = onUi;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          best?: number;
          clearEasyMs?: number;
          clearHardMs?: number;
          clearEasyStar?: boolean;
          clearHardStar?: boolean;
        };
        if (parsed.best) this.best = parsed.best;
        if (parsed.clearEasyMs && parsed.clearEasyMs > 0) this.clearEasyMs = parsed.clearEasyMs;
        if (parsed.clearHardMs && parsed.clearHardMs > 0) this.clearHardMs = parsed.clearHardMs;
        if (parsed.clearEasyStar) this.clearEasyStar = true;
        if (parsed.clearHardStar) this.clearHardStar = true;
      }
    } catch {
      /* ignore */
    }
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.bind();
    this.emit();
    this.titleArm = () => this.armTitleAudio();
    window.addEventListener("pointerdown", this.titleArm, { capture: true });
    window.addEventListener("touchstart", this.titleArm, { capture: true });
    window.addEventListener("keydown", this.titleArm, { capture: true });
  }

  async start() {
    this.loaded = true;
    this.emit();
    this.last = performance.now() / 1000;
    this.raf = requestAnimationFrame(this.loop);
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("capture") === "1") {
      (window as unknown as { __snow?: SnowCraftGame }).__snow = this;
    }
  }

  /** Browsers block BGM until a tap. First gesture on title starts the menu loop. */
  armTitleAudio = () => {
    this.audio.unlock();
    if (this.screen === "title" || this.screen === "lobby" || this.screen === "loading") {
      this.audio.startMenuMusic();
    }
    this.disarmTitleAudio();
  };

  private disarmTitleAudio() {
    if (!this.titleArm) return;
    window.removeEventListener("pointerdown", this.titleArm, { capture: true });
    window.removeEventListener("touchstart", this.titleArm, { capture: true });
    window.removeEventListener("keydown", this.titleArm, { capture: true });
    this.titleArm = null;
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
        this.emit();
      } catch (err) {
        console.warn("Extra sprites failed", err);
      }
    })();
    return this.restPromise;
  }

  /** Drop loaded sprites so a skin change reloads the next match. */
  dropAssets() {
    this.assets = null;
    this.restPromise = null;
    this.restLoading = false;
    this.loadDone = 0;
    this.loadTotal = ASSET_TOTAL;
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.unbind();
    this.disarmTitleAudio();
    this.audio.stopMusic();
    this.closeNet();
  }

  play(difficulty: Difficulty = "easy") {
    if (this.screen === "playing" || this.screen === "loading") return;
    this.closeNet();
    this.versus = false;
    this.godSpeed = false;
    this.levelTaps = [];
    this.scoreTaps = [];
    this.difficulty = difficulty;
    this.pendingDifficulty = difficulty;
    this.audio.unlock();
    this.audio.startMenuMusic();
    if (this.assets?.ready) {
      this.beginSolo();
      return;
    }
    this.screen = "loading";
    this.loadDone = 0;
    this.loadTotal = ASSET_TOTAL;
    this.emit();
    void this.hydrateRest().then(() => {
      if (this.destroyed || this.screen !== "loading") return;
      this.beginSolo();
    });
  }

  private beginSolo() {
    if (this.screen === "playing") return;
    this.audio.startMusic();
    this.screen = "playing";
    this.startLevel(1, false);
  }

  /** After both players are in the room, load sprites and wait for the other side. */
  private async ensurePackedThenStart() {
    if (this.matchStarted) return;
    if (this.screen !== "loading") {
      this.screen = "loading";
      this.loadDone = this.assets?.ready ? ASSET_TOTAL : 0;
      this.loadTotal = ASSET_TOTAL;
      this.emit();
    }
    if (this.selfPacked) {
      this.sendNet({ t: "packed" });
      this.tryPackedStart();
      return;
    }
    await this.hydrateRest();
    if (this.destroyed || this.matchStarted) return;
    this.selfPacked = true;
    this.sendNet({ t: "packed" });
    this.sendNet({ t: "packed" });
    this.tryPackedStart();
    this.emit();
  }

  private tryPackedStart() {
    if (this.matchStarted || !this.selfPacked) return;
    if (this.netRole === "host" && this.peerPacked) this.beginVersus();
  }

  async createVersus() {
    this.audio.unlock();
    this.audio.startMenuMusic();
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
    this.godSpeed = false;
    this.levelTaps = [];
    this.scoreTaps = [];
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

  private applyStarHp() {
    for (const kid of this.state.kids) {
      if (kid.team !== "red" || isOut(kid)) continue;
      kid.maxHp = STAR_HP;
      kid.hp = STAR_HP;
    }
  }

  tapLevelHud() {
    if (this.screen !== "playing" || this.netRole === "guest") return;
    const now = performance.now();
    this.levelTaps = this.levelTaps.filter((t) => now - t < 1600);
    this.levelTaps.push(now);
    if (this.levelTaps.length < 5) return;
    this.levelTaps = [];
    if (this.godSpeed || this.versus) return;
    this.audio.unlock();
    this.audio.ding();
    this.godSpeed = true;
    this.state.godSpeed = true;
    this.applyStarHp();
    this.emit();
  }

  tapScoreHud() {
    if (this.screen !== "playing" || this.netRole === "guest") return;
    const now = performance.now();
    this.scoreTaps = this.scoreTaps.filter((t) => now - t < 900);
    this.scoreTaps.push(now);
    if (this.scoreTaps.length < 2) return;
    this.scoreTaps = [];
    this.audio.unlock();
    this.audio.ding();
    const orb = placePickup(this.state);
    if (this.netRole === "host" && this.versus) {
      this.sendNet({ t: "loot", x: orb.x, y: orb.y, life: orb.life });
    }
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
    this.throwQ = [];
    this.poseBuf = [];
    this.posePrev.clear();
    this.guestInQ = [];
    this.predHits = [];
    this.poseHist = [];
    this.rttSmooth = 0;
    this.hitTier = "tight";
    this.hitTierHoldUntil = 0;
    this.state = createState(level, versus, {
      fortHp: !versus && this.difficulty === "hard" ? FORT_HP : 0,
      buriedRed: !versus && this.difficulty === "hard" ? buriedRed : undefined,
      hard: !versus && this.difficulty === "hard",
    });
    this.state.godSpeed = this.godSpeed;
    if (this.godSpeed) this.applyStarHp();
    this.grab = null;
    this.grabGuest = null;
    this.outcomeHandled = false;
    this.versusResult = null;
    this.rematchMine = false;
    this.rematchTheirs = false;
    this.lastOver = null;
    this.audio.level();
    if (!versus && level === 1) this.runMs = 0;
    if (!versus && level > this.best) {
      this.best = level;
      this.persistSave();
    }
    this.emit();
  }

  private persistSave() {
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          best: this.best,
          clearEasyMs: this.clearEasyMs,
          clearHardMs: this.clearHardMs,
          clearEasyStar: this.clearEasyStar,
          clearHardStar: this.clearHardStar,
        }),
      );
    } catch {
      /* ignore */
    }
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

  private inFreshRound() {
    return (
      this.screen === "playing" &&
      !this.outcomeHandled &&
      (this.state.phase === "intro" || this.state.phase === "fight")
    );
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
    this.selfPacked = false;
    this.peerPacked = false;
    this.throwQ = [];
    this.poseBuf = [];
    this.posePrev.clear();
    this.guestInQ = [];
    this.predHits = [];
    this.poseHist = [];
    this.rttSmooth = 0;
    this.hitTier = "tight";
    this.hitTierHoldUntil = 0;
    this.rematchMine = false;
    this.rematchTheirs = false;
    this.guestAlly = "off";
    this.grabGuest = null;
    this.seat = "red";
    this.lastOver = null;
  }

  private sendNet(msg: NetMsg) {
    const pose =
      msg.t === "pose" ||
      msg.t === "allypose" ||
      msg.t === "hb" ||
      (msg.t === "input" && msg.kind === "move");
    const kind = msg.t === "snap" ? "snap" : pose ? "pose" : "event";
    this.p2p?.send(msg, kind);
  }

  private hostDelayMs() {
    if (!this.versus || this.netRole !== "host" || this.botTakeover) return 0;
    const rtt = this.p2p?.rttMs ?? 80;
    return Math.max(30, Math.min(80, rtt / 2));
  }

  private sendPose(immediate = false) {
    if (this.netRole !== "host" || !this.p2p) return;
    const msg = packPose(this.state, this.posePrev);
    const delay = immediate ? 0 : this.hostDelayMs();
    const now = performance.now();
    if (delay <= 0) {
      this.sendNet(msg);
      return;
    }
    this.poseBuf.push({ t: now, msg });
    while (this.poseBuf.length && now - this.poseBuf[0]!.t >= delay) {
      this.sendNet(this.poseBuf.shift()!.msg);
    }
  }

  private broadcastThrow(kid: Kid) {
    if (this.netRole !== "host" || !this.versus) return;
    let ball = null as (typeof this.state.balls)[number] | null;
    for (let i = this.state.balls.length - 1; i >= 0; i--) {
      const b = this.state.balls[i]!;
      if (b.alive && b.fromId === kid.id && !b.ghost) {
        ball = b;
        break;
      }
    }
    if (!ball) return;
    this.sendNet({
      t: "throw",
      id: kid.id,
      x: Math.round(ball.x),
      y: Math.round(ball.y),
      vx: Math.round(ball.vx),
      vy: Math.round(ball.vy),
      team: kid.team,
      t0: performance.now(),
      big: !!ball.big,
    });
  }

  private commitThrow(kid: Kid, hold: number, dx: number, dy: number, local = false, ghost = false) {
    const power = throwSnowball(this.state, kid, hold, dx, dy, local || ghost, true, !ghost);
    if (power <= 0) return 0;
    const ball = this.lastBallFrom(kid.id);
    if (ball && ghost) {
      ball.ghost = true;
      ball.local = true;
    }
    if (!ghost) {
      this.audio.throw(power);
      this.broadcastThrow(kid);
      this.emit();
    } else {
      this.audio.throw(power * 0.85);
    }
    return power;
  }

  private lastBallFrom(id: number) {
    for (let i = this.state.balls.length - 1; i >= 0; i--) {
      const b = this.state.balls[i]!;
      if (b.alive && b.fromId === id) return b;
    }
    return null;
  }

  private flushThrowQ() {
    const now = performance.now();
    while (this.throwQ.length && this.throwQ[0]!.at <= now) {
      const job = this.throwQ.shift()!;
      const kid = this.state.kids.find((k) => k.id === job.id);
      if (!kid || isOut(kid) || this.state.phase !== "fight") {
        if (kid && kid.state === "grabbed") kid.state = kid.packT > 0 ? "pack" : "idle";
        continue;
      }
      for (const b of this.state.balls) {
        if (b.ghost && b.fromId === job.id) b.alive = false;
      }
      if (kid.packT > 0 && !job.ghost) {
        kid.state = "pack";
        continue;
      }
      kid.packT = 0;
      this.commitThrow(kid, job.hold, job.dx, job.dy);
    }
  }

  private flushGuestInQ() {
    const now = performance.now();
    while (this.guestInQ.length && this.guestInQ[0]!.at <= now) {
      this.applyGuestInputNow(this.guestInQ.shift()!.msg);
    }
  }

  private sampleKids() {
    const kids = new Map<number, { x: number; y: number }>();
    for (const k of this.state.kids) kids.set(k.id, { x: k.x, y: k.y });
    pushPoseSample(this.poseHist, { t: performance.now(), kids });
  }

  private interpolateViews() {
    const delay = this.p2p?.rtcOpen && (this.p2p.rttMs ?? 90) < 55 ? 55 : INTERP_MS;
    const at = performance.now() - delay;
    const localGrab = this.grab?.id ?? null;
    for (const kid of this.state.kids) {
      const remote = this.netRole === "guest" && kid.team !== this.seat;
      if (!this.versus || !remote || kid.id === localGrab) {
        kid.viewX = kid.x;
        kid.viewY = kid.y;
        continue;
      }
      const p = posAt(this.poseHist, kid.id, at);
      kid.viewX = p?.x ?? kid.x;
      kid.viewY = p?.y ?? kid.y;
    }
  }

  private commitOrCatchUp(kid: Kid, hold: number, dx: number, dy: number, fireAt: number) {
    const now = performance.now();
    const late = now - fireAt;
    if (this.netRole === "host" && late > 16 && late < HIST_MS) {
      this.catchUpThrow(kid, hold, dx, dy, fireAt);
      return;
    }
    this.commitThrow(kid, hold, dx, dy);
  }

  private catchUpThrow(kid: Kid, hold: number, dx: number, dy: number, fireAt: number) {
    const origin = posAt(this.poseHist, kid.id, fireAt);
    const saved = { x: kid.x, y: kid.y };
    if (origin) {
      kid.x = origin.x;
      kid.y = origin.y;
    }
    const power = this.commitThrow(kid, hold, dx, dy);
    kid.x = saved.x;
    kid.y = saved.y;
    if (power <= 0) return;
    const ball = this.lastBallFrom(kid.id);
    if (!ball) return;
    const now = performance.now();
    let t = fireAt;
    const hpBefore = new Map(this.state.kids.map((k) => [k.id, k.hp]));
    while (t < now && ball.alive) {
      const dt = Math.min(FIXED_DT, (now - t) / 1000);
      if (dt <= 0) break;
      stepOneBall(
        this.state,
        ball,
        dt,
        (id) => posAt(this.poseHist, id, t),
        (heavy) => {
          if (heavy) this.audio.bury();
          else {
            this.audio.hit();
            this.audio.splat();
          }
          for (const k of this.state.kids) {
            const prev = hpBefore.get(k.id);
            if (prev != null && k.hp !== prev) {
              this.sendNet({ t: "hit", id: k.id, hp: k.hp, heavy: heavy || k.hp <= 0 });
              hpBefore.set(k.id, k.hp);
            }
          }
        },
      );
      t += dt * 1000;
    }
  }

  private hostNowGuess() {
    return performance.now() + (this.p2p?.clockOffset ?? 0);
  }

  private peerToHostTime(peerT: number) {
    return peerT - (this.p2p?.clockOffset ?? 0);
  }

  private sendOver() {
    const winner: Team = this.state.phase === "won" ? "red" : "green";
    this.lastOver = { t: "over", winner, s: packState(this.state), round: this.round };
    this.overAcc = 0;
    this.sendNet(this.lastOver);
    this.sendNet(this.lastOver);
    this.sendNet({ t: "over", winner, round: this.round });
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
      void this.ensurePackedThenStart();
    }
    if (this.netRole === "guest" && !this.matchStarted && peers.length > 0) {
      void this.ensurePackedThenStart();
    }
    if (this.matchStarted && this.netStatus === "connecting" && peers.length > 0 && !this.botTakeover) {
      this.netStatus = "live";
      if (this.screen !== "gameover") this.screen = "playing";
    }
    this.emit();
  }

  private onNet(data: NetMsg) {
    switch (data.t) {
      case "packed":
        this.peerPacked = true;
        this.lastPeerAt = performance.now();
        this.tryPackedStart();
        break;
      case "start":
        if (this.netRole === "guest") {
          this.matchStarted = true;
          this.netStatus = "live";
          this.versus = true;
          this.lastOver = null;
          this.rematchMine = false;
          this.rematchTheirs = false;
          this.audio.startMusic();
          const fresh =
            this.screen !== "playing" ||
            this.outcomeHandled ||
            this.state.phase === "won" ||
            this.state.phase === "lost";
          if (fresh) this.startLevel(1, true);
          this.screen = "playing";
        }
        break;
      case "over":
        if (this.netRole === "guest" && !this.botTakeover) {
          this.lastPeerAt = performance.now();
          this.lastOver = data;
          if (data.s) {
            try {
              applyState(this.state, data.s, { hard: true });
            } catch {
              /* winner still applies */
            }
          }
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
      case "pose":
        if (this.netRole === "guest" && !this.botTakeover) {
          this.lastPeerAt = performance.now();
          if (this.screen === "gameover" && !(this.rematchMine && this.rematchTheirs)) {
            if (data.phase === "won" || data.phase === "lost") {
              this.state.phase = data.phase;
              this.maybeOutcomeFromSnap();
            }
            break;
          }
          applyPose(this.state, data, {
            grabId: this.grab?.id ?? null,
            predictTeam: this.seat,
            rttMs: this.p2p?.rttMs,
            hostNow: this.hostNowGuess(),
          });
          this.sampleKids();
          if (data.phase === "won" || data.phase === "lost") this.maybeOutcomeFromSnap();
          if (
            this.screen === "gameover" &&
            this.rematchMine &&
            this.rematchTheirs &&
            data.phase === "fight"
          ) {
            this.startLevel(1, true);
            this.netStatus = "live";
            this.screen = "playing";
            this.audio.startMusic();
            this.versus = true;
          }
        }
        break;
      case "throw":
        if (this.netRole === "guest" && !this.botTakeover) this.applyHostThrow(data);
        break;
      case "hit":
        if (this.netRole === "guest" && !this.botTakeover) this.applyHostHit(data);
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
        if (!data.yes) {
          this.netError = "Friend left the rematch.";
          this.leaveRoom();
          break;
        }
        if (this.inFreshRound()) {
          this.rematchTheirs = true;
          this.netStatus = "live";
          break;
        }
        this.rematchTheirs = true;
        this.netStatus = "rematch";
        if (this.screen === "playing" || this.screen === "paused") {
          this.screen = "gameover";
        }
        this.tryRematch();
        break;
      case "loot":
        if (typeof data.x === "number" && typeof data.y === "number") {
          this.state.pickup = { x: data.x, y: data.y, kind: "big", life: data.life ?? 10, maxLife: 10 };
        } else {
          this.state.pickup = null;
        }
        break;
      case "got":
        if (data.team === "red" || data.team === "green") {
          if (!data.shots) this.state.buffs[data.team] = null;
          else {
            this.state.buffs[data.team] = { kind: "big", shots: data.shots, t: data.ttl ?? 10 };
            this.state.pickup = null;
          }
        }
        break;
      case "claim":
        if (this.netRole === "host" && !this.botTakeover) this.hostHonorClaim("green");
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
    if (typeof msg.at === "number") {
      const at = this.peerToHostTime(msg.at);
      const now = performance.now();
      if (at > now + 8 && at < now + 120) {
        this.guestInQ.push({ at, msg });
        this.guestInQ.sort((a, b) => a.at - b.at);
        return;
      }
    }
    this.applyGuestInputNow(msg);
  }

  private applyGuestInputNow(msg: Extract<NetMsg, { t: "input" }>) {
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
        originX: msg.x,
        originY: msg.y,
      };
      kid.state = "grabbed";
      this.audio.grab();
      return;
    }
    if (msg.kind === "move" && !this.grabGuest) {
      const kid = this.pickTeam("green", msg.x, msg.y);
      if (!kid || isOut(kid)) return;
      this.grabGuest = {
        id: kid.id,
        pointerId: -1,
        startedAt: performance.now(),
        lastX: msg.x,
        lastY: msg.y,
        vx: 0,
        vy: 0,
        packLeft: kid.packT,
        originX: msg.x,
        originY: msg.y,
      };
      kid.state = "grabbed";
    }
    if (msg.kind === "up" && !this.grabGuest) {
      const kid = this.pickTeam("green", msg.x, msg.y);
      if (!kid || isOut(kid)) return;
      this.grabGuest = {
        id: kid.id,
        pointerId: -1,
        startedAt: performance.now() - Math.max(0, (msg.hold ?? 0) * 1000),
        lastX: msg.x,
        lastY: msg.y,
        vx: msg.vx ?? 0,
        vy: msg.vy ?? 0,
        packLeft: 0,
        originX: msg.x,
        originY: msg.y,
      };
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
    const { dx, dy } = aimFromKid(kid, this.state.kids, aimVx, aimVy, false, this.state.godSpeed && kid.team === "red");
    const fireAt =
      typeof msg.at === "number" ? this.peerToHostTime(msg.at) : performance.now();
    this.commitOrCatchUp(kid, seconds, dx, dy, fireAt);
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
    const fireAt =
      typeof msg.t0 === "number" ? this.peerToHostTime(msg.t0) : performance.now();
    this.commitOrCatchUp(kid, Math.max(0, msg.hold), msg.dx, msg.dy, fireAt);
  }

  private applyHostThrow(msg: Extract<NetMsg, { t: "throw" }>) {
    this.lastPeerAt = performance.now();
    const dup = this.state.balls.some(
      (b) => b.alive && b.fromId === msg.id && Math.hypot(b.x - msg.x, b.y - msg.y) < 90,
    );
    if (dup) return;
    this.state.balls.push({
      x: msg.x,
      y: msg.y,
      vx: msg.vx,
      vy: msg.vy,
      team: msg.team,
      r: msg.big ? BIG_BALL_RADIUS : BALL_RADIUS,
      fromId: msg.id,
      grace: 0.08,
      spin: 0,
      alive: true,
      range: this.versus ? PVP_RANGE : 2400,
      traveled: 0,
      local: false,
      born: performance.now(),
      big: !!msg.big,
    });
    const kid = this.state.kids.find((k) => k.id === msg.id);
    if (kid && kid.state !== "hurt" && kid.state !== "buried") {
      kid.state = "throw";
      kid.stateT = 0.38;
      kid.facing = msg.vx < 0 ? -1 : 1;
    }
    this.audio.throw(0.5);
  }

  private applyHostHit(msg: Extract<NetMsg, { t: "hit" }>) {
    this.lastPeerAt = performance.now();
    const kid = this.state.kids.find((k) => k.id === msg.id);
    if (!kid) return;
    const predicted = this.predHits.find((p) => p.id === msg.id);
    this.predHits = this.predHits.filter((p) => p.id !== msg.id);
    kid.hp = msg.hp;
    kid.flash = 0.2;
    if (msg.heavy || kid.hp <= 0) {
      kid.state = "buried";
      kid.stateT = 0;
      if (predicted?.kind !== "sfx") this.audio.bury();
    } else {
      kid.state = "hurt";
      kid.stateT = 0.45;
      kid.stun = 0.35;
      if (predicted?.kind !== "sfx") {
        this.audio.hit();
        this.audio.splat();
      }
    }
    burst(this.state, kid.x, kid.y, 0, 14, "spark");
    for (const b of this.state.balls) {
      if (!b.alive || b.team === kid.team) continue;
      if (Math.hypot(b.x - kid.x, b.y - kid.y) < 96) b.alive = false;
    }
  }

  private sendAllyPose() {
    if (this.netRole !== "guest" || this.botTakeover) return;
    const t = performance.now();
    if (t - this.lastAiSend < (this.p2p?.rtcOpen ? 40 : 70)) return;
    this.lastAiSend = t;
    const kids = this.state.kids
      .filter((k) => k.team === "green" && !isOut(k) && k.id !== this.grab?.id)
      .map((k) => ({ id: k.id, x: Math.round(k.x), y: Math.round(k.y) }));
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
    c.addEventListener("pointercancel", this.onCancel);
    c.addEventListener("lostpointercapture", this.onCancel);
    c.addEventListener("contextmenu", this.onMenu);
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("pointerdown", this.onGlobalPointer, true);
    document.addEventListener("visibilitychange", this.onVis);
    document.addEventListener("selectstart", this.onSelectStart);
  }

  private unbind() {
    const c = this.canvas;
    c.removeEventListener("pointerdown", this.onDown);
    c.removeEventListener("pointermove", this.onMove);
    c.removeEventListener("pointerup", this.onUp);
    c.removeEventListener("pointercancel", this.onCancel);
    c.removeEventListener("lostpointercapture", this.onCancel);
    c.removeEventListener("contextmenu", this.onMenu);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("pointerdown", this.onGlobalPointer, true);
    document.removeEventListener("visibilitychange", this.onVis);
    document.removeEventListener("selectstart", this.onSelectStart);
  }

  private onMenu = (e: Event) => e.preventDefault();

  private onSelectStart = (e: Event) => {
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
    e.preventDefault();
  };

  private onGlobalPointer = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount) sel.removeAllRanges();
  };

  private dropGrab() {
    const grab = this.grab;
    if (!grab) return;
    const kid = this.state.kids.find((k) => k.id === grab.id);
    if (kid && kid.state === "grabbed") kid.state = kid.packT > 0 ? "pack" : "idle";
    try {
      this.canvas.releasePointerCapture(grab.pointerId);
    } catch {
      /* not capturing */
    }
    this.grab = null;
  }

  private onCancel = () => {
    this.dropGrab();
  };

  private onVis = () => {
    if (document.visibilityState === "visible") this.audio.unlock();
  };

  private onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.code === "KeyA") {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      e.preventDefault();
      window.getSelection()?.removeAllRanges();
      return;
    }
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

  private keepOnScreen(x: number, y: number) {
    return clampWorldToView(x, y, this.canvas.clientWidth, this.canvas.clientHeight, this.mirrored());
  }

  private clampOwnTeam() {
    if (this.screen !== "playing") return;
    for (const kid of this.state.kids) {
      if (kid.team !== this.seat || isOut(kid)) continue;
      const p = this.keepOnScreen(kid.x, kid.y);
      kid.x = p.x;
      kid.y = p.y;
    }
  }

  private onDown = (e: PointerEvent) => {
    this.audio.unlock();
    window.getSelection()?.removeAllRanges();
    if (this.screen !== "playing" || (this.state.phase !== "fight" && this.state.phase !== "intro")) return;
    if (this.netStatus === "disconnect") return;
    if (this.grab) this.dropGrab();
    const w = this.toWorld(e);
    if (this.hitPickup(w.x, w.y) && this.tryClaimPickup()) {
      e.preventDefault();
      return;
    }
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
      originX: w.x,
      originY: w.y,
    };
    kid.state = "grabbed";
    this.audio.grab();
    if (this.netRole === "guest") this.sendNet({ t: "input", kind: "down", x: w.x, y: w.y, at: performance.now() });
  };

  private onMove = (e: PointerEvent) => {
    const w = this.toWorld(e);
    this.pointer = w;
    this.hoverId = this.pickTeam(this.myTeam(), w.x, w.y)?.id ?? null;
    this.canvas.style.cursor = this.hitPickup(w.x, w.y) ? "pointer" : this.hoverId ? "grab" : "";
    if (!this.grab || e.pointerId !== this.grab.pointerId) return;
    const kid = this.state.kids.find((k) => k.id === this.grab!.id);
    if (!kid || isOut(kid)) return;
    this.grab.vx = w.x - kid.x;
    this.grab.vy = w.y - kid.y;
    const p = this.keepOnScreen(w.x, w.y);
    kid.x = p.x;
    kid.y = p.y;
    this.grab.lastX = p.x;
    this.grab.lastY = p.y;
    if (this.state.godSpeed && kid.team === "red") {
      const extraX = kid.x - this.grab.originX + this.grab.vx;
      const extraY = kid.y - this.grab.originY + this.grab.vy;
      const { dx, dy } = aimFromKid(kid, this.state.kids, extraX, extraY, false, true);
      kid.facing = Math.abs(dx) < Math.max(8, Math.abs(dy) * 0.35) ? kid.facing : dx < 0 ? -1 : 1;
    }
    if (this.netRole === "guest") {
      const t = performance.now();
      const gap = this.p2p?.rtcOpen ? 20 : 40;
      if (t - this.lastMoveSend > gap) {
        this.lastMoveSend = t;
        this.sendNet({ t: "input", kind: "move", x: p.x, y: p.y, at: performance.now() });
      }
    } else if (this.netRole === "host" && this.versus) {
      const t = performance.now();
      if (t - this.lastHostDragSend > 24) {
        this.lastHostDragSend = t;
        this.sendPose(true);
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
        at: performance.now(),
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

  private hitPickup(x: number, y: number) {
    const orb = this.state.pickup;
    if (!orb) return false;
    const r = Math.max(56, playFeel(this.canvas.clientWidth).pick * 0.85);
    return Math.hypot(orb.x - x, orb.y - y) <= r;
  }

  private tryClaimPickup() {
    if (!this.state.pickup) return false;
    const team = this.myTeam();
    if (this.netRole === "guest" && !this.botTakeover) {
      this.sendNet({ t: "claim" });
      if (claimPickup(this.state, team)) this.audio.splat();
      this.emit();
      return true;
    }
    if (!claimPickup(this.state, team)) return false;
    this.audio.splat();
    this.hostBroadcastLoot(team);
    this.emit();
    return true;
  }

  private hostHonorClaim(team: Team) {
    if (!claimPickup(this.state, team)) return;
    this.audio.splat();
    this.hostBroadcastLoot(team);
    this.emit();
  }

  private hostBroadcastLoot(team: Team) {
    if (this.netRole !== "host" || !this.versus) return;
    this.sendNet({ t: "loot" });
    const buff = this.state.buffs[team];
    if (buff) this.sendNet({ t: "got", team, shots: buff.shots, ttl: buff.t });
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
    const { dx, dy } = aimFromKid(
      kid,
      this.state.kids,
      kid.x - grab.originX + grab.vx,
      kid.y - grab.originY + grab.vy,
      false,
      this.state.godSpeed && kid.team === "red",
    );
    const delay = this.netRole === "host" ? this.hostDelayMs() : 0;
    if (delay > 0) {
      this.commitThrow(kid, seconds, dx, dy, true, true);
      this.throwQ.push({ at: performance.now() + delay, id: kid.id, hold: seconds, dx, dy, ghost: true });
      return;
    }
    this.commitThrow(kid, seconds, dx, dy, this.netRole === "guest");
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
        if (this.selfPacked && !this.matchStarted) this.sendNet({ t: "packed" });
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
      if (!this.versus && (this.state.phase === "intro" || this.state.phase === "fight")) {
        this.runMs += dt * 1000;
      }
      this.acc += dt;
      let steps = 0;
      while (this.acc >= FIXED_DT && steps < 5) {
        this.step(FIXED_DT);
        this.acc -= FIXED_DT;
        steps++;
      }
      this.clampOwnTeam();
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

    const hostNet = this.netRole === "host" && (this.netStatus === "live" || this.netStatus === "rematch");
    if (hostNet && (this.screen === "playing" || this.screen === "gameover")) {
      this.flushThrowQ();
      this.flushGuestInQ();
      this.snapAcc += dt;
      this.keyframeAcc += dt;
      const rtt = this.p2p?.rttMs ?? 80;
      const interval = this.p2p?.rtcOpen ? (rtt < 50 ? 0.05 : 0.07) : 0.14;
      if (this.snapAcc >= interval) {
        this.snapAcc = 0;
        this.sendPose();
      }
      if (this.screen === "playing" && this.keyframeAcc >= 1.2) {
        this.keyframeAcc = 0;
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
    if (this.state.buffs.red || this.state.buffs.green || this.state.pickup) {
      this.buffHudAcc += dt;
      if (this.buffHudAcc >= 0.08) {
        this.buffHudAcc = 0;
        this.emit();
      }
    } else {
      this.buffHudAcc = 0;
    }

    this.audio.tick(dt);
    this.tickCount();
    if (this.versus && !this.botTakeover) {
      if (this.netRole === "host") this.sampleKids();
      this.interpolateViews();
    } else {
      for (const kid of this.state.kids) {
        kid.viewX = kid.x;
        kid.viewY = kid.y;
      }
    }
    if (this.screen !== "title") this.draw();
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

  private updateHitTier() {
    const rtt = this.p2p?.rttMs;
    if (rtt == null || rtt < 0) return;
    this.rttSmooth = this.rttSmooth <= 0 ? rtt : this.rttSmooth * 0.8 + rtt * 0.2;
    const now = performance.now();
    const want: "tight" | "mid" | "loose" =
      this.rttSmooth >= 120 ? "loose" : this.rttSmooth >= 55 ? "mid" : "tight";
    const rank = { tight: 0, mid: 1, loose: 2 } as const;
    if (rank[want] > rank[this.hitTier]) {
      this.hitTier = want;
      this.hitTierHoldUntil = now + 2000;
    } else if (rank[want] < rank[this.hitTier]) {
      if (now >= this.hitTierHoldUntil) this.hitTier = want;
    } else {
      this.hitTierHoldUntil = now + 2000;
    }
  }

  private aimPoint(kid: Kid) {
    const ahead = Math.min(0.12, (this.rttSmooth || this.p2p?.rttMs || 80) / 2000);
    const hist = this.poseHist;
    let vx = 0;
    let vy = 0;
    if (hist.length >= 2) {
      const a = hist[hist.length - 2]!;
      const b = hist[hist.length - 1]!;
      const ka = a.kids.get(kid.id);
      const kb = b.kids.get(kid.id);
      const dt = (b.t - a.t) / 1000;
      if (ka && kb && dt > 0.012) {
        vx = (kb.x - ka.x) / dt;
        vy = (kb.y - ka.y) / dt;
      }
    }
    return { x: kid.x + vx * ahead, y: kid.y + vy * ahead };
  }

  private flyPredictedBalls(dt: number) {
    for (const b of this.state.balls) {
      if (!b.alive) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.traveled += Math.hypot(b.vx, b.vy) * dt;
      b.spin += dt * 10;
      if (b.traveled >= b.range || b.x < -40 || b.x > WORLD_W + 40 || b.y < -20 || b.y > WORLD_H + 20) {
        b.alive = false;
        burst(this.state, b.x, b.y, 0, 10, "spark");
      }
    }
  }

  private predictLocalHits() {
    if (this.versus) {
      this.updateHitTier();
      if (this.hitTier === "tight") return;
      const hitR = playFeel(this.canvas.clientWidth).hit * (this.hitTier === "mid" ? 0.68 : 0.82);
      for (const ball of this.state.balls) {
        if (!ball.alive || ball.ghost || ball.team !== this.seat) continue;
        for (const kid of this.state.kids) {
          if (isOut(kid) || kid.team === ball.team) continue;
          if (this.predHits.some((p) => p.id === kid.id)) continue;
          const aim = this.aimPoint(kid);
          const dx = aim.x - ball.x;
          const dy = aim.y - 10 - ball.y;
          const r = hitR + ball.r;
          if (dx * dx + dy * dy > r * r) continue;
          const closing = (ball.vx * dx + ball.vy * dy) / (Math.hypot(dx, dy) || 1);
          if (closing < 40) continue;
          burst(this.state, kid.x, kid.y, 0, this.hitTier === "loose" ? 10 : 7, "spark");
          kid.flash = 0.12;
          if (this.hitTier === "loose" && kid.state !== "buried") {
            this.predHits.push({ id: kid.id, at: performance.now(), hp: kid.hp, state: kid.state, kind: "pose" });
            kid.state = "hurt";
            kid.stateT = 0.28;
            kid.stun = 0.12;
          } else {
            this.predHits.push({ id: kid.id, at: performance.now(), hp: kid.hp, state: kid.state, kind: "spark" });
          }
          break;
        }
      }
      return;
    }
    const hitR = playFeel(this.canvas.clientWidth).hit;
    for (const ball of this.state.balls) {
      if (!ball.alive || !ball.local || ball.ghost) continue;
      for (const kid of this.state.kids) {
        if (isOut(kid) || kid.team === ball.team) continue;
        if (this.predHits.some((p) => p.id === kid.id)) continue;
        const dx = kid.x - ball.x;
        const dy = kid.y - 10 - ball.y;
        const r = hitR + ball.r;
        if (dx * dx + dy * dy > r * r) continue;
        ball.alive = false;
        this.predHits.push({ id: kid.id, at: performance.now(), hp: kid.hp, state: kid.state, kind: "sfx" });
        kid.flash = 0.16;
        kid.state = "hurt";
        kid.stateT = 0.35;
        kid.stun = 0.2;
        burst(this.state, kid.x, kid.y, 0, 12, "spark");
        this.audio.hit();
        this.audio.splat();
        break;
      }
    }
  }

  private expirePredHits() {
    const now = performance.now();
    const wait = this.versus ? Math.max(280, (this.rttSmooth || 90) + 80) : 140;
    this.predHits = this.predHits.filter((p) => {
      if (now - p.at < wait) return true;
      if (p.kind === "pose") {
        const kid = this.state.kids.find((k) => k.id === p.id);
        if (kid && kid.hp === p.hp && kid.state === "hurt") {
          kid.state = p.state === "hurt" ? "idle" : p.state;
          kid.flash = 0;
          kid.stun = 0;
        }
      }
      return false;
    });
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
            t0: performance.now(),
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
      this.predictLocalHits();
      this.expirePredHits();
      stepPresentation(this.state, dt);
      stepPickups(this.state, dt, false);
      this.clampOwnTeam();
      faceNearest(this.state, this.seat);
      this.sendAllyPose();
      return;
    }

    const redMode = this.botTakeover && this.seat === "green" ? "attack" : this.allyMode;
    stepAi(
      this.state,
      dt,
      (power, kid) => {
        this.audio.throw(power);
        this.broadcastThrow(kid);
      },
      redMode,
      this.greenControl(),
      false,
      this.difficulty === "hard" && !this.versus,
    );
    const hpBefore = new Map(this.state.kids.map((k) => [k.id, k.hp]));
    const hadPickup = !!this.state.pickup;
    const hadBuff = {
      red: this.state.buffs.red ? { ...this.state.buffs.red } : null,
      green: this.state.buffs.green ? { ...this.state.buffs.green } : null,
    };
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
        if (this.netRole === "host" && this.versus) {
          for (const k of this.state.kids) {
            const prev = hpBefore.get(k.id);
            if (prev != null && k.hp !== prev) {
              this.sendNet({ t: "hit", id: k.id, hp: k.hp, heavy: heavy || k.hp <= 0 });
            }
          }
          this.sendPose();
        }
      },
      {
        onClash: () => this.audio.clash(),
        onFort: () => this.audio.fort(),
      },
    );
    this.syncLoot(hadPickup, hadBuff);
    this.handleOutcome();
  }

  private syncLoot(
    hadPickup: boolean,
    hadBuff: { red: { shots: number; t: number } | null; green: { shots: number; t: number } | null },
  ) {
    if (this.netRole !== "host" || !this.versus || this.botTakeover) return;
    const orb = this.state.pickup;
    if (orb && !hadPickup) this.sendNet({ t: "loot", x: orb.x, y: orb.y, life: orb.life });
    if (!orb && hadPickup) this.sendNet({ t: "loot" });
    for (const team of ["red", "green"] as const) {
      const now = this.state.buffs[team];
      const prev = hadBuff[team];
      if (now && (!prev || prev.shots !== now.shots)) {
        this.sendNet({ t: "got", team, shots: now.shots, ttl: now.t });
      } else if (!now && prev) {
        this.sendNet({ t: "got", team, shots: 0, ttl: 0 });
      }
    }
  }

  private recordClear() {
    const ms = Math.max(1, Math.round(this.runMs));
    if (this.difficulty === "hard") {
      if (this.clearHardMs == null || ms < this.clearHardMs) {
        this.clearHardMs = ms;
        this.clearHardStar = this.godSpeed;
      }
    } else if (this.clearEasyMs == null || ms < this.clearEasyMs) {
      this.clearEasyMs = ms;
      this.clearEasyStar = this.godSpeed;
    }
    this.best = Math.max(this.best, AI_WIN_LEVEL);
    this.persistSave();
  }

  private handleOutcome() {
    if (this.outcomeHandled) return;
    if (this.versus && this.netRole === "guest" && !this.botTakeover) return;
    if (this.state.phase === "won") {
      if (this.versus) {
        this.godSpeed = false;
        this.state.godSpeed = false;
        this.applyHostWinner("red");
        if (this.netRole === "host") this.sendOver();
        return;
      }
      this.outcomeHandled = true;
      this.audio.win();
      if (this.state.level >= AI_WIN_LEVEL) {
        this.godSpeed = false;
        this.state.godSpeed = false;
        this.recordClear();
        this.versusResult = "win";
        this.screen = "gameover";
        this.emit();
        return;
      }
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
        this.godSpeed = false;
        this.state.godSpeed = false;
        this.applyHostWinner("green");
        if (this.netRole === "host") this.sendOver();
        return;
      }
      this.outcomeHandled = true;
      this.audio.lose();
      this.godSpeed = false;
      this.state.godSpeed = false;
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
      godSpeed: this.state.godSpeed,
      bigCharge: !!(this.state.buffs[this.myTeam()] && this.state.buffs[this.myTeam()]!.shots > 0 && this.state.buffs[this.myTeam()]!.t > 0),
    };
    render(this.ctx, this.canvas, this.state, this.assets, view);
  }

  private emit() {
    this.onUi({
      screen: this.screen,
      level: this.state.level,
      best: this.best,
      clearEasyMs: this.clearEasyMs,
      clearHardMs: this.clearHardMs,
      clearEasyStar: this.clearEasyStar,
      clearHardStar: this.clearHardStar,
      redAlive: living(this.state.kids, "red").length,
      greenAlive: living(this.state.kids, "green").length,
      greenTotal: this.state.kids.filter((k) => k.team === "green").length,
      muted: this.audio.muted,
      ready: this.loaded,
      loadDone: this.loadDone,
      loadTotal: this.loadTotal,
      allyMode: this.allyMode,
      difficulty: this.versus ? "easy" : this.difficulty,
      godSpeed: this.godSpeed,
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
      pickup: this.pickupUi(),
    });
  }

  private pickupUi() {
    const mine = this.state.buffs[this.myTeam()];
    const held = !!(mine && mine.shots > 0 && mine.t > 0);
    const field = !!this.state.pickup;
    const other = this.myTeam() === "red" ? this.state.buffs.green : this.state.buffs.red;
    const foeHeld = !!(this.versus && other && other.shots > 0 && other.t > 0);
    if (!held && !field && !foeHeld) return null;
    return {
      field,
      held,
      foeHeld,
      life: held ? mine!.t : this.state.pickup ? this.state.pickup.life : other!.t,
      maxLife: held ? BIG_HELD_TIME : this.state.pickup ? this.state.pickup.maxLife : BIG_HELD_TIME,
      shots: held ? mine!.shots : 0,
      maxShots: BIG_SHOTS,
    };
  }
}
