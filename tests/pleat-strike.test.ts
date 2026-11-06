import { expect, it } from "vitest";
import {
  addPlayer,
  createWorld,
  spawn,
  start,
  step,
  neutral,
} from "../src/shared/game";
import { mapFor } from "../src/shared/stages";
import { createPleat } from "../src/shared/pleat-locomotion";
import { surfaceRay } from "../src/shared/surface-ray";
import { pleatStrike, insidePleatStrike } from "../src/shared/pleat-strike";
import { prepareState } from "../src/shared/state-wire";
function field() {
  const w = createWorld("pleat-strike", 11, 1),
    p = addPlayer(w, "p");
  start(w);
  w.nextSpawn = 1e9;
  w.enemies = [];
  p.x = 0;
  p.z = 1.5;
  p.hp = 10000;
  p.safe = 0;
  spawn(w, "crawler", 0, 0);
  const e = w.enemies[0];
  Object.assign(e, {
    x: 0,
    y: 0,
    z: 0,
    size: 1,
    active: true,
    wind: 0.8,
    cool: 0,
    tx: 0,
    ty: 0,
    tz: 1.5,
  });
  e.pleat = createPleat({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, 1.5, {
    ray: (o, d, l) => surfaceRay(o, d, l, mapFor(w).blocks),
  });
  return { w, p, e };
}
it("0.8秒の固定予告後に滑らかに踏み込み、同じ相手へ1回だけ命中する", () => {
  const { w, p, e } = field();
  const hp = p.hp;
  for (let i = 0; i < 15; i++) step(w, { p: neutral() });
  expect(p.hp).toBe(hp);
  expect(e.z).toBeCloseTo(0);
  let damageTicks = 0,
    maxStep = 0,
    lastHp = p.hp;
  for (let i = 0; i < 8; i++) {
    const before = e.z;
    step(w, { p: neutral() });
    maxStep = Math.max(maxStep, Math.abs(e.z - before));
    if (p.hp < lastHp) damageTicks++;
    lastHp = p.hp;
  }
  expect(damageTicks).toBe(1);
  expect(e.z).toBeGreaterThan(3.9);
  expect(maxStep).toBeLessThan(1);
  expect(e.pleat!.strike).toBeUndefined();
});
it("横移動と回避入力で予告から脱出できる", () => {
  for (const dodge of [false, true]) {
    const { w, p, e } = field();
    const hp = p.hp;
    for (let i = 0; i < 24; i++)
      step(w, { p: { ...neutral(), mx: 1, dodge: dodge && i === 16 } });
    expect(p.hp).toBe(hp);
    expect(e.tx).toBe(0);
    expect(e.x).toBeCloseTo(0);
  }
});
it("壁・段差・床の途切れ・壁面姿勢では踏み込まず従来射程に戻る", () => {
  const { e } = field();
  expect(pleatStrike(e, []).travel).toBe(4);
  for (const blocks of [
    [{ x: 0, z: 3, w: 4, d: 1, h: 4 }],
    [{ x: 0, z: 3, w: 4, d: 1, h: 0.2 }],
  ])
    expect(pleatStrike(e, blocks).travel).toBe(0);
  e.y = 4;
  e.pleat!.anchor.y = 4;
  e.pleat!.body.y = 5.2;
  expect(pleatStrike(e, [{ x: 0, z: 0, w: 10, d: 3, h: 4 }]).travel).toBe(0);
  e.y = 0;
  e.pleat!.up = { x: 1, y: 0, z: 0 };
  expect(pleatStrike(e, []).travel).toBe(0);
});
it("予告の掃引扇形から外れた横・後方・遠方には当たらない", () => {
  const { e } = field(),
    a = pleatStrike(e, []);
  expect(insidePleatStrike(a, { x: 0, z: 6, y: 0 })).toBe(true);
  for (const p of [
    { x: 0, z: 7, y: 0 },
    { x: 3, z: 4, y: 0 },
    { x: 1, z: 0, y: 0 },
    { x: 0, z: -1, y: 0 },
    { x: 0, z: 4, y: 3 },
  ])
    expect(insidePleatStrike(a, p)).toBe(false);
});
it("命中済み状態は保存復帰しても維持し旧戦況packetへ内部状態を追加しない", () => {
  const { w, p, e } = field();
  for (let i = 0; i < 18; i++) step(w, { p: neutral() });
  expect(e.pleat!.strike?.hit).toContain("p");
  const hp = p.hp;
  e.pleat = JSON.parse(JSON.stringify(e.pleat));
  step(w, { p: neutral() }, 0);
  expect(Number.isFinite(e.pleat!.velocity.x)).toBe(true);
  expect(Number.isFinite(e.pleat!.velocity.z)).toBe(true);
  const packet = prepareState(w, 0, {
    members: [],
    preparationGeneration: 0,
  }).packet(p.id);
  expect(JSON.parse(packet).world.enemies[0].pleat.strike).toBeUndefined();
  for (let i = 0; i < 4; i++) step(w, { p: neutral() });
  expect(p.hp).toBe(hp);
});
