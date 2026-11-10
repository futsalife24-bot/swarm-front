import { expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  createWorld,
  addPlayer,
  spawn,
  hurtEnemy,
  step,
  start,
} from "../src/shared/game";
import { wormNodes, initWorm, moveWorm } from "../src/shared/worm";
import {
  OMEGA,
  planOmega,
  stepOmega,
  omegaPads,
  omegaPhase,
  omegaPose,
} from "../src/shared/catena-omega";
import { enemySize } from "../src/shared/enemy-size";
import { encodeState } from "../src/shared/state-wire";
import { MAPS, STAGES, mapFor } from "../src/shared/stages";
import { supportHeight } from "../src/shared/terrain";

function field() {
  const w = createWorld("omega-test", 11, 6);
  const p = addPlayer(w, "p");
  start(w);
  w.enemies = [];
  w.nextSpawn = 1e9;
  const e = spawn(w, "boss", 0, -10, "worm")!;
  e.size = 0.8;
  e.active = true;
  initWorm(e);
  w.training = true;
  wormNodes(e).forEach((n, i) =>
    Object.assign(n, {
      x: 0,
      y: 0,
      z: (i - 7) * 3.2 * enemySize(e) - 10,
      heading: Math.PI,
    }),
  );
  e.trail = wormNodes(e)
    .map((n) => ({ x: n.x, z: n.z }))
    .reverse();
  wormNodes(e).forEach((n, i) => {
    n.trailOwner = 0;
    n.trailOffset = i * 3.2 * enemySize(e);
    if (i) n.trail = undefined;
  });
  Object.assign(p, { x: 0, y: 0, z: -10, hp: 1000 });
  e.omegaReadyAt = 0;
  return { w, p, e };
}
const impact = OMEGA.brace + OMEGA.warn + OMEGA.flight;
it("候補は胴14節でも総HP・頭HP・稼働砲口8を維持する", () => {
  const { w, e } = field();
  expect(e.segments).toHaveLength(14);
  expect(wormNodes(e).reduce((s, n) => s + n.partHp!, 0)).toBeCloseTo(e.maxHp);
  expect(e.partHp).toBe(e.maxHp / 8);
  expect(e.segments![0].partHp).toBe(e.maxHp / 16);
  e.omegaReadyAt = 1e9;
  w.time = 0.1;
  for (const n of wormNodes(e)) n.acidAt = w.time + 0.8;
  moveWorm(w, e, 0);
  expect(wormNodes(e).filter((n) => n.pulseAim)).toHaveLength(8);
});
it("予備動作→赤予告→Ω飛行→一度の着地攻撃の順で固定地点へ戻る", () => {
  const { w, e, p } = field();
  expect(stepOmega(w, e)).toBe(true);
  const ground = structuredClone(e.omega!.ground);
  expect(omegaPhase(e, 0)).toBe("brace");
  expect(omegaPads(e, 0)).toEqual([]);
  w.time = OMEGA.brace;
  stepOmega(w, e);
  expect(omegaPads(e, w.time)).toHaveLength(15);
  expect(p.hp).toBe(1000);
  w.time = OMEGA.brace + OMEGA.warn + 0.9;
  stepOmega(w, e);
  expect(omegaPhase(e, w.time)).toBe("flight");
  expect(Math.max(...wormNodes(e).map((n) => n.y))).toBeGreaterThan(12);
  expect(e.omega!.ground).toEqual(ground);
  w.time = impact;
  stepOmega(w, e);
  expect(e.omega).toBeUndefined();
  expect(
    wormNodes(e).map(({ x, y, z, heading }) => ({ x, y, z, heading })),
  ).toEqual(ground);
  const hp = p.hp;
  expect(hp).toBeLessThan(1000);
  w.time += 0.05;
  stepOmega(w, e);
  expect(p.hp).toBe(hp);
});
it("頭から尾へ滑らかに跳ね、節間と地上の着地印を保つ", () => {
  const { w, e } = field();
  stepOmega(w, e);
  const planned = e.omega!;
  const flightAt = planned.at + OMEGA.brace + OMEGA.warn;
  const takeoff = omegaPose(planned, flightAt + 0.3);
  const descent = omegaPose(planned, flightAt + 1.35);
  expect(takeoff[0].y).toBeGreaterThan(takeoff.at(-1)!.y + 1);
  expect(descent.at(-1)!.y).toBeGreaterThan(descent[0].y + 1);
  for (const pose of [takeoff, descent]) {
    for (const [i, p] of pose.entries()) {
      expect([p.x, p.z]).toEqual([planned.ground[i].x, planned.ground[i].z]);
      if (i === 0) continue;
      const distance = Math.hypot(
        p.x - pose[i - 1].x,
        p.y - pose[i - 1].y,
        p.z - pose[i - 1].z,
      );
      const groundDistance = Math.hypot(
        planned.ground[i].x - planned.ground[i - 1].x,
        planned.ground[i].z - planned.ground[i - 1].z,
      );
      expect(distance / groundDistance).toBeLessThan(1.35);
    }
  }
  expect(omegaPose(planned, flightAt + OMEGA.flight)).toEqual(planned.ground);
});
it("重複円は協力各隊員へ最大1回、圏外・高所・回避・切断隊員は無傷", () => {
  const { w, e, p } = field();
  const players = Array.from({ length: 5 }, (_, i) => addPlayer(w, `p${i}`));
  for (const q of players) Object.assign(q, { x: 0, y: 0, z: -10, hp: 1000 });
  p.z = -8.4;
  players[0].x = 3;
  players[1].y = 2;
  players[2].evade = 0.2;
  players[3].connected = false;
  stepOmega(w, e);
  w.time = impact;
  stepOmega(w, e);
  expect(p.hp).toBe(players[4].hp);
  expect(p.hp).toBeLessThan(1000);
  for (const q of players.slice(0, 4)) expect(q.hp).toBe(1000);
});
it("赤予告後に徒歩で退避でき、着地地点は追尾しない", () => {
  const { w, e, p } = field();
  stepOmega(w, e);
  w.time = 0.8;
  stepOmega(w, e);
  p.x = 3;
  expect(omegaPads(e, w.time).every((n) => n.x === 0)).toBe(true);
  w.time = impact;
  stepOmega(w, e);
  expect(p.hp).toBe(1000);
  expect(OMEGA.radius / 7).toBeLessThan(OMEGA.warn);
});
it.each([0, 5])("空中の部位%j破壊で全姿勢を復帰し、着地攻撃を中止", (part) => {
  const { w, e, p } = field();
  stepOmega(w, e);
  w.time = 2.4;
  stepOmega(w, e);
  hurtEnemy(w, e, 1e9, p.id, part);
  expect(e.omega).toBeUndefined();
  expect(wormNodes(e).every((n) => n.y === 0)).toBe(true);
  w.time = impact;
  stepOmega(w, e);
  expect(p.hp).toBe(1000);
});
it("全員死亡/切断時は攻撃せず解除、同じ時刻は進めない", () => {
  const { w, e, p } = field();
  stepOmega(w, e);
  const before = JSON.stringify(e.omega);
  stepOmega(w, e);
  expect(JSON.stringify(e.omega)).toBe(before);
  p.connected = false;
  w.time = 2.5;
  stepOmega(w, e);
  expect(e.omega).toBeUndefined();
  expect(wormNodes(e).every((n) => n.y === 0)).toBe(true);
});
it("旧7節の保存を保持して読め、破断後は新規Ωを開始しない", () => {
  const { w, e } = field();
  e.segments = e.segments!.slice(0, 7);
  e.partHp = undefined;
  for (const n of e.segments) n.partHp = undefined;
  initWorm(e);
  expect(wormNodes(e).reduce((s, n) => s + n.partHp!, 0)).toBeCloseTo(e.maxHp);
  e.fractured = true;
  expect(planOmega(w, e)).toBeUndefined();
});
it("頭部増援は最大7、途中切断は対応する枠だけを残す", () => {
  for (const cut of [0, 1, 2, 3, 8, 14]) {
    const { w, e, p } = field();
    w.training = false;
    if (cut) hurtEnemy(w, e, 1e9, p.id, cut);
    hurtEnemy(w, e, 1e9, p.id, 0);
    expect(w.foundrySpawns?.[0]?.parts.length ?? 0).toBe(
      cut ? Math.ceil((cut - 1) / 2) : 7,
    );
  }
});
it("実wireの丸め後も同じΩと予告を保持し、着地は1回に収まる", () => {
  const { w, e, p } = field();
  stepOmega(w, e);
  w.time = 2.4;
  stepOmega(w, e);
  const copy = JSON.parse(encodeState(w));
  expect(copy.enemies[0].omega.ground).toHaveLength(15);
  w.time = copy.time = impact;
  stepOmega(w, e);
  stepOmega(copy, copy.enemies[0]);
  expect(copy.players[0].hp).toBeCloseTo(p.hp, 1);
  expect(copy.enemies[0].omega).toBeUndefined();
});
it("洞窟の低い天井・地形段差・壁横断ではΩを発動しない", () => {
  const { w, e } = field();
  w.training = false;
  const cave = STAGES.find((s) => MAPS[s.map].biome === "cave")!;
  w.stage = cave.id;
  expect(planOmega(w, e)).toBeUndefined();
  w.training = true;
  wormNodes(e)[4].y = 1;
  expect(planOmega(w, e)).toBeUndefined();
  wormNodes(e)[4].y = 0;
  wormNodes(e)[4].x = 30;
  expect(planOmega(w, e)).toBeUndefined();
});
it("現行全マップの配置・形状を検査し、発動候補の支持面と座標を確認", () => {
  let valid = 0;
  for (const s of STAGES) {
    const w = createWorld(`map-${s.id}`, 11, s.id);
    addPlayer(w, "p");
    const e = spawn(w, "boss", 0, 0, "worm")!;
    initWorm(e);
    expect(e.segments).toHaveLength(14);
    expect(
      wormNodes(e).every((n) => [n.x, n.y, n.z].every(Number.isFinite)),
    ).toBe(true);
    const plan = planOmega(w, e);
    if (plan) {
      valid++;
      for (const n of plan.ground)
        expect(n.y).toBeCloseTo(supportHeight(n.x, n.z, mapFor(w).blocks));
    }
  }
  // 発動可能性そのものは専用平坦な訓練場でも確認済み。通常配置での件数は証拠に残す。
  console.log("現行25作戦の初期配置でΩ可能", valid);
});
it("実際の巡回と標準待ち時間からΩが自然発動し、地形制約下でも有限座標を維持する", () => {
  const results: {
    stage: number;
    map: string;
    jumps: number;
    maxHeight: number;
  }[] = [];
  for (let index = 0; index < MAPS.length; index++) {
    const s = STAGES.find((s) => s.map === index)!;
    const w = createWorld(`natural-${index}`, 11, s.id);
    const p = addPlayer(w, "p");
    Object.assign(p, { x: 70, z: 70, hp: 1e9 });
    const e = spawn(w, "boss", 0, 0, "worm")!;
    e.active = true;
    let was = false,
      jumps = 0,
      maxHeight = 0;
    for (let tick = 0; tick < 2400; tick++) {
      w.time += 0.05;
      moveWorm(w, e, 0.05);
      w.projectiles = [];
      w.events = [];
      if (e.omega && !was) jumps++;
      was = !!e.omega;
      for (const n of wormNodes(e)) {
        expect([n.x, n.y, n.z].every(Number.isFinite)).toBe(true);
        maxHeight = Math.max(
          maxHeight,
          n.y - supportHeight(n.x, n.z, mapFor(w).blocks),
        );
      }
    }
    results.push({ stage: s.id, map: MAPS[index].name, jumps, maxHeight });
  }
  expect(results.some((r) => r.jumps > 0)).toBe(true);
  expect(results.at(-1)!.jumps).toBe(0);
  mkdirSync("dist-validation/catena-omega", { recursive: true });
  writeFileSync(
    "dist-validation/catena-omega/natural-motion.json",
    JSON.stringify(results, null, 2),
  );
});
