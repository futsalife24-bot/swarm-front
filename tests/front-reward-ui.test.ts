import { expect, it } from "vitest";
import { createFrontRun, getFrontRunView } from "../src/shared/front-run";
import {
  frontLevelUpActive,
  frontLevelUpMarkup,
  frontTreasureMarkup,
} from "../src/client/front-reward-ui";

const view = () =>
  getFrontRunView(
    createFrontRun({
      runId: "ui-reward",
      seed: 2,
      fusion: true,
      survivalBuildVersion: 1,
      players: [{ id: "p" }],
    }),
    "p",
  );
it("初回はカットインなし、XP選択では0.8秒後にカードへ進み、再抽選で再生しない", () => {
  const v = view();
  expect(frontLevelUpActive(v, 0)).toBe(false);
  v.offer!.kind = "additional";
  v.levelUpAt = 10;
  expect(frontLevelUpActive(v, 10)).toBe(true);
  expect(frontLevelUpActive(v, 10.79)).toBe(true);
  expect(frontLevelUpActive(v, 10.8)).toBe(false);
  v.offer!.id = "rerolled";
  expect(frontLevelUpActive(v, 11)).toBe(false);
  v.levelUpAt = 12;
  expect(frontLevelUpActive(v, 12)).toBe(true);
  v.phase = "combat";
  expect(frontLevelUpActive(v, 12)).toBe(false);
  expect(frontLevelUpMarkup()).not.toContain("data-card");
});
it("宝箱カードは選択操作を持たず、取得前後の段階を表示する", () => {
  const v = view();
  v.phase = "treasure";
  v.treasure = {
    id: 1,
    endsAt: 2.4,
    reward: { kind: "upgrade", cardId: "armor", from: 1, to: 2 },
  };
  expect(frontTreasureMarkup(v, "/", false)).not.toContain("sc-card");
  const result = frontTreasureMarkup(v, "/", true);
  expect(result).toContain("1 → 2段階");
  expect(result).toContain("能力強化");
  expect(result).not.toContain("data-card=");
  expect(result).not.toContain("<button");
  v.treasure.reward = { kind: "coins", amount: 10 };
  expect(frontTreasureMarkup(v, "/", true)).toContain("帰還時に受け取り");
  v.treasure.reward = { kind: "heal", amount: 28.835476666666807 };
  expect(frontTreasureMarkup(v, "/", true)).toContain("<strong>HP +29</strong>");
  expect(v.treasure.reward.amount).toBe(28.835476666666807);
  v.treasure.reward.amount = 20;
  expect(frontTreasureMarkup(v, "/", true)).toContain("<strong>HP +20</strong>");
});
