import { it, expect } from "vitest";
import { AdaptiveQuality } from "../src/client/adaptive-quality";
it("keeps full resolution at the selected 30fps and still responds to overload", () => {
  const quality = new AdaptiveQuality();
  for (let i = 0; i < 900; i++) quality.update(1 / 30, true, 30);
  expect(quality.scale).toBe(1);
  for (let i = 0; i < 300; i++) quality.update(1 / 15, true, 30);
  expect(quality.scale).toBe(0.65);
  for (let i = 0; i < 2400; i++) quality.update(1 / 30, true, 30);
  expect(quality.scale).toBe(1);
});
it("responds to sustained load, recovers slowly, and excludes hidden/paused time", () => {
  const quality = new AdaptiveQuality();
  for (let i = 0; i < 30; i++) quality.update(1 / 30, true);
  expect(quality.scale).toBe(1);
  quality.update(0.1, false);
  for (let i = 0; i < 30; i++) quality.update(1 / 30, true);
  expect(quality.scale).toBe(1);
  for (let i = 0; i < 600; i++) quality.update(1 / 30, true);
  expect(quality.scale).toBe(0.65);
  for (let i = 0; i < 240; i++) quality.update(1 / 60, true);
  expect(quality.scale).toBe(0.65);
  for (let i = 0; i < 420; i++) quality.update(1 / 60, true);
  expect(quality.scale).toBeGreaterThan(0.65);
  for (let i = 0; i < 6000; i++) quality.update(1 / 60, true);
  expect(quality.scale).toBe(1);
});
