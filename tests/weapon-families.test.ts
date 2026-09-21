import { describe, it, expect } from "vitest";
import {
  WEAPONS,
  KINDS,
  FAMILIES,
  EFFECT_POOLS,
  STARTERS,
  familyOf,
  zoomOf,
  isSpecialEffect,
  validWeapon,
  type Kind,
} from "../src/shared/defs";
import { MAGAZINES, CAPACITY } from "../src/shared/progression";
import {
  createWorld,
  addPlayer,
  start,
  neutral,
  fire,
  falloff,
} from "../src/shared/game";

// The three kinds that existed before families did. Their numbers are load-
// bearing for every save already on a player's device, so they are asserted
// literally rather than derived.
const ORIGINAL = {
  rifle: { damage: 24, interval: 0.13, mag: 32, reload: 1.65, range: 65 },
  shotgun: { damage: 19, interval: 0.8, mag: 7, reload: 2.1, range: 23 },
  rocket: { damage: 170, interval: 1.15, mag: 2, reload: 2.7, range: 75 },
} as const;

function shooter(kind: Kind) {
  const w = createWorld(`fam-${kind}`, 7),
    p = addPlayer(w, "p");
  start(w);
  w.nextSpawn = 1e9;
  w.enemies.length = 0;
  p.weapons[p.slot] = { ...STARTERS[0], id: `t-${kind}`, kind };
  p.ammo[p.slot] = 50;
  p.cool = 0;
  w.events.length = 0;
  w.projectiles.length = 0;
  return { w, p };
}

describe("weapon families", () => {
  it("keeps every original weapon's numbers untouched", () => {
    for (const [kind, want] of Object.entries(ORIGINAL))
      expect(WEAPONS[kind as Kind]).toMatchObject(want);
    // A new save is still issued exactly the three starters, not twelve guns.
    expect(STARTERS.map((s) => s.kind)).toEqual(["rifle", "shotgun", "rocket"]);
  });

  it("gives every kind a family, an effect pool and a magazine curve", () => {
    for (const kind of KINDS) {
      expect(FAMILIES).toContain(familyOf(kind));
      expect(EFFECT_POOLS[kind].length).toBeGreaterThan(0);
      expect(MAGAZINES[kind]).toHaveLength(5);
      // Magazine never shrinks as the grade rises.
      for (let i = 1; i < 5; i++)
        expect(MAGAZINES[kind][i]).toBeGreaterThanOrEqual(
          MAGAZINES[kind][i - 1],
        );
    }
    // Every family is actually reachable, and none is a single-weapon dead end.
    for (const family of FAMILIES)
      expect(KINDS.filter((k) => familyOf(k) === family)).toHaveLength(2);
  });

  it("scopes the effect rules to the family rather than one kind", () => {
    const at = (kind: Kind, effect: string) =>
      validWeapon({ ...STARTERS[0], id: "x", kind, rarity: 1, effect });
    expect(at("slug", "repel")).toBe(true);
    expect(at("smg", "repel")).toBe(false);
    expect(at("sticky", "chain")).toBe(true);
    expect(at("sniper", "chain")).toBe(false);
    // The kickback blast carries repel although it is not a shotgun.
    expect(at("kick", "repel")).toBe(true);
    expect(at("medic", "repel")).toBe(false);
    // Explosives never carry pierce, however they are named.
    expect(at("grenade", "pierce")).toBe(false);
    expect(at("heavy", "pierce")).toBe(false);
    // Pierce is standard equipment, not a special effect, wherever it is base.
    expect(isSpecialEffect("pierce", "slug")).toBe(false);
    expect(isSpecialEffect("pierce", "laser")).toBe(false);
    expect(isSpecialEffect("pierce", "sniper")).toBe(true);
  });

  it("gives each falloff profile the range behaviour it claims", () => {
    // The original two curves are unchanged at the distances that defined them.
    expect(falloff("shotgun", 35)).toBeCloseTo(0.3, 6);
    expect(falloff("rifle", 22)).toBeCloseTo(1, 6);
    // A bullet hose starts losing damage far earlier than a rifle.
    expect(falloff("smg", 30)).toBeLessThan(falloff("rifle", 30));
    // A slug is a shotgun that reaches: it uses the gentle curve, not the steep one.
    expect(falloff("slug", 40)).toBeGreaterThan(falloff("shotgun", 40));
    // Explosive, scoped and beam weapons do not decay at all.
    for (const kind of ["rocket", "sniper", "grenade", "laser", "medic"])
      expect(falloff(kind as Kind, 120)).toBe(1);
  });

  it("magnifies the aimed long-range weapon more than the sweeping one", () => {
    // Both live in the long-range family, and the trade is stated in the zoom:
    // the rifle magnifies to pick one target, the beam stays wide to sweep.
    expect(zoomOf("sniper")).toBeGreaterThan(2);
    expect(zoomOf("laser")).toBeLessThan(2);
    expect(zoomOf("laser")).toBeLessThan(zoomOf("sniper"));
    for (const kind of ["rifle", "smg", "shotgun", "kick"])
      expect(zoomOf(kind as Kind)).toBe(2);
  });

  it("throws arcing rounds for grenades and flat ones for rockets", () => {
    const g = shooter("grenade");
    fire(g.w, g.p, { ...neutral(), fire: true });
    expect(g.w.projectiles).toHaveLength(1);
    expect(g.w.projectiles[0].gravity).toBe(WEAPONS.grenade.gravity);

    const r = shooter("rocket");
    fire(r.w, r.p, { ...neutral(), fire: true });
    expect(r.w.projectiles).toHaveLength(1);
    expect(r.w.projectiles[0].gravity).toBeUndefined();
    // The original rocket still leaves the barrel at its original speed.
    expect(
      Math.hypot(
        r.w.projectiles[0].dx,
        r.w.projectiles[0].dy,
        r.w.projectiles[0].dz,
      ),
    ).toBeCloseTo(28, 6);
  });

  it("does not fire a projectile for hitscan families", () => {
    for (const kind of ["sniper", "laser", "slug", "smg", "kick"] as Kind[]) {
      const { w, p } = shooter(kind);
      fire(w, p, { ...neutral(), fire: true });
      expect(w.projectiles).toHaveLength(0);
      expect(w.events.some((e) => e.type === "shot")).toBe(true);
    }
  });

  it("tags shot events with the family so audio and tracers need no new cases", () => {
    for (const kind of KINDS) {
      const { w, p } = shooter(kind);
      fire(w, p, { ...neutral(), fire: true });
      const shot = w.events.find((e) => e.type === "shot");
      expect(shot?.weapon).toBe(familyOf(kind));
    }
  });

  it("heals a teammate and reports how much, without touching enemies", () => {
    const w = createWorld("medic", 3),
      p = addPlayer(w, "p"),
      ally = addPlayer(w, "ally");
    start(w);
    w.nextSpawn = 1e9;
    w.enemies.length = 0;
    p.weapons[p.slot] = { ...STARTERS[0], id: "m", kind: "medic" };
    p.ammo[p.slot] = 9;
    p.cool = 0;
    // Stand the ally straight ahead of the shooter, along -z at yaw 0.
    p.x = 0;
    p.z = 0;
    ally.x = 0;
    ally.z = -8;
    ally.hp = 40;
    const healerHp = p.hp;
    w.events.length = 0;
    fire(w, p, { ...neutral(), fire: true, yaw: 0, pitch: 0 });
    expect(ally.hp).toBeGreaterThan(40);
    const healed = w.events.find((e) => e.type === "heal");
    expect(healed?.amount).toBe(Math.round(ally.hp - 40));
    expect(healed?.owner).toBe("p");
    // Support fire is not a weapon: it launches nothing and hurts nobody.
    expect(w.projectiles).toHaveLength(0);
    // The shooter is not the target: support fire points away from them.
    expect(p.hp).toBe(healerHp);
  });

  it("never heals past the cap and still reports the shot", () => {
    const w = createWorld("medic-full", 4),
      p = addPlayer(w, "p"),
      ally = addPlayer(w, "ally");
    start(w);
    w.nextSpawn = 1e9;
    w.enemies.length = 0;
    p.weapons[p.slot] = { ...STARTERS[0], id: "m2", kind: "medic" };
    p.ammo[p.slot] = 9;
    p.cool = 0;
    p.x = p.z = 0;
    ally.x = 0;
    ally.z = -8;
    const full = ally.hp;
    w.events.length = 0;
    fire(w, p, { ...neutral(), fire: true, yaw: 0, pitch: 0 });
    expect(ally.hp).toBe(full);
    // The shot is still announced, so a full-health teammate does not read as
    // a broken weapon.
    expect(w.events.some((e) => e.type === "shot")).toBe(true);
  });

  it("reaches a teammate at range and pays partial credit for imperfect aim", () => {
    const healed = (distance: number, aimOff: number) => {
      const w = createWorld(`medic-${distance}-${aimOff}`, 21),
        p = addPlayer(w, "p"),
        ally = addPlayer(w, "ally");
      start(w);
      w.nextSpawn = 1e9;
      w.enemies.length = 0;
      p.weapons[p.slot] = { ...STARTERS[0], id: "m3", kind: "medic" };
      p.ammo[p.slot] = 9;
      p.cool = 0;
      p.x = p.z = 0;
      ally.x = 0;
      ally.z = -distance;
      ally.hp = 1;
      w.events.length = 0;
      fire(w, p, { ...neutral(), fire: true, yaw: aimOff, pitch: 0 });
      return ally.hp - 1;
    };
    const full = WEAPONS.medic.damage * WEAPONS.medic.pellets;
    // Point blank the whole cone lands. Aimed straight at a teammate 40m away
    // most of it still does: a support weapon that only worked point blank
    // would not be worth carrying.
    expect(healed(5, 0)).toBe(full);
    expect(healed(40, 0)).toBeGreaterThanOrEqual(full * 0.7);
    // Off aim at range still restores something rather than nothing, and less
    // than a clean shot. That partial credit is the reason for the spread.
    const sloppy = healed(40, 0.045);
    expect(sloppy).toBeGreaterThan(0);
    expect(sloppy).toBeLessThan(full);
    // Far enough off and it misses; the weapon still has to be aimed.
    expect(healed(40, 0.2)).toBe(0);
  });

  it("throws the shooter backwards along the shot", () => {
    const { w, p } = shooter("kick");
    p.x = 0;
    p.z = 0;
    fire(w, p, { ...neutral(), fire: true, yaw: 0, pitch: 0 });
    // Facing yaw 0 looks down -z, so the recoil must carry the shooter to +z.
    expect(p.z).toBeGreaterThan(0);
    expect(p.x).toBeCloseTo(0, 6);
    // Never further than the weapon claims, and purely horizontal.
    expect(p.z).toBeLessThanOrEqual(WEAPONS.kick.recoil + 1e-6);
    expect(p.y ?? 0).toBe(0);
  });

  it("does not move the shooter for weapons without recoil", () => {
    for (const kind of ["rifle", "shotgun", "sniper", "laser"] as Kind[]) {
      const { w, p } = shooter(kind);
      p.x = 0;
      p.z = 0;
      fire(w, p, { ...neutral(), fire: true, yaw: 0, pitch: 0 });
      expect(p.x).toBe(0);
      expect(p.z).toBe(0);
    }
  });

  it("caps the armoury per family, not per weapon", () => {
    // Six families at the per-family cap must still fit inside the total.
    expect(FAMILIES.length * CAPACITY.perKind).toBeLessThanOrEqual(
      CAPACITY.total,
    );
  });
});
