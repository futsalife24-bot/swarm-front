import { it, expect } from "vitest";
import {
  createPleat,
  stepPleat,
  type PleatState,
} from "../src/shared/pleat-locomotion";
import { surfaceRay } from "../src/shared/surface-ray";
import { vec, add, mul, sub, length, dot } from "../src/shared/surface-math";
import type { Block } from "../src/shared/map-blocks";

it.each([1 / 60, 0.05, 0.1])(
  "large low-clearance course stays continuous and resumes at dt=%s",
  (dt) => {
    for (const scale of [2.25, 3])
      for (const turn of [false, true]) {
        const blocks: Block[] = turn
          ? [
              { x: -5, z: 0, w: 2, d: 16, h: 8 },
              { x: 0, z: 0, w: 8, d: 16, h: 4.3, terrainBase: 4 },
            ]
          : [
              { x: 0, z: -5, w: 16, d: 2, h: 8 },
              { x: 0, z: 0, w: 16, d: 8, h: 4.3, terrainBase: 4 },
            ];
        const world = {
          ray: (
            o: ReturnType<typeof vec>,
            d: ReturnType<typeof vec>,
            max: number,
          ) => surfaceRay(o, d, max, blocks),
        };
        let s = createPleat(
            turn ? vec(1, 0, 0) : vec(0, 0, 1),
            turn ? vec(-1, 0, 0) : vec(0, 0, -1),
            scale,
            world,
          ),
          resumed: PleatState | undefined;
        let arrived = false,
          held = false,
          exited = false,
          done = false;
        for (let time = 0; time < 45; time += dt) {
          const previous = { ...s.body },
            oldUp = { ...s.up },
            oldForward = { ...s.poseForward };
          stepPleat(s, s.forward, arrived ? 0 : 1.5, dt, world);
          if (resumed) {
            stepPleat(resumed, resumed.forward, arrived ? 0 : 1.5, dt, world);
            expect(resumed).toEqual(s);
          } else if (s.transfer?.exit?.stage === 0)
            resumed = JSON.parse(JSON.stringify(s));
          held ||= !!s.lowClearance;
          exited ||= s.transfer?.exit?.stage === 2;
          expect(length(sub(s.body, previous))).toBeLessThan(
            4.5 * scale * dt + 1e-5,
          );
          expect(dot(s.up, oldUp)).toBeGreaterThan(Math.cos(6 * dt) - 0.001);
          expect(dot(s.poseForward, oldForward)).toBeGreaterThan(
            Math.cos(9 * dt) - 0.001,
          );
          for (const [y, z] of [
            [0, -0.78],
            [0.244, -0.434],
            [0.302, 0.687],
            [0.302, 1.478],
          ]) {
            const p = add(
              s.body,
              add(mul(s.up, y * scale), mul(s.poseForward, -z * scale)),
            );
            expect(
              p.y,
              JSON.stringify({ time, scale, turn, p, s }),
            ).toBeGreaterThanOrEqual(-0.001);
            for (const b of blocks)
              expect(
                Math.abs(p.x - b.x) < b.w / 2 - 0.001 &&
                  Math.abs(p.z - b.z) < b.d / 2 - 0.001 &&
                  p.y > (b.terrainBase ?? 0) + 0.001 &&
                  p.y < b.h - 0.001,
                JSON.stringify({ time, scale, turn, p }),
              ).toBe(false);
          }
          arrived ||= s.normal.y > 0.9 && s.anchor.y > 4.2;
          if (arrived && !s.transfer && !s.settling && !s.poseHeld) {
            expect(s.body.y).toBeGreaterThan(4.3);
            done = true;
            break;
          }
        }
        expect({ held, exited, done, resumed: !!resumed }).toEqual({
          held: true,
          exited: true,
          done: true,
          resumed: true,
        });
      }
  },
);
import legacySlab from "../docs/evidence/pleat-wall-acceptance-20261101/slab-3-lightweight.json";
it("recovers a saved lightweight pose already intersecting the floor", () => {
  const frame = legacySlab.frames.find((f) => Math.abs(f.time - 5.75) < 1e-6)!;
  const s = {
    ...JSON.parse(JSON.stringify(frame)),
    velocity: vec(),
  } as PleatState;
  const blocks: Block[] = [
    { x: 0, z: -5, w: 16, d: 2, h: 8 },
    { x: 0, z: 0, w: 16, d: 8, h: 4.3, terrainBase: 4 },
  ];
  const world = {
    ray: (o: ReturnType<typeof vec>, d: ReturnType<typeof vec>, max: number) =>
      surfaceRay(o, d, max, blocks),
  };
  let done = false;
  for (let i = 0; i < 600; i++) {
    const previous = { ...s.body };
    stepPleat(s, s.forward, 1.5, 0.05, world);
    expect(length(sub(s.body, previous))).toBeLessThan(4.5 * 3 * 0.05 + 1e-5);
    if (s.anchor.y > 4.2 && s.normal.y > 0.9 && s.body.y > 4.3 && !s.poseHeld) {
      done = true;
      break;
    }
  }
  expect(done, JSON.stringify(s)).toBe(true);
});
