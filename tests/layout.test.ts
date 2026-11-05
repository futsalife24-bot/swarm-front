import { afterEach, it, expect, vi } from "vitest";
import {
  defaultLayout,
  parseLayout,
  resolveLayout,
  overlaps,
  HUD_HEIGHT,
  ensureScopeControls,
  CONTROL_IDS,
  placeControls,
} from "../src/client/layout";
afterEach(() => vi.unstubAllGlobals());
it("keeps default controls visible, separated and below information at short landscape sizes", () => {
  for (const [w, h] of [
    [640, 280],
    [740, 300],
    [844, 320],
    [640, 360],
    [844, 390],
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
it("adds the buddy control to old layouts while preserving custom placement and opacity", () => {
  const value = defaultLayout();
  value.buttons.fire = { x: 0.85, y: 0.5, size: 1.2, opacity: 0.6 };
  const raw = JSON.parse(JSON.stringify(value));
  delete raw.buttons.buddy;
  const loaded = parseLayout(JSON.stringify(raw));
  expect(loaded).toEqual(value);
  expect(loaded.buttons.buddy).toEqual({ x: 0.92, y: 0.86, size: 1 });
  loaded.buttons.buddy = { x: 0.9, y: 0.8, size: 0.8, opacity: 0.5 };
  expect(parseLayout(JSON.stringify(loaded))).toEqual(loaded);
});
it("creates one hidden buddy placeholder without replacing an entry-owned control", () => {
  const nodes = new Map<string, object>();
  const append = vi.fn((button: { id: string }) =>
    nodes.set(button.id, button),
  );
  const createElement = vi.fn(() => ({ setAttribute: vi.fn() }));
  nodes.set("controls", { append });
  nodes.set("jump", {});
  nodes.set("scope", {});
  nodes.set("scope2", {});
  vi.stubGlobal("document", {
    getElementById: (id: string) => nodes.get(id) ?? null,
    createElement,
  });
  ensureScopeControls();
  const placeholder = nodes.get("buddy");
  expect(placeholder).toMatchObject({
    id: "buddy",
    type: "button",
    textContent: "バディ",
    hidden: true,
  });
  ensureScopeControls();
  expect(nodes.get("buddy")).toBe(placeholder);
  expect(append).toHaveBeenCalledTimes(1);
  const skillButton = { hidden: false };
  nodes.set("buddy", skillButton);
  ensureScopeControls();
  expect(nodes.get("buddy")).toBe(skillButton);
  expect(createElement).toHaveBeenCalledTimes(1);
});
it("only relocates the standard buddy placement without changing saved settings or other controls", () => {
  const layout = defaultLayout();
  layout.buttons.buddy.opacity = 0.5;
  const saved = JSON.stringify(layout);
  const rects = resolveLayout(layout, 640, 280);
  expect(rects.find((r) => r.id === "buddy")?.label).toBe("left");
  expect(rects.filter((r) => r.id !== "buddy")).toEqual(
    resolveLayout(layout, 640, 280, undefined, false),
  );
  expect(JSON.stringify(layout)).toBe(saved);
  layout.buttons.buddy.x = 0.9;
  const custom = resolveLayout(layout, 640, 280).find((r) => r.id === "buddy")!;
  expect(custom.top).toBeGreaterThan(200);
  expect(custom.label).toBeUndefined();
  expect(layout.buttons.buddy).toEqual({
    x: 0.9,
    y: 0.86,
    size: 1,
    opacity: 0.5,
  });
});
it("preserves legacy custom controls when no buddy is active and applies the chosen label side to the skill button", () => {
  const nodes = new Map(
    CONTROL_IDS.map((id) => [
      id,
      { style: {}, dataset: {} as Record<string, string>, hidden: true },
    ]),
  );
  vi.stubGlobal("document", {
    documentElement: {},
    getElementById: (id: string) =>
      nodes.get(id as (typeof CONTROL_IDS)[number]),
  });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "0" }));
  vi.stubGlobal("innerWidth", 640);
  vi.stubGlobal("innerHeight", 280);
  const legacy = JSON.parse(JSON.stringify(defaultLayout()));
  delete legacy.buttons.buddy;
  legacy.buttons.fire = { x: 0.92, y: 0.86, size: 1, opacity: 0.6 };
  const loaded = parseLayout(JSON.stringify(legacy));
  const saved = JSON.stringify(loaded);
  expect(placeControls(loaded)).toBe(false);
  const expected = resolveLayout(loaded, 640, 280, undefined, false).find(
    (r) => r.id === "fire",
  )!;
  expect(nodes.get("fire")?.style).toMatchObject({
    left: expected.left + "px",
    top: expected.top + "px",
    opacity: "0.6",
  });
  const buddy = nodes.get("buddy")!;
  expect(buddy.style).toEqual({});
  expect(buddy.hidden).toBe(true);
  expect(JSON.stringify(loaded)).toBe(saved);
  buddy.dataset.buddyActive = "true";
  expect(placeControls(defaultLayout())).toBe(false);
  expect(buddy.dataset.label).toBe("left");
  vi.stubGlobal("innerHeight", 390);
  expect(placeControls(defaultLayout())).toBe(false);
  expect(nodes.get("buddy")).toBe(buddy);
  expect(buddy.dataset.label).toBe("below");
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

it("migrates single-scope saves and keeps the second control opt-in", () => {
  const legacy = JSON.parse(JSON.stringify(defaultLayout()));
  delete legacy.secondScope;
  delete legacy.buttons.scope2;
  legacy.buttons.scope.x = 0.6;
  const loaded = parseLayout(JSON.stringify(legacy));
  expect(loaded.secondScope).toBe(false);
  expect(loaded.buttons.scope.x).toBe(0.6);
  expect(resolveLayout(loaded, 844, 390).some((r) => r.id === "scope2")).toBe(
    false,
  );
  loaded.secondScope = true;
  loaded.buttons.scope2 = { x: 0.3, y: 0.2, size: 1.2, opacity: 0.45 };
  expect(parseLayout(JSON.stringify(loaded))).toEqual(loaded);
  loaded.secondScope = false;
  const disabled = parseLayout(JSON.stringify(loaded));
  expect(disabled.buttons.scope2).toEqual(loaded.buttons.scope2);
  expect(() =>
    parseLayout(JSON.stringify({ ...loaded, secondScope: "true" })),
  ).toThrow();
});
it("keeps both default scope controls separate across landscape sizes", () => {
  const layout = defaultLayout();
  layout.secondScope = true;
  for (const [width, height] of [
    [640, 280],
    [740, 300],
    [844, 320],
    [844, 390],
    [915, 412],
    [1280, 720],
  ]) {
    const rects = resolveLayout(layout, width, height, {
      left: 16,
      right: 8,
      top: 0,
      bottom: 6,
    });
    expect(rects).toHaveLength(11);
    expect(overlaps(rects)).toBe(false);
  }
  layout.buttons.scope2 = { ...layout.buttons.scope };
  expect(overlaps(resolveLayout(layout, 844, 390))).toBe(true);
  layout.secondScope = false;
  expect(overlaps(resolveLayout(layout, 844, 390))).toBe(false);
});
