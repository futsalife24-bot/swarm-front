import { it, expect } from "vitest";
import * as T from "three";
import { trsPalette } from "../src/client/motion-trs";

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
