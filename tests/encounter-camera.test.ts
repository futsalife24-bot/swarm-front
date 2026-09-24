import { describe, it, expect } from "vitest";
import * as T from "three";
import {
  encounterCamera,
  encounterVisible,
  harrowEncounterDistance,
} from "../src/client/encounter-camera";
import { createWorld, spawn, eye, rayVisible } from "../src/shared/game";
import { HARROW } from "../src/shared/harrow";
describe("first encounter camera", () => {
  it("introduces the airborne HARROW without requiring the soldier to look up", () => {
    const world = createWorld("contact", 1, 20);
    const enemy = spawn(world, "harrow", 0, 0)!;
    const camera = new T.PerspectiveCamera(60, 844 / 390, 0.1, 1200);
    camera.position.set(0, 2, 24);
    camera.lookAt(0, 2, 0);
    camera.updateMatrixWorld();
    const projected = new T.Vector3(0, eye(enemy), 0).project(camera);
    expect(projected.y).toBeGreaterThan(1);
    const observer = { x: 0, y: 0.8, z: 24 };
    expect(
      encounterVisible(
        "harrow",
        projected,
        24,
        rayVisible(enemy, observer, []),
      ),
    ).toBe(true);
    expect(encounterVisible("hornet", projected, 24, true)).toBe(false);
    expect(encounterVisible("harrow", projected, 121, true)).toBe(false);
    const wall = [{ x: 0, z: 12, w: 20, d: 2, h: 100 }];
    expect(
      encounterVisible(
        "harrow",
        projected,
        24,
        rayVisible(enemy, observer, wall),
      ),
    ).toBe(false);
  });

  it("centers the enlarged HARROW and keeps a wider shot on narrow landscape screens", () => {
    for (const aspect of [16 / 9, 4 / 3, 844 / 390]) {
      const focus = new T.Vector3(
        0,
        HARROW.flightHeight + 4.2 * HARROW.scale,
        0,
      );
      const camera = new T.PerspectiveCamera(40, aspect, 0.1, 1200);
      camera.position.set(0, 2, 24);
      camera.lookAt(0, 2, 0);
      const distance = harrowEncounterDistance(aspect);
      const shot = encounterCamera(
        camera,
        focus,
        new T.Vector3(0, 0, -1),
        distance,
        0,
      )(1);
      shot.updateMatrixWorld();
      expect(focus.clone().project(shot).x).toBeCloseTo(0);
      expect(focus.clone().project(shot).y).toBeCloseTo(0);
      // Complete v7 Flight envelope sampled at 10 Hz, rounded outwards.
      // Coordinates relative to eye(e), before the actor's runtime scale.
      for (const x of [-11.78, 11.78])
        for (const y of [0.33 - 4.2, 8.92 - 4.2])
          for (const z of [-5.77, 8.64]) {
            const corner = new T.Vector3(x, y, z)
              .multiplyScalar(HARROW.scale)
              .add(focus)
              .project(shot);
            expect(Math.abs(corner.x), `aspect ${aspect}`).toBeLessThan(0.9);
            expect(corner.y).toBeLessThan(0.76);
            expect(corner.y).toBeGreaterThan(-0.68);
          }
    }
  });

  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
    it(`ends in front at heading ${yaw} without crossing the specimen`, () => {
      const focus = new T.Vector3(3, 2, -7),
        front = new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const camera = new T.PerspectiveCamera(60, 16 / 9, 0.1, 1200);
      camera.position.copy(focus).addScaledVector(front, -30);
      camera.position.y = 4;
      camera.lookAt(focus);
      const sample = encounterCamera(camera, focus, front, 10);
      expect(sample(0).position.toArray()).toEqual(camera.position.toArray());
      expect(sample(0).quaternion.angleTo(camera.quaternion)).toBeLessThan(
        1e-7,
      );
      for (let i = 0; i <= 100; i++) {
        const p = sample(i / 100).position;
        expect(Math.hypot(p.x - focus.x, p.z - focus.z)).toBeGreaterThan(9.8);
      }
      const end = sample(1),
        offset = end.position.clone().sub(focus);
      offset.y = 0;
      expect(offset.normalize().dot(front)).toBeCloseTo(1, 8);
      end.fov = 40;
      end.updateProjectionMatrix();
      end.updateMatrixWorld();
      const projected = focus.clone().project(end);
      expect(projected.x).toBeGreaterThan(0.2);
      expect(projected.x).toBeLessThan(0.6);
    });
});
