import { expect, it } from "vitest";
import {
  createWorld,
  spawn,
  enemyBodies,
  step,
  addPlayer,
  neutral,
} from "../src/shared/game";
import { ENEMIES } from "../src/shared/defs";
import { STAGES } from "../src/shared/stages";
import {
  enemySize,
  enemySpeedFactor,
  spawnSize,
} from "../src/shared/enemy-size";
import { wormSpeed, wormNodes, moveWorm } from "../src/shared/worm";
import { foundryLaserOrigin } from "../src/shared/foundry-defs";

it.each(STAGES)(
  "stage $id keeps the same size roster across seeds, unrelated serials and snapshots",
  (stage) => {
    const a = createWorld("a", 1, stage.id),
      b = createWorld("b", 999, stage.id);
    const sizes: number[] = [];
    for (let n = 0; n < 32; n++) {
      a.enemies = [];
      b.enemies = [];
      b.serial += n * 13;
      const kind = (Object.keys(ENEMIES) as (keyof typeof ENEMIES)[])[n % 6];
      const form = kind === "boss" ? "worm" : "crown";
      const ea = spawn(a, kind, 0, 0, form)!,
        eb = spawn(b, kind, 0, 0, form)!;
      expect(ea.size).toBe(eb.size);
      expect(ea.maxHp).toBeCloseTo(ENEMIES[kind].hp * stage.hp * enemySize(ea));
      expect(enemyBodies(ea)[0].radius).toBeCloseTo(
        ENEMIES[kind].radius * enemySize(ea),
      );
      expect(JSON.parse(JSON.stringify(a)).enemies[0].size).toBe(ea.size);
      sizes.push(ea.size!);
    }
    expect(Math.min(...sizes)).toBe(0.8);
    expect(Math.max(...sizes)).toBe(2);
  },
);
it("normal Foundry is doubled; future kinds automatically use the shared roster", () => {
  for (let n = 0; n < 32; n++) {
    expect(spawnSize("boss", false, n)).toBe(2);
    expect(spawnSize("future-enemy", false, n)).toBe(
      spawnSize("ant", false, n),
    );
  }
  expect(enemySpeedFactor({ size: 0.8 })).toBe(1.5);
  expect(enemySpeedFactor({ size: 1 })).toBe(1.5);
  expect(enemySpeedFactor({ size: 1.01 })).toBe(1);
  expect(enemySpeedFactor({ size: 2 })).toBe(1);
});
it.each([0.8, 1, 2])(
  "worm size %s keeps spacing, movement, HP and laser damage consistent",
  (size) => {
    const w = createWorld("size", 42, 4);
    const p = addPlayer(w, "p");
    w.enemyOrdinal = Array.from({ length: 32 }, (_, i) => i).find(
      (i) => spawnSize("boss", true, i) === size,
    )!;
    const e = spawn(w, "boss", 0, 0, "worm")!;
    expect(e.size).toBe(size);
    expect(e.segments![6].trailOffset).toBeCloseTo(7 * 3.2 * size);
    expect(wormSpeed(e)).toBeCloseTo(4.2 * (size <= 1 ? 1.5 : 1));
    for (const [i, node] of wormNodes(e).entries()) {
      node.acidAt = 0;
      node.pulseAim = { x: p.x, y: 1.2, z: p.z };
    }
    moveWorm(w, e, 0);
    expect(w.projectiles).toHaveLength(8);
    w.projectiles.forEach((q, i) => {
      expect(q.damage).toBeCloseTo(10 * size);
      const origin = foundryLaserOrigin(wormNodes(e)[i], i, size);
      expect(q.x).toBeCloseTo(origin.x);
      expect(q.y).toBeCloseTo(origin.y);
    });
  },
);
it.each([0.8, 1, 2])("troop size %s scales direct attack damage", (size) => {
  const w = createWorld("damage", 42, 1);
  const p = addPlayer(w, "p");
  w.phase = "battle";
  w.wave = 1;
  w.nextSpawn = 999;
  const e = spawn(w, "spider", p.x, p.z)!;
  e.size = size;
  e.wind = 0.01;
  e.tx = p.x;
  e.tz = p.z;
  e.active = true;
  e.jumpWait = 100;
  const hp = p.hp;
  step(w, { p: neutral() });
  expect(hp - p.hp).toBeCloseTo(
    ENEMIES.spider.damage * size * STAGES[0].damage,
  );
});
it("authored slots are independent of reinforcements and combat serials", () => {
  const a = createWorld("a"),
    b = createWorld("b");
  for (let n = 0; n < 12; n++) spawn(b, "ant");
  b.serial += 900;
  expect(spawn(a, "crawler", 0, 0, "crown", 22)!.size).toBe(
    spawn(b, "crawler", 0, 0, "crown", 22)!.size,
  );
});
it("simultaneous attacks do not dereference a player downed earlier in the tick", () => {
  const w = createWorld("down", 42, 1),
    p = addPlayer(w, "p");
  w.phase = "battle";
  w.wave = 1;
  w.nextSpawn = 999;
  p.hp = 1;
  for (let n = 0; n < 2; n++) {
    const e = spawn(w, "boss", p.x, p.z)!;
    e.wind = 0.01;
    e.tx = p.x;
    e.tz = p.z;
  }
  expect(() => step(w, { p: neutral() })).not.toThrow();
  expect(p.hp).toBe(0);
  step(w, { p: neutral() });
  expect(w.phase).toBe("defeat");
});
