import { P2PRoom, type PeerInfo } from "@/lib/multiplayer";
import { isNetMsg, type NetMsg } from "./net";
import { RoomChannel, type RoomPeer } from "./room-channel";

export type Envelope = { n: number; m: NetMsg };

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
  private lastIn = 0;
  private closed = false;

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
  }

  setFast(fast: boolean) {
    this.http.setFast(fast && !this.rtcOpen);
  }

  send(msg: NetMsg, kind: "event" | "snap" = "event") {
    if (this.closed) return;
    const wire: Envelope = { n: this.seq++, m: msg };
    if (this.rtcOpen) {
      if (kind === "snap") this.rtc.broadcast(wire);
      else this.rtc.send(wire);
      return;
    }
    this.http.send(wire);
  }

  close() {
    this.closed = true;
    this.rtcOpen = false;
    this.http.close();
    this.rtc.close();
  }

  private ingest(data: unknown, onMessage: (msg: NetMsg) => void) {
    const env = asEnvelope(data);
    if (!env) return;
    if (env.n > 0 && env.n <= this.lastIn) return;
    if (env.n > 0) this.lastIn = env.n;
    onMessage(env.m);
  }

  private onRtcPeers(peers: PeerInfo[], onRtc?: (open: boolean) => void) {
    const live = peers.find((p) => p.connectionState === "connected");
    const open = !!live;
    this.rttMs = live?.rttMs ?? null;
    if (open !== this.rtcOpen) {
      this.rtcOpen = open;
      this.http.setFast(!open);
    }
    onRtc?.(open);
  }
}
