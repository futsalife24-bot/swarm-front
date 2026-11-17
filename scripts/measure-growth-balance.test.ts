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
import { normalSaveId } from "../src/shared/campaign";
import { initSolo } from "../src/shared/solo-progression";
import { rollWeapon } from "../src/shared/progression";

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

it.skipIf(process.env.BALANCE_DROP_COMPARISON !== "1")(
  "compares old stage-level and new level-one campaign combat",
  () => {
    const rows: {
      stage: number;
      difficulty: string;
      level: number;
      seed: number;
      seconds: number;
      result: string;
      kills: number;
    }[] = [];
    const seeds = (process.env.BALANCE_SEEDS ?? "814,723,331,902")
      .split(",")
      .map(Number);
    for (const stage of [12, 25])
      for (const difficulty of ["normal", "medium"] as const)
        for (const seed of seeds)
          for (const level of [stage, 1]) {
            const id = normalSaveId(stage);
            let equipmentSeed = seed;
            const rng = () =>
              (equipmentSeed =
                (Math.imul(equipmentSeed, 1664525) + 1013904223) >>> 0) /
              4294967296;
            const equipment = [0, 1].map((index) => ({
              ...rollWeapon(
                `balance-${stage}-${difficulty}-${seed}-${index}`,
                id,
                difficulty,
                false,
                index,
                rng,
                "solo",
              ),
              level,
            }));
            const world = createWorld(
              `drop-balance-${stage}-${difficulty}-${seed}-${level}`,
              seed,
              id,
            );
            initSolo(world, id, difficulty, false, {
              hp: 5,
              aim: 5,
              move: 5,
              swap: 5,
            });
            addPlayer(world, "solo", equipment);
            start(world);
            const limit = 600;
            let ticks = 0;
            while (
              world.phase === "battle" &&
              world.time < limit &&
              ticks++ < limit * 20
            ) {
              const input = pilot(world, "solo");
              input.yaw = angle(input.yaw);
              input.pitch = clampPitch(input.pitch);
              expect(validInput(input)).toBe(true);
              step(world, { solo: input }, 0.05);
            }
            rows.push({
              stage,
              difficulty,
              level,
              seed,
              seconds: +world.time.toFixed(2),
              result: world.phase,
              kills: world.totalKills,
            });
          }
    const summary = [12, 25].flatMap((stage) =>
      (["normal", "medium"] as const).flatMap((difficulty) =>
        [stage, 1].map((level) => {
          const part = rows.filter(
            (row) =>
              row.stage === stage &&
              row.difficulty === difficulty &&
              row.level === level,
          );
          return {
            stage,
            difficulty,
            level,
            meanSeconds: +(
              part.reduce((sum, row) => sum + row.seconds, 0) / part.length
            ).toFixed(2),
            defeatRate:
              part.filter((row) => row.result !== "victory").length /
              part.length,
          };
        }),
      ),
    );
    mkdirSync("docs/evidence/gacha-balance-20261117", { recursive: true });
    writeFileSync(
      "docs/evidence/gacha-balance-20261117/combat-level-comparison.json",
      JSON.stringify(
        {
          methodology:
            "Deterministic input bot; not human win rates. Same rolled weapons and seeds in each old/new pair; levels 5 skills; 600-second cap. Timeout counts as nonvictory.",
          rows,
          summary,
        },
        null,
        2,
      ) + "\n",
    );
    expect(rows).toHaveLength(seeds.length * 8);
  },
  900000,
);
