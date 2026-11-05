import { afterEach, expect, it, vi } from "vitest";
import * as T from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { BuddyVisuals } from "../src/client/buddy-visuals";
import { createWorld, addPlayer } from "../src/shared/game";
import {
  createBuddyBattleState,
  equipBattleBuddy,
} from "../src/shared/buddy-combat";
import { prepareBattle } from "../src/client/battle-loading";
import type { Renderer } from "../src/client/render";
vi.mock("../src/client/standard-trooper", () => ({
  loadStandardTrooper: async () => {},
}));
vi.mock("../src/client/progression-weapons", () => ({
  loadProgressionWeapons: async () => {},
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function world() {
  const w = createWorld("buddy-prepare", 1, 1);
  const p = addPlayer(w, "one");
  w.buddies = createBuddyBattleState(w);
  equipBattleBuddy(w.buddies, p, "tatara");
  return w;
}
function model() {
  const scene = new T.Group();
  scene.add(new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial()));
  return {
    scene,
    animations: ["Idle", "Follow", "Palm"].map(
      (id) => new T.AnimationClip(id, 1, []),
    ),
  } as unknown as GLTF;
}
it("準備中lobbyの実ロードを待ち、失敗を伝えて再試行で同じ所有者を1体だけ作る", async () => {
  const w = world(),
    asset = model();
  let reject!: (error: Error) => void;
  const load = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, no) => {
          reject = no;
        }),
    )
    .mockResolvedValueOnce(asset);
  const view = new BuddyVisuals(new T.Scene(), load);
  let ended = false;
  const waiting = view.prepare(w, new Map()).finally(() => {
    ended = true;
  });
  expect(view.entries.size).toBe(1);
  await Promise.resolve();
  expect(ended).toBe(false);
  const failure = expect(waiting).rejects.toThrow("タタラを読み込めません");
  reject(Error("GLB 404"));
  await failure;
  await view.prepare(w, new Map());
  expect(view.entries.size).toBe(1);
  expect(view.entries.get("one")?.model).toBe(asset.scene);
  w.phase = "battle";
  view.update(w, [{ key: "one", owner: "one", kind: "tatara" }], 0, new Map());
  expect(load).toHaveBeenCalledTimes(2);
  view.dispose();
});
it("prepareBattleの既存取消・60秒期限でバディ待機を止め、遅延ロードも解放する", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (fn: () => void) => setTimeout(fn, 1));
  vi.stubGlobal("cancelAnimationFrame", (id: ReturnType<typeof setTimeout>) =>
    clearTimeout(id),
  );
  vi.spyOn(performance, "now").mockImplementation(() => Date.now());
  for (const stop of ["cancel", "timeout"] as const) {
    const w = world(),
      asset = model();
    let resolve!: (value: GLTF) => void;
    const visuals = new BuddyVisuals(
      new T.Scene(),
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const mesh = asset.scene.children[0] as T.Mesh;
    const disposal = vi.spyOn(mesh.geometry, "dispose");
    const cancel = vi.fn(() => visuals.clear());
    const view = {
      structures: new Map(),
      bastion: { load: async () => {} },
      prepareBuddies: () => visuals.prepare(w, new Map()),
      cancelBuddyPreparation: cancel,
    } as unknown as Renderer;
    let cancelled = false;
    const result = prepareBattle(view, w, "one", () => cancelled).then(
      () => "success",
      (error: Error) => error.message,
    );
    await vi.advanceTimersByTimeAsync(200);
    expect(visuals.entries.size).toBe(1);
    cancelled = stop === "cancel";
    await vi.advanceTimersByTimeAsync(stop === "cancel" ? 100 : 61000);
    expect(await result).toContain(
      stop === "cancel"
        ? "準備を中止"
        : "読み込みに時間がかかっています（バディ）",
    );
    expect(cancel).toHaveBeenCalledOnce();
    expect(visuals.entries.size).toBe(0);
    resolve(asset);
    await Promise.resolve();
    await Promise.resolve();
    expect(disposal).toHaveBeenCalledOnce();
    visuals.dispose();
  }
});
