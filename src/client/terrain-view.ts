import * as T from "three";
import type { ArenaMap } from "../shared/stages";
import { groundHeight } from "../shared/terrain";
import { ARENA_X, ARENA_Z } from "../shared/arena";
import { separateBackgroundTerrain } from "./scenery-boundary";

/** Retain the authored materials, roads and silhouette; tessellate flat floor
 * faces before lifting them so the rendered floor follows the collision field. */
export function liftMap(
  scene: T.Object3D,
  map: ArenaMap,
  smoothNormals = true,
) {
  if (map.biome === "grass" || map.biome === "snow")
    separateBackgroundTerrain(scene);
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    const old = o.geometry as T.BufferGeometry;
    const source = old.index ? old.toNonIndexed() : old;
    const p = source.getAttribute("position"),
      uv = source.getAttribute("uv"),
      normal = source.getAttribute("normal");
    const pos: number[] = [],
      tex: number[] = [],
      normals: number[] = [];
    const inverse = o.matrixWorld.clone().invert();
    const normalMatrix = new T.Matrix3().getNormalMatrix(o.matrixWorld),
      inverseNormal = normalMatrix.clone().invert();
    type V = { p: T.Vector3; u: T.Vector2; n: T.Vector3 };
    const read = (i: number): V => ({
      p: new T.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld),
      u: uv ? new T.Vector2(uv.getX(i), uv.getY(i)) : new T.Vector2(),
      n: normal
        ? new T.Vector3()
            .fromBufferAttribute(normal, i)
            .applyMatrix3(normalMatrix)
            .normalize()
        : new T.Vector3(0, 1, 0),
    });
    const emit = (a: V, b: V, c: V, depth = 0) => {
      const vertices = [a, b, c];
      const lengths = vertices.map((v, i) =>
        v.p.distanceToSquared(vertices[(i + 1) % 3].p),
      );
      const longest = Math.max(...lengths),
        edge = lengths.indexOf(longest);
      const nearArena =
        Math.min(a.p.x, b.p.x, c.p.x) < ARENA_X &&
        Math.max(a.p.x, b.p.x, c.p.x) > -ARENA_X &&
        Math.min(a.p.z, b.p.z, c.p.z) < ARENA_Z &&
        Math.max(a.p.z, b.p.z, c.p.z) > -ARENA_Z;
      const floor =
        Math.min(a.p.y, b.p.y, c.p.y) < 0.3 &&
        Math.max(a.p.y, b.p.y, c.p.y) < 0.4;
      let error = 0;
      if (nearArena && floor && longest <= 16 && longest > 0.25) {
        const h = vertices.map((v) => groundHeight(v.p.x, v.p.z, map.blocks));
        for (let i = 0; i < 3; i++) {
          const v = vertices[i].p,
            w = vertices[(i + 1) % 3].p;
          error = Math.max(
            error,
            Math.abs(
              groundHeight((v.x + w.x) / 2, (v.z + w.z) / 2, map.blocks) -
                (h[i] + h[(i + 1) % 3]) / 2,
            ),
          );
        }
        error = Math.max(
          error,
          Math.abs(
            groundHeight(
              (a.p.x + b.p.x + c.p.x) / 3,
              (a.p.z + b.p.z + c.p.z) / 3,
              map.blocks,
            ) -
              (h[0] + h[1] + h[2]) / 3,
          ),
        );
      }
      if (depth < 24 && nearArena && floor && (longest > 16 || error > 0.015)) {
        const v = vertices[edge],
          w = vertices[(edge + 1) % 3],
          other = vertices[(edge + 2) % 3];
        const mid = {
          p: v.p.clone().lerp(w.p, 0.5),
          u: v.u.clone().lerp(w.u, 0.5),
          n: v.n.clone().lerp(w.n, 0.5).normalize(),
        };
        emit(v, mid, other, depth + 1);
        emit(mid, w, other, depth + 1);
        return;
      }
      for (const v of vertices) {
        const q = v.p.clone();
        // Existing cave ceiling remains the authoritative ceiling.
        const weight = map.biome === "cave" ? Math.max(0, 1 - q.y / 3) : 1;
        q.y += groundHeight(q.x, q.z, map.blocks) * weight;
        q.applyMatrix4(inverse);
        pos.push(q.x, q.y, q.z);
        tex.push(v.u.x, v.u.y);
        const n = v.n.clone();
        if (floor && n.y > 0.8) {
          const epsilon = 0.25,
            x = v.p.x,
            z = v.p.z;
          n.set(
            groundHeight(x - epsilon, z, map.blocks) -
              groundHeight(x + epsilon, z, map.blocks),
            2 * epsilon,
            groundHeight(x, z - epsilon, map.blocks) -
              groundHeight(x, z + epsilon, map.blocks),
          );
        }
        n.applyMatrix3(inverseNormal).normalize();
        normals.push(n.x, n.y, n.z);
      }
    };
    const geometry = new T.BufferGeometry();
    for (const group of source.groups.length
      ? source.groups
      : [{ start: 0, count: p.count, materialIndex: 0 }]) {
      const start = pos.length / 3;
      for (let i = group.start; i < group.start + group.count; i += 3)
        emit(read(i), read(i + 1), read(i + 2));
      geometry.addGroup(start, pos.length / 3 - start, group.materialIndex);
    }
    geometry.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    geometry.setAttribute("uv", new T.Float32BufferAttribute(tex, 2));
    geometry.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
    if (!smoothNormals) geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    o.geometry = geometry;
    old.dispose();
    if (source !== old) source.dispose();
  });
}
