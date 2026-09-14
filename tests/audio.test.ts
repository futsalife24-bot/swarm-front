import { describe, it, expect } from "vitest";
import { CombatAudio } from "../src/client/combat-audio";
import {
  createWorld,
  addPlayer,
  start,
  step,
  neutral,
  fire,
  spawn,
  eye,
  hurtEnemy,
} from "../src/shared/game";
import { STARTERS } from "../src/shared/defs";
function fixture() {
  const w = createWorld("audio"),
    p = addPlayer(w, "p", structuredClone(STARTERS.slice(0, 2)));
  start(w);
  w.enemies = [];
  w.nextSpawn = 1e9;
  const a = new CombatAudio();
  a.collect(w);
  return { w, p, a };
}
const kinds = (v: { type: string }[]) => v.map((v) => v.type);
describe("combat audio authoritative transitions", () => {
  it.each([
    ["crawler", "impactShell"], ["ant", "impactShell"],
    ["spider", "impactShell"], ["spitter", "impactHard"],
    ["boss", "impactHard"], ["hornet", "impactSoft"],
  ] as const)("selects AR material from an actual hit on %s", (kind, sound) => {
    const { w, p, a } = fixture();
    spawn(w, kind, p.x, p.z - 5);
    const e = w.enemies[0];
    fire(w, p, { ...neutral(), fire: true,
      pitch: Math.atan2(eye(e) - ((p.y ?? 0) + 1.5), 5) });
    const hit = w.events.find(e => e.type === "hit");
    expect(hit).toMatchObject({ enemyKind: kind, weapon: "rifle" });
    // Exercise the same JSON transport as a received authoritative snapshot.
    const cues = a.collect(JSON.parse(JSON.stringify(w)));
    expect(cues.filter(c => c.type.startsWith("impact"))).toEqual([
      expect.objectContaining({ type: sound, key: "impact:p" }),
    ]);
    expect(kinds(cues)).toContain("rifle");
    expect(a.collect(w)).toEqual([]);
  });
  it("keeps the hit material after a lethal target is removed", () => {
    const { w, p, a } = fixture();
    spawn(w, "crawler", p.x, p.z - 3);
    w.enemies[0].hp = 1;
    fire(w, p, { ...neutral(), fire: true });
    expect(w.enemies[0].hp).toBeLessThanOrEqual(0);
    w.enemies = [];
    expect(kinds(a.collect(JSON.parse(JSON.stringify(w))))).toContain("impactShell");
  });
  it("retains the generic hit for legacy snapshots and non-AR damage", () => {
    const { w, p, a } = fixture();
    spawn(w, "spitter", p.x, p.z - 3);
    hurtEnemy(w, w.enemies[0], 1, p.id);
    expect(kinds(a.collect(w))).toEqual(["impact"]);
    hurtEnemy(w, w.enemies[0], 1, p.id, 0, "shotgun");
    expect(kinds(a.collect(w))).toEqual(["impact"]);
    hurtEnemy(w, w.enemies[0], 1, p.id, 0, "rifle");
    delete w.events[w.events.length - 1].enemyKind;
    expect(kinds(a.collect(w))).toEqual(["impact"]);
  });
  it("plays the rocket launch and impact separately without replacing enemy attacks", () => {
    const { w, p, a } = fixture();
    p.weapons[0] = structuredClone(STARTERS[2]);
    p.ammo[0] = 3;
    fire(w, p, { ...neutral(), fire: true, pitch: 0.8 });
    expect(kinds(a.collect(w))).toContain("rocket");
    for (let i = 0; i < 100 && !w.events.some(e => e.type === "burst" && e.weapon === "rocket"); i++)
      step(w, { p: neutral() });
    expect(kinds(a.collect(w))).toContain("rocketBurst");
    expect(a.collect(w)).toEqual([]);
    const id = Math.max(...w.events.map(e => e.id));
    w.events.push({ id: id + 1, type: "burst", x: 0, y: 0, z: 0, radius: 7 },
      { id: id + 2, type: "burst", x: 0, y: 0, z: 0, radius: 1 });
    expect(kinds(a.collect(w))).toEqual(["burst", "melee"]);
  });
  it("plays one gunshot per shotgun discharge, retaining simultaneous impacts", () => {
    const { w, p, a } = fixture();
    p.slot = 1;
    spawn(w, "crawler", p.x, p.z - 3);
    fire(w, p, { ...neutral(), fire: true });
    const c = kinds(a.collect(w));
    expect(c.filter((x) => x === "shotgun")).toHaveLength(1);
    expect(c).toContain("impact");
    expect(a.collect(w)).toEqual([]);
  });
  it("sounds accepted evade and switch, but not a rejected repeat", () => {
    const { w, p, a } = fixture();
    step(w, { p: { ...neutral(), dodge: true, mx: 1 } });
    expect(kinds(a.collect(w))).toContain("dodge");
    step(w, { p: { ...neutral(), dodge: true, mx: 1 } });
    expect(kinds(a.collect(w))).not.toContain("dodge");
    p.evade = 0;
    p.evadeCd = 0;
    step(w, { p: { ...neutral(), swap: true } });
    expect(kinds(a.collect(w))).toContain("switch");
  });
  it("distinguishes reload completion from cancellation", () => {
    const { w, p, a } = fixture();
    p.ammo[0] = 1;
    a.collect(w);
    step(w, { p: { ...neutral(), reload: true } });
    expect(kinds(a.collect(w))).toContain("reload");
    for (let n = 0; n < 100 && p.reload > 0; n++) {
      step(w, { p: neutral() });
      const c = kinds(a.collect(w));
      if (p.reload <= 0) expect(c).toContain("ready");
    }
    p.ammo[0] = 1;
    step(w, { p: { ...neutral(), reload: true } });
    a.collect(w);
    p.slot = 1;
    p.reload = 0;
    expect(kinds(a.collect(w))).not.toContain("ready");
  });
  it("consumes muted/paused snapshots without replaying stale combat", () => {
    const { w, p, a } = fixture();
    fire(w, p, { ...neutral(), fire: true });
    expect(a.collect(w, false)).toEqual([]);
    expect(a.collect(w)).toEqual([]);
    w.run = "second";
    expect(a.collect(w)).toEqual([]);
  });
  it("distinguishes enemy acid, stake and laser launches without replaying snapshots", () => {
    const { w, a } = fixture();
    for (const [id, style] of [
      [1, undefined],
      [2, "stake"],
      [3, "laser"],
    ] as const)
      w.projectiles.push({
        id,
        style,
        owner: "enemy",
        x: 0,
        y: 1,
        z: 0,
        dx: 1,
        dy: 0,
        dz: 0,
        life: 2,
        damage: 1,
        rocket: false,
      });
    expect(kinds(a.collect(w))).toEqual(["spit", "stake", "laser"]);
    expect(a.collect(w)).toEqual([]);
  });
  it("tracks leap, landing, lunge and melee separately", () => {
    const { w, a } = fixture();
    spawn(w, "spider", 0, 0);
    const e = w.enemies[0];
    a.collect(w);
    e.jump = 0.1;
    expect(kinds(a.collect(w))).toContain("leap");
    e.jump = 0;
    expect(kinds(a.collect(w))).toContain("land");
    e.lunge = 0.2;
    expect(kinds(a.collect(w))).toContain("lunge");
    e.wind = 0.2;
    a.collect(w);
    e.wind = 0;
    e.cool = 2;
    e.tx = e.x;
    e.tz = e.z;
    expect(kinds(a.collect(w))).toContain("melee");
  });
});
