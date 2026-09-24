import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HARROW, harrowMissileOrigins } from "../src/shared/harrow";
import { HARROW_FLIGHT_CYCLE } from "../src/shared/harrow-motion";

async function model() {
  const bytes = readFileSync("public/assets/enemies/harrow_motion_v9.glb");
  return new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
}

it("the shipped HARROW clips finish at their authoritative attack transitions", async () => {
  const asset = await model();
  const durations = {
    Threat: HARROW.threatDuration,
    AirThreat: HARROW.threatDuration,
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

it("plants both articulated wings before the authoritative single sweep while keeping root motion external", async () => {
  const asset = await model();
  asset.scene.rotation.y = -Math.PI / 2;
  const mixer = new T.AnimationMixer(asset.scene);
  const clip = asset.animations.find((a) => a.name === "Spin")!;
  const action = mixer.clipAction(clip).setLoop(T.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  const root = asset.scene.getObjectByName("Root")!;
  const torso = asset.scene.getObjectByName("Torso")!;
  mixer.setTime(0);
  asset.scene.updateMatrixWorld(true);
  const rootRest = root.matrix.clone(),
    torsoRest = torso.matrix.clone();
  mixer.setTime(0.8);
  asset.scene.updateMatrixWorld(true);
  expect(
    Math.max(
      ...torso.matrix.elements.map((v, i) =>
        Math.abs(v - torsoRest.elements[i]),
      ),
    ),
  ).toBeGreaterThan(0.1);
  for (const time of [
    HARROW.spinWind,
    HARROW.spinWind + HARROW.spinTurn / 2,
    HARROW.spinWind + HARROW.spinTurn,
  ]) {
    mixer.setTime(time);
    asset.scene.updateMatrixWorld(true);
    expect(root.matrix.elements).toEqual(rootRest.elements);
    const wings = {
      L: { min: Infinity, radius: 0 },
      R: { min: Infinity, radius: 0 },
    };
    asset.scene.traverse((object) => {
      const mesh = object as T.SkinnedMesh;
      if (!mesh.isSkinnedMesh || !mesh.name.startsWith("Wing")) return;
      mesh.skeleton.update();
      const side = mesh.name.split("__")[0].endsWith("L") ? "L" : "R";
      const wing = wings[side];
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        const p = mesh
          .getVertexPosition(i, new T.Vector3())
          .applyMatrix4(mesh.matrixWorld)
          .multiplyScalar(HARROW.scale);
        wing.min = Math.min(wing.min, p.y);
        if (p.y < 2) wing.radius = Math.max(wing.radius, Math.hypot(p.x, p.z));
      }
    });
    for (const wing of Object.values(wings)) {
      expect(wing.min).toBeGreaterThan(-0.004);
      expect(wing.min).toBeLessThan(0.1);
      expect(wing.radius).toBeGreaterThanOrEqual(21.2);
    }
  }
  mixer.setTime(clip.duration);
  asset.scene.updateMatrixWorld(true);
  expect(
    Math.max(
      ...torso.matrix.elements.map((v, i) =>
        Math.abs(v - torsoRest.elements[i]),
      ),
    ),
  ).toBeLessThan(0.0001);
});

it.each([false, true])(
  "ten authoritative missile origins match the shipped warhead tips (airborne %s)",
  async (airborne) => {
    const asset = await model();
    asset.scene.rotation.y = -Math.PI / 2;
    const mixer = new T.AnimationMixer(asset.scene);
    mixer
      .clipAction(
        asset.animations.find(
          (clip) => clip.name === (airborne ? "AirThreat" : "Threat"),
        )!,
      )
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
    const expected = harrowMissileOrigins(
      { x: 0, y: 0, z: 0, harrowAirborne: airborne },
      0,
    );
    expect(actual).toHaveLength(10);
    for (const point of expected)
      expect(
        Math.min(
          ...actual.map((tip) =>
            tip.distanceTo(new T.Vector3(point.x, point.y, point.z)),
          ),
        ),
      ).toBeLessThan(0.0001);
  },
);
