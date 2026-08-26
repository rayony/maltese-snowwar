import type { FightPhase, KidState, Team } from "./types";
import type { NetMsg, PoseBall, PoseKid } from "./net";

const MAGIC = 0x53; // S
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

/** Compact pose / allypose for DataChannel. Envelope seq is packed in. */
export function encodeWire(seq: number, msg: NetMsg): ArrayBuffer | null {
  if (msg.t === "pose") return encodePose(seq, msg);
  if (msg.t === "allypose") return encodeAlly(seq, msg);
  return null;
}

export function decodeWire(raw: ArrayBuffer | ArrayBufferView): { n: number; m: NetMsg } | null {
  const buf = raw instanceof ArrayBuffer ? raw : raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
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
    v.setUint8(o++, u8(k.h);
    // placeholder to detect errors
  }
  return buf;
}
