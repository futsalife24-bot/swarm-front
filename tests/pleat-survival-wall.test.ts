import { it, expect } from "vitest";
import { createPleat, stepPleat } from "../src/shared/pleat-locomotion";
import { surfaceRay } from "../src/shared/surface-ray";
import { vec } from "../src/shared/surface-math";
it("crosses the survival yard wall at enemy sizes", () => {
  const blocks = [{ x: 0, z: 48, w: 94, d: 2, h: 4 }];
  const world = {
    ray: (o: ReturnType<typeof vec>, d: ReturnType<typeof vec>, max: number) =>
      surfaceRay(o, d, max, blocks),
  };
  for (const size of [1, 1.2, 1.5, 2, 3]) {
    const s = createPleat(vec(0, 0, 54), vec(0, 0, -1), size, world);
    for (let i = 0; i < 2400; i++)
      stepPleat(s, vec(0, 0, -1), 3.5, 1 / 60, world);
    expect(
      s.anchor.z,
      JSON.stringify({
        size,
        anchor: s.anchor,
        normal: s.normal,
        transfer: s.transfer,
        settling: s.settling,
        feet: s.feet,
      }),
    ).toBeLessThan(46);
  }
});
