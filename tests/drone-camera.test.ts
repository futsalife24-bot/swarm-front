import { expect, it } from "vitest";
import * as T from "three";
import { encounterCamera } from "../src/client/encounter-camera";
import {
  DroneCamera,
  droneSettings,
  DRONE_DEFAULTS,
} from "../src/client/drone-camera";

it.each(["", "?clean=1", "?drone=0", "?drone=true"])(
  "does not enable camera without exact flag: %s",
  (search) => {
    expect(droneSettings(search)).toBeNull();
    expect(DroneCamera.fromLocation(search)).toBeNull();
  },
);
it("clamps URL values and rejects nonfinite settings", () => {
  expect(
    droneSettings(
      "?drone=1&droneHeight=Infinity&droneRadius=-3&droneYaw=900&droneSpeed=NaN",
    ),
  ).toEqual({ height: 32, radius: 0, yaw: 180, speed: 8 });
  expect(
    droneSettings("?drone=1&droneHeight=&droneRadius=0&droneSpeed=0"),
  ).toEqual({ ...DRONE_DEFAULTS, radius: 0, speed: 0 });
});
it("orbits the copied focus without changing soldier coordinates or camera FOV", () => {
  const focus = Object.freeze({ x: 5, y: 3, z: 8 });
  const drone = new DroneCamera({ height: 32, radius: 24, yaw: 0, speed: 10 });
  const camera = new T.PerspectiveCamera(65, 2, 0.1, 1200);
  drone.apply(camera, focus, 0.1, true);
  expect(drone.settings.yaw).toBeCloseTo(1);
  expect(camera.position.y).toBe(35);
  expect(Math.hypot(camera.position.x - 5, camera.position.z - 8)).toBeCloseTo(
    24,
  );
  const direction = new T.Vector3();
  camera.getWorldDirection(direction);
  expect(
    direction.distanceTo(
      new T.Vector3(5, 4, 8).sub(camera.position).normalize(),
    ),
  ).toBeLessThan(1e-10);
  expect(camera.fov).toBe(65);
});
it("keeps top-down orientation finite and restores the slanted view", () => {
  const drone = new DroneCamera({ ...DRONE_DEFAULTS, speed: 0 });
  const camera = new T.PerspectiveCamera();
  drone.topDown();
  drone.apply(camera, { x: 0, z: 0 }, 0, true);
  expect(camera.position.toArray()).toEqual([0, 32, 0]);
  expect(camera.quaternion.toArray().every(Number.isFinite)).toBe(true);
  expect(camera.up.toArray()).toEqual([0, 1, 0]);
  drone.topDown();
  drone.apply(camera, { x: 0, z: 0 }, 0, true);
  expect(camera.position.z).toBe(24);
  expect(camera.up.toArray()).toEqual([0, 1, 0]);
});
it("does not drift while paused, clamps a delayed frame and clears held keys", () => {
  const drone = new DroneCamera();
  const camera = new T.PerspectiveCamera();
  drone.keys.add("KeyI");
  drone.apply(camera, { x: 0, z: 0 }, 10, false);
  expect(drone.settings).toEqual(DRONE_DEFAULTS);
  expect(drone.keys.size).toBe(0);
  drone.apply(camera, { x: 0, z: 0 }, 10, true);
  expect(drone.settings.yaw).toBeCloseTo(0.8);
  drone.apply(camera, { x: 0, z: 0 }, NaN, true);
  expect(drone.settings.yaw).toBeCloseTo(0.8);
});
it("leaves the ordinary camera untouched when disabled", () => {
  const drone = new DroneCamera();
  drone.enabled = false;
  const camera = new T.PerspectiveCamera();
  camera.position.set(1, 2, 3);
  camera.lookAt(4, 5, 6);
  const before = camera.toJSON();
  drone.apply(camera, { x: 70, z: 80 }, 0.1, true);
  expect(camera.toJSON()).toEqual(before);
});

it.each([0, Math.PI / 2, Math.PI, -Math.PI / 2])(
  "keeps first-encounter shots upright after top-down at heading %s and returns to drone",
  (yaw) => {
    const drone = new DroneCamera({
      ...DRONE_DEFAULTS,
      radius: 0,
      height: 48,
      speed: 0,
    });
    const camera = new T.PerspectiveCamera(65, 16 / 9, 0.1, 1200);
    const soldier = { x: 0, y: 0, z: 0 };
    drone.apply(camera, soldier, 0, false);
    const before = camera.clone();
    const focus = new T.Vector3(4, 2, -5);
    const front = new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const sample = encounterCamera(camera.clone(), focus, front, 10);
    expect(sample(0).quaternion.angleTo(before.quaternion)).toBeLessThan(1e-7);
    for (const progress of [0.25, 0.5, 1]) {
      const pose = sample(progress);
      const up = new T.Vector3(0, 1, 0).applyQuaternion(pose.quaternion);
      const right = new T.Vector3(1, 0, 0).applyQuaternion(pose.quaternion);
      expect(up.y).toBeGreaterThan(0);
      expect(Math.abs(right.y)).toBeLessThan(1e-7);
    }
    camera.position.copy(sample(1).position);
    camera.quaternion.copy(sample(1).quaternion);
    drone.apply(camera, soldier, 0, false);
    expect(camera.position.toArray()).toEqual(before.position.toArray());
    expect(camera.quaternion.angleTo(before.quaternion)).toBeLessThan(1e-7);
  },
);

it("resumes the chosen orbit speed and direction", () => {
  const drone = new DroneCamera({ ...DRONE_DEFAULTS, speed: -12 });
  drone.toggleOrbit();
  expect(drone.settings.speed).toBe(0);
  drone.toggleOrbit();
  expect(drone.settings.speed).toBe(-12);
});
it.each([-90, -45, 45, 90, 180])(
  "preserves compass orientation when switching to top-down at yaw %s",
  (yaw) => {
    const drone = new DroneCamera({
      ...DRONE_DEFAULTS,
      height: 48,
      radius: 0.001,
      yaw,
      speed: 0,
    });
    const camera = new T.PerspectiveCamera();
    drone.apply(camera, { x: 0, z: 0 }, 0, false);
    const before = camera.quaternion.clone();
    drone.topDown();
    drone.apply(camera, { x: 0, z: 0 }, 0, false);
    expect(camera.quaternion.angleTo(before)).toBeLessThan(0.0001);
    expect(camera.up.toArray()).toEqual([0, 1, 0]);
  },
);
