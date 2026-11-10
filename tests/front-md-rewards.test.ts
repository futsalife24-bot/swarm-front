import { describe, expect, it } from "vitest";
import {
  FAMILIES,
  FAMILY_KINDS,
  KINDS,
  familyOf,
  rollRewardKind,
  STARTERS,
} from "../src/shared/defs";
import {
  makeWeapon,
  rollWeapon,
  type NewWeapon,
} from "../src/shared/progression";
import {
  addPlayer,
  createWorld,
  loot,
  start,
  spawn,
  fire,
  neutral,
} from "../src/shared/game";
import { initSolo, soloDrop } from "../src/shared/solo-progression";
import { finalizeFrontSurvivalRewards } from "../src/shared/front-survival";
import { beginDefense, settleDefense } from "../src/shared/daily-rewards";
import {
  freshProgress,
  grantResult,
  prepareChoice,
  chooseReward,
  persistProgress,
  loadProgress,
} from "../src/client/progression-save";

function rng(seed: number) {
  return () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
}
const owned = (id = "owned-md", acquired = 3) =>
  makeWeapon(
    id,
    "medic",
    0,
    { power: 0, reload: 0, range: 0, rate: 0 },
    true,
    acquired,
  );
function world(count = 1, solo = false, seed = 3) {
  const w = createWorld("md-reward", seed, 1);
  if (solo) initSolo(w, 1, "normal", true, { hp: 0, aim: 0, move: 0, swap: 0 });
  for (let i = 0; i < count; i++)
    addPlayer(w, "p" + i, [
      owned("p" + i + "-md"),
      { ...STARTERS[0], id: "p" + i + "-ar" },
    ]);
  start(w);
  return w;
}
describe("新規ソロ報酬のMD除外と既存所有の保護", () => {
  it("新規抽選は系統の比率と乱数2回を維持し、協力と既定経路にはMDを残す", () => {
    for (let family = 0; family < FAMILIES.length; family++) {
      const values = [(family + 0.5) / FAMILIES.length, 0.99];
      let calls = 0;
      const solo = rollRewardKind(() => values[calls++], "solo");
      expect(calls).toBe(2);
      expect(familyOf(solo)).toBe(FAMILIES[family]);
      expect(solo).not.toBe("medic");
      calls = 0;
      expect(rollRewardKind(() => values[calls++])).toBe(
        FAMILY_KINDS[FAMILIES[family]].at(-1),
      );
    }
    expect(rollRewardKind(() => 0.99, "party")).toBe("medic");
  });
  it("固定seed1万抽選でレア度・ロール・レベル・系統・乱数列を保ちソロだけMDを除外する", () => {
    const solo = rng(723),
      party = rng(723),
      old = rng(723);
    let md = 0;
    const soloKinds = new Set<string>();
    const byFamily = Object.fromEntries(FAMILIES.map((f) => [f, 0]));
    for (let i = 0; i < 10000; i++) {
      const a = rollWeapon("draw-" + i, 10, "normal", false, i, solo, "solo");
      const b = rollWeapon("draw-" + i, 10, "normal", false, i, party, "party");
      expect(rollWeapon("draw-" + i, 10, "normal", false, i, old)).toEqual(b);
      expect(a.kind).not.toBe("medic");
      soloKinds.add(a.kind);
      expect(familyOf(a.kind)).toBe(familyOf(b.kind));
      expect([
        a.rarity,
        a.power,
        a.variance,
        a.level,
        a.acquired,
        a.testData,
      ]).toEqual([
        b.rarity,
        b.power,
        b.variance,
        b.level,
        b.acquired,
        b.testData,
      ]);
      byFamily[familyOf(a.kind)]++;
      if (b.kind === "medic") md++;
    }
    expect(md).toBeGreaterThan(600);
    expect(soloKinds.size).toBe(KINDS.length - 1);
    for (const count of Object.values(byFamily))
      expect(count).toBeGreaterThan(1500);
    expect(solo()).toBe(party());
  });
  it("ソロ進撃の新規ドロップ/報酬にMDを出さず、持込MDを変えない", () => {
    const w = world(1, true);
    const before = structuredClone(w.players[0].weapons);
    for (let i = 0; i < 1000; i++) expect(loot(w).kind).not.toBe("medic");
    const e = spawn(w, "ant", 0, 0)!;
    let generated = 0;
    for (let i = 0; i < 1000; i++) {
      w.drops = [];
      soloDrop(w, e);
      for (const drop of w.drops) {
        expect(drop.weapon.kind).not.toBe("medic");
        generated++;
      }
    }
    expect(generated).toBeGreaterThan(20);
    expect(w.players[0].weapons).toEqual(before);
  });
  it("生存報酬は出撃時の人数を使い、協力の味方切断でMDを除外しない・再確定しない", () => {
    const coop = world(2),
      solo = world(1);
    coop.players[1].connected = false;
    let coMd = 0;
    for (let i = 0; i < 80; i++) {
      for (const w of [solo, coop]) {
        w.phase = "victory";
        w.time = 180;
        w.players.forEach((p) => (p.kills = 60));
        w.rewards = {};
        finalizeFrontSurvivalRewards(
          w,
          0,
          w.players.map((p) => p.id),
        );
        const rewards = w.rewards.p0 as NewWeapon[];
        expect(rewards).toHaveLength(5);
        if (w === solo)
          expect(rewards.every((r) => r.kind !== "medic")).toBe(true);
        else coMd += rewards.filter((r) => r.kind === "medic").length;
        const saved = structuredClone(w.rewards);
        finalizeFrontSurvivalRewards(
          w,
          0,
          w.players.map((p) => p.id),
        );
        expect(w.rewards).toEqual(saved);
      }
    }
    expect(coMd).toBeGreaterThan(0);
    let legacyCoopMd = 0;
    for (let i = 0; i < 1000; i++) {
      if (loot(coop).kind === "medic") legacyCoopMd++;
      expect(loot(solo).kind).not.toBe("medic");
    }
    expect(legacyCoopMd).toBeGreaterThan(30);
  });
  it("ソロ防衛の保証・ボーナスだけを除外し、既存所有品は保持する", () => {
    const save = freshProgress("test");
    save.inventory.push(owned());
    save.serial = 4;
    const active = beginDefense(
      save,
      "2026-10-20",
      "md-defense-00000001",
      () => 0.99,
    );
    expect(active.inventory.filter((w) => w.kind === "medic")).toEqual([
      owned(),
    ]);
    const ended = settleDefense(
      active,
      "md-defense-00000001",
      "victory",
      2000,
      2000,
      () => 0.99,
    );
    expect(ended.inventory.length).toBeGreaterThan(active.inventory.length);
    expect(ended.inventory.filter((w) => w.kind === "medic")).toEqual([
      owned(),
    ]);
    expect(
      settleDefense(
        ended,
        "md-defense-00000001",
        "victory",
        2000,
        2000,
        () => 0.99,
      ),
    ).toBe(ended);
  });
  it("進撃の新規初回/追加候補を除外し、以前受領したMDと保存済み候補は変えない", () => {
    const input = {
      run: "md-receipt",
      stage: 21,
      difficulty: "normal" as const,
      win: true,
      time: 90,
      kills: 20,
      missions: [true, true, true],
      weapons: [owned("old-reward-md")],
      collected: 1,
    };
    const awarded = grantResult(freshProgress("test"), input, () => 0.99);
    expect(awarded.result!.weapons).toHaveLength(4);
    expect(
      awarded
        .result!.weapons.filter((w) => w.kind === "medic")
        .map((w) => w.id),
    ).toEqual(["old-reward-md"]);
    const choice = prepareChoice(awarded, () => 0.99);
    expect(choice.result!.bonus).toHaveLength(3);
    expect(choice.result!.bonus.every((w) => w.kind !== "medic")).toBe(true);
    expect(grantResult(choice, input, () => 0.99)).toBe(choice);
    const oldChoice = structuredClone(choice);
    oldChoice.result!.bonus = [owned("saved-choice-md", oldChoice.serial++)];
    expect(prepareChoice(oldChoice, () => 0.99)).toBe(oldChoice);
    expect(
      chooseReward(oldChoice, true).inventory.some(
        (w) => w.id === "saved-choice-md",
      ),
    ).toBe(true);
  });
  it("新旧MDの保存・再読込・装備を維持し、自己回復を追加しない", () => {
    const save = freshProgress("test");
    const md = owned();
    save.inventory.push(md);
    save.serial = 5;
    const legacy = {
      ...STARTERS[0],
      id: "legacy-md",
      kind: "medic" as const,
      acquired: 4,
      testData: true,
    };
    save.pending.push(legacy);
    save.soldiers[0].equipped = [md.id, save.inventory[0].id];
    const values = new Map<string, string>();
    const storage = {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => {
        values.set(k, v);
      },
    };
    persistProgress(save, storage);
    const loaded = loadProgress("test", storage)!;
    expect(loaded.inventory.find((w) => w.id === md.id)).toEqual(md);
    expect(loaded.pending.find((w) => w.id === legacy.id)).toEqual(legacy);
    expect(loaded.soldiers[0].equipped).toContain(md.id);
    const w = world(1, true);
    const p = w.players[0];
    p.hp = 20;
    fire(w, p, { ...neutral(), fire: true });
    expect(p.hp).toBe(20);
    expect(w.events.some((e) => e.type === "heal")).toBe(false);
  });
});
