import type { World } from "../shared/game";
import { HARROW } from "../shared/harrow";
import { mapFor } from "../shared/stages";
import { supportHeight } from "../shared/terrain";

/**
 * Published checkpoint v1/v2 predates the v8 HARROW combat/animation contract.
 * Its attack ages and pending missile origins cannot be replayed with the larger body,
 * wider hit areas and new timing. Resume at a harmless boundary instead of
 * reinterpreting an already-finished warning as an immediate, stronger hit.
 *
 * The caller owns a parsed copy: no stored save, campaign plan, player, inventory,
 * HP (including earned boss damage), clock or random state is rewritten here.
 */
export function migrateLegacyHarrowCheckpoint(world: World) {
  for (const enemy of world.enemies) {
    if (enemy.kind !== "harrow" || enemy.hp <= 0) continue;
    const attack = enemy.harrow;
    enemy.wind = 0;
    enemy.cool = Math.max(enemy.cool, HARROW.threatWind);
    enemy.harrowSwitchAt =
      world.time +
      (enemy.harrowAirborne ? HARROW.airDuration : HARROW.groundDuration);

    if (
      attack &&
      (attack.kind === "Takeoff" ||
        attack.kind === "Glide" ||
        attack.kind === "Dive" ||
        attack.kind === "Land" ||
        attack.kind === "StaggerFall" ||
        (attack.kind === "Spin" && enemy.harrowAirborne))
    ) {
      // Start at the exact saved position. Never snap back to the old attack's
      // origin or deliver its impact. A stagger still grants its falling window.
      enemy.harrow = {
        kind: attack.kind === "StaggerFall" ? "StaggerFall" : "Land",
        started: world.time,
        fired: false,
        yaw: enemy.heading ?? attack.yaw,
        from: { x: enemy.x, y: enemy.y, z: enemy.z },
        to: {
          x: enemy.x,
          y: supportHeight(enemy.x, enemy.z, mapFor(world).blocks, enemy.y),
          z: enemy.z,
        },
      };
    } else {
      // Ground Spin and Threat must announce a new v8 attack before hitting.
      // Idle flight keeps its saved altitude; the renderer applies current scale.
      enemy.harrow = undefined;
    }
  }
  // Pending launches were authored for old wing poses: cancel them. Already
  // airborne missiles keep their exact path, impact time and captured damage,
  // even if their owner has died; never teleport, retarget or fire them again.
  if (world.harrowMissiles?.length)
    world.harrowMissiles = world.harrowMissiles.filter(
      (missile) => missile.launch <= world.time,
    );
}
