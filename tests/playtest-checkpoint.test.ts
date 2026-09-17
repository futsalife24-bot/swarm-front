import { describe, expect, it } from "vitest";
import {
  createWorld,
  addPlayer,
  start,
  step,
  neutral,
} from "../src/shared/game";
import { initSolo } from "../src/shared/solo-progression";
import { freshProgress, blankLevels } from "../src/client/progression-save";
import {
  BATTLE_CHECKPOINT_KEY,
  writeBattleCheckpoint,
  readBattleCheckpoint,
} from "../src/client/battle-checkpoint";

function fixture() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  };
  const progress = freshProgress("normal"),
    world = createWorld("checkpoint-run", 17, 1);
  initSolo(world, 1, "normal", false, blankLevels());
  addPlayer(world, "solo", progress.inventory.slice(0, 2));
  start(world);
  return { storage, progress, world };
}
describe("battle checkpoint", () => {
  it("restores deterministic combat without advancing elapsed time", () => {
    const f = fixture();
    for (let n = 0; n < 30; n++) step(f.world, { solo: neutral() });
    expect(writeBattleCheckpoint(f.world, f.progress, f.storage)).toBe(true);
    const resumed = readBattleCheckpoint(f.progress, f.storage)!.world;
    expect(resumed).toEqual(JSON.parse(JSON.stringify(f.world)));
    for (let n = 0; n < 10; n++) {
      step(f.world, { solo: neutral() });
      step(resumed, { solo: neutral() });
    }
    expect(resumed).toEqual(JSON.parse(JSON.stringify(f.world)));
  });
  it("does not replay a battle against newer progress or duplicate rewards", () => {
    const f = fixture();
    writeBattleCheckpoint(f.world, f.progress, f.storage);
    f.progress.coins++;
    expect(readBattleCheckpoint(f.progress, f.storage)).toBeNull();
    f.progress.receipts.push(f.world.run);
    expect(writeBattleCheckpoint(f.world, f.progress, f.storage)).toBe(false);
  });
  it("preserves corrupt data and refuses to resume it", () => {
    const f = fixture();
    writeBattleCheckpoint(f.world, f.progress, f.storage);
    const raw = f.storage.getItem(BATTLE_CHECKPOINT_KEY)!;
    f.storage.setItem(
      BATTLE_CHECKPOINT_KEY,
      raw.replace("checkpoint-run", "corrupted-run"),
    );
    expect(() => readBattleCheckpoint(f.progress, f.storage)).toThrow();
    expect(f.storage.getItem(BATTLE_CHECKPOINT_KEY)).not.toBeNull();
  });
  it("rejects non-finite combat data and test saves", () => {
    const f = fixture();
    f.world.time = Infinity;
    expect(() =>
      writeBattleCheckpoint(f.world, f.progress, f.storage),
    ).toThrow();
    f.progress.mode = "test";
    expect(writeBattleCheckpoint(f.world, f.progress, f.storage)).toBe(false);
  });
});
