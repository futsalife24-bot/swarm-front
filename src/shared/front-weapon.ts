import { STARTERS, type Weapon } from "./defs";

export { FRONT_SURVIVAL_WEAPON_NAME, isFrontSurvivalWeapon } from "./defs";
import { FRONT_SURVIVAL_WEAPON_ID_PREFIX } from "./defs";

// Keep temporary battle IDs within validWeapon's 100-character limit, even
// when run and player identifiers each occupy their full permitted length.
function idPart(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const char of value) {
    hash ^= BigInt(char.codePointAt(0)!);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
}

export function createFrontSurvivalWeapon(
  runId: string,
  owner: string,
): Weapon {
  return {
    ...STARTERS[0],
    id: `${FRONT_SURVIVAL_WEAPON_ID_PREFIX}${idPart(runId)}-${idPart(owner)}`,
  };
}
