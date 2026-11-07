import { describe, it, expect, vi } from "vitest";
import * as T from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { BuddyVisuals } from "../src/client/buddy-visuals";
import { buddyPathClear, buddyFollowTarget } from "../src/client/buddy-follow";
import { createWorld, addPlayer } from "../src/shared/game";
import { STARTERS } from "../src/shared/defs";
import { BUDDY_ASSETS } from "../src/client/buddy-assets";
import { readFileSync } from "node:fs";
import {
  createBuddyBattleState,
  equipBattleBuddy,
} from "../src/shared/buddy-combat";
import { sampleBuddySkillPose } from "../src/client/buddy-skill-motion";

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
  it("採用4GLBが実クリップと一致し、埋込画像2枚・1材質を維持する", () => {
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
      expect(json.textures ?? []).toHaveLength(2);
      expect(json.images).toHaveLength(2);
      expect(
        json.images.every(
          (image: { bufferView?: number; uri?: string }) =>
            Number.isInteger(image.bufferView) && !image.uri,
        ),
      ).toBe(true);
      expect(json.materials).toHaveLength(1);
    }
  });
});

function castingWorld(kind: keyof typeof BUDDY_ASSETS = "tatara") {
  const w = world();
  w.time = 10;
  w.buddies = createBuddyBattleState(w);
  equipBattleBuddy(w.buddies, w.players[0], kind);
  const b = w.buddies.entries.one;
  Object.assign(b, {
    x: 2,
    y: 3,
    z: 4,
    skillStartedAt: 10,
    skillImpactAt: kind === "tatara" ? 10.65 : 10.35,
    skillCharge: 1,
  });
  return { w, b };
}

describe("バディ発動クリップと接地", () => {
  it.each(["tatara", "yosuga", "tobari", "oriha"] as const)(
    "%sの実GLBでも発動姿勢がseekで変わり、同じ時刻は変形を蓄積しない",
    async (kind) => {
      const { w } = castingWorld(kind);
      const appearance = [{ ...appearances[0], kind }];
      const v = new BuddyVisuals(new T.Scene(), async () => {
        const bytes = readFileSync(
          `public/assets/buddy/${BUDDY_ASSETS[kind].file}`,
        );
        // Nodeでは画像デコードだけを代替する。実画像の読込はブラウザQAで検証。
        const loader = new GLTFLoader().register(() => ({
          name: "node-animation-texture-fixture",
          loadTexture: async () => new T.Texture(),
        }));
        return loader.parseAsync(
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ),
          "",
        );
      });
      v.update(w, appearance, 0.05, new Map());
      const e = v.entries.get("slot")!;
      await e.loading;
      expect(e.error).toBeUndefined();
      const transforms = () => {
        const values: number[] = [];
        e.model!.traverse((node) =>
          values.push(
            ...node.position.toArray(),
            ...node.quaternion.toArray(),
            ...node.scale.toArray(),
          ),
        );
        return values;
      };
      w.time = 10.05;
      v.update(w, appearance, 0.05, new Map());
      const before = transforms();
      w.time = 10.25;
      v.update(w, appearance, 0.05, new Map());
      const during = transforms();
      expect(during).not.toEqual(before);
      const clip = e.actions!.get(BUDDY_ASSETS[kind].display)!;
      expect(clip.time).toBeGreaterThan(0.5);
      for (let i = 0; i < 12; i++)
        v.update(structuredClone(w), appearance, 0.1, new Map());
      expect(transforms()).toEqual(during);
      expect(e.position!.y).toBe(3);
      w.time = 11;
      v.update(w, appearance, 0.05, new Map());
      expect(e.root.position.y).toBe(3);
      expect(e.root.scale.toArray()).toEqual([1, 1, 1]);
      v.dispose();
    },
  );

  it("snapshotを繰り返しても一度だけ再生し、world時刻で接地・復帰する", async () => {
    const { w, b } = castingWorld();
    const v = new BuddyVisuals(new T.Scene(), async () => asset().gltf);
    v.update(w, appearances, 0.05, new Map());
    await flush();
    const e = v.entries.get("slot")!;
    const clip = e.actions!.get("Palm")!;
    const play = vi.spyOn(clip, "play"),
      reset = vi.spyOn(clip, "reset");
    w.time = 10.4;
    const pose = sampleBuddySkillPose("tatara", b, w.time);
    v.update(w, appearances, 0.01, new Map());
    const yaw = e.root.rotation.y;
    w.players[0].yaw = 1.5;
    for (let i = 0; i < 10; i++)
      v.update(structuredClone(w), appearances, 0.1, new Map());
    expect(play).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledOnce();
    expect(clip.loop).toBe(T.LoopOnce);
    expect(clip.time).toBeCloseTo(pose.clipProgress);
    expect(e.root.position.toArray()).toEqual([2, 3 + pose.jump, 4]);
    expect(e.position).toEqual({ x: 2, y: 3, z: 4 });
    expect(e.root.rotation.y).toBe(yaw);
    expect(b.y).toBe(3);
    w.time = b.skillImpactAt!;
    v.update(w, appearances, 0.1, new Map());
    expect(e.root.position.y).toBe(3);
    expect(e.root.scale.y).toBeCloseTo(0.76);
    w.time = b.skillImpactAt! + 0.2;
    v.update(w, appearances, 0.1, new Map());
    expect(e.root.position.toArray()).toEqual([2, 3, 4]);
    expect(e.root.scale.toArray()).toEqual([1, 1, 1]);
    expect(e.motion).toBe("Idle");
    expect(play).toHaveBeenCalledOnce();
    v.dispose();
  });

  it("読込の遅れと再接続は途中時刻から再開し、終了した発動を再生しない", async () => {
    const { w } = castingWorld();
    const pending: ((value: GLTF) => void)[] = [];
    const v = new BuddyVisuals(
      new T.Scene(),
      () => new Promise((resolve) => pending.push(resolve)),
    );
    v.update(w, appearances, 0.05, new Map());
    w.time = 10.5;
    pending.shift()!(asset().gltf);
    await flush();
    v.update(w, appearances, 0.05, new Map());
    const first = v.entries.get("slot")!;
    expect(first.actions!.get("Palm")!.time).toBeGreaterThan(0.4);
    const resumedTime = first.actions!.get("Palm")!.time;
    w.players[0].connected = false;
    v.update(w, appearances, 0.05, new Map());
    w.players[0].connected = true;
    v.update(w, appearances, 0.05, new Map());
    pending.shift()!(asset().gltf);
    await flush();
    v.update(w, appearances, 0.05, new Map());
    const rejoined = v.entries.get("slot")!;
    expect(rejoined.root.position.toArray()).toEqual(
      first.root.position.toArray(),
    );
    expect(rejoined.actions!.get("Palm")!.time).toBe(resumedTime);
    v.clear();
    w.time = 11;
    v.update(w, appearances, 0.05, new Map());
    pending.shift()!(asset().gltf);
    await flush();
    const late = v.entries.get("slot")!;
    const play = vi.spyOn(late.actions!.get("Palm")!, "play");
    v.update(w, appearances, 0.05, new Map());
    expect(play).not.toHaveBeenCalled();
    expect(late.root.position.y).toBe(3);
    expect(late.root.scale.toArray()).toEqual([1, 1, 1]);
    v.dispose();
  });

  it("通常攻撃では跳躍せず、新しいスキルだけを再発動する", async () => {
    const { w, b } = castingWorld();
    w.time = 12;
    b.lastAttackAt = 12;
    b.displayUntil = 12.3;
    const v = new BuddyVisuals(new T.Scene(), async () => asset().gltf);
    v.update(w, appearances, 0.05, new Map());
    await flush();
    v.update(w, appearances, 0.05, new Map());
    const e = v.entries.get("slot")!;
    expect(e.motion).toBe("Palm");
    expect(e.actions!.get("Palm")!.loop).toBe(T.LoopRepeat);
    expect(e.root.position.y).toBe(3);
    expect(e.root.scale.toArray()).toEqual([1, 1, 1]);
    b.skillStartedAt = 12;
    b.skillImpactAt = 12.65;
    const play = vi.spyOn(e.actions!.get("Palm")!, "play");
    w.time = 12.4;
    v.update(w, appearances, 0.05, new Map());
    v.update(structuredClone(w), appearances, 0.05, new Map());
    expect(play).toHaveBeenCalledOnce();
    expect(e.root.position.y).toBeGreaterThan(4);
    expect(e.actions!.get("Palm")!.loop).toBe(T.LoopOnce);
    v.dispose();
  });

  it("発動時刻のない旧snapshotは従来Displayを維持し、跳躍を推測しない", async () => {
    const { w, b } = castingWorld();
    delete b.skillStartedAt;
    delete b.skillImpactAt;
    delete b.chargeStartedAt;
    delete b.skillCharge;
    b.displayUntil = 11;
    const v = new BuddyVisuals(new T.Scene(), async () => asset().gltf);
    v.update(w, appearances, 0.05, new Map());
    await flush();
    v.update(w, appearances, 0.05, new Map());
    const e = v.entries.get("slot")!;
    expect(e.motion).toBe("Palm");
    expect(e.root.position.y).toBe(3);
    expect(e.root.scale.toArray()).toEqual([1, 1, 1]);
    expect(e.actions!.get("Palm")!.loop).toBe(T.LoopRepeat);
    v.dispose();
  });

  it("他3体は採用Displayを一度だけ再生し、軽減設定と中断でも変形を残さない", async () => {
    for (const kind of ["yosuga", "tobari", "oriha"] as const) {
      const { w, b } = castingWorld(kind);
      const appearance = [{ ...appearances[0], kind }];
      const v = new BuddyVisuals(
        new T.Scene(),
        async () => asset().gltf,
        () => true,
      );
      v.update(w, appearance, 0.05, new Map());
      await flush();
      const e = v.entries.get("slot")!;
      const play = vi.spyOn(e.actions!.get("Display")!, "play");
      w.time = 10.2;
      v.update(w, appearance, 0.05, new Map());
      v.update(structuredClone(w), appearance, 0.05, new Map());
      expect(e.motion).toBe("Display");
      expect(play).toHaveBeenCalledOnce();
      expect(e.root.position.y).toBe(3);
      expect(e.root.scale.y).toBeLessThan(1.011);
      b.skillStartedAt = -1;
      b.skillImpactAt = -1;
      v.update(w, appearance, 0.05, new Map());
      expect(e.root.scale.toArray()).toEqual([1, 1, 1]);
      expect(e.motion).toBe("Idle");
      v.dispose();
    }
  });
});
