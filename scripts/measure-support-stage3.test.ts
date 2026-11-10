// 人工条件による配分の経済上限検証。自然な攻略・放置率の測定ではない。
import { it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import type { World } from "../src/shared/game";
import {
  createSupportRewards,
  supportRewardAllocation,
} from "../src/shared/front-support-rewards";
import { frontSurvivalRewardCount } from "../src/shared/front-survival";

it("参加条件を明示した合成12000条件の経済結果を保存する", () => {
  let seed = 20261020;
  const rand = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const rows: unknown[] = [];
  for (const n of [2, 3, 4])
    for (const model of ["full-participation", "partial-afk-forfeit"]) {
      let previous = 0,
        next = 0,
        zeroKillPrevious = 0,
        zeroKillNext = 0,
        qualifying = 0,
        capped = 0;
      for (let i = 0; i < 2000; i++) {
        const time = 60 + Math.floor(rand() * 3541);
        const players = Array.from({ length: n }, (_, p) => ({
          id: `p${p}`,
          kills: p % 2 ? 0 : Math.floor(rand() * 900),
        }));
        const w = { time, run: `synthetic-${n}-${i}`, players } as World;
        const s = createSupportRewards(
          players.map((p) => p.id),
          0,
        );
        const allowed = players
          .filter(() => model === "full-participation" || rand() > 0.15)
          .map((p) => p.id);
        for (const p of players) {
          const present = model === "full-participation" ? time : rand() * time;
          const active =
            model === "full-participation" ? present : rand() * present;
          s.players[p.id] = {
            present,
            active,
            presentAt: present,
            actionAt:
              model === "full-participation"
                ? present
                : Math.max(0, present - rand() * 120),
          };
        }
        const result = supportRewardAllocation(w, s, allowed);
        const old = players.reduce(
          (sum, p) =>
            sum +
            (allowed.includes(p.id)
              ? frontSurvivalRewardCount(time, p.kills)
              : 0),
          0,
        );
        const total = Object.values(result.counts).reduce((a, b) => a + b, 0);
        expect(total).toBeLessThanOrEqual(old);
        previous += old;
        next += total;
        for (const p of players) {
          qualifying += Number(result.eligible[p.id]);
          capped += Number(result.counts[p.id] === 30);
          if (p.kills === 0) {
            zeroKillNext += result.counts[p.id];
            zeroKillPrevious += 0;
          }
        }
      }
      rows.push({
        players: n,
        model,
        samples: 2000,
        previous,
        next,
        delta: next - previous,
        zeroKillPrevious,
        zeroKillNext,
        qualifying,
        capped,
      });
    }
  mkdirSync("docs/evidence/support-resume-20261110", { recursive: true });
  writeFileSync(
    "docs/evidence/support-resume-20261110/economy-synthetic.json",
    JSON.stringify(
      { seed: 20261020, artificial: true, count: 12000, rows },
      null,
      2,
    ) + "\n",
  );
});
