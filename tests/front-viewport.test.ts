import { expect, it, vi } from "vitest";
import * as T from "three";
import { prepareBattle } from "../src/client/battle-loading";
import { createWorld, addPlayer } from "../src/shared/game";
import { VIEW_MAPS } from "../src/client/map-assets";
import type { Renderer } from "../src/client/render";

vi.mock("../src/client/standard-trooper", () => ({
  loadStandardTrooper: async () => {},
}));
vi.mock("../src/client/progression-weapons", () => ({
  loadProgressionWeapons: async () => {},
}));

it("GPU準備の途中で画面サイズが変わっても新しい描画範囲を復元する", async () => {
  vi.stubGlobal("requestAnimationFrame", (fn: () => void) => setTimeout(fn, 0));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  try {
    const world = createWorld("viewport-resize", 1, 1);
    addPlayer(world, "one");
    let viewport = new T.Vector4(0, 0, 844, 390);
    let scissor = viewport.clone();
    let scissorTest = false;
    const renderer = {
      info: { programs: [] },
      compileAsync: vi.fn(async () => {}),
      getViewport: vi.fn((out: T.Vector4) => out.copy(viewport)),
      getScissor: vi.fn((out: T.Vector4) => out.copy(scissor)),
      getScissorTest: vi.fn(() => scissorTest),
      setViewport: vi.fn(
        (...args: [T.Vector4] | [number, number, number, number]) => {
          viewport =
            args[0] instanceof T.Vector4
              ? args[0].clone()
              : new T.Vector4(...(args as [number, number, number, number]));
        },
      ),
      setScissor: vi.fn(
        (...args: [T.Vector4] | [number, number, number, number]) => {
          scissor =
            args[0] instanceof T.Vector4
              ? args[0].clone()
              : new T.Vector4(...(args as [number, number, number, number]));
        },
      ),
      setScissorTest: vi.fn((enabled: boolean) => {
        scissorTest = enabled;
      }),
      render: vi.fn(),
      getContext: () => ({
        SYNC_GPU_COMMANDS_COMPLETE: 1,
        TIMEOUT_EXPIRED: 2,
        WAIT_FAILED: 3,
        fenceSync: () => ({}),
        flush: () => {},
        clientWaitSync: () => 1,
        deleteSync: () => {},
      }),
    };
    const roots = [new T.Group(), new T.Group()];
    const ready = VIEW_MAPS.map(() => ({ state: "ready", error: "" }));
    const view = {
      renderer,
      scene: new T.Scene(),
      camera: new T.PerspectiveCamera(),
      structures: new Map(
        roots.map((group, i) => [
          String(i),
          { batch: { group }, loading: Promise.resolve() },
        ]),
      ),
      spawnEffects: { preparationRoots: [] },
      bastion: { preparationRoots: [], load: async () => {} },
      mapAssets: { status: ready, distantStatus: ready, select: () => {} },
      players: new Map([["one", { userData: { trooper: {} } }]]),
      render: vi.fn(),
    } as unknown as Renderer;

    await prepareBattle(
      view,
      world,
      "one",
      () => false,
      (value, status) => {
        if (value !== 96 || !status.stage.includes("GPU 1/2")) return;
        viewport = new T.Vector4(0, 0, 1280, 720);
        scissor = viewport.clone();
      },
    );

    expect(viewport.toArray()).toEqual([0, 0, 1280, 720]);
    expect(scissor.toArray()).toEqual([0, 0, 1280, 720]);
    expect(scissorTest).toBe(false);
  } finally {
    vi.unstubAllGlobals();
  }
});
