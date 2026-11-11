import { afterEach, describe, expect, it, vi } from "vitest";
import { Group } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import {
  loadProgressionWeapons,
  progressionWeaponModel,
} from "../src/client/progression-weapons";
import { weaponModelUrl } from "../src/client/weapon-model-url";
import { weaponTier } from "../src/shared/progression";
import type { Weapon } from "../src/shared/defs";

const weapon = (kind: Weapon["kind"], rarity: Weapon["rarity"]): Weapon => ({
  id: `${kind}-${rarity}`,
  kind,
  rarity,
  power: 1,
  effect: "none",
});
const scene = () => ({ scene: new Group() }) as GLTF;
afterEach(() => vi.restoreAllMocks());

describe("weapon model loading", () => {
  it("uses the same grade for legacy and modern R–LR inlays and the neon tier", async () => {
    const loader = vi
      .spyOn(GLTFLoader.prototype, "loadAsync")
      .mockImplementation(async () => scene());
    const legacy = ([0, 1, 2, 3] as const).map((r) => weapon("grenade", r));
    const modern = ([1, 2, 3, 4] as const).map((r) => ({
      ...weapon("grenade", r),
      format: 2 as const,
    }));
    const normal = { ...weapon("grenade", 0), format: 2 as const };
    const starter = weapon("rifle", 0);

    await loadProgressionWeapons([...legacy, ...modern, normal, starter]);
    expect(loader.mock.calls.map(([url]) => url)).toEqual([
      "/assets/weapons/unique-v1/grenade_1.glb",
      "/assets/weapons/unique-v1/grenade_2.glb",
      "/assets/weapons/unique-v1/grenade_3.glb",
      "/assets/weapons/unique-v1/grenade_4.glb",
      "/assets/weapons/unique-v1/grenade_0.glb",
      "/assets/weapons/realism-v2/rifle_1.glb",
    ]);
    for (let i = 0; i < legacy.length; i++) {
      expect(weaponTier(legacy[i])).toBe(i + 1);
      expect(progressionWeaponModel(legacy[i])).toBe(
        progressionWeaponModel(modern[i]),
      );
      expect(weaponModelUrl(legacy[i].kind, weaponTier(legacy[i]))).toBe(
        `/assets/weapons/unique-v1/grenade_${i + 1}.glb`,
      );
    }
    expect(progressionWeaponModel(normal)).toBeDefined();
    expect(progressionWeaponModel(starter)).toBeDefined();
  });

  it("reports a failed model load and allows the same model to be retried", async () => {
    const loader = vi
      .spyOn(GLTFLoader.prototype, "loadAsync")
      .mockRejectedValueOnce(new Error("model unavailable"))
      .mockResolvedValueOnce(scene());
    const item = weapon("smg", 2);

    await expect(loadProgressionWeapons([item])).rejects.toThrow(
      "model unavailable",
    );
    expect(progressionWeaponModel(item)).toBeUndefined();
    await expect(loadProgressionWeapons([item])).resolves.toBeDefined();
    expect(progressionWeaponModel(item)).toBeDefined();
    expect(loader.mock.calls.map(([url]) => url)).toEqual([
      "/assets/weapons/unique-v1/smg_3.glb",
      "/assets/weapons/unique-v1/smg_3.glb",
    ]);
  });
});
