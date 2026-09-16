import { it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  createWorld,
  addPlayer,
  start,
  spawn,
  step,
  neutral,
} from "../src/shared/game";

it("measures the authoritative three-player simulation without changing combat", () => {
  const timings: number[] = [];
  const outcomes: unknown[] = [];
  for (let repeat = 0; repeat < 6; repeat++) {
    const w = createWorld("perf", 314);
    for (let i = 0; i < 3; i++) addPlayer(w, `p${i}`);
    start(w);
    w.nextSpawn = 1e9;
    w.enemies = [];
    for (let n = 0; n < 40; n++)
      spawn(
        w,
        n % 3 ? "crawler" : "spitter",
        ((n % 8) - 4) * 2,
        -15 - Math.floor(n / 8) * 3,
      );
    const inputs = Object.fromEntries(
      w.players.map((p) => [p.id, { ...neutral(), fire: true }]),
    );
    for (let n = 0; n < 300; n++) {
      const before = performance.now();
      step(w, inputs);
      if (repeat > 0) timings.push(performance.now() - before);
    }
    outcomes.push({
      time: w.time,
      kills: w.totalKills,
      players: w.players.map((p) => ({ hp: p.hp, ammo: p.ammo })),
      enemies: w.enemies.map((e) => ({ id: e.id, hp: e.hp, x: e.x, z: e.z })),
    });
  }
  expect(
    outcomes.every((o) => JSON.stringify(o) === JSON.stringify(outcomes[0])),
  ).toBe(true);
  timings.sort((a, b) => a - b);
  const result = {
    median: timings[Math.floor(timings.length * 0.5)],
    p95: timings[Math.floor(timings.length * 0.95)],
    samples: timings.length,
    outcome: outcomes[0],
  };
  const label = process.env.PERF_LABEL;
  if (label && /^[a-z0-9-]+$/.test(label)) {
    const dir = `dist-validation/coop-performance/${label}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/simulation.json`, JSON.stringify(result, null, 2));
  }
  console.log(
    JSON.stringify({
      simulationMedianMs: result.median,
      simulationP95Ms: result.p95,
    }),
  );
});
