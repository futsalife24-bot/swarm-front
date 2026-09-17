import { expect, it } from "vitest";
import { japanDay, japanWeek, nextJapanDay } from "../src/shared/calendar";
it("changes daily admission at JST midnight, not UTC midnight", () => {
  const before = Date.parse("2026-09-20T14:59:59.999Z");
  expect(japanDay(before)).toBe("2026-09-20");
  expect(japanDay(before + 1)).toBe("2026-09-21");
  expect(nextJapanDay(before)).toBe(before + 1);
});
it("uses Monday JST for weekly missions across year boundaries", () => {
  expect(japanWeek(Date.parse("2026-09-20T14:59:59Z"))).toBe("2026-09-14");
  expect(japanWeek(Date.parse("2026-09-20T15:00:00Z"))).toBe("2026-09-21");
  expect(japanWeek(Date.parse("2027-01-01T00:00:00Z"))).toBe("2026-12-28");
});
