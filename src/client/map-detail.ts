import * as T from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

type TileLevel = {
  instance: number;
  high: number;
  low: number;
  center: T.Vector3;
  detailed: boolean;
};
class DetailBatch extends T.BatchedMesh {
  readonly tiles: TileLevel[] = [];
  private point = new T.Vector3();
  private eye = new T.Vector3();
  override onBeforeRender(
    renderer: T.WebGLRenderer,
    scene: T.Scene,
    camera: T.Camera,
    geometry: T.BufferGeometry,
    material: T.Material,
    group: T.Group,
  ) {
    if (camera instanceof T.PerspectiveCamera) {
      this.eye.setFromMatrixPosition(camera.matrixWorld);
      for (const tile of this.tiles) {
        const distance =
          this.point
            .copy(tile.center)
            .applyMatrix4(this.matrixWorld)
            .distanceTo(this.eye) / camera.zoom;
        const detailed = distance < (tile.detailed ? 65 : 55);
        if (detailed !== tile.detailed) {
          this.setGeometryIdAt(tile.instance, detailed ? tile.high : tile.low);
          tile.detailed = detailed;
        }
      }
    }
    super.onBeforeRender(renderer, scene, camera, geometry, material, group);
  }
}

/** Midpoint subdivision: every triangle becomes four, with shared edge vertices.
 * Interpolated normals/UVs keep both LODs identical in silhouette and lighting. */
export function subdivideMapGeometry(low: T.BufferGeometry) {
  const p = low.getAttribute("position"),
    n = low.getAttribute("normal"),
    uv = low.getAttribute("uv"),
    ids = low.index!;
  const positions = Array.from(p.array),
    normals = Array.from(n.array),
    tex = Array.from(uv.array),
    indices: number[] = [],
    edges = new Map<string, number>();
  const mid = (a: number, b: number) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const cached = edges.get(key);
    if (cached !== undefined) return cached;
    const id = positions.length / 3;
    for (let k = 0; k < 3; k++) {
      positions.push((positions[a * 3 + k] + positions[b * 3 + k]) / 2);
      normals.push((normals[a * 3 + k] + normals[b * 3 + k]) / 2);
    }
    for (let k = 0; k < 2; k++) tex.push((tex[a * 2 + k] + tex[b * 2 + k]) / 2);
    edges.set(key, id);
    return id;
  };
  for (let i = 0; i < ids.count; i += 3) {
    const a = ids.getX(i),
      b = ids.getX(i + 1),
      c = ids.getX(i + 2),
      ab = mid(a, b),
      bc = mid(b, c),
      ca = mid(c, a);
    indices.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
  }
  const high = new T.BufferGeometry();
  high.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  high.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  high.setAttribute("uv", new T.Float32BufferAttribute(tex, 2));
  high.setIndex(indices);
  high.computeBoundingSphere();
  return high;
}

/** Spatial LOD also lets frustum culling skip whole blocks behind the camera.
 * Run once after terrain deformation; distant scenery is intentionally separate. */
export function addMapDetail(scene: T.Object3D, detailed = true) {
  const meshes: T.Mesh[] = [];
  scene.traverse((o) => {
    if (o instanceof T.Mesh) meshes.push(o);
  });
  for (const mesh of meshes) {
    const source = mesh.geometry.index
      ? mesh.geometry.toNonIndexed()
      : mesh.geometry;
    const p = source.getAttribute("position"),
      n = source.getAttribute("normal"),
      uv = source.getAttribute("uv");
    const tiles = new Map<
      string,
      { p: number[]; n: number[]; uv: number[]; material: number }
    >();
    for (const group of source.groups.length
      ? source.groups
      : [{ start: 0, count: p.count, materialIndex: 0 }]) {
      for (let i = group.start; i < group.start + group.count; i += 3) {
        const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3,
          z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
        const key = `${Math.floor(x / 40)}:${Math.floor(z / 40)}:${group.materialIndex}`;
        let tile = tiles.get(key);
        if (!tile) {
          tile = { p: [], n: [], uv: [], material: group.materialIndex ?? 0 };
          tiles.set(key, tile);
        }
        for (let j = i; j < i + 3; j++) {
          tile.p.push(p.getX(j), p.getY(j), p.getZ(j));
          tile.n.push(n.getX(j), n.getY(j), n.getZ(j));
          tile.uv.push(uv.getX(j), uv.getY(j));
        }
      }
    }
    const container = new T.Group();
    container.name = `${mesh.name}_DETAIL`;
    container.position.copy(mesh.position);
    container.quaternion.copy(mesh.quaternion);
    container.scale.copy(mesh.scale);
    const ready: {
      low: T.BufferGeometry;
      high: T.BufferGeometry;
      center: T.Vector3;
      material: number;
    }[] = [];
    for (const tile of tiles.values()) {
      const raw = new T.BufferGeometry();
      raw.setAttribute("position", new T.Float32BufferAttribute(tile.p, 3));
      raw.setAttribute("normal", new T.Float32BufferAttribute(tile.n, 3));
      raw.setAttribute("uv", new T.Float32BufferAttribute(tile.uv, 2));
      const low = mergeVertices(raw, 0.00001);
      raw.dispose();
      low.computeBoundingBox();
      const center = low.boundingBox!.getCenter(new T.Vector3());
      low.translate(-center.x, -center.y, -center.z);
      low.computeBoundingSphere();
      ready.push({
        low,
        high: detailed ? subdivideMapGeometry(low) : low,
        center,
        material: tile.material,
      });
    }
    for (const materialIndex of new Set(ready.map((t) => t.material))) {
      const parts = ready.filter((t) => t.material === materialIndex);
      const vertices = parts.reduce(
        (sum, t) =>
          sum +
          t.low.getAttribute("position").count +
          (detailed ? t.high.getAttribute("position").count : 0),
        0,
      );
      const lowIndices = parts.reduce((sum, t) => sum + t.low.index!.count, 0),
        indices = lowIndices * (detailed ? 5 : 1);
      const material = Array.isArray(mesh.material)
        ? mesh.material[materialIndex]
        : mesh.material;
      const batch = new DetailBatch(parts.length, vertices, indices, material);
      batch.name = mesh.name;
      batch.userData.mapDetail = {
        detailed,
        lowTriangles: lowIndices / 3,
        highTriangles: (lowIndices / 3) * (detailed ? 4 : 1),
        tiles: parts.length,
      };
      const matrix = new T.Matrix4();
      for (const part of parts) {
        const low = batch.addGeometry(part.low),
          high = detailed ? batch.addGeometry(part.high) : low,
          instance = batch.addInstance(high);
        batch.setMatrixAt(
          instance,
          matrix.makeTranslation(part.center.x, part.center.y, part.center.z),
        );
        if (detailed)
          batch.tiles.push({
            low,
            high,
            instance,
            center: part.center,
            detailed: true,
          });
        part.low.dispose();
        if (detailed) part.high.dispose();
      }
      batch.computeBoundingSphere();
      container.add(batch);
    }
    mesh.parent!.add(container);
    mesh.removeFromParent();
    if (source !== mesh.geometry) source.dispose();
    mesh.geometry.dispose();
  }
}

export { weatherMapMaterials } from "./map-surfaces";
