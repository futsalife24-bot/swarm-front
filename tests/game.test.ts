import { describe, it, expect } from "vitest";
import {
  STARTERS,
  LIMITS,
  POWER,
  LR_POWER,
  validWeapon,
  type Weapon,
} from "../src/shared/defs";
import {
  createWorld,
  addPlayer,
  start,
  spawn,
  step,
  neutral,
  fire,
  loot,
  validInput,
  finish,
} from "../src/shared/game";
import {
  fresh,
  parseSave,
  persist,
  rewards,
  trimToKindCap,
} from "../src/client/save";
import { pilot } from "./bot";
function fixture() {
  const w = createWorld("test", 42),
    p = addPlayer(w, "p");
  p.x = 0;
  p.z = 0;
  start(w);
  w.nextSpawn = 1e9;
  return { w, p };
}
describe("authoritative combat", () => {
  it("rifle fires at its cadence and reloads instead of accepting spam", () => {
    const { w, p } = fixture();
    spawn(w, "boss", 0, -20);
    const i = { ...neutral(), fire: true };
    for (let n = 0; n < 20; n++) step(w, { p: i });
    expect(p.ammo[0]).toBe(25);
    expect(w.enemies[0].hp).toBeLessThan(4200);
  });
  it("blocks bullets and aim assistance through a building", () => {
    const { w, p } = fixture();
    p.x = 17;
    p.z = 15;
    spawn(w, "crawler", 17, -6);
    fire(w, p, { ...neutral(), fire: true });
    expect(w.enemies[0].hp).toBe(75);
  });
  it("shotgun has close-range pellets; rocket damages multiple enemies", () => {
    const a = fixture();
    a.p.weapons = [STARTERS[1], STARTERS[0]];
    a.p.ammo = [7, 32];
    spawn(a.w, "boss", 0, -5);
    fire(a.w, a.p, { ...neutral(), fire: true });
    expect(a.w.enemies[0].hp).toBeLessThan(4100);
    const b = fixture();
    b.p.weapons = [STARTERS[2], STARTERS[0]];
    b.p.ammo = [2, 32];
    spawn(b.w, "crawler", 0, -10);
    spawn(b.w, "crawler", 2, -10);
    fire(b.w, b.p, { ...neutral(), fire: true });
    for (let n = 0; n < 20; n++) step(b.w, {});
    expect(b.w.totalKills).toBe(2);
  });
  it("pierce changes combat by hitting three aligned enemies but not a fourth", () => {
    const { w, p } = fixture();
    p.weapons[0] = { ...STARTERS[0], rarity: 1, effect: "pierce" };
    for (const z of [-5, -9, -13, -17]) spawn(w, "crawler", 0, z);
    fire(w, p, neutral());
    expect(w.enemies.map((e) => e.hp)).toEqual([51, 51, 51, 75]);
  });
  it("revive requires a living nearby ally and sustained input", () => {
    const { w, p } = fixture();
    const ally = addPlayer(w, "ally");
    ally.x = 2;
    ally.z = 0;
    p.hp = 0;
    p.down = 25;
    for (let n = 0; n < 3600; n++) step(w, {});
    expect(p.down).toBe(25);
    for (let n = 0; n < 49; n++)
      step(w, { ally: { ...neutral(), revive: true } });
    expect(p.hp).toBe(0);
    for (let n = 0; n < 3; n++)
      step(w, { ally: { ...neutral(), revive: true } });
    expect(p.hp).toBe(90);
  });
  it("solo defeat is terminal and discards only unconfirmed rewards", () => {
    const { w, p } = fixture();
    w.pending.p = [loot(w)];
    p.hp = 0;
    step(w, {});
    expect(w.phase).toBe("defeat");
    expect(w.pending.p).toEqual([]);
  });
  it("four-player difficulty scales and enemy count is capped at 40", () => {
    const { w } = fixture();
    for (let n = 0; n < 3; n++) addPlayer(w, `p${n}`);
    start(w);
    for (let n = 0; n < 60; n++) spawn(w, "crawler", 0, -20);
    expect(w.scale).toBe(2.6500000000000004);
    expect(w.enemies).toHaveLength(LIMITS.enemies);
  });
  it("rejects nonfinite, oversized axes, wrong booleans and illegal weapons", () => {
    expect(validInput({ ...neutral(), mx: 2 })).toBe(false);
    expect(validInput({ ...neutral(), yaw: NaN })).toBe(false);
    expect(validInput({ ...neutral(), fire: 1 })).toBe(false);
    expect(validWeapon({ ...STARTERS[0], power: 9 })).toBe(false);
    expect(validWeapon({ ...STARTERS[2], effect: "pierce", rarity: 2 })).toBe(
      false,
    );
  });
  it("bounded loot includes all weapon families, rarities and piercing", () => {
    const w = createWorld("loot", 53),
      items = Array.from({ length: 100000 }, () => loot(w));
    expect(items.slice(0, 1793).every(validWeapon)).toBe(true);
    expect(items.every(validWeapon)).toBe(true);
    expect(new Set(items.map((w) => w.id)).size).toBe(100000);
    expect(new Set(items.map((w) => w.kind)).size).toBe(3);
    // Four tiers now: R, SR, SSR, and the LR an SSR is promoted into.
    expect(new Set(items.map((w) => w.rarity))).toEqual(new Set([0, 1, 2, 3]));
    expect(items.some((w) => w.effect === "pierce")).toBe(true);
  });
  it("solo starter pilot completes the real mission without stat/time cheats", () => {
    const w = createWorld("pilot", 814);
    addPlayer(w, "p");
    start(w);
    let max = 0;
    const t = performance.now();
    for (let n = 0; n < 12001 && w.phase === "battle"; n++) {
      step(w, { p: pilot(w, "p") });
      max = Math.max(max, w.enemies.length);
    }
    console.log(
      JSON.stringify({
        mission: w.phase,
        seconds: w.time,
        kills: w.totalKills,
        hp: w.players[0].hp,
        position: [w.players[0].x, w.players[0].z],
        enemies: w.enemies.map((e) => ({
          kind: e.kind,
          x: e.x,
          z: e.z,
          hp: e.hp,
        })),
        maxEnemies: max,
        simulationMs: performance.now() - t,
      }),
    );
    expect(w.phase).toBe("victory");
    expect(w.time).toBeLessThan(600);
    expect(w.rewards.p.length).toBeGreaterThanOrEqual(1);
  });
});
describe("versioned local inventory", () => {
  it("accepts exact milli-power boundaries and saves a 1.36 victory reward across reload", () => {
    const item = {
      ...STARTERS[0],
      id: "boundary",
      rarity: 2 as const,
      power: 1.36,
    };
    expect(validWeapon(item)).toBe(true);
    for (const power of [1.361, 1.36001, NaN, Infinity, 0.999])
      expect(validWeapon({ ...item, power })).toBe(false);
    for (const rarity of [0, 1, 2] as const) {
      expect(
        validWeapon({ ...item, rarity, power: [1.12, 1.24, 1.36][rarity] }),
      ).toBe(true);
      expect(
        validWeapon({ ...item, rarity, power: [1.121, 1.241, 1.361][rarity] }),
      ).toBe(false);
    }
    const { w } = fixture();
    w.pending.p = [item];
    finish(w, true);
    const saved = rewards(fresh(), w.run, w.rewards.p).save;
    saved.equipped = [item.id, saved.equipped[0]];
    let raw = "";
    persist(saved, {
      setItem(_key, value) {
        raw = value;
      },
    });
    const loaded = parseSave(raw);
    expect(loaded.inventory.find((x) => x.id === item.id)).toEqual(item);
    expect(loaded.inventory.every(validWeapon)).toBe(true);
    expect(loaded.equipped[0]).toBe(item.id);
  });
  it("persists unique weapons and equipped IDs across reloads", () => {
    const w = createWorld("save");
    addPlayer(w, "p");
    start(w);
    finish(w, true);
    let s = rewards(fresh(), w.run, w.rewards.p).save;
    s.equipped = [w.rewards.p[0].id, s.equipped[0]];
    s = parseSave(JSON.stringify(s));
    expect(s.equipped[0]).toBe(w.rewards.p[0].id);
    expect(rewards(s, w.run, w.rewards.p).save.inventory).toHaveLength(
      s.inventory.length,
    );
  });
  it("does not silently reset corrupted or newer-format saves", () => {
    expect(() => parseSave("{broken")).toThrow();
    expect(() =>
      parseSave(JSON.stringify({ ...fresh(), version: 2 })),
    ).toThrow();
  });
  it("surfaces storage failure and preserves equipped inventory at capacity", () => {
    expect(() =>
      persist(fresh(), {
        setItem() {
          throw new Error("quota");
        },
      }),
    ).toThrow("保存に失敗");
    const s = fresh();
    for (let n = 0; n < 77; n++)
      s.inventory.push({ ...STARTERS[0], id: `extra-${n}` });
    const w = { ...STARTERS[2], id: "new" };
    const result = rewards(s, "r", [w]);
    expect(result.save.inventory).toHaveLength(80);
    expect(result.overflow).toEqual([w]);
    expect(result.save.receipts).not.toContain("r");
    expect(result.save.equipped).toEqual(s.equipped);
  });
});
describe("per-family armoury cap", () => {
  it("refuses a family that is full while other families still take drops", () => {
    const save = fresh();
    const make = (kind: Weapon["kind"], n: number, rarity: 0 | 1 | 2 = 0) =>
      Array.from({ length: n }, (_, i) => ({
        id: `${kind}-${rarity}-${i}`,
        kind,
        rarity,
        power: 1,
        effect: "none" as const,
      }));
    const filled = {
      ...save,
      inventory: [...save.inventory, ...make("rifle", LIMITS.perKind)],
    };
    const r = rewards(filled, "run-1", [
      ...make("rifle", 1).map((w) => ({ ...w, id: "new-rifle" })),
      ...make("rocket", 1).map((w) => ({ ...w, id: "new-rocket" })),
    ]);
    expect(r.overflow.map((w) => w.id)).toEqual(["new-rifle"]);
    expect(r.save.inventory.some((w) => w.id === "new-rocket")).toBe(true);
    // A run with anything unsaved must stay re-savable.
    expect(r.save.receipts).not.toContain("run-1");
  });
  it("trims an old armoury to the cap, weakest first, keeping what is equipped", () => {
    const base = fresh();
    const extras = Array.from({ length: 12 }, (_, i) => ({
      id: "rifle-extra-" + i,
      kind: "rifle" as const,
      rarity: (i < 2 ? 2 : 0) as 0 | 2,
      power: 1 + i / 1000,
      effect: "none" as const,
    }));
    const equippedRifle = base.inventory.find((w) => w.kind === "rifle")!;
    const { save, removed } = trimToKindCap({
      ...base,
      inventory: [...base.inventory, ...extras],
    });
    expect(save.inventory.filter((w) => w.kind === "rifle")).toHaveLength(
      LIMITS.perKind,
    );
    expect(save.inventory.some((w) => w.id === equippedRifle.id)).toBe(true);
    // The two RELIC rifles outrank the standard ones and must survive.
    expect(save.inventory.some((w) => w.id === "rifle-extra-0")).toBe(true);
    expect(save.inventory.some((w) => w.id === "rifle-extra-1")).toBe(true);
    expect(removed.every((w) => w.rarity === 0)).toBe(true);
    expect(removed.every((w) => !base.equipped.includes(w.id))).toBe(true);
  });
});
describe("LR promotion", () => {
  it("is earned by rolling everything at once, and stays rare", () => {
    const w = createWorld("lr", 20260908);
    const counts = [0, 0, 0, 0];
    const lr: ReturnType<typeof loot>[] = [];
    for (let n = 0; n < 200000; n++) {
      const item = loot(w);
      counts[item.rarity]++;
      if (item.rarity === 3 && lr.length < 400) lr.push(item);
    }
    const rate = counts[3] / 200000;
    // Rare, but reachable: a run yields roughly fifteen drops.
    expect(rate).toBeGreaterThan(0.0005);
    expect(rate).toBeLessThan(0.01);
    // Every LR must have cleared both gates.
    for (const item of lr) {
      expect(item.effect).not.toBe("none");
      expect(Math.round(item.power * POWER.scale)).toBeGreaterThanOrEqual(
        LR_POWER,
      );
      expect(validWeapon(item)).toBe(true);
    }
    // It is recognition, not power creep: no LR beats the SSR ceiling.
    const ceiling = POWER.max[2] / POWER.scale;
    expect(Math.max(...lr.map((i) => i.power))).toBeLessThanOrEqual(ceiling);
    expect(counts[0] + counts[1] + counts[2] + counts[3]).toBe(200000);
  });
  it("keeps older saves loadable and survives a round trip", () => {
    const store = new Map<string, string>();
    const save = fresh();
    const relic = {
      id: "lr-1",
      kind: "rifle" as const,
      rarity: 3 as const,
      power: POWER.max[2] / POWER.scale,
      effect: "pierce" as const,
    };
    expect(validWeapon(relic)).toBe(true);
    persist(
      { ...save, inventory: [...save.inventory, relic] },
      {
        setItem: (k, v) => void store.set(k, v),
      },
    );
    const back = parseSave(store.get("swarm-front-save-v1")!);
    expect(back.inventory.some((x) => x.id === "lr-1")).toBe(true);
  });
});
