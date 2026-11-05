import { describe, it, expect, vi } from "vitest";
import * as T from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { BuddyVisuals } from "../src/client/buddy-visuals";
import { buddyPathClear, buddyFollowTarget } from "../src/client/buddy-follow";
import { createWorld, addPlayer } from "../src/shared/game";
import { STARTERS } from "../src/shared/defs";
import { BUDDY_ASSETS } from "../src/client/buddy-assets";
import { readFileSync } from "node:fs";

function world() {
  const w = createWorld("buddy-test", 4, 1);
  addPlayer(w, "one", STARTERS);
  addPlayer(w, "two", STARTERS);
  w.phase = "battle";
  for (const p of w.players) {
    p.x = 0;
    p.z = 0;
    p.y = 0;
  }
  return w;
}
function asset() {
  const scene = new T.Group(),
    geometry = new T.BoxGeometry(),
    material = new T.MeshStandardMaterial();
  scene.add(new T.Mesh(geometry, material));
  return {
    gltf: {
      scene,
      animations: ["Idle", "Follow", "Palm", "Display", "Coil"].map(
        (name) => new T.AnimationClip(name, 1, []),
      ),
    } as unknown as GLTF,
    dispose: vi.spyOn(geometry, "dispose"),
    material: vi.spyOn(material, "dispose"),
  };
}
const appearances = [{ key: "slot", owner: "one", kind: "tatara" as const }];
const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));
describe("バディ外観の非同期ライフサイクル", () => {
  it("復帰猶予中の切断者を残さず、同一IDの再接続で1体だけ作り直す", async () => {
    const first = asset(),
      second = asset();
    const load = vi
      .fn()
      .mockResolvedValueOnce(first.gltf)
      .mockResolvedValueOnce(second.gltf);
    const v = new BuddyVisuals(new T.Scene(), load),
      w = world();
    v.update(w, appearances, 0.05, new Map());
    await flush();
    w.players[0].connected = false;
    v.update(w, appearances, 0.05, new Map());
    expect(v.entries.size).toBe(0);
    expect(first.dispose).toHaveBeenCalledOnce();
    w.players[0].connected = true;
    v.update(w, appearances, 0.05, new Map());
    await flush();
    v.update(structuredClone(w), appearances, 0.05, new Map());
    expect(v.entries.size).toBe(1);
    expect(load).toHaveBeenCalledTimes(2);
    v.dispose();
  });
  it("同じsnapshotと再接続相当のWorld再取得で増殖せず、消えた所有者だけ解放する", async () => {
    const a = asset(),
      load = vi.fn(async () => a.gltf),
      v = new BuddyVisuals(new T.Scene(), load),
      w = world();
    v.update(w, appearances, 0.05, new Map());
    await flush();
    v.update(structuredClone(w), appearances, 0.05, new Map());
    expect(load).toHaveBeenCalledTimes(1);
    expect(v.entries.size).toBe(1);
    expect(v.entries.get("slot")!.root.rotation.y).toBeCloseTo(Math.PI);
    w.players = w.players.filter((p) => p.id !== "one");
    v.update(w, appearances, 0.05, new Map());
    expect(v.entries.size).toBe(0);
    expect(a.dispose).toHaveBeenCalledOnce();
    expect(a.material).toHaveBeenCalledOnce();
  });
  it("退出後に完了したGLBはsceneへ戻らず、再入場した新モデルを解放しない", async () => {
    const old = asset(),
      next = asset(),
      pending: ((a: GLTF) => void)[] = [];
    const scene = new T.Scene(),
      v = new BuddyVisuals(
        scene,
        () => new Promise((resolve) => pending.push(resolve)),
      ),
      w = world();
    v.update(w, appearances, 0.05, new Map());
    v.clear();
    v.update(w, appearances, 0.05, new Map());
    pending[1](next.gltf);
    await flush();
    pending[0](old.gltf);
    await flush();
    expect(scene.children).toHaveLength(1);
    expect(old.dispose).toHaveBeenCalledOnce();
    expect(next.dispose).not.toHaveBeenCalled();
    const mixer = v.entries.get("slot")!.mixer!;
    const stop = vi.spyOn(mixer, "stopAllAction"),
      uncache = vi.spyOn(mixer, "uncacheRoot");
    v.dispose();
    v.dispose();
    expect(stop).toHaveBeenCalledOnce();
    expect(uncache).toHaveBeenCalledOnce();
    expect(next.dispose).toHaveBeenCalledOnce();
    expect(scene.children).toHaveLength(0);
  });
  it("旧作戦の読込完了を捨て、新作戦・別所有者を区別する", async () => {
    const old = asset(),
      next = asset(),
      pending: ((a: GLTF) => void)[] = [],
      v = new BuddyVisuals(
        new T.Scene(),
        () => new Promise((resolve) => pending.push(resolve)),
      ),
      w = world();
    v.update(w, appearances, 0.05, new Map());
    w.run = "next";
    v.update(w, [{ ...appearances[0], owner: "two" }], 0.05, new Map());
    pending[0](old.gltf);
    pending[1](next.gltf);
    await flush();
    expect(old.dispose).toHaveBeenCalledOnce();
    expect(v.entries.get("slot")!.owner).toBe("two");
    v.dispose();
  });
  it("生存・防衛・結果・nullで表示しない", async () => {
    const load = vi.fn(async () => asset().gltf),
      v = new BuddyVisuals(new T.Scene(), load),
      w = world();
    v.update({ ...w, front: {} as any }, appearances, 0.05, new Map());
    v.update({ ...w, defense: {} as any }, appearances, 0.05, new Map());
    v.update({ ...w, phase: "victory" }, appearances, 0.05, new Map());
    v.update(null, appearances, 0.05, new Map());
    expect(load).not.toHaveBeenCalled();
    expect(v.entries.size).toBe(0);
  });
  it("読込失敗を毎フレーム再要求せず、別個体を選び直せる", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("GLB unavailable"))
      .mockResolvedValueOnce(asset().gltf);
    const v = new BuddyVisuals(new T.Scene(), load),
      w = world();
    v.update(w, appearances, 0.05, new Map());
    await flush();
    await flush();
    v.update(w, appearances, 0.05, new Map());
    expect(load).toHaveBeenCalledTimes(1);
    expect(v.entries.get("slot")!.error).toBe("GLB unavailable");
    v.update(w, [{ ...appearances[0], kind: "oriha" }], 0.05, new Map());
    await flush();
    expect(v.entries.get("slot")!.model).toBeTruthy();
    v.dispose();
  });
});
describe("追従の通行と採用素材", () => {
  it("薄壁を飛び越えず、高所の足場縁からはみ出さない", () => {
    expect(
      buddyPathClear({ x: -2, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, 0.5, [
        { x: 0, z: 0, w: 0.001, d: 4, h: 5 },
      ]),
    ).toBe(false);
    expect(
      buddyFollowTarget({ x: 0, y: 4, z: 0, yaw: 0 }, 0.9, [
        { x: 0, z: 0, w: 2, d: 2, h: 4 },
      ]),
    ).toBeNull();
    expect(buddyFollowTarget({ x: 0, y: 0, z: 0, yaw: 0 }, 0.9, [])).toEqual({
      x: -2.15,
      y: 0,
      z: -1.8,
    });
  });
  it("固定された採用4GLBが実クリップと一致し、テクスチャや旧版を追加しない", () => {
    for (const [kind, def] of Object.entries(BUDDY_ASSETS)) {
      const data = readFileSync(`public/assets/buddy/${def.file}`);
      expect(data.readUInt32LE(0)).toBe(0x46546c67);
      const json = JSON.parse(
        data.subarray(20, 20 + data.readUInt32LE(12)).toString(),
      );
      const clips = json.animations.map((a: { name: string }) => a.name);
      expect(clips.sort()).toEqual(
        [
          "Idle",
          "Follow",
          def.display,
          ...(kind === "oriha" ? ["Coil"] : []),
        ].sort(),
      );
      expect(json.textures ?? []).toHaveLength(0);
      expect(json.materials).toHaveLength(1);
    }
  });
});
