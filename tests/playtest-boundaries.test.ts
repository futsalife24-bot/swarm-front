import { it, expect } from "vitest";
import {
  createWorld,
  addPlayer,
  start,
  step,
  neutral,
  spawn,
  hurtEnemy,
  random,
} from "../src/shared/game";
import {
  initSolo,
  soloDrop,
  updateBranch,
  dropPosition,
  dropAt,
} from "../src/shared/solo-progression";
import {
  blankLevels,
  freshProgress,
  grantResult,
  prepareChoice,
  chooseReward,
  loadProgress,
  persistProgress,
} from "../src/client/progression-save";
import { recordCoopEncounters } from "../src/client/progression-coop";
import { STAGES, troopCount } from "../src/shared/stages";
import { blocked } from "../src/shared/game";
function fixture() {
  const w = createWorld("edge", 42, 3);
  initSolo(w, 3, "normal", false, blankLevels());
  const p = addPlayer(w, "solo");
  start(w);
  return { w, p };
}
it("ST3 landmark flags only the current run; loss never unlocks branch or missions", () => {
  const { w, p } = fixture();
  p.x = 0;
  p.z = -36;
  updateBranch(w);
  expect(w.solo!.branchReached).toBe(true);
  expect(blocked(p.x, p.z, 0.55)).toBe(false);
  const save = grantResult(
    freshProgress("normal"),
    {
      run: w.run,
      stage: 3,
      difficulty: "medium",
      win: false,
      time: 20,
      kills: 2,
      missions: [false, false, false],
      weapons: [],
      collected: 0,
    },
    () => 0.1,
  );
  expect(save.branch).toBe(false);
  expect(save.missions).toEqual({});
});
it("same tick final kill and player down resolves victory with the player still down", () => {
  const { w, p } = fixture();
  w.wave = STAGES[2].waves.length;
  w.spawned = troopCount(STAGES[2].waves.at(-1)!);
  w.solo!.bossSpawned = 0;
  w.enemies = [];
  const e = spawn(w, "crawler", p.x, p.z - 5)!;
  e.hp = 1;
  w.projectiles = [
    {
      id: 99,
      x: e.x,
      y: e.y + 1.4,
      z: e.z,
      dx: 0.1,
      dy: 0,
      dz: 0,
      life: 1,
      owner: p.id,
      damage: 100,
      rocket: true,
    },
    {
      id: 100,
      x: p.x,
      y: (p.y ?? 0) + 1.2,
      z: p.z,
      dx: 0.1,
      dy: 0,
      dz: 0,
      life: 1,
      owner: "enemy",
      damage: 1000,
      rocket: false,
    },
  ];
  step(w, { solo: neutral() });
  expect(w.phase).toBe("victory");
  expect(p.hp).toBe(0);
  expect(w.rewards.solo).toHaveLength(2);
});
it("both drop types can appear together and enforce independent caps without replacing older items", () => {
  const { w, p } = fixture();
  let seed = 0;
  for (; seed < 100000; seed++) {
    w.seed = seed;
    if (random(w) < 0.05 && random(w) < 0.02) break;
  }
  expect(seed).toBeLessThan(100000);
  const e = spawn(w, "crawler", p.x, p.z)!;
  for (let i = 0; i < 15; i++) {
    w.seed = seed;
    soloDrop(w, e);
  }
  expect(w.drops.filter((d) => d.type === "weapon")).toHaveLength(10);
  expect(w.drops.filter((d) => d.type === "heal")).toHaveLength(10);
  const first = w.drops[0].id;
  w.seed = seed;
  soloDrop(w, e);
  expect(w.drops[0].id).toBe(first);
  w.drops = w.drops.filter((d) => d.type !== "heal");
  w.seed = seed;
  soloDrop(w, e);
  expect(w.drops.filter((d) => d.type === "heal")).toHaveLength(1);
  expect(w.drops.filter((d) => d.type === "weapon")).toHaveLength(10);
  const d = w.drops[0];
  const at = dropAt(w, d);
  expect(Number.isFinite(at.x + at.z + at.jump)).toBe(true);
});
it("co-op only adds silhouettes to initialized normal save and preserves solo status/test save", () => {
  const m = new Map<string, string>();
  const storage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
  const s = freshProgress("normal");
  s.encounters.crawler = "solo";
  persistProgress(s);
  const t = freshProgress("test");
  persistProgress(t);
  const { w } = fixture();
  spawn(w, "ant");
  recordCoopEncounters(w);
  expect(loadProgress("normal")!.encounters).toEqual({
    crawler: "solo",
    ant: "coop",
  });
  expect(loadProgress("test")!.encounters).toEqual({});
  delete (globalThis as any).localStorage;
});
