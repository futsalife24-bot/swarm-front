import { describe, expect, it } from "vitest";
import {
  REBUILD_EXPLOSION_UPGRADES,
  REBUILD_MAX_PICKS,
  REBUILD_UPGRADE_CATALOG,
  REBUILD_UPGRADE_IDS,
  createRebuildUpgradeState,
  canRerollRebuildUpgrade,
  getEligibleRebuildUpgrades,
  getGuaranteedRebuildUpgrades,
  grantRebuildUpgradeRights,
  isValidRebuildUpgradeState,
  openRebuildUpgradeOffer,
  rerollRebuildUpgrade,
  selectRebuildUpgrade,
  type RebuildUpgradeId,
  type RebuildUpgradeRequest,
  type RebuildUpgradeSelection,
  type RebuildUpgradeState,
} from "../src/shared/rebuild-upgrades";

const ids = REBUILD_UPGRADE_IDS;
const key = (cards: readonly string[]) => [...cards].sort().join(",");
function request(
  state: RebuildUpgradeState,
  requestId = `request-${state.offerSerial}`,
): RebuildUpgradeRequest {
  return {
    runId: state.runId,
    offerId: state.offer!.id,
    revision: state.revision,
    requestId,
  };
}
function select(
  state: RebuildUpgradeState,
  cardId: RebuildUpgradeId,
): RebuildUpgradeState {
  const result = selectRebuildUpgrade(state, { ...request(state), cardId });
  expect(result.ok).toBe(true);
  expect(isValidRebuildUpgradeState(result.state)).toBe(true);
  return result.state;
}
function open(state: RebuildUpgradeState): RebuildUpgradeState {
  const result = openRebuildUpgradeOffer(state);
  expect(result.ok).toBe(true);
  expect(isValidRebuildUpgradeState(result.state)).toBe(true);
  return result.state;
}
function picked(
  levels: RebuildUpgradeState["levels"],
  seed = 42,
): RebuildUpgradeState {
  const picks = ids.reduce((sum, id) => sum + levels[id], 0);
  return {
    ...createRebuildUpgradeState("exhaustive", seed),
    levels,
    picks,
    revision: picks,
    initialCardId: REBUILD_EXPLOSION_UPGRADES.find((id) => levels[id] > 0)!,
    evolved: REBUILD_EXPLOSION_UPGRADES.every((id) => levels[id] === 1),
    rightsGranted: 6,
    rightsSpent: picks - 1,
    offer: null,
    offerSerial: picks,
    processedRequestIds: Array.from({ length: picks }, (_, i) => `picked-${i}`),
  };
}
function combinations(state: RebuildUpgradeState): RebuildUpgradeId[][] {
  const eligible = ids
    .filter((id) => state.levels[id] < REBUILD_UPGRADE_CATALOG[id].maxLevel)
    .sort();
  const familyCount = REBUILD_EXPLOSION_UPGRADES.filter(
    (id) => state.levels[id],
  ).length;
  const guaranteed =
    familyCount === 2
      ? REBUILD_EXPLOSION_UPGRADES.filter((id) => !state.levels[id])
      : [];
  const result: RebuildUpgradeId[][] = [];
  for (let a = 0; a < eligible.length; a++)
    for (let b = a + 1; b < eligible.length; b++)
      for (let c = b + 1; c < eligible.length; c++) {
        const cards = [eligible[a], eligible[b], eligible[c]];
        if (!guaranteed.every((id) => cards.includes(id))) continue;
        if (
          familyCount === 1 &&
          cards.filter(
            (id) => REBUILD_UPGRADE_CATALOG[id].family === "explosion",
          ).length !== 1
        )
          continue;
        result.push(cards);
      }
  return result;
}
// Invert the documented uint32 LCG to hit each combination interval directly.
function seedFor(index: number, count: number): number {
  const output = BigInt(Math.floor(((index + 0.5) / count) * 0x100000000));
  return Number(BigInt.asUintN(32, (output - 1013904223n) * 4276115653n));
}

describe("P1a upgrade candidate guarantees", () => {
  it("creates a frozen initial offer of exactly the three standalone explosion cards", () => {
    const state = createRebuildUpgradeState("initial", 0xffffffff);
    expect(isValidRebuildUpgradeState(state)).toBe(true);
    expect(state.offer?.cardIds).toEqual(REBUILD_EXPLOSION_UPGRADES);
    expect(state.offer?.defaultCardId).toBe("blast-core");
    expect(state.rightsGranted).toBe(0);
    expect(state.rerollsRemaining).toBe(2);
    for (const value of [
      state,
      state.levels,
      state.offer,
      state.offer?.cardIds,
      state.offer?.seenCombinations,
      state.processedRequestIds,
    ])
      expect(Object.isFrozen(value)).toBe(true);
    expect(select(state, "fuse").initialCardId).toBe("fuse");
    expect(state.picks).toBe(0);
  });

  it("exhausts all 410 reachable build states and every legal three-card combination through seven picks", () => {
    let layer = new Map<string, RebuildUpgradeState>();
    for (const initial of REBUILD_EXPLOSION_UPGRADES) {
      const state = select(createRebuildUpgradeState("initial", 0), initial);
      layer.set(
        ids.map((id) => state.levels[id]).join(","),
        picked(state.levels),
      );
    }
    let states = 0,
      offers = 0,
      transitions = 0;
    for (let picks = 1; picks <= REBUILD_MAX_PICKS; picks++) {
      const following = new Map<string, RebuildUpgradeState>();
      for (const state of layer.values()) {
        states++;
        expect(isValidRebuildUpgradeState(state)).toBe(true);
        expect(state.picks).toBe(picks);
        if (picks === 7) {
          expect(openRebuildUpgradeOffer(state)).toMatchObject({
            ok: false,
            reason: "pick-limit",
            state,
          });
          continue;
        }
        const eligible = getEligibleRebuildUpgrades(state);
        expect(eligible.length).toBeGreaterThanOrEqual(3);
        const possible = combinations(state);
        expect(possible.length).toBeGreaterThan(0);
        const actual = new Set<string>();
        possible.forEach((cards, index) => {
          const offered = open({
            ...state,
            rngState: seedFor(index, possible.length),
          });
          offers++;
          actual.add(key(offered.offer!.cardIds));
          expect(offered.offer!.cardIds).toEqual(cards);
          expect(new Set(cards).size).toBe(3);
          for (const id of getGuaranteedRebuildUpgrades(state))
            expect(cards).toContain(id);
          const familyCards = cards.filter(
            (id) => REBUILD_UPGRADE_CATALOG[id].family === "explosion",
          );
          const expectedDefault =
            getGuaranteedRebuildUpgrades(state)[0] ??
            [...familyCards].sort()[0] ??
            [...cards].sort()[0];
          expect(offered.offer!.defaultCardId).toBe(expectedDefault);
          for (const id of cards) {
            const next = select(offered, id);
            transitions++;
            expect(next.picks).toBe(picks + 1);
            expect(next.rightsSpent).toBe(picks);
            expect(next.evolved).toBe(
              REBUILD_EXPLOSION_UPGRADES.every(
                (family) => next.levels[family] === 1,
              ),
            );
            following.set(
              ids.map((id) => next.levels[id]).join(","),
              picked(next.levels),
            );
          }
        });
        expect(actual).toEqual(new Set(possible.map(key)));
      }
      layer = following;
    }
    expect(states).toBe(410);
    expect(offers).toBeGreaterThan(500);
    expect(transitions).toBe(offers * 3);
  });

  it("keeps completion guarantees on each reroll and never repeats a shown combination", () => {
    let state = picked({
      "blast-core": 1,
      fuse: 1,
      "compressed-charge": 0,
      armor: 0,
      reload: 0,
      magazine: 0,
    });
    state = open(state);
    const shown = new Set([key(state.offer!.cardIds)]);
    for (let reroll = 0; reroll < 2; reroll++) {
      const old = state;
      const result = rerollRebuildUpgrade(state, request(state));
      expect(result.ok).toBe(true);
      state = result.state;
      expect(isValidRebuildUpgradeState(state)).toBe(true);
      expect(state.offer!.cardIds).toContain("compressed-charge");
      expect(state.offer!.defaultCardId).toBe("compressed-charge");
      expect(state.revision).toBe(old.revision);
      expect(state.offer!.id).not.toBe(old.offer!.id);
      expect(state.rerollsRemaining).toBe(1 - reroll);
      expect(shown.has(key(state.offer!.cardIds))).toBe(false);
      shown.add(key(state.offer!.cardIds));
    }
    expect(rerollRebuildUpgrade(state, request(state))).toMatchObject({
      ok: false,
      reason: "reroll-limit",
      state,
    });
    state = open(select(state, "compressed-charge"));
    expect(state.evolved).toBe(true);
    expect(state.rerollsRemaining).toBe(0);
    expect(rerollRebuildUpgrade(state, request(state))).toMatchObject({
      ok: false,
      reason: "reroll-limit",
    });
  });

  it("does not consume a reroll or RNG when only one combination remains", () => {
    const state = open(
      picked({
        "blast-core": 1,
        fuse: 1,
        "compressed-charge": 1,
        armor: 0,
        reload: 0,
        magazine: 0,
      }),
    );
    expect(canRerollRebuildUpgrade(state)).toBe(false);
    const result = rerollRebuildUpgrade(state, request(state));
    expect(result).toEqual({ ok: false, state, reason: "no-new-combination" });
    expect(result.state).toBe(state);
    expect(state.rerollsRemaining).toBe(2);
  });

  it("issues cumulative rights once and processes banked rights one card at a time", () => {
    let state = select(createRebuildUpgradeState("banked", 8), "fuse");
    expect(openRebuildUpgradeOffer(state)).toMatchObject({
      ok: false,
      reason: "no-rights",
    });
    state = grantRebuildUpgradeRights(state, 6);
    expect(grantRebuildUpgradeRights(state, 6)).toBe(state);
    for (let n = 0; n < 6; n++) {
      state = open(state);
      expect(openRebuildUpgradeOffer(state)).toMatchObject({
        ok: false,
        reason: "offer-open",
      });
      state = select(state, state.offer!.defaultCardId);
    }
    expect(state.picks).toBe(7);
    expect(state.rightsGranted).toBe(6);
    expect(state.rightsSpent).toBe(6);
  });
});

describe("P1a upgrade request/state validation", () => {
  it.each(["", " ", "a".repeat(129)])("rejects invalid run ID %j", (runId) =>
    expect(() => createRebuildUpgradeState(runId, 0)).toThrow(RangeError),
  );
  it.each([-1, 0x100000000, 0.5, NaN, Infinity])(
    "rejects invalid seed %s",
    (seed) =>
      expect(() => createRebuildUpgradeState("seed", seed)).toThrow(RangeError),
  );
  it.each([-1, 7, 1.5, NaN, Infinity])(
    "rejects invalid cumulative right count %s",
    (count) =>
      expect(() =>
        grantRebuildUpgradeRights(
          createRebuildUpgradeState("rights", 0),
          count,
        ),
      ).toThrow(RangeError),
  );
  it("rejects a decrease in granted rights", () =>
    expect(() =>
      grantRebuildUpgradeRights(
        grantRebuildUpgradeRights(createRebuildUpgradeState("rights", 0), 3),
        2,
      ),
    ).toThrow(RangeError));
  it.each([
    ["wrong-run", { runId: "someone-else" }],
    ["stale-offer", { offerId: "other-offer" }],
    ["stale-revision", { revision: 1 }],
    ["invalid-request", { revision: NaN }],
    ["invalid-request", { revision: -1 }],
    ["invalid-request", { requestId: " " }],
    ["invalid-request", { requestId: "x".repeat(129) }],
    ["invalid-request", { offerId: 12 }],
    ["not-offered", { cardId: "armor" }],
    ["not-offered", { cardId: "unknown" }],
  ])("rejects %s without mutation (%j)", (reason, patch) => {
    const state = createRebuildUpgradeState("validation", 9);
    const before = JSON.stringify(state);
    const result = selectRebuildUpgrade(state, {
      ...request(state),
      cardId: "fuse",
      ...patch,
    } as RebuildUpgradeSelection);
    expect(result).toEqual({ ok: false, state, reason });
    expect(result.state).toBe(state);
    expect(JSON.stringify(state)).toBe(before);
  });
  it("rejects null/array requests, initial rerolls, replayed requests and stale offers", () => {
    const initial = createRebuildUpgradeState("replay", 9);
    for (const request of [null, [], undefined])
      expect(
        selectRebuildUpgrade(
          initial,
          request as unknown as RebuildUpgradeSelection,
        ),
      ).toMatchObject({ ok: false, reason: "invalid-request" });
    expect(rerollRebuildUpgrade(initial, request(initial))).toMatchObject({
      ok: false,
      reason: "initial-reroll",
    });
    const choice = { ...request(initial), cardId: "fuse" as const };
    const chosen = selectRebuildUpgrade(initial, choice).state;
    expect(selectRebuildUpgrade(chosen, choice)).toEqual({
      ok: false,
      state: chosen,
      reason: "duplicate-request",
    });
    expect(
      selectRebuildUpgrade(chosen, {
        ...choice,
        requestId: "new",
        revision: chosen.revision,
      }),
    ).toMatchObject({ ok: false, reason: "no-offer" });
    const offered = open(grantRebuildUpgradeRights(chosen, 1));
    const rerolled = rerollRebuildUpgrade(offered, request(offered)).state;
    expect(rerollRebuildUpgrade(rerolled, request(offered))).toEqual({
      ok: false,
      state: rerolled,
      reason: "duplicate-request",
    });
    expect(
      selectRebuildUpgrade(rerolled, {
        ...request(offered, "fresh"),
        cardId: offered.offer!.defaultCardId,
      }),
    ).toMatchObject({ ok: false, reason: "stale-offer" });
  });
  it("rejects malformed states before opening/selecting/rerolling", () => {
    const initial = createRebuildUpgradeState("corruption", 9);
    const cases: unknown[] = [
      null,
      [],
      {},
      { ...initial, picks: 1 },
      { ...initial, revision: NaN },
      { ...initial, evolved: true },
      { ...initial, rngState: -1 },
      { ...initial, offerSerial: 0 },
      { ...initial, rightsGranted: 7 },
      { ...initial, rightsSpent: 1 },
      { ...initial, initialCardId: "fuse" },
      { ...initial, rerollsRemaining: 1 },
      { ...initial, levels: { ...initial.levels, armor: 5 } },
      { ...initial, levels: { ...initial.levels, extra: 0 } },
      { ...initial, offer: null },
      { ...initial, processedRequestIds: ["fake"] },
      { ...initial, offer: { ...initial.offer, id: "wrong" } },
      {
        ...initial,
        offer: { ...initial.offer, cardIds: ["fuse", "fuse", "blast-core"] },
      },
      { ...initial, offer: { ...initial.offer, defaultCardId: "armor" } },
      { ...initial, offer: { ...initial.offer, seenCombinations: ["fake"] } },
    ];
    for (const value of cases) {
      const state = value as RebuildUpgradeState;
      expect(isValidRebuildUpgradeState(state)).toBe(false);
      expect(openRebuildUpgradeOffer(state)).toMatchObject({
        ok: false,
        reason: "invalid-state",
      });
      expect(
        selectRebuildUpgrade(state, { ...request(initial), cardId: "fuse" }),
      ).toMatchObject({ ok: false, reason: "invalid-state" });
      expect(rerollRebuildUpgrade(state, request(initial))).toMatchObject({
        ok: false,
        reason: "invalid-state",
      });
      expect(() => getEligibleRebuildUpgrades(state)).toThrow(RangeError);
    }
  });
});

describe("P1a reroll availability", () => {
  it("disables initial, absent, invalid and spent offers but enables a real alternative", () => {
    const initial = createRebuildUpgradeState("availability", 42);
    expect(canRerollRebuildUpgrade(initial)).toBe(false);
    const chosen = select(initial, "blast-core");
    expect(canRerollRebuildUpgrade(chosen)).toBe(false);
    const offered = open(grantRebuildUpgradeRights(chosen, 6));
    expect(canRerollRebuildUpgrade(offered)).toBe(true);
    expect(canRerollRebuildUpgrade({ ...offered, rerollsRemaining: 0 })).toBe(
      false,
    );
    expect(
      canRerollRebuildUpgrade(null as unknown as RebuildUpgradeState),
    ).toBe(false);
  });
});
