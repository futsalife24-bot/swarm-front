import { beforeEach, describe, expect, it } from "vitest";
import {
  FIRST_SUPPLY_GEAR_NOTICE,
  shouldAdvanceAfterFirstSupply,
} from "../src/client/first-supply-route";
import {
  TUTORIAL_FLAGS_KEY,
  clearTutorialSession,
  hasFtueFlag,
  markFtueFlag,
} from "../src/client/tutorial-flags";

function memory() {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

beforeEach(() => clearTutorialSession());

describe("C-6 F7: first 10-pull handoff", () => {
  it("advances only after the first 10-pull is acknowledged", () => {
    expect(shouldAdvanceAfterFirstSupply(true, 10, false)).toBe(false);
    expect(shouldAdvanceAfterFirstSupply(true, 1, true)).toBe(false);
    expect(shouldAdvanceAfterFirstSupply(false, 10, true)).toBe(false);
    expect(shouldAdvanceAfterFirstSupply(true, 10, true)).toBe(true);
  });

  it("uses the exact one-line gear notice", () => {
    expect(FIRST_SUPPLY_GEAR_NOTICE).toBe(
      "入手した武器は一覧タップで装備できます",
    );
  });

  it("records ftue:equip once through the F1 flag store", () => {
    const store = memory();
    markFtueFlag("ftue:equip", store);
    markFtueFlag("ftue:equip", store);
    expect(hasFtueFlag("ftue:equip", store)).toBe(true);
    const flags = JSON.parse(store.m.get(TUTORIAL_FLAGS_KEY)!) as {
      seen: string[];
    };
    expect(flags.seen.filter((flag) => flag === "ftue:equip")).toEqual([
      "ftue:equip",
    ]);
  });
});
