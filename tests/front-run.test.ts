import { describe, it, expect } from "vitest";
import {
  createFrontRun,
  chooseFrontUpgrade,
  stepFrontRun,
  getFrontRunView,
  frontTemporaryWeapons,
  frontDailySeed,
} from "../src/shared/front-legacy-run";
import { grantFrontUpgradeRights } from "../src/shared/front-legacy-upgrades";
import {
  neutral,
  spawn,
  createWorld,
  addPlayer,
  start,
  step,
} from "../src/shared/game";
import {
  frontDodgeEnded,
  beginFrontShot,
  frontManualHit,
  frontReloadStarted,
  tickFrontEffects,
} from "../src/shared/front-combat";
import { prepareState } from "../src/shared/state-wire";
const create = (
  count = 1,
  mode: "survival" | "defense" | "daily" = "survival",
) =>
  createFrontRun(
    {
      runId: "test-run",
      seed: 4520,
      mode,
      day: "2026-10-02",
      players: Array.from({ length: count }, (_, i) => ({ id: `p${i}` })),
    },
    100,
  );
const choose = (
  run: ReturnType<typeof create>,
  id = "p0",
  card?: string,
  now = 101,
) => {
  const offer = run.upgrades[id].offer!;
  return chooseFrontUpgrade(
    run,
    id,
    {
      runId: run.world.run,
      offerId: offer.id,
      revision: offer.revision,
      requestId: `${offer.id}:choose`,
      cardId: (card ?? offer.defaultCardId) as never,
    },
    now,
  );
};
describe("更新前の改装版互換の権威進行", () => {
  it("4人の候補は独立し、15秒を共有、期限で未処理権を順番に確定", () => {
    const run = create(4);
    run.world.front!.xp = 192;
    for (const id of Object.keys(run.upgrades))
      run.upgrades[id] = grantFrontUpgradeRights(run.upgrades[id], 6);
    expect(choose(run)).toBe(true);
    expect(run.phase).toBe("selection");
    expect(run.selectionDeadline).toBe(115);
    expect(choose(run, "p0", undefined, 115)).toBe(false);
    run.world.players[1].connected = false;
    stepFrontRun(run, {}, 0.05, 115);
    expect(run.phase).toBe("combat");
    expect(run.world.time).toBe(0);
    for (const state of Object.values(run.upgrades)) {
      expect(state.picks).toBe(7);
      expect(state.offer).toBeNull();
      expect(state.rerollsRemaining).toBe(2);
    }
    stepFrontRun(run, {}, 0.05, 115.19);
    expect(run.world.time).toBe(0);
    stepFrontRun(run, {}, 0.05, 115.2);
    expect(run.world.time).toBe(0.05);
  });
  it("ソロは無制限、最終補給の全回収と選択中に戦闘を進めない", () => {
    const run = create();
    stepFrontRun(run, {}, 0.05, 10000);
    expect(run.phase).toBe("selection");
    expect(run.world.time).toBe(0);
    choose(run);
    run.world.time = 345;
    run.boundaryIndex = 6;
    run.world.front!.orbs = [{ id: 99, x: 44, y: 0, z: 44, value: 192 }];
    stepFrontRun(run, {}, 0.05, 10001);
    expect(run.phase).toBe("selection");
    expect(run.metrics.xpAtFinalResupply).toBe(192);
    expect(run.world.front!.orbs).toEqual([]);
    for (let i = 0; i < 6; i++) choose(run, "p0", undefined, 10002 + i);
    expect(run.phase).toBe("boss");
    stepFrontRun(run, {}, 0.05, 10007.19);
    expect(run.world.time).toBe(345);
    stepFrontRun(run, {}, 0.05, 10007.2);
    expect(run.bossId).toBeNull();
    expect(
      getFrontRunView(run, "p0").spawnWarnings.some((p) => p.radius === 6),
    ).toBe(true);
    expect(run.world.time).toBe(345.05);
    for (let i = 0; i < 32; i++) stepFrontRun(run, {}, 0.05, 10009 + i * 0.05);
    expect(run.bossId).not.toBeNull();
  });
  it("防衛拠点は旧日次終了180秒に縛られず、破壊で負ける", () => {
    const run = create(1, "defense");
    choose(run);
    run.world.time = 180;
    run.boundaryIndex = 4;
    stepFrontRun(run, {}, 0.05, 1000);
    expect(run.phase).toBe("combat");
    run.world.defense!.armory.hp = 0;
    stepFrontRun(run, {}, 0.05, 1001);
    expect(run.phase).toBe("defeat");
    expect(run.world.rewards).toEqual({});
  });
  it("候補の乱数・履歴・他人の候補は配信しない", () => {
    const run = create(4);
    const wire = JSON.stringify({
      world: run.world,
      front: getFrontRunView(run, "p0"),
    });
    expect(wire).not.toContain("rngState");
    expect(wire).not.toContain("seenCombinations");
    expect(wire).not.toContain("processedRequestIds");
    expect(getFrontRunView(run, "p0").offer!.cardIds).toHaveLength(3);
  });
  it("支給性能と日替わりを再現し、旧版には改装状態を作らない", () => {
    expect(
      frontTemporaryWeapons("r", "p", ["smg", "rifle"]).map((w) => w.kind),
    ).toEqual(["smg", "rifle"]);
    expect(() => frontTemporaryWeapons("r", "p", ["smg", "smg"])).toThrow();
    expect(create(1, "daily").world.seed).toBe(create(1, "daily").world.seed);
    expect(frontDailySeed("2026-10-02")).not.toBe(frontDailySeed("2026-10-03"));
    const old = createWorld("legacy", 4520, 1);
    addPlayer(old, "p");
    start(old);
    step(old, { p: neutral() });
    expect(old.front).toBeUndefined();
  });
});
describe("更新前の改装版互換の戦闘起点と上限", () => {
  it("同一射の散弾で導火・充填・3命中を重複発動しない", () => {
    const run = create();
    choose(run);
    const w = run.world,
      p = w.players[0],
      r = w.front!.players.p0;
    Object.assign(r.levels, {
      fuse: 1,
      "compressed-charge": 1,
      interceptor: 1,
    });
    const e = spawn(w, "crawler", 10, 10)!;
    e.hp = e.maxHp = 500;
    const shot = beginFrontShot(w, p);
    for (let i = 0; i < 8; i++) frontManualHit(w, e, 1, p.id, shot.id);
    expect(r.manualHits).toBe(1);
    expect(r.statuses[e.id].hits).toBe(1);
    expect(r.charge).toBe(1);
    expect(r.effects).toBe(0);
    expect(e.hp).toBe(492);
    frontManualHit(w, e, 1, p.id, beginFrontShot(w, p).id);
    expect(r.effects).toBe(1);
    expect(r.manualHits).toBe(2);
  });
  it("地雷は3個まで、置換で爆発しない、装填だけで連鎖充填しない", () => {
    const run = create();
    choose(run);
    const w = run.world,
      p = w.players[0],
      r = w.front!.players.p0;
    Object.assign(r.levels, {
      "afterimage-mine": 1,
      "tactical-reload": 1,
      interceptor: 1,
    });
    for (let i = 0; i < 4; i++) {
      p.x = i * 8;
      frontDodgeEnded(w, p);
    }
    expect(w.front!.mines).toHaveLength(3);
    expect(w.front!.mines[0].x).toBe(8);
    expect(w.totalKills).toBe(0);
    p.ammo[0]--;
    r.charge = 1;
    const e = spawn(w, "crawler", p.x + 5, p.z)!;
    e.hp = e.maxHp = 500;
    expect(frontReloadStarted(w, p)).toBe(0.65);
    expect(r.charge).toBe(0);
    const hp = e.hp;
    frontReloadStarted(w, p);
    expect(e.hp).toBe(hp);
    e.x = w.front!.mines[0].x;
    e.z = w.front!.mines[0].z;
    tickFrontEffects(w);
    expect(w.front!.mines.length).toBeLessThan(3);
    expect(r.charge).toBe(1);
  });
  it("1射3体の弾返却は1回、二次効果でも経験値を1回だけ作る", () => {
    const run = create();
    choose(run);
    const w = run.world,
      p = w.players[0],
      r = w.front!.players.p0;
    r.levels["line-shot"] = 1;
    r.levels["blast-core"] = 0;
    p.ammo[0] = 10;
    const shot = beginFrontShot(w, p);
    for (let i = 0; i < 4; i++) {
      const e = spawn(w, "crawler", i * 7 - 20, -15)!;
      e.hp = 1;
      frontManualHit(w, e, 2, p.id, shot.id);
    }
    expect(p.ammo[0]).toBe(11);
    expect(w.front!.orbs).toHaveLength(4);
    expect(w.totalKills).toBe(4);
  });
});
