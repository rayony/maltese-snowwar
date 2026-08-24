/**
 * Room bus: SSE push when the server supports it, HTTP poll as fallback.
 */
export interface RoomPeer {
  id: string;
  name: string;
}

export interface RoomChannelOptions {
  room: string;
  selfId: string;
  name: string;
  onPeers: (peers: RoomPeer[]) => void;
  onMessage: (from: string, data: unknown) => void;
  onError?: (message: string) => void;
}

const LOBBY_MS = 350;
const PLAY_MS = 40;

export class RoomChannel {
  private readonly opts: RoomChannelOptions;
  private cursor = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private fast = false;
  private sawJoin = false;
  private es: EventSource | null = null;
  private abort: AbortController | null = null;

  constructor(opts: RoomChannelOptions) {
    this.opts = opts;
  }

  setFast(fast: boolean) {
    this.fast = fast;
  }

  async join() {
    try {
      await this.pollOnce();
    } catch (err) {
      this.opts.onError?.(err instanceof Error ? err.message : "Room server unreachable");
    }
    if (this.closed) return;
    if (!this.openSse()) this.schedule(this.fast ? PLAY_MS : LOBBY_MS);
  }

  close() {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.es?.close();
    this.es = null;
    this.abort?.abort();
    void fetch("/api/rtc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "leave", room: this.opts.room, peer: this.opts.selfId }),
      keepalive: true,
    }).catch(() => {});
  }

  send(data: unknown) {
    if (this.closed) return;
    void this.postData(data);
  }

  private openSse() {
    try {
      const params = new URLSearchParams({
        sse: "1",
        room: this.opts.room,
        peer: this.opts.selfId,
        name: this.opts.name,
        bus: String(this.cursor),
      });
      const es = new EventSource(`/api/rtc?${params}`);
      this.es = es;
      es.onmessage = (ev) => {
        if (this.closed) return;
        try {
          const body = JSON.parse(ev.data) as {
            peers?: RoomPeer[];
            bus?: { id: number; from: string; payload: unknown }[];
          };
          this.opts.onPeers((body.peers ?? []).filter((p) => p.id !== this.opts.selfId));
          for (const msg of body.bus ?? []) {
            this.cursor = Math.max(this.cursor, msg.id);
            this.opts.onMessage(msg.from, msg.payload);
          }
        } catch {
          /* skip */
        }
      };
      es.onerror = () => {
        if (this.closed) return;
        es.close();
        this.es = null;
        if (!this.timer) this.schedule(this.fast ? PLAY_MS : LOBBY_MS);
      };
      return true;
    } catch {
      return false;
    }
  }

  private async postData(data: unknown) {
    try {
      await fetch("/api/rtc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          op: "data",
          room: this.opts.room,
          from: this.opts.selfId,
          payload: data,
        }),
      });
    } catch {
      /* next poll retries presence */
    }
  }

  private schedule(delay: number) {
    if (this.closed || this.es) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.poll(), delay);
  }

  private async poll() {
    if (this.closed || this.es) return;
    try {
      await this.pollOnce();
    } catch {
      /* transient */
    }
    this.schedule(this.fast ? PLAY_MS : LOBBY_MS);
  }

  private async pollOnce() {
    const params = new URLSearchParams({
      room: this.opts.room,
      peer: this.opts.selfId,
      name: this.opts.name,
      since: this.sawJoin ? "999999999" : "0",
      bus: String(this.cursor),
    });
    const res = await fetch(`/api/rtc?${params}`);
    if (this.closed) return;
    if (!res.ok) throw new Error(`room poll ${res.status}`);
    this.sawJoin = true;
    const body = (await res.json()) as {
      peers?: RoomPeer[];
      bus?: { id: number; from: string; payload: unknown }[];
    };
    if (this.closed) return;
    this.opts.onPeers((body.peers ?? []).filter((p) => p.id !== this.opts.selfId));
    for (const msg of body.bus ?? []) {
      this.cursor = Math.max(this.cursor, msg.id);
      this.opts.onMessage(msg.from, msg.payload);
    }
  }
}
