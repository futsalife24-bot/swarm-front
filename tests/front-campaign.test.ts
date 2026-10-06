import { it, expect } from "vitest";
import {
  freshProgress,
  newSaveKey,
  persistProgress,
  legacyProgressKey,
} from "../src/client/progression-save";
import {
  readFrontCampaign,
  readFrontLoadout,
  saveFrontLoadout,
  awardFrontCampaign,
  queueFrontCampaignReward,
  recoverFrontCampaignRewards,
  FRONT_PENDING_REWARDS_KEY,
  FRONT_LOADOUT_KEY,
} from "../src/client/front-campaign";
const storage = () => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
};
it("攻略1/3/5で新規3種を遡及解放し、保存済みの個人候補を勝手に増やさない", () => {
  const s = storage(),
    p = freshProgress("normal"),
    selected = readFrontLoadout(s);
  saveFrontLoadout(s, selected);
  p.missions = {
    "1:normal": [true, false, false],
    "3:normal": [true, false, false],
    "5:normal": [true, false, false],
  };
  s.setItem(legacyProgressKey, JSON.stringify(p));
  const before = [...s.map];
  expect(readFrontCampaign(s).unlocked).toEqual(
    expect.arrayContaining(["boost-coil", "recovery-pack", "burst-cell"]),
  );
  expect(readFrontLoadout(s).pool).toEqual(selected.pool);
  expect([...s.map]).toEqual(before);
});
it("攻略2/4/6のクリアを遡及解放し、既存16種・原データを維持", () => {
  const s = storage(),
    p = freshProgress("normal");
  p.missions = {
    "2:normal": [true, false, false],
    "4:normal": [true, false, false],
    "6:medium": [true, false, false],
  };
  s.setItem(legacyProgressKey, JSON.stringify(p));
  const before = [...s.map];
  const c = readFrontCampaign(s);
  expect(c.error).toBe("");
  expect(c.unlocked).toHaveLength(19);
  expect([...s.map]).toEqual(before);
});
it("戦果を先に控え、保存失敗後の再起動で重複なく回復する", () => {
  const s = storage(),
    p = freshProgress("normal");
  p.armoryMigration = 1;
  persistProgress(p, s);
  const failing = {
    ...s,
    setItem: (k: string, v: string) => {
      if (k === newSaveKey("normal")) throw Error("quota");
      s.setItem(k, v);
    },
  };
  expect(() => queueFrontCampaignReward(failing, "pending", 181)).toThrow();
  expect(s.getItem(FRONT_PENDING_REWARDS_KEY)).toContain("pending");
  expect(recoverFrontCampaignRewards(s)).toBe(30);
  expect(recoverFrontCampaignRewards(s)).toBe(0);
  expect(JSON.parse(s.getItem(newSaveKey("normal"))!).coins).toBe(30);
});
it("個人候補の保存・再読込・設定外と未解放を拒否", () => {
  const s = storage(),
    v = readFrontLoadout(s);
  expect(v.pool).toHaveLength(16);
  const pool = [
    "blast-core",
    "armor-piercer",
    "afterimage-mine",
    "armor",
    "reload",
    "magazine",
  ] as const;
  saveFrontLoadout(s, { pool: [...pool], initialCards: [...v.initialCards] });
  expect(readFrontLoadout(s).pool).toEqual(pool);
  expect(() =>
    saveFrontLoadout(s, {
      pool: [...pool, "life-drain"],
      initialCards: v.initialCards,
    }),
  ).toThrow();
  s.setItem(FRONT_LOADOUT_KEY, "bad");
  expect(() =>
    saveFrontLoadout(s, { pool: [...pool], initialCards: v.initialCards }),
  ).toThrow();
  expect(s.getItem(FRONT_LOADOUT_KEY)).toBe("bad");
});
it("コインは作戦ごと一度だけ、所持品・攻略進行・報酬は不変", () => {
  const s = storage(),
    p = freshProgress("normal");
  p.armoryMigration = 1;
  p.coins = 77;
  persistProgress(p, s);
  const inventory = JSON.stringify(p.inventory),
    missions = JSON.stringify(p.missions);
  expect(awardFrontCampaign(s, "r", 125)).toBe(20);
  expect(awardFrontCampaign(s, "r", 125)).toBe(0);
  const next = JSON.parse(s.getItem(newSaveKey("normal"))!);
  expect(next.coins).toBe(97);
  expect(JSON.stringify(next.inventory)).toBe(inventory);
  expect(JSON.stringify(next.missions)).toBe(missions);
  expect(awardFrontCampaign(s, "r2", 36000)).toBe(300);
});
it("読取破損・書込失敗で元保存と受取権を守り、再試行で1回付与", () => {
  const s = storage(),
    p = freshProgress("normal");
  p.armoryMigration = 1;
  persistProgress(p, s);
  const before = s.getItem(newSaveKey("normal"));
  expect(() =>
    awardFrontCampaign(
      {
        ...s,
        setItem: () => {
          throw Error("quota");
        },
      },
      "r",
      180,
    ),
  ).toThrow();
  expect(s.getItem(newSaveKey("normal"))).toBe(before);
  expect(awardFrontCampaign(s, "r", 180)).toBe(30);
  expect(awardFrontCampaign(s, "r", 180)).toBe(0);
  s.setItem(newSaveKey("normal"), "bad");
  expect(() => awardFrontCampaign(s, "x", 90)).toThrow();
  expect(s.getItem(newSaveKey("normal"))).toBe("bad");
});
