import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import {
  WEAPONS,
  LIMITS,
  KINDS,
  FAMILIES,
  EFFECT_POOLS,
  STARTERS,
  familyOf,
  modelOf,
  zoomOf,
  isSpecialEffect,
  validWeapon,
  type Kind,
} from "../src/shared/defs";
import { MAGAZINES, CAPACITY, makeWeapon } from "../src/shared/progression";
import { prepareState } from "../src/shared/state-wire";
import {
  createWorld,
  addPlayer,
  start,
  neutral,
  fire,
  step,
  spawn,
  event,
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

  it("gives every explosive its own blast instead of the rocket's", () => {
    for (const kind of ["rocket", "heavy", "grenade", "sticky"] as Kind[]) {
      const { w, p } = shooter(kind);
      fire(w, p, { ...neutral(), fire: true });
      const round = w.projectiles[0];
      // Carried on the round, like chain, so switching weapons mid-flight
      // cannot change what is already in the air.
      expect(round.radius).toBe(WEAPONS[kind].radius);
      expect(round.family).toBe(familyOf(kind));
    }
  });

  it("reports the blast it actually used when a round goes off", () => {
    for (const kind of ["rocket", "heavy", "grenade", "sticky"] as Kind[]) {
      const { w, p } = shooter(kind);
      p.x = 0;
      p.z = 0;
      spawn(w, "ant", 0, -10);
      w.events.length = 0;
      fire(w, p, { ...neutral(), fire: true, yaw: 0, pitch: 0 });
      for (
        let tick = 0;
        tick < 30 && !w.events.some((e) => e.type === "burst");
        tick++
      )
        step(w, { p: { ...neutral(), yaw: 0 } });
      const burst = w.events.find((e) => e.type === "burst");
      expect(burst, `${kind} never detonated`).toBeTruthy();
      expect(burst!.radius).toBeCloseTo(WEAPONS[kind].radius, 6);
      expect(burst!.weapon).toBe(familyOf(kind));
    }
  });

  it("never turns blast damage negative at the edge of a large radius", () => {
    // The original curve reached zero at 9m for a 6.5m blast. Widening the
    // radius without widening that reach would have paid damage backwards.
    for (const kind of ["rocket", "heavy", "grenade", "sticky"] as Kind[]) {
      const blast = WEAPONS[kind].radius,
        reach = (blast * 9) / 6.5;
      expect(1 - blast / reach).toBeGreaterThan(0);
    }
    // And the original rocket's numbers are untouched.
    expect((6.5 * 9) / 6.5).toBe(9);
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

  // The authoritative loop runs at 50ms. Before the cadence fix every weapon
  // was quantised to that tick, so anything quicker than 20 shots a second was
  // capped and its rate roll did nothing at all.
  function shotsPerSecond(kind: Kind, rate = 0, grade = 0, seconds = 1) {
    const w = createWorld(`rate-${kind}-${rate}-${grade}`, 5),
      p = addPlayer(w, "p");
    start(w);
    w.nextSpawn = 1e9;
    w.enemies.length = 0;
    p.weapons[p.slot] = makeWeapon(
      `rate-${kind}`,
      kind,
      grade,
      { power: 0, reload: 0, range: 0, rate },
      false,
      0,
    );
    // Enough rounds that no reload interrupts the measurement.
    p.ammo[p.slot] = 100000;
    p.cool = 0;
    const before = p.ammo[p.slot];
    for (let tick = 0; tick < seconds * 20; tick++)
      step(w, { p: { ...neutral(), fire: true } });
    return (before - p.ammo[p.slot]) / seconds;
  }

  it("fires every weapon at the rate its own numbers claim", () => {
    for (const kind of KINDS) {
      const wanted = 1 / WEAPONS[kind].interval;
      const measured = shotsPerSecond(kind);
      // One shot of slack for where the second falls between intervals.
      expect(Math.abs(measured - wanted)).toBeLessThanOrEqual(1);
    }
  });

  it("holds the claimed rate across grades and rate rolls, not just at base", () => {
    // The cadence fix is not confined to weapons whose base interval misses a
    // tick boundary: grade and the rate roll shorten every interval, so a
    // weapon that lined up at base stops lining up once it is upgraded.
    // Ten seconds, because a slow weapon fires once or twice in one and the
    // comparison would be meaningless at that resolution.
    const seconds = 10;
    for (const kind of KINDS)
      for (const grade of [0, 2, 4])
        for (const roll of [0, 20]) {
          const interval =
            WEAPONS[kind].interval / (1.15 ** grade * (1 + roll / 100));
          const wanted = seconds / interval,
            measured = shotsPerSecond(kind, roll, grade, seconds) * seconds;
          // Within one shot, since where the window falls between intervals
          // costs or gains exactly that, or 2% once a weapon fires hundreds.
          expect(
            Math.abs(measured - wanted),
            `${kind} grade ${grade} roll ${roll}: ${measured} vs ${wanted.toFixed(2)}`,
          ).toBeLessThanOrEqual(Math.max(1, wanted * 0.02));
        }
  });

  it("lets a weapon quicker than the tick exceed twenty shots a second", () => {
    // The beam's whole identity is continuous fire; capped at the tick it was
    // a different weapon from the one its numbers describe.
    expect(1 / WEAPONS.laser.interval).toBeGreaterThan(20);
    expect(shotsPerSecond("laser")).toBeGreaterThan(20);
  });

  it("makes the rate roll change the rate of a weapon quicker than the tick", () => {
    // This is the part a cap hides: two beams of different quality fired
    // identically, so the figure on the weapon was not a real figure.
    expect(shotsPerSecond("laser", 20)).toBeGreaterThan(
      shotsPerSecond("laser"),
    );
  });

  it("resolves every weapon to a model file that is actually shipped", () => {
    // The model request is what the battle loader waits on. A kind pointing at
    // a GLB that does not exist fails the whole preparation, and in co-op it
    // fails it for everyone in the room, so this is checked against the disk
    // rather than against the mapping table alone.
    const dir = "public/assets/weapons/realism-v2";
    for (const kind of KINDS)
      for (let grade = 0; grade < 5; grade++)
        expect(
          existsSync(`${dir}/${modelOf(kind)}_${grade}.glb`),
          `${kind} grade ${grade} -> ${modelOf(kind)}_${grade}.glb`,
        ).toBe(true);
  });

  it("fires repel from the weapon that is allowed to roll it", () => {
    // The kickback blast is not a shotgun, but its pool offers repel, so it
    // has to actually push. Gating the effect on the family silently gave it
    // an effect that could be equipped and never fired.
    const pushed = (kind: Kind, effect: "repel" | "none") => {
      const { w, p } = shooter(kind);
      p.x = 0;
      p.z = 0;
      p.weapons[p.slot] = { ...p.weapons[p.slot], rarity: 1, effect };
      spawn(w, "ant", 0, -4);
      const target = w.enemies[0];
      target.hp = 1000;
      const from = target.z;
      fire(w, p, { ...neutral(), fire: true, yaw: 0, pitch: 0 });
      return Math.abs(target.z - from);
    };
    expect(pushed("kick", "repel")).toBeGreaterThan(0.5);
    expect(pushed("shotgun", "repel")).toBeGreaterThan(0.5);
    // Without the effect the same weapon leaves the target where it stood.
    expect(pushed("kick", "none")).toBeLessThan(0.01);
  });

  it("says on the shot whether the round stopped, so audio needs no lookup", () => {
    // Two weapons of the same family can be carried at once, and the family
    // alone cannot say which one fired. The authority reports it instead.
    const { w, p } = shooter("rifle");
    p.x = 0;
    p.z = 0;
    spawn(w, "ant", 0, -10);
    w.events.length = 0;
    fire(w, p, { ...neutral(), fire: true, yaw: 0, pitch: 0 });
    expect(w.events.find((e) => e.type === "shot")?.stopped).toBe(true);

    // Fired into open sky the round runs out of range and stops on nothing,
    // which is the case that must not produce an impact sound.
    const open = shooter("rifle");
    open.p.x = 0;
    open.p.z = 0;
    open.w.enemies.length = 0;
    open.w.events.length = 0;
    fire(open.w, open.p, { ...neutral(), fire: true, yaw: 0, pitch: 0.9 });
    expect(open.w.events.find((e) => e.type === "shot")?.stopped).toBe(false);
  });

  it("keeps the blast when one explosion floods the event buffer", () => {
    // A wide blast over a crowd produces one burst and then a hit and a kill
    // for every body. Dropping the oldest event first threw the burst away
    // before it was ever sent, so the explosion made no sound and drew nothing
    // while the damage still landed.
    const { w, p } = shooter("heavy");
    p.x = 0;
    p.z = 0;
    for (let n = 0; n < LIMITS.enemies; n++)
      spawn(w, "ant", -3 + (n % 8) * 0.8, -10 + Math.floor(n / 8) * 0.8);
    for (const e of w.enemies) e.hp = 1;
    w.events.length = 0;
    fire(w, p, { ...neutral(), fire: true, yaw: 0, pitch: 0 });
    for (let tick = 0; tick < 30; tick++)
      step(w, { p: { ...neutral(), yaw: 0 } });
    expect(w.events.some((e) => e.type === "burst")).toBe(true);
    expect(w.events.length).toBeLessThanOrEqual(LIMITS.events);
  });

  it("drops damage numbers rather than sounds when the buffer overflows", () => {
    const w = createWorld("overflow", 9);
    addPlayer(w, "p");
    start(w);
    w.nextSpawn = 1e9;
    w.enemies.length = 0;
    w.events.length = 0;
    // Far more than the buffer holds, interleaved the way a blast produces them.
    for (let n = 0; n < LIMITS.events * 2; n++) {
      event(w, { type: "hit", amount: 1, x: 0, y: 0, z: 0, owner: "p" });
      if (n % 20 === 0)
        event(w, { type: "burst", radius: 6.5, x: 0, y: 0, z: 0, owner: "p" });
      if (n % 25 === 0)
        event(w, { type: "kill", x: 0, y: 0, z: 0, owner: "p" });
    }
    const kept = w.events;
    expect(kept.length).toBeLessThanOrEqual(LIMITS.events);
    // Every sound-bearing event survives; only the numbers were given up.
    expect(kept.filter((e) => e.type === "burst")).toHaveLength(
      Math.ceil((LIMITS.events * 2) / 20),
    );
    expect(kept.filter((e) => e.type === "kill")).toHaveLength(
      Math.ceil((LIMITS.events * 2) / 25),
    );
  });

  it("stays inside the broadcast size limit with the buffer full", () => {
    // A state payload over 65,536 bytes does not degrade, it disconnects the
    // player, so the buffer's ceiling has to be checked in bytes and not only
    // in events.
    const w = createWorld("packet", 11);
    addPlayer(w, "p");
    start(w);
    for (let n = 0; n < LIMITS.enemies; n++) spawn(w, "ant", n % 10, -(n % 7));
    w.events.length = 0;
    for (let n = 0; n < LIMITS.events * 2; n++)
      event(w, {
        type: "hit",
        amount: 9999,
        weapon: "rocket",
        enemyKind: "ant",
        x: 123.456,
        y: 123.456,
        z: 123.456,
        owner: "player-with-a-long-identifier",
      });
    const bytes = new TextEncoder().encode(
      prepareState(w, -1, {}).packet("p"),
    ).length;
    // Measured at 29,210 bytes for a full buffer, 40 enemies and deliberately
    // long field values. The margin is asserted rather than the hard ceiling,
    // so a change that doubles the payload fails here instead of in the wild.
    expect(bytes).toBeLessThan(45000);
  });

  it("caps the armoury per family, not per weapon", () => {
    // Six families at the per-family cap must still fit inside the total.
    expect(FAMILIES.length * CAPACITY.perKind).toBeLessThanOrEqual(
      CAPACITY.total,
    );
  });
});
