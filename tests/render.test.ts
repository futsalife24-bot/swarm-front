import { expect, it } from "vitest";
import * as T from "three";
import {
  syncDynamicInstances,
  soldier,
  poseSoldier,
} from "../src/client/render";
import { EVADE_DURATION } from "../src/shared/defs";
import type { Player } from "../src/shared/game";
import { CombatEffects } from "../src/client/combat-effects";

it("uses a short moving bullet, bounds the blast ring and releases finished effects", () => {
  const scene = new T.Scene();
  const fx = new CombatEffects(scene);
  fx.event({
    id: 1,
    type: "shot",
    weapon: "rifle",
    x: 0,
    y: 1.5,
    z: 0,
    tx: 0,
    ty: 1.5,
    tz: -30,
  });
  const bullet = fx.items.find((e) => e.kind === "bullet")!;
  bullet.mesh.geometry.computeBoundingBox();
  expect(
    bullet.mesh.geometry.boundingBox!.getSize(new T.Vector3()).y,
  ).toBeLessThan(1);
  fx.update(0.05);
  expect(bullet.mesh.position.z).toBeCloseTo(-7.5);
  fx.event({ id: 2, type: "burst", x: 0, y: 0, z: 0, radius: 3.5 });
  fx.update(0.25);
  expect(fx.items.find((e) => e.kind === "ring")!.mesh.scale.x).toBe(3.5);
  fx.update(2);
  expect(fx.items).toHaveLength(0);
  expect(scene.children).toHaveLength(0);
});

it("rolls along displacement and restores the pose after evade or down", () => {
  const model = soldier(0xcaa25f);
  const p = { x: 0, z: 0, hp: 160, evade: 0 } as Player;
  poseSoldier(model, p, 0, 0, "run");
  p.x = 0.8;
  p.evade = EVADE_DURATION;
  poseSoldier(model, p, 0, 0, "run");
  p.evade = EVADE_DURATION * 0.75;
  poseSoldier(model, p, 0, 0, "run");
  model.updateMatrixWorld(true);
  const up = new T.Vector3(0, 1, 0).transformDirection(
    model.userData.pivot.matrixWorld,
  );
  expect(up.x).toBeCloseTo(1);
  // Turning the camera during a roll does not change its world rotation axis.
  poseSoldier(model, p, Math.PI / 2, 0, "run");
  model.updateMatrixWorld(true);
  expect(
    new T.Vector3(0, 1, 0).transformDirection(model.userData.pivot.matrixWorld)
      .x,
  ).toBeCloseTo(1);
  p.hp = 0;
  poseSoldier(model, p, 0, 0, "run");
  expect(
    model.userData.pivot.quaternion.angleTo(new T.Quaternion()),
  ).toBeCloseTo(0);
  expect(model.userData.legs[0].rotation.x).toBeCloseTo(0);
  p.hp = 160;
  p.evade = 0;
  poseSoldier(model, p, 0, 0, "run");
  expect(model.rotation.x).toBe(0);
  expect(model.userData.gun.position.z).toBe(-0.6);
});

it("keeps a stationary roll finite and resets direction for a new mission", () => {
  const model = soldier(0xcaa25f);
  const p = { x: 0, z: 0, hp: 160, evade: EVADE_DURATION } as Player;
  poseSoldier(model, p, 0, 0, "first");
  p.evade /= 2;
  poseSoldier(model, p, 0, 0, "first");
  expect(model.userData.pivot.quaternion.x).toBeCloseTo(-1);
  p.x = 100;
  p.evade = EVADE_DURATION;
  poseSoldier(model, p, Math.PI / 2, 0, "second");
  expect(model.userData.axis.z).toBeCloseTo(-1);
});

it("animates between snapshots and freezes when simulation is paused", () => {
  const model = soldier(0xcaa25f);
  const p = { x: 0, z: 0, hp: 160, evade: EVADE_DURATION } as Player;
  poseSoldier(model, p, 0, 0, "run");
  poseSoldier(model, p, 0, 0, "run", 0.016);
  const pose = model.userData.pivot.quaternion.clone();
  expect(pose.angleTo(new T.Quaternion())).toBeGreaterThan(0);
  poseSoldier(model, p, 0, 0, "run", 0);
  expect(model.userData.pivot.quaternion.angleTo(pose)).toBeCloseTo(0);
});

it("refreshes a moved dynamic instance bound used by frustum culling", () => {
  const mesh = new T.InstancedMesh(
    new T.BoxGeometry(1, 1, 1),
    new T.MeshBasicMaterial(),
    1,
  );
  mesh.count = 0;
  mesh.computeBoundingSphere();
  expect(mesh.boundingSphere?.isEmpty()).toBe(true);

  mesh.setMatrixAt(0, new T.Matrix4().makeTranslation(40, 0, 0));
  mesh.count = 1;
  syncDynamicInstances(mesh);

  expect(mesh.boundingSphere?.containsPoint(new T.Vector3(40, 0, 0))).toBe(
    true,
  );
  const camera = new T.PerspectiveCamera(65, 1, 0.1, 100);
  camera.lookAt(40, 0, 0);
  camera.updateMatrixWorld();
  const frustum = new T.Frustum().setFromProjectionMatrix(
    new T.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
  );
  expect(frustum.intersectsObject(mesh)).toBe(true);
});
