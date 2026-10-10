import { describe, it, expect } from "vitest";
import {
  FRONT_DECKS_KEY,
  readFrontDecks,
  saveFrontDeck,
} from "../src/client/front-decks";
import {
  FRONT_LOADOUT_KEY,
  readFrontLoadout,
  saveFrontLoadout,
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
describe("名前付きデッキは現在の出撃設定・進行と独立して保持", () => {
  it("3枠を独立保存・上書きし、明示セットだけが出撃候補へ反映される", () => {
    const s = storage(),
      initial = readFrontLoadout(s);
    saveFrontLoadout(s, initial);
    s.setItem("unrelated-progress", "unchanged");
    const active = s.getItem(FRONT_LOADOUT_KEY);
    for (let i = 0; i < 3; i++)
      saveFrontDeck(s, i, { name: `デッキ${i + 1}`, loadout: initial });
    const next = {
      ...initial,
      pool: initial.pool.filter((id) => id !== "magnet"),
    };
    saveFrontDeck(s, 1, { name: "融合重視", loadout: next });
    const saved = readFrontDecks(s);
    expect(saved.error).toBe("");
    expect(saved.slots.map((d) => d?.name)).toEqual([
      "デッキ1",
      "融合重視",
      "デッキ3",
    ]);
    expect(s.getItem(FRONT_LOADOUT_KEY)).toBe(active);
    saveFrontLoadout(s, saved.slots[1]!.loadout);
    expect(readFrontLoadout(s).pool).not.toContain("magnet");
    expect(s.getItem("unrelated-progress")).toBe("unchanged");
  });
  it("読取は書き換えず、破損デッキ・破損出撃設定を上書きしない", () => {
    const s = storage(),
      value = { name: "保存", loadout: readFrontLoadout(s) };
    s.setItem(FRONT_DECKS_KEY, "corrupt");
    const before = [...s.map];
    expect(readFrontDecks(s).error).not.toBe("");
    expect(() => saveFrontDeck(s, 0, value)).toThrow();
    expect([...s.map]).toEqual(before);
    s.map.delete(FRONT_DECKS_KEY);
    s.setItem(FRONT_LOADOUT_KEY, "corrupt");
    expect(() => saveFrontDeck(s, 0, value)).toThrow();
    expect(s.getItem(FRONT_DECKS_KEY)).toBeNull();
  });
  it("候補不足・未解放・重複・名前と枠の不正を拒否", () => {
    const s = storage(),
      loadout = readFrontLoadout(s),
      valid = { name: "有効", loadout };
    for (const slot of [-1, 3, 0.5])
      expect(() => saveFrontDeck(s, slot, valid)).toThrow();
    for (const name of [" ", "a".repeat(25)])
      expect(() => saveFrontDeck(s, 0, { ...valid, name })).toThrow();
    for (const pool of [
      loadout.pool.slice(0, 3),
      [...loadout.pool, "life-drain" as const],
      [...loadout.pool, loadout.pool[0]],
    ])
      expect(() =>
        saveFrontDeck(s, 0, { ...valid, loadout: { ...loadout, pool } }),
      ).toThrow();
    expect(s.getItem(FRONT_DECKS_KEY)).toBeNull();
  });
  it("容量不足で保存に失敗しても全枠を維持し、再試行で保存できる", () => {
    const s = storage(),
      value = { name: "以前の名前", loadout: readFrontLoadout(s) };
    saveFrontDeck(s, 0, value);
    const before = s.getItem(FRONT_DECKS_KEY);
    expect(() =>
      saveFrontDeck(
        {
          ...s,
          setItem: () => {
            throw Error("quota");
          },
        },
        0,
        { ...value, name: "新しい名前" },
      ),
    ).toThrow("quota");
    expect(s.getItem(FRONT_DECKS_KEY)).toBe(before);
    saveFrontDeck(s, 0, { ...value, name: "新しい名前" });
    expect(readFrontDecks(s).slots[0]?.name).toBe("新しい名前");
  });
});
