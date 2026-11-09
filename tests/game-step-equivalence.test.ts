// step() の挙動を固定する特性テスト。
// 同一 seed・同一入力で進めた World（改装版は run 全体）を毎 tick 直列化して
// SHA-256 に畳み込み、分割前の step で採取したスナップショットと照合する。
// 挙動を変えない整理（関数分割など）は、スナップショットを更新せずに通ること。
// 数値・判定順・乱数消費順を意図して変えた場合だけ
//   npx vitest run tests/game-step-equivalence.test.ts -u
// で更新し、差分の理由を記録する。
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { blankLevels } from "../src/client/progression-save";
import {
  createBuddyBattleState,
  equipBattleBuddy,
} from "../src/shared/buddy-combat";
import { CAVE_BLOCKS } from "../src/shared/cave";
import { initDailyDefense } from "../src/shared/daily-defense";
import {
  ENEMIES,
  STARTERS,
  type Effect,
  type Kind,
  type Weapon,
} from "../src/shared/defs";
import {
  chooseFrontUpgrade,
  createFrontRun,
  stepFrontRun,
  type FrontMode,
} from "../src/shared/front-run";
import {
  addPlayer,
  createWorld,
  eye,
  hurtEnemy,
  hurtPlayer,
  neutral,
  retireEvents,
  spawn,
  start,
  step,
  type Enemy,
  type Input,
  type Player,
  type World,
} from "../src/shared/game";
import {
  chooseRebuildUpgrade,
  createRebuildRun,
  stepRebuildRun,
} from "../src/shared/rebuild-run";
import { initSolo } from "../src/shared/solo-progression";
import { mapFor, STAGES, type Wave } from "../src/shared/stages";
import { createTrainingWorld, stepTraining } from "../src/shared/training";

const DT = 0.05;

/**
 * -0・NaN・Infinity・undefined も区別する直列化。キー順は挿入順のまま比べる。
 * 祖先への循環参照（洞窟の navigation.point など）は、何階層上かで表す。
 */
function canonical(value: unknown) {
  const ancestors: unknown[] = [];
  const write = (v: unknown): string => {
    if (v === undefined) return "undefined";
    if (v === null) return "null";
    if (typeof v === "number") return Object.is(v, -0) ? "-0" : String(v);
    if (typeof v === "string") return JSON.stringify(v);
    if (typeof v === "boolean") return String(v);
    if (typeof v !== "object" || v instanceof Map || v instanceof Set)
      throw new Error(`直列化の対象外です: ${typeof v}`);
    const seen = ancestors.indexOf(v);
    if (seen >= 0) return `^${ancestors.length - seen}`;
    ancestors.push(v);
    const text = Array.isArray(v)
      ? `[${v.map(write).join(",")}]`
      : `{${Object.entries(v)
          .map(([key, item]) => `${JSON.stringify(key)}:${write(item)}`)
          .join(",")}}`;
    ancestors.pop();
    return text;
  };
  return write(value);
}

/** 入力台本専用の乱数。World の乱数列（w.seed）とは独立させる。 */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Soldier {
  id: string;
  kinds: [Kind, Kind];
  effects?: [Effect, Effect];
  rescue?: boolean;
  cameraAim?: boolean;
}

const armed = (s: Soldier): Weapon[] =>
  s.kinds.map((kind, slot) => ({
    ...STARTERS[0],
    id: `${s.id}-${slot}`,
    kind,
    effect: s.effects?.[slot] ?? "none",
    power: 1 + slot * 0.5,
  }));

/** 最寄りの敵を狙い、移動・回避・跳躍・持ち替え・装填・救助を台本乱数で混ぜる。 */
function pilot(seed: number, s: Pick<Soldier, "rescue" | "cameraAim"> = {}) {
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
      // yaw=0 では mx が +x、mz が -z へ進む。
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

function squadInputs(w: World, squad: Soldier[], seed: number) {
  const pilots = new Map(
    squad.map((s, index) => [s.id, pilot(seed * 31 + index, s)]),
  );
  return (tick: number): Record<string, Input> =>
    Object.fromEntries(
      w.players
        .filter((p) => pilots.has(p.id))
        .map((p) => [p.id, pilots.get(p.id)!(w, p, tick)]),
    );
}

/** 全滅で台本が早く終わらないよう、生存中の兵士だけ定期的に体力を戻す。 */
const sustain = (w: World, tick: number) => {
  if (tick % 20 === 0)
    for (const p of w.players) if (p.hp > 0) p.hp = Math.max(p.hp, 160);
};
/** 波を進めるため、定期的に敵の残り体力を1へ落とす（撃破は射撃で行う）。 */
const sweep = (w: World, tick: number) => {
  if (tick % 60 === 59)
    for (const e of w.enemies) if (e.hp > 0) e.hp = Math.min(e.hp, 1);
};
/** 後半の波へ届かせるため、大型以外を定期的に撃破扱いにする。大型は残して戦わせる。 */
const cull = (w: World, tick: number) => {
  sustain(w, tick);
  if (tick % 30 === 29)
    for (const e of [...w.enemies])
      if (e.kind !== "boss" && e.kind !== "harrow")
        hurtEnemy(w, e, e.hp, w.players[0].id);
};

/** 毎 tick の全状態をハッシュへ畳み込み、通過した分岐の目安も一緒に返す。 */
function trace(
  ticks: number,
  world: () => World,
  state: () => unknown,
  advance: (tick: number) => void,
) {
  const hash = createHash("sha256");
  const kinds = new Set<string>();
  const events: Record<string, number> = {};
  const rounds = new Set<string>();
  for (let tick = 0; tick < ticks; tick++) {
    advance(tick);
    const w = world();
    for (const e of w.enemies) kinds.add(e.segments ? "worm" : e.kind);
    for (const e of w.events) events[e.type] = (events[e.type] ?? 0) + 1;
    for (const q of w.projectiles)
      rounds.add(q.style ?? (q.rocket ? "rocket" : "acid"));
    hash.update(canonical(state()));
    hash.update("\n");
    retireEvents(w, w.eventSerial);
  }
  const w = world();
  return {
    ticks,
    phase: w.phase,
    reason: w.reason,
    time: w.time,
    wave: w.wave,
    kills: w.totalKills,
    serial: w.serial,
    seed: w.seed,
    enemies: [...kinds].sort().join(" "),
    events: Object.keys(events)
      .sort()
      .map((type) => `${type}:${events[type]}`)
      .join(" "),
    projectiles: [...rounds].sort().join(" "),
    sha256: hash.digest("hex"),
  };
}

function battle(
  seed: number,
  stage: number,
  squad: Soldier[],
  prepare?: (w: World) => void,
) {
  const w = createWorld(`golden-${seed}-${stage}`, seed, stage);
  prepare?.(w);
  for (const s of squad) addPlayer(w, s.id, armed(s));
  start(w);
  return w;
}

function campaign(
  seed: number,
  stage: number,
  squad: Soldier[],
  ticks: number,
  before: (w: World, tick: number) => void = () => {},
  options: {
    prepare?: (w: World) => void;
    ready?: (w: World) => void;
    dt?: (tick: number) => number;
  } = {},
) {
  const w = battle(seed, stage, squad, options.prepare);
  options.ready?.(w);
  const inputs = squadInputs(w, squad, seed);
  return trace(
    ticks,
    () => w,
    () => w,
    (tick) => {
      before(w, tick);
      step(w, inputs(tick), options.dt?.(tick) ?? DT);
    },
  );
}

const stageWith = (test: (wave: Wave) => boolean) =>
  STAGES.find((s) => s.waves.some(test))!.id;
const caveStage = STAGES.find(
  (s) => mapFor({ stage: s.id }).blocks === CAVE_BLOCKS,
)!.id;

const PAIR: Soldier[] = [
  { id: "a", kinds: ["rifle", "shotgun"], rescue: true },
  { id: "b", kinds: ["rocket", "smg"], effects: ["chain", "quick"] },
];
const HEAVY: Soldier[] = [
  { id: "a", kinds: ["heavy", "sniper"], effects: ["chain", "pierce"] },
  { id: "b", kinds: ["grenade", "medic"], rescue: true },
  { id: "c", kinds: ["sticky", "laser"], effects: ["repel", "reserve"] },
];
const CAMERA: Soldier[] = [
  { id: "a", kinds: ["slug", "kick"], cameraAim: true },
  { id: "b", kinds: ["rocket", "rifle"], cameraAim: true, rescue: true },
];

/** 全種の敵を兵士の前方へ直接置く。出現順と乱数消費は spawn に任せる。 */
function menagerie(w: World) {
  const z = w.players[0].z;
  (Object.keys(ENEMIES) as Enemy["kind"][]).forEach((kind, index) =>
    spawn(w, kind, (index - 4) * 5, z - 14 - (index % 3) * 4),
  );
  spawn(w, "boss", 0, z - 30, "worm");
}
/** FOUNDRY ZERO の第2・第3段階（増援生成）へ進める。 */
const foundryPhases = (w: World, tick: number) => {
  sustain(w, tick);
  if (tick === 200 || tick === 500)
    for (const e of w.enemies)
      if (e.kind === "boss" && !e.segments && e.hp > 0)
        e.hp = Math.min(e.hp, e.maxHp * (tick === 200 ? 0.6 : 0.3));
};

function frontRun(
  seed: number,
  ids: string[],
  ticks: number,
  options: { fusion?: true; mode?: FrontMode; day?: string } = {},
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
  return trace(
    ticks,
    () => run.world,
    () => run,
    (tick) => {
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
    },
  );
}

const scenarios: Record<string, () => ReturnType<typeof trace>> = {
  "通常・2人・ST1・ダウンと救助から全滅": () =>
    campaign(101, 1, PAIR, 1100, (w, tick) => {
      if (tick === 200) hurtPlayer(w, w.players[1], 1e4);
      if (tick === 900) for (const p of w.players) hurtPlayer(w, p, 1e4, true);
    }),
  "通常・1人・最終ST・補給なし": () =>
    campaign(102, STAGES.length, [PAIR[0]], 900),
  "通常・3人・CROWNの波を完走": () =>
    campaign(
      103,
      stageWith((wave) => wave.bosses.includes("crown")),
      HEAVY,
      1300,
      (w, tick) => (sustain(w, tick), sweep(w, tick)),
    ),
  "通常・2人・WORMの波": () =>
    campaign(
      104,
      stageWith((wave) => wave.bosses.includes("worm")),
      PAIR,
      1500,
      cull,
    ),
  "通常・2人・HARROWの波": () =>
    campaign(
      105,
      stageWith((wave) => wave.bosses.includes("harrow")),
      CAMERA,
      1500,
      cull,
    ),
  "通常・3人・BASTIONの波": () =>
    campaign(
      106,
      stageWith((wave) => !!wave.troops.bastion),
      HEAVY,
      1200,
      sustain,
    ),
  "通常・2人・洞窟": () => campaign(107, caveStage, PAIR, 1000, sustain),
  "通常・全種を直接配置": () =>
    campaign(108, 1, HEAVY, 800, foundryPhases, { ready: menagerie }),
  "通常・高低差・全種を直接配置": () =>
    campaign(109, 3, CAMERA, 600, foundryPhases, { ready: menagerie }),
  "通常・洞窟・全種を直接配置": () =>
    campaign(110, caveStage, PAIR, 800, foundryPhases, { ready: menagerie }),
  "通常・可変dt・切断と復帰・時間切れ": () =>
    campaign(
      111,
      2,
      [...PAIR, { id: "c", kinds: ["sniper", "smg"] }],
      1400,
      (w, tick) => {
        sustain(w, tick);
        if (tick === 0) w.players[2].connected = false;
        if (tick === 300) w.players[1].connected = false;
        if (tick === 600) w.players[1].connected = true;
        if (tick === 1300) w.time = 599.9;
      },
      { dt: (tick) => [0.016, 0.05, 0.1, 0.25, 0, 0.033][tick % 6] },
    ),
  "通常・バディ同行": () =>
    campaign(112, 4, PAIR, 1000, sustain, {
      ready: (w) => {
        w.buddies = createBuddyBattleState(w);
        equipBattleBuddy(w.buddies, w.players[0], "tatara", 3);
        equipBattleBuddy(w.buddies, w.players[1], "yosuga");
      },
    }),
  "ソロ・ST1・normal": () =>
    campaign(201, 1, [PAIR[1]], 1500, cull, {
      prepare: (w) => initSolo(w, 1, "normal", false, blankLevels()),
    }),
  "ソロ・ST8・medium・技能あり": () =>
    campaign(202, 8, [CAMERA[0]], 1200, sustain, {
      prepare: (w) => {
        const levels = blankLevels();
        for (const key of Object.keys(levels) as (keyof typeof levels)[])
          levels[key] = 2;
        initSolo(w, 8, "medium", false, levels);
      },
    }),
  武器庫防衛: () =>
    campaign(
      203,
      2,
      [PAIR[0]],
      1500,
      (w, tick) => {
        sustain(w, tick);
        if (tick === 1300) w.time = 179;
      },
      {
        prepare: (w) => initSolo(w, 2, "normal", false, blankLevels()),
        ready: (w) => initDailyDefense(w, "2026-09-20"),
      },
    ),
  訓練場: () => {
    const w = createTrainingWorld();
    const input = pilot(301);
    return trace(
      600,
      () => w,
      () => w,
      (tick) => stepTraining(w, input(w, w.players[0], tick)),
    );
  },
  P1a改装版: () => {
    let run = createRebuildRun({ runId: "golden-rebuild", seed: 4520 });
    const input = pilot(401);
    return trace(
      1500,
      () => run.world,
      () => run,
      (tick) => {
        for (let guard = 0; run.phase === "selection" && guard < 32; guard++)
          chooseRebuildUpgrade(run, run.upgrades.offer!.defaultCardId);
        const w = run.world;
        sustain(w, tick);
        run = stepRebuildRun(run, input(w, w.players[0], tick), DT);
      },
    );
  },
  "前線・生存・融合・1人": () => frontRun(501, ["p0"], 1500, { fusion: true }),
  "前線・生存・融合・2人": () =>
    frontRun(502, ["p0", "p1"], 1000, { fusion: true }),
  "前線・防衛・融合": () =>
    frontRun(503, ["p0"], 800, { fusion: true, mode: "defense" }),
  "前線・日替わり・融合": () =>
    frontRun(504, ["p0", "p1"], 1000, {
      fusion: true,
      mode: "daily",
      day: "2026-09-20",
    }),
  "前線・旧方式": () => frontRun(505, ["p0"], 1000),
};

it.each(Object.keys(scenarios))(
  "step は同一seed・同一入力で毎tick同じ状態になる: %s",
  (name) => {
    expect(scenarios[name]()).toMatchSnapshot();
  },
);
