import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HARROW, harrowMissileOrigins } from "../src/shared/harrow";
import { HARROW_FLIGHT_CYCLE } from "../src/shared/harrow-motion";

async function model() {
  const bytes = readFileSync("public/assets/enemies/harrow_motion_v7.glb");
  return new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
}

it("the shipped HARROW clips finish at their authoritative attack transitions", async () => {
  const asset = await model();
  const durations = {
    Threat: HARROW.threatDuration,
    Spin: HARROW.spinDuration,
    Takeoff: HARROW.takeoffDuration,
    Flight: HARROW_FLIGHT_CYCLE,
    Locomotion: 4.2,
    Glide: HARROW.glideDuration,
    Dive: HARROW.diveDuration,
    StaggerFall: HARROW.staggerFallDuration,
    Land: HARROW.landDuration,
  };
  for (const [name, duration] of Object.entries(durations))
    expect(
      asset.animations.find((clip) => clip.name === name)?.duration,
    ).toBeCloseTo(duration, 5);
});

it("ten authoritative missile origins match the shipped warhead tips at launch", async () => {
  const asset = await model();
  asset.scene.rotation.y = -Math.PI / 2;
  const mixer = new T.AnimationMixer(asset.scene);
  mixer
    .clipAction(asset.animations.find((clip) => clip.name === "Threat")!)
    .play();
  mixer.setTime(HARROW.threatWind);
  asset.scene.updateMatrixWorld(true);
  const actual: T.Vector3[] = [];
  asset.scene.traverse((object) => {
    const mesh = object as T.SkinnedMesh;
    if (
      !mesh.isSkinnedMesh ||
      !mesh.name.startsWith("Launcher") ||
      !mesh.name.includes("Carmine")
    )
      return;
    mesh.skeleton.update();
    const geometry = mesh.geometry,
      position = geometry.attributes.position;
    const parents = Array.from({ length: position.count }, (_, i) => i);
    const find = (i: number): number =>
      parents[i] === i ? i : (parents[i] = find(parents[i]));
    const join = (a: number, b: number) => {
      parents[find(a)] = find(b);
    };
    const welded = new Map<string, number>();
    for (let i = 0; i < position.count; i++) {
      const key = [position.getX(i), position.getY(i), position.getZ(i)]
        .map((v) => v.toFixed(5))
        .join(",");
      if (welded.has(key)) join(i, welded.get(key)!);
      else welded.set(key, i);
    }
    for (let i = 0; i < geometry.index!.count; i += 3) {
      join(geometry.index!.getX(i), geometry.index!.getX(i + 1));
      join(geometry.index!.getX(i), geometry.index!.getX(i + 2));
    }
    const groups = new Map<number, number[]>();
    for (let i = 0; i < position.count; i++) {
      const key = find(i);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(i);
    }
    expect(groups.size).toBe(5);
    for (const ids of groups.values()) {
      const tipX = Math.min(...ids.map((i) => position.getX(i)));
      const end = ids.filter((i) => Math.abs(position.getX(i) - tipX) < 1e-5);
      const tip = new T.Vector3();
      for (const i of end)
        tip.add(
          mesh
            .getVertexPosition(i, new T.Vector3())
            .applyMatrix4(mesh.matrixWorld),
        );
      tip.multiplyScalar(HARROW.scale / end.length);
      tip.z *= -1; // Production heading 0 faces world +Z.
      actual.push(tip);
    }
  });
  const expected = harrowMissileOrigins({ x: 0, y: 0, z: 0 }, 0);
  expect(actual).toHaveLength(10);
  for (const point of expected)
    expect(
      Math.min(
        ...actual.map((tip) =>
          tip.distanceTo(new T.Vector3(point.x, point.y, point.z)),
        ),
      ),
    ).toBeLessThan(0.0001);
});
