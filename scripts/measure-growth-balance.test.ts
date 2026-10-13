import { it, expect } from "vitest";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { STARTERS } from "../src/shared/defs";
import {
  createWorld,
  addPlayer,
  start,
  step,
  validInput,
  angle,
} from "../src/shared/game";
import { clampPitch } from "../src/shared/aim";
import {
  createFrontRun,
  chooseFrontUpgrade,
  stepFrontRun,
} from "../src/shared/front-run";
import { pilot } from "../tests/bot";

// A repeatable input-only pilot comparison, not an estimate of human win rates.
it("measures progression and party size with legal inputs", () => {
  const rows: unknown[] = [];
  const seconds = Number(process.env.BALANCE_SECONDS ?? 180);
  const counts = (process.env.BALANCE_COUNTS ?? "1,2,3,4")
    .split(",")
    .map(Number);
  const output = `docs/evidence/growth-balance-20261014/${process.env.BALANCE_LABEL ?? "measurement"}`;
  mkdirSync("docs/evidence/growth-balance-20261014", { recursive: true });
  writeFileSync(`${output}.progress.jsonl`, "");
  const modes = (process.env.BALANCE_MODES ?? "survival,advance").split(
    ",",
  ) as ("survival" | "advance")[];
  const stages = (process.env.BALANCE_STAGES ?? "0,10,25")
    .split(",")
    .map(Number);
  const seeds = (process.env.BALANCE_SEEDS ?? "814,723").split(",").map(Number);
  for (const mode of modes)
    for (const stage of stages)
      for (const count of counts)
        for (const seed of seeds) {
          const players = Array.from({ length: count }, (_, n) => ({
            id: `p${n}`,
            equipment: STARTERS.slice(0, 2).map((w, i) => ({
              ...w,
              id: `p${n}-w${i}`,
              level: 1 + stage,
            })),
          }));
          const run =
            mode === "survival"
              ? createFrontRun({
                  runId: `balance-${mode}-${stage}-${count}-${seed}`,
                  seed,
                  mode: "survival",
                  fusion: true,
                  clearedStage: stage,
                  players,
                })
              : undefined;
          const world =
            run?.world ??
            createWorld(
              `balance-advance-${stage}-${count}-${seed}`,
              seed,
              Math.max(1, stage),
            );
          if (!run) {
            for (const p of players) addPlayer(world, p.id, p.equipment);
            start(world);
          }
          let taken = 0,
            maxEnemies = 0,
            ticks = 0,
            selections = 0;
          const spawned = new Set<number>();
          while (
            world.phase === "battle" &&
            world.time < seconds &&
            ticks < (seconds + 120) * 20
          ) {
            const now = ++ticks / 20;
            if (run?.phase === "selection") {
              for (const player of players) {
                const offer = run.upgrades[player.id].offer;
                if (offer) {
                  expect(
                    chooseFrontUpgrade(
                      run,
                      player.id,
                      {
                        runId: world.run,
                        offerId: offer.id,
                        revision: offer.revision,
                        requestId: `balance-${++selections}`,
                        cardId: offer.defaultCardId,
                      },
                      now,
                    ),
                  ).toBe(true);
                }
              }
            }
            const hp = world.players.map((p) => p.hp);
            const inputs = Object.fromEntries(
              world.players
                .filter((p) => p.hp > 0)
                .map((p) => {
                  const input = pilot(world, p.id);
                  input.yaw = angle(input.yaw);
                  input.pitch = clampPitch(input.pitch);
                  expect(validInput(input)).toBe(true);
                  return [p.id, input];
                }),
            );
            world.events = [];
            if (run) stepFrontRun(run, inputs, 0.05, now);
            else step(world, inputs, 0.05);
            world.players.forEach((p, i) => {
              taken += Math.max(0, hp[i] - p.hp);
            });
            world.enemies.forEach((e) => spawned.add(e.id));
            maxEnemies = Math.max(maxEnemies, world.enemies.length);
          }
          const row = {
            mode,
            stage,
            count,
            seed,
            seconds: +world.time.toFixed(2),
            result: world.phase,
            kills: world.players.reduce((n, p) => n + p.kills, 0),
            playerKills: world.players.map((p) => p.kills),
            hp: world.players.map((p) => +p.hp.toFixed(2)),
            taken: +taken.toFixed(2),
            spawned: spawned.size,
            maxEnemies,
            scale: world.scale,
            selections,
          };
          rows.push(row);
          appendFileSync(
            `${output}.progress.jsonl`,
            JSON.stringify(row) + "\n",
          );
        }
  expect(rows).toHaveLength(
    modes.length * stages.length * counts.length * seeds.length,
  );
  writeFileSync(
    `${output}.json`,
    JSON.stringify({ seconds, rows }, null, 2) + "\n",
  );
}, 900000);
