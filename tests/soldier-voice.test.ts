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
import { maxHp, initSolo } from "../src/shared/solo-progression";

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
function shot(w: ReturnType<typeof createWorld>, owner = "p") {
  w.events.push({
    id: (w.events.at(-1)?.id ?? 0) + 1,
    type: "shot",
    owner,
    x: 0,
    y: 1,
    z: 0,
  });
}
function rescueEvent(w: ReturnType<typeof createWorld>, owner = "p") {
  w.events.push({
    id: (w.events.at(-1)?.id ?? 0) + 1,
    type: "revive",
    owner,
    x: 0,
    z: 0,
    y: 1,
  });
}
describe("accepted acting clips", () => {
  it("voices a real dodge onset once, permits silence, and keeps its lottery gate after suspension", () => {
    const rng = vi.fn(() => 0.9);
    const { w, p, collect, voice } = fixture(rng);
    step(w, { p: { ...neutral(), dodge: true } });
    expect(p.evade).toBeGreaterThan(0);
    expect(collect()).toBeUndefined();
    collect();
    voice.suspend();
    collect();
    p.evade = 0;
    collect();
    w.time = 3;
    p.evade = 0.3;
    collect();
    expect(rng).toHaveBeenCalledTimes(1);
    p.evade = 0;
    collect();
    w.time = 7;
    p.evade = 0.3;
    rng.mockReturnValue(0);
    expect(collect()).toBe("dodge");
    expect(collect()).toBeUndefined();
  });
  it("voices actual rescue completion and alternates, never generic healing or another soldier's rescue", () => {
    const { w, p, collect } = fixture();
    const ally = addPlayer(w, "ally");
    ally.x = p.x;
    ally.z = p.z;
    p.hp = 0;
    p.down = 40;
    collect();
    for (let i = 0; i < 52; i++)
      step(w, { ally: { ...neutral(), revive: true } });
    expect(p.hp).toBeGreaterThan(0);
    expect(w.events.some((e) => e.type === "revive" && e.owner === p.id)).toBe(
      true,
    );
    expect(collect()).toBe("rescued");
    expect(collect()).toBeUndefined();
    w.time += 7;
    p.hp = 0;
    collect();
    p.hp = 90;
    rescueEvent(w, "ally");
    expect(collect()).toBeUndefined();
    p.hp = 0;
    collect();
    p.hp = 90;
    rescueEvent(w);
    expect(collect()).toBe("rescued-alt");
  });
  it("consumes silent or interrupted rescues without replaying", () => {
    for (const mode of ["silent", "muted", "resumed"] as const) {
      const { w, p, collect, voice } = fixture(() => 0.8);
      p.hp = 0;
      collect();
      p.hp = 90;
      rescueEvent(w);
      if (mode === "resumed") voice.suspend();
      expect(collect(mode !== "muted")).toBeUndefined();
      w.time += 7;
      expect(collect()).toBeUndefined();
    }
  });
  it("uses upgraded max HP and rearms danger only after >40% healing plus a 30 second gate", () => {
    const { w, p, collect } = fixture();
    initSolo(w, 1, "normal", false, {
      hp: 5,
      move: 0,
      reload: 0,
      damage: 0,
    } as Parameters<typeof initSolo>[4]);
    p.hp = maxHp(w);
    collect();
    p.hp = maxHp(w) * 0.25;
    expect(collect()).toBe("danger");
    w.time = 7;
    expect(collect()).toBeUndefined();
    p.hp = maxHp(w) * 0.4;
    collect();
    p.hp = maxHp(w) * 0.25;
    expect(collect()).not.toMatch(/^danger/);
    p.hp = maxHp(w) * 0.5;
    collect();
    w.time = 15;
    p.hp = maxHp(w) * 0.25;
    expect(collect()).toBeUndefined();
    p.hp = maxHp(w) * 0.5;
    collect();
    w.time = 31;
    p.hp = maxHp(w) * 0.25;
    expect(collect()).toBe("danger-alt");
  });
  it("keeps a silent danger crossing silent and does not retry on low-HP frames or replay after pause", () => {
    const rng = vi.fn(() => 0.25),
      { w, p, collect, voice } = fixture(rng);
    p.hp = 40;
    expect(collect()).toBeUndefined();
    expect(rng).toHaveBeenCalledTimes(1);
    w.time = 40;
    expect(collect()).toBeUndefined();
    p.hp = 160;
    collect();
    voice.suspend();
    p.hp = 30;
    expect(collect()).toBeUndefined();
    expect(collect()).toBeUndefined();
    expect(rng).toHaveBeenCalledTimes(1);
  });
  it("requires an explicit sortie, consumes it once even when muted, and suppresses WAVE1", () => {
    const { w, p } = fixture();
    for (const active of [true, false]) {
      const voice = new SoldierVoice(() => 0);
      expect(voice.collect(w, p.id, active, true)).toBe(
        active ? "start" : undefined,
      );
      expect(voice.collect(w, p.id, true, true)).toBeUndefined();
      voice.suspend();
      w.time = 20;
      expect(voice.collect(w, p.id, true)).toBeUndefined();
      expect(voice.collect(w, p.id, true, true)).toBeUndefined();
    }
    const silent = new SoldierVoice(() => 0.35);
    expect(silent.collect(w, p.id, true, true)).toBeUndefined();
  });
  it("gives warnings priority over new low-HP/dodge events and never queues suppressed lines", () => {
    const { w, p, collect } = fixture();
    p.hp = 40;
    p.evade = 0.3;
    spawn(w, "boss", p.x, p.z + 5);
    expect(collect()).toBe("warning");
    w.time = 11;
    expect(collect()).toBeUndefined();
  });
});
describe("Fenrir battle variations", () => {
  it("observes real simulation wave advancement and shot events", () => {
    const wave = fixture();
    wave.w.spawned = 10000;
    wave.w.time = 20;
    wave.w.waveClearAt = 0;
    step(wave.w, { p: neutral() });
    expect(wave.w.wave).toBe(2);
    expect(wave.collect()).toBe("wave");
    const fire = fixture();
    fire.w.time = 3;
    step(fire.w, { p: { ...neutral(), fire: true } });
    expect(
      fire.w.events.some((e) => e.type === "shot" && e.owner === fire.p.id),
    ).toBe(true);
    expect(fire.collect()).toBe("fire");
  });
  it("speaks only on a later wave transition, alternates, and never queues it", () => {
    const { w, collect } = fixture();
    w.wave++;
    expect(collect()).toBe("wave");
    w.wave++;
    expect(collect()).toBeUndefined();
    w.time += 7;
    expect(collect()).toBeUndefined();
    w.wave++;
    expect(collect()).toBe("wave-alt");
  });
  it("allows silent waves and suppresses restored waves", () => {
    const rng = vi.fn(() => 0.25),
      { w, collect, voice } = fixture(rng);
    w.wave++;
    expect(collect()).toBeUndefined();
    expect(collect()).toBeUndefined();
    expect(rng).toHaveBeenCalledTimes(1);
    voice.suspend();
    w.wave++;
    expect(collect()).toBeUndefined();
    expect(rng).toHaveBeenCalledTimes(1);
  });
  it("voices own nonfatal damage, not healing, another player, or death", () => {
    const { w, p, collect } = fixture();
    const ally = addPlayer(w, "ally");
    ally.hp--;
    expect(collect()).toBeUndefined();
    p.hp--;
    expect(collect()).toBe("hurt");
    w.time += 7;
    p.hp++;
    expect(collect()).toBeUndefined();
    p.hp = 0;
    expect(collect()).toBeUndefined();
  });
  it("weights the longer hurt line and limits silent damage lotteries across suspension", () => {
    const rng = vi.fn(() => 0.9),
      { w, p, collect, voice } = fixture(rng);
    p.hp--;
    collect();
    voice.suspend();
    collect();
    w.time = 1;
    p.hp--;
    collect();
    expect(rng).toHaveBeenCalledTimes(1);
    w.time = 4;
    p.hp--;
    rng.mockReturnValueOnce(0).mockReturnValueOnce(0.8);
    expect(collect()).toBe("hurt-alt-v2");
  });
  it("only considers own shots after two silent seconds, never each bullet", () => {
    const { w, collect } = fixture();
    w.time = 3;
    shot(w, "ally");
    expect(collect()).toBeUndefined();
    shot(w);
    expect(collect()).toBe("fire");
    for (let t = 4; t < 20; t++) {
      w.time = t;
      shot(w);
      expect(collect()).toBeUndefined();
    }
    w.time = 22;
    shot(w);
    expect(collect()).toBe("fire-alt");
  });
  it("retains twelve-second firing lottery gate across pause and consumes suppressed bursts", () => {
    const rng = vi.fn(() => 0.9),
      { w, collect, voice } = fixture(rng);
    w.time = 3;
    shot(w);
    collect();
    voice.suspend();
    collect();
    w.time = 6;
    shot(w);
    collect();
    expect(rng).toHaveBeenCalledTimes(1);
    w.time = 15;
    shot(w);
    collect();
    expect(rng).toHaveBeenCalledTimes(2);
  });
  it("gives large warnings priority over wave, damage and firing together", () => {
    const { w, p, collect } = fixture();
    w.time = 3;
    w.wave++;
    p.hp--;
    shot(w);
    spawn(w, "boss", p.x, p.z + 5);
    expect(collect()).toBe("warning");
    w.time = 14;
    expect(collect()).toBeUndefined();
  });
  it("suppresses inactive transitions and resets timers for a genuinely new run", () => {
    const { w, p, collect } = fixture();
    w.time = 3;
    shot(w);
    expect(collect()).toBe("fire");
    w.time = 4;
    w.wave++;
    p.hp--;
    shot(w);
    collect(false);
    expect(collect()).toBeUndefined();
    w.run = "new-run";
    w.time = 0;
    collect();
    w.time = 3;
    shot(w);
    expect(collect()).toBe("fire");
  });
});
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
