import { expect, it } from "vitest";
import { CAMPAIGN_COUNT } from "../src/shared/campaign";
import { FRONT_BASE_IDS, FRONT_FUSIONS } from "../src/shared/front-upgrades";
import {
  FRONT_SURVIVAL_STARTERS,
  frontSurvivalProgress,
  frontSurvivalPlanLoadout,
  validFrontSurvivalPlan,
  type FrontSurvivalPlan,
} from "../src/shared/front-progression";
import {
  freshProgress,
  initializeProgress,
  newSaveKey,
  persistProgress,
  soldier,
  validateProgress,
} from "../src/client/progression-save";
import {
  allocateSurvivalTraining,
  readFrontSurvivalLoadout,
  saveFrontSurvivalExclusions,
  FRONT_LOADOUT_KEY,
} from "../src/client/front-campaign";
import { preservesGrowthSave } from "../src/shared/growth-save-guard";
const storage = () => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
};
const plan = (clearedStage = 0): FrontSurvivalPlan => ({
  version: 1,
  clearedStage,
  legacyCards: false,
  training: { rerolls: 0, exclusions: 0 },
  excluded: [],
});

it("初期8種に2融合があり、進撃1〜7の各突破で2種ずつ増えて全22種になる", () => {
  expect(FRONT_SURVIVAL_STARTERS).toHaveLength(8);
  expect(
    Object.values(FRONT_FUSIONS).filter((ids) =>
      ids.every((id) => FRONT_SURVIVAL_STARTERS.includes(id)),
    ),
  ).toHaveLength(2);
  for (let stage = 0; stage <= 7; stage++)
    expect(frontSurvivalProgress(stage).unlocked).toHaveLength(8 + stage * 2);
  expect(frontSurvivalProgress(7).unlocked).toEqual(FRONT_BASE_IDS);
  expect(frontSurvivalProgress(CAMPAIGN_COUNT).unlocked).toEqual(
    FRONT_BASE_IDS,
  );
});
it("進撃報酬と3ptの配分が別で、両適性を最大にはできない", () => {
  expect(frontSurvivalProgress(0)).toMatchObject({
    rerolls: 1,
    exclusions: 0,
    points: 0,
  });
  expect(frontSurvivalProgress(2)).toMatchObject({
    rerolls: 2,
    exclusions: 1,
    points: 1,
  });
  expect(
    frontSurvivalProgress(7, false, { rerolls: 2, exclusions: 1 }),
  ).toMatchObject({ rerolls: 5, exclusions: 3, points: 3 });
  expect(
    frontSurvivalProgress(7, false, { rerolls: 1, exclusions: 2 }),
  ).toMatchObject({ rerolls: 4, exclusions: 4 });
  expect(() =>
    frontSurvivalProgress(7, false, { rerolls: 2, exclusions: 2 }),
  ).toThrow();
  expect(() =>
    frontSurvivalProgress(0, false, { rerolls: 1, exclusions: 0 }),
  ).toThrow();
});
it("除外は獲得済み・重複なし・許可枠内だけ。未獲得と融合を混ぜられない", () => {
  const p = plan(2);
  p.excluded = ["magnet"];
  expect(frontSurvivalPlanLoadout(p).pool).not.toContain("magnet");
  for (const excluded of [
    ["magnet", "magnet"],
    ["magnet", "armor"],
    ["life-drain"],
    ["fusion-counter"],
  ])
    expect(validFrontSurvivalPlan({ ...p, excluded })).toBe(false);
  for (const clearedStage of [-1, 1.5, NaN, 10000])
    expect(validFrontSurvivalPlan({ ...p, clearedStage })).toBe(false);
});
it("新規保存だけ8種にし、既存16種と旧解放報酬は没収・読取書換えしない", () => {
  const fresh = storage();
  expect(readFrontSurvivalLoadout(fresh).pool).toHaveLength(8);
  initializeProgress("normal", fresh);
  expect(readFrontSurvivalLoadout(fresh).pool).toHaveLength(8);
  expect(
    JSON.parse(fresh.getItem(newSaveKey("normal"))!).survivalCardVersion,
  ).toBe(1);
  const old = storage();
  const save = freshProgress("normal");
  save.armoryMigration = 1;
  old.setItem(newSaveKey("normal"), JSON.stringify(save));
  const before = [...old.map];
  expect(readFrontSurvivalLoadout(old).pool).toHaveLength(16);
  expect([...old.map]).toEqual(before);
  save.missions["1:normal"] = [true, false, false];
  old.setItem(newSaveKey("normal"), JSON.stringify(save));
  expect(readFrontSurvivalLoadout(old).pool).toContain("boost-coil");
});
it("兵士の配分・除外が再読込で戻り、旧デッキは変えない", () => {
  const s = storage();
  const save = initializeProgress("normal", s);
  save.missions["4:normal"] = [true, false, false];
  persistProgress(save, s);
  persistProgress(
    allocateSurvivalTraining(save, { rerolls: 1, exclusions: 1 }),
    s,
  );
  s.setItem(FRONT_LOADOUT_KEY, "legacy-deck");
  saveFrontSurvivalExclusions(s, ["magnet", "armor"]);
  expect(readFrontSurvivalLoadout(s)).toMatchObject({
    rerolls: 3,
    exclusions: 2,
    error: "",
  });
  expect(readFrontSurvivalLoadout(s).pool).not.toContain("magnet");
  expect(s.getItem(FRONT_LOADOUT_KEY)).toBe("legacy-deck");
  const saved = JSON.parse(s.getItem(newSaveKey("normal"))!);
  expect(() =>
    allocateSurvivalTraining(saved, { rerolls: 2, exclusions: 0 }),
  ).toThrow("除外を減らして");
});
it("別兵士の配分・除外は独立し、変更失敗では保存を変えない", () => {
  const s = storage();
  const save = initializeProgress("normal", s);
  save.missions["7:normal"] = [true, false, false];
  soldier(save).survivalTraining = { rerolls: 2, exclusions: 1 };
  soldier(save).survivalExcluded = ["magnet"];
  save.soldiers.push({
    ...structuredClone(soldier(save)),
    id: "second",
    survivalTraining: { rerolls: 1, exclusions: 2 },
    survivalExcluded: [],
  });
  persistProgress(save, s);
  expect(readFrontSurvivalLoadout(s).rerolls).toBe(5);
  save.selectedSoldier = "second";
  persistProgress(save, s);
  expect(readFrontSurvivalLoadout(s)).toMatchObject({
    rerolls: 4,
    exclusions: 4,
  });
  expect(readFrontSurvivalLoadout(s).pool).toContain("magnet");
  const before = s.getItem(newSaveKey("normal"));
  const blocked = {
    getItem: s.getItem,
    setItem: () => {
      throw Error("quota");
    },
  };
  expect(() => saveFrontSurvivalExclusions(blocked, ["magnet"])).toThrow();
  expect(s.getItem(newSaveKey("normal"))).toBe(before);
});
it("旧クライアントが新しい解放形式・兵士設定を消す保存は拒否する", () => {
  const original = freshProgress("normal");
  original.survivalCardVersion = 1;
  soldier(original).survivalTraining = { rerolls: 0, exclusions: 0 };
  soldier(original).survivalExcluded = [];
  const cast = (v: unknown) => v as Record<string, unknown>;
  for (const field of [
    "survivalCardVersion",
    "survivalTraining",
    "survivalExcluded",
  ]) {
    const next = structuredClone(original);
    if (field === "survivalCardVersion") delete next.survivalCardVersion;
    else delete (soldier(next) as unknown as Record<string, unknown>)[field];
    expect(preservesGrowthSave(cast(original), cast(next))).toBe(false);
  }
  expect(() =>
    validateProgress({ ...original, survivalCardVersion: 2 } as any),
  ).toThrow();
});
