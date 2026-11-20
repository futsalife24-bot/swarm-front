import { describe, expect, it, vi } from "vitest";
import { Group } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import {
  KINDS,
  stats,
  validBattleWeapon,
  type Weapon,
} from "../src/shared/defs";
import { addPlayer, createWorld } from "../src/shared/game";
import { createFrontRun, chooseFrontUpgrade } from "../src/shared/front-run";
import {
  grantFrontUpgradeRights,
  openFrontUpgradeOffer,
} from "../src/shared/front-upgrades";
import {
  makeWeapon,
  weaponTier,
  weaponVisualTier,
} from "../src/shared/progression";
import { EquipmentCache, prepareState } from "../src/shared/state-wire";
import { restoreStateTuples } from "../src/shared/state-tuples";
import { loadProgressionWeapons } from "../src/client/progression-weapons";
import { WeaponRarityGlow } from "../src/client/weapon-rarity-glow";
import {
  freshProgress,
  validateProgress,
} from "../src/client/progression-save";

const variance = { power: 0, reload: 0, range: 0, rate: 0 };
const modern = (kind: Weapon["kind"], rarity: number, id = "first") =>
  makeWeapon(id, kind, rarity, variance, false, 1);
const legacy = (kind: Weapon["kind"], rarity: 0 | 1 | 2 | 3): Weapon => ({
  id: "first",
  kind,
  rarity,
  power: 1,
  effect: "none",
});
const basicStats = (weapon: Weapon) => {
  const value = stats(weapon);
  return [value.damage, value.mag, value.reload, value.range, value.interval];
};
function selected(weapon: Weapon) {
  const other = modern(weapon.kind === "rifle" ? "slug" : "rifle", 0, "second");
  const run = createFrontRun({
    runId: "visual-tier",
    seed: 1,
    fusion: true,
    mode: "defense",
    players: [{ id: "p", equipment: [weapon, other] }],
  });
  const offer = run.upgrades.p.offer!;
  expect(offer.defaultCardId).toBe("blast-radius");
  expect(
    chooseFrontUpgrade(run, "p", {
      runId: run.world.run,
      offerId: offer.id,
      revision: offer.revision,
      requestId: "pick-1",
      cardId: offer.defaultCardId,
    }),
  ).toBe(true);
  return run;
}

describe("fusion combat appearance", () => {
  it("preserves the original grade across all weapon kinds and nine saved grades without changing combat stats", () => {
    for (const kind of KINDS) {
      const all = [0, 1, 2, 3, 4]
        .map((tier) => modern(kind, tier))
        .concat(([0, 1, 2, 3] as const).map((tier) => legacy(kind, tier)));
      for (const input of all) {
        expect(validBattleWeapon(input)).toBe(true);
        const before = basicStats(input);
        const projected = selected(input).world.players[0].weapons[0];
        expect(weaponVisualTier(projected)).toBe(weaponTier(input));
        expect(projected.appearanceTier).toBe(weaponTier(input));
        expect("format" in projected).toBe(false);
        basicStats(projected).forEach((value, i) =>
          expect(value).toBeCloseTo(before[i], 10),
        );
      }
    }
  });

  it("removes untrusted display values without rejecting or mutating existing saved equipment", () => {
    for (const base of [modern("slug", 0), legacy("slug", 0)]) {
      for (const value of [4, 0, 9, "4", null, undefined]) {
        const input = { ...base, appearanceTier: value } as unknown as Weapon;
        const copy = structuredClone(input);
        expect(validBattleWeapon(input)).toBe(true);
        const actor = addPlayer(createWorld("sanitize"), "p", [input]);
        expect(actor.weapons[0]).not.toHaveProperty("appearanceTier");
        expect(input).toEqual(copy);
        expect(stats(actor.weapons[0])).toEqual(stats(base));
        expect(selected(input).world.players[0].weapons[0].appearanceTier).toBe(
          weaponTier(base),
        );
      }
    }
  });

  it("keeps a pre-existing unknown field in saved data but never trusts it for an actor", () => {
    const save = freshProgress("normal");
    const weapon = save.inventory[0];
    Object.assign(weapon, { appearanceTier: 4 });
    const validated = validateProgress(JSON.parse(JSON.stringify(save)));
    expect(validated.inventory[0].appearanceTier).toBe(4);
    const actor = addPlayer(createWorld("loaded-save"), "p", [
      validated.inventory[0],
    ]);
    expect(actor.weapons[0]).not.toHaveProperty("appearanceTier");
    expect(weaponVisualTier(actor.weapons[0])).toBe(weaponTier(weapon));
    expect(validated.inventory[0].appearanceTier).toBe(4);
  });

  it("carries the grade through object and tuple state, cached equipment, and replacement", () => {
    for (const mode of [0, 1, 2]) {
      const run = selected(modern("slug", 0));
      const state = prepareState(run.world, 0, { members: [], stage: 1 });
      const packet = (cached: boolean) =>
        JSON.parse(
          state.packet(
            "p",
            cached,
            -1,
            undefined,
            true,
            mode !== 0,
            false,
            false,
            mode === 1 ? 1 : 2,
          ),
        );
      const full = packet(false),
        cache = new EquipmentCache();
      expect(restoreStateTuples(full)).toBe(true);
      expect(cache.restore(full.world, false)).toBe(true);
      expect(weaponVisualTier(full.world.players[0].weapons[0])).toBe(0);
      const short = packet(true);
      expect(restoreStateTuples(short)).toBe(true);
      expect(cache.restore(short.world, true)).toBe(true);
      expect(weaponVisualTier(short.world.players[0].weapons[0])).toBe(0);
      // A new grade for the same ID must invalidate the server-side key.
      run.world.players[0].weapons[0].appearanceTier = 4;
      const replacement = prepareState(run.world, 0, { members: [], stage: 1 });
      expect(replacement.equipmentKey).not.toBe(state.equipmentKey);
      const changed = JSON.parse(
        replacement.packet(
          "p",
          false,
          -1,
          undefined,
          true,
          mode !== 0,
          false,
          false,
          mode === 1 ? 1 : 2,
        ),
      );
      expect(restoreStateTuples(changed)).toBe(true);
      expect(cache.restore(changed.world, false)).toBe(true);
      expect(weaponVisualTier(changed.world.players[0].weapons[0])).toBe(4);
    }
  });

  it("uses a valid LR asset and glow for an old server projection with no appearance override", async () => {
    const input = modern("grenade", 4);
    const projected = structuredClone(
      selected(input).world.players[0].weapons[0],
    );
    // Baseline d7d1399 sends this same projected format without the new field.
    delete projected.appearanceTier;
    const before = structuredClone(projected);
    const beforeStats = stats(projected);
    expect(weaponTier(projected)).toBe(5);
    expect(weaponVisualTier(projected)).toBe(4);
    const loader = vi
      .spyOn(GLTFLoader.prototype, "loadAsync")
      .mockResolvedValue({ scene: new Group() } as GLTF);
    try {
      await loadProgressionWeapons([projected]);
      expect(loader.mock.calls[0][0]).toBe(
        "/assets/weapons/unique-v1/grenade_4.glb",
      );
      const actual = new WeaponRarityGlow(new Group(), projected);
      const expected = new WeaponRarityGlow(new Group(), input);
      expect((actual as any).color.getHex()).toBe(
        (expected as any).color.getHex(),
      );
      actual.dispose();
      expected.dispose();
      expect(projected).toEqual(before);
      expect(stats(projected)).toEqual(beforeStats);
    } finally {
      loader.mockRestore();
    }
  });

  it("keeps valid saved grades and explicit authoritative display grades unchanged", () => {
    for (let tier = 0; tier <= 4; tier++) {
      const input = modern("slug", tier);
      expect(weaponVisualTier(input)).toBe(tier);
      expect(
        weaponVisualTier({
          ...input,
          appearanceTier: tier as 0 | 1 | 2 | 3 | 4,
        }),
      ).toBe(tier);
    }
    for (const rarity of [0, 1, 2, 3] as const) {
      expect(weaponVisualTier(legacy("slug", rarity))).toBe(rarity + 1);
    }
  });

  it("uses the same grade for inlay and neon and retains it on a restored projection", async () => {
    const loader = vi
      .spyOn(GLTFLoader.prototype, "loadAsync")
      .mockResolvedValue({ scene: new Group() } as GLTF);
    try {
      const input = modern("sticky", 0);
      const run = selected(input);
      const projected = run.world.players[0].weapons[0];
      await loadProgressionWeapons([projected]);
      expect(loader.mock.calls[0][0]).toBe(
        "/assets/weapons/unique-v1/sticky_0.glb",
      );
      const actual = new WeaponRarityGlow(new Group(), projected);
      const expected = new WeaponRarityGlow(new Group(), input);
      expect((actual as any).color.getHex()).toBe(
        (expected as any).color.getHex(),
      );
      actual.dispose();
      expected.dispose();
      const restored = JSON.parse(JSON.stringify(run)) as typeof run;
      delete restored.originalEquipment;
      restored.upgrades.p = grantFrontUpgradeRights(restored.upgrades.p, 1);
      const next = openFrontUpgradeOffer(restored.upgrades.p);
      expect(next.ok).toBe(true);
      if (!next.ok) throw new Error("missing offer");
      restored.upgrades.p = next.state;
      restored.phase = "selection";
      const offer = restored.upgrades.p.offer!;
      expect(
        chooseFrontUpgrade(restored, "p", {
          runId: restored.world.run,
          offerId: offer.id,
          revision: offer.revision,
          requestId: "pick-2",
          cardId: offer.defaultCardId,
        }),
      ).toBe(true);
      expect(weaponVisualTier(restored.world.players[0].weapons[0])).toBe(0);
    } finally {
      loader.mockRestore();
    }
  });
});
