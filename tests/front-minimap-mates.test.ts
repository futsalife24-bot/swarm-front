import { afterEach, expect, it, vi } from "vitest";
import { Minimap } from "../src/client/minimap";
import type { World } from "../src/shared/game";

vi.mock("../src/shared/stages", () => ({ mapFor: () => ({ blocks: [] }) }));
vi.mock("../src/shared/terrain", () => ({
  markerAbove: () => false,
  groundHeight: () => 0,
  terrainProps: () => [],
}));

function fixture(rotates: boolean) {
  const context = new Proxy({}, { get: () => () => {} });
  const canvas = () => ({
    clientWidth: 160,
    width: 0,
    height: 0,
    classList: { toggle: () => {} },
    getContext: () => context,
  });
  vi.stubGlobal("devicePixelRatio", 1);
  vi.stubGlobal("document", { getElementById: canvas, createElement: canvas });
  const map = new Minimap();
  map.rotates = rotates;
  const dots = vi.spyOn(map, "dot");
  const rings = vi.spyOn(map, "ring");
  return { map, dots, rings };
}
afterEach(() => vi.unstubAllGlobals());

it.each([false, true])(
  "遠くの味方とダウンした味方は縁の内側に残る（回転=%s）",
  (rotates) => {
    const { map, dots, rings } = fixture(rotates);
    const players = [
      { id: "self", x: 0, z: 0, hp: 100, connected: true },
      { id: "alive", x: 90, z: 80, hp: 100, connected: true },
      { id: "down", x: -90, z: -80, hp: 0, down: 5, connected: true },
      { id: "offline", x: 20, z: 20, hp: 100, connected: false },
    ];
    map.draw({ players, enemies: [] } as unknown as World, "self", 0, 100);
    expect(dots).toHaveBeenCalledTimes(1);
    expect(rings).toHaveBeenCalledTimes(1);
    for (const [x, y, radius] of [...dots.mock.calls, ...rings.mock.calls]) {
      expect(x - radius).toBeGreaterThanOrEqual(0);
      expect(y - radius).toBeGreaterThanOrEqual(0);
      expect(x + radius).toBeLessThanOrEqual(map.canvas.width);
      expect(y + radius).toBeLessThanOrEqual(map.canvas.height);
      if (rotates)
        expect(
          Math.hypot(x - map.canvas.width / 2, y - map.canvas.height / 2) +
            radius,
        ).toBeLessThan(map.canvas.height / 2);
    }
    expect(dots.mock.calls[0][0]).toBeGreaterThan(map.canvas.width / 2);
    expect(rings.mock.calls[0][0]).toBeLessThan(map.canvas.width / 2);
  },
);

it("ソロでは味方マークを描かない", () => {
  const { map, dots, rings } = fixture(true);
  map.draw(
    {
      players: [{ id: "self", x: 0, z: 0, hp: 100, connected: true }],
      enemies: [],
    } as unknown as World,
    "self",
    0,
    100,
  );
  expect(dots).not.toHaveBeenCalled();
  expect(rings).not.toHaveBeenCalled();
});
