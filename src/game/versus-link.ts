import { P2PRoom, type PeerInfo } from "@/lib/multiplayer";
import { isNetMsg, type NetMsg } from "./net";
import { RoomChannel, type RoomPeer } from "./room-channel";

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

  private http: RoomChannel;
  private rtc: P2PRoom;
  private seq = 1;
  private snapSeq = 1;
  private lastIn = 0;
  private lastSnap = 0;
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
    const n = unreliable ? (kind === "snap" ? this.snapSeq++ : 0) : this.seq++;
    const wire: Envelope = { n, m: msg };
    if (this.rtcOpen) {
      if (unreliable) this.rtc.broadcast(wire);
      else this.rtc.send(wire);
      return;
    }
    this.http.send(wire);
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
    const env = asEnvelope(data);
    if (!env) return;
    if (env.m.t === "ping") {
      this.send({ t: "pong", t0: env.m.t0 } as NetMsg, "pose");
      return;
    }
    if (env.m.t === "pong") {
      const rtt = performance.now() - env.m.t0;
      if (Number.isFinite(rtt) && rtt >= 0 && rtt < 2000) this.rttMs = Math.round(rtt);
      return;
    }
    if (env.m.t === "snap") {
      if (env.n > 0 && env.n < this.lastSnap) return;
      if (env.n > 0) this.lastSnap = env.n;
      onMessage(env.m);
      return;
    }
    if (env.n > 0 && env.n <= this.lastIn) return;
    if (env.n > 0) this.lastIn = env.n;
    onMessage(env.m);
  }

  private onRtcPeers(peers: PeerInfo[], onRtc?: (open: boolean) => void) {
    const live = peers.find((p) => p.connectionState === "connected");
    const open = !!live && !this.iceGaveUp;
    if (live?.rttMs != null) this.rttMs = live.rttMs;
    const trying = peers.some(
      (p) => p.connectionState === "connecting" || p.connectionState === "new",
    );
    const now = Date.now();
    if (open) {
      this.checkingSince = 0;
      this.iceTried = false;
    } else if (trying) {
      if (!this.checkingSince) this.checkingSince = now;
      const waited = now - this.checkingSince;
      if (waited > 2000 && !this.iceTried) {
        this.iceTried = true;
        this.rtc.restartIce();
      }
      if (waited > 4500 && !this.iceGaveUp) {
        this.iceGaveUp = true;
        this.rtc.close();
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
