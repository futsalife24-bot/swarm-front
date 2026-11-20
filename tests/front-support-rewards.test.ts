import { describe, expect, it } from "vitest";
import {
  createFrontRun,
  getFrontRunView,
  stepFrontRun,
  forfeitFrontRunPlayer,
} from "../src/shared/front-run";
import {
  createSupportRewards,
  bindSupportRewards,
  noteSupportRewardAction,
  sampleSupportRewards,
  supportRewardAllocation,
} from "../src/shared/front-support-rewards";
import {
  frontSurvivalRewardCount,
  finalizeFrontSurvivalRewards,
} from "../src/shared/front-survival";
import { fire, hurtEnemy, neutral, spawn, step } from "../src/shared/game";
import { makeWeapon } from "../src/shared/progression";
import { frontResultRewards } from "../src/client/front-result-rewards";
import {
  awardFrontCampaign,
  queueFrontCampaignReward,
  recoverFrontCampaignRewards,
} from "../src/client/front-campaign";
import {
  freshProgress,
  persistProgress,
  newSaveKey,
  loadProgress,
} from "../src/client/progression-save";

function make(kills = [90, 0], time = 180, enabled = true) {
  const run = createFrontRun({
    runId: "support-run",
    seed: 723,
    mode: "survival",
    fusion: true,
    supportRewards: enabled,
    players: kills.map((_, i) => ({ id: `p${i}` })),
  });
  run.phase = "combat";
  run.world.time = time;
  run.world.players.forEach((p, i) => (p.kills = kills[i]));
  if (run.supportRewards) {
    run.supportRewards.tickAt = time;
    for (const r of Object.values(run.supportRewards.players))
      Object.assign(r, {
        present: time,
        active: time,
        ...(time > 0 ? { actionAt: time, presentAt: time } : {}),
      });
  }
  return run;
}
function allocation(
  run = make(),
  allowed = run.world.players.map((p) => p.id),
) {
  return supportRewardAllocation(run.world, run.supportRewards!, allowed);
}
const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
  };
};

describe("協力支援報酬の参加資格・経済上限", () => {
  it("撃破0の回復役へチーム予算を再配分し、全員への満額配布をしない", () => {
    expect(allocation().counts).toEqual({ p0: 3, p1: 3 });
    const four = make([180, 0, 0, 0], 600);
    expect(allocation(four).counts).toEqual({ p0: 4, p1: 4, p2: 4, p3: 4 });
    expect(allocation(four).budget).toBe(16);
  });
  it("有効行動は頻度の重みでなく資格。低頻度の回復も同じ参加時間なら公平", () => {
    const r = make();
    r.supportRewards!.players.p1.active = 18;
    expect(allocation(r).counts).toEqual({ p0: 3, p1: 3 });
    r.supportRewards!.players.p1.active = 17.99;
    expect(allocation(r).counts).toEqual({ p0: 6, p1: 0 });
  });
  it("空振り/序盤だけの参加/短時間の接続と明示離脱を除く", () => {
    const r = make([89, 1]);
    r.supportRewards!.players.p1.actionAt = 0;
    expect(allocation(r).eligible.p1).toBe(false);
    r.supportRewards!.players.p1.actionAt = 180;
    r.supportRewards!.players.p1.present = 29.99;
    r.supportRewards!.players.p1.active = 20;
    expect(allocation(r).eligible.p1).toBe(false);
    forfeitFrontRunPlayer(r, "p0");
    expect(getFrontRunView(r, "p0").rewardEligible).toBe(false);
    expect(allocation(r, ["p1"]).budget).toBe(3);
  });
  it("支援資格を満たさない人の武器は0だが既存コイン・宝箱の受領資格は保つ", () => {
    const r = make();
    r.supportRewards!.players.p1.active = 0;
    const view = getFrontRunView(r, "p1");
    expect(view.rewardCount).toBe(0);
    expect(view.supportRewardEligible).toBe(false);
    expect(view.rewardEligible).toBe(true);
    const result = frontResultRewards(r.world, view, "p1", undefined, null);
    expect(result.coins).toBe(30);
    expect(result.emptyWeaponNote).toContain("参加・活動の条件");
  });
  it("途中切断/死亡は最後の生存接続時で判定し、参加時間相当の上限を設ける", () => {
    const r = make();
    Object.assign(r.supportRewards!.players.p1, {
      present: 30,
      active: 10,
      presentAt: 30,
      actionAt: 25,
    });
    r.world.players[1].connected = false;
    r.world.players[1].hp = 0;
    expect(allocation(r).counts).toEqual({ p0: 5, p1: 1 });
    expect(allocation(r).eligible.p1).toBe(true);
  });
  it("60秒/チーム撃破の境界と不正な記録を閉じる", () => {
    for (const [kills, time] of [
      [[90, 0], 59.99],
      [[0, 0], 180],
    ] as [number[], number][]) {
      expect(Object.values(allocation(make(kills, time)).counts)).toEqual([
        0, 0,
      ]);
    }
    const r = make();
    r.supportRewards!.players.p1.actionAt = Infinity;
    expect(allocation(r).eligible.p1).toBe(false);
    r.supportRewards!.players.p0.active = NaN;
    expect(Object.values(allocation(r).counts)).toEqual([0, 0]);
    expect(() => createSupportRewards(["p", "p"], 0)).toThrow();
    expect(() => createSupportRewards(["p", "__proto__"], 0)).toThrow();
  });
  it("2/3/4人の合成1万条件で従来総数・個人30個・参加時間上限を超えない", () => {
    let seed = 814;
    const rand = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
    // 配分の人工条件だけを変える。各条件で無関係な地形を再生成しない。
    const runs = [2, 3, 4].map((n) => make(Array(n).fill(0), 60));
    for (let i = 0; i < 10000; i++) {
      const n = 2 + (i % 3),
        time = 60 + Math.floor(rand() * 3541),
        r = runs[n - 2];
      r.world.time = time;
      for (const p of r.world.players) p.kills = Math.floor(rand() * 900);
      const allowed = r.world.players
        .filter(() => rand() > 0.15)
        .map((p) => p.id);
      for (const p of r.world.players) {
        const present = rand() * time;
        Object.assign(r.supportRewards!.players[p.id], {
          present,
          active: rand() * present,
          actionAt: time,
          presentAt: time,
        });
      }
      const a = allocation(r, allowed);
      const old = r.world.players
        .filter((p) => allowed.includes(p.id))
        .reduce((sum, p) => sum + frontSurvivalRewardCount(time, p.kills), 0);
      expect(a.budget).toBe(old);
      expect(
        Object.values(a.counts).reduce((x, y) => x + y, 0),
      ).toBeLessThanOrEqual(old);
      for (const p of r.world.players) {
        expect(a.counts[p.id]).toBeGreaterThanOrEqual(0);
        expect(a.counts[p.id]).toBeLessThanOrEqual(30);
        const cap = Math.ceil(
          (frontSurvivalRewardCount(time, a.teamKills) *
            r.supportRewards!.players[p.id].present) /
            time -
            1e-9,
        );
        expect(a.counts[p.id]).toBeLessThanOrEqual(cap);
        expect(Number.isInteger(a.counts[p.id])).toBe(true);
        if (!allowed.includes(p.id)) expect(a.counts[p.id]).toBe(0);
      }
    }
  }, 20000);
  it("端数の同点を固定ホストへ偏らせず、戦闘乱数を消費しない", () => {
    const winners = new Set<string>();
    const r = make([60, 30]);
    for (let i = 0; i < 20; i++) {
      r.world.run = `run-${i}`;
      const before = JSON.stringify(r.world);
      const a = allocation(r);
      winners.add(a.counts.p0 === 5 ? "p0" : "p1");
      expect(JSON.stringify(r.world)).toBe(before);
      expect(Object.values(a.counts).reduce((x, y) => x + y)).toBe(9);
    }
    expect(winners.size).toBe(2);
  });
  it("出撃名簿にない途中参加者を予算・チーム撃破・報酬へ加えない", () => {
    const r = make();
    const before = allocation(r);
    r.world.players.push({ ...r.world.players[0], id: "late", kills: 900 });
    expect(allocation(r)).toEqual(before);
  });
});

describe("権威ある有効行動とラン保存", () => {
  it("正の実ダメージだけを認め、偽の演出・入力・不在者は認めない", () => {
    const r = make([0, 0], 0),
      w = r.world,
      s = r.supportRewards!;
    const e = spawn(w, "ant", 2, 2)!;
    w.events.push({
      type: "heal",
      x: 0,
      z: 0,
      amount: 100,
      owner: "p1",
    } as never);
    fire(w, w.players[0], { ...neutral(), fire: true });
    expect(s.players.p0.actionAt).toBeUndefined();
    expect(s.players.p1.actionAt).toBeUndefined();
    hurtEnemy(w, e, 1, "p0");
    expect(s.players.p0.actionAt).toBe(0);
    w.players[1].connected = false;
    hurtEnemy(w, e, 1, "p1");
    expect(s.players.p1.actionAt).toBeUndefined();
    noteSupportRewardAction(w, "late-join");
    expect(s.players["late-join"]).toBeUndefined();
  });
  it("MDの実回復だけを認め、過回復・自分への射撃を認めない", () => {
    const r = make([0, 0], 0),
      w = r.world,
      p = w.players[0],
      ally = w.players[1];
    p.weapons[0] = makeWeapon(
      "md",
      "medic",
      0,
      { power: 0, reload: 0, range: 0, rate: 0 },
      true,
      1,
    );
    p.x = ally.x = 0;
    p.z = 0;
    ally.z = -3;
    fire(w, p, { ...neutral(), fire: true });
    expect(r.supportRewards!.players.p0.actionAt).toBeUndefined();
    p.cool = 0;
    ally.hp = 10;
    fire(w, p, { ...neutral(), fire: true });
    expect(ally.hp).toBeGreaterThan(10);
    expect(r.supportRewards!.players.p0.actionAt).toBe(0);
  });
  it("重複サンプル・大きな時刻飛び・切断時間を加算せず、JSON復元後も継続", () => {
    const r = make([0, 0], 0),
      w = r.world,
      s = r.supportRewards!;
    noteSupportRewardAction(w, "p0");
    w.time = 0.1;
    sampleSupportRewards(w, s);
    sampleSupportRewards(w, s);
    expect(s.players.p0.present).toBeCloseTo(0.1);
    w.time = 100;
    sampleSupportRewards(w, s);
    expect(s.players.p0.present).toBeCloseTo(0.2);
    expect(s.players.p0.active).toBeCloseTo(0.1);
    w.players[0].connected = false;
    w.time += 0.1;
    sampleSupportRewards(w, s);
    expect(s.players.p0.present).toBeCloseTo(0.2);
    const restored = JSON.parse(JSON.stringify(r)) as typeof r;
    bindSupportRewards(restored.world, restored.supportRewards);
    restored.world.players[0].connected = true;
    noteSupportRewardAction(restored.world, "p0");
    restored.world.time += 0.1;
    sampleSupportRewards(restored.world, restored.supportRewards!);
    expect(restored.supportRewards!.players.p0.present).toBeCloseTo(0.3);
    expect(JSON.stringify(restored.world)).not.toContain('"actionAt"');
    expect(JSON.stringify(restored.world)).not.toContain('"supportRewards"');
  });
  it("実際の蘇生完了を援助者へ帰属し、未完了の入力では加算しない", () => {
    const r = make([0, 0], 0),
      w = r.world;
    const [helper, down] = w.players;
    helper.x = down.x = 0;
    helper.z = down.z = 0;
    down.hp = 0;
    down.down = 20;
    for (let i = 0; i < 24; i++)
      step(w, { p0: { ...neutral(), revive: true } }, 0.1);
    expect(down.hp).toBe(0);
    expect(r.supportRewards!.players.p0.actionAt).toBeUndefined();
    step(w, { p0: { ...neutral(), revive: true } }, 0.1);
    expect(down.hp).toBe(90);
    expect(r.supportRewards!.players.p0.actionAt).toBeCloseTo(w.time);
  });
  it("選択待機中は参加時間を増やさない", () => {
    const r = make([0, 0], 0);
    r.phase = "selection";
    r.selectionDeadline = null;
    for (let i = 0; i < 100; i++) stepFrontRun(r, {}, 0.1, i / 10);
    expect(r.supportRewards!.players.p0.present).toBe(0);
    expect(r.world.time).toBe(0);
  });
  it("決着を固定し再確定・後からの撃破加算で再配分しない", () => {
    const r = make();
    r.returnAt = 1;
    stepFrontRun(r, {}, 0.05, 2);
    expect(r.phase).toBe("victory");
    expect(r.world.rewards.p0).toHaveLength(3);
    expect(r.world.rewards.p1).toHaveLength(3);
    const before = structuredClone(r.world.rewards);
    r.world.players[0].kills = 999;
    stepFrontRun(r, {}, 0.05, 3);
    finalizeFrontSurvivalRewards(
      r.world,
      0,
      ["p0", "p1"],
      allocation(r).counts,
    );
    expect(r.world.rewards).toEqual(before);
    expect(getFrontRunView(r, "p1").rewardCount).toBe(3);
  });
  it("旧ラン/混在クライアント/ソロは従来の個人報酬を保つ", () => {
    for (const r of [make([90, 0], 180, false), make([90], 180, true)]) {
      expect(r.supportRewards).toBeUndefined();
      expect(getFrontRunView(r, "p0").rewardPolicy).toBe("individual-v1");
      r.returnAt = 1;
      stepFrontRun(r, {}, 0.05, 2);
      expect(r.world.rewards.p0).toHaveLength(6);
      if (r.world.players.length > 1) expect(r.world.rewards.p1).toEqual([]);
    }
  });
});

describe("支援報酬の受領・旧保存・再試行", () => {
  const spoils = () => {
    const r = make();
    r.world.phase = "victory";
    finalizeFrontSurvivalRewards(
      r.world,
      0,
      ["p0", "p1"],
      allocation(r).counts,
    );
    return {
      weapons: r.world.rewards.p1,
      kills: 0,
      clearedStage: 0,
      team: { version: 1 as const, kills: 90, size: 2 },
    };
  };
  it("撃破0の新規支援受領を保存し重複を拒否、旧個人検証を緩めない", () => {
    const s = storage(),
      input = spoils();
    expect(awardFrontCampaign(s, "support-run", 180, input)).toBe(30);
    const before = loadProgress("normal", s)!;
    const owned = [...before.inventory, ...before.pending].map((w) => w.id);
    for (const weapon of input.weapons) expect(owned).toContain(weapon.id);
    expect(awardFrontCampaign(s, "support-run", 180, input)).toBe(0);
    expect(loadProgress("normal", s)).toEqual(before);
    expect(() =>
      awardFrontCampaign(s, "support-run", 180, { ...input, team: undefined }),
    ).toThrow();
    expect(() =>
      awardFrontCampaign(s, "support-run", 180, {
        ...input,
        team: { version: 1, kills: 90, size: 1 },
      }),
    ).toThrow();
  });
  it("保存失敗後の再読込で支援受領を一度だけ回復する", () => {
    const s = storage();
    persistProgress(freshProgress("normal"), s);
    const fail = {
      ...s,
      setItem: (k: string, v: string) => {
        if (k === newSaveKey("normal")) throw Error("quota");
        s.setItem(k, v);
      },
    };
    expect(() =>
      queueFrontCampaignReward(fail, "support-run", 180, spoils()),
    ).toThrow();
    expect(recoverFrontCampaignRewards(s)).toBe(30);
    const recovered = loadProgress("normal", s);
    expect(recoverFrontCampaignRewards(s)).toBe(0);
    expect(loadProgress("normal", s)).toEqual(recovered);
  });
});
