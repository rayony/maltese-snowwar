import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decodeWire, encodeWire } from "./wire.ts";
import type { NetMsg } from "./net.ts";

describe("wire pose", () => {
  it("roundtrips kids and balls", () => {
    const msg: NetMsg = {
      t: "pose",
      t0: 12345.5,
      intro: 1.5,
      phase: "fight",
      kids: [
        { i: 1, x: 80.4, y: 120.2, vx: -12.3, vy: 4.1, f: -1, s: "idle", h: 3, m: true },
        { i: 4, x: 400, y: 90, vx: 0, vy: 0, f: 1, s: "pack", h: 2, m: false },
      ],
      balls: [{ i: 1, x: 100, y: 110, vx: 80, vy: -10, tm: "red", rg: 220, tr: 40 }],
    };
    const buf = encodeWire(42, msg);
    assert.ok(buf);
    const out = decodeWire(buf!);
    assert.ok(out);
    assert.equal(out!.n, 42);
    assert.equal(out!.m.t, "pose");
    if (out!.m.t !== "pose") return;
    assert.equal(out!.m.kids.length, 2);
    assert.equal(out!.m.kids[0]!.i, 1);
    assert.equal(out!.m.kids[0]!.f, -1);
    assert.equal(out!.m.kids[0]!.m, true);
    assert.ok(Math.abs(out!.m.kids[0]!.x - 80.4) < 0.15);
    assert.equal(out!.m.kids[1]!.s, "pack");
    assert.equal(out!.m.balls?.length, 1);
    assert.equal(out!.m.balls![0]!.tm, "red");
    assert.ok(buf!.byteLength < JSON.stringify(msg).length * 0.55);
  });

  it("roundtrips allypose", () => {
    const msg: NetMsg = { t: "allypose", kids: [{ id: 4, x: 310, y: 88 }] };
    const buf = encodeWire(7, msg);
    const out = decodeWire(buf!);
    assert.deepEqual(out, { n: 7, m: msg });
  });
});
