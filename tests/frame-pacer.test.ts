import { expect, it } from "vitest";
import { FramePacer } from "../src/client/frame-pacer";
import { fresh, parseSave } from "../src/client/save";

for (const refresh of [30, 60, 90, 120, 144]) {
  for (const target of [30, 60] as const) {
    it(`caps ${refresh}Hz at ${target}fps without losing animation time`, () => {
      const pacer = new FramePacer();
      let frames = 0,
        elapsed = 0;
      for (let i = 0; i < refresh * 10; i++) {
        const dt = pacer.next(1 / refresh, target);
        if (dt !== null) {
          frames++;
          elapsed += dt;
        }
      }
      expect(
        Math.abs(frames - Math.min(refresh, target) * 10),
      ).toBeLessThanOrEqual(1);
      expect(elapsed).toBeGreaterThan(9.95);
      expect(elapsed).toBeLessThanOrEqual(10.001);
    });
  }
}
it("resumes immediately and does not burst after stalls or setting changes", () => {
  const pacer = new FramePacer();
  expect(pacer.next(0.01, 30)).not.toBeNull();
  expect(pacer.next(0.001, 30)).toBeNull();
  expect(pacer.next(0.001, 60)).not.toBeNull();
  expect(pacer.next(5, 60)).toBe(0.1);
  expect(pacer.next(0, 60)).toBeNull();
  pacer.reset();
  expect(pacer.next(0, 30)).toBe(0);
});
it("loads legacy settings, persists both rates, and rejects corrupt values", () => {
  const legacy = fresh();
  delete legacy.frameRate;
  expect(parseSave(JSON.stringify(legacy)).frameRate ?? 60).toBe(60);
  for (const frameRate of [30, 60])
    expect(parseSave(JSON.stringify({ ...legacy, frameRate })).frameRate).toBe(
      frameRate,
    );
  for (const frameRate of [0, 120, "30", null])
    expect(() => parseSave(JSON.stringify({ ...legacy, frameRate }))).toThrow();
});
