import { expect, it } from "vitest";
import { stats } from "../src/shared/defs";
import { pilot } from "./bot";
import {
  chooseFrontUpgrade,
  createFrontRun,
  rerollFrontRunOffer,
  stepFrontRun,
} from "../src/shared/front-run";
import {
  canRerollFrontUpgrade,
  type FrontUpgradeId,
} from "../src/shared/front-upgrades";

const initialEight = [
  "blast-core",
  "armor-piercer",
  "afterimage-mine",
  "interceptor",
  "reload",
  "magazine",
  "armor",
  "magnet",
] as const;
const pairs = [
  ["afterimage-mine", "interceptor"],
  ["reload", "magazine"],
] as const;
const fusions = ["fusion-counter", "fusion-magazine"] as const;

it.each([7, 47, 814])(
  "5分の通常Input操作計測 seed=%i",
  (seed) => {
    const run = createFrontRun({
      runId: `survival-measure-${seed}`,
      seed,
      fusion: true,
      survivalBuildVersion: 1,
      players: [{ id: "solo", pool: initialEight, rerolls: 1 }],
    });
    const p = run.world.players[0];
    let ticks = 0;
    let now = 0;
    let firstFusion: number | null = null;
    let hpLost = 0;
    let lastOfferId = "";
    let selections = 0;
    const milestones: {
      minute: number;
      picks: number;
      xp: number;
      enemies: number;
      hp: number;
    }[] = [];
    while (run.world.time < 300 && run.phase !== "defeat" && ticks < 10000) {
      if (run.phase === "selection") {
        const state = run.upgrades.solo;
        const offer = state.offer!;
        if (offer.id !== lastOfferId) lastOfferId = offer.id;
        const target =
          pairs.find((pair) => pair.includes(state.initialCardId as never)) ??
          pairs[0];
        const priority = (id: FrontUpgradeId) => {
          if (fusions.includes(id as (typeof fusions)[number])) return 100;
          if (target.includes(id as (typeof target)[number]))
            return state.levels[id] > 0
              ? 60 - state.levels[id]
              : target.some((part) => state.levels[part] > 0)
                ? 55
                : 50;
          return state.levels[id] > 0 ? 20 : 10;
        };
        if (
          offer.kind === "additional" &&
          !offer.cardIds.some((id) => priority(id) >= 50) &&
          canRerollFrontUpgrade(state)
        ) {
          expect(
            rerollFrontRunOffer(
              run,
              "solo",
              {
                runId: run.world.run,
                offerId: offer.id,
                revision: offer.revision,
                requestId: `reroll-${selections}`,
              },
              now,
            ),
          ).toBe(true);
          now += 0.05;
          continue;
        }
        const cardId = [...offer.cardIds].sort(
          (a, b) => priority(b) - priority(a),
        )[0];
        expect(
          chooseFrontUpgrade(
            run,
            "solo",
            {
              runId: run.world.run,
              offerId: offer.id,
              revision: offer.revision,
              requestId: `choose-${selections++}`,
              cardId,
            },
            now,
          ),
        ).toBe(true);
        if (
          firstFusion === null &&
          fusions.some((id) => run.upgrades.solo.levels[id] > 0)
        )
          firstFusion = run.world.time;
        now += 0.05;
        continue;
      }
      const before = p.hp;
      const input = pilot(run.world, p.id);
      const orb = [...run.world.front!.orbs].sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
      )[0];
      const nearestEnemy = Math.min(
        Infinity,
        ...run.world.enemies
          .filter((enemy) => enemy.hp > 0)
          .map((enemy) => Math.hypot(enemy.x - p.x, enemy.z - p.z)),
      );
      if (
        process.env.SWARM_MEASURE_ORBS !== "0" &&
        orb &&
        Math.hypot(orb.x - p.x, orb.z - p.z) > 4 &&
        Math.hypot(orb.x - p.x, orb.z - p.z) < 18 &&
        nearestEnemy > 10
      ) {
        const dx = orb.x - p.x;
        const dz = orb.z - p.z;
        const length = Math.hypot(dx, dz);
        const vx = dx / length;
        const vz = dz / length;
        input.mx = vx * Math.cos(input.yaw) + vz * Math.sin(input.yaw);
        input.mz = vx * Math.sin(input.yaw) - vz * Math.cos(input.yaw);
      }
      input.reload =
        p.ammo[p.slot] <= Math.ceil(stats(p.weapons[p.slot]).mag * 0.15);
      stepFrontRun(run, { [p.id]: input }, 0.05, now);
      hpLost += Math.max(0, before - p.hp);
      ticks++;
      now += 0.05;
      const minute = [1, 3, 5][milestones.length];
      if (minute && run.world.time >= minute * 60)
        milestones.push({
          minute,
          picks: run.upgrades.solo.picks,
          xp: run.world.front!.xp,
          enemies: run.world.enemies.length,
          hp: Math.round(p.hp),
        });
    }
    const record = {
      seed,
      phase: run.phase,
      combatTime: Number(run.world.time.toFixed(1)),
      firstXpAt: run.metrics.thresholdReachedAt[0],
      picks: run.upgrades.solo.picks,
      firstFusion,
      maxEnemies: run.metrics.maxEnemies,
      kills: p.kills,
      collectedXp: run.world.front!.xp,
      uncollectedXp: run.world.front!.orbs.reduce(
        (sum, orb) => sum + orb.value,
        0,
      ),
      hpLost: Math.round(hpLost),
      hp: Math.round(p.hp),
      deathAt:
        run.phase === "defeat" ? Number(run.world.time.toFixed(1)) : null,
      milestones,
      levels: Object.fromEntries(
        Object.entries(run.upgrades.solo.levels).filter(
          ([, level]) => level > 0,
        ),
      ),
    };
    console.info(
      "survival-input-measure (scripted pilot, not human play)",
      JSON.stringify(record),
    );
    expect(record.combatTime).toBeGreaterThan(0);
    expect(record.picks).toBeGreaterThanOrEqual(1);
  },
  60000,
);
