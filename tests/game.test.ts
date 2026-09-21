import { describe, it, expect } from "vitest";
import {
  BLOCKS,
  STARTERS,
  LIMITS,
  POWER,
  ROLL,
  ROLLS,
  WEAPONS,
  KINDS,
  FAMILIES,
  familyOf,
  quality,
  stats,
  LR_QUALITY,
  validRoll,
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
  eye,
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
  w.enemies = [];
  return { w, p };
}
describe("authoritative combat", () => {
  it("rifle fires at its cadence and reloads instead of accepting spam", () => {
    const { w, p } = fixture();
    spawn(w, "boss", 0, -20);
    const i = { ...neutral(), fire: true };
    for (let n = 0; n < 20; n++) step(w, { p: i });
    expect(p.ammo[0]).toBe(25);
    expect(w.enemies[0].maxHp - w.enemies[0].hp).toBeCloseTo(7 * 24);
  });
  it("blocks bullets and aim assistance through a building", () => {
    const { w, p } = fixture();
    p.x = 34;
    p.z = 30;
    spawn(w, "crawler", 34, -12);
    fire(w, p, { ...neutral(), fire: true });
    expect(w.enemies[0].hp).toBe(w.enemies[0].maxHp);
  });
  it("shotgun has close-range pellets; rocket damages multiple enemies", () => {
    const a = fixture();
    a.p.weapons = [STARTERS[1], STARTERS[0]];
    a.p.ammo = [7, 32];
    spawn(a.w, "boss", 0, -5);
    fire(a.w, a.p, { ...neutral(), fire: true });
    expect(a.w.enemies[0].maxHp - a.w.enemies[0].hp).toBeGreaterThan(100);
    const b = fixture();
    b.p.weapons = [STARTERS[2], STARTERS[0]];
    b.p.ammo = [2, 32];
    spawn(b.w, "crawler", 0, -10);
    spawn(b.w, "crawler", 2, -10);
    // Hold targets in their telegraph so this checks blast damage, not their dodge AI.
    for (const e of b.w.enemies) e.wind = 100;
    fire(b.w, b.p, { ...neutral(), fire: true });
    for (let n = 0; n < 20; n++) step(b.w, {});
    expect(b.w.totalKills).toBe(2);
  });
  it("pierce changes combat by hitting three aligned enemies but not a fourth", () => {
    const { w, p } = fixture();
    p.weapons[0] = { ...STARTERS[0], rarity: 1, effect: "pierce" };
    for (const z of [-5, -9, -13, -17]) spawn(w, "crawler", 0, z);
    fire(w, p, neutral());
    expect(w.enemies.map((e) => e.maxHp - e.hp)).toEqual([24, 24, 24, 0]);
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
    expect(new Set(items.map((w) => w.kind)).size).toBe(KINDS.length);
    expect(new Set(items.map((w) => familyOf(w.kind))).size).toBe(
      FAMILIES.length,
    );
    // Families are drawn evenly and a family's own weapons split its share, so
    // adding a family must not change how often any existing family is seen.
    for (const family of FAMILIES) {
      const share =
        items.filter((w) => familyOf(w.kind) === family).length / items.length;
      expect(share).toBeGreaterThan(1 / FAMILIES.length - 0.02);
      expect(share).toBeLessThan(1 / FAMILIES.length + 0.02);
    }
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
    // The tier is read from all five rolls, so damage no longer has a per-tier
    // ceiling: a low tier may carry high damage and pay for it elsewhere.
    for (const rarity of [0, 1, 2, 3] as const) {
      for (const power of [1.12, 1.24, 1.36])
        expect(validWeapon({ ...item, rarity, power })).toBe(true);
      expect(validWeapon({ ...item, rarity, power: 1.361 })).toBe(false);
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
      expect(quality(item)).toBeGreaterThanOrEqual(LR_QUALITY);
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
describe("rolled figures", () => {
  const dominates = (a: Weapon, b: Weapon) => {
    const x = stats(a),
      y = stats(b);
    return (
      x.damage >= y.damage &&
      x.mag >= y.mag &&
      x.range >= y.range &&
      x.interval <= y.interval &&
      x.reload <= y.reload &&
      (x.damage > y.damage ||
        x.mag > y.mag ||
        x.range > y.range ||
        x.interval < y.interval ||
        x.reload < y.reload)
    );
  };
  it("rarely produces a weapon that beats another at everything", () => {
    const w = createWorld("dominance", 77);
    const rifles: Weapon[] = [];
    while (rifles.length < 400) {
      const item = loot(w);
      if (item.kind === "rifle" && item.effect === "none") rifles.push(item);
    }
    let dominated = 0,
      pairs = 0;
    for (const a of rifles)
      for (const b of rifles) {
        if (a === b) continue;
        pairs++;
        if (dominates(a, b)) dominated++;
      }
    // The point of five rolls: "better" stops being one ordering.
    expect(dominated / pairs).toBeLessThan(0.12);
  });
  it("keeps every figure inside its declared band", () => {
    const w = createWorld("bands", 5);
    for (let n = 0; n < 20000; n++) {
      const item = loot(w);
      expect(validWeapon(item)).toBe(true);
      const s = stats(item),
        d = WEAPONS[item.kind];
      expect(s.mag).toBeGreaterThanOrEqual(1);
      expect(s.range).toBeGreaterThanOrEqual(d.range * (ROLL.min / ROLL.scale));
      expect(s.range).toBeLessThanOrEqual(d.range * (ROLL.max / ROLL.scale));
      for (const key of ROLLS) expect(validRoll(item.rolls![key]!)).toBe(true);
    }
  });
  it("reads a weapon saved before rolls existed as plain base values", () => {
    const legacy: Weapon = {
      id: "legacy",
      kind: "rifle",
      rarity: 1,
      power: 1.1,
      effect: "none",
    };
    expect(validWeapon(legacy)).toBe(true);
    const s = stats(legacy),
      d = WEAPONS.rifle;
    expect(s.mag).toBe(d.mag);
    expect(s.range).toBe(d.range);
    expect(s.reload).toBe(d.reload);
    expect(s.interval).toBe(d.interval);
    expect(quality(legacy)).toBeCloseTo(
      (4 * (ROLL.scale - ROLL.min) + (ROLL.max - ROLL.scale)) /
        (5 * (ROLL.max - ROLL.min)),
      5,
    );
  });
});
describe("damage readout", () => {
  it("reports the damage it dealt, at the height it landed", () => {
    const { w, p } = (() => {
      const w = createWorld("dmg", 3),
        p = addPlayer(w, "p");
      p.x = 0;
      p.z = 0;
      start(w);
      w.nextSpawn = 1e9;
      w.enemies = [];
      w.enemies.length = 0;
      return { w, p };
    })();
    spawn(w, "crawler", 0, -10);
    const target = w.enemies[0];
    const before = target.hp;
    fire(w, p, { ...neutral(), yaw: 0, pitch: 0, fire: true });
    const hit = w.events.filter((e) => e.type === "hit").at(-1)!;
    expect(hit.amount).toBeGreaterThan(0);
    expect(hit.amount).toBe(Math.round(before - target.hp));
    expect(hit.owner).toBe("p");
    // Anchored to the body it struck, so a flier's number is not on the floor.
    expect(hit.y).toBeCloseTo(eye(target), 5);
  });
  it("puts an airborne hit up where the hornet is", () => {
    const w = createWorld("dmg-air", 4),
      p = addPlayer(w, "p");
    p.x = 0;
    p.z = 0;
    start(w);
    w.nextSpawn = 1e9;
    w.enemies = [];
    w.enemies.length = 0;
    spawn(w, "hornet", 0, -10);
    const target = w.enemies[0];
    p.cool = 0;
    fire(w, p, {
      ...neutral(),
      yaw: 0,
      pitch: Math.atan2(eye(target) - 1.5, 10),
      fire: true,
    });
    const hit = w.events.filter((e) => e.type === "hit").at(-1)!;
    expect(hit.y).toBeGreaterThan(5);
  });
});

describe("reserve reload", () => {
  for (const starter of STARTERS) {
    it(`${starter.kind}: partial reload shortens, empty reload stays normal, full magazine cannot reload`, () => {
      const { w, p } = fixture();
      const weapon: Weapon = {
        ...starter,
        id: `reserve-${starter.kind}`,
        rarity: 1,
        effect: "reserve",
        rolls: { mag: 1.25, reload: 0.8 },
      };
      p.weapons[0] = weapon;
      const d = stats(weapon);
      const remaining = Math.floor(d.mag / 2);
      p.ammo[0] = remaining;
      step(w, { p: { ...neutral(), reload: true } });
      const expected = d.reload * (1 - (0.5 * remaining) / d.mag);
      expect(p.reload).toBeCloseTo(expected);
      expect(p.ammo[0]).toBe(remaining);
      step(w, { p: { ...neutral(), reload: true, fire: true } });
      expect(p.reload).toBeCloseTo(expected - 0.05);
      expect(p.ammo[0]).toBe(remaining);
      for (let n = 0; n < Math.ceil(expected / 0.05); n++)
        step(w, { p: neutral() });
      expect(p.ammo[0]).toBe(d.mag);
      step(w, { p: { ...neutral(), reload: true } });
      expect(p.reload).toBeLessThanOrEqual(0);
      p.ammo[0] = 0;
      step(w, { p: neutral() });
      expect(p.reload).toBeCloseTo(d.reload);
      expect(validWeapon(weapon)).toBe(true);
      const saved = fresh();
      saved.inventory.push(weapon);
      expect(parseSave(JSON.stringify(saved)).inventory.at(-1)).toEqual(weapon);
    });
  }
  it("drops reserve for every kind, retires quick drops, and preserves existing quick weapons", () => {
    const w = createWorld("reserve-drops", 42);
    const drops = Array.from({ length: 10000 }, () => loot(w));
    for (const starter of STARTERS)
      expect(
        drops.some(
          (item) => item.kind === starter.kind && item.effect === "reserve",
        ),
      ).toBe(true);
    expect(drops.every(validWeapon)).toBe(true);
    expect(drops.some((item) => item.effect === "quick")).toBe(false);
    const old: Weapon = { ...STARTERS[0], rarity: 1, effect: "quick" };
    expect(validWeapon(old)).toBe(true);
    expect(stats(old).reload).toBeCloseTo(1.65 * 0.8);
  });
  it("weapon switching cancels shortened reload without refilling ammo", () => {
    const { w, p } = fixture();
    p.weapons[0] = { ...STARTERS[0], rarity: 1, effect: "reserve" };
    p.ammo[0] = 16;
    step(w, { p: { ...neutral(), reload: true } });
    step(w, { p: { ...neutral(), swap: true } });
    expect(p.reload).toBe(0);
    expect(p.ammo[0]).toBe(16);
    expect(p.slot).toBe(1);
  });
});

describe("flat effect pools and innate shotgun piercing", () => {
  it("uses a flat rifle pool and never drops a shotgun piercing affix", () => {
    const w = createWorld("flat-effects", 2026);
    const items = Array.from({ length: 40000 }, () => loot(w));
    const rifle = items.filter(
      (item) => item.kind === "rifle" && item.effect !== "none",
    );
    const fraction =
      rifle.filter((item) => item.effect === "pierce").length / rifle.length;
    expect(fraction).toBeGreaterThan(0.47);
    expect(fraction).toBeLessThan(0.53);
    for (const kind of ["shotgun", "rocket"]) {
      const effects = new Set(
        items.filter((item) => item.kind === kind).map((item) => item.effect),
      );
      expect(effects).toEqual(
        new Set(["none", "reserve", kind === "shotgun" ? "repel" : "chain"]),
      );
      const affixed = items.filter(
        (item) => item.kind === kind && item.effect !== "none",
      );
      const ratio =
        affixed.filter((item) => item.effect === "reserve").length /
        affixed.length;
      expect(ratio).toBeGreaterThan(0.47);
      expect(ratio).toBeLessThan(0.53);
    }
    expect(items.every(validWeapon)).toBe(true);
  });
  it("shotgun pellets hit three enemies with no affix, reserve, or legacy pierce, without stacking", () => {
    const results = ["none", "reserve", "pierce"].map((effect) => {
      const { w, p } = fixture();
      p.weapons[0] = {
        ...STARTERS[1],
        rarity: 1,
        effect: effect as Weapon["effect"],
      };
      p.ammo[0] = 7;
      for (const z of [-5, -8, -11, -14]) spawn(w, "boss", 0, z);
      fire(w, p, neutral());
      const damage = w.enemies.map((e) => e.maxHp - e.hp);
      expect(damage.slice(0, 3).every((value) => value > 0)).toBe(true);
      expect(damage[3]).toBe(0);
      return damage;
    });
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });
  it("rifle without pierce stops at the first enemy and legacy shotgun saves still load", () => {
    const { w, p } = fixture();
    for (const z of [-5, -9]) spawn(w, "crawler", 0, z);
    fire(w, p, neutral());
    expect(w.enemies.map((e) => e.maxHp - e.hp)).toEqual([24, 0]);
    const saved = fresh();
    saved.inventory[1] = { ...STARTERS[1], rarity: 1, effect: "pierce" };
    expect(parseSave(JSON.stringify(saved))).toEqual(saved);
  });
});

describe("exclusive weapon affixes", () => {
  it("repel pushes surviving close normal enemies once per shot; distant enemies and bosses stay put", () => {
    const { w, p } = fixture();
    p.weapons[0] = { ...STARTERS[1], rarity: 1, effect: "repel" };
    for (const [kind, z] of [
      ["crawler", -5],
      ["crawler", -12],
      ["boss", -16],
    ] as const)
      spawn(w, kind, 0, z);
    for (const e of w.enemies) e.hp = 10000;
    fire(w, p, neutral());
    expect(w.enemies[0].hp).toBeLessThan(10000);
    expect(w.enemies[0].z).toBeCloseTo(-8);
    expect(w.enemies[1].z).toBe(-12);
    expect(w.enemies[2].z).toBe(-16);
  });
  it("only a lethal direct rocket hit triggers one secondary explosion", () => {
    const run = (chain: boolean, directHp = 75, x = 0) => {
      const { w } = fixture();
      spawn(w, "crawler", x, -5);
      spawn(w, "crawler", 2.5, -5);
      spawn(w, "crawler", 4.5, -5);
      w.enemies[0].hp = directHp;
      w.enemies[1].hp = 155;
      w.enemies[2].hp = 1000;
      const targets = [...w.enemies];
      for (const e of w.enemies) e.wind = 100;
      w.projectiles.push({
        id: 999,
        x: 0,
        y: 1.4,
        z: -2.6,
        dx: 0,
        dy: 0,
        dz: -28,
        life: 3,
        owner: "p",
        damage: 170,
        rocket: true,
        chain,
      });
      step(w, { p: neutral() });
      return { w, targets };
    };
    const base = run(false),
      extra = run(true);
    expect(extra.w.events.filter((e) => e.type === "burst")).toHaveLength(2);
    expect(base.targets[1].hp).toBeGreaterThan(0);
    expect(extra.targets[1].hp).toBeLessThanOrEqual(0);
    expect(extra.targets[2].hp).toBeCloseTo(base.targets[2].hp);
    expect(
      run(true, 1000).w.events.filter((e) => e.type === "burst"),
    ).toHaveLength(1);
  });
  it("captures the rocket affix at firing and rejects affixes on the wrong weapon kind", () => {
    const { w, p } = fixture();
    p.weapons = [{ ...STARTERS[2], rarity: 1, effect: "chain" }, STARTERS[0]];
    fire(w, p, neutral());
    expect(w.projectiles[0].chain).toBe(true);
    p.slot = 1;
    expect(w.projectiles[0].chain).toBe(true);
    for (const starter of STARTERS) {
      expect(validWeapon({ ...starter, rarity: 1, effect: "repel" })).toBe(
        starter.kind === "shotgun",
      );
      expect(validWeapon({ ...starter, rarity: 1, effect: "chain" })).toBe(
        starter.kind === "rocket",
      );
    }
  });
});

it("repel cannot push an enemy through a building", () => {
  const { w, p } = fixture();
  const wall = mapFor(w).blocks[0],
    front = wall.z - wall.d / 2;
  p.x = wall.x;
  p.z = front - 6;
  p.weapons[0] = { ...STARTERS[1], rarity: 1, effect: "repel" };
  spawn(w, "crawler", wall.x, front - 2);
  const enemy = w.enemies[0];
  enemy.hp = 10000;
  fire(w, p, { ...neutral(), yaw: Math.PI });
  expect(enemy.hp).toBeLessThan(10000);
  expect(enemy.z).toBeGreaterThan(front - 2);
  expect(enemy.z).toBeLessThan(front);
});
import { mapFor } from "../src/shared/stages";
