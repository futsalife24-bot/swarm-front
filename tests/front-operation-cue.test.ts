import { describe, expect, it } from "vitest";
import manifest from "../public/assets/event-banners/consumer-manifest.json";
import {
  OPERATION_CUE_IDS,
  OPERATION_CUE_LABELS,
  OPERATION_CUE_TIMING,
  operationCueForResult,
  operationCuePlan,
  operationCueSourcesAt,
} from "../src/client/operation-cue-assets";

describe("producer event contract", () => {
  it("matches the received producer manifest rather than inferred image timing", () => {
    expect(manifest.assets.map((asset) => asset.eventId)).toEqual(
      OPERATION_CUE_IDS,
    );
    const sources = operationCueSourcesAt("/");
    for (const asset of manifest.assets) {
      const id = asset.eventId as (typeof OPERATION_CUE_IDS)[number];
      expect(OPERATION_CUE_TIMING[id]).toEqual({
        inMs: asset.inMs,
        holdMs: asset.holdMs,
        outMs: asset.outMs,
        durationMs: asset.durationMs,
      });
      for (const variant of ["standard", "mobile"] as const) {
        const metadata = asset.variants[variant];
        expect(sources[id][variant]).toEqual({
          png: `/assets/event-banners/${metadata.png}`,
          apng: `/assets/event-banners/${metadata.apng}`,
        });
      }
    }
  });
  it("retains relative producer paths under a deployment base", () => {
    const sources = operationCueSourcesAt("/swarm/");
    expect(Object.keys(sources)).toEqual(OPERATION_CUE_IDS);
    expect(sources["adv-extract"].standard.apng).toBe(
      "/swarm/assets/event-banners/standard/adv-extract.apng",
    );
    expect(sources["srv-ended"].mobile.png).toBe(
      "/swarm/assets/event-banners/mobile/srv-ended.png",
    );
  });
  it("preserves all seven event IDs, labels, and complete durations", () => {
    expect(OPERATION_CUE_IDS).toHaveLength(7);
    expect(OPERATION_CUE_IDS.map((id) => OPERATION_CUE_LABELS[id])).toEqual([
      "出撃",
      "撤収完了",
      "作戦失敗",
      "作戦達成",
      "出撃",
      "撤収完了",
      "戦闘終了",
    ]);
    for (const id of OPERATION_CUE_IDS) {
      const timing = OPERATION_CUE_TIMING[id];
      expect(timing.durationMs).toBe(
        timing.inMs + timing.holdMs + timing.outMs,
      );
    }
  });
  it("maps defeat and completion without claiming an advance retreat succeeded", () => {
    expect(operationCueForResult("advance", "defeat")).toBe("adv-failed");
    expect(operationCueForResult("advance", "victory")).toBe("adv-complete");
    expect(operationCueForResult("survival", "defeat")).toBe("srv-ended");
    expect(operationCueForResult("survival", "victory")).toBe("srv-extract");
  });
  it("chooses mobile images for low power independently of screen size", () => {
    expect(
      operationCuePlan("srv-ended", {
        mobile: false,
        lowPower: true,
        reduced: false,
        off: false,
      }),
    ).toEqual({
      variant: "mobile",
      format: "apng",
      fadeMs: 0,
      durationMs: 2640,
    });
  });
  it("reduced motion uses only the PNG, a short opacity fade and hold", () => {
    expect(
      operationCuePlan("srv-ended", {
        mobile: true,
        lowPower: false,
        reduced: true,
        off: false,
      }),
    ).toEqual({
      variant: "mobile",
      format: "png",
      fadeMs: 160,
      durationMs: 1920,
    });
  });
  it("user motion off removes even the static-image fade", () => {
    expect(
      operationCuePlan("adv-complete", {
        mobile: false,
        lowPower: false,
        reduced: false,
        off: true,
      }),
    ).toEqual({
      variant: "standard",
      format: "png",
      fadeMs: 0,
      durationMs: 1900,
    });
  });
});
