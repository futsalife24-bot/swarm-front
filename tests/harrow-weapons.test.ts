import { describe, expect, it } from "vitest";
import { KINDS, STARTERS, WEAPONS, type Kind } from "../src/shared/defs";
import {
  addPlayer,
  createWorld,
  eye,
  fire,
  neutral,
  spawn,
  step,
} from "../src/shared/game";
import { HARROW } from "../src/shared/harrow";

function fixture(kind: Kind, height: number) {
  const w = createWorld(`harrow-weapon-${kind}`, 723, 20);
  w.training = true;
  w.phase = "battle";
  w.wave = 1;
  w.nextSpawn = 1e9;
  const p = addPlayer(w, "p");
  p.x = 0;
  p.y = 0;
  p.z = 0;
  p.weapons[p.slot] = { ...STARTERS[0], id: kind, kind };
  p.ammo[p.slot] = 200;
  p.cool = 0;
  const e = spawn(w, "boss", 0, -6, "harrow")!;
  e.y = height;
  e.harrowAirborne = height > 0;
  // Hold the authored warning pose so this isolates real weapon collision,
  // without replacing fire, projectile integration, damage or stagger logic.
  e.harrow = { kind: "Threat", started: 1000, fired: true, yaw: 0 };
  return { w, p, e };
}
function shoot(f: ReturnType<typeof fixture>) {
  const { w, p, e } = f;
  const shape = WEAPONS[p.weapons[p.slot].kind];
  const distance = Math.hypot(e.x - p.x, e.z - p.z);
  const rise = eye(e) - (p.y + 1.5);
  let pitch = Math.atan2(rise, distance);
  if ("gravity" in shape) {
    const v2 = shape.speed ** 2,
      g = shape.gravity;
    const discriminant = v2 ** 2 - g * (g * distance ** 2 + 2 * rise * v2);
    expect(
      discriminant,
      "target must be within ballistic reach",
    ).toBeGreaterThan(0);
    pitch = Math.atan((v2 - Math.sqrt(discriminant)) / (g * distance));
  }
  fire(w, p, {
    ...neutral(),
    fire: true,
    yaw: Math.atan2(e.x - p.x, -(e.z - p.z)),
    pitch,
  });
  for (let tick = 0; tick < 120 && w.projectiles.length; tick++)
    step(w, { p: neutral() });
  expect(w.projectiles).toHaveLength(0);
}

describe("HARROW with all twelve weapon kinds", () => {
  for (const height of [0, 4])
    for (const kind of KINDS) {
      it(`${kind} ${height ? "airborne" : "grounded"}: routes actual hits through boss damage`, () => {
        const f = fixture(kind, height),
          hp = f.e.hp;
        shoot(f);
        const damage = hp - f.e.hp;
        if (kind === "medic") {
          expect(damage).toBe(0);
          expect(f.e.harrowAirDamage).toBe(0);
        } else {
          expect(damage).toBeGreaterThan(0);
          expect(f.e.harrowAirDamage).toBeCloseTo(height ? damage : 0, 6);
        }
      });
    }
  for (const kind of [
    "rifle",
    "sniper",
    "laser",
    "rocket",
    "heavy",
  ] as Kind[]) {
    it(`${kind} can damage HARROW at its maximum flight height`, () => {
      const f = fixture(kind, HARROW.flightHeight),
        hp = f.e.hp;
      shoot(f);
      expect(f.e.hp).toBeLessThan(hp);
      expect(f.e.harrowAirDamage).toBeCloseTo(hp - f.e.hp, 6);
    });
  }
  it("repeated laser hits cross the airborne stagger threshold without killing the boss", () => {
    const f = fixture("laser", HARROW.flightHeight);
    for (
      let shots = 0;
      shots < 200 && f.e.harrow?.kind !== "StaggerFall";
      shots++
    ) {
      f.p.cool = 0;
      shoot(f);
    }
    expect(f.e.hp).toBeGreaterThan(0);
    expect(f.e.maxHp - f.e.hp).toBeGreaterThanOrEqual(
      f.e.maxHp * HARROW.staggerFraction,
    );
    expect(f.e.harrow?.kind).toBe("StaggerFall");
  });
  for (const kind of ["shotgun", "slug", "kick"] as Kind[]) {
    it(`${kind} repel damages HARROW without displacing the boss`, () => {
      const f = fixture(kind, 0),
        before = { x: f.e.x, z: f.e.z };
      f.p.weapons[f.p.slot].effect = "repel";
      shoot(f);
      expect(f.e.hp).toBeLessThan(f.e.maxHp);
      expect({ x: f.e.x, z: f.e.z }).toEqual(before);
    });
  }
  for (const kind of ["rocket", "heavy", "grenade", "sticky"] as Kind[]) {
    it(`${kind} chain does not emit a secondary burst on a defeated HARROW`, () => {
      const f = fixture(kind, 0);
      f.e.hp = 1;
      f.p.weapons[f.p.slot].effect = "chain";
      shoot(f);
      expect(f.e.hp).toBeLessThanOrEqual(0);
      expect(
        f.w.events.filter((e) => e.type === "burst" && e.weapon),
      ).toHaveLength(1);
    });
  }
});
