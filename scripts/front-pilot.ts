/** 固定入力方針による計測。実機性能・人間の楽しさや勝率の証拠にはしない。 */
import {
  createFrontRun,
  chooseFrontUpgrade,
  stepFrontRun,
  type FrontMode,
} from "../src/shared/front-run";
import { neutral, eye, retireEvents } from "../src/shared/game";
import {
  FRONT_FAMILY_CARDS,
  FRONT_EVOLUTION_RECIPES,
  type FrontFamily,
  type FrontUpgradeId,
} from "../src/shared/front-upgrades";

const results = [];
for (const mode of ["survival", "defense", "daily"] as FrontMode[]) {
  for (const family of [
    "explosion",
    "piercing",
    "interception",
  ] as FrontFamily[]) {
    const run = createFrontRun(
      {
        runId: `pilot-${mode}-${family}`,
        seed: 4520,
        day: "2026-10-02",
        mode,
        players: [{ id: "pilot", weapons: ["rifle", "shotgun"] }],
      },
      0,
    );
    let wall = 0,
      serial = 0,
      evolvedAt: number | null = null;
    while (!["victory", "defeat"].includes(run.phase) && wall < 650) {
      wall += 0.05;
      const offer = run.upgrades.pilot.offer;
      if (offer) {
        const recipe = FRONT_EVOLUTION_RECIPES[family];
        const order = [
          recipe.main,
          recipe.support,
          ...FRONT_FAMILY_CARDS[family],
          "magnet",
          "armor",
          "reload",
        ] as FrontUpgradeId[];
        const preferred = order.find((card) => offer.cardIds.includes(card));
        chooseFrontUpgrade(
          run,
          "pilot",
          {
            runId: run.world.run,
            offerId: offer.id,
            revision: offer.revision,
            requestId: `pilot-${++serial}`,
            cardId: preferred ?? offer.defaultCardId,
          },
          wall,
        );
      }
      const w = run.world,
        p = w.players[0];
      const enemies = w.enemies
        .filter((e) => e.hp > 0)
        .sort(
          (a, b) =>
            Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
        );
      const target = enemies[0];
      const input = neutral();
      input.seq = serial++;
      if (target) {
        const dx = target.x - p.x,
          dz = target.z - p.z,
          distance = Math.hypot(dx, dz);
        input.yaw = Math.atan2(dx, -dz);
        input.pitch = Math.atan2(eye(target) - ((p.y ?? 0) + 1.5), distance);
        input.fire = true;
        if (distance < 12) {
          input.mx = -dx / Math.max(1, distance);
          input.mz = -dz / Math.max(1, distance);
        } else if (distance > 23) {
          input.mx = dx / distance;
          input.mz = dz / distance;
        } else {
          input.mx = -dz / distance;
          input.mz = dx / distance;
        }
        input.dodge = distance < 12 && p.evadeCd <= 0;
      } else {
        const orb = [...w.front!.orbs].sort(
          (a, b) =>
            Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
        )[0];
        if (orb) {
          const d = Math.max(1, Math.hypot(orb.x - p.x, orb.z - p.z));
          input.mx = (orb.x - p.x) / d;
          input.mz = (orb.z - p.z) / d;
        }
      }
      // 射撃しながら落ちた経験値を拾う。回収をしない遠距離固定入力と区別する。
      const nearestOrb = [...w.front!.orbs].sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
      )[0];
      if (
        nearestOrb &&
        (!target || Math.hypot(target.x - p.x, target.z - p.z) > 5)
      ) {
        const distance = Math.max(
          1,
          Math.hypot(nearestOrb.x - p.x, nearestOrb.z - p.z),
        );
        input.mx = (nearestOrb.x - p.x) / distance;
        input.mz = (nearestOrb.z - p.z) / distance;
      }
      input.reload = p.ammo[p.slot] === 0;
      // 入力は視点基準。上で求めた世界座標の移動方向を変換する。
      const worldX = input.mx,
        worldZ = input.mz;
      input.mx = worldX * Math.cos(input.yaw) + worldZ * Math.sin(input.yaw);
      input.mz = worldX * Math.sin(input.yaw) - worldZ * Math.cos(input.yaw);
      stepFrontRun(run, { pilot: input }, 0.05, wall);
      if (evolvedAt === null && w.front!.players.pilot.evolved.length)
        evolvedAt = w.time;
      retireEvents(w, w.events.at(-1)?.id ?? 0);
    }
    const w = run.world,
      combat = w.front!.players.pilot;
    results.push({
      mode,
      family,
      phase: run.phase,
      reason: w.reason,
      combatSeconds: Number(w.time.toFixed(2)),
      picks: run.upgrades.pilot.picks,
      evolved: combat.evolved,
      evolvedAt,
      xp: w.front!.xp,
      kills: w.players[0].kills,
      firstEffectAt: combat.firstEffectAt,
      maxChain: combat.maxChain,
      maxEnemies: run.metrics.maxEnemies,
      budgetExhaustions: w.front!.budgetExhaustions,
      thresholdReachedAt: run.metrics.thresholdReachedAt,
      selectedAt: run.metrics.selectedAt,
    });
  }
}
console.log(
  JSON.stringify(
    {
      date: "2026-10-05",
      seed: 4520,
      policy:
        "進化の主力・補助を優先。近い敵を狙い、敵が5m以内でなければ最寄り経験値へ移動。空弾倉時装填・近距離回避。改変HP/XP/勝利状態なし。障害物迂回や高度な戦術なし。",
      limits:
        "3モード×3系統の各1回。固定方針の計測であり、人間の楽しさ・勝率・実機性能の判定ではない。",
      results,
    },
    null,
    2,
  ),
);
