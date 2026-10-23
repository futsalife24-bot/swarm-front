import { it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { WEAPONS, stats, type Kind } from "../src/shared/defs";
import { makeWeapon } from "../src/shared/progression";
import {
  addPlayer,
  createWorld,
  start,
  step,
  spawn,
  neutral,
  eye,
  angle,
  validInput,
  visible,
  type World,
} from "../src/shared/game";
import { initSolo } from "../src/shared/solo-progression";
import { clampPitch } from "../src/shared/aim";
import {
  createFrontRun,
  chooseFrontUpgrade,
  stepFrontRun,
  type FrontRun,
} from "../src/shared/front-run";
import { pilot } from "../tests/bot";
import { mapFor } from "../src/shared/stages";

// 現行値のみを測る。段階2の候補値変更や新仕様の期待値は持ち込まない。
const kinds: Kind[] = [
  "rifle",
  "smg",
  "shotgun",
  "slug",
  "rocket",
  "heavy",
  "sniper",
  "grenade",
  "sticky",
  "laser",
  "kick",
];
const sortieKinds: Kind[] = [
  "rifle",
  "smg",
  "shotgun",
  "rocket",
  "sniper",
  "laser",
];
const seeds = [814, 723];
const DT = 0.05;
const out = "dist-validation/play-polish-20261022/weapons";

function equipment(kind: Kind, id: string) {
  return [kind, "rifle" as const].map((k, i) => ({
    ...makeWeapon(
      `${id}-${i}`,
      k,
      0,
      { power: 0, reload: 0, range: 0, rate: 0 },
      false,
      i,
    ),
    level: 1,
  }));
}
function metrics() {
  return {
    shotEvents: 0,
    manualHitEvents: 0,
    directDamageRounded: 0,
    secondaryDamageRounded: 0,
    netDamageTaken: 0,
    reloadTicks: 0,
    rangeApproachTicks: 0,
    outOfRangeFireTicks: 0,
  };
}
function record(
  w: World,
  rows: Record<string, ReturnType<typeof metrics>>,
  hp: number[],
) {
  w.players.forEach((p, i) => {
    rows[p.id].netDamageTaken += Math.max(0, hp[i] - p.hp);
    if (p.reload > 0) rows[p.id].reloadTicks++;
  });
  for (const e of w.events) {
    const r = e.owner && rows[e.owner];
    if (!r) continue;
    if (e.type === "shot" && !e.frontEffect) r.shotEvents++;
    if (e.type === "hit") {
      if (e.weapon) {
        r.manualHitEvents++;
        r.directDamageRounded += e.amount ?? 0;
      } else r.secondaryDamageRounded += e.amount ?? 0;
    }
  }
}
// 単体・3体を同距離の固定標的に20秒射撃。位置とHPだけを固定し実stepを通す。
function assay(kind: Kind, seed: number, targets: 1 | 3, distance: number) {
  const w = createWorld("assay", seed, 1);
  Object.assign(w, {
    phase: "battle",
    wave: 1,
    nextSpawn: 1e9,
    training: true,
  });
  const p = addPlayer(w, "p0", equipment(kind, "p0"));
  Object.assign(p, { x: 0, z: 0, y: 0, hp: 100000 });
  const enemies = Array.from({ length: targets }, (_, i) =>
    spawn(w, "ant", i === 0 ? 0 : 1.8, -distance - i * 1.2)!,
  );
  for (const e of enemies)
    Object.assign(e, { hp: 1e6, maxHp: 1e6, cool: 1e6, y: 0, active: true });
  const poses = enemies.map((e) => ({ x: e.x, y: e.y, z: e.z }));
  const data = { p0: metrics() };
  for (let t = 0; t < 400; t++) {
    enemies.forEach((e, i) =>
      Object.assign(e, poses[i], { cool: 1e6, wind: 0 }),
    );
    const hp = [p.hp];
    w.events = [];
    step(
      w,
      {
        p0: {
          ...neutral(),
          fire: true,
          pitch: Math.atan2(eye(enemies[0]) - 1.5, distance),
        },
      },
      DT,
    );
    record(w, data, hp);
  }
  return {
    type: "assay",
    kind,
    seed,
    targets,
    distance,
    seconds: w.time,
    exactHpLoss: enemies.reduce((n, e) => n + e.maxHp - e.hp, 0),
    ...data.p0,
  };
}
function choose(run: FrontRun, now: number) {
  for (const p of run.world.players)
    for (let n = 0; n < 13; n++) {
      const o = run.upgrades[p.id].offer;
      if (!o) break;
      expect(
        chooseFrontUpgrade(
          run,
          p.id,
          {
            runId: run.world.run,
            offerId: o.id,
            revision: o.revision,
            requestId: `measure-${p.id}-${o.id}-${o.revision}`,
            cardId: o.defaultCardId,
          },
          now,
        ),
      ).toBe(true);
    }
}
// 既存pilotの回避・照準を使い、全武器に同じ接近方針を適用する。
function sortie(
  kind: Kind,
  seed: number,
  count: 1 | 2,
  mode: "advance" | "survival",
) {
  const members = Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    equipment: equipment(i === 0 ? kind : "rifle", `p${i}`),
  }));
  const run =
    mode === "survival"
      ? createFrontRun({
          runId: "measure-survival",
          seed,
          fusion: true,
          mode: "survival",
          clearedStage: 0,
          players: members,
        })
      : undefined;
  const w = run?.world ?? createWorld("measure-advance", seed, 2);
  if (!run) {
    if (count === 1)
      initSolo(w, 2, "normal", false, { hp: 0, aim: 0, move: 0, swap: 0 });
    for (const m of members) addPlayer(w, m.id, m.equipment);
    start(w);
  }
  const data = Object.fromEntries(members.map((p) => [p.id, metrics()]));
  const horizon = mode === "survival" ? 90 : 180;
  for (
    let ticks = 1;
    ticks <= (horizon + 30) * 20 && w.phase === "battle" && w.time < horizon;
    ticks++
  ) {
    const now = ticks * DT;
    if (run?.phase === "selection") choose(run, now);
    const inputs = Object.fromEntries(
      w.players
        .filter((p) => p.hp > 0)
        .map((p) => {
          const input = pilot(w, p.id);
          input.swap = false;
          const target = w.enemies
            .filter((e) => e.hp > 0 && visible(p, e, mapFor(w).blocks))
            .sort(
              (a, b) =>
                Math.hypot(a.x - p.x, a.z - p.z) -
                Math.hypot(b.x - p.x, b.z - p.z),
            )[0];
          if (input.fire && target) {
            const distance = Math.hypot(target.x - p.x, target.z - p.z),
              range = stats(p.weapons[p.slot]).range;
            if (distance > range) data[p.id].outOfRangeFireTicks++;
            if (!input.dodge && distance > Math.max(14, range * 0.7)) {
              input.yaw = Math.atan2(target.x - p.x, -(target.z - p.z));
              input.pitch = Math.atan2(
                eye(target) - ((p.y ?? 0) + 1.5),
                distance,
              );
              input.mx = 0;
              input.mz = 1;
              data[p.id].rangeApproachTicks++;
            }
          }
          input.pitch = clampPitch(input.pitch);
          input.yaw = angle(input.yaw);
          if (!validInput(input))
            throw new Error(
              JSON.stringify({ kind, seed, count, mode, time: w.time, input }),
            );
          return [p.id, input];
        }),
    );
    const hp = w.players.map((p) => p.hp);
    w.events = [];
    if (run) stepFrontRun(run, inputs, DT, now);
    else step(w, inputs, DT);
    record(w, data, hp);
  }
  return {
    type: "sortie",
    kind,
    seed,
    count,
    mode,
    seconds: w.time,
    result: w.phase,
    clearTime: w.phase === "victory" ? w.time : null,
    kills: w.totalKills,
    playerKills: w.players.map((p) => p.kills),
    hp: w.players.map((p) => p.hp),
    wave: w.wave,
    players: data,
    picks: run
      ? run.metrics.selectedAt.map((s) => ({
          playerId: s.playerId,
          cardId: s.cardId,
          time: s.combatTime,
        }))
      : [],
  };
}

it("現行武器を固定条件と通常入力で再現可能に測る", () => {
  mkdirSync(out, { recursive: true });
  const rows: ReturnType<typeof assay | typeof sortie>[] = [];
  for (const kind of kinds)
    for (const seed of seeds)
      for (const targets of [1, 3] as const)
        for (const distance of [12, 30])
          rows.push(assay(kind, seed, targets, distance));
  for (const kind of sortieKinds)
    for (const seed of seeds)
      for (const count of [1, 2] as const)
        for (const mode of ["advance", "survival"] as const)
          rows.push(sortie(kind, seed, count, mode));
  const replay = sortie("rifle", seeds[0], 1, "advance");
  expect(replay).toEqual(
    rows.find(
      (r) =>
        r.type === "sortie" &&
        r.kind === "rifle" &&
        r.seed === seeds[0] &&
        r.count === 1 &&
        r.mode === "advance",
    ),
  );
  const nominal = kinds.map((kind) => {
    const s = stats(equipment(kind, "table")[0]);
    return {
      kind,
      damage: s.damage,
      interval: s.interval,
      mag: s.mag,
      reload: s.reload,
      range: s.range,
      pellets: WEAPONS[kind].pellets,
    };
  });
  writeFileSync(
    `${out}/results.json`,
    JSON.stringify(
      {
        head: "a3d8f076935620b2c264825bb3b849c544e2842f",
        seeds,
        dt: DT,
        conditions: {
          level: 1,
          rarity: 0,
          mods: {},
          effect: "none",
          assaySeconds: 20,
          assayEnemy: "ant, frozen position and attack, enlarged HP",
          advanceStage: 2,
          advanceHorizon: 180,
          survivalClearedStage: 0,
          survivalHorizon: 90,
          coopPartner: "rifle",
          pilot:
            "tests/bot pilot; weapon slot fixed; approach visible target beyond max(14m, 70% of weapon range); dodge priority",
          upgradeChoice: "actual default offered card",
        },
        nominal,
        rows,
        replay: true,
        caveats: [
          "assay is artificial and separate from moving sorties",
          "hit events per shot is not hit probability for pellets/piercing/explosions",
          "two seeds and early slices do not estimate general win rate",
          "no human, four player, late game, or all rarity/roll coverage",
          "medic is support equipment and excluded from damage comparison",
        ],
      },
      null,
      2,
    ) + "\n",
  );
}, 900000);
