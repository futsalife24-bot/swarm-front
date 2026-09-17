import { expect, it } from "vitest";
import { recordWeekly, claimWeekly } from "../src/shared/weekly-missions";
import {
  freshProgress,
  validateProgress,
} from "../src/client/progression-save";
it("counts different runs, claims each reward once and changes week at JST Monday", () => {
  const now = Date.parse("2026-09-17T03:00:00Z");
  let save = freshProgress("normal");
  for (const run of ["a", "b", "a", "c"])
    save = recordWeekly(save, "campaign", run, now);
  expect(save.weekly!.campaign.length).toBe(3);
  const coins = save.coins;
  save = claimWeekly(save, "campaign-3", now);
  expect(save.coins).toBe(coins + 150);
  expect(claimWeekly(save, "campaign-3", now)).toBe(save);
  expect(() => claimWeekly(save, "campaign-10", now)).toThrow();
  save = recordWeekly(
    save,
    "defense",
    "next",
    Date.parse("2026-09-20T15:00:00Z"),
  );
  expect(save.weekly!.campaign).toEqual([]);
  expect(save.weekly!.claimed).toEqual([]);
  validateProgress(save);
});
