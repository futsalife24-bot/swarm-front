import { modelOf, type Kind } from "../shared/defs";

/** The original three URLs stay unchanged; new models use a versioned path. */
export function weaponModelUrl(kind: Kind, rarity: number) {
  const model = modelOf(kind);
  const directory =
    model === "rifle" || model === "shotgun" || model === "rocket"
      ? "realism-v2"
      : "unique-v1";
  return `${import.meta.env.BASE_URL}assets/weapons/${directory}/${model}_${rarity}.glb`;
}
