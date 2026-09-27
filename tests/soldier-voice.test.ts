import { describe, expect, it, vi } from "vitest";
import { SoldierVoice } from "../src/client/soldier-voice";
import {
  addPlayer,
  createWorld,
  start,
  spawn,
  step,
  neutral,
} from "../src/shared/game";
import { STARTERS } from "../src/shared/defs";

function fixture(random = () => 0) {
  const w = createWorld("voice");
  const p = addPlayer(w, "p", structuredClone(STARTERS.slice(0, 2)));
  start(w);
  w.enemies = [];
  w.nextSpawn = 1e9;
  const voice = new SoldierVoice(random);
  const collect = (active = true) =>
    voice.collect(JSON.parse(JSON.stringify(w)), p.id, active);
  collect();
  return { w, p, collect, voice };
}
describe("default soldier callouts", () => {
  it("uses an actual reload transition, never completion or a held reload", () => {
    const { w, p, collect } = fixture();
    p.ammo[0] = 2;
    step(w, { p: { ...neutral(), reload: true } });
    expect(collect()).toBe("reload");
    expect(collect()).toBeUndefined();
    p.reload = 0;
    w.time += 7;
    expect(collect()).toBeUndefined();
    step(w, { p: { ...neutral(), reload: true } });
    expect(collect()).toBe("reload-alt");
  });
  it("allows silence and does not redraw on subsequent reload frames", () => {
    const random = vi.fn(() => 0.6),
      { p, collect } = fixture(random);
    p.reload = 1;
    expect(collect()).toBeUndefined();
    expect(collect()).toBeUndefined();
    expect(random).toHaveBeenCalledTimes(1);
  });
  it("only includes empty-ammo lines for empty magazines", () => {
    for (const ammo of [0, 2]) {
      const rng = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0.99);
      const { p, collect } = fixture(rng);
      p.ammo[0] = ammo;
      p.reload = 1;
      expect(collect()).toBe(ammo === 0 ? "empty" : "reload-alt");
    }
  });
  it("does not voice a weapon switch into a reloading slot", () => {
    const { p, collect } = fixture();
    p.slot = 1;
    p.reload = 1;
    expect(collect()).toBeUndefined();
  });
  it("discards muted and resumed transitions and never speaks while down", () => {
    const { p, w, collect } = fixture();
    p.reload = 1;
    collect(false);
    expect(collect()).toBeUndefined();
    p.reload = 0;
    collect();
    p.hp = 0;
    p.reload = 1;
    w.time += 20;
    expect(collect()).toBeUndefined();
    p.hp = 100;
    expect(collect()).toBeUndefined();
  });
  it("warns about an approaching large enemy once, not small-enemy attacks", () => {
    const { w, p, collect } = fixture();
    spawn(w, "hornet", p.x, p.z + 3);
    expect(collect()).toBeUndefined();
    spawn(w, "boss", p.x, p.z + 60);
    expect(collect()).toBeUndefined();
    w.enemies.at(-1)!.z = p.z + 50;
    expect(collect()).toBe("warning");
    w.time += 20;
    expect(collect()).toBeUndefined();
  });
  it("gives warning precedence over reload and consumes suppressed opportunities", () => {
    const { w, p, collect } = fixture();
    p.reload = 1;
    spawn(w, "boss", p.x, p.z + 5);
    expect(collect()).toBe("warning");
    p.reload = 0;
    collect();
    p.reload = 1;
    expect(collect()).toBeUndefined();
    w.time += 11;
    expect(collect()).toBeUndefined();
  });
  it("limits covering-fire lotteries and requires a nearby downed ally", () => {
    const rng = vi.fn(() => 0.9),
      { w, p, collect } = fixture(rng);
    const ally = addPlayer(w, "ally", structuredClone(STARTERS.slice(0, 2)));
    ally.hp = 0;
    ally.x = p.x;
    ally.z = p.z;
    for (let id = 1; id <= 20; id++) {
      w.events.push({ id, type: "shot", owner: p.id, x: p.x, z: p.z, y: 1 });
      collect();
    }
    expect(rng).toHaveBeenCalledTimes(1);
    w.time += 21;
    rng.mockReturnValue(0);
    w.events.push({ id: 21, type: "shot", owner: p.id, x: p.x, z: p.z, y: 1 });
    expect(collect()).toBe("cover");
  });
  it("does not replay initial snapshots or previous-run state", () => {
    const { w, p } = fixture();
    p.reload = 1;
    spawn(w, "boss", p.x, p.z + 5);
    const v = new SoldierVoice(() => 0);
    expect(v.collect(w, p.id, true)).toBeUndefined();
    w.run = "new";
    expect(v.collect(w, p.id, true)).toBeUndefined();
  });
});

it("preserves the last reload choice and six-second gate after rebaseline", () => {
  const { w, p, collect, voice } = fixture();
  p.reload = 1;
  expect(collect()).toBe("reload");
  voice.suspend();
  p.reload = 0;
  collect();
  w.time = 2.05;
  p.reload = 1;
  expect(collect()).toBeUndefined();
  p.reload = 0;
  collect();
  w.time = 7;
  p.reload = 1;
  expect(collect()).toBe("reload-alt");
});
it("preserves warning ten-second gate across rebaseline", () => {
  const { w, p, collect, voice } = fixture();
  spawn(w, "boss", p.x, p.z + 5);
  expect(collect()).toBe("warning");
  voice.suspend();
  collect();
  w.time = 5;
  spawn(w, "boss", p.x, p.z + 6);
  expect(collect()).toBeUndefined();
  w.time = 11;
  spawn(w, "boss", p.x, p.z + 7);
  expect(collect()).toBe("warning");
});
it("preserves the silent cover lottery twenty-second gate across rebaseline", () => {
  const rng = vi.fn(() => 0.9),
    { w, p, collect, voice } = fixture(rng);
  const ally = addPlayer(w, "ally");
  ally.hp = 0;
  ally.x = p.x;
  ally.z = p.z;
  for (let id = 1; id <= 3; id++) {
    w.time = id === 3 ? 21 : id;
    w.events.push({ id, type: "shot", owner: p.id, x: p.x, z: p.z, y: 1 });
    collect();
    if (id === 1) {
      voice.suspend();
      collect();
    }
    if (id === 2) expect(rng).toHaveBeenCalledTimes(1);
  }
  expect(rng).toHaveBeenCalledTimes(2);
});
