import { describe, expect, it } from "vitest";
import {
  AnomalyVoice,
  ANOMALY_VOICES,
  ANOMALY_VOICE_PATH,
} from "../src/client/anomaly-voice";
import { addPlayer, createWorld, spawn, start } from "../src/shared/game";
import { ENEMIES } from "../src/shared/defs";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

function fixture() {
  const w = createWorld("anomaly-voice");
  const p = addPlayer(w, "p");
  start(w);
  w.enemies = [];
  w.nextSpawn = 1e9;
  const voice = new AnomalyVoice();
  const collect = (active = true) =>
    voice.collect(JSON.parse(JSON.stringify(w)), p.id, active);
  collect();
  return { w, p, voice, collect };
}
describe("ANOMALY vocal transitions", () => {
  it("ships two decodable, bounded, distinct WAV files per species", () => {
    const base = new URL(`../public/${ANOMALY_VOICE_PATH}`, import.meta.url);
    const manifest = JSON.parse(
      readFileSync(new URL("manifest.json", base), "utf8"),
    );
    const hashes = new Set<string>();
    for (const kind of Object.keys(ENEMIES))
      for (const variant of [0, 1]) {
        const file = `${kind}-${variant}.wav`,
          data = readFileSync(new URL(file, base));
        expect(data.toString("ascii", 0, 4)).toBe("RIFF");
        expect(data.toString("ascii", 8, 12)).toBe("WAVE");
        expect(data.readUInt16LE(20)).toBe(1);
        expect(data.readUInt16LE(22)).toBe(1);
        expect(data.readUInt32LE(24)).toBe(32000);
        expect(data.readUInt16LE(34)).toBe(16);
        expect(data.readUInt32LE(40)).toBe(data.length - 44);
        expect(data.length).toBeGreaterThan(64000);
        const hash = createHash("sha256").update(data).digest("hex");
        expect(
          manifest.files.find((v: { file: string }) => v.file === file)?.sha256,
        ).toBe(hash);
        hashes.add(hash);
        let peak = 0;
        for (let i = 44; i < data.length; i += 2)
          peak = Math.max(peak, Math.abs(data.readInt16LE(i)));
        expect(peak).toBeGreaterThan(1000);
        expect(peak).toBeLessThan(30000);
        expect(data.readInt16LE(44)).toBe(0);
        expect(data.readInt16LE(data.length - 2)).toBe(0);
      }
    expect(hashes.size).toBe(Object.keys(ENEMIES).length * 2);
  });
  it("covers every current species", () => {
    expect(Object.keys(ANOMALY_VOICES).sort()).toEqual(
      Object.keys(ENEMIES).sort(),
    );
  });
  it.each(["crawler", "ant", "spider", "spitter", "hornet", "boss"] as const)(
    "calls once at %s wind-up and alternates",
    (kind) => {
      const { w, p, collect } = fixture();
      spawn(w, kind, p.x + 5, p.z);
      const e = w.enemies.at(-1)!;
      e.wind = 0;
      collect();
      e.wind = 0.8;
      const first = collect();
      expect(first).toHaveLength(1);
      expect(first[0].type).toMatch(new RegExp(`^anomaly:${kind}-[01]$`));
      expect(collect()).toEqual([]);
      e.wind = 0;
      collect();
      w.time += 3;
      e.wind = 0.8;
      expect(collect()[0].type).not.toBe(first[0].type);
    },
  );
  it("uses HARROW and CALYX attack identities without double-playing transitions", () => {
    const { w, p, collect } = fixture();
    spawn(w, "harrow", p.x + 5, p.z);
    const e = w.enemies.at(-1)!;
    collect();
    e.harrow = { kind: "Glide", started: w.time, fired: false, yaw: 0 };
    expect(collect()).toHaveLength(1);
    w.time += 3;
    e.harrow = { kind: "Dive", started: w.time, fired: false, yaw: 0 };
    expect(collect()).toEqual([]);
    spawn(w, "calyx", p.x + 4, p.z);
    const flower = w.enemies.at(-1)!;
    collect();
    flower.calyx = {
      kind: "PollenShot",
      started: w.time,
      fired: false,
      yaw: 0,
    };
    expect(collect()[0].type).toMatch(/^anomaly:calyx-/);
  });
  it("coalesces linked furnace emitters and nearby enemies", () => {
    const { w, p, collect } = fixture();
    spawn(w, "boss", p.x + 5, p.z);
    const e = w.enemies.at(-1)!;
    e.segments = [{ x: e.x, y: e.y, z: e.z + 3, partHp: 100 }];
    collect();
    for (const node of [e, ...e.segments]) {
      node.pulseAim = { x: p.x, z: p.z };
      node.acidAt = w.time + 0.8;
    }
    expect(collect()).toHaveLength(1);
    expect(collect()).toEqual([]);
  });
  it("never replays muted, restored, distant or paused attacks", () => {
    const { w, p, voice, collect } = fixture();
    spawn(w, "crawler", p.x + 5, p.z);
    const e = w.enemies.at(-1)!;
    e.wind = 0.8;
    expect(collect()).toEqual([]);
    e.wind = 0;
    collect(false);
    e.wind = 0.8;
    expect(collect(false)).toEqual([]);
    expect(collect()).toEqual([]);
    e.wind = 0;
    collect();
    voice.suspend();
    e.wind = 0.8;
    expect(collect()).toEqual([]);
    e.wind = 0;
    collect();
    w.time += 3;
    e.x = p.x + 100;
    e.wind = 0.8;
    expect(collect()).toEqual([]);
    e.x = p.x + 5;
    expect(collect()).toEqual([]);
    w.run = "restored";
    expect(collect()).toEqual([]);
  });
});
