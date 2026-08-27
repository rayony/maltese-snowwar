import { P2PRoom, type PeerInfo } from "@/lib/multiplayer";
import { isNetMsg, type NetMsg } from "./net";
import { RoomChannel, type RoomPeer } from "./room-channel";
import { decodeWire, encodeWire } from "./wire";

export type Envelope = { n: number; m: NetMsg };
export type SendKind = "event" | "snap" | "pose";

function asEnvelope(data: unknown): Envelope | null {
  if (!data || typeof data !== "object") return null;
  const rec = data as { n?: unknown; m?: unknown };
  if (typeof rec.n === "number" && isNetMsg(rec.m)) return { n: rec.n, m: rec.m };
  if (isNetMsg(data)) return { n: 0, m: data };
  return null;
}

export class VersusLink {
  readonly selfId: string;
  readonly room: string;
  rtcOpen = false;
  rttMs: number | null = null;
  /** peerTime - localTime. peerNow ≈ localNow + clockOffset */
  clockOffset = 0;

  private http: RoomChannel;
  private rtc: P2PRoom;
  private seq = 1;
  private snapSeq = 1;
  private poseSeq = 1;
  private lastIn = 0;
  private lastSnap = 0;
  private lastPose = 0;
  private closed = false;
  private iceTried = false;
  private iceGaveUp = false;
  private checkingSince = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: {
    room: string;
    selfId: string;
    name: string;
    onPeers: (peers: RoomPeer[]) => void;
    onMessage: (msg: NetMsg) => void;
    onError?: (message: string) => void;
    onRtc?: (open: boolean) => void;
  }) {
    this.room = opts.room;
    this.selfId = opts.selfId;

    this.http = new RoomChannel({
      room: opts.room,
      selfId: opts.selfId,
      name: opts.name,
      onPeers: opts.onPeers,
      onMessage: (_from, data) => this.ingest(data, opts.onMessage),
      onError: opts.onError,
    });

    this.rtc = new P2PRoom({
      room: opts.room,
      selfId: opts.selfId,
      name: opts.name,
      onPeersChanged: (peers) => this.onRtcPeers(peers, opts.onRtc),
      onMessage: (_from, data) => this.ingest(data, opts.onMessage),
    });
  }

  async join() {
    await Promise.all([this.http.join(), this.rtc.join()]);
    this.pingTimer = setInterval(() => this.ping(), 2000);
  }

  setFast(fast: boolean) {
    this.http.setFast(fast && !this.rtcOpen);
  }

  send(msg: NetMsg, kind: SendKind = "event") {
    if (this.closed) return;
    const unreliable = kind === "pose" || kind === "snap";
    const n = unreliable
      ? kind === "snap"
        ? this.snapSeq++
        : this.poseSeq++
      : this.seq++;
    const dc = this.rtc.dcReady();
    this.rtcOpen = dc && !this.iceGaveUp;
    if (dc && (msg.t === "pose" || msg.t === "allypose")) {
      const bin = encodeWire(n, msg);
      if (bin) {
        this.rtc.broadcastRaw(bin);
        return;
      }
    }
    const wire: Envelope = { n, m: msg };
    if (dc) {
      if (unreliable) {
        this.rtc.broadcast(wire);
        this.rtc.send(wire);
      } else {
        this.rtc.send(wire);
        const t = msg.t;
        if (t === "over" || t === "start" || t === "rematch" || t === "throw" || t === "hit" || t === "packed" || t === "loot" || t === "got") {
          this.rtc.broadcast(wire);
          this.http.send(wire);
        }
      }
      return;
    }
    this.http.send(wire);
  }

  /** Mid-match Wi-Fi→cell: refresh ICE without tearing the room down. */
  restartIce() {
    this.iceGaveUp = false;
    this.iceTried = false;
    this.checkingSince = Date.now();
    this.rtc.restartIce();
  }

  close() {
    this.closed = true;
    this.rtcOpen = false;
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.http.close();
    this.rtc.close();
  }

  private ping() {
    if (this.closed) return;
    this.send({ t: "ping", t0: performance.now() } as NetMsg, "pose");
  }

  private ingest(data: unknown, onMessage: (msg: NetMsg) => void) {
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      const decoded = decodeWire(data);
      if (decoded) this.ingest(decoded, onMessage);
      return;
    }
    const env = asEnvelope(data);
    if (!env) return;
    if (env.m.t === "ping") {
      this.send({ t: "pong", t0: env.m.t0, t1: performance.now() } as NetMsg, "pose");
      return;
    }
    if (env.m.t === "pong") {
      const now = performance.now();
      const rtt = now - env.m.t0;
      if (Number.isFinite(rtt) && rtt >= 0 && rtt < 2000) this.rttMs = Math.round(rtt);
      if (typeof env.m.t1 === "number" && Number.isFinite(rtt)) {
        const sample = env.m.t1 + rtt / 2 - now;
        this.clockOffset = this.clockOffset === 0 ? sample : this.clockOffset * 0.72 + sample * 0.28;
      }
      return;
    }
    if (env.m.t === "over" || env.m.t === "start" || env.m.t === "rematch" || env.m.t === "packed" || env.m.t === "bye" || env.m.t === "bot") {
      if (env.n > this.lastIn) this.lastIn = env.n;
      onMessage(env.m);
      return;
    }
    if (env.m.t === "snap") {
      if (env.n > 0 && env.n < this.lastSnap) return;
      if (env.n > 0) this.lastSnap = env.n;
      onMessage(env.m);
      return;
    }
    const poseStream =
      env.m.t === "pose" ||
      env.m.t === "allypose" ||
      env.m.t === "hb" ||
      (env.m.t === "input" && env.m.kind === "move");
    if (poseStream) {
      if (env.n > 0 && env.n < this.lastPose) return;
      if (env.n > 0) this.lastPose = env.n;
      onMessage(env.m);
      return;
    }
    if (env.n > 0 && env.n <= this.lastIn) return;
    if (env.n > 0) this.lastIn = env.n;
    onMessage(env.m);
  }

  private onRtcPeers(peers: PeerInfo[], onRtc?: (open: boolean) => void) {
    const live = peers.find((p) => p.connectionState === "connected");
    const open = !!live && !this.iceGaveUp && this.rtc.dcReady();
    if (live?.rttMs != null) this.rttMs = live.rttMs;
    const trying = peers.some(
      (p) => p.connectionState === "connecting" || p.connectionState === "new",
    );
    const now = Date.now();
    if (open) {
      this.checkingSince = 0;
      this.iceTried = false;
      this.iceGaveUp = false;
    } else if (trying) {
      if (!this.checkingSince) this.checkingSince = now;
      const waited = now - this.checkingSince;
      if (waited > 2000 && !this.iceTried) {
        this.iceTried = true;
        this.rtc.restartIce();
      }
      if (waited > 4500 && !this.iceGaveUp) {
        this.iceGaveUp = true;
        this.rtc.restartIce();
      }
    }
    if (open === this.rtcOpen && !this.iceGaveUp) {
      onRtc?.(open);
      return;
    }
    this.rtcOpen = open;
    this.http.setFast(!open);
    onRtc?.(open);
  }
}
