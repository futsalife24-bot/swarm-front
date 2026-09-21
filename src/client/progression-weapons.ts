import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { modelOf, type Weapon } from "../shared/defs";
import type { NewWeapon } from "../shared/progression";
const models = new Map<string, T.Group>(),
  pending = new Map<string, Promise<void>>();
// Keyed by the model a weapon is drawn with, not by the weapon: a kind without
// its own GLB borrows the silhouette closest to how it is actually held.
const key = (w: Weapon) => `${modelOf(w.kind)}_${w.rarity}`;
export function progressionWeaponModel(w: Weapon) {
  return (w as NewWeapon).format === 2 ? models.get(key(w)) : undefined;
}
export function loadProgressionWeapons(weapons: Weapon[]) {
  return Promise.all(
    weapons.map((w) => {
      const id = key(w);
      if (models.has(id)) return Promise.resolve();
      let p = pending.get(id);
      if (!p) {
        p = new GLTFLoader()
          .loadAsync(
            `${import.meta.env.BASE_URL}assets/weapons/realism-v2/${id}.glb`,
          )
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
