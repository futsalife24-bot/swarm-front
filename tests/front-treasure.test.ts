import { expect, it } from "vitest";
import {
  createFrontRun,
  chooseFrontUpgrade,
  getFrontRunView,
  stepFrontRun,
  FRONT_RUN_CONFIG,
  rerollFrontRunOffer,
} from "../src/shared/front-run";
import { blocked, hurtEnemy, spawn } from "../src/shared/game";
import { mapFor } from "../src/shared/stages";
import {
  awardFrontTreasureLevel,
  isValidFrontUpgradeState,
  FRONT_UPGRADE_CATALOG,
  grantFrontUpgradeRights,
} from "../src/shared/front-upgrades";

function run(ids = ["p0"], dedicated = true) {
  const result = createFrontRun({
    runId: "treasure-test",
    seed: 5,
    fusion: true,
    ...(dedicated ? { survivalBuildVersion: 1 as const } : {}),
    players: ids.map((id) => ({ id })),
  });
  for (const id of ids) {
    const offer = result.upgrades[id].offer!;
    expect(
      chooseFrontUpgrade(result, id, {
        runId: result.world.run,
        offerId: offer.id,
        revision: offer.revision,
        requestId: `initial:${id}`,
        cardId: offer.defaultCardId,
      }),
    ).toBe(true);
  }
  return result;
}

it("BASTION撃破はXPに加え宝箱を落とし、拾うと生存中の各人の既存カードを1段階強化する", () => {
  const r = run(["p0", "p1", "p2"]);
  const w = r.world;
  const bastion = spawn(w, "bastion", 0, 0)!;
  const beforeXp = w.front!.xp;
  hurtEnemy(w, bastion, bastion.hp + 1, "p0");
  expect(w.front!.chests).toHaveLength(1);
  expect(w.front!.orbs.some((orb) => orb.value === 6)).toBe(true);
  const chest = w.front!.chests![0];
  w.players[0].x = chest.x;
  w.players[0].z = chest.z;
  w.players[1].connected = false;
  w.players[2].hp = 0;
  stepFrontRun(r, {}, 0.05, 1);
  expect(r.phase).toBe("treasure");
  expect(w.front!.chests).toHaveLength(0);
  expect(w.front!.xp).toBe(beforeXp);
  for (const id of ["p0", "p1"]) {
    expect(getFrontRunView(r, id).treasure?.reward?.kind).toBe("upgrade");
    expect(r.upgrades[id].bonusPicks).toBe(1);
    expect(r.upgrades[id].picks).toBe(2);
    expect(r.upgrades[id].rightsSpent).toBe(0);
    expect(isValidFrontUpgradeState(r.upgrades[id])).toBe(true);
  }
  expect(getFrontRunView(r, "p2").treasure?.reward).toBeNull();
  expect(r.upgrades.p2.picks).toBe(1);
  const frozenAt = w.time;
  stepFrontRun(r, {}, 0.05, 2);
  expect(w.time).toBe(frozenAt);
  stepFrontRun(r, {}, 0.05, 1 + FRONT_RUN_CONFIG.treasureSeconds);
  expect(r.phase).not.toBe("treasure");
  expect(getFrontRunView(r, "p0").treasure).toBeNull();
  expect(r.upgrades.p0.bonusPicks).toBe(1);
  expect(r.upgrades.p1.bonusPicks).toBe(1);
});

it("旧生存戦では宝箱を作らない", () => {
  const r = run(["p0"], false);
  const bastion = spawn(r.world, "bastion", 0, 0)!;
  hurtEnemy(r.world, bastion, bastion.hp + 1, "p0");
  expect(r.world.front!.chests).toBeUndefined();
});

it("屋上撃破の箱は歩ける地面へ落ち、経験値オーブ満杯でも生成される", () => {
  const r = run();
  const w = r.world;
  const block = mapFor(w).blocks.find((item) => item.h > 1)!;
  const player = w.players[0];
  player.x = block.x;
  player.z = block.z;
  player.y = block.h;
  const bastion = spawn(w, "bastion", 0, 0)!;
  bastion.x = block.x;
  bastion.z = block.z;
  w.front!.orbs = Array.from({ length: 160 }, (_, index) => ({
    id: 2000 + index,
    x: 0,
    y: 0,
    z: 0,
    value: 1,
  }));
  hurtEnemy(w, bastion, bastion.hp + 1, player.id);
  const chest = w.front!.chests![0];
  expect(chest).toBeDefined();
  expect(
    blocked(chest.x, chest.z, 0.55, chest.y + 0.01, mapFor(w).blocks),
  ).toBe(false);
  expect(Math.hypot(chest.x - block.x, chest.z - block.z)).toBeGreaterThan(0.8);
  expect(w.front!.orbs).toHaveLength(160);
});

it("宝箱の追加取得後も経験値の権利上限は119で固定する", () => {
  const r = run();
  const awarded = awardFrontTreasureLevel(r.upgrades.p0, 1)!;
  const limit = grantFrontUpgradeRights(awarded.state, 119);
  expect(isValidFrontUpgradeState(limit)).toBe(true);
  expect(() => grantFrontUpgradeRights(limit, 120)).toThrow(RangeError);
});

it("所持カードが全て最大なら満タン時は攻略コイン、負傷時は権威乱数で回復する", () => {
  const r = run();
  let state = r.upgrades.p0;
  const owned = state.initialCardId!;
  for (let id = 1; id < FRONT_UPGRADE_CATALOG[owned].maxLevel; id++) {
    const awarded = awardFrontTreasureLevel(state, id)!;
    state = awarded.state;
  }
  expect(awardFrontTreasureLevel(state, 99)).toBeNull();
  r.upgrades.p0 = state;
  const p = r.world.players[0];
  const maxHp = r.world.front!.players.p0.maxHp;
  p.hp = maxHp;
  r.world.front!.chests = [{ id: 100, x: p.x, y: p.y ?? 0, z: p.z }];
  stepFrontRun(r, {}, 0.05, 1);
  expect(getFrontRunView(r, "p0").treasure?.reward).toEqual({
    kind: "coins",
    amount: 10,
  });
  expect(getFrontRunView(r, "p0").treasureCoins).toBe(10);
  stepFrontRun(r, {}, 0.05, 4);
  r.upgrades.p0 = Object.freeze({ ...r.upgrades.p0, rngState: 0 });
  p.hp = maxHp - 50;
  r.world.front!.chests = [{ id: 101, x: p.x, y: p.y ?? 0, z: p.z }];
  stepFrontRun(r, {}, 0.05, 5);
  expect(getFrontRunView(r, "p0").treasure?.reward).toEqual({
    kind: "heal",
    amount: Math.min(50, Math.ceil(maxHp * 0.25)),
  });
  expect(getFrontRunView(r, "p0").treasureCoins).toBe(10);
});

it("XP選択の開始時刻は再抽選で変わらず、連続選択では更新する", () => {
  const r = run(["p0", "p1"]);
  r.world.front!.xp = 44;
  stepFrontRun(r, {}, 0.05, 1);
  expect(r.phase).toBe("selection");
  expect(getFrontRunView(r, "p0").levelUpAt).toBe(1);
  expect(r.selectionDeadline).toBe(1 + 15 + FRONT_RUN_CONFIG.levelUpSeconds);
  const first = r.upgrades.p0.offer!;
  expect(
    rerollFrontRunOffer(
      r,
      "p0",
      {
        runId: r.world.run,
        offerId: first.id,
        revision: first.revision,
        requestId: "reroll:p0",
      },
      1.1,
    ),
  ).toBe(true);
  expect(getFrontRunView(r, "p0").levelUpAt).toBe(1);
  const next = r.upgrades.p0.offer!;
  expect(
    chooseFrontUpgrade(
      r,
      "p0",
      {
        runId: r.world.run,
        offerId: next.id,
        revision: next.revision,
        requestId: "xp:p0",
        cardId: next.defaultCardId,
      },
      1.2,
    ),
  ).toBe(true);
  expect(getFrontRunView(r, "p0").levelUpAt).toBe(1.2);
  expect(getFrontRunView(r, "p1").levelUpAt).toBe(1);
});
