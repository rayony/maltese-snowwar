import type { FightPhase, KidState, Team } from "./types";
import type { NetMsg, PoseBall, PoseKid } from "./net";

const MAGIC = 0x53;
const VER = 1;
const T_POSE = 1;
const T_ALLY = 2;

const PHASES: FightPhase[] = ["intro", "fight", "won", "lost"];
const STATES: KidState[] = ["idle", "throw", "hurt", "grabbed", "buried", "pack"];

function phaseId(p: FightPhase) {
  const i = PHASES.indexOf(p);
  return i < 0 ? 1 : i;
}

function stateId(s: KidState) {
  const i = STATES.indexOf(s);
  return i < 0 ? 0 : i;
}

function i16(n: number) {
  return Math.max(-32768, Math.min(32767, Math.round(n)));
}

function u8(n: number) {
  return Math.max(0, Math.min(255, n | 0));
}

function u16(n: number) {
  return Math.max(0, Math.min(65535, Math.round(n)));
}

/** Compact pose / allypose for DataChannel. Envelope seq is packed in. */
export function encodeWire(seq: number, msg: NetMsg): ArrayBuffer | null {
  if (msg.t === "pose") return encodePose(seq, msg);
  if (msg.t === "allypose") return encodeAlly(seq, msg);
  return null;
}

export function decodeWire(raw: ArrayBuffer | ArrayBufferView): { n: number; m: NetMsg } | null {
  const buf =
    raw instanceof ArrayBuffer ? raw : raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const v = new DataView(buf);
  if (v.byteLength < 4) return null;
  if (v.getUint8(0) !== MAGIC || v.getUint8(1) !== VER) return null;
  const kind = v.getUint8(2);
  const n = v.getUint16(3, true);
  if (kind === T_POSE) return decodePose(v, n);
  if (kind === T_ALLY) return decodeAlly(v, n);
  return null;
}

function encodePose(seq: number, msg: Extract<NetMsg, { t: "pose" }>): ArrayBuffer {
  const kids = msg.kids.slice(0, 16);
  const balls = (msg.balls ?? []).slice(0, 24);
  const bytes = 12 + kids.length * 12 + 1 + balls.length * 13;
  const buf = new ArrayBuffer(bytes);
  const v = new DataView(buf);
  let o = 0;
  v.setUint8(o++, MAGIC);
  v.setUint8(o++, VER);
  v.setUint8(o++, T_POSE);
  v.setUint16(o, seq & 0xffff, true);
  o += 2;
  v.setFloat32(o, msg.t0, true);
  o += 4;
  v.setUint8(o++, u8(Math.round(msg.intro * 20)));
  v.setUint8(o++, phaseId(msg.phase));
  v.setUint8(o++, kids.length);
  for (const k of kids) {
    v.setUint8(o++, u8(k.i));
    v.setInt16(o, i16(k.x * 10), true);
    o += 2;
    v.setInt16(o, i16(k.y * 10), true);
    o += 2;
    v.setInt16(o, i16((k.vx ?? 0) * 10), true);
    o += 2;
    v.setInt16(o, i16((k.vy ?? 0) * 10), true);
    o += 2;
    const flags = (k.f < 0 ? 1 : 0) | (k.m ? 2 : 0) | (stateId(k.s) << 2);
    v.setUint8(o++, flags);
    v.setUint8(o++, u8(k.h));
  }
  v.setUint8(o++, balls.length);
  for (const b of balls) {
    v.setUint8(o++, u8(b.i));
    v.setInt16(o, i16(b.x * 10), true);
    o += 2;
    v.setInt16(o, i16(b.y * 10), true);
    o += 2;
    v.setInt16(o, i16(b.vx * 10), true);
    o += 2;
    v.setInt16(o, i16(b.vy * 10), true);
    o += 2;
    v.setUint8(o++, b.tm === "green" ? 1 : 0);
    v.setUint16(o, u16(b.rg * 10), true);
    o += 2;
    v.setUint16(o, u16(b.tr * 10), true);
    o += 2;
  }
  return buf;
}

function decodePose(v: DataView, n: number): { n: number; m: Extract<NetMsg, { t: "pose" }> } | null {
  if (v.byteLength < 10) return null;
  let o = 5;
  const t0 = v.getFloat32(o, true);
  o += 4;
  const intro = v.getUint8(o++) / 20;
  const phase = PHASES[v.getUint8(o++)] ?? "fight";
  const nk = v.getUint8(o++);
  const kids: PoseKid[] = [];
  for (let i = 0; i < nk; i++) {
    if (o + 12 > v.byteLength) return null;
    const id = v.getUint8(o++);
    const x = v.getInt16(o, true) / 10;
    o += 2;
    const y = v.getInt16(o, true) / 10;
    o += 2;
    const vx = v.getInt16(o, true) / 10;
    o += 2;
    const vy = v.getInt16(o, true) / 10;
    o += 2;
    const flags = v.getUint8(o++);
    const h = v.getUint8(o++);
    kids.push({
      i: id,
      x,
      y,
      vx,
      vy,
      f: flags & 1 ? -1 : 1,
      m: !!(flags & 2),
      s: STATES[(flags >> 2) & 7] ?? "idle",
      h,
    });
  }
  if (o >= v.byteLength) {
    return { n, m: { t: "pose", kids, intro, phase, t0 } };
  }
  const nb = v.getUint8(o++);
  const balls: PoseBall[] = [];
  for (let i = 0; i < nb; i++) {
    if (o + 13 > v.byteLength) break;
    const fromId = v.getUint8(o++);
    const x = v.getInt16(o, true) / 10;
    o += 2;
    const y = v.getInt16(o, true) / 10;
    o += 2;
    const vx = v.getInt16(o, true) / 10;
    o += 2;
    const vy = v.getInt16(o, true) / 10;
    o += 2;
    const tm: Team = v.getUint8(o++) === 1 ? "green" : "red";
    const rg = v.getUint16(o, true) / 10;
    o += 2;
    const tr = v.getUint16(o, true) / 10;
    o += 2;
    balls.push({ i: fromId, x, y, vx, vy, tm, rg, tr });
  }
  return { n, m: { t: "pose", kids, intro, phase, t0, balls } };
}

function encodeAlly(seq: number, msg: Extract<NetMsg, { t: "allypose" }>): ArrayBuffer {
  const kids = msg.kids.slice(0, 16);
  const buf = new ArrayBuffer(6 + kids.length * 5);
  const v = new DataView(buf);
  let o = 0;
  v.setUint8(o++, MAGIC);
  v.setUint8(o++, VER);
  v.setUint8(o++, T_ALLY);
  v.setUint16(o, seq & 0xffff, true);
  o += 2;
  v.setUint8(o++, kids.length);
  for (const k of kids) {
    v.setUint8(o++, u8(k.id));
    v.setInt16(o, i16(k.x), true);
    o += 2;
    v.setInt16(o, i16(k.y), true);
    o += 2;
  }
  return buf;
}

function decodeAlly(v: DataView, n: number): { n: number; m: Extract<NetMsg, { t: "allypose" }> } | null {
  if (v.byteLength < 6) return null;
  let o = 5;
  const nk = v.getUint8(o++);
  const kids: { id: number; x: number; y: number }[] = [];
  for (let i = 0; i < nk; i++) {
    if (o + 5 > v.byteLength) return null;
    const id = v.getUint8(o++);
    const x = v.getInt16(o, true);
    o += 2;
    const y = v.getInt16(o, true);
    o += 2;
    kids.push({ id, x, y });
  }
  return { n, m: { t: "allypose", kids } };
}
