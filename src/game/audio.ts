export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicTimer = 0;
  private musicOn = false;
  muted = false;

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx.gain.value = 0.7;
      this.music.gain.value = 0.12;
      this.sfx.connect(this.master);
      this.music.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise(1.2);
      this.applyMute();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
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
    this.musicOn = true;
  }

  stopMusic() {
    this.musicOn = false;
  }

  tick(dt: number) {
    if (!this.musicOn || !this.ctx || this.muted) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 1.6 + Math.random() * 1.4;
    const notes = [196, 246.9, 293.7, 329.6, 392];
    const f = notes[(Math.random() * notes.length) | 0]!;
    this.tone(f, 0.7, "triangle", 0.035, this.music);
  }

  grab() {
    this.tone(620, 0.06, "sine", 0.07);
  }

  throw(power: number) {
    this.whoosh(0.12 + power * 0.1, 0.18 + power * 0.12);
    this.tone(180 + power * 80, 0.1, "sine", 0.08);
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
    this.tone(140, 0.14, "triangle", 0.2);
    this.whoosh(0.05, 0.12, 600);
  }

  bury() {
    this.tone(80, 0.28, "sine", 0.22);
    this.whoosh(0.16, 0.28, 400);
  }

  win() {
    [262, 330, 392, 523].forEach((f, i) => {
      window.setTimeout(() => this.tone(f, 0.22, "triangle", 0.12), i * 110);
    });
  }

  lose() {
    [220, 196, 164, 130].forEach((f, i) => {
      window.setTimeout(() => this.tone(f, 0.28, "sine", 0.12), i * 140);
    });
  }

  count(n: number) {
    const f = n <= 1 ? 660 : n === 2 ? 494 : 392;
    this.tone(f, 0.18, "triangle", 0.12);
  }

  go() {
    this.tone(784, 0.22, "triangle", 0.14);
  }

  level() {
    this.tone(392, 0.16, "triangle", 0.1);
    window.setTimeout(() => this.tone(523, 0.2, "triangle", 0.1), 90);
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
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.6), t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(bus ?? this.sfx);
    osc.start(t);
    osc.stop(t + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }
}
