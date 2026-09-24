import { WEAPONS, type Kind } from "../shared/defs";
import { SOLO_STAGE_IDS } from "../shared/campaign";
import {
  ACCESSORY_NAMES,
  GRADES,
  SKILLS,
  makeWeapon,
  missionKey,
  type AccessoryKind,
} from "../shared/progression";
import { freshProgress, validateProgress } from "./progression-save";

/** Disposable local sandbox. Never reads or writes normal/test player saves. */
export function developerProgress() {
  const save = freshProgress("test");
  save.inventory = [];
  for (const kind of Object.keys(WEAPONS) as Kind[])
    for (let rarity = 0; rarity < GRADES.length; rarity++)
      save.inventory.push(
        makeWeapon(
          `developer-${kind}-${rarity}`,
          kind,
          rarity,
          { power: 0, reload: 0, range: 0, rate: 0 },
          true,
          save.serial++,
        ),
      );
  save.soldiers[0].equipped = ["developer-rifle-4", "developer-shotgun-4"];
  save.unlocked = [...SKILLS];
  save.points = 120;
  save.coins = save.powder = 999999;
  save.materials = 99;
  save.branch = true;
  for (const stage of SOLO_STAGE_IDS)
    for (const difficulty of ["normal", "medium"] as const)
      save.missions[missionKey(stage, difficulty)] = [true, true, true];
  for (const kind of [
    "crawler",
    "ant",
    "spider",
    "spitter",
    "hornet",
    "boss",
    "worm",
    "harrow",
  ])
    save.encounters[kind] = "solo";
  for (const kind of Object.keys(ACCESSORY_NAMES) as AccessoryKind[])
    for (let rarity = 1; rarity <= 6; rarity++)
      save.accessories.push({
        id: `developer-${kind}-${rarity}`,
        kind,
        rarity,
        locked: false,
        testData: true,
      });
  return validateProgress(save);
}
