import { describe, expect, it } from "vitest";
import {
  addPlayer,
  createWorld,
  enemyBodies,
  hurtEnemy,
  neutral,
  spawn,
  start,
  step,
  type Enemy,
  type World,
} from "../src/shared/game";
import {
  BASTION,
  bastionLaneHalfWidth,
  bastionLanes,
  bastionReduction,
  bastionTier,
  stepBastion,
} from "../src/shared/bastion";
import { BastionView } from "../src/client/bastion-view";
import { prepareState } from "../src/shared/state-wire";
import {
  ELEVATED_MAPS,
  HARROW_BRANCH,
  MAPS,
  STAGES,
  mapFor,
  stageFor,
  troopAt,
  troopCount,
} from "../src/shared/stages";
import { enemyReportId } from "../src/shared/enemy-identity";
import { ENEMIES } from "../src/shared/defs";
import {
  FRONT_RUN_CONFIG,
  chooseFrontUpgrade,
  createFrontRun,
  stepFrontRun,
  type FrontMode,
  type FrontRun,
} from "../src/shared/front-run";
import { initSolo } from "../src/shared/solo-progression";
import { campaignNumber, normalSaveId } from "../src/shared/campaign";
import { blankLevels, freshProgress } from "../src/client/progression-save";
import {
  readBattleCheckpoint,
  writeBattleCheckpoint,
} from "../src/client/battle-checkpoint";

const DT = 0.05;

function setup(players = 1, z = 12) {
  const w = createWorld("bastion-" + players, 7, 1);
  w.phase = "battle";
  w.wave = 1;
  w.nextSpawn = 1e9;
  for (let i = 0; i < players; i++) {
    const p = addPlayer(w, "p" + i);
    Object.assign(p, { x: i * 1.5, y: 0, z, hp: 100000 });
  }
  const e = spawn(w, "bastion", 0, 0)!;
  e.active = true;
  return { w, e };
}
function tick(w: World, n = 1) {
  const inputs = Object.fromEntries(w.players.map((p) => [p.id, neutral()]));
  for (let i = 0; i < n; i++) step(w, inputs, DT);
}
// 実際のtick進行と同じ時刻列で、interval秒ごとに1回撃つ。
function sustained(
  w: World,
  e: Enemy,
  interval: number,
  seconds: number,
  damage = 10,
  owners = ["p0"],
) {
  let next = w.time;
  const end = w.time + seconds;
  const dealt: number[] = [];
  while (w.time < end - 1e-9) {
    tick(w);
    while (next <= w.time + 1e-9) {
      for (const owner of owners) {
        const before = e.hp;
        hurtEnemy(w, e, damage, owner, 0, "rifle");
        dealt.push(before - e.hp);
      }
      next += interval;
    }
  }
  return dealt;
}

describe("BASTION hardening", () => {
  it("single, slow shots never harden and always take full damage", () => {
    for (const interval of [0.6, 0.8, 1.05]) {
      const { w, e } = setup();
      e.hp = e.maxHp = 1e6;
      const dealt = sustained(w, e, interval, 6, 30);
      expect(e.bastion!.armor, String(interval)).toBe(0);
      expect(dealt.every((d) => Math.abs(d - 30) < 1e-9)).toBe(true);
    }
  });

  it("sustained fire hardens in steps and never reduces more than 60%", () => {
    const { w, e } = setup();
    e.hp = e.maxHp = 1e6;
    e.bastion!.readyAt = 1e9; // 反撃なしで上限だけを見る
    const dealt = sustained(w, e, 0.07, 3, 10);
    expect(e.bastion!.armor).toBe(BASTION.max);
    expect(bastionTier(e.bastion!.armor)).toBe(3);
    expect(Math.min(...dealt)).toBeCloseTo(4, 6);
    expect(new Set(dealt.map((d) => d.toFixed(3)))).toEqual(
      new Set(["10.000", "8.000", "6.000", "4.000"]),
    );
  });

  it("caps the gain rate: 0→75 needs at least 0.95 s of chained hits", () => {
    for (const interval of [0.045, 0.07, 0.13]) {
      const { w, e } = setup();
      e.hp = e.maxHp = 1e6;
      e.bastion!.readyAt = 1e9;
      const start = w.time;
      let reached = Infinity;
      let next = w.time;
      while (w.time < start + 4) {
        tick(w);
        while (next <= w.time + 1e-9) {
          hurtEnemy(w, e, 10, "p0", 0, "rifle");
          next += interval;
        }
        if (e.bastion!.armor >= 75 && reached === Infinity)
          reached = w.time - start;
      }
      // 最初の被弾は起点だけ。+8 が 0.1 秒に1回なので 75 には10回＝0.05+0.9秒。
      expect(reached, String(interval)).toBeGreaterThanOrEqual(0.95 - 1e-9);
      expect(reached, String(interval)).toBeLessThan(2);
    }
  });

  it("a shotgun blast is one hit group: one gain and one reduction for all pellets", () => {
    const { w, e } = setup();
    e.hp = e.maxHp = 1e6;
    e.bastion!.readyAt = 1e9;
    e.bastion!.armor = 49; // 段階1。次の加算で段階2へ上がる位置
    e.bastion!.hitAt = w.time; // 連続中
    tick(w);
    const before = e.hp;
    for (let pellet = 0; pellet < 8; pellet++)
      hurtEnemy(w, e, 19, "p0", 0, "shotgun");
    expect(e.bastion!.armor).toBe(49 + BASTION.gain);
    // 全ペレットがtick開始時の段階1（20%）で軽減される。順序依存なし。
    expect(before - e.hp).toBeCloseTo(8 * 19 * 0.8, 6);
  });

  it("a blast never chains with itself: pellets of one tick are one starting hit", () => {
    const { w, e } = setup(2);
    e.hp = e.maxHp = 1e6;
    e.bastion!.readyAt = 1e9;
    const blast = (owner: string) => {
      for (let pellet = 0; pellet < 8; pellet++)
        hurtEnemy(w, e, 19, owner, 0, "shotgun");
    };
    tick(w);
    blast("p0");
    expect(e.bastion!.armor).toBe(0);
    // 同じ散弾銃の次弾（0.8秒後）は連続にならない。
    tick(w, 16);
    blast("p0");
    expect(e.bastion!.armor).toBe(0);
    // 別の隊員の散弾が0.3秒以内に続くと、その斉射が1回だけ加算される。
    tick(w, 6);
    blast("p1");
    expect(e.bastion!.armor).toBe(BASTION.gain);
  });

  it("explosions, pierce and four co-op shooters in one tick add at most one step", () => {
    const { w, e } = setup(4);
    e.hp = e.maxHp = 1e6;
    e.bastion!.readyAt = 1e9;
    e.bastion!.hitAt = w.time;
    tick(w);
    for (const owner of ["p0", "p1", "p2", "p3"]) {
      hurtEnemy(w, e, 10, owner, 0, "rifle");
      hurtEnemy(w, e, 40, owner); // 爆風・副次効果（weapon無し）
    }
    expect(e.bastion!.armor).toBe(BASTION.gain);
    // 次のtick（0.05秒後）は gainInterval 未満なので加算されない。
    tick(w);
    hurtEnemy(w, e, 10, "p1", 0, "rifle");
    expect(e.bastion!.armor).toBe(BASTION.gain);
    tick(w);
    hurtEnemy(w, e, 10, "p2", 0, "rifle");
    expect(e.bastion!.armor).toBe(2 * BASTION.gain);
  });

  it("tags hits with the armor step that reduced them (deflection sparks)", () => {
    const { w, e } = setup();
    e.hp = e.maxHp = 1e6;
    e.bastion!.readyAt = 1e9;
    tick(w);
    hurtEnemy(w, e, 10, "p0", 0, "rifle");
    expect(
      w.events.filter((v) => v.type === "hit").at(-1)!.guard,
    ).toBeUndefined();
    e.bastion!.armor = 80;
    tick(w);
    hurtEnemy(w, e, 10, "p0", 0, "rifle");
    const hit = w.events.filter((v) => v.type === "hit").at(-1)!;
    expect(hit.guard).toBe(3);
    expect(hit.amount).toBe(4);
  });

  it("a phase change mid-tick switches the reduction for later hits of that tick", () => {
    const { w, e } = setup();
    e.hp = e.maxHp = 1e6;
    const s = e.bastion!;
    Object.assign(s, {
      armor: 100,
      phase: "warn",
      phaseAt: w.time - BASTION.warn,
      volley: { count: 12, turn: 0, x: 0, y: 1.7, z: 0 },
      aimReadyAt: 1e9,
    });
    tick(w); // warn の終わりで発射し、同じtickで open へ移る
    expect(s.phase).toBe("open");
    // step() 内の直撃（敵の処理より前）は 60%、相が変わった後の爆風は 0%。
    w.time += DT;
    s.phase = "warn";
    s.phaseAt = w.time - BASTION.warn;
    s.armor = 100;
    s.volley = { count: 12, turn: 0, x: 0, y: 1.7, z: 0 };
    let before = e.hp;
    hurtEnemy(w, e, 100, "p0", 0, "rifle");
    expect(before - e.hp).toBeCloseTo(40, 6);
    const p = w.players[0];
    stepBastion(w, e, p, DT);
    expect(s.phase).toBe("open");
    before = e.hp;
    hurtEnemy(w, e, 100, "p0");
    expect(before - e.hp).toBeCloseTo(100, 6);
    // 硬化の加算は開放中なので増えない。
    expect(s.armor).toBe(0);
  });

  it("zero damage neither chains nor delays recovery", () => {
    const { w, e } = setup();
    e.bastion!.armor = 40;
    e.bastion!.hitAt = w.time;
    tick(w);
    hurtEnemy(w, e, 0, "p0");
    expect(e.bastion!.hitAt).toBeLessThan(w.time);
    expect(e.bastion!.armor).toBe(40);
  });

  it("recovers after 1.2 s without hits and is fully soft within 3.7 s", () => {
    const { w, e } = setup();
    e.bastion!.readyAt = 1e9;
    e.bastion!.armor = 100;
    e.bastion!.hitAt = w.time;
    tick(w, Math.round(1.15 / DT));
    expect(e.bastion!.armor).toBe(100);
    tick(w, Math.round(0.3 / DT));
    expect(e.bastion!.armor).toBeLessThan(100);
    tick(w, Math.round(2.4 / DT));
    expect(e.bastion!.armor).toBe(0);
    expect(bastionReduction(e.bastion!)).toBe(0);
  });
});

describe("BASTION counter volley", () => {
  function hardened(armor: number) {
    const s = setup();
    s.e.hp = s.e.maxHp = 1e6;
    s.e.bastion!.armor = armor;
    s.e.bastion!.hitAt = s.w.time;
    s.e.bastion!.aimReadyAt = 1e9; // 照準弾を除外
    return s;
  }

  it("telegraphs 0.8 s of body motion, then 0.8 s of red lanes, then fires", () => {
    const { w, e } = hardened(80);
    const start = w.time;
    tick(w);
    expect(e.bastion!.phase).toBe("brace");
    const position = { x: e.x, z: e.z };
    while (e.bastion!.phase === "brace") tick(w);
    expect(w.time - start).toBeCloseTo(BASTION.brace + DT, 6);
    expect(e.bastion!.volley!.count).toBe(BASTION.volley.low);
    const committed = structuredClone(e.bastion!.volley!);
    const lanes = bastionLanes(committed, mapFor(w).blocks);
    expect(w.projectiles.filter((q) => q.style === "bastion")).toHaveLength(0);
    while (e.bastion!.phase === "warn") {
      expect(e.bastion!.volley).toEqual(committed);
      tick(w);
    }
    expect(e.bastion!.phase).toBe("open");
    expect({ x: e.x, z: e.z }).toEqual(position); // 予兆中は移動しない
    const shots = w.projectiles.filter((q) => q.style === "bastion");
    expect(shots).toHaveLength(BASTION.volley.low);
    // 発射位置・方向は赤い予告のレーンと一致（発射tick分だけ前進済み）。
    shots.forEach((q, i) => {
      const yaw = Math.atan2(q.dx, q.dz);
      expect(Math.cos(yaw - lanes[i].yaw)).toBeCloseTo(1, 9);
      expect(q.y).toBeCloseTo(lanes[i].from.y, 6);
    });
  });

  it("keeps hardening during the body wind-up: firing on doubles the volley", () => {
    const { w, e } = hardened(76);
    tick(w);
    expect(e.bastion!.phase).toBe("brace");
    while (e.bastion!.phase === "brace") {
      tick(w);
      hurtEnemy(w, e, 10, "p0", 0, "rifle");
    }
    expect(e.bastion!.volley!.count).toBe(BASTION.volley.full);
    // 赤表示中の被弾は数を変えない。
    const armor = e.bastion!.armor;
    tick(w);
    hurtEnemy(w, e, 10, "p0", 0, "rifle");
    expect(e.bastion!.armor).toBe(armor);
  });

  it("opens for 2.2 s with no reduction or hardening, then waits for the cooldown", () => {
    const { w, e } = hardened(100);
    while (e.bastion!.phase !== "open") tick(w);
    const opened = w.time;
    expect(e.bastion!.armor).toBe(0);
    expect(bastionReduction(e.bastion!)).toBe(0);
    const before = e.hp;
    sustained(w, e, 0.07, 1.5, 10);
    expect(e.bastion!.armor).toBe(0);
    expect(before - e.hp).toBeCloseTo(10 * Math.round(1.5 / 0.07 + 1), -1);
    while (e.bastion!.phase === "open") tick(w);
    expect(w.time - opened).toBeCloseTo(BASTION.open, 1);
    // 開放後すぐに75へ戻しても、発射から6秒経つまで次の予兆へ入らない。
    e.bastion!.armor = 90;
    e.bastion!.hitAt = w.time;
    tick(w);
    expect(e.bastion!.phase).toBe("guard");
    expect(e.bastion!.readyAt - opened).toBeCloseTo(BASTION.counterCooldown, 6);
  });

  it("never fires after death and starts every spawn soft", () => {
    const { w, e } = hardened(100);
    tick(w, 5);
    expect(e.bastion!.phase).toBe("brace");
    hurtEnemy(w, e, 1e9, "p0");
    tick(w, 60);
    expect(w.enemies).toHaveLength(0);
    expect(w.projectiles.filter((q) => q.style === "bastion")).toHaveLength(0);
    const again = spawn(w, "bastion", 0, 0)!;
    expect(again.id).not.toBe(e.id);
    expect(again.bastion).toMatchObject({
      armor: 0,
      phase: "guard",
      counters: 0,
    });
  });

  it("two bastions keep independent armor and timers", () => {
    const { w, e } = setup();
    const other = spawn(w, "bastion", 6, 0)!;
    other.active = true;
    e.hp = e.maxHp = other.hp = other.maxHp = 1e6;
    e.bastion!.readyAt = other.bastion!.readyAt = 1e9;
    sustained(w, e, 0.07, 2, 10);
    expect(e.bastion!.armor).toBe(BASTION.max);
    expect(other.bastion!.armor).toBe(0);
    expect(other.bastion!.hitAt).toBeUndefined();
  });

  it("is avoidable: a soldier between lanes is not hit, one on a lane is", () => {
    for (const onLane of [false, true]) {
      const { w, e } = hardened(80);
      const p = w.players[0];
      tick(w);
      while (e.bastion!.phase === "brace") tick(w);
      const lane = bastionLanes(e.bastion!.volley!, mapFor(w).blocks)[0];
      const yaw = lane.yaw + (onLane ? 0 : Math.PI / BASTION.volley.low);
      Object.assign(p, {
        x: e.x + Math.sin(yaw) * 8,
        z: e.z + Math.cos(yaw) * 8,
        hp: 1000,
      });
      tick(w, Math.round((BASTION.warn + 2) / DT));
      expect(p.hp < 1000, String(onLane)).toBe(onLane);
    }
  });

  it("draws the danger strip as wide as the actual hit for the ground a soldier stands on", () => {
    // 弾の高さ1.7m。胴（+1.2m）との差で当たる片側の幅が変わる。
    expect(2 * bastionLaneHalfWidth(1.7, 0)).toBeCloseTo(
      2 * Math.sqrt(0.75),
      9,
    );
    expect(bastionLaneHalfWidth(1.7, 0.5)).toBeCloseTo(1, 9); // 0.5m高い面は2.0m幅
    expect(bastionLaneHalfWidth(1.7, -0.5)).toBe(0); // 0.5m低い面は頭上を通る
    expect(bastionLaneHalfWidth(1.7, 1.6)).toBe(0); // 1m以上高い面は足元を通る
  });

  it("adjacent lanes leave a 2 m wide gap beyond 3.9 m even at full volley", () => {
    const gap = (r: number, n: number) => 2 * r * Math.sin(Math.PI / n) - 2;
    expect(gap(3.9, BASTION.volley.full)).toBeGreaterThan(0);
    expect(gap(10, BASTION.volley.full)).toBeGreaterThan(3);
  });
});

describe("BASTION integration", () => {
  it("survives the snapshot encoder and stays out of encounter records", () => {
    const { w, e } = setup();
    e.bastion!.armor = 62.5;
    const packet = JSON.parse(
      prepareState(w, 0, { room: "test" }).packet("p0"),
    );
    expect(packet.world.enemies[0].bastion).toEqual(
      JSON.parse(JSON.stringify(e.bastion)),
    );
    expect(enemyReportId(e)).toBeUndefined();
  });

  it("does not download the model until a BASTION is actually in the battle", async () => {
    const view = new BastionView("http://127.0.0.1:9/never-served.glb");
    const empty = createWorld("no-bastion", 1, 1);
    view.begin(empty, mapFor(empty).blocks);
    expect(view.loading).toBeUndefined();
    const { w } = setup();
    view.begin(w, mapFor(w).blocks);
    expect(view.loading).toBeInstanceOf(Promise);
    await view.loading; // 失敗しても例外にせず、簡易形状のまま描く
    expect(view.ready).toBe(false);
    expect(view.error).toBeTruthy();
    view.clear();
  });

  it("spikes extend the hit body only as far as their roots", () => {
    const { e } = setup();
    const soft = enemyBodies(e)[0].radius;
    e.bastion!.armor = 100;
    expect(enemyBodies(e)[0].radius).toBeCloseTo(soft + BASTION.spikePad, 9);
    e.bastion!.phase = "open";
    expect(enemyBodies(e)[0].radius).toBeCloseTo(soft, 9);
  });

  it("real rifle fire through step() hardens it; a sniper or a shotgun does not", () => {
    for (const kind of ["rifle", "sniper", "shotgun"] as const) {
      const { w, e } = setup(1, 10);
      e.hp = e.maxHp = 1e6;
      e.bastion!.readyAt = 1e9;
      e.bastion!.aimReadyAt = 1e9;
      const p = w.players[0];
      p.weapons = [
        { id: "a", kind, rarity: 0, power: 1, effect: "none" },
        { id: "b", kind, rarity: 0, power: 1, effect: "none" },
      ];
      p.ammo = [999, 999];
      for (let i = 0; i < 40; i++) {
        // 中心へ向けたまま撃ち続ける（敵は周回するので毎tick照準を更新）。
        const yaw = Math.atan2(e.x - p.x, -(e.z - p.z));
        const pitch = Math.atan2(
          e.y + BASTION.hover - ((p.y ?? 0) + 1.5),
          Math.hypot(e.x - p.x, e.z - p.z),
        );
        p.ammo = [999, 999];
        step(w, { p0: { ...neutral(), fire: true, yaw, pitch } }, DT);
      }
      expect(e.hp, kind).toBeLessThan(1e6);
      if (kind === "rifle") expect(e.bastion!.armor).toBeGreaterThanOrEqual(75);
      else expect(e.bastion!.armor).toBe(0);
    }
  });
});

describe("BASTION の出現（生存戦）", () => {
  function survival(mode: FrontMode = "survival") {
    const run = createFrontRun({
      runId: "bastion-" + mode,
      seed: 4321,
      fusion: true,
      mode,
      players: [{ id: "p0" }],
    });
    const offer = run.upgrades.p0.offer!;
    chooseFrontUpgrade(
      run,
      "p0",
      {
        runId: run.world.run,
        offerId: offer.id,
        revision: offer.revision,
        requestId: "first",
        cardId: offer.defaultCardId,
      },
      0,
    );
    expect(run.phase).toBe("combat");
    return run;
  }
  const pending = (run: FrontRun) =>
    run.pendingSpawns.filter((p) => p.kinds.includes("bastion"));
  // 予告と通常の出現だけを見るため、時刻を直接進めて1tickずつ回す。
  function at(run: FrontRun, time: number) {
    run.world.time = time;
    run.world.players[0].hp = 1e6;
    stepFrontRun(run, {}, DT, time);
  }

  it("出撃90秒から予告し、体力は通常敵の半減を受けず、同時1体・45秒間隔", () => {
    const run = survival();
    at(run, BASTION.survival.from - 0.2);
    expect(pending(run)).toHaveLength(0);
    at(run, BASTION.survival.from);
    expect(pending(run)).toHaveLength(1);
    expect(run.bastionAt).toBeCloseTo(
      BASTION.survival.from + BASTION.survival.every,
    );
    at(run, pending(run)[0].at);
    const bastion = run.world.enemies.find((e) => e.kind === "bastion")!;
    expect(bastion?.bastion?.phase).toBe("guard");
    const crawler = run.world.enemies.find((e) => e.kind === "crawler")!;
    const ratio = (e: Enemy) => e.maxHp / (ENEMIES[e.kind].hp * e.size);
    expect(ratio(bastion)).toBeCloseTo(
      ratio(crawler) / FRONT_RUN_CONFIG.normalHpMultiplier,
    );
    // 生存中は間隔を過ぎても2体目を出さない。
    at(run, run.bastionAt! + 1);
    expect(pending(run)).toHaveLength(0);
    expect(run.world.enemies.filter((e) => e.kind === "bastion")).toHaveLength(
      1,
    );
    // 撃破後は次の時刻から再び予告する。
    hurtEnemy(run.world, bastion, bastion.hp + 1, "p0");
    at(run, run.world.time + DT);
    expect(
      run.world.enemies.some((e) => e.kind === "bastion" && e.hp > 0),
    ).toBe(false);
    at(run, run.world.time + DT);
    expect(pending(run)).toHaveLength(1);
  });

  it("防衛・デイリーには出さない", () => {
    for (const mode of ["defense", "daily"] as const) {
      const run = survival(mode);
      at(run, 200);
      expect(pending(run), mode).toHaveLength(0);
      expect(run.bastionAt, mode).toBeUndefined();
    }
  });

  it("撃破の経験値は6", () => {
    const run = survival();
    at(run, BASTION.survival.from);
    at(run, pending(run)[0].at);
    const bastion = run.world.enemies.find((e) => e.kind === "bastion")!;
    const before = run.world.front!.orbs.reduce((sum, o) => sum + o.value, 0);
    hurtEnemy(run.world, bastion, bastion.hp + 1, "p0");
    const after = run.world.front!.orbs.reduce((sum, o) => sum + o.value, 0);
    expect(after - before).toBe(6);
  });
});

describe("BASTION の出現（攻略）", () => {
  it("21・23・24の第2波だけに入り、増援・デイリー防衛の候補にならない", () => {
    expect(
      STAGES.filter((s) => s.waves.some((w) => w.troops.bastion)).map(
        (s) => s.id,
      ),
    ).toEqual([21, 23, 24]);
    for (const stage of STAGES) {
      expect(stage.waves[0].troops.bastion ?? 0).toBe(0);
      const wave = stage.waves.find((w) => w.troops.bastion);
      if (!wave) continue;
      const order = Array.from({ length: troopCount(wave) }, (_, i) =>
        troopAt(wave, i),
      );
      // 波の序盤に出る（実機で確認しやすく、波の最後まで残らない）。
      expect(order.indexOf("bastion")).toBeLessThan(6);
    }
    expect(HARROW_BRANCH.waves.some((w) => w.troops.bastion)).toBe(false);
    for (const map of [...MAPS, ...ELEVATED_MAPS])
      expect(map.foundryAllowed ?? []).not.toContain("bastion");
  });

  it("ソロの実進行で第2波に出現し、戦闘途中保存から同じ状態で再開できる", () => {
    for (const number of [21, 23, 24]) {
      const values = new Map<string, string>();
      const storage = {
        getItem: (k: string) => values.get(k) ?? null,
        setItem: (k: string, v: string) => void values.set(k, v),
        removeItem: (k: string) => void values.delete(k),
      };
      const progress = freshProgress("normal");
      const id = normalSaveId(number);
      const w = createWorld(
        "bastion-campaign-" + number,
        11,
        campaignNumber(id),
      );
      initSolo(w, id, "normal", false, blankLevels());
      addPlayer(w, "solo", progress.inventory.slice(0, 2));
      start(w);
      let bastion: Enemy | undefined;
      for (let i = 0; i < 4000 && !bastion && w.phase === "battle"; i++) {
        w.players[0].hp = 1e6;
        step(w, { solo: neutral() });
        bastion = w.enemies.find((e) => e.kind === "bastion" && e.hp > 0);
        // 試験用に他の敵を片付けて波を進める（戦闘の勝敗を調べる試験ではない）。
        for (const e of w.enemies)
          if (e.kind !== "bastion" && e.hp > 0)
            hurtEnemy(w, e, e.hp + 1, "solo");
      }
      expect(bastion, String(number)).toBeDefined();
      expect(w.wave).toBe(2);
      expect(mapFor(w).blocks).toBe(MAPS[stageFor(w).map].blocks);
      expect(bastion!.bastion?.phase).toBe("guard");
      expect(writeBattleCheckpoint(w, progress, storage)).toBe(true);
      const resumed = readBattleCheckpoint(progress, storage)?.world;
      expect(resumed, String(number)).toBeDefined();
      expect(
        resumed!.enemies.find((e) => e.id === bastion!.id)?.bastion,
      ).toEqual(JSON.parse(JSON.stringify(bastion!.bastion)));
    }
  });
});
