import { it, expect, vi } from "vitest";
import { createPleat } from "../src/shared/pleat-locomotion";
import { surfaceRay } from "../src/shared/surface-ray";
import { vec } from "../src/shared/surface-math";
import {
  createWorld,
  addPlayer,
  start,
  spawn,
  step,
  neutral,
  visible,
} from "../src/shared/game";
import * as stages from "../src/shared/stages";
import type { Block } from "../src/shared/map-blocks";

it("finishes a held pose near a player without stopping or starting melee early", () => {
  const blocks: Block[] = [],
    surface = {
      ray: (
        o: ReturnType<typeof vec>,
        d: ReturnType<typeof vec>,
        max: number,
      ) => surfaceRay(o, d, max, blocks),
    };
  const s = createPleat(vec(), vec(0, 0, 1), 3, surface);
  // The support has reached the floor but the body is still leaning into its old wall.
  s.up = vec(0.5, Math.sqrt(0.75), 0);
  s.poseHeld = true;
  const w = createWorld("pleat-clearance-combat", 11, 1),
    p = addPlayer(w, "p");
  start(w);
  w.nextSpawn = 1e9;
  w.enemies = [];
  const map = stages.mapFor(w),
    spy = vi.spyOn(stages, "mapFor").mockReturnValue({ ...map, blocks });
  try {
    p.x = 0;
    p.z = 1;
    p.y = 0;
    p.safe = 0;
    p.hp = 1e6;
    spawn(w, "crawler", 0, 0);
    const e = w.enemies[0];
    Object.assign(e, {
      active: true,
      size: 2,
      x: 0,
      z: 0,
      y: 0,
      wind: 0,
      cool: 0,
      pleat: s,
    });
    expect(visible(e, p, blocks)).toBe(true);
    const before = s.anchor.z;
    step(w, { p: neutral() });
    expect(s.poseHeld).toBe(true);
    expect(e.wind).toBe(0);
    expect(s.anchor.z).toBeGreaterThan(before);
    // The same close-range encounter must wind up once the body is settled.
    const ground = createPleat(vec(0, 0, 8), vec(0, 0, 1), 3, surface);
    Object.assign(e, { x: 0, y: 0, z: 8, pleat: ground, wind: 0, cool: 0 });
    p.x = 0;
    p.z = 9;
    p.y = 0;
    step(w, { p: neutral() });
    expect(e.wind).toBeGreaterThan(0);
  } finally {
    spy.mockRestore();
  }
});
