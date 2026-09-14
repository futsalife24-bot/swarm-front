import { createWorld, addPlayer, spawn, step, type Input } from "./game";
import { STARTERS, type Weapon } from "./defs";
export const TARGETS = [
  { x: 0, z: 6 },
  { x: -8, z: -4 },
  { x: 8, z: -14 },
  { x: 0, z: -34 },
];
export function createTrainingWorld(weapons: Weapon[] = STARTERS.slice(0, 2)) {
  const w = createWorld("training", 731);
  w.training = true;
  const p = addPlayer(w, "training", weapons);
  p.x = 0;
  p.z = 16;
  p.y = 0;
  w.phase = "battle";
  w.wave = 1;
  resetTargets(w);
  return w;
}
export function resetTargets(w: ReturnType<typeof createWorld>) {
  w.enemies = [];
  w.projectiles = [];
  w.drops = [];
  for (const target of TARGETS) {
    spawn(w, "crawler", target.x, target.z, "crown", 0);
    const e = w.enemies.at(-1)!;
    e.hp = e.maxHp = 10000;
    e.size = 1;
    e.y = 0;
  }
}
export function stepTraining(
  w: ReturnType<typeof createTrainingWorld>,
  input: Input,
  dt = 0.05,
) {
  step(w, { training: input }, dt);
  w.drops = [];
  w.pending.training = [];
  w.rewards = {};
  // Targets recover after a hit without producing campaign progress or rewards.
  if (w.enemies.length !== TARGETS.length) resetTargets(w);
}
