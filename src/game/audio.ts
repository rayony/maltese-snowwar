/** Original holiday loops (Web Audio) — not copyrighted carols. */

type MusicTrack = "off" | "play" | "menu";

const PLAY_BPM = 108;
const PLAY_EIGHTH = 60 / PLAY_BPM / 2;
const MENU_BPM = 76;
const MENU_EIGHTH = 60 / MENU_BPM / 2;

// 8 bars of 3/4 (6 eighths). Battle waltz in C.
const PLAY_MELODY = [
  523, 659, 784, 880, 784, 659, 698, 659, 587, 523, 0, 0, 659, 784, 1047, 988, 880, 784, 698, 784, 659, 587, 523, 0, 523, 587, 659, 698, 784, 659, 587, 523, 494, 440, 0, 0, 392, 523, 659, 784, 659, 523, 587, 523, 392, 523, 0, 0,
];
const PLAY_BASS = [
  130.8, 0, 0, 0, 0, 0, 174.6, 0, 0, 0, 0, 0, 196.0, 0, 0, 0, 0, 0, 130.8, 0, 0, 0, 0, 0, 110.0, 0, 0, 0, 0, 0, 174.6, 0, 0, 0, 0, 0, 196.0, 0, 0, 0, 0, 0, 130.8, 0, 0, 0, 0, 0,
];

// Music-box lullaby in G, 4/4, slower — title + lobby only.
const MENU_MELODY = [
  392, 0, 494, 0, 587, 0, 784, 0, 659, 0, 587, 494, 392, 0, 0, 0, 494, 0, 587, 0, 659, 0, 784, 880, 784, 0, 659, 587, 494, 0, 392, 0, 330, 0, 392, 494, 587, 0, 659, 0, 784, 0, 659, 587, 523, 494, 392, 0,
];
const MENU_BASS = [
  98, 0, 0, 0, 0, 0, 0, 0, 147, 0, 0, 0, 0, 0, 0, 0, 130.8, 0, 0, 0, 0, 0, 0, 0, 147, 0, 0, 0, 98, 0, 0, 0, 82.4, 0, 0, 0, 0, 0, 0, 0, 98, 0, 0, 0, 73.4, 0, 98, 0,
];

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicOn = false;
  private musicNext = 0;
  private musicStep = 0;
  private track: MusicTrack = "off";
  muted = false;

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ios = /iP(ad|hone|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      this.ctx = ios ? new Ctx() : new Ctx({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx.gain.value = 0.72;
      this.music.gain.value = 0.28;
      this.sfx.connect(this.master);
      this.music.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise(1.2);
      this.applyMute();
    }
    const kick = () => {
      if (!this.ctx || !this.musicOn || this.track === "off") return;
      this.musicNext = this.ctx.currentTime + 0.04;
      if (this.music) {
        this.music.gain.setTargetAtTime(this.track === "menu" ? 0.28 : 0.22, this.ctx.currentTime, 0.05);
      }
    };
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().then(kick);
    } else {
      kick();
    }
    this.chirp();
  }

  /** iOS / in-app browsers need a real buffer start() inside the gesture. */
  private chirp() {
    if (!this.ctx || this.muted) return;
    try {
      const buf = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(0);
    } catch {
      /* ignore */
    }
  }

  setMuted(v: boolean) {
    this.muted = v;
    this.applyMute();
  }

  private applyMute() {
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.03);
  }

  startMusic() {
    this.beginTrack("play");
  }

  startMenuMusic() {
    this.beginTrack("menu");
  }

  stopMusic() {
    this.musicOn = false;
    this.track = "off";
  }

  private beginTrack(track: "play" | "menu") {
    // Same track already requested — do not reset the sequencer on double-tap.
    // Requiring AudioContext "running" used to re-arm the loop while resume()
    // was still pending, so a second click restarted BGM from bar 1.
    if (this.track === track && this.musicOn) return;
    this.track = track;
    this.musicOn = true;
    this.musicStep = 0;
    if (this.ctx) {
      this.musicNext = this.ctx.currentTime + 0.06;
      if (this.music) this.music.gain.setTargetAtTime(track === "menu" ? 0.28 : 0.22, this.ctx.currentTime, 0.05);
    }
  }

  tick(_dt: number) {
    if (!this.musicOn || this.track === "off" || this.muted) return;
    if (!this.ctx) return;
    if (this.ctx.state !== "running") {
      void this.ctx.resume();
      return;
    }
    const eighth = this.track === "menu" ? MENU_EIGHTH : PLAY_EIGHTH;
    const len = this.track === "menu" ? MENU_MELODY.length : PLAY_MELODY.length;
    const ahead = this.ctx.currentTime + 0.9;
    while (this.musicNext < ahead) {
      this.playMusicStep(this.musicNext, this.musicStep);
      this.musicStep = (this.musicStep + 1) % len;
      this.musicNext += eighth;
    }
  }

  grab() {
    this.tone(620, 0.06, "sine", 0.07);
  }

  throw(power: number) {
    this.whoosh(0.12 + power * 0.1, 0.18 + power * 0.12);
    this.tone(180 + power * 80, 0.1, "sine", 0.08);
  }

  sweet() {
    this.tone(880, 0.07, "sine", 0.11);
    this.tone(1320, 0.09, "triangle", 0.07);
    this.whoosh(0.05, 0.12, 1600);
  }

  /** Plays once when the hold ring enters the sweet band. */
  sweetCue() {
    this.tone(740, 0.05, "sine", 0.09);
    this.tone(988, 0.08, "triangle", 0.06);
  }

  splat() {
    this.whoosh(0.08, 0.22, 900);
    this.tone(90 + Math.random() * 30, 0.12, "triangle", 0.16);
  }

  clash() {
    this.whoosh(0.1, 0.2, 1200);
    this.tone(210, 0.08, "triangle", 0.14);
    this.tone(140, 0.1, "sine", 0.12);
  }

  fort() {
    this.whoosh(0.09, 0.16, 500);
    this.tone(110, 0.08, "sine", 0.1);
  }

  pack() {
    this.whoosh(0.06, 0.1, 400);
  }

  hit() {
    this.yap(760 + Math.random() * 80);
    window.setTimeout(() => this.yap(620 + Math.random() * 50), 72);
    this.whoosh(0.05, 0.1, 700);
  }

  bury() {
    this.yap(540);
    window.setTimeout(() => this.yap(430), 90);
    window.setTimeout(() => this.whine(), 150);
    this.whoosh(0.16, 0.22, 400);
  }

  win() {
    this.whistle();
    [262, 330, 392, 523].forEach((f, i) => {
      window.setTimeout(() => this.tone(f, 0.22, "triangle", 0.12), 90 + i * 110);
    });
  }

  lose() {
    this.whistle();
    [220, 196, 164, 130].forEach((f, i) => {
      window.setTimeout(() => this.tone(f, 0.28, "sine", 0.12), 90 + i * 140);
    });
  }

  /** Referee-style double blast at end of a heat. */
  private whistle() {
    if (!this.ctx || !this.sfx) return;
    this.blast();
    window.setTimeout(() => this.blast(), 160);
  }

  private blast() {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    g.connect(this.sfx);
    for (const freq of [1840, 2180]) {
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, t);
      const bp = this.ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = freq;
      bp.Q.value = 9;
      osc.connect(bp);
      bp.connect(g);
      osc.start(t);
      osc.stop(t + 0.24);
      osc.onended = () => {
        osc.disconnect();
        bp.disconnect();
      };
    }
    this.whoosh(0.08, 0.06, 2400);
  }

  count(n: number) {
    const f = n <= 1 ? 660 : n === 2 ? 494 : 392;
    this.tone(f, 0.18, "triangle", 0.12);
  }

  ding() {
    this.tone(1047, 0.08, "sine", 0.2);
    window.setTimeout(() => this.tone(1568, 0.18, "triangle", 0.18), 70);
  }

  go() {
    this.kickoff();
  }

  /** One referee tweet when 3-2-1 ends. */
  kickoff() {
    this.blast();
  }

  level() {
    this.tone(392, 0.16, "triangle", 0.1);
    window.setTimeout(() => this.tone(523, 0.2, "triangle", 0.1), 90);
  }

  private playMusicStep(t: number, step: number) {
    if (this.track === "menu") {
      const mel = MENU_MELODY[step] ?? 0;
      if (mel > 0) {
        this.toneAt(mel, MENU_EIGHTH * 2.4, "sine", 0.042, t, this.music);
        this.toneAt(mel * 2, MENU_EIGHTH * 1.4, "sine", 0.016, t, this.music);
      }
      const bass = MENU_BASS[step] ?? 0;
      if (bass > 0) this.toneAt(bass, MENU_EIGHTH * 7, "sine", 0.045, t, this.music);
      if (step % 16 === 0) this.chime(t, 0.02);
      return;
    }
    const mel = PLAY_MELODY[step] ?? 0;
    if (mel > 0) {
      this.toneAt(mel, PLAY_EIGHTH * 1.85, "triangle", 0.055, t, this.music);
      this.toneAt(mel * 2, PLAY_EIGHTH * 0.9, "sine", 0.018, t, this.music);
    }
    const bass = PLAY_BASS[step] ?? 0;
    if (bass > 0) {
      this.toneAt(bass, PLAY_EIGHTH * 5.2, "sine", 0.07, t, this.music);
      this.toneAt(bass * 2, PLAY_EIGHTH * 5.2, "triangle", 0.02, t, this.music);
    }
    if (step % 6 === 4) this.sleigh(t);
    if (step % 6 === 0) this.chime(t, 0.025);
  }

  private sleigh(t: number) {
    if (!this.ctx || !this.music || !this.noise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 3.2 + Math.random() * 0.6;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "highpass";
    bp.frequency.value = 2400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.music);
    src.start(t);
    src.stop(t + 0.1);
    src.onended = () => {
      src.disconnect();
      bp.disconnect();
      g.disconnect();
    };
  }

  private chime(t: number, gain: number) {
    this.toneAt(1568, 0.22, "sine", gain, t, this.music);
    this.toneAt(2093, 0.16, "sine", gain * 0.5, t, this.music);
  }

  /** Cute short yap — gliding sine + tiny noise burst. */
  private yap(base: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.glide(base, base * 1.45, 0.04, 0.14, t);
    this.glide(base * 1.4, base * 0.72, 0.07, 0.11, t + 0.035);
    this.whoosh(0.04, 0.07, 1600);
  }

  /** Longer sad/cute whimper for bury. */
  private whine() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.glide(420, 190, 0.38, 0.13, t);
    this.glide(840, 380, 0.28, 0.04, t);
  }

  private glide(from: number, to: number, duration: number, gain: number, t: number) {
    if (!this.ctx || !this.sfx) return;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(Math.max(40, from), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(this.sfx);
    osc.start(t);
    osc.stop(t + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  private makeNoise(seconds: number) {
    if (!this.ctx) return null;
    const n = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private whoosh(duration: number, gain: number, freq = 1400) {
    if (!this.ctx || !this.sfx || !this.noise) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfx);
    src.start(t);
    src.stop(t + duration + 0.02);
    src.onended = () => {
      src.disconnect();
      bp.disconnect();
      g.disconnect();
    };
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    bus?: GainNode | null,
  ) {
    if (!this.ctx) return;
    this.toneAt(freq, duration, type, gain, this.ctx.currentTime, bus ?? this.sfx);
  }

  private toneAt(
    freq: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    t: number,
    bus?: GainNode | null,
  ) {
    if (!this.ctx || !bus) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.92), t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }
}
