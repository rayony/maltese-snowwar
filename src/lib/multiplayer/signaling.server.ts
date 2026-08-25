/**
 * WebRTC signaling over the app database (Neon deployed, PGLite in preview).
 * Only rendezvous traffic passes through here — roster + SDP/ICE relay while a
 * mesh forms; game data then flows peer-to-peer.
 */
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import type { PeerRow, RtcPollResponse, SignalRow } from "./p2p";

const ID = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const signalSchema = z.object({
  op: z.literal("signal"),
  room: ID,
  from: ID,
  to: ID,
  kind: z.enum(["offer", "answer", "ice"]),
  payload: z.unknown().refine((v) => v !== undefined && JSON.stringify(v).length <= 32_768, {
    message: "payload too large",
  }),
});
const leaveSchema = z.object({ op: z.literal("leave"), room: ID, peer: ID });
const dataSchema = z.object({
  op: z.literal("data"),
  room: ID,
  from: ID,
  payload: z.unknown().refine((v) => v !== undefined && JSON.stringify(v).length <= 48_000, {
    message: "payload too large",
  }),
});
const postSchema = z.discriminatedUnion("op", [signalSchema, leaveSchema, dataSchema]);

const PEER_TTL_SECONDS = 8;
const SIGNAL_TTL_SECONDS = 60;
const BUS_TTL_SECONDS = 8;

const globalRef = globalThis as typeof globalThis & {
  __rtcSchemaPromise2__?: Promise<void>;
};

function ensureSchema(sql: Sql): Promise<void> {
  globalRef.__rtcSchemaPromise2__ ??= (async () => {
    await sql.query(
      `CREATE TABLE IF NOT EXISTS webrtc_peers (
         room TEXT NOT NULL,
         peer_id TEXT NOT NULL,
         name TEXT NOT NULL DEFAULT '',
         last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
         PRIMARY KEY (room, peer_id)
       )`,
    );
    await sql.query(
      `CREATE TABLE IF NOT EXISTS webrtc_signals (
         id BIGSERIAL PRIMARY KEY,
         room TEXT NOT NULL,
         to_peer TEXT NOT NULL,
         from_peer TEXT NOT NULL,
         kind TEXT NOT NULL,
         payload JSONB NOT NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    );
    await sql.query(
      `CREATE INDEX IF NOT EXISTS webrtc_signals_inbox
         ON webrtc_signals (room, to_peer, id)`,
    );
    await sql.query(
      `CREATE TABLE IF NOT EXISTS webrtc_bus (
         id BIGSERIAL PRIMARY KEY,
         room TEXT NOT NULL,
         from_peer TEXT NOT NULL,
         payload JSONB NOT NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    );
    await sql.query(
      `CREATE INDEX IF NOT EXISTS webrtc_bus_room_id
         ON webrtc_bus (room, id)`,
    );
  })().catch((err) => {
    globalRef.__rtcSchemaPromise2__ = undefined;
    throw err;
  });
  return globalRef.__rtcSchemaPromise2__;
}

async function roster(sql: Sql, room: string): Promise<PeerRow[]> {
  const rows = await sql.query<{ peer_id: string; name: string }>(
    `SELECT peer_id, name FROM webrtc_peers
     WHERE room = $1 AND last_seen > now() - make_interval(secs => $2)
     ORDER BY peer_id LIMIT 32`,
    [room, PEER_TTL_SECONDS],
  );
  return rows.map((r) => ({ id: r.peer_id, name: r.name }));
}

async function touchPeer(sql: Sql, room: string, peer: string, name: string) {
  await sql.query(
    `INSERT INTO webrtc_peers (room, peer_id, name, last_seen)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (room, peer_id)
     DO UPDATE SET last_seen = now(), name = EXCLUDED.name`,
    [room, peer, name],
  );
}

async function prune(sql: Sql) {
  await Promise.all([
    sql.query(`DELETE FROM webrtc_signals WHERE created_at < now() - make_interval(secs => $1)`, [
      SIGNAL_TTL_SECONDS,
    ]),
    sql.query(`DELETE FROM webrtc_peers WHERE last_seen < now() - make_interval(secs => $1)`, [
      PEER_TTL_SECONDS,
    ]),
    sql.query(`DELETE FROM webrtc_bus WHERE created_at < now() - make_interval(secs => $1)`, [
      BUS_TTL_SECONDS,
    ]),
  ]);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function iceServersFromEnv(): RTCIceServer[] {
  const stun = (process.env.VITE_STUN_URLS ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  const servers: RTCIceServer[] = [
    {
      urls: stun.length ? stun : ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"],
    },
  ];
  const turnUrls = (process.env.TURN_URLS ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  const username = process.env.TURN_USERNAME?.trim();
  const credential = process.env.TURN_CREDENTIAL?.trim();
  if (turnUrls.length && username && credential) {
    servers.push({ urls: turnUrls, username, credential });
  }
  return servers;
}

async function handleSse(url: URL, request: Request): Promise<Response> {
  const parsed = z
    .object({
      room: ID,
      peer: ID,
      name: z.string().max(64).default(""),
      bus: z.coerce.number().int().min(-1).default(0),
    })
    .safeParse({
      room: url.searchParams.get("room"),
      peer: url.searchParams.get("peer"),
      name: url.searchParams.get("name") ?? "",
      bus: url.searchParams.get("bus") ?? 0,
    });
  if (!parsed.success) return json({ error: "invalid query" }, 400);
  const { room, peer, name } = parsed.data;
  let cursor = parsed.data.bus;
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          closed = true;
        }
      };
      request.signal.addEventListener("abort", () => {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
      let lastTouch = 0;
      let lastRoster = 0;
      try {
        const sql = await getSql();
        await ensureSchema(sql);
        await touchPeer(sql, room, peer, name);
        lastTouch = Date.now();
        send({ peers: await roster(sql, room), bus: [] });
        while (!closed && !request.signal.aborted) {
          const now = Date.now();
          if (now - lastTouch > 1500) {
            await touchPeer(sql, room, peer, name);
            lastTouch = now;
          }
          const busRows = await sql.query<{ id: number; from_peer: string; payload: unknown }>(
            `SELECT id, from_peer, payload FROM webrtc_bus
             WHERE room = $1 AND id > $2 AND from_peer <> $3
             ORDER BY id LIMIT 80`,
            [room, cursor, peer],
          );
          const mapped = busRows.map((r) => ({ id: r.id, from: r.from_peer, payload: r.payload }));
          for (const row of mapped) cursor = Math.max(cursor, row.id);
          if (mapped.length || now - lastRoster > 1200) {
            lastRoster = now;
            send({ peers: await roster(sql, room), bus: mapped });
          }
          await new Promise((r) => setTimeout(r, 28));
        }
      } catch {
        closed = true;
      }
      try {
        controller.close();
      } catch {
        /* */
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

async function handleGet(url: URL): Promise<Response> {
  const parsed = z
    .object({
      room: ID,
      peer: ID,
      name: z.string().max(64).default(""),
      since: z.coerce.number().int().min(0).default(0),
      bus: z.coerce.number().int().min(-1).default(-1),
    })
    .safeParse({
      room: url.searchParams.get("room"),
      peer: url.searchParams.get("peer"),
      name: url.searchParams.get("name") ?? "",
      since: url.searchParams.get("since") ?? 0,
      bus: url.searchParams.get("bus") ?? -1,
    });
  if (!parsed.success) return json({ error: "invalid query" }, 400);
  const { room, peer, name, since, bus: busSince } = parsed.data;

  const sql = await getSql();
  await ensureSchema(sql);
  if (since === 0 || Math.random() < 0.02) await prune(sql);
  await touchPeer(sql, room, peer, name);
  const rows = await sql.query<{
    id: number;
    from_peer: string;
    kind: SignalRow["kind"];
    payload: unknown;
  }>(
    `SELECT id, from_peer, kind, payload FROM webrtc_signals
     WHERE room = $1 AND to_peer = $2 AND id > $3
     ORDER BY id LIMIT 200`,
    [room, peer, since],
  );
  const body: RtcPollResponse & { bus?: { id: number; from: string; payload: unknown }[] } = {
    peers: await roster(sql, room),
    signals: rows.map((r) => ({
      id: r.id,
      from: r.from_peer,
      kind: r.kind,
      payload: r.payload,
    })),
    iceServers: iceServersFromEnv(),
  };
  if (busSince >= 0) {
    const busRows = await sql.query<{ id: number; from_peer: string; payload: unknown }>(
      `SELECT id, from_peer, payload FROM webrtc_bus
       WHERE room = $1 AND id > $2 AND from_peer <> $3
       ORDER BY id LIMIT 80`,
      [room, busSince, peer],
    );
    body.bus = busRows.map((r) => ({ id: r.id, from: r.from_peer, payload: r.payload }));
  }
  return json(body);
}

async function handlePost(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid request" }, 400);
  const msg = parsed.data;
  const sql = await getSql();
  await ensureSchema(sql);

  if (msg.op === "signal") {
    await sql.query(
      `INSERT INTO webrtc_signals (room, to_peer, from_peer, kind, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [msg.room, msg.to, msg.from, msg.kind, JSON.stringify(msg.payload)],
    );
  } else if (msg.op === "data") {
    await sql.query(`INSERT INTO webrtc_bus (room, from_peer, payload) VALUES ($1, $2, $3)`, [
      msg.room,
      msg.from,
      JSON.stringify(msg.payload),
    ]);
  } else {
    await sql.query(`DELETE FROM webrtc_peers WHERE room = $1 AND peer_id = $2`, [
      msg.room,
      msg.peer,
    ]);
  }
  return json({ ok: true });
}

export async function handleSignaling(request: Request): Promise<Response> {
  try {
    if (request.method === "GET") {
      const url = new URL(request.url);
      if (url.searchParams.get("sse") === "1") return await handleSse(url, request);
      return await handleGet(url);
    }
    if (request.method === "POST") return await handlePost(request);
    return json({ error: "method not allowed" }, 405);
  } catch (error) {
    console.error("[rtc] signaling error:", error);
    return json({ error: "signaling failed" }, 500);
  }
}
