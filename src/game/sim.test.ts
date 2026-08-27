/**
 * Unit tests for pure sim helpers (issue #13).
 * Run: npx tsx --test src/game/sim.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aimFromKid,
  clamp,
  claimPickup,
  closestEnemy,
  createState,
  isOut,
  living,
  stepPickups,
  stepSim,
  throwSnowball,
} from "./sim";
import { holdPower, MAX_CHARGE, BIG_CHARGE, BIG_SPEED, throwSpeed } from "./constants";
import { aiThrowAim } from "./ai";
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
  it("locks onto nearest foe for red", () => {
    const me = kid({ id: 1, team: "red", x: 700, y: 200 });
    const foe = kid({ id: 2, team: "green", x: 200, y: 250 });
    const { dx } = aimFromKid(me, [me, foe], 5, 0, false, true);
    assert.ok(dx < 0, "red should aim left toward foe");
  });

  it("ignores drag wobble and still aims at the nearest foe", () => {
    const me = kid({ id: 1, team: "red", x: 700, y: 200 });
    const foe = kid({ id: 2, team: "green", x: 200, y: 200 });
    const { dx } = aimFromKid(me, [me, foe], 80, 5, false, true);
    assert.ok(dx < 0, "right drag must not steal aim into empty space");
  });

  it("aims at a nearer foe even if they are behind the maltese", () => {
    const me = kid({ id: 1, team: "red", x: 300, y: 200 });
    const behind = kid({ id: 2, team: "green", x: 360, y: 200 });
    const farFront = kid({ id: 3, team: "green", x: 40, y: 200 });
    const { dx } = aimFromKid(me, [me, behind, farFront]);
    assert.ok(dx > 0, "nearest is to the right");
  });

  it("allows a pure vertical throw when the foe is directly above", () => {
    const me = kid({ id: 1, team: "red", x: 400, y: 300 });
    const foe = kid({ id: 2, team: "green", x: 400, y: 80 });
    const { dx, dy } = aimFromKid(me, [me, foe]);
    assert.equal(dx, 0);
    assert.ok(dy < 0);
  });
});

describe("aiThrowAim", () => {
  it("easy retrievers never aim left / backward", () => {
    const dog = kid({ id: 1, team: "green", x: 200, y: 200 });
    const behind = kid({ id: 2, team: "red", x: 80, y: 200 });
    const front = kid({ id: 3, team: "red", x: 500, y: 220 });
    const aim = aiThrowAim(dog, [dog, behind, front], false, false);
    assert.ok(aim);
    assert.ok(aim.dx > 0);
  });

  it("hard retrievers may aim at a foe behind them", () => {
    const dog = kid({ id: 1, team: "green", x: 400, y: 200 });
    const behind = kid({ id: 2, team: "red", x: 120, y: 200 });
    const aim = aiThrowAim(dog, [dog, behind], true, false);
    assert.ok(aim);
    assert.ok(aim.dx < 0);
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

describe("big snowball pickup", () => {
  it("grants a team buff when a dog touches the orb", () => {
    const s = createState(1, true);
    s.phase = "fight";
    s.pickup = { x: 480, y: 270, kind: "big", life: 8, maxLife: 10 };
    s.pickupCd = 9;
    const dog = s.kids.find((k) => k.team === "red")!;
    dog.x = 480;
    dog.y = 270;
    stepPickups(s, 0.05, true);
    assert.equal(s.buffs.red?.shots, 3);
    assert.ok((s.buffs.red?.t ?? 0) > 9);
    assert.equal(s.pickup, null);
  });

  it("user throws consume the team buff; AI throws do not", () => {
    const s = createState(1, true);
    s.phase = "fight";
    s.pickup = null;
    s.forts = [];
    s.buffs.red = { kind: "big", shots: 3, t: 10 };
    const red = s.kids.find((k) => k.team === "red")!;
    const ally = s.kids.find((k) => k.team === "red" && k.id !== red.id)!;
    const green = s.kids.find((k) => k.team === "green")!;
    red.x = 420;
    red.y = 270;
    green.x = 300;
    green.y = 270;
    green.hp = 2;
    throwSnowball(s, ally, 1, -1, 0, false, false);
    assert.equal(s.buffs.red?.shots, 3);
    assert.equal(s.balls.at(-1)?.big, false);
    throwSnowball(s, red, 1, -1, 0, false, true, true);
    assert.equal(s.buffs.red?.shots, 2);
    const ball = s.balls.find((b) => b.big)!;
    assert.equal(ball.big, true);
    ball.x = green.x;
    ball.y = green.y - 10;
    ball.grace = 0;
    stepSim(s, 1 / 60, () => {});
    assert.ok(green.hp <= 0);
  });

  it("any living dog can collect, and a second pickup refills 3 shots / 10s", () => {
    const s = createState(1, true);
    s.phase = "fight";
    s.buffs.green = { kind: "big", shots: 1, t: 2 };
    s.pickup = { x: 500, y: 280, kind: "big", life: 10, maxLife: 10 };
    const green = s.kids.find((k) => k.team === "green")!;
    green.x = 500;
    green.y = 280;
    stepPickups(s, 0.05, true);
    assert.equal(s.buffs.green?.shots, 3);
    assert.ok((s.buffs.green?.t ?? 0) > 9.5);
    assert.equal(s.pickup, null);
  });

  it("click-claim grants the team buff without walking a dog", () => {
    const s = createState(1, true);
    s.phase = "fight";
    s.pickup = { x: 480, y: 270, kind: "big", life: 10, maxLife: 10 };
    assert.equal(claimPickup(s, "red"), true);
    assert.equal(s.buffs.red?.shots, 3);
    assert.equal(s.pickup, null);
    assert.equal(claimPickup(s, "green"), false);
  });

  it("big ball flies at 0.8x and needs 1.2x hold for full range", () => {
    assert.equal(holdPower(MAX_CHARGE), 1);
    assert.ok(holdPower(MAX_CHARGE, false, true) < 1);
    assert.equal(holdPower(MAX_CHARGE * BIG_CHARGE, false, true), 1);
    const s = createState(1, false);
    s.phase = "fight";
    s.forts = [];
    s.buffs.red = { kind: "big", shots: 3, t: 10 };
    const red = s.kids.find((k) => k.team === "red")!;
    red.packT = 0;
    red.state = "idle";
    throwSnowball(s, red, MAX_CHARGE * BIG_CHARGE, -1, 0, false, true, true);
    const ball = s.balls.find((b) => b.big)!;
    const full = throwSpeed(1);
    assert.ok(Math.abs(Math.hypot(ball.vx, ball.vy) - full * BIG_SPEED) < 1e-6);
  });

  it("a big ball hit by another snowball shrinks to a normal ball", () => {
    const s = createState(1, true);
    s.phase = "fight";
    s.forts = [];
    s.kids.forEach((k) => {
      k.x = 40;
      k.y = 40;
    });
    s.balls.push({
      x: 400,
      y: 270,
      vx: -80,
      vy: 0,
      team: "red",
      r: 40,
      fromId: 1,
      grace: 1,
      spin: 0,
      alive: true,
      range: 800,
      traveled: 0,
      big: true,
    });
    s.balls.push({
      x: 430,
      y: 270,
      vx: 80,
      vy: 0,
      team: "green",
      r: 12,
      fromId: 2,
      grace: 1,
      spin: 0,
      alive: true,
      range: 800,
      traveled: 0,
    });
    stepSim(s, 1 / 60, () => {});
    const redBall = s.balls.find((b) => b.team === "red");
    assert.ok(redBall);
    assert.equal(redBall.alive, true);
    assert.equal(redBall.big, false);
    assert.equal(redBall.r, 12);
    assert.equal(s.balls.some((b) => b.team === "green"), false);
  });

  it("two big balls shatter each other", () => {
    const s = createState(1, true);
    s.phase = "fight";
    s.forts = [];
    s.kids.forEach((k) => {
      k.x = 40;
      k.y = 40;
    });
    for (const team of ["red", "green"] as const) {
      s.balls.push({
        x: team === "red" ? 400 : 430,
        y: 270,
        vx: team === "red" ? -80 : 80,
        vy: 0,
        team,
        r: 40,
        fromId: team === "red" ? 1 : 2,
        grace: 1,
        spin: 0,
        alive: true,
        range: 800,
        traveled: 0,
        big: true,
      });
    }
    stepSim(s, 1 / 60, () => {});
    assert.equal(s.balls.length, 0);
  });
});
