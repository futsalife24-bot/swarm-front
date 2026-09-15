import * as T from "three";
import { ARENA_X, ARENA_Z } from "../shared/arena";

/** Move whole background mountains beyond the playable rectangle. Material
 * batches may split a snowy summit from its rock base, so weld across meshes. */
export function separateBackgroundTerrain(scene: T.Object3D) {
  scene.updateMatrixWorld(true);
  const parent: number[] = [],
    points: T.Vector3[] = [];
  const ids = new Map<string, number>();
  const meshes: { mesh: T.Mesh; vertices: number[] }[] = [];
  const root = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  scene.traverse((o) => {
    if (
      !(o instanceof T.Mesh) ||
      !/^(meadow_ground|granular_snow|weathered_granite)$/.test(o.name)
    )
      return;
    const p = o.geometry.getAttribute("position"),
      vertices: number[] = [];
    for (let i = 0; i < p.count; i++) {
      const v = new T.Vector3()
        .fromBufferAttribute(p, i)
        .applyMatrix4(o.matrixWorld);
      const key = [v.x, v.y, v.z].map((n) => n.toFixed(3)).join(",");
      let id = ids.get(key);
      if (id === undefined) {
        id = parent.length;
        parent.push(id);
        points.push(v);
        ids.set(key, id);
      }
      vertices.push(id);
    }
    const index = o.geometry.index;
    for (let i = 0; i < (index?.count ?? p.count); i += 3) {
      const a = vertices[index ? index.getX(i) : i];
      for (let j = 1; j < 3; j++)
        parent[root(vertices[index ? index.getX(i + j) : i + j])] = root(a);
    }
    meshes.push({ mesh: o, vertices });
  });
  const bounds = new Map<number, T.Box3>();
  points.forEach((v, i) => {
    const id = root(i);
    if (!bounds.has(id)) bounds.set(id, new T.Box3());
    bounds.get(id)!.expandByPoint(v);
  });
  const offsets = new Map<number, T.Vector3>();
  const report: { before: number[]; offset: number[] }[] = [];
  for (const [id, b] of bounds) {
    const c = b.getCenter(new T.Vector3());
    if (
      b.max.y - b.min.y < 3 ||
      (Math.abs(c.x) <= ARENA_X && Math.abs(c.z) <= ARENA_Z)
    )
      continue;
    if (
      b.min.x >= ARENA_X + 2 ||
      b.max.x <= -ARENA_X - 2 ||
      b.min.z >= ARENA_Z + 2 ||
      b.max.z <= -ARENA_Z - 2
    )
      continue;
    const dx = c.x > 0 ? ARENA_X + 2 - b.min.x : -ARENA_X - 2 - b.max.x;
    const dz = c.z > 0 ? ARENA_Z + 2 - b.min.z : -ARENA_Z - 2 - b.max.z;
    const offset =
      Math.abs(dx) < Math.abs(dz)
        ? new T.Vector3(dx, 0, 0)
        : new T.Vector3(0, 0, dz);
    offsets.set(id, offset);
    report.push({
      before: [...b.min.toArray(), ...b.max.toArray()],
      offset: offset.toArray(),
    });
  }
  for (const { mesh, vertices } of meshes) {
    const p = mesh.geometry.getAttribute("position"),
      inverse = mesh.matrixWorld.clone().invert();
    vertices.forEach((id, i) => {
      const offset = offsets.get(root(id));
      if (offset) {
        const v = points[id].clone().add(offset).applyMatrix4(inverse);
        p.setXYZ(i, v.x, v.y, v.z);
      }
    });
    p.needsUpdate = true;
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
  }
  scene.userData.backgroundTerrain = report;
}
