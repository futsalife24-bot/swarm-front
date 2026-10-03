import { describe, it, expect } from "vitest";
import {
  createFrontRun,
  chooseFrontUpgrade,
  stepFrontRun,
  FRONT_RUN_CONFIG,
  getFrontRunView,
} from "../src/shared/front-run";
import {
  spawn,
  hurtEnemy,
  blocked,
  createWorld,
  event,
} from "../src/shared/game";
import { collectFrontXp, FRONT_BALANCE } from "../src/shared/front-combat";
import { groundHeight } from "../src/shared/terrain";
import { mapFor } from "../src/shared/stages";
import { prepareState } from "../src/shared/state-wire";
import {
  defaultFrontPreferences,
  parseFrontPreferences,
} from "../src/client/front-settings";
const run = (count = 1) =>
  createFrontRun(
    {
      runId: "feedback",
      seed: 4520,
      players: Array.from({ length: count }, (_, i) => ({ id: `p${i}` })),
    },
    0,
  );
const begin = (r: ReturnType<typeof run>) => {
  for (const [id, s] of Object.entries(r.upgrades)) {
    const o = s.offer!;
    chooseFrontUpgrade(
      r,
      id,
      {
        runId: r.world.run,
        offerId: o.id,
        revision: o.revision,
        requestId: id,
        cardId: o.defaultCardId,
      },
      0,
    );
  }
};
describe("戦闘フィードバックの回帰", () => {
  it("空中・建物の真上で倒したRAYの経験値を歩ける地面へ出し、1回だけ回収する", () => {
    const r = run(),
      w = r.world,
      blocks = mapFor(w).blocks;
    const b = blocks[0];
    const e = spawn(w, "hornet", 0, -30)!;
    Object.assign(e, { x: b.x, z: b.z, y: b.h + 9, hp: 1 });
    hurtEnemy(w, e, 2, "p0");
    const orb = w.front!.orbs[0];
    expect(orb).toBeDefined();
    expect(orb.y).toBe(groundHeight(orb.x, orb.z, blocks));
    expect(blocked(orb.x, orb.z, 0.55, orb.y + 0.01, blocks)).toBe(false);
    expect(Math.hypot(orb.x - e.x, orb.z - e.z)).toBeGreaterThan(0);
    Object.assign(w.players[0], { x: orb.x, z: orb.z, y: orb.y });
    expect(collectFrontXp(w)).toBe(2);
    expect(collectFrontXp(w)).toBe(0);
    expect(w.front!.xp).toBe(2);
  });
  it("出現間隔は1/4・通常HPは半分、地上の予兆と距離を維持する", () => {
    const r = run();
    begin(r);
    stepFrontRun(r, {}, 0.05, 2);
    expect(r.nextSpawnAt).toBeCloseTo(4 / 4);
    expect(r.pendingSpawns[0].at).toBe(1.5);
    expect(r.pendingSpawns[0].kinds).toHaveLength(2);
    for (let i = 0; i < 32; i++) stepFrontRun(r, {}, 0.05, 3 + i * 0.05);
    expect(r.world.enemies.length).toBeGreaterThan(0);
    const e = r.world.enemies[0];
    const baseline = createWorld("baseline", 4520, 1);
    const original = spawn(baseline, e.kind, e.x, e.z, "crown", 0)!;
    expect(e.maxHp).toBeCloseTo(original.maxHp / 2);
    expect(FRONT_RUN_CONFIG.enemyCap).toBe(96);
  });
  it("改装版は旧通信上限40体を越えて生成でき、97体で止まる。旧版は40体まで", () => {
    const w = run().world;
    for (let i = 0; i < 110; i++) spawn(w, "crawler", -30, 20);
    expect(w.enemies).toHaveLength(FRONT_BALANCE.enemyCap + 1);
    const legacy = createWorld("legacy");
    for (let i = 0; i < 110; i++) spawn(legacy, "crawler", -30, 20);
    expect(legacy.enemies).toHaveLength(40);
  });
  it("4人・97体・160経験値・全員の印がある状態も通信64KiB内", () => {
    const w = run(4).world;
    for (let i = 0; i < 97; i++) spawn(w, "crawler", -30, 20);
    for (const p of Object.values(w.front!.players))
      for (const e of w.enemies)
        p.statuses[e.id] = { marked: true, hits: 2, lastShot: 999 };
    w.front!.orbs = Array.from({ length: 160 }, (_, i) => ({
      id: 1000 + i,
      x: -30.12345,
      y: 0,
      z: 10.54321,
      value: 2,
    }));
    for (let i = 0; i < 160; i++)
      event(w, {
        type: "burst",
        x: -30.12345,
        y: 0.12345,
        z: 10.54321,
        radius: 5.5,
      });
    const packet = prepareState(w, 0, { front: { phase: "combat" } }).packet(
      "p0",
    );
    expect(new TextEncoder().encode(packet).length).toBeLessThan(65536);
  });
  it("設定の異常値を拒否し、必要な項目だけ復元する", () => {
    expect(parseFrontPreferences(null)).toEqual(defaultFrontPreferences());
    for (const bad of [
      null,
      {},
      { ...defaultFrontPreferences(), volume: 2 },
      { ...defaultFrontPreferences(), sensitivity: 0 },
      { ...defaultFrontPreferences(), frameRate: 144 },
    ])
      expect(() => parseFrontPreferences(JSON.stringify(bad))).toThrow();
    expect(
      parseFrontPreferences(
        JSON.stringify({ ...defaultFrontPreferences(), inventory: ["混入"] }),
      ),
    ).not.toHaveProperty("inventory");
  });
  it("更新前から続く協力作戦は旧クライアントに見えない敵を増やさない", () => {
    const w = run(4).world;
    delete w.front!.enemyCap;
    for (let i = 0; i < 97; i++) spawn(w, "crawler", -30, 20);
    expect(w.enemies).toHaveLength(25);
  });
  it("最大密集の4人通信でも判定状態を保持し、古い演出だけを64KiB内に収める", () => {
    const ids = Array.from({ length: 4 }, (_, i) =>
      String(i).padStart(32, "0"),
    );
    const r = createFrontRun(
        {
          runId: "r".repeat(36),
          seed: 4520,
          players: ids.map((id) => ({ id })),
        },
        0,
      ),
      w = r.world;
    for (let i = 0; i < 97; i++) spawn(w, "hornet", -30.12345, 20.65432);
    for (const p of Object.values(w.front!.players))
      for (const e of w.enemies)
        p.statuses[e.id] = { marked: true, hits: 2, lastShot: 999999 };
    w.front!.orbs = Array.from({ length: 160 }, (_, i) => ({
      id: 100000 + i,
      x: -30.12345,
      y: 0,
      z: 10.54321,
      value: 20,
    }));
    w.front!.mines = Array.from({ length: 12 }, (_, i) => ({
      id: 100000 + i,
      owner: ids[i % 4],
      x: -30.12345,
      y: 0,
      z: 10.54321,
      expires: 999999,
    }));
    w.projectiles = Array.from({ length: 100 }, (_, i) => ({
      id: 100000 + i,
      owner: ids[i % 4],
      x: -30.12345,
      y: 5.12345,
      z: 10.54321,
      dx: 0.56789,
      dy: 0.12345,
      dz: 0.87654,
      life: 3.78901,
      damage: 40,
      rocket: false,
      style: "laser",
    }));
    for (let i = 0; i < 160; i++)
      event(w, {
        type: "shot",
        weapon: "shotgun",
        x: -30.12345,
        y: 0.12345,
        z: 10.54321,
        tx: 45.91234,
        ty: 12.54321,
        tz: -27.65432,
        owner: ids[i % 4],
        stopped: true,
      });
    const original = JSON.stringify(w);
    for (const id of ids)
      for (const cached of [false, true]) {
        const wire = prepareState(w, 0, {
          frontView: getFrontRunView(r, id),
        }).packet(id, cached);
        expect(new TextEncoder().encode(wire).length).toBeLessThanOrEqual(
          65536,
        );
        const received = JSON.parse(wire).world;
        expect(received.enemies).toHaveLength(97);
        expect(received.projectiles).toHaveLength(100);
        expect(received.front.orbs).toHaveLength(160);
        expect(received.front.mines).toHaveLength(12);
        expect(received.front.players[id].statuses).toEqual(
          w.front!.players[id].statuses,
        );
        expect(
          received.front.players[ids.find((other) => other !== id)!].statuses,
        ).toEqual({});
        expect(received.events.length).toBeGreaterThan(0);
        expect(received.events.length).toBeLessThan(160);
        expect(received.events.at(-1).id).toBe(w.events.at(-1)!.id);
      }
    expect(JSON.stringify(w)).toBe(original);
  });
});
