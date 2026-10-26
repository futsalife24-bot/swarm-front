import type { Enemy, World } from "../shared/game";
import { restoreTurn } from "../shared/state-wire";

/** 省略された個体だけを保持し、次の確定状態で消えた個体は取り除く。 */
export class StateOmissionCache {
  private run = "";
  private enemies = new Map<number, Enemy>();
  private orbs = new Map<number, NonNullable<World["front"]>["orbs"][number]>();

  restore(world: World, omitted: unknown) {
    for (const enemy of world.enemies) {
      const volley = enemy.bastion?.volley as
        | (NonNullable<NonNullable<Enemy["bastion"]>["volley"]> & {
            turnBits?: unknown;
          })
        | undefined;
      if (volley) volley.turn = restoreTurn(volley.turnBits) ?? volley.turn;
    }
    if (world.run !== this.run) {
      this.run = world.run;
      this.enemies.clear();
      this.orbs.clear();
    }
    const partial =
      omitted && typeof omitted === "object"
        ? (omitted as { enemies?: unknown; orbs?: unknown })
        : {};
    const restore = <T extends { id: number }>(
      items: T[],
      previous: Map<number, T>,
      ids: unknown,
    ) => {
      const present = new Set(items.map((item) => item.id));
      if (Array.isArray(ids))
        for (const id of ids) {
          if (!Number.isSafeInteger(id) || present.has(id)) continue;
          const item = previous.get(id);
          if (item) {
            items.push(item);
            present.add(id);
          }
        }
      return new Map(items.map((item) => [item.id, item]));
    };
    this.enemies = restore(world.enemies, this.enemies, partial.enemies);
    if (world.front && Array.isArray(world.front.orbs))
      this.orbs = restore(world.front.orbs, this.orbs, partial.orbs);
    else this.orbs.clear();
  }
}
