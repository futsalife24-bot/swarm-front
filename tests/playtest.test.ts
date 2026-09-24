import { normalSaveId } from "../src/shared/campaign";
import { it, expect } from "vitest";
import { fresh as freshLegacySave } from "../src/client/save";
import {
  makeWeapon,
  rollWeapon,
  newStats,
  weighted,
  rarityWeights,
  SKILLS,
  COSTS,
  CAPACITY,
  type NewWeapon,
} from "../src/shared/progression";
import {
  freshProgress,
  validateProgress,
  persistProgress,
  loadProgress,
  initializeProgress,
  bank,
  refill,
  dismantle,
  allocate,
  unlockSkill,
  grantResult,
  prepareChoice,
  chooseReward,
  appendCollected,
  canSortie,
  synthesize,
  createAccessory,
  blankLevels,
  type ProgressSave,
} from "../src/client/progression-save";
import {
  createWorld,
  addPlayer,
  start,
  step,
  neutral,
  spawn,
  hurtEnemy,
  random,
  finish,
  fire,
} from "../src/shared/game";
import {
  initSolo,
  useMedkit,
  reviveSolo,
  maxHp,
  collectSolo,
  soloDrop,
  collectionStep,
  soloResolved,
} from "../src/shared/solo-progression";
import { validWeapon, stats, STARTERS } from "../src/shared/defs";
import { STAGES, troopCount } from "../src/shared/stages";
const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    values,
  };
};
const weapon = (id: string, n = 0, rarity = 0, test = false) =>
  makeWeapon(
    id,
    "rifle",
    rarity,
    { power: n, reload: n, range: n, rate: n },
    test,
    Number(id.replace(/\D/g, "")) || 0,
  );
function win(
  s: ProgressSave,
  stage = 1,
  difficulty: "normal" | "medium" = "normal",
  run = `run-${stage}-${difficulty}`,
) {
  return grantResult(
    s,
    {
      run,
      stage,
      difficulty,
      win: true,
      time: 90,
      kills: 32,
      missions: [true, true, true],
      weapons: [
        weapon(run + "1", 0, 0, s.mode === "test"),
        weapon(run + "2", 0, 0, s.mode === "test"),
      ],
      collected: 0,
    },
    () => 0.1,
  );
}
function ready(s: ProgressSave) {
  return chooseReward(
    prepareChoice(s, () => 0.1),
    false,
  );
}
function fixture() {
  const w = createWorld("fixture", 42, 1);
  initSolo(w, 1, "normal", true, blankLevels());
  const p = addPlayer(w, "solo", [
    weapon("w1", 0, 0, true),
    { ...weapon("w2", 0, 0, true), kind: "shotgun" },
  ]);
  start(w);
  return { w, p };
}
it("backs up legacy verbatim, isolates normal/test, rejects invalid saves, and reports write failures", () => {
  const storage = memory();
  const original = JSON.stringify(freshLegacySave(), null, 2);
  storage.setItem("swarm-front-save-v1", original);
  const n = initializeProgress("normal", storage);
  expect(storage.getItem("swarm-front-save-v1-before-shared-armory")).toBe(
    original,
  );
  expect(storage.getItem("swarm-front-save-v1")).toBe(original);
  const corrupt = memory();
  corrupt.setItem("swarm-front-save-v1", "legacy-exact");
  expect(() => initializeProgress("normal", corrupt)).toThrow();
  expect(corrupt.getItem("swarm-front-save-v1")).toBe("legacy-exact");
  expect(corrupt.getItem("swarm-front-progression-v2-normal")).toBeNull();
  initializeProgress("test", storage);
  expect(loadProgress("normal", storage)).toEqual(n);
  expect(loadProgress("test", storage)!.unlocked).toEqual(SKILLS);
  expect(() =>
    persistProgress(n, {
      setItem() {
        throw Error("quota");
      },
    }),
  ).toThrow("保存");
  const bad = structuredClone(n);
  bad.coins = NaN;
  expect(() => validateProgress(bad)).toThrow();
});
it("unlocks sequential stages and first rewards once across all 54 mission sets", () => {
  let s = freshProgress("normal");
  expect(canSortie(s, 2, "normal")).toBe(false);
  for (const stage of Array.from({ length: 25 }, (_, i) => normalSaveId(i + 1)))
    for (const difficulty of ["normal", "medium"] as const) {
      expect(canSortie(s, stage, difficulty)).toBe(true);
      s = ready(win(s, stage, difficulty));
      s = dismantle(
        s,
        s.inventory
          .filter(
            (w) =>
              !s.soldiers[0].equipped.includes(w.id) && w.id.startsWith("run-"),
          )
          .map((w) => w.id),
      );
      expect(s.points).toBe(
        Math.min(120, (stage - 1) * 6 + (difficulty === "normal" ? 3 : 6)),
      );
    }
  expect(s.points).toBe(120);
  expect(s.materials).toBe(4);
  const before = s.points;
  s = ready(win(s, 1, "normal", "replay"));
  expect(s.points).toBe(before);
  expect(s.materials).toBe(4);
  s.branch = true;
  s = ready(win(s, 21, "normal"));
  expect(s.points).toBe(120);
  expect(canSortie(s, 21, "medium")).toBe(true);
  s = ready(win(s, 21, "medium"));
  s = ready(win(s, 27, "normal"));
  s = ready(win(s, 27, "medium"));
  expect(Object.values(s.missions).flat().filter(Boolean)).toHaveLength(162);
  expect(s.points).toBe(120);
});
it("retains rewards through pending choice and reload; notifications cannot reroll or duplicate bonuses", () => {
  let s = win(freshProgress("test"), 21);
  const once = JSON.stringify(s);
  expect(
    grantResult(
      s,
      {
        run: s.result!.run,
        stage: 21,
        difficulty: "normal",
        win: true,
        time: 0,
        kills: 0,
        missions: [true, true, true],
        weapons: [],
        collected: 0,
      },
      () => 0.99,
    ),
  ).toBe(s);
  expect(JSON.stringify(s)).toBe(once);
  s = appendCollected(s, [weapon("extra", 0, 0, true)]);
  s = prepareChoice(s, () => 0.2);
  expect(s.result!.bonus).toHaveLength(3);
  const storage = memory();
  persistProgress(s, storage);
  const loaded = loadProgress("test", storage)!;
  expect(loaded.result).toEqual(s.result);
  const boosted = chooseReward(loaded, true);
  expect(boosted.coins - s.coins).toBe(140);
  expect(boosted.result!.weapons).toHaveLength(9);
  expect(chooseReward(boosted, true)).toBe(boosted);
  expect(prepareChoice(boosted, () => 0.99)).toBe(boosted);
  expect(() =>
    chooseReward(
      prepareChoice(win(freshProgress("normal")), () => 0.1),
      true,
    ),
  ).toThrow("追加報酬は現在利用できません");
});
it("overflow blocks sortie, all registered gear/locks survive, refill prioritizes locks without reordering acquisition", () => {
  let s = freshProgress("normal");
  bank(
    s,
    Array.from({ length: 20 }, (_, i) => weapon(`extra-${i + 10}`)),
  );
  expect(s.inventory.filter((w) => w.kind === "rifle")).toHaveLength(16);
  expect(s.pending).toHaveLength(5);
  expect(canSortie(s, 1, "normal")).toBe(false);
  s.locks.push(s.pending[4].id);
  const locked = s.pending[4].id,
    other = s.inventory[3].id;
  s.soldiers.push({
    id: "second",
    name: "2",
    levels: blankLevels(),
    equipped: [other, s.inventory[1].id],
  });
  expect(() => dismantle(s, [other])).toThrow();
  const removable = s.inventory.find(
    (w) => w.id !== other && w.id.startsWith("extra-"),
  )!;
  s = dismantle(s, [removable.id]);
  expect(s.inventory.some((w) => w.id === locked)).toBe(true);
  expect(s.pending).toHaveLength(4);
  expect(() => dismantle(s, [locked])).toThrow();
});
it("each soldier independently spends the same pool; only refunds cost coins", () => {
  let s = freshProgress("normal");
  s.points = 15;
  s.materials = 4;
  s.coins = 1000;
  for (const k of SKILLS) s = unlockSkill(s, k);
  s.soldiers.push({ ...structuredClone(s.soldiers[0]), id: "second" });
  s = allocate(s, "standard", { hp: 2, aim: 0, move: 0, swap: 0 });
  s = allocate(s, "second", { hp: 0, aim: 2, move: 0, swap: 0 });
  expect(s.coins).toBe(1000);
  expect(() =>
    allocate(s, "standard", { hp: 2, aim: 1, move: 0, swap: 0 }),
  ).toThrow();
  s = allocate(s, "standard", { hp: 1, aim: 0, move: 0, swap: 0 });
  expect(s.coins).toBe(500);
  expect(s.soldiers[1].levels.aim).toBe(2);
});
it("rarity range excludes out-of-range draws, each variance uses favorable direction and fixed magazines", () => {
  let seed = 42;
  const rng = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (const stage of [1, 6, 11, 18, 20, 21])
    for (const d of ["normal", "medium"] as const) {
      const counts = [0, 0, 0, 0, 0];
      for (let i = 0; i < 10000; i++) {
        const w = rollWeapon(`w${i}`, stage, d, false, i, rng);
        expect(rarityWeights(stage, d)[w.rarity]).toBeGreaterThan(0);
        counts[w.rarity]++;
        expect(validWeapon(w)).toBe(false);
      }
      if (stage >= 18 && stage <= 20 && d === "medium")
        expect(counts[4]).toBeGreaterThan(0);
    }
  for (const n of [-10, -1, 0, 1, 9, 10, 19, 20]) {
    const w = weapon("test", n, 2);
    expect(stats(w).reload).toBeCloseTo(1.65 / (1.15 ** 2 * (1 + n / 100)));
    expect(stats(w).mag).toBe(40);
    expect(stats(w).damage).toBeCloseTo(24 * 1.15 ** 2 * (1 + n / 100));
  }
  expect(stats(STARTERS[0]).damage).toBe(24);
  expect(validWeapon(STARTERS[0])).toBe(true);
});
it("accessory synthesis previews cascading consumption, protects every registered item, and returns yields", () => {
  let s = freshProgress("test");
  s.powder = 40;
  s = createAccessory(s, "healing", () => 0);
  expect(s.powder).toBe(10);
  expect(s.accessories[0].kind).toBe("healing");
  s.accessories = Array.from({ length: 720 }, (_, i) => ({
    id: `a${i}`,
    kind: "pickup" as const,
    rarity: 1,
    locked: false,
    testData: true,
  }));
  s.serial = 1000;
  const preview = synthesize(s);
  expect(preview.save.accessories).toHaveLength(1);
  expect(preview.save.accessories[0].rarity).toBe(6);
  expect(s.accessories).toHaveLength(720);
  s.accessories[0].locked = true;
  s.soldiers[0].accessory = s.accessories[1].id;
  expect(synthesize(s).save.accessories.some((a) => a.id === "a0")).toBe(true);
  expect(synthesize(s).save.accessories.some((a) => a.id === "a1")).toBe(true);
});
it("heals to half without lowering high HP, medkit is single-use and revival preserves combat data", () => {
  const { w, p } = fixture();
  p.hp = 60;
  p.safe = 6;
  step(w, { solo: neutral() });
  expect(p.hp).toBeCloseTo(60.15);
  p.hp = 100;
  step(w, { solo: neutral() });
  expect(p.hp).toBe(100);
  expect(useMedkit(w)).toBe(true);
  expect(p.hp).toBe(160);
  expect(useMedkit(w)).toBe(false);
  p.hp = 0;
  p.ammo = [3, 2];
  p.reload = 1.2;
  w.pending.solo = [weapon("collected", 0, 0, true)];
  const enemies = structuredClone(w.enemies);
  expect(reviveSolo(w)).toBe(true);
  expect(p.hp).toBe(80);
  expect(p.ammo).toEqual([3, 2]);
  expect(p.reload).toBe(1.2);
  expect(w.pending.solo).toHaveLength(1);
  expect(w.enemies).toEqual(enemies);
  expect(w.solo!.medkit).toBe(false);
  expect(reviveSolo(w)).toBe(false);
});
it("weapon switching preserves active reload and cannot cancel fire cooldown", () => {
  const { w, p } = fixture();
  p.ammo[0] = 0;
  p.reload = 1;
  p.cool = 0.7;
  step(w, { solo: { ...neutral(), swap: true } });
  expect(p.reloadSlots![0]).toBeCloseTo(0.95);
  expect(p.cool).toBeCloseTo(0.65);
  expect(p.swapCd).toBe(1);
  for (let i = 0; i < 21; i++) step(w, { solo: neutral() });
  expect(p.ammo[0]).toBe(32);
});
it("independent drop caps do not limit total collections, full HP leaves healing, and victory keeps manual collection", () => {
  const { w, p } = fixture();
  for (let i = 0; i < 30; i++) {
    w.drops.push({
      id: `d${i}`,
      x: p.x,
      z: p.z,
      owner: p.id,
      type: "weapon",
      weapon: weapon(`d${i}`, 0, 0, true),
    });
    collectSolo(w, p);
  }
  expect(w.pending.solo).toHaveLength(30);
  w.drops.push({
    id: "heal",
    x: p.x,
    z: p.z,
    owner: p.id,
    type: "heal",
    weapon: weapon("h", 0, 0, true),
  });
  collectSolo(w, p);
  expect(w.drops).toHaveLength(1);
  p.hp = 100;
  collectSolo(w, p);
  expect(p.hp).toBe(132);
  expect(w.drops).toHaveLength(0);
  finish(w, true);
  const time = w.time;
  collectionStep(w, { ...neutral(), mz: 1 }, 1);
  expect(w.time).toBe(time);
  expect(w.solo!.collection).toBe(1);
});
it("unspawned enemies prevent wins; timers do not accumulate multiple waves behind the cap", () => {
  const { w } = fixture();
  w.enemies = [];
  expect(soloResolved(w)).toBe(false);
  step(w, { solo: neutral() });
  expect(w.phase).toBe("battle");
  expect(w.spawned).toBe(1);
  w.enemies = Array.from({ length: 120 }, (_, i) => ({
    ...w.enemies[0],
    id: i + 10,
  }));
  w.time = 1000;
  const wave = w.wave;
  for (let i = 0; i < 5; i++) step(w, { solo: neutral() });
  expect(w.wave).toBe(wave);
  expect(w.spawned).toBe(1);
});
