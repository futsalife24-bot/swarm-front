import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HARROW, harrowMissileOrigins } from "../src/shared/harrow";
import { HARROW_FLIGHT_CYCLE } from "../src/shared/harrow-motion";

async function model() {
  const bytes = readFileSync("public/assets/enemies/harrow_motion_v13.glb");
  // CPU geometry/animation checks only: Node has no image decoder. Actual 4K
  // texture decoding and rendering are verified separately in the browser.
  const loader = new GLTFLoader().register(() => ({
    name: "HEADLESS_GEOMETRY_ONLY",
    loadTexture: async () => new T.Texture(),
  }));
  return loader.parseAsync(
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
    Dash: HARROW.dashDuration,
    Snipe: HARROW.snipeDuration,
    BombPass: HARROW.bombDuration,
    TakeoffB: HARROW.takeoffDuration,
    TakeoffC: HARROW.takeoffDuration,
    TakeoffD: HARROW.takeoffDuration,
  };
  for (const [name, duration] of Object.entries(durations))
    expect(
      asset.animations.find((clip) => clip.name === name)?.duration,
    ).toBeCloseTo(duration, 5);
});

it("joins dive and stagger fall to landing without a skeleton discontinuity", async () => {
  const asset = await model();
  const mixer = new T.AnimationMixer(asset.scene);
  const bones: T.Bone[] = [];
  asset.scene.traverse((object) => {
    if (object instanceof T.Bone) bones.push(object);
  });
  expect(bones).toHaveLength(39);
  const pose = (name: string, end: boolean) => {
    mixer.stopAllAction();
    const clip = asset.animations.find((c) => c.name === name)!;
    const action = mixer.clipAction(clip).reset().setLoop(T.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    mixer.setTime(end ? clip.duration : 0);
    asset.scene.updateMatrixWorld(true);
    return bones.map((bone) => bone.matrixWorld.clone());
  };
  const landing = pose("Land", false);
  for (const name of ["Dive", "StaggerFall"])
    pose(name, true).forEach((matrix, i) => {
      expect(
        Math.max(
          ...matrix.elements.map((v, j) =>
            Math.abs(v - landing[i].elements[j]),
          ),
        ),
      ).toBeLessThan(0.00001);
    });
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
      const side = mesh.name.endsWith("L") ? "L" : "R";
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
    const sides = { L: 0, R: 0 };
    asset.scene.traverse((object) => {
      const mesh = object as T.SkinnedMesh;
      if (!mesh.isSkinnedMesh || !mesh.name.startsWith("Launcher")) return;
      expect(mesh.name).toMatch(/^Launcher[LR]_/);
      sides[mesh.name.startsWith("LauncherL_") ? "L" : "R"]++;
      mesh.skeleton.update();
      const position = mesh.geometry.attributes.position;
      // Each of the ten independent missiles has one highest rest-Y warhead tip.
      let index = 0;
      for (let i = 1; i < position.count; i++)
        if (position.getY(i) > position.getY(index)) index = i;
      const tip = mesh
        .getVertexPosition(index, new T.Vector3())
        .applyMatrix4(mesh.matrixWorld)
        .multiplyScalar(HARROW.scale);
      // Renderer applies -(PI - heading): at heading 0 both X and Z reverse.
      tip.applyAxisAngle(new T.Vector3(0, 1, 0), -Math.PI);
      actual.push(tip);
    });
    expect(actual).toHaveLength(10);
    expect(sides).toEqual({ L: 5, R: 5 });
    for (const { x, y, z, yaw } of [
      { x: 0, y: 0, z: 0, yaw: 0 },
      { x: 12, y: 4, z: -9, yaw: 0.73 },
    ]) {
      const expected = harrowMissileOrigins(
        { x, y, z, harrowAirborne: airborne },
        yaw,
      );
      const transformed = actual.map((tip) =>
        tip
          .clone()
          .applyAxisAngle(new T.Vector3(0, 1, 0), yaw)
          .add(new T.Vector3(x, y, z)),
      );
      const matched = new Set<number>();
      for (const point of expected) {
        const target = new T.Vector3(point.x, point.y, point.z);
        const matches = transformed
          .map((tip, i) => (tip.distanceTo(target) < 0.0001 ? i : -1))
          .filter((i) => i >= 0);
        expect(matches).toHaveLength(1);
        expect(matched.has(matches[0])).toBe(false);
        matched.add(matches[0]);
      }
      expect(matched.size).toBe(10);
    }
  },
);
