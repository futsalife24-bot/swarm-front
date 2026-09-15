import { it, expect } from "vitest";
import {
  createTrainingWorld,
  stepTraining,
  TARGETS,
} from "../src/shared/training";
import { neutral, hurtEnemy } from "../src/shared/game";
import { mapFor, TRAINING_MAP, MAPS } from "../src/shared/stages";
import { groundHeight } from "../src/shared/terrain";
it("keeps a separate flat range with stationary targets and no campaign waves or rewards", () => {
  const w = createTrainingWorld();
  const positions = w.enemies.map((e) => [e.x, e.z]);
  for (let i = 0; i < 12200; i++) stepTraining(w, neutral());
  expect(w.enemies.map((e) => [e.x, e.z])).toEqual(positions);
  expect(w.phase).toBe("battle");
  expect(w.wave).toBe(1);
  expect(w.players[0].hp).toBe(160);
  expect(mapFor(w)).toBe(TRAINING_MAP);
  expect(MAPS).not.toContain(TRAINING_MAP);
  expect(groundHeight(0, 0, mapFor(w).blocks)).toBe(0);
  expect(w.pending.training).toEqual([]);
  expect(w.rewards).toEqual({});
  hurtEnemy(w, w.enemies[0], 20000, "training");
  stepTraining(w, neutral());
  expect(w.enemies).toHaveLength(TARGETS.length);
  expect(w.drops).toEqual([]);
});
it("uses real movement, firing, magazine, reload and dodge rules", () => {
  const w = createTrainingWorld(),
    p = w.players[0],
    initial = p.ammo[0];
  stepTraining(w, { ...neutral(), fire: true, mz: 1, dodge: true });
  expect(p.z).toBeLessThan(16);
  expect(p.ammo[0]).toBe(initial - 1);
  expect(p.evadeCd).toBeGreaterThan(0);
  expect(w.events.some((e) => e.type === "shot")).toBe(true);
  stepTraining(w, { ...neutral(), reload: true });
  expect(p.reload).toBeGreaterThan(0);
  for (let i = 0; i < 200; i++) stepTraining(w, neutral());
  expect(p.ammo[0]).toBe(initial);
});
