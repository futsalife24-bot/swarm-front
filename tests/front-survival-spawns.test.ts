import { describe, expect, it } from "vitest";
import {
  createFrontRun,
  getFrontRunView,
  stepFrontRun,
} from "../src/shared/front-run";
import { blocked } from "../src/shared/game";
import { mapFor } from "../src/shared/stages";
import { prepareState } from "../src/shared/state-wire";
import { denseWireFixture } from "../scripts/state-wire-fixture";

function make(seed = 1234, count = 1) {
  const run = createFrontRun({
    runId: "wave-test",
    seed,
    mode: "survival",
    fusion: true,
    players: Array.from({ length: count }, (_, i) => ({ id: `p${i}` })),
  });
  run.phase = "combat";
  run.bastionAt = 1e9;
  return run;
}
function tick(run: ReturnType<typeof make>, time: number) {
  run.world.time = time;
  stepFrontRun(run, {}, 0.05, time);
}

describe("survival randomized spawning", () => {
  it("uses varied, reproducible safe positions instead of fixed ingress points", () => {
    const points = Array.from({ length: 30 }, (_, seed) => {
      const run = make(seed, 4);
      tick(run, 1);
      expect(run.pendingSpawns).toHaveLength(1);
      const pending = run.pendingSpawns[0];
      for (const [index] of pending.kinds.entries()) {
        const x = pending.x + index * 2.7;
        expect(Math.abs(x)).toBeLessThan(46);
        expect(Math.abs(pending.z)).toBeLessThan(46);
        expect(blocked(x, pending.z, 1, 0, mapFor(run.world).blocks)).toBe(
          false,
        );
        for (const p of run.world.players)
          expect(Math.hypot(x - p.x, pending.z - p.z)).toBeGreaterThanOrEqual(
            16,
          );
      }
      return [pending.x, pending.z];
    });
    expect(
      new Set(points.map((p) => p.map((x) => x.toFixed(2)).join(","))).size,
    ).toBeGreaterThan(25);
    const a = make(17),
      b = make(17);
    tick(a, 1);
    tick(b, 1);
    expect(a.pendingSpawns).toEqual(b.pendingSpawns);
  });

  it("alternates an outer ring at two minutes and a concentrated wave at four", () => {
    const ring = make();
    ring.nextSpawnAt = Infinity;
    tick(ring, 120);
    expect(ring.survivalWaveIndex).toBe(1);
    expect(ring.pendingSpawns.length).toBeGreaterThanOrEqual(20);
    const p = ring.world.players[0];
    const angles = new Set(
      ring.pendingSpawns.map((s) =>
        Math.floor(
          ((Math.atan2(s.z - p.z, s.x - p.x) + Math.PI) / (2 * Math.PI)) * 8,
        ),
      ),
    );
    expect(angles.size).toBeGreaterThanOrEqual(7);
    for (const s of ring.pendingSpawns)
      expect(Math.hypot(s.x - p.x, s.z - p.z)).toBeGreaterThanOrEqual(16);
    const warned = ring.pendingSpawns.length;
    ring.phase = "combat";
    tick(ring, 121.6);
    expect(ring.world.enemies.length).toBe(warned);
    const cluster = make();
    cluster.nextSpawnAt = Infinity;
    cluster.survivalWaveIndex = 1;
    tick(cluster, 240);
    expect(cluster.survivalWaveIndex).toBe(2);
    expect(cluster.pendingSpawns.length).toBeGreaterThanOrEqual(16);
    const xs = cluster.pendingSpawns.map((s) => s.x),
      zs = cluster.pendingSpawns.map((s) => s.z);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(16);
    expect(Math.max(...zs) - Math.min(...zs)).toBeLessThanOrEqual(16);
    const before = cluster.pendingSpawns.length;
    tick(cluster, 240.1);
    expect(cluster.pendingSpawns.length).toBe(before);
  });

  it("waits for capacity, never exceeds the cap, and resumes from saved state", () => {
    const run = make();
    run.nextSpawnAt = Infinity;
    run.pendingSpawns = Array.from({ length: 90 }, (_, i) => ({
      x: i,
      z: 0,
      at: 1000,
      kinds: ["crawler" as const],
    }));
    tick(run, 120);
    expect(run.pendingSpawns).toHaveLength(90);
    expect(run.survivalWaveIndex).toBe(0);
    run.pendingSpawns = [];
    run.phase = "combat";
    const restored = JSON.parse(JSON.stringify(run)) as typeof run;
    // JSON cannot represent Infinity, so restore the test-only scheduler setting.
    restored.nextSpawnAt = Infinity;
    tick(run, 121.1);
    tick(restored, 121.1);
    expect(run.survivalWaveIndex).toBe(1);
    expect(run.pendingSpawns).toEqual(restored.pendingSpawns);
    expect(run.pendingSpawns.length).toBeLessThanOrEqual(
      run.world.front!.enemyCap!,
    );
    expect(run.pendingSpawns.length).toBeGreaterThanOrEqual(8);
  });

  it("does not replay old events for a saved run without the new fields", () => {
    const run = make();
    delete run.survivalWaveIndex;
    delete run.survivalSpawnSeed;
    run.nextSpawnAt = Infinity;
    tick(run, 311);
    expect(run.survivalWaveIndex).toBe(2);
    expect(run.pendingSpawns).toHaveLength(0);
  });

  it("keeps edge waves and all normal spawns away from every connected teammate", () => {
    for (const [x, z] of [
      [40, 40],
      [-40, -40],
      [40, -40],
      [-40, 40],
    ]) {
      const run = make(19, 2);
      Object.assign(run.world.players[0], { x, z });
      Object.assign(run.world.players[1], {
        x: x - Math.sign(x) * 8,
        z: z - Math.sign(z) * 8,
      });
      run.nextSpawnAt = Infinity;
      tick(run, 120);
      expect(run.pendingSpawns.length).toBeGreaterThanOrEqual(8);
      for (const spawn of run.pendingSpawns) {
        expect(Math.abs(spawn.x)).toBeLessThan(46);
        expect(Math.abs(spawn.z)).toBeLessThan(46);
        for (const player of run.world.players)
          expect(
            Math.hypot(spawn.x - player.x, spawn.z - player.z),
          ).toBeGreaterThanOrEqual(16);
      }
    }
  });

  it("keeps all wave warnings within the dense four-player state packet limit", () => {
    const run = make();
    run.nextSpawnAt = Infinity;
    tick(run, 120);
    const warnings = getFrontRunView(run, "p0").spawnWarnings;
    expect(warnings).toHaveLength(24);
    const { w, ids, metadata } = denseWireFixture();
    w.enemies.length = 72;
    const payload = prepareState(w, 0, metadata).packet(ids[0], false, -1, {
      frontView: { spawnWarnings: warnings },
    });
    expect(new TextEncoder().encode(payload).length).toBeLessThanOrEqual(65536);
    expect(JSON.parse(payload).frontView.spawnWarnings).toHaveLength(24);
  });
});
