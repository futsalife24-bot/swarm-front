import { expect, it } from "vitest";
import * as T from "three";
import { syncDynamicInstances } from "../src/client/render";

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
