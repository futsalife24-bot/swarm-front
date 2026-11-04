import { expect, it } from "vitest";
import {
  FRONT_BASE_IDS,
  FRONT_ELEMENT_IDS,
  FRONT_PRE_ELEMENT_IDS,
  FRONT_SURVIVAL_BASE_IDS,
  createFrontUpgradeState,
  isValidFrontUpgradeState,
  isValidFrontUpgradePool,
  selectFrontUpgrade,
  getEligibleFrontUpgrades,
} from "../src/shared/front-upgrades";
import { frontSurvivalProgress } from "../src/shared/front-progression";
import { createFrontRun, getFrontRunView } from "../src/shared/front-run";
import {
  allWeapons,
  initializeProgress,
  loadProgress,
  persistProgress,
} from "../src/client/progression-save";
import {
  readFrontSurvivalLoadout,
  saveFrontSurvivalExclusions,
} from "../src/client/front-campaign";
import {
  frontUpgradeCardMarkup,
  frontUpgradeEffect,
} from "../src/client/front-upgrade-ui";

it("属性は進撃1/2/3の順で解放、旧所持品も失わず、防衛候補には入らない", () => {
  FRONT_ELEMENT_IDS.forEach((id, i) => {
    expect(frontSurvivalProgress(i).unlocked).not.toContain(id);
    expect(frontSurvivalProgress(i + 1).unlocked).toContain(id);
    expect(frontSurvivalProgress(i + 1, true).unlocked).toContain(id);
    expect(FRONT_BASE_IDS).not.toContain(id);
  });
  expect(isValidFrontUpgradePool(FRONT_SURVIVAL_BASE_IDS)).toBe(false);
  expect(isValidFrontUpgradePool(FRONT_SURVIVAL_BASE_IDS, true)).toBe(true);
  expect(() =>
    createFrontRun({
      runId: "defense-elements",
      seed: 1,
      mode: "defense",
      fusion: true,
      players: [{ id: "p", pool: FRONT_SURVIVAL_BASE_IDS }],
    }),
  ).toThrow();
});

it("更新前31種の作戦をそのまま読み、元の候補で選択を続けられる", () => {
  const current = createFrontUpgradeState(
    "old-catalog",
    3,
    undefined,
    FRONT_BASE_IDS,
    1,
    true,
  );
  const old = {
    ...current,
    levels: Object.fromEntries(
      FRONT_PRE_ELEMENT_IDS.map((id) => [id, 0]),
    ) as typeof current.levels,
  };
  expect(isValidFrontUpgradeState(old)).toBe(true);
  const chosen = selectFrontUpgrade(old, {
    runId: old.runId,
    offerId: old.offer!.id,
    revision: 0,
    requestId: "old-pick",
    cardId: old.offer!.cardIds[0],
  });
  expect(chosen.ok).toBe(true);
  if (!chosen.ok) return;
  expect(isValidFrontUpgradeState(chosen.state)).toBe(true);
  expect(
    getEligibleFrontUpgrades(chosen.state).some((id) =>
      FRONT_ELEMENT_IDS.includes(id),
    ),
  ).toBe(false);
  const broken = structuredClone(old);
  delete (broken.levels as Partial<typeof broken.levels>).armor;
  expect(isValidFrontUpgradeState(broken)).toBe(false);
});

it("属性の除外を通常の保存経路で記録し再読込しても旧装備を維持する", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  initializeProgress("normal", storage);
  const save = loadProgress("normal", storage)!;
  save.missions["3:normal"] = [true, false, false];
  persistProgress(save, storage);
  const before = structuredClone({
    soldiers: save.soldiers,
    weapons: allWeapons(save),
  });
  saveFrontSurvivalExclusions(storage, ["fire-rounds"]);
  const restored = readFrontSurvivalLoadout(storage);
  expect(restored.error).toBe("");
  expect(restored.pool).not.toContain("fire-rounds");
  expect(restored.pool).toContain("frost-rounds");
  expect(restored.pool).toContain("chain-lightning");
  const loaded = loadProgress("normal", storage)!;
  expect(loaded.soldiers.map((p) => p.equipped)).toEqual(
    before.soldiers.map((p) => p.equipped),
  );
  expect(allWeapons(loaded)).toEqual(before.weapons);
  saveFrontSurvivalExclusions(storage, []);
  expect(readFrontSurvivalLoadout(storage).pool).toContain("fire-rounds");
});

it("属性3枚は同レアの武器強化で、属性名・段階ごとの数値・専用画像を表示する", () => {
  const run = createFrontRun({
    runId: "element-ui",
    seed: 1,
    fusion: true,
    survivalBuildVersion: 1,
    players: [{ id: "p", pool: FRONT_SURVIVAL_BASE_IDS }],
  });
  const v = getFrontRunView(run, "p");
  FRONT_ELEMENT_IDS.forEach((id) => {
    const markup = frontUpgradeCardMarkup(v, id, "/");
    expect(markup).toContain('data-kind="normal"');
    expect(markup).toContain('data-type="weapon"');
    expect(markup).toContain(`${id}.svg`);
  });
  expect(frontUpgradeEffect("fire-rounds", 3)).toContain("12ダメージ");
  expect(frontUpgradeEffect("frost-rounds", 3)).toContain("1秒凍結");
  expect(frontUpgradeEffect("chain-lightning", 3)).toContain("最大4体");
});
