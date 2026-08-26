/**
 * Unit tests for pure sim helpers (issue #13).
 * Run: npx tsx --test src/game/sim.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aimFromKid,
  clamp,
  closestEnemy,
  createState,
  isOut,
  living,
} from "./sim";
import type { Kid } from "./types";

function kid(partial: Partial<Kid> & Pick<Kid, "id" | "team" | "x" | "y">): Kid {
  return {
    lastX: partial.x,
    lastY: partial.y,
    hp: 2,
    maxHp: 2,
    state: "idle",
    stateT: 0,
    cooldown: 0,
    packT: 0,
    animT: 0,
    flash: 0,
    stun: 0,
    facing: partial.team === "red" ? -1 : 1,
    fidget: null,
    fidgetT: 0,
    fidgetWait: 0,
    moving: false,
    ai: null,
    ...partial,
  };
}

describe("clamp", () => {
  it("clamps into range", () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-1, 0, 10), 0);
    assert.equal(clamp(99, 0, 10), 10);
  });
});

describe("isOut / living", () => {
  it("treats buried and zero-hp as out", () => {
    const a = kid({ id: 1, team: "red", x: 0, y: 0, hp: 0, state: "buried" });
    const b = kid({ id: 2, team: "red", x: 0, y: 0, hp: 2, state: "idle" });
    assert.equal(isOut(a), true);
    assert.equal(isOut(b), false);
    assert.equal(living([a, b], "red").length, 1);
  });
});

describe("closestEnemy", () => {
  it("picks nearest living foe", () => {
    const me = kid({ id: 1, team: "red", x: 500, y: 200 });
    const near = kid({ id: 2, team: "green", x: 400, y: 200 });
    const far = kid({ id: 3, team: "green", x: 100, y: 200 });
    const dead = kid({ id: 4, team: "green", x: 450, y: 200, hp: 0, state: "buried" });
    assert.equal(closestEnemy(me, [me, near, far, dead])?.id, 2);
  });
});

describe("aimFromKid", () => {
  it("locks onto nearest foe for red (forward hemisphere)", () => {
    const me = kid({ id: 1, team: "red", x: 700, y: 200 });
    const foe = kid({ id: 2, team: "green", x: 200, y: 250 });
    const { dx } = aimFromKid(me, [me, foe], 5, 0, false, true);
    assert.ok(dx < 0, "red should aim left toward foe");
  });

  it("ignores small rightward wobble in star mode", () => {
    const me = kid({ id: 1, team: "red", x: 700, y: 200 });
    const foe = kid({ id: 2, team: "green", x: 200, y: 200 });
    const { dx } = aimFromKid(me, [me, foe], 20, 5, false, true);
    assert.ok(dx < 0, "small right drag must not steal aim");
  });

  it("honors clear intentional back-throw in star mode", () => {
    const me = kid({ id: 1, team: "red", x: 700, y: 200 });
    const foe = kid({ id: 2, team: "green", x: 200, y: 200 });
    const { dx } = aimFromKid(me, [me, foe], 80, 0, false, true);
    assert.ok(dx > 0, "clear back-throw should use manual aim");
  });
});

describe("createState", () => {
  it("spawns red team and enemies", () => {
    const s = createState(1, false);
    assert.ok(s.kids.some((k) => k.team === "red"));
    assert.ok(s.kids.some((k) => k.team === "green"));
    assert.equal(s.phase, "intro");
  });
});
