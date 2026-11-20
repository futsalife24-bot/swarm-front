import { describe, expect, it } from "vitest";
import {
  advanceReportViewerTime,
  allowsReportMotion,
} from "../src/client/report-playback-state";

describe("unencountered report silhouettes", () => {
  it.each([undefined, "coop"] as const)(
    "keeps %s specimens static without motion playback",
    (state) => {
      expect(allowsReportMotion(state)).toBe(false);
      expect(advanceReportViewerTime(true, 0.05)).toBe(0);
    },
  );

  it("keeps solo specimens animated", () => {
    expect(allowsReportMotion("solo")).toBe(true);
    expect(advanceReportViewerTime(false, 0.05)).toBe(0.05);
  });
});
