import { describe, it, expect } from "vitest";
import {
  createFrontUpgradeState,
  selectFrontUpgrade,
  grantFrontUpgradeRights,
  openFrontUpgradeOffer,
  rerollFrontUpgrade,
  isValidFrontUpgradeState,
  FRONT_FAMILY_CARDS,
  FRONT_UPGRADE_CATALOG,
  FRONT_UPGRADE_IDS,
  frontEvolvedFamilies,
  frontCandidateCombinations,
} from "../src/shared/front-upgrades";

describe("改装版の強化", () => {
  it("初期は異なる3系統で、他の人・古い・二重の要求を拒否する", () => {
    const state = createFrontUpgradeState("front-test", 42);
    expect(state.offer?.cardIds).toEqual([
      "blast-core",
      "armor-piercer",
      "afterimage-mine",
    ]);
    const request = {
      runId: state.runId,
      offerId: state.offer!.id,
      revision: 0,
      requestId: "req-1",
      cardId: "blast-core" as const,
    };
    expect(selectFrontUpgrade(state, { ...request, runId: "other" }).ok).toBe(
      false,
    );
    const result = selectFrontUpgrade(state, request);
    expect(result.ok).toBe(true);
    expect(selectFrontUpgrade(result.state, request).ok).toBe(false);
    expect(isValidFrontUpgradeState(result.state)).toBe(true);
  });
  it("進化保証は再抽選後も維持し、3+3+1で2進化する", () => {
    let state = createFrontUpgradeState("evolve", 100);
    let serial = 0;
    for (const id of [
      "blast-core",
      "fuse",
      "compressed-charge",
      "armor-piercer",
      "ricochet",
      "line-shot",
      "armor",
    ] as const) {
      if (!state.offer) {
        state = grantFrontUpgradeRights(state, 6);
        state = openFrontUpgradeOffer(state).state;
        const combo = frontCandidateCombinations(state).find((cards) =>
          cards.includes(id),
        )!;
        state = {
          ...state,
          offer: {
            ...state.offer!,
            cardIds: combo,
            defaultCardId: [...combo].sort((a, b) => {
              const priority = (card: typeof id | string) => {
                const family = FRONT_UPGRADE_CATALOG[card as typeof id].family;
                if (
                  family !== "generic" &&
                  FRONT_FAMILY_CARDS[family].filter((c) => state.levels[c])
                    .length === 2
                )
                  return 0;
                return family === "explosion" ? 1 : 2;
              };
              return priority(a) - priority(b) || a.localeCompare(b);
            })[0],
            seenCombinations: [[...combo].sort().join(",")],
          },
        };
      }
      expect(isValidFrontUpgradeState(state)).toBe(true);
      if (state.levels.fuse && !state.levels["compressed-charge"]) {
        expect(state.offer!.cardIds).toContain("compressed-charge");
        const rerolled = rerollFrontUpgrade(state, {
          runId: state.runId,
          offerId: state.offer!.id,
          revision: state.revision,
          requestId: `roll-${++serial}`,
        });
        if (rerolled.ok)
          expect(rerolled.state.offer!.cardIds).toContain("compressed-charge");
      }
      const result = selectFrontUpgrade(state, {
        runId: state.runId,
        offerId: state.offer!.id,
        revision: state.revision,
        requestId: `pick-${++serial}`,
        cardId: id,
      });
      expect(result.ok).toBe(true);
      state = result.state;
    }
    expect(frontEvolvedFamilies(state)).toEqual(["explosion", "piercing"]);
    expect(state.picks).toBe(7);
  });
  it("7取得までの全構成で3択と保証枠が成立し、上限・取得済みを除く", () => {
    const initial = createFrontUpgradeState("enumerate", 1);
    const seen = new Set<string>();
    let checked = 0;
    function visit(
      levels: typeof initial.levels,
      initialCardId: typeof initial.initialCardId,
    ) {
      const picks = FRONT_UPGRADE_IDS.reduce((sum, id) => sum + levels[id], 0);
      const key = `${initialCardId}:${FRONT_UPGRADE_IDS.map((id) => levels[id]).join("")}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (picks >= 7) {
        expect(frontEvolvedFamilies({ levels }).length).toBeLessThanOrEqual(2);
        return;
      }
      const combos =
        picks === 0
          ? [initial.offer!.cardIds]
          : frontCandidateCombinations({ levels, initialCardId });
      expect(combos.length).toBeGreaterThan(0);
      const candidates = new Set<(typeof FRONT_UPGRADE_IDS)[number]>();
      for (const combo of combos) {
        expect(new Set(combo).size).toBe(3);
        for (const id of combo) {
          expect(levels[id]).toBeLessThan(FRONT_UPGRADE_CATALOG[id].maxLevel);
          candidates.add(id);
        }
        for (const cards of Object.values(FRONT_FAMILY_CARDS)) {
          if (cards.filter((id) => levels[id]).length === 2)
            expect(combo).toContain(cards.find((id) => !levels[id]));
        }
        checked++;
      }
      for (const id of candidates)
        visit({ ...levels, [id]: levels[id] + 1 }, initialCardId ?? id);
    }
    visit(initial.levels, null);
    expect(seen.size).toBeGreaterThan(7000);
    expect(checked).toBeGreaterThan(30000);
  }, 30000);
  it("初期候補は各系統1枚を検証する", () => {
    expect(() =>
      createFrontUpgradeState("bad", 1, ["armor", "reload", "magazine"]),
    ).toThrow();
    expect(
      isValidFrontUpgradeState(
        createFrontUpgradeState("alternate", 1, [
          "fuse",
          "ricochet",
          "interceptor",
        ]),
      ),
    ).toBe(true);
  });
});
