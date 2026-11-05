import { expect, it } from "vitest";
import type { NewWeapon } from "../src/shared/progression";
import {
  createFrontRun,
  forfeitFrontRunPlayer,
  getFrontRunView,
  returnFrontRun,
  stepFrontRun,
} from "../src/shared/front-run";
import { frontResultRewards } from "../src/client/front-result-rewards";
import { saveFrontRunRewards } from "../src/client/front-reward-status";
import { readFrontCampaign } from "../src/client/front-campaign";
import {
  freshProgress,
  newSaveKey,
  persistProgress,
} from "../src/client/progression-save";

function setup(players = ["solo"], seconds = 125) {
  const run = createFrontRun({
    runId: "result-rewards",
    seed: 42,
    fusion: true,
    mode: "survival",
    survivalBuildVersion: 1,
    clearedStage: 5,
    players: players.map((id) => ({ id })),
  });
  run.phase = "combat";
  run.world.time = seconds;
  run.world.players.forEach((p) => (p.kills = 31));
  const map = new Map<string, string>();
  let fail = false;
  const storage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (fail && key === newSaveKey("normal")) throw Error("保存失敗");
      map.set(key, value);
    },
  };
  const save = freshProgress("normal");
  save.armoryMigration = 1;
  save.coins = 7;
  persistProgress(save, storage);
  const award = (
    id: string,
    previous?: ReturnType<typeof saveFrontRunRewards>,
  ) => {
    const view = getFrontRunView(run, id);
    return saveFrontRunRewards(
      storage,
      storage,
      {
        id: run.world.run,
        won: view.phase === "victory",
        mode: "survival",
        day: view.day,
        at: 1793836800000,
      },
      run.world.time,
      previous,
      {
        weapons: run.world.rewards[id] as NewWeapon[],
        kills: run.world.players.find((p) => p.id === id)!.kills,
        clearedStage: 5,
        treasureCoins: view.treasureCoins,
      },
    );
  };
  return {
    run,
    storage,
    save,
    award,
    setFailure: (value: boolean) => (fail = value),
  };
}

it("任意帰還の本人報酬・宝箱を表示し、保存済の額と武器が一致する", () => {
  const s = setup();
  s.run.treasureCoins = { solo: 10 };
  expect(returnFrontRun(s.run)).toBe(true);
  const status = s.award("solo");
  const saved = readFrontCampaign(s.storage).save!;
  const result = frontResultRewards(
    s.run.world,
    getFrontRunView(s.run, "solo"),
    "solo",
    status,
    saved,
  );
  expect(result.coins).toBe(30);
  expect(saved.coins).toBe(37);
  expect(result.treasureCoins).toBe(10);
  expect(result.progress).toBe("功績 +100");
  expect(result.weapons).toHaveLength(3);
  expect(
    result.weapons.every((w) => w.state === "stored" && w.weapon.level === 6),
  ).toBe(true);
  expect(result.error).toBe(false);
});

it("全滅でもコインと武器を表示し、短時間終了では武器0丁を維持する", () => {
  for (const seconds of [20, 125]) {
    const s = setup(["solo"], seconds);
    s.run.world.players[0].hp = 0;
    stepFrontRun(s.run, {}, 0.05, seconds);
    expect(s.run.phase).toBe("defeat");
    const status = s.award("solo");
    const result = frontResultRewards(
      s.run.world,
      getFrontRunView(s.run, "solo"),
      "solo",
      status,
      readFrontCampaign(s.storage).save,
    );
    expect(result.progress).toBe("功績 +20");
    expect(result.coins).toBe(seconds < 60 ? 0 : 20);
    expect(result.weapons).toHaveLength(seconds < 60 ? 0 : 3);
  }
});

it("協力では本人の武器だけ表示し、途中退出した人へ報酬を表示しない", () => {
  const s = setup(["host", "guest", "left"]);
  forfeitFrontRunPlayer(s.run, "left");
  s.run.world.players.forEach((p) => (p.hp = 0));
  stepFrontRun(s.run, {}, 0.05, 125);
  for (const id of ["host", "guest"]) {
    const result = frontResultRewards(
      s.run.world,
      getFrontRunView(s.run, id),
      id,
      undefined,
      null,
    );
    expect(result.weapons.map((w) => w.weapon.id)).toEqual(
      s.run.world.rewards[id].map((w) => w.id),
    );
    expect(result.weapons.every((w) => w.state === "unsaved")).toBe(true);
    expect(result.campaign).toBe("");
  }
  const forfeited = frontResultRewards(
    s.run.world,
    getFrontRunView(s.run, "left"),
    "left",
    undefined,
    null,
  );
  expect(forfeited.coins).toBeNull();
  expect(forfeited.weapons).toEqual([]);
});

it("保留武器と未保存武器を区別し、別作戦の保存表示を流用しない", () => {
  const s = setup();
  returnFrontRun(s.run);
  const weapons = s.run.world.rewards.solo as typeof s.save.inventory;
  s.save.inventory.push(weapons[0]);
  s.save.pending.push(weapons[1]);
  const result = frontResultRewards(
    s.run.world,
    getFrontRunView(s.run, "solo"),
    "solo",
    {
      runId: "other-run",
      text: "保存済み",
      progress: "功績 +100",
      campaign: "攻略コイン +300",
      error: true,
    },
    s.save,
  );
  expect(result.weapons.map((w) => w.state)).toEqual([
    "stored",
    "pending",
    "unsaved",
  ]);
  expect(result.campaign).toBe("");
  expect(result.progress).toBe("");
  expect(result.error).toBe(false);
});

it("保存失敗では未保存を表示し、再試行・再接続でも同じ報酬を一度だけ保存する", () => {
  const s = setup();
  returnFrontRun(s.run);
  s.setFailure(true);
  const failed = s.award("solo");
  const view = getFrontRunView(s.run, "solo");
  const result = frontResultRewards(
    s.run.world,
    view,
    "solo",
    failed,
    readFrontCampaign(s.storage).save,
  );
  expect(result.error).toBe(true);
  expect(result.campaign).toBe("");
  expect(result.weapons.every((w) => w.state === "unsaved")).toBe(true);
  s.setFailure(false);
  const retry = s.award("solo", failed);
  const saved = readFrontCampaign(s.storage).save!;
  const before = JSON.stringify(saved);
  expect(s.award("solo", retry).error).toBe(false);
  expect(s.award("solo").text).toBe(retry.text);
  expect(JSON.stringify(readFrontCampaign(s.storage).save)).toBe(before);
  const restored = frontResultRewards(s.run.world, view, "solo", retry, saved);
  expect(restored.error).toBe(false);
  expect(restored.weapons.every((w) => w.state === "stored")).toBe(true);
});
