import { expect, it } from "vitest";
import * as T from "three";
import { captureFromLocation } from "../src/client/clean-capture";
import { CombatEffects } from "../src/client/combat-effects";
import { hudMarkup } from "../src/client/hud";
import { createWorld, addPlayer } from "../src/shared/game";

it.each(["", "?clean=0", "?clean=true", "?tracers=off", "?qa=1&perf=1"])(
  "keeps normal presentation without exact clean=1: %s",
  (search) => {
    expect(captureFromLocation(search)).toEqual({
      enabled: false,
      tracerOpacity: 1,
    });
    const fx = new CombatEffects(new T.Scene(), captureFromLocation(search));
    fx.add("bullet", 0, 1, 0, 1, 1, 0xffffff);
    fx.add("trail", 0, 1, 0, 1, 1, 0xffffff);
    expect(fx.items).toHaveLength(2);
    fx.update(0.25);
    expect(fx.items.map((e) => e.mesh.material.opacity)).toEqual([0.75, 0.75]);
    fx.clear();
  },
);
it("retains the existing HUD markup for ordinary play", () => {
  const w = createWorld("capture", 42, 1);
  addPlayer(w, "p");
  const html = hudMarkup(w, "p", "connected");
  for (const name of [
    "hud-rail",
    "mission-hud",
    "weapon-hud",
    "crosshair",
    "pc-help",
    "connected",
  ])
    expect(html).toContain(name);
});
it.each([
  ["?clean=1", 0.25],
  ["?clean=1&tracers=off", 0],
] as const)("changes only tracer presentation: %s", (search, opacity) => {
  const fx = new CombatEffects(new T.Scene(), captureFromLocation(search));
  fx.add("bullet", 0, 1, 0, 1, 1, 0xffffff);
  fx.add("trail", 0, 1, 0, 1, 1, 0xffffff);
  fx.add("flash", 0, 1, 0, 1, 1, 0xffffff);
  fx.event({ id: 2, type: "burst", x: 0, y: 0, z: 0, radius: 3.5 });
  expect(fx.items.some((e) => e.kind === "bullet")).toBe(opacity > 0);
  expect(fx.items.some((e) => e.kind === "trail")).toBe(opacity > 0);
  expect(fx.items.some((e) => e.kind === "ring")).toBe(true);
  fx.update(0.1);
  expect(
    fx.items.find((e) => e.kind === "flash")!.mesh.material.opacity,
  ).toBeCloseTo(0.9);
  if (opacity)
    expect(
      fx.items.find((e) => e.kind === "bullet")!.mesh.material.opacity,
    ).toBeCloseTo(0.9 * opacity);
  fx.clear();
});
