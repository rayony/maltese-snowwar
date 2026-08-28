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
  canEnterFort,
  canTeamClaimPickup,
  faceFromDir,
  faceNearest,
  foeHittable,
  isOut,
  living,
  maybeArmComeback,
  playerComeback,
  stepPickups,
  stepSim,
  throwSnowball,
  tickHideFuel,
  sweetReady,
  incomingAt,
} from "./sim";
import { BIG_SPEED, MAX_RANGE, MAX_THROW_SPEED, pickupRadius, SWEET_WINDOW, WORLD_W } from "./constants";
import { aiThrowAim, arenaBalls, arenaCanThrow, bigBallRoles, draggedMate, fortCoverSpot, grabShooters, huntPressers, mateThrewRecently, shouldHideInPile, stepAi, surroundLast, teamJob, teamReactsToBig, teamSurging, throwAimForStance } from "./ai";
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

  it("skips a nearer foe behind a fort and aims at a clear shot", () => {
    const me = kid({ id: 1, team: "red", x: 700, y: 168 });
    const blocked = kid({ id: 2, team: "green", x: 250, y: 168 });
    const open = kid({ id: 3, team: "green", x: 700, y: 400 });
    const forts = [{ x: 390, y: 168, rx: 92, ry: 40, hitFlash: 0, hp: 0, maxHp: 0 }];
    const aim = aimFromKid(me, [me, blocked, open], 0, 0, false, false, forts);
    assert.equal(aim.ok, true);
    assert.ok(aim.dy > 0, "should aim at the open foe below, not through the fort");
  });

  it("returns no aim when every foe is in cover or behind a fort", () => {
    const me = kid({ id: 1, team: "red", x: 700, y: 168 });
    const inPile = kid({ id: 2, team: "green", x: 390, y: 168 });
    const behind = kid({ id: 3, team: "green", x: 250, y: 168 });
    const forts = [{ x: 390, y: 168, rx: 92, ry: 40, hitFlash: 0, hp: 0, maxHp: 0 }];
    const aim = aimFromKid(me, [me, inPile, behind], 0, 0, false, false, forts);
    assert.equal(aim.ok, false);
    assert.equal(aim.dx, 0);
    assert.equal(aim.dy, 0);
  });

  it("cannot aim or throw while standing in a fort", () => {
    const s = createState(1);
    s.phase = "fight";
    const me = s.kids.find((k) => k.team === "red")!;
    me.x = 390;
    me.y = 168;
    me.packT = 0;
    me.state = "idle";
    const aim = aimFromKid(me, s.kids, 0, 0, false, false, s.forts);
    assert.equal(aim.ok, false);
    const before = s.balls.length;
    assert.equal(throwSnowball(s, me, 0.6, -1, 0, false, true), 0);
    assert.equal(s.balls.length, before);
  });

  it("a grabbed dog can be aimed at and hit even in a pile", () => {
    const s = createState(1);
    s.phase = "fight";
    s.forts = [{ x: 390, y: 168, rx: 92, ry: 40, hitFlash: 0, hp: 0, maxHp: 0 }];
    const red = s.kids.find((k) => k.team === "red")!;
    const green = s.kids.find((k) => k.team === "green")!;
    red.x = 390;
    red.y = 168;
    red.lastX = 390;
    red.lastY = 168;
    red.state = "grabbed";
    red.hp = 2;
    red.moving = false;
    green.x = 200;
    green.y = 168;
    assert.equal(foeHittable(green, red, s.forts), true);
    const aim = aimFromKid(green, s.kids, 0, 0, false, false, s.forts);
    assert.equal(aim.ok, true);
    throwSnowball(s, green, 1, 1, 0, false, false);
    const ball = s.balls.at(-1)!;
    ball.x = red.x;
    ball.y = red.y - 10;
    ball.grace = 0;
    stepSim(s, 1 / 60, () => {});
    assert.ok(red.hp < 2);
    assert.equal(red.state, "grabbed");
  });
});

describe("faceNearest", () => {
  it("red faces left toward a foe on the left", () => {
    const me = kid({ id: 1, team: "red", x: 700, y: 200, facing: -1 });
    const foe = kid({ id: 2, team: "green", x: 200, y: 200 });
    const state = createState(1);
    state.kids = [me, foe];
    faceNearest(state);
    assert.equal(me.facing, -1);
  });

  it("red faces right when the nearest foe is on the right", () => {
    const me = kid({ id: 1, team: "red", x: 300, y: 200, facing: -1 });
    const foe = kid({ id: 2, team: "green", x: 500, y: 200 });
    const state = createState(1);
    state.kids = [me, foe];
    faceNearest(state);
    assert.equal(me.facing, 1);
  });

  it("green (pvp guest) faces the nearest maltese, including behind", () => {
    const me = kid({ id: 1, team: "green", x: 200, y: 200, facing: 1 });
    const foe = kid({ id: 2, team: "red", x: 100, y: 200 });
    const state = createState(1);
    state.kids = [me, foe];
    faceNearest(state, "green");
    assert.equal(me.facing, -1);
  });

  it("pure vertical aim keeps previous facing", () => {
    const me = kid({ id: 1, team: "red", x: 400, y: 300, facing: -1 });
    const foe = kid({ id: 2, team: "green", x: 400, y: 100 });
    const state = createState(1);
    state.kids = [me, foe];
    faceNearest(state);
    assert.equal(me.facing, -1);
    assert.equal(faceFromDir(0, -1, 1), 1);
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

  it("hard doubles throw speed; normal/easy do not", () => {
    const easy = createState(1);
    easy.phase = "fight";
    easy.forts = [];
    easy.hard = false;
    const red = easy.kids.find((k) => k.team === "red")!;
    red.packT = 0;
    throwSnowball(easy, red, 1.2, -1, 0, false, true);
    const slow = Math.hypot(easy.balls.at(-1)!.vx, easy.balls.at(-1)!.vy);
    const hard = createState(1);
    hard.phase = "fight";
    hard.forts = [];
    hard.hard = true;
    const h = hard.kids.find((k) => k.team === "red")!;
    h.packT = 0;
    throwSnowball(hard, h, 1.2, -1, 0, false, true);
    const fast = Math.hypot(hard.balls.at(-1)!.vx, hard.balls.at(-1)!.vy);
    assert.ok(Math.abs(fast - slow * 2) < 1e-4);
  });

  it("tap and long hold fly the same distance and speed", () => {
    const s = createState(1);
    s.phase = "fight";
    s.forts = [];
    const red = s.kids.find((k) => k.team === "red")!;
    red.packT = 0;
    throwSnowball(s, red, 0.05, -1, 0, false, true);
    const tap = s.balls.at(-1)!;
    red.packT = 0;
    red.state = "idle";
    throwSnowball(s, red, 1.2, -1, 0, false, true);
    const hold = s.balls.at(-1)!;
    assert.equal(tap.range, MAX_RANGE);
    assert.equal(hold.range, MAX_RANGE);
    assert.ok(Math.abs(Math.hypot(tap.vx, tap.vy) - MAX_THROW_SPEED) < 1e-6);
    assert.ok(Math.abs(Math.hypot(hold.vx, hold.vy) - Math.hypot(tap.vx, tap.vy)) < 1e-6);
  });
});

describe("counter sweet", () => {
  it("is sweet only if the aimed foe just threw", () => {
    const s = createState(1);
    s.phase = "fight";
    s.forts = [];
    s.time = 2;
    const red = s.kids.find((k) => k.team === "red")!;
    const green = s.kids.find((k) => k.team === "green")!;
    red.x = 700;
    red.y = 200;
    red.packT = 0;
    green.x = 200;
    green.y = 200;
    green.lastThrowAt = 2 - 0.2;
    assert.equal(sweetReady(s, red), true);
    throwSnowball(s, red, 0, -1, 0, false, true);
    assert.equal(s.balls.at(-1)!.sweet, true);
    assert.ok(Math.abs(Math.hypot(s.balls.at(-1)!.vx, s.balls.at(-1)!.vy) - MAX_THROW_SPEED) < 1e-6);
  });

  it("is not sweet if the aimed foe threw too long ago", () => {
    const s = createState(1);
    s.phase = "fight";
    s.forts = [];
    s.time = 2;
    const red = s.kids.find((k) => k.team === "red")!;
    const green = s.kids.find((k) => k.team === "green")!;
    red.x = 700;
    red.y = 200;
    red.packT = 0;
    green.x = 200;
    green.y = 200;
    green.lastThrowAt = 2 - SWEET_WINDOW - 0.2;
    assert.equal(sweetReady(s, red), false);
    throwSnowball(s, red, 0, -1, 0, false, true);
    assert.equal(!!s.balls.at(-1)!.sweet, false);
  });

  it("is sweet if a nearby foe's ball is flying at the held dog", () => {
    const s = createState(1);
    s.phase = "fight";
    s.forts = [];
    s.time = 2;
    const reds = s.kids.filter((k) => k.team === "red");
    const greens = s.kids.filter((k) => k.team === "green");
    const red = reds[0]!;
    const aim = greens[0]!;
    const other = greens[1] ?? greens[0]!;
    red.x = 700;
    red.y = 200;
    red.packT = 0;
    aim.x = 180;
    aim.y = 200;
    aim.lastThrowAt = -99;
    other.x = 200;
    other.y = 248;
    other.lastThrowAt = -99;
    s.balls = [{
      x: 560, y: 200, vx: 480, vy: 0, team: "green", r: 12, fromId: other.id, grace: 0, spin: 0,
      alive: true, range: 800, traveled: 80, sweet: false, big: false,
    }];
    assert.equal(incomingAt(s, red), true);
    assert.equal(sweetReady(s, red), true);
    throwSnowball(s, red, 0, -1, 0, false, true);
    assert.equal(s.balls.filter((b) => b.fromId === red.id).at(-1)!.sweet, true);
  });

  it("is not sweet for a ball flying away or a big ball", () => {
    const s = createState(1);
    s.phase = "fight";
    s.forts = [];
    const red = s.kids.find((k) => k.team === "red")!;
    const green = s.kids.find((k) => k.team === "green")!;
    red.x = 700;
    red.y = 200;
    green.x = 200;
    green.y = 200;
    green.lastThrowAt = -99;
    s.balls = [{
      x: 560, y: 200, vx: -480, vy: 0, team: "green", r: 12, fromId: green.id, grace: 0, spin: 0,
      alive: true, range: 800, traveled: 80,
    }];
    assert.equal(incomingAt(s, red), false);
    s.balls = [{
      x: 560, y: 200, vx: 400, vy: 0, team: "green", r: 36, fromId: green.id, grace: 0, spin: 0,
      alive: true, range: 800, traveled: 80, big: true,
    }];
    assert.equal(incomingAt(s, red), false);
    assert.equal(sweetReady(s, red), false);
  });

  it("a sweet ball eats a normal foe ball and keeps flying", () => {
    const s = createState(1);
    s.phase = "fight";
    s.forts = [];
    const red = s.kids.find((k) => k.team === "red")!;
    const green = s.kids.find((k) => k.team === "green")!;
    red.x = 400;
    red.y = 80;
    green.x = 400;
    green.y = 460;
    s.balls = [
      {
        x: 400, y: 200, vx: 0, vy: 0, team: "red", r: 12, fromId: red.id, grace: 0, spin: 0,
        alive: true, range: 800, traveled: 40, sweet: true, big: false,
      },
      {
        x: 400, y: 200, vx: 0, vy: 0, team: "green", r: 12, fromId: green.id, grace: 0, spin: 0,
        alive: true, range: 800, traveled: 40, sweet: false, big: false,
      },
    ];
    stepSim(s, 1 / 60, () => {});
    const sweet = s.balls.find((b) => b.sweet);
    const foe = s.balls.find((b) => b.fromId === green.id);
    assert.ok(sweet?.alive);
    assert.ok(!foe || !foe.alive);
  });

  it("sweet vs big acts like a normal ball", () => {
    const s = createState(1);
    s.phase = "fight";
    s.forts = [];
    const red = s.kids.find((k) => k.team === "red")!;
    const green = s.kids.find((k) => k.team === "green")!;
    red.x = 400;
    red.y = 80;
    green.x = 400;
    green.y = 460;
    s.balls = [
      {
        x: 400, y: 200, vx: 0, vy: 0, team: "red", r: 12, fromId: red.id, grace: 0, spin: 0,
        alive: true, range: 800, traveled: 40, sweet: true, big: false,
      },
      {
        x: 400, y: 200, vx: 0, vy: 0, team: "green", r: 36, fromId: green.id, grace: 0, spin: 0,
        alive: true, range: 800, traveled: 40, sweet: false, big: true,
      },
    ];
    stepSim(s, 1 / 60, () => {});
    const sweet = s.balls.find((b) => b.fromId === red.id);
    const big = s.balls.find((b) => b.fromId === green.id);
    assert.ok(!sweet || !sweet.alive);
    assert.ok(big?.alive);
    assert.equal(big?.big, false);
  });

  it("two sweet balls pass through each other", () => {
    const s = createState(1);
    s.phase = "fight";
    s.forts = [];
    const red = s.kids.find((k) => k.team === "red")!;
    const green = s.kids.find((k) => k.team === "green")!;
    red.x = 400;
    red.y = 80;
    green.x = 400;
    green.y = 460;
    s.balls = [
      {
        x: 400, y: 200, vx: 0, vy: 0, team: "red", r: 12, fromId: red.id, grace: 0, spin: 0,
        alive: true, range: 800, traveled: 40, sweet: true, big: false,
      },
      {
        x: 400, y: 200, vx: 0, vy: 0, team: "green", r: 12, fromId: green.id, grace: 0, spin: 0,
        alive: true, range: 800, traveled: 40, sweet: true, big: false,
      },
    ];
    stepSim(s, 1 / 60, () => {});
    assert.equal(s.balls.filter((b) => b.alive && b.sweet).length, 2);
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

  it("vs AI retrievers cannot pick up the gold orb", () => {
    const s = createState(1, false);
    s.phase = "fight";
    s.pickup = { x: 500, y: 280, kind: "big", life: 10, maxLife: 10 };
    const green = s.kids.find((k) => k.team === "green")!;
    green.x = 500;
    green.y = 280;
    assert.equal(canTeamClaimPickup(s, "green"), false);
    stepPickups(s, 0.05, true);
    assert.ok(s.pickup);
    assert.equal(s.buffs.green, null);
    assert.equal(claimPickup(s, "green"), false);
    const red = s.kids.find((k) => k.team === "red")!;
    red.x = 500 + pickupRadius() * 0.7;
    red.y = 280;
    stepPickups(s, 0.05, true);
    assert.equal(s.buffs.red?.shots, 3);
    assert.ok(s.lootPop);
  });

  it("big ball flies at 0.8x at full range", () => {
    const s = createState(1, false);
    s.phase = "fight";
    s.forts = [];
    s.buffs.red = { kind: "big", shots: 3, t: 10 };
    const red = s.kids.find((k) => k.team === "red")!;
    red.packT = 0;
    red.state = "idle";
    throwSnowball(s, red, 0.1, -1, 0, false, true, true);
    const ball = s.balls.find((b) => b.big)!;
    const full = MAX_THROW_SPEED;
    assert.equal(ball.range, MAX_RANGE);
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
      r: 36,
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
        r: 36,
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

describe("big-ball AI roles", () => {
  it("reacts for hard retrievers and both PvP teams, not easy maltese", () => {
    const solo = createState(1, false, { hard: false });
    const hard = createState(1, false, { hard: true });
    const pvp = createState(1, true);
    assert.equal(teamReactsToBig("green", false, solo), false);
    assert.equal(teamReactsToBig("red", true, hard), false);
    assert.equal(teamReactsToBig("green", true, hard), true);
    assert.equal(teamReactsToBig("red", false, pvp), true);
    assert.equal(teamReactsToBig("green", false, pvp), true);
  });

  it("holds fire on two dogs while the foe has the buff", () => {
    const s = createState(1, true);
    s.phase = "fight";
    s.buffs.red = { kind: "big", shots: 3, t: 8 };
    const roles = bigBallRoles(s, "green");
    assert.equal(roles.holdFire.size, 2);
    assert.equal(roles.intercept.size, 2);
    for (const id of roles.intercept) assert.ok(roles.holdFire.has(id));
  });

  it("holds fire on all remaining if fewer than two", () => {
    const s = createState(1, true);
    s.phase = "fight";
    s.buffs.red = { kind: "big", shots: 2, t: 5 };
    for (const k of s.kids) {
      if (k.team === "green" && k.id !== s.kids.find((x) => x.team === "green")!.id) {
        k.hp = 0;
        k.state = "buried";
      }
    }
    const roles = bigBallRoles(s, "green");
    assert.equal(roles.holdFire.size, 1);
  });

  it("assigns two interceptors at a flying big ball", () => {
    const s = createState(1, true);
    s.phase = "fight";
    s.buffs.red = { kind: "big", shots: 1, t: 4 };
    s.balls.push({
      x: 400,
      y: 270,
      vx: -200,
      vy: 0,
      team: "red",
      r: 36,
      fromId: 1,
      grace: 0,
      spin: 0,
      alive: true,
      range: 800,
      traveled: 0,
      big: true,
    });
    const roles = bigBallRoles(s, "green");
    assert.equal(roles.intercept.size, 2);
    assert.equal(roles.holdFire.size, 2);
  });

  it("pre-charges a long shot and only fires after the big ball is thrown", () => {
    const s = createState(1, true);
    s.phase = "fight";
    s.forts = [];
    s.buffs.red = { kind: "big", shots: 3, t: 8 };
    let y = 70;
    for (const k of s.kids) {
      k.packT = 0;
      k.cooldown = 0;
      k.stun = 0;
      k.state = "idle";
      if (k.team === "green") {
        k.x = 90;
        k.y = y;
        y += 110;
      }
    }
    for (let i = 0; i < 90; i++) stepAi(s, 1 / 60, () => {}, "off", "enemy", false, true);
    const ids = [...bigBallRoles(s, "green").intercept];
    const blockers = s.kids.filter((k) => ids.includes(k.id));
    assert.equal(blockers.length, 2);
    const fromBlockers = (balls: typeof s.balls) =>
      balls.filter((b) => b.team === "green" && ids.includes(b.fromId)).length;
    assert.ok(blockers.every((k) => (k.ai?.charge ?? 0) >= 0.85));
    assert.equal(fromBlockers(s.balls), 0);
    s.balls.push({
      x: 400,
      y: blockers[0]!.y,
      vx: -180,
      vy: 0,
      team: "red",
      r: 36,
      fromId: 1,
      grace: 0,
      spin: 0,
      alive: true,
      range: 800,
      traveled: 0,
      big: true,
    });
    stepAi(s, 1 / 60, () => {}, "off", "enemy", false, true);
    assert.ok(fromBlockers(s.balls) >= 1);
  });
});

describe("shouldHideInPile", () => {
  it("hides when two foes are nearby and a pile is on our side", () => {
    const s = createState(1, false, { hard: true });
    const green = s.kids.find((k) => k.team === "green")!;
    green.x = 500;
    green.y = 200;
    const reds = s.kids.filter((k) => k.team === "red");
    reds[0]!.x = 580;
    reds[0]!.y = 180;
    reds[1]!.x = 575;
    reds[1]!.y = 230;
    const fort = shouldHideInPile(s, green, "enemy", true);
    assert.ok(fort);
    assert.ok(Math.abs(fort!.x - 390) < 80);
  });

  it("does not run through the pack to a pile behind the enemies", () => {
    const s = createState(1);
    const green = s.kids.find((k) => k.team === "green")!;
    green.x = 180;
    green.y = 270;
    const reds = s.kids.filter((k) => k.team === "red");
    reds.forEach((r, i) => {
      if (i < 2) {
        r.x = 250 + i * 30;
        r.y = 270;
      } else {
        r.hp = 0;
        r.state = "buried";
      }
    });
    const fort = shouldHideInPile(s, green, "enemy", false);
    assert.equal(fort, null);
  });

  it("also hides for maltese AI when retrievers press from the left", () => {
    const s = createState(1, true);
    const red = s.kids.find((k) => k.team === "red")!;
    red.x = 620;
    red.y = 200;
    const greens = s.kids.filter((k) => k.team === "green");
    greens[0]!.x = 520;
    greens[0]!.y = 180;
    greens[1]!.x = 525;
    greens[1]!.y = 220;
    const fort = shouldHideInPile(s, red, "defend", false);
    assert.ok(fort);
  });

  it("will not re-enter a pile during hide cooldown", () => {
    const s = createState(1, false, { hard: true });
    const green = s.kids.find((k) => k.team === "green")!;
    green.x = 500;
    green.y = 200;
    green.ai = {
      phase: "idle",
      t: 0,
      destX: green.x,
      destY: green.y,
      charge: 0,
      coverT: 0,
      awayT: 4,
    };
    const reds = s.kids.filter((k) => k.team === "red");
    reds[0]!.x = 580;
    reds[0]!.y = 180;
    reds[1]!.x = 575;
    reds[1]!.y = 230;
    assert.equal(shouldHideInPile(s, green, "enemy", true), null);
  });

  it("attack allies only hide if the pile is within 200px", () => {
    const s = createState(1);
    const red = s.kids.find((k) => k.team === "red")!;
    red.x = 820;
    red.y = 80;
    const greens = s.kids.filter((k) => k.team === "green");
    greens[0]!.x = 740;
    greens[0]!.y = 70;
    greens[1]!.x = 745;
    greens[1]!.y = 110;
    assert.equal(shouldHideInPile(s, red, "attack", false), null);
    red.x = 500;
    red.y = 200;
    greens[0]!.x = 430;
    greens[0]!.y = 180;
    greens[1]!.x = 435;
    greens[1]!.y = 220;
    const near = shouldHideInPile(s, red, "attack", false);
    assert.ok(near);
  });

  it("the side with numbers does not hide when one foe is left", () => {
    const s = createState(1);
    const red = s.kids.find((k) => k.team === "red")!;
    red.x = 500;
    red.y = 200;
    const greens = s.kids.filter((k) => k.team === "green");
    greens.forEach((g, i) => {
      if (i > 0) {
        g.hp = 0;
        g.state = "buried";
      } else {
        g.x = 430;
        g.y = 190;
      }
    });
    assert.equal(shouldHideInPile(s, red, "attack", false), null);
    assert.equal(shouldHideInPile(s, red, "defend", false), null);
  });
});

describe("hide fuel", () => {
  it("drains in a pile and must refill before re-entry", () => {
    const s = createState(1);
    s.phase = "fight";
    const red = s.kids.find((k) => k.team === "red")!;
    red.x = 390;
    red.y = 168;
    red.hideFuel = 1;
    tickHideFuel(s, 2.5);
    assert.ok(red.hideFuel < 0.6);
    assert.ok(red.hideSession);
    red.x = 120;
    red.y = 80;
    tickHideFuel(s, 0.05);
    assert.equal(red.hideSession, false);
    assert.equal(canEnterFort(red), false);
    const left = red.hideFuel;
    tickHideFuel(s, 1);
    assert.ok(red.hideFuel > left);
    red.hideFuel = 1;
    assert.equal(canEnterFort(red), true);
  });

  it("advantage side does not keep an empty hide bar", () => {
    const s = createState(1);
    s.phase = "fight";
    const reds = s.kids.filter((k) => k.team === "red");
    reds[1]!.hp = 0;
    reds[1]!.state = "buried";
    reds[2]!.hp = 0;
    reds[2]!.state = "buried";
    const g = s.kids.find((k) => k.team === "green")!;
    g.hideFuel = 0.4;
    tickHideFuel(s, 0.05);
    assert.equal(g.hideFuel, 1);
  });
});

describe("camp", () => {
  it("forces a standing AI dog to move after 3s", () => {
    const s = createState(1, false, { hard: false });
    s.phase = "fight";
    s.forts = [];
    const g = s.kids.find((k) => k.team === "green")!;
    g.x = 120;
    g.y = 270;
    g.packT = 0;
    g.cooldown = 0;
    g.stun = 0;
    g.state = "idle";
    stepAi(s, 0, () => {}, "off", "enemy", false, false);
    g.ai!.phase = "idle";
    g.ai!.t = 9;
    g.ai!.destX = g.x;
    g.ai!.destY = g.y;
    g.ai!.campX = g.x;
    g.ai!.campY = g.y;
    g.ai!.campT = 0;
    for (let i = 0; i < 200; i++) stepAi(s, 1 / 60, () => {}, "off", "enemy", false, false);
    assert.equal(String(g.ai!.phase), "move");
    assert.ok(Math.hypot(g.ai!.destX - 120, g.ai!.destY - 270) > 80);
  });
});

describe("fortCoverSpot", () => {
  const fort = { x: 390, y: 200, rx: 90, ry: 40, hitFlash: 0, hp: 0, maxHp: 0 };

  it("peeks to the right when the threat is on the left", () => {
    const p = fortCoverSpot(fort, { x: 120, y: 200 }, "peek");
    assert.ok(p.x > fort.x + fort.rx);
  });

  it("peeks below when the threat is above", () => {
    const p = fortCoverSpot(fort, { x: 390, y: 40 }, "peek");
    assert.ok(p.y > fort.y + fort.ry * 0.5);
  });

  it("peeks above when the threat is below", () => {
    const p = fortCoverSpot(fort, { x: 390, y: 400 }, "peek");
    assert.ok(p.y < fort.y - fort.ry * 0.5);
  });
});

describe("last stand", () => {
  it("the last AI dog runs to a pile instead of winding up a shot", () => {
    const s = createState(1, false, { hard: true });
    s.phase = "fight";
    const greens = s.kids.filter((k) => k.team === "green");
    greens.forEach((g, i) => {
      if (i > 0) {
        g.hp = 0;
        g.state = "buried";
      } else {
        g.x = 120;
        g.y = 80;
        g.packT = 0;
        g.cooldown = 0;
        g.stun = 0;
        g.state = "idle";
      }
    });
    const g = greens[0]!;
    for (let i = 0; i < 90; i++) stepAi(s, 1 / 60, () => {}, "off", "enemy", false, true);
    assert.ok(g.ai);
    const near = (x: number, y: number) =>
      Math.min(Math.hypot(x - 390, y - 168), Math.hypot(x - 545, y - 372));
    assert.ok(near(g.ai.destX, g.ai.destY) < 160 || near(g.x, g.y) < 160, "should be going to a snow pile");
    assert.notEqual(g.ai.phase, "windup");
  });
});

describe("windup walk", () => {
  it("keeps charging while walking at normal speed", () => {
    const s = createState(1, false, { hard: false });
    s.phase = "fight";
    const g = s.kids.find((k) => k.team === "green")!;
    g.x = 100;
    g.y = 200;
    g.packT = 0;
    g.cooldown = 0;
    g.stun = 0;
    g.state = "idle";
    stepAi(s, 0, () => {}, "off", "enemy", false, false);
    g.ai!.phase = "windup";
    g.ai!.t = 2;
    g.ai!.charge = 0.4;
    g.ai!.destX = 260;
    g.ai!.destY = 200;
    const x0 = g.x;
    const c0 = g.ai!.charge;
    for (let i = 0; i < 20; i++) stepAi(s, 1 / 60, () => {}, "off", "enemy", false, false);
    assert.equal(g.ai!.phase, "windup");
    assert.ok(g.ai!.charge > c0);
    assert.ok(g.x > x0 + 4);
  });
});

describe("resume after buff / last stand / no pile shots", () => {
  it("dumps the held charge at a foe once the big-ball buff expires", () => {
    const s = createState(1, true);
    s.phase = "fight";
    s.buffs.red = { kind: "big", shots: 0, t: 0 };
    const g = s.kids.find((k) => k.team === "green")!;
    g.x = 120;
    g.y = 80;
    g.packT = 0;
    g.cooldown = 0;
    g.stun = 0;
    g.state = "idle";
    stepAi(s, 0, () => {}, "off", "enemy", false, true);
    g.ai!.phase = "windup";
    g.ai!.t = 9;
    g.ai!.charge = 1;
    g.ai!.destX = g.x;
    g.ai!.destY = g.y;
    stepAi(s, 1 / 60, () => {}, "off", "enemy", false, true);
    assert.ok(g.ai!.t < 1.5 || s.balls.some((b) => b.team === "green"));
    assert.ok(!(g.ai!.t > 5 && String(g.ai!.phase) === "windup"));
  });

  it("the last dog may shoot after hide cooldown", () => {
    const s = createState(1, false, { hard: true });
    s.phase = "fight";
    const greens = s.kids.filter((k) => k.team === "green");
    greens.forEach((k, i) => {
      if (i > 0) {
        k.hp = 0;
        k.state = "buried";
      }
    });
    const g = greens[0]!;
    g.x = 200;
    g.y = 80;
    g.packT = 0;
    g.cooldown = 0;
    g.stun = 0;
    g.state = "idle";
    s.forts = [];
    stepAi(s, 0, () => {}, "off", "enemy", false, true);
    g.hideFuel = 0.2;
    g.ai!.awayT = 3;
    g.ai!.coverT = 0;
    g.ai!.phase = "idle";
    g.ai!.t = 0;
    g.ai!.charge = 0;
    let wind = false;
    for (let i = 0; i < 90; i++) {
      g.hideFuel = 0.2;
      g.ai!.awayT = Math.max(g.ai!.awayT, 2);
      stepAi(s, 1 / 60, () => {}, "off", "enemy", false, true);
      if (String(g.ai!.phase) === "windup" || s.balls.some((b) => b.fromId === g.id)) wind = true;
    }
    assert.ok(wind || s.balls.some((b) => b.fromId === g.id));
  });

  it("allies do not aim through a snow pile", () => {
    const s = createState(1);
    s.phase = "fight";
    const red = s.kids.find((k) => k.team === "red")!;
    red.x = 700;
    red.y = 168;
    for (const g of s.kids.filter((k) => k.team === "green")) {
      g.x = 250;
      g.y = 168;
    }
    const aim = throwAimForStance(red, s, "attack", false);
    if (aim) {
      const dist = Math.hypot(aim.dx, aim.dy) || 1;
      const steps = Math.max(6, Math.ceil(dist / 18));
      let hit = false;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const x = red.x + aim.dx * t;
        const y = red.y + aim.dy * t;
        if (s.forts.some((f) => ((x - f.x) / f.rx) ** 2 + ((y - f.y) / f.ry) ** 2 <= 1)) hit = true;
      }
      assert.equal(hit, false);
    }
  });
});

describe("ai rhythm", () => {
  it("staggers if a teammate just threw", () => {
    const s = createState(1);
    s.phase = "fight";
    s.time = 4;
    const greens = s.kids.filter((k) => k.team === "green");
    greens[0]!.ai!.lastThrowAt = 3.8;
    assert.equal(mateThrewRecently(s, greens[1]!), true);
    assert.equal(mateThrewRecently(s, greens[0]!), false);
  });

  it("hard jobs split press / wrap / loot", () => {
    const s = createState(1, false, { hard: true });
    s.time = 0;
    const greens = s.kids.filter((k) => k.team === "green").sort((a, b) => a.y - b.y || a.id - b.id);
    const jobs = new Set(greens.map((g) => teamJob(s, g)));
    assert.equal(jobs.size, 3);
  });

  it("gold pickup surges for 0.8s", () => {
    const s = createState(1);
    s.buffs.red = { kind: "big", shots: 3, t: 10 };
    assert.equal(teamSurging(s, "red"), true);
    s.buffs.red!.t = 8;
    assert.equal(teamSurging(s, "red"), false);
  });

  it("hunt blocker sits between the last foe and a pile", () => {
    const s = createState(1);
    const greens = s.kids.filter((k) => k.team === "green");
    greens.forEach((g, i) => {
      if (i > 0) {
        g.hp = 0;
        g.state = "buried";
      } else {
        g.x = 200;
        g.y = 168;
      }
    });
    const reds = s.kids.filter((k) => k.team === "red").sort((a, b) => a.y - b.y || a.id - b.id);
    surroundLast(s, reds[0]!, true);
    const pile = s.forts[0]!;
    const foe = greens[0]!;
    const onPath = Math.abs((reds[0]!.ai!.destY - foe.y) * (pile.x - foe.x) - (reds[0]!.ai!.destX - foe.x) * (pile.y - foe.y)) < 4000;
    const between = Math.hypot(reds[0]!.ai!.destX - foe.x, reds[0]!.ai!.destY - foe.y) < Math.hypot(pile.x - foe.x, pile.y - foe.y);
    assert.equal(onPath && between, true);
  });

  it("attack / hard can cancel a windup as a fake", () => {
    const s = createState(1, false, { hard: true });
    s.phase = "fight";
    s.forts = [];
    const g = s.kids.find((k) => k.team === "green")!;
    g.x = 140;
    g.y = 120;
    g.packT = 0;
    g.cooldown = 0;
    g.stun = 0;
    g.state = "idle";
    stepAi(s, 0, () => {}, "off", "enemy", false, true);
    g.ai!.phase = "windup";
    g.ai!.t = 0.5;
    g.ai!.charge = 0.22;
    g.ai!.fake = true;
    g.ai!.destX = g.x;
    g.ai!.destY = g.y;
    stepAi(s, 0.05, () => {}, "off", "enemy", false, true);
    assert.equal(String(g.ai!.phase), "dodge");
  });

  it("enemy AI winds up as soon as a foe is grabbed", () => {
    const s = createState(1, false, { hard: false });
    s.phase = "fight";
    s.forts = [];
    const red = s.kids.find((k) => k.team === "red")!;
    red.x = 520;
    red.y = 200;
    red.state = "grabbed";
    const g = s.kids.find((k) => k.team === "green")!;
    g.x = 180;
    g.y = 200;
    g.packT = 0;
    g.cooldown = 0;
    g.stun = 0;
    g.state = "idle";
    stepAi(s, 0, () => {}, "off", "enemy", false, false);
    g.ai!.phase = "move";
    g.ai!.t = 2;
    stepAi(s, 0.05, () => {}, "off", "enemy", false, false);
    const allowed = grabShooters(s, "green", false);
    assert.equal(allowed?.size, 1);
    let throws = 0;
    const who = new Set<number>();
    for (let i = 0; i < 40; i++) {
      stepAi(s, 1 / 60, (_p, kid) => {
        throws += 1;
        who.add(kid.id);
      }, "off", "enemy", false, false);
    }
    assert.ok(throws > 0);
    assert.ok(who.size <= 1);
  });

  it("easy retrievers fan out past midfield to hunt the last maltese", () => {
    const s = createState(1);
    const reds = s.kids.filter((k) => k.team === "red");
    reds.forEach((r, i) => {
      if (i > 0) {
        r.hp = 0;
        r.state = "buried";
      } else {
        r.x = 820;
        r.y = 270;
      }
    });
    const greens = s.kids.filter((k) => k.team === "green");
    const xs = greens.map((g) => {
      surroundLast(s, g);
      return g.ai!.destX;
    });
    assert.ok(Math.max(...xs) > WORLD_W * 0.48);
    assert.ok(xs.filter((x) => x > WORLD_W * 0.48).length <= 2);
    const ys = greens.map((g) => g.ai!.destY);
    assert.ok(Math.max(...ys) - Math.min(...ys) > 40);
  });

  it("defend AI volleys with a dragged teammate even if the shot may miss", () => {
    const s = createState(1);
    s.phase = "fight";
    const reds = s.kids.filter((k) => k.team === "red");
    const drag = reds[0]!;
    const ally = reds[1]!;
    drag.state = "grabbed";
    drag.x = 700;
    drag.y = 200;
    ally.x = 760;
    ally.y = 360;
    ally.packT = 0;
    ally.cooldown = 0;
    ally.stun = 0;
    ally.state = "idle";
    assert.ok(draggedMate(s, ally));
    const aim = throwAimForStance(ally, s, "defend", false);
    assert.ok(aim && aim.dx < 0);
    stepAi(s, 0, () => {}, "defend", "enemy", false, false);
    ally.ai!.phase = "move";
    ally.ai!.t = 2;
    stepAi(s, 0.05, () => {}, "defend", "enemy", false, false);
    assert.equal(String(ally.ai!.phase), "windup");
  });

  it("comeback gold heals one pip and spawns on the player side", () => {
    const s = createState(1, false);
    s.phase = "fight";
    const reds = s.kids.filter((k) => k.team === "red");
    reds[1]!.hp = 0;
    reds[1]!.state = "buried";
    reds[2]!.hp = 0;
    reds[2]!.state = "buried";
    reds[0]!.hp = 1;
    assert.equal(playerComeback(s), true);
    s.pickupCd = 0.4;
    maybeArmComeback(s);
    assert.ok(s.pickupCd >= 6.5);
    s.pickup = { x: 480, y: 270, kind: "big", life: 10, maxLife: 10 };
    assert.equal(claimPickup(s, "red"), true);
    assert.equal(reds[0]!.hp, 2);
    s.pickupCd = 0;
    stepPickups(s, 0.05, true);
    assert.ok(s.pickup && s.pickup.x > 540);
  });

  it("comeback gold does not trigger while two maltese remain", () => {
    const s = createState(1, false);
    const reds = s.kids.filter((k) => k.team === "red");
    reds[2]!.hp = 0;
    reds[2]!.state = "buried";
    assert.equal(playerComeback(s), false);
  });

  it("AI does not throw a sixth ball when five are already flying", () => {
    const s = createState(1);
    s.phase = "fight";
    s.forts = [];
    for (let i = 0; i < 5; i++) {
      s.balls.push({
        x: 400,
        y: 180 + i * 20,
        vx: 90,
        vy: 0,
        team: "green",
        r: 12,
        fromId: -1,
        grace: 0,
        spin: 0,
        alive: true,
        range: 500,
        traveled: 0,
      });
    }
    assert.equal(arenaBalls(s), 5);
    assert.equal(arenaCanThrow(s), false);
    const g = s.kids.find((k) => k.team === "green")!;
    g.x = 160;
    g.y = 200;
    g.packT = 0;
    g.cooldown = 0;
    g.stun = 0;
    g.state = "idle";
    let throws = 0;
    for (let i = 0; i < 50; i++) {
      stepAi(s, 1 / 60, () => {
        throws += 1;
      }, "off", "enemy", false, false);
    }
    assert.equal(throws, 0);
    assert.ok(arenaBalls(s) <= 5);
  });

  it("AI throws when the arena is empty", () => {
    const s = createState(1);
    s.phase = "fight";
    s.forts = [];
    s.balls = [];
    for (const k of s.kids) {
      k.packT = 0;
      k.cooldown = 0;
      k.stun = 0;
      if (k.team === "green") {
        k.x = 160;
        k.state = "idle";
      }
    }
    let throws = 0;
    for (let i = 0; i < 90; i++) {
      stepAi(s, 1 / 60, () => {
        throws += 1;
      }, "off", "enemy", false, false);
    }
    assert.ok(throws > 0);
  });
});
