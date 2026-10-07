import { describe, expect, it } from "vitest";
import {
  FRONT_INITIAL_CARDS,
  createFrontUpgradeState,
  isValidFrontUpgradeState,
  selectFrontUpgrade,
  type FrontUpgradeId,
} from "../src/shared/front-upgrades";
import {
  readFrontLoadout,
  saveFrontLoadout,
  FRONT_LOADOUT_KEY,
} from "../src/client/front-campaign";
import {
  readFrontDecks,
  saveFrontDeck,
  FRONT_DECKS_KEY,
} from "../src/client/front-decks";

const pool: FrontUpgradeId[] = [
  "armor",
  "reload",
  "magazine",
  "magnet",
  "blast-radius",
  "opening-shot",
];
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

describe("開幕も選択候補からランダム3択", () => {
  it("旧固定3種・系統指定を無視し、候補内から重複なしで抽選。種と順序も再現できる", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 512; i++) {
      const seed = Math.imul(i, 2654435761) >>> 0;
      const state = createFrontUpgradeState(
        "opening",
        seed,
        FRONT_INITIAL_CARDS,
        pool,
      );
      const cards = state.offer!.cardIds;
      expect(cards).toHaveLength(3);
      expect(new Set(cards).size).toBe(3);
      expect(cards.every((card) => pool.includes(card))).toBe(true);
      expect(cards.some((card) => FRONT_INITIAL_CARDS.includes(card))).toBe(
        false,
      );
      expect(isValidFrontUpgradeState(state)).toBe(true);
      expect(
        createFrontUpgradeState(
          "opening",
          seed,
          undefined,
          [...pool].reverse(),
        ),
      ).toMatchObject({
        initialCards: state.initialCards,
        rngState: state.rngState,
        offer: state.offer,
      });
      seen.add([...cards].sort().join(","));
    }
    expect(seen.size).toBe(20); // 6種から3種を選ぶ全組合せ。
  });

  it("抽選済み作戦の復元は同じ3択を保持し、候補外・重複の破損状態は拒否", () => {
    const state = createFrontUpgradeState("restore", 999, undefined, pool);
    const restored = JSON.parse(JSON.stringify(state));
    expect(isValidFrontUpgradeState(restored)).toBe(true);
    expect(restored.offer).toEqual(state.offer);
    const selected = selectFrontUpgrade(restored, {
      runId: restored.runId,
      offerId: restored.offer.id,
      revision: 0,
      requestId: "first",
      cardId: restored.offer.cardIds[0],
    });
    expect(selected.ok).toBe(true);
    expect(selected.state.initialCards).toEqual(state.initialCards);
    expect(
      isValidFrontUpgradeState({
        ...state,
        initialCards: [...FRONT_INITIAL_CARDS],
      }),
    ).toBe(false);
    expect(
      isValidFrontUpgradeState({
        ...state,
        initialCards: [pool[0], pool[0], pool[1]],
      }),
    ).toBe(false);
    expect(() =>
      createFrontUpgradeState("bad", 1, undefined, [...pool, pool[0]]),
    ).toThrow();
  });

  it("旧規則の固定3択は変更しない", () => {
    expect(createFrontUpgradeState("legacy", 23).offer!.cardIds).toEqual(
      FRONT_INITIAL_CARDS,
    );
    expect(() =>
      createFrontUpgradeState("legacy", 23, pool.slice(0, 3)),
    ).toThrow();
  });

  it("旧出撃設定・旧デッキの名前とチェックを読める。読取では書かず開幕候補を復活させない", () => {
    const s = storage();
    const old = { pool, initialCards: [...FRONT_INITIAL_CARDS] };
    s.setItem(FRONT_LOADOUT_KEY, JSON.stringify(old));
    s.setItem(
      FRONT_DECKS_KEY,
      JSON.stringify({
        version: 1,
        slots: [{ name: "以前のデッキ", loadout: old }, null, null],
      }),
    );
    const before = [...s.map];
    expect(readFrontLoadout(s)).toEqual({ pool, error: "" });
    expect(readFrontDecks(s)).toEqual({
      slots: [{ name: "以前のデッキ", loadout: { pool } }, null, null],
      error: "",
    });
    expect([...s.map]).toEqual(before);
    saveFrontLoadout(s, readFrontLoadout(s));
    saveFrontDeck(s, 1, { name: "補強のみ", loadout: { pool } });
    expect(JSON.parse(s.getItem(FRONT_LOADOUT_KEY)!)).toEqual({ pool });
    expect(readFrontDecks(s).slots[0]?.name).toBe("以前のデッキ");
    expect(readFrontDecks(s).slots[1]).toEqual({
      name: "補強のみ",
      loadout: { pool },
    });
    expect(readFrontLoadout(s).pool).toEqual(pool);
  });
});
