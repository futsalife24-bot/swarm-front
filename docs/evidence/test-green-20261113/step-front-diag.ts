// 前線シナリオを tests/game-step-equivalence.test.ts と同じ手順で進め、
// tick ごとの SHA-256 と指定 tick の状態を書き出す診断。
import { createHash } from "node:crypto";
import fs from "node:fs";
import {
  chooseFrontUpgrade,
  createFrontRun,
  stepFrontRun,
  type FrontMode,
} from "./src/shared/front-run";
import {
  eye,
  neutral,
  retireEvents,
  type Enemy,
  type Input,
  type Player,
  type World,
} from "./src/shared/game";

const DT = 0.05;
function flatten(value: unknown, path: string, out: Map<string, string>) {
  const ancestors: unknown[] = [];
  const walk = (v: unknown, p: string) => {
    if (v === undefined) return void out.set(p, "undefined");
    if (v === null) return void out.set(p, "null");
    if (typeof v === "number")
      return void out.set(p, Object.is(v, -0) ? "-0" : String(v));
    if (typeof v !== "object") return void out.set(p, JSON.stringify(v));
    if (ancestors.includes(v)) return void out.set(p, "^cycle");
    ancestors.push(v);
    const entries = (
      Array.isArray(v)
        ? v.map((item, i) => [String(i), item] as const)
        : Object.entries(v)
    ).filter(([k]) => !(process.env.IGNORE_KEYS ?? "").split(",").includes(k));
    out.set(p + ".#keys", entries.map(([k]) => k).join(","));
    for (const [k, item] of entries) walk(item, `${p}.${k}`);
    ancestors.pop();
  };
  walk(value, path);
  return out;
}
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pilot(seed: number, s: { rescue?: boolean; cameraAim?: boolean } = {}) {
  const rand = mulberry32(seed);
  let seq = 0,
    mx = 0,
    mz = 0;
  return (w: World, p: Player, tick: number): Input => {
    if (tick % 16 === 0) {
      mx = Math.floor(rand() * 3) - 1;
      mz = Math.floor(rand() * 3) - 1;
    }
    const input: Input = {
      ...neutral(),
      seq: ++seq,
      mx,
      mz,
      cameraAim: s.cameraAim,
      buddyCharge: tick % 200 >= 150 && tick % 200 < 180,
      buddySkill: tick % 200 === 60 || tick % 200 === 181,
    };
    const fallen = s.rescue
      ? w.players.find((o) => o !== p && o.connected && o.hp <= 0 && o.down > 0)
      : undefined;
    if (fallen && p.hp > 0) {
      const dx = fallen.x - p.x,
        dz = fallen.z - p.z,
        far = Math.hypot(dx, dz) > 2;
      return {
        ...input,
        mx: far ? Math.sign(dx) : 0,
        mz: far ? -Math.sign(dz) : 0,
        revive: true,
      };
    }
    const target = w.enemies
      .filter((e) => e.hp > 0)
      .reduce<Enemy | undefined>(
        (best, e) =>
          !best ||
          Math.hypot(e.x - p.x, e.z - p.z) <
            Math.hypot(best.x - p.x, best.z - p.z)
            ? e
            : best,
        undefined,
      );
    if (target) {
      const d = Math.hypot(target.x - p.x, target.z - p.z);
      input.yaw =
        Math.atan2(target.x - p.x, -(target.z - p.z)) + (rand() - 0.5) * 0.08;
      input.pitch =
        Math.atan2(eye(target) - ((p.y ?? 0) + 1.5), d) + (rand() - 0.5) * 0.04;
    } else {
      input.yaw = rand() * Math.PI * 2 - Math.PI;
      input.pitch = (rand() - 0.5) * 0.6;
    }
    const roll = rand();
    input.fire = roll < 0.85;
    input.reload = roll > 0.985;
    input.swap = rand() < 0.02;
    input.dodge = rand() < 0.03;
    input.jump = rand() < 0.08;
    input.revive = rand() < 0.2;
    return input;
  };
}
const sustain = (w: World, tick: number) => {
  if (tick % 20 === 0)
    for (const p of w.players) if (p.hp > 0) p.hp = Math.max(p.hp, 160);
};
function frontRun(
  seed: number,
  ids: string[],
  ticks: number,
  options: { fusion?: true; mode?: FrontMode; day?: string },
  dumpTick: number,
) {
  let run = createFrontRun({
    runId: `golden-front-${seed}`,
    seed,
    ...options,
    players: ids.map((id) => ({ id })),
  });
  const pilots = new Map(
    ids.map((id, index) => [id, pilot(seed * 31 + index, { rescue: true })]),
  );
  let request = 0;
  const total = createHash("sha256");
  const perTick: string[] = [];
  let dump: Record<string, string> | undefined;
  for (let tick = 0; tick < ticks; tick++) {
    const now = tick * DT;
    for (let guard = 0; run.phase === "selection" && guard < 32; guard++)
      for (const id of ids) {
        const offer = run.upgrades[id]?.offer;
        if (offer)
          chooseFrontUpgrade(
            run,
            id,
            {
              runId: run.world.run,
              offerId: offer.id,
              revision: offer.revision,
              requestId: `golden-${++request}`,
              cardId: offer.defaultCardId,
            },
            now,
          );
      }
    const w = run.world;
    sustain(w, tick);
    run = stepFrontRun(
      run,
      Object.fromEntries(
        w.players.map((p) => [p.id, pilots.get(p.id)!(w, p, tick)]),
      ),
      DT,
      now,
    );
    const flat = flatten(run, "$", new Map());
    const text = [...flat].map(([k, v]) => `${k}=${v}`).join("\n");
    perTick.push(createHash("sha256").update(text).digest("hex"));
    total.update(text);
    if (tick === dumpTick) dump = Object.fromEntries(flat);
    retireEvents(run.world, run.world.eventSerial);
  }
  return { perTick, total: total.digest("hex"), dump };
}
const scenarios: Record<
  string,
  [number, string[], number, { fusion?: true; mode?: FrontMode; day?: string }]
> = {
  survival1: [501, ["p0"], 1500, { fusion: true }],
  survival2: [502, ["p0", "p1"], 1000, { fusion: true }],
  defense: [503, ["p0"], 800, { fusion: true, mode: "defense" }],
  daily: [504, ["p0", "p1"], 1000, { fusion: true, mode: "daily", day: "2026-09-20" }],
  legacy: [505, ["p0"], 1000, {}],
};
const [name, out, dumpTick] = process.argv.slice(2);
const [seed, ids, ticks, options] = scenarios[name];
const first = frontRun(seed, ids, ticks, options, Number(dumpTick ?? -1));
const second = frontRun(seed, ids, ticks, options, -1);
fs.writeFileSync(
  out,
  JSON.stringify({
    name,
    total: first.total,
    repeatSame: first.total === second.total,
    perTick: first.perTick,
    dump: first.dump,
  }),
);
console.log(name, first.total.slice(0, 16), "repeatSame", first.total === second.total);
