import { event, spawn } from "../src/shared/game";
import type { FrontRun } from "../src/shared/front-run";
import { stageFor, DEFENSE_MAPS, MAPS } from "../src/shared/stages";

/** ローカル専用。A-1の状態、または実step用の混在密集を固定seedで作る。 */
export function comfortFixture(run: FrontRun, kind: string, projectiles = 100) {
  const w = run.world,
    ids = w.players.map((p) => p.id);
  w.seed = 4520;
  run.survivalSpawnSeed = 4520;
  w.time = 180;
  if (kind === "mixed") {
    // Test Worker only: CATENA has no patrol graph in the production defence
    // arena. Use the existing campaign grass terrain for this synthetic stress
    // case, never claim it is a naturally generated survival composition.
    Object.assign(DEFENSE_MAPS[3], MAPS[3]);
    w.campaignPlan = { ...stageFor(w), map: 3 };
  }
  w.enemies = [];
  w.events = [];
  w.projectiles = [];
  run.pendingSpawns = [];
  run.pendingBoss = null;
  run.phase = "combat";
  run.resumeUntil = 0;
  run.nextSpawnAt = 180;
  if (kind === "mixed")
    for (const [i, p] of w.players.entries()) {
      p.hp = 100000;
      w.front!.players[p.id].maxHp = 100000;
      p.x = i * 3 - 6;
      p.z = 0;
    }
  for (const p of Object.values(w.front!.players)) p.statuses = {};
  const total = (w.front!.enemyCap ?? 96) + 1;
  for (let i = 0; i < total; i++) {
    const type =
      kind === "boundary"
        ? "hornet"
        : i < total - 9
          ? "crawler"
          : i < total - 6
            ? "bastion"
            : i < total - 3
              ? "harrow"
              : "boss";
    const e = spawn(
      w,
      type,
      kind === "boundary" ? -30.12345 : type === "boss" ? 0 : (i % 12) * 5 - 30,
      kind === "boundary"
        ? 20.65432
        : type === "boss"
          ? -10
          : Math.floor(i / 12) * 5 - 25,
      type === "boss" ? "worm" : "crown",
      kind === "mixed" ? 0 : undefined,
    )!;
    e.active = true;
    if (kind === "mixed") e.hp = e.maxHp = 100000;
  }
  for (const p of Object.values(w.front!.players))
    for (const e of w.enemies)
      p.statuses[e.id] = { marked: true, hits: 2, lastShot: 999999 };
  w.front!.orbs = Array.from({ length: 160 }, (_, i) => ({
    id: 100000 + i,
    x: -30.12345,
    y: 0,
    z: 10.54321,
    value: 20,
  }));
  w.front!.mines = Array.from({ length: 20 }, (_, i) => ({
    id: 100000 + i,
    owner: ids[i % 4],
    x: -30.12345,
    y: 0,
    z: 10.54321,
    expires: 999999,
  }));
  w.projectiles = Array.from({ length: projectiles }, (_, i) => ({
    id: 200000 + i,
    owner: ids[i % 4],
    x: -30.12345,
    y: 5.12345,
    z: 10.54321,
    dx: 0.56789,
    dy: 0.12345,
    dz: 0.87654,
    life: 3.78901,
    damage: 40,
    rocket: false,
    style: "laser" as const,
  }));
  for (let i = 0; i < 160; i++)
    event(w, {
      type: "shot",
      weapon: "shotgun",
      x: -30.12345,
      y: 0.12345,
      z: 10.54321,
      tx: 45.91234,
      ty: 12.54321,
      tz: -27.65432,
      owner: ids[i % 4],
      stopped: true,
    });
  return {
    seed: 4520,
    kind,
    enemies: w.enemies.length,
    projectiles: w.projectiles.length,
  };
}
