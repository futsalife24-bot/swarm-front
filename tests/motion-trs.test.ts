import { it, expect } from "vitest";
import * as T from "three";
import { trsPalette } from "../src/client/motion-trs";
import { StructureMotionController } from "../src/client/structure-motion";

it("preserves full turns, translations and nonuniform scales in the rotation palette", () => {
  const matrices = new Float32Array(181 * 16),
    expected: T.Matrix4[] = [];
  for (let i = 0; i <= 180; i++) {
    const q = new T.Quaternion().setFromEuler(
      new T.Euler(-Math.PI / 4, 0, (i * Math.PI) / 90),
    );
    const m = new T.Matrix4().compose(
      new T.Vector3(i / 10, 0.5, -0.8),
      q,
      new T.Vector3(1, 2, 3),
    );
    m.toArray(matrices, i * 16);
    expected.push(m);
  }
  const packed = trsPalette(matrices);
  for (let i = 0; i <= 180; i++) {
    const at = i * 16,
      q = new T.Quaternion().fromArray(packed, at),
      m = new T.Matrix4().compose(
        new T.Vector3().fromArray(packed, at + 4),
        q,
        new T.Vector3().fromArray(packed, at + 8),
      );
    expect(q.length()).toBeCloseTo(1, 6);
    m.elements.forEach((v, j) =>
      expect(v).toBeCloseTo(expected[i].elements[j], 5),
    );
  }
});

it("keeps a continuous shortest arc when a half-turn spin transitions to a new clip", () => {
  for (const kind of ["Idle", "Slam", "PollenShot"] as const) {
    const controller = new StructureMotionController("calyx");
    const input = {
      slot: 0,
      id: 1,
      moving: true,
      distance: 0.65 / 60,
      wind: 0,
      cool: 0,
    };
    for (let frame = 0; frame < 170; frame++)
      controller.update({ setPose() {} }, [input], 1 / 60);
    let prior = new T.Quaternion().setFromAxisAngle(
      new T.Vector3(0, 1, 0),
      ((170 / 60) * Math.PI) / 3,
    );
    let largestStep = 0;
    for (let frame = 1; frame <= 21; frame++) {
      controller.update(
        {
          setPose(_slot, _clip, _time, _from, fromTime, mix) {
            const pose = new T.Quaternion()
              .setFromAxisAngle(
                new T.Vector3(0, 1, 0),
                (fromTime! * Math.PI) / 3,
              )
              .slerp(new T.Quaternion(), Math.min(1, mix!));
            largestStep = Math.max(largestStep, prior.angleTo(pose));
            prior = pose;
          },
        },
        [
          {
            ...input,
            moving: false,
            distance: 0,
            worldTime: frame / 60,
            calyx:
              kind === "Idle"
                ? undefined
                : { kind, started: 0, fired: false, yaw: 0 },
          },
        ],
        1 / 60,
      );
    }
    expect(largestStep).toBeLessThan(0.3);
    expect(prior.angleTo(new T.Quaternion())).toBeLessThan(0.001);
  }
});
