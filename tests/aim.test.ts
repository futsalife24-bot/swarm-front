import { describe, it, expect } from "vitest";
import { MAX_PITCH, clampPitch, gyroDelta } from "../src/shared/aim";
import { validInput, neutral } from "../src/shared/game";
import { fresh, parseSave } from "../src/client/save";
import {
  addPlayer,
  createWorld,
  spawn,
  fire,
  cameraShot,
  aimCamera,
  eye,
} from "../src/shared/game";
import { STARTERS, BLOCKS } from "../src/shared/defs";
import { SCOPE_FOV, NORMAL_FOV } from "../src/shared/aim";
import { mapFor } from "../src/shared/stages";

describe("aim settings and network limits", () => {
  it("accepts upward aim through 80 degrees and rejects invalid input", () => {
    expect(clampPitch(100)).toBe(MAX_PITCH);
    expect(clampPitch(-100)).toBe(-0.65);
    expect(validInput({ ...neutral(), pitch: MAX_PITCH })).toBe(true);
    for (const pitch of [MAX_PITCH + 0.01, -0.81, NaN, Infinity])
      expect(validInput({ ...neutral(), pitch })).toBe(false);
  });
  it("maps portrait and both landscape orientations without frame-rate dependence", () => {
    const portrait = gyroDelta(20, 40, 0, 0.02);
    const left = gyroDelta(40, -20, 90, 0.02);
    const right = gyroDelta(-40, 20, 270, 0.02);
    for (const result of [left, right]) {
      expect(result.yaw).toBeCloseTo(portrait.yaw);
      expect(result.pitch).toBeCloseTo(portrait.pitch);
    }
    expect(gyroDelta(20, 40, 0, 0.01).yaw * 2).toBeCloseTo(portrait.yaw);
  });
  it("keeps all eight aim directions and sensitivity independent across screen rotations", () => {
    // Device X/Y rates for screen-up and screen-right rotations, derived from
    // the physical axes: screen 90 has device X up and device Y left.
    const axes = [
      { angle: 0, up: [1, 0], right: [0, -1] },
      { angle: 90, up: [0, -1], right: [-1, 0] },
      { angle: 180, up: [-1, 0], right: [0, 1] },
      { angle: 270, up: [0, 1], right: [1, 0] },
    ];
    for (const axis of axes)
      for (const [right, up] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ]) {
        const delta = gyroDelta(
          (axis.up[0] * up + axis.right[0] * right) * 20,
          (axis.up[1] * up + axis.right[1] * right) * 20,
          axis.angle,
          0.02,
          2.5,
        );
        expect(delta.yaw).toBeCloseTo((right * Math.PI) / 180);
        expect(delta.pitch).toBeCloseTo((up * Math.PI) / 180);
      }
  });
  it("loads older saves and validates new settings without losing inventory", () => {
    const old = fresh();
    expect(parseSave(JSON.stringify(old))).toEqual(old);
    const next = {
      ...old,
      fireSensitivity: 2.4,
      gyroEnabled: true,
      gyroSensitivity: 2.5,
    };
    expect(parseSave(JSON.stringify(next))).toEqual(next);
    for (const gyroSensitivity of [0, 7, "1", null])
      expect(() =>
        parseSave(JSON.stringify({ ...old, gyroSensitivity })),
      ).toThrow();
    for (const fireSensitivity of [0, 7, "1", null])
      expect(() =>
        parseSave(JSON.stringify({ ...old, fireSensitivity })),
      ).toThrow();
    expect(() =>
      parseSave(JSON.stringify({ ...old, gyroEnabled: "true" })),
    ).toThrow();
  });
});

describe("camera-aligned authoritative shots", () => {
  function fixture(pitch = 0, distance = 10, height = 0) {
    const w = createWorld("camera-shot", 42),
      p = addPlayer(w, "p", [STARTERS[2], STARTERS[0]]);
    p.x = p.z = 0;
    p.y = height;
    const input = { ...neutral(), cameraAim: true, pitch };
    const { camera, direction: d } = aimCamera(p, input);
    spawn(w, "crawler", camera.x + d.x * distance, camera.z + d.z * distance);
    const e = w.enemies[0];
    e.y = camera.y + d.y * distance - (eye(e) - e.y);
    return { w, p, input, e };
  }
  it("sends accurate rockets through the center target at near/far and elevated angles", () => {
    for (const pitch of [0, 0.5, MAX_PITCH])
      for (const distance of [8, 15, 35, 60]) {
        const { w, p, input, e } = fixture(pitch, distance, 20);
        const shot = cameraShot(w, p, input);
        fire(w, p, input);
        const q = w.projectiles[0];
        const length = Math.hypot(
          shot.target.x - p.x,
          shot.target.y - ((p.y ?? 0) + 1.5),
          shot.target.z - p.z,
        );
        for (const [actual, expected] of [
          [q.dx / 28, (shot.target.x - p.x) / length],
          [q.dy / 28, (shot.target.y - ((p.y ?? 0) + 1.5)) / length],
          [q.dz / 28, (shot.target.z - p.z) / length],
        ])
          expect(actual).toBeCloseTo(expected, 10);
        const targetDistance = Math.hypot(
          shot.target.x - e.x,
          shot.target.y - eye(e),
          shot.target.z - e.z,
        );
        expect(targetDistance).toBeCloseTo(1.25, 6);
      }
  });
  it("hits a centered close target with rifle and shotgun without hidden aim bending", () => {
    for (const weapon of STARTERS.slice(0, 2)) {
      const { w, p, input, e } = fixture(0, 10);
      p.weapons[0] = structuredClone(weapon);
      p.ammo[0] = 32;
      const hp = e.hp;
      fire(w, p, input);
      expect(e.hp).toBeLessThan(hp);
    }
  });
  it("stops at muzzle-height cover even when the shoulder camera sees the enemy", () => {
    const { w, p, input, e } = fixture(0, 15);
    p.weapons[0] = structuredClone(STARTERS[0]);
    p.ammo[0] = 32;
    const block = { x: 0, z: -1, w: 2, d: 1, h: 1.8 };
    const blocks = mapFor(w).blocks;
    blocks.push(block);
    try {
      const hp = e.hp;
      fire(w, p, input);
      expect(e.hp).toBe(hp);
      const shot = w.events.find((e) => e.type === "shot")!;
      expect(shot.tz).toBeGreaterThanOrEqual(-0.501);
    } finally {
      blocks.splice(blocks.indexOf(block), 1);
    }
  });
  it("stops downward camera-aligned hitscan shots at the ground", () => {
    const w = createWorld("floor", 42),
      p = addPlayer(w, "p");
    p.x = p.z = 0;
    fire(w, p, { ...neutral(), cameraAim: true, pitch: -0.6 });
    expect(w.events.find((e) => e.type === "shot")!.ty).toBeCloseTo(0, 10);
  });
  it("validates the additive network flag while retaining older clients", () => {
    expect(validInput({ ...neutral(), cameraAim: true })).toBe(true);
    expect(validInput(neutral())).toBe(true);
    for (const cameraAim of ["true", 1, null])
      expect(validInput({ ...neutral(), cameraAim })).toBe(false);
  });
  it("doubles angular magnification without changing the sight point", () => {
    expect(
      Math.tan((NORMAL_FOV * Math.PI) / 360) /
        Math.tan((SCOPE_FOV * Math.PI) / 360),
    ).toBeCloseTo(2, 10);
  });
});
