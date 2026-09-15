import { it, expect } from "vitest";
import {
  defaultLayout,
  parseLayout,
  resolveLayout,
  overlaps,
  HUD_HEIGHT,
} from "../src/client/layout";
it("keeps default controls visible, separated and below information at short landscape sizes", () => {
  for (const [w, h] of [
    [640, 280],
    [740, 300],
    [844, 320],
    [915, 412],
    [1280, 720],
  ]) {
    const rects = resolveLayout(defaultLayout(), w, h, {
      left: 16,
      right: 8,
      top: 0,
      bottom: 6,
    });
    expect(overlaps(rects)).toBe(false);
    for (const r of rects) {
      expect(r.left).toBeGreaterThanOrEqual(16);
      expect(r.top).toBeGreaterThanOrEqual(HUD_HEIGHT);
      expect(r.left + r.size).toBeLessThanOrEqual(w - 8);
      expect(r.top + r.size).toBeLessThanOrEqual(h - 6);
      expect(r.size).toBeGreaterThanOrEqual(44);
    }
  }
});
it("persists versioned placement and rejects corrupt/out-of-range settings", () => {
  const value = defaultLayout();
  value.buttons.fire.x = 0.8;
  value.buttons.fire.size = 1.2;
  expect(parseLayout(JSON.stringify(value))).toEqual(value);
  for (const raw of [
    "{",
    "null",
    JSON.stringify({ ...value, version: 2 }),
    JSON.stringify({ ...value, opacity: 0 }),
    JSON.stringify({
      ...value,
      buttons: { ...value.buttons, fire: { x: 2, y: 0.5, size: 1 } },
    }),
  ])
    expect(() => parseLayout(raw)).toThrow();
  expect(parseLayout(null)).toEqual(defaultLayout());
});
it("detects overlap while clamping dragged controls into the safe area", () => {
  const v = defaultLayout();
  v.buttons.fire = { ...v.buttons.reload };
  expect(overlaps(resolveLayout(v, 915, 412))).toBe(true);
  v.buttons.fire = { x: 0, y: 0, size: 1.4 };
  const r = resolveLayout(v, 640, 280)[1];
  expect(r.left).toBeGreaterThanOrEqual(8);
  expect(r.top).toBeGreaterThanOrEqual(88);
});
it("adds the scope control to old layouts without losing custom positions", () => {
  const value = defaultLayout();
  value.buttons.fire.x = 0.85;
  const raw = JSON.parse(JSON.stringify(value));
  delete raw.buttons.scope;
  const loaded = parseLayout(JSON.stringify(raw));
  expect(loaded.buttons.fire).toEqual(value.buttons.fire);
  expect(loaded.buttons.scope).toEqual(defaultLayout().buttons.scope);
});
it("inherits legacy opacity while saving each control independently", () => {
  const v = defaultLayout();
  v.opacity = 0.55;
  v.buttons.fire.opacity = 0.9;
  v.buttons.move.opacity = 0.4;
  const loaded = parseLayout(JSON.stringify(v));
  expect(loaded.buttons.fire.opacity).toBe(0.9);
  expect(loaded.buttons.move.opacity).toBe(0.4);
  expect(loaded.buttons.reload.opacity ?? loaded.opacity).toBe(0.55);
  for (const opacity of [0, 1.1, "0.8", null]) {
    const raw = JSON.parse(JSON.stringify(v));
    raw.buttons.fire.opacity = opacity;
    expect(() => parseLayout(JSON.stringify(raw))).toThrow();
  }
});
