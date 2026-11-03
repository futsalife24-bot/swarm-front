import { expect, it } from "vitest";
import * as T from "three";
import { CombatEffects } from "../src/client/combat-effects";

it("銃口の絵は発射方向を向き、上限到達時に別の発射を上書きしない", () => {
  const effects = new CombatEffects(new T.Scene());
  effects.budget = 1;
  const camera = new T.PerspectiveCamera();
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  effects.event({
    id: 1,
    type: "shot",
    x: 0,
    y: 0,
    z: 0,
    tx: -10,
    ty: 0,
    tz: 0,
    weapon: "rocket",
  });
  expect(effects.items).toHaveLength(1);
  const flash = effects.items[0];
  expect(flash.kind).toBe("muzzle");
  expect(flash.shotDirection?.x).toBe(-1);
  effects.event({
    id: 2,
    type: "shot",
    x: 0,
    y: 0,
    z: 0,
    tx: 10,
    ty: 0,
    tz: 0,
    weapon: "rocket",
  });
  expect(effects.items).toHaveLength(1);
  expect(flash.shotDirection?.x).toBe(-1);
  effects.update(0.01, camera);
  const angle = new T.Vector3(1, 0, 0).applyQuaternion(flash.mesh.quaternion);
  expect(angle.x).toBeCloseTo(-1);
  effects.clear();
});
