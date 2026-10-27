import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  HoundMotionBatch,
  type HoundMotionAsset,
} from "../src/client/hound-motion";
import { PleatProcedural, pleatKnee } from "../src/client/pleat-procedural";
import { createPleat, type PleatState } from "../src/shared/pleat-locomotion";
import { surfaceRay } from "../src/shared/surface-ray";

let asset: HoundMotionAsset;
beforeAll(async () => {
  const bytes = readFileSync("public/assets/enemies/pleat_motion_v5.glb");
  // Decode the actual rig, mesh attributes and inverse binds. Texture pixels are
  // irrelevant to skinning and need a browser image decoder, so stub only those.
  const loader = new GLTFLoader().register(() => ({
    name: "TestTextureDecoder",
    loadTexture: () => Promise.resolve(new T.Texture()),
  }));
  const gltf = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  const meshes: T.SkinnedMesh[] = [];
  gltf.scene.traverse((o) => {
    if (o instanceof T.SkinnedMesh) meshes.push(o);
  });
  const skeleton = meshes[0].skeleton;
  skeleton.pose();
  gltf.scene.updateMatrixWorld(true);
  asset = {
    model: gltf.scene,
    clips: gltf.animations,
    meshes,
    bones: skeleton.bones.length,
    ranges: {} as HoundMotionAsset["ranges"],
    atlas: new T.DataTexture(
      new Float32Array(skeleton.bones.length * 16),
      skeleton.bones.length * 4,
      1,
      T.RGBAFormat,
      T.FloatType,
    ),
    proceduralRest: {
      names: skeleton.bones.map((b) => b.name),
      world: skeleton.bones.map((b) => b.matrixWorld.clone()),
      inverseBind: skeleton.boneInverses.map((m) => m.clone()),
      prefix: meshes[0].matrixWorld
        .clone()
        .multiply(meshes[0].bindMatrixInverse),
      bind: meshes[0].bindMatrix.clone(),
    },
  };
});
const fresh = () =>
  createPleat({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, 1.5, {
    ray: (o, d, max) => surfaceRay(o, d, max, []),
  });
function frame(state: PleatState, q: T.Quaternion) {
  const turn = (p: { x: number; y: number; z: number }) =>
    new T.Vector3(p.x, p.y, p.z).applyQuaternion(q);
  state.body = turn(state.body);
  state.up = turn(state.up);
  state.forward = turn(state.forward);
  state.poseForward = turn(state.poseForward ?? { x: 0, y: 0, z: -1 });
  for (const f of state.feet) {
    f.point = turn(f.point);
    f.normal = turn(f.normal);
  }
  return state;
}
describe("PLEAT actual rig procedural skinning", () => {
  it("横並びの境界と最大個体数でも全骨行列と既存クリップを保持する", () => {
    const batch = new HoundMotionBatch(asset, 96);
    const shader = {
      uniforms: {},
      vertexShader: "#include <common>",
    } as Parameters<T.Material["onBeforeCompile"]>[0];
    (batch.parts[0].material as T.Material).onBeforeCompile(
      shader,
      {} as T.WebGLRenderer,
    );
    const palette = shader.uniforms.houndPalette.value as T.DataTexture;
    const pixels = palette.image.data as Float32Array;
    expect(palette.image.width).toBeLessThanOrEqual(2048);
    expect(palette.image.height).toBeLessThan(96);
    expect(pixels.slice(0, asset.atlas.image.data.length)).toEqual(
      asset.atlas.image.data,
    );
    for (let slot = 0; slot < 96; slot++) {
      const matrices = Array.from({ length: asset.bones }, (_, bone) =>
        new T.Matrix4().makeTranslation(slot, bone, slot + bone),
      );
      batch.setProceduralPose(slot, matrices);
    }
    // 全個体を書いた後に照合し、行境界で隣の個体を壊す不具合も検出する。
    for (let slot = 0; slot < 96; slot++) {
      const row = batch.poseA.getX(slot);
      for (let bone = 0; bone < asset.bones; bone++) {
        const matrix = new T.Matrix4().fromArray(
          pixels,
          (row * asset.bones + bone) * 16,
        );
        expect(matrix.elements).toEqual(
          new T.Matrix4().makeTranslation(slot, bone, slot + bone).elements,
        );
      }
    }
    batch.dispose();
  });
  it("keeps the four authored limb lengths, including unreachable and coincident targets", () => {
    const r = asset.proceduralRest!;
    expect(asset.bones).toBe(20);
    expect(asset.meshes).toHaveLength(4);
    for (const name of ["fore_L", "fore_R", "hind_L", "hind_R"]) {
      const point = (suffix: string) =>
        new T.Vector3().setFromMatrixPosition(
          r.world[r.names.indexOf(name + suffix)],
        );
      const hip = point("_upper"),
        knee = point("_lower"),
        toe = point("_toe"),
        a = hip.distanceTo(knee),
        b = knee.distanceTo(toe);
      for (const target of [
        hip.clone(),
        toe,
        new T.Vector3(50, -40, 20),
        new T.Vector3(0, 2, 0),
      ]) {
        const result = pleatKnee(hip, target, new T.Vector3(1, 0.8, 0.2), a, b);
        expect(hip.distanceTo(result.knee)).toBeCloseTo(a, 7);
        expect(result.knee.distanceTo(result.ankle)).toBeCloseTo(b, 7);
        expect(hip.distanceTo(result.ankle)).toBeLessThan(a + b);
      }
    }
  });
  it("places actual toe joints above their contact pads on ground, wall and ceiling without clip sampling", () => {
    const batch = new HoundMotionBatch(asset, 1),
      rig = new PleatProcedural(batch);
    const clips = vi.spyOn(batch, "setPose").mockImplementation(() => {
      throw new Error("keyframe playback forbidden");
    });
    const write = vi.spyOn(batch, "setProceduralPose");
    for (const angle of [0, Math.PI / 2, Math.PI]) {
      const s = frame(
        fresh(),
        new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), angle),
      );
      const unchanged = JSON.stringify(s);
      rig.update(0, s, 0, 0, 0);
      expect(JSON.stringify(s)).toBe(unchanged);
      const transform = new T.Matrix4();
      batch.parts[0].getMatrixAt(0, transform);
      const skin = write.mock.lastCall![1];
      const r = asset.proceduralRest!;
      for (const [i, name] of [
        "fore_L_toe",
        "fore_R_toe",
        "hind_L_toe",
        "hind_R_toe",
      ].entries()) {
        const index = r.names.indexOf(name);
        const toe = new T.Vector3()
          .setFromMatrixPosition(r.world[index])
          .applyMatrix4(skin[index])
          .applyMatrix4(transform);
        const desired = new T.Vector3(
          s.feet[i].point.x,
          s.feet[i].point.y,
          s.feet[i].point.z,
        ).addScaledVector(
          new T.Vector3(
            s.feet[i].normal.x,
            s.feet[i].normal.y,
            s.feet[i].normal.z,
          ),
          0.07 * s.scale,
        );
        expect(toe.distanceTo(desired)).toBeLessThan(1e-5);
      }
      expect(skin.every((m) => m.elements.every(Number.isFinite))).toBe(true);
    }
    expect(clips).not.toHaveBeenCalled();
    batch.dispose();
  });
  it("keeps independent instance palette rows and honors transported poseForward", () => {
    const batch = new HoundMotionBatch(asset, 2),
      rig = new PleatProcedural(batch);
    const a = fresh(),
      b = fresh();
    b.body.x = 8;
    b.poseForward = { x: 1, y: 0, z: 0 };
    rig.update(0, a, 0, 0, 0, undefined, 10);
    const shader = {
      uniforms: {},
      vertexShader:
        "#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>",
      fragmentShader: "",
    } as Parameters<T.Material["onBeforeCompile"]>[0];
    (batch.parts[0].material as T.Material).onBeforeCompile(
      shader,
      {} as T.WebGLRenderer,
    );
    const palette = shader.uniforms.houndPalette.value as T.DataTexture;
    const pixels = palette.image.data as Float32Array;
    const start = batch.poseA.getX(0) * asset.bones * 16;
    const savedRow = pixels.slice(start, start + asset.bones * 16);
    const row = batch.poseA.getX(0),
      before = new T.Matrix4();
    batch.parts[0].getMatrixAt(0, before);
    rig.update(1, b, 0, 0.4, 0, undefined, 20);
    expect(pixels.slice(start, start + asset.bones * 16)).toEqual(savedRow);
    expect(palette).not.toBe(asset.atlas);
    expect(palette.updateRanges).toHaveLength(0); // first upload initializes all rows
    palette.onUpdate?.(palette);
    rig.update(1, b, 1 / 60, 0.3, 0, undefined, 20);
    rig.update(1, b, 1 / 60, 0.2, 0, undefined, 20);
    expect(palette.updateRanges).toEqual([
      {
        start: batch.poseA.getX(1) * asset.bones * 16,
        count: asset.bones * 16,
      },
    ]);
    expect(batch.poseA.getX(1)).not.toBe(row);
    expect(batch.poseA.getX(0)).toBe(row);
    const after = new T.Matrix4(),
      other = new T.Matrix4();
    batch.parts[0].getMatrixAt(0, after);
    batch.parts[0].getMatrixAt(1, other);
    expect(after.elements).toEqual(before.elements);
    expect(
      new T.Vector3(0, 0, -1)
        .transformDirection(other)
        .distanceTo(new T.Vector3(1, 0, 0)),
    ).toBeLessThan(1e-6);
    batch.finish(2);
    expect(batch.parts).toHaveLength(4);
    expect(batch.parts.every((p) => p.count === 2)).toBe(true);
    rig.retain(new Set([20]));
    rig.clear();
    batch.dispose();
  });
});
