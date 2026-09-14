import { spawnSize } from "./enemy-size";
import { settings } from './progression';
import { groundHeight } from "./terrain";
import { ENEMIES, LIMITS } from "./defs";
import { mapFor, type TroopKind } from "./stages";
import {
  blocked,
  enemyBodies,
  random,
  spawn,
  type Enemy,
  type World,
} from "./game";
import { attachedWormBodyParts } from "./worm";

export interface FoundrySpawnBatch {
  source: number;
  time: number;
  x: number;
  z: number;
  parts: number[];
  kinds?: TroopKind[];
}

// Called before subtracting head HP. The one-time latch also covers zero bodies.
export function queueFoundrySpawn(w: World, e: Enemy) {
  if (e.foundryTriggered) return;
  e.foundryTriggered = true;
  const parts = attachedWormBodyParts(e);
  if (parts.length)
    (w.foundrySpawns ??= []).push({
      source: e.id,
      time: w.time,
      x: e.x,
      z: e.z,
      parts,
    });
}

// All damage at one simulation time is a transaction: a simultaneous body cut
// is resolved before deciding the head's connected-body count, regardless of
// player/pellet/projectile iteration order. Generation flushes only at tick end.
export function cutPendingFoundrySpawn(w: World, e: Enemy, part: number) {
  for (const batch of w.foundrySpawns ?? [])
    if (batch.source === e.id && batch.time === w.time && !batch.kinds)
      batch.parts = batch.parts.filter((index) => index < part);
}

function spawnPoint(w: World, batch: FoundrySpawnBatch, kind: TroopKind) {
  const size = spawnSize(kind, false, w.enemyOrdinal ?? 0);
  const def = { ...ENEMIES[kind], radius: ENEMIES[kind].radius * size },
    blocks = mapFor(w).blocks;
  const bodies = w.enemies.filter((e) => e.hp > 0).flatMap(enemyBodies);
  for (let ring = 0; ring < 12; ring++)
    for (let i = 0; i < 24; i++) {
      const angle = ((i + (batch.source % 24)) * Math.PI) / 12;
      const x = batch.x + Math.sin(angle) * (4 + ring * 2);
      const z = batch.z + Math.cos(angle) * (4 + ring * 2);
      if (blocked(x, z, def.radius, def.cruise, blocks)) continue;
      if (
        bodies.some(
          (b) => Math.hypot(b.x - x, b.z - z) < b.radius + def.radius + 0.2,
        )
      )
        continue;
      if (
        w.players.some(
          (p) => p.hp > 0 && Math.hypot(p.x - x, p.z - z) < def.radius + 0.8,
        )
      )
        continue;
      return { x, z };
    }
  return undefined;
}

export function pendingFoundryCount(w: World) {
  return (w.foundrySpawns ?? []).reduce(
    (sum, batch) => sum + (batch.kinds?.length ?? batch.parts.length),
    0,
  );
}

// No live boss object is required: the queue survives its final body being
// destroyed, snapshots, the 40-enemy cap, and an temporarily empty map roster.
export function flushFoundrySpawns(w: World) {
  const allowed = [...new Set(mapFor(w).foundryAllowed ?? [])];
  for (const batch of w.foundrySpawns ?? []) {
    if (!batch.kinds) {
      if (!allowed.length) continue;
      batch.kinds = batch.parts.map(
        () => allowed[Math.floor(random(w) * allowed.length)],
      );
    }
    while (batch.kinds.length && w.enemies.length < (w.solo?settings(w.solo.stage,w.solo.difficulty).enemyCap:LIMITS.enemies)) {
      const kind = batch.kinds[0];
      const position = spawnPoint(w, batch, kind);
      if (!position) break;
      const enemy = spawn(w, kind, position.x, position.z);
      if (!enemy) break;
      // The normal cave spawn chooses a junction. This position was checked
      // against the same collision geometry and keeps the promised head vicinity.
      enemy.x = position.x;
      enemy.z = position.z;
      enemy.y = groundHeight(position.x,position.z,mapFor(w).blocks) + ENEMIES[kind].cruise;
      enemy.foundrySource = batch.source;
      batch.kinds.shift();
      w.foundrySpawned = (w.foundrySpawned ?? 0) + 1;
    }
  }
  w.foundrySpawns = (w.foundrySpawns ?? []).filter(
    (batch) => (batch.kinds?.length ?? batch.parts.length) > 0,
  );
}
