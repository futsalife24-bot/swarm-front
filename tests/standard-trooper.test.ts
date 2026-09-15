import { it, expect } from "vitest";
import {
  createWorld,
  addPlayer,
  start,
  spawn,
  step,
  neutral,
  fire,
} from "../src/shared/game";
import { HEAVY_HIT_DURATION, WEAPON_SWITCH_DURATION } from "../src/shared/defs";
function fixture() {
  const w = createWorld("trooper", 42),
    p = addPlayer(w, "p");
  start(w);
  p.x = 0;
  p.z = 0;
  w.enemies = [];
  w.nextSpawn = 1e9;
  spawn(w, "boss", 0, -10, "crown");
  const e = w.enemies[0];
  e.cool = 100;
  return { w, p, e };
}
it("blocks direct and input firing plus re-switch until the full switch has elapsed", () => {
  const { w, p } = fixture(),
    ammo = [...p.ammo];
  step(w, { p: { ...neutral(), swap: true, fire: true } });
  expect(p.slot).toBe(1);
  expect(p.swapCd).toBe(WEAPON_SWITCH_DURATION);
  expect(p.ammo).toEqual(ammo);
  fire(w, p, { ...neutral(), fire: true });
  expect(p.ammo).toEqual(ammo);
  for (let i = 0; i < 8; i++)
    step(w, { p: { ...neutral(), swap: true, fire: true } });
  expect(p.slot).toBe(1);
  expect(p.swapCd).toBeGreaterThan(0);
  expect(p.ammo).toEqual(ammo);
  for (let i = 0; i < 3; i++) step(w, { p: { ...neutral(), fire: true } });
  expect(p.swapCd).toBe(0);
  expect(p.ammo[1]).toBe(ammo[1] - 1);
  step(w, { p: { ...neutral(), swap: true } });
  expect(p.slot).toBe(0);
});
it("pauses holstering through dodge and resumes without allowing early fire", () => {
  const { w, p } = fixture();
  step(w, { p: { ...neutral(), swap: true } });
  step(w, { p: { ...neutral(), dodge: true, mx: 1 } });
  const remaining = p.swapCd,
    ammo = [...p.ammo];
  while (p.evade > 0) {
    step(w, { p: { ...neutral(), fire: true } });
    expect(p.swapCd).toBe(remaining);
    expect(p.ammo).toEqual(ammo);
  }
  expect(p.swapResume).toBeGreaterThan(0);
  for (let i = 0; i < 30; i++) step(w, { p: { ...neutral(), fire: true } });
  expect(p.swapCd).toBe(0);
  expect(p.ammo[1]).toBeLessThan(ammo[1]);
});
it("large ground impact triggers heavy reaction without displacing or stunning the player", () => {
  const { w, p, e } = fixture();
  Object.assign(e, { wind: 0.01, tx: 0, tz: 0, active: true });
  const hp = p.hp;
  step(w, {});
  expect(p.hp).toBeLessThan(hp);
  expect(p.heavyHit).toBe(HEAVY_HIT_DURATION);
  expect([p.x, p.z]).toEqual([0, 0]);
  const ammo = p.ammo[0];
  step(w, { p: { ...neutral(), mx: 1, fire: true } });
  expect(p.x).toBeGreaterThan(0);
  expect(p.ammo[0]).toBe(ammo - 1);
  for (let i = 0; i < 25; i++) step(w, {});
  expect(p.heavyHit).toBe(0);
});
it("evaded boss damage and ordinary contact do not trigger the heavy clip", () => {
  const { w, p, e } = fixture();
  Object.assign(e, { wind: 0.01, tx: 0, tz: 0, active: true });
  p.evade = 0.2;
  const hp = p.hp;
  step(w, {});
  expect(p.hp).toBe(hp);
  expect(p.heavyHit ?? 0).toBe(0);
  w.enemies = [];
  p.evade = 0;
  spawn(w, "crawler", 0, -1);
  Object.assign(w.enemies[0], { wind: 0.01, tx: 0, tz: 0, active: true });
  step(w, {});
  expect(p.hp).toBeLessThan(hp);
  expect(p.heavyHit ?? 0).toBe(0);
});
