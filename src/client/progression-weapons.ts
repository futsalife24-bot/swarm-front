import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { modelOf, type Weapon } from "../shared/defs";
import { weaponVisualTier } from "../shared/progression";
import { weaponModelUrl } from "./weapon-model-url";
const models = new Map<string, T.Group>(),
  pending = new Map<string, Promise<void>>();
// Match the neon tier for both the legacy R–LR and newer N–LR grades.
const key = (w: Weapon) => `${modelOf(w.kind)}_${weaponVisualTier(w)}`;
export function progressionWeaponModel(w: Weapon) {
  const exact = models.get(key(w));
  if (exact) return exact;
  // Old servers can omit the visual grade after fusion. Keep the same weapon
  // silhouette using a loaded grade; grade variants share identical geometry.
  // Loading an exact grade later takes precedence without extra frame-time IO.
  const kind = modelOf(w.kind);
  for (let tier = 0; tier < 5; tier++) {
    const loaded = models.get(`${kind}_${tier}`);
    if (loaded) return loaded;
  }
}
export function loadProgressionWeapons(weapons: Weapon[]) {
  return Promise.all(
    weapons.map((w) => {
      const id = key(w);
      if (models.has(id)) return Promise.resolve();
      let p = pending.get(id);
      if (!p) {
        p = new GLTFLoader()
          .loadAsync(weaponModelUrl(w.kind, weaponVisualTier(w)))
          .then((gltf) => {
            models.set(id, gltf.scene);
          })
          .catch((e) => {
            pending.delete(id);
            throw e;
          });
        pending.set(id, p);
      }
      return p;
    }),
  );
}
