import { afterEach, expect, it, vi } from "vitest";
import {
  selectedSupplyPreview,
  randomSupplyPreview,
} from "../src/client/supply-preview-data";
import { chooseEffect } from "../public/supply-reveal/effect-selection.js";

afterEach(() => vi.unstubAllGlobals());
const model = (results: ReturnType<typeof selectedSupplyPreview>) => ({
  multi: results.length > 1,
  tiers: results.map((r) =>
    r.type === "buddy"
      ? 5
      : r.type === "shard"
        ? 0
        : ({ N: 1, R: 2, SR: 3, SSR: 4 }[r.rarity!] ?? -1),
  ),
});

it("全10案で下限を満たす10枠を作り、選択演出を再生できる", () => {
  const forbidden = vi.fn(() => {
    throw Error("取得・保存は禁止");
  });
  vi.stubGlobal("localStorage", { getItem: forbidden, setItem: forbidden });
  vi.stubGlobal("fetch", forbidden);
  for (let n = 1; n <= 10; n++) {
    const results = selectedSupplyPreview(n);
    expect(results).toHaveLength(10);
    expect(chooseEffect(model(results), n)).toBe(n);
  }
  expect(() => selectedSupplyPreview(0)).toThrow();
  expect(() => selectedSupplyPreview(11)).toThrow();
  expect(forbidden).not.toHaveBeenCalled();
});

it("ランダム確認も通常の10連保証を使い、取得・保存しない", () => {
  const forbidden = vi.fn(() => {
    throw Error("取得・保存は禁止");
  });
  vi.stubGlobal("localStorage", { getItem: forbidden, setItem: forbidden });
  vi.stubGlobal("fetch", forbidden);
  for (const value of [0, 0.5, 0.91, 0.945, 0.995]) {
    const results = randomSupplyPreview(() => value);
    expect(results).toHaveLength(10);
    expect(model(results).tiers.some((t) => t >= 3)).toBe(true);
    expect(chooseEffect(model(results), undefined, () => 0.5)).toBeGreaterThan(
      0,
    );
  }
  expect(forbidden).not.toHaveBeenCalled();
});

it("通常側と共有する演出選択は順番送りでなく乱数に従い、結果を変更しない", () => {
  const m = { multi: true, tiers: [4, 1, 2, 3, 1, 0, 1, 2, 1, 1] };
  const before = structuredClone(m);
  expect(chooseEffect(m, undefined, () => 0)).toBe(1);
  expect(chooseEffect(m, undefined, () => 0)).toBe(1);
  expect(chooseEffect(m, undefined, () => 0.999)).toBe(9);
  expect(m).toEqual(before);
  expect(() => chooseEffect(m, 10)).toThrow();
  expect(chooseEffect({ multi: true, tiers: [3, 1] }, undefined, () => 0)).toBe(
    2,
  );
  expect(chooseEffect({ multi: true, tiers: [5, 1] }, undefined)).toBe(10);
  expect(chooseEffect({ multi: false, tiers: [1] }, undefined)).toBe(0);
});
