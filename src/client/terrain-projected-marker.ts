import * as T from "three";
import type { Block } from "../shared/defs";
import { supportHeight } from "../shared/terrain";

/** One draw call for a bounded pool of rings, with no per-frame geometry allocation. */
export class TerrainProjectedMarkers extends T.Mesh<
  T.BufferGeometry,
  T.MeshBasicMaterial
> {
  static readonly segments = 512;
  private readonly verticesPerRing = (TerrainProjectedMarkers.segments + 1) * 2;
  private readonly indicesPerRing = TerrainProjectedMarkers.segments * 6;
  private readonly cache: Array<{
    x: number;
    y: number;
    z: number;
    radius: number;
    blocks?: Block[];
  }> = [];
  constructor(
    material: T.MeshBasicMaterial,
    readonly capacity: number,
  ) {
    const geometry = new T.BufferGeometry();
    const segments = TerrainProjectedMarkers.segments;
    const positions = new Float32Array(capacity * (segments + 1) * 2 * 3);
    const indices = new Uint32Array(capacity * segments * 6);
    for (let ring = 0; ring < capacity; ring++)
      for (let segment = 0; segment < segments; segment++) {
        const a = ring * (segments + 1) * 2 + segment * 2;
        indices.set(
          [a, a + 2, a + 1, a + 1, a + 2, a + 3],
          (ring * segments + segment) * 6,
        );
      }
    geometry.setAttribute(
      "position",
      new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage),
    );
    geometry.setIndex(new T.BufferAttribute(indices, 1));
    geometry.setDrawRange(0, 0);
    super(geometry, material);
    this.count = 0;
    this.frustumCulled = false;
  }
  setCount(value: number) {
    this.count = Math.min(this.capacity, Math.max(0, value));
    this.geometry.setDrawRange(0, this.count * this.indicesPerRing);
  }
  setRing(
    index: number,
    point: { x: number; y: number; z: number },
    radius: number,
    blocks?: Block[],
  ) {
    if (index >= this.capacity) return;
    const old = this.cache[index];
    if (
      old &&
      old.x === point.x &&
      old.y === point.y &&
      old.z === point.z &&
      old.radius === radius &&
      old.blocks === blocks
    )
      return;
    this.cache[index] = { ...point, radius, blocks };
    const position = this.geometry.getAttribute(
      "position",
    ) as T.BufferAttribute;
    for (
      let segment = 0;
      segment <= TerrainProjectedMarkers.segments;
      segment++
    ) {
      // Reuse angle zero for the seam so its two ends are exactly coincident.
      const angle =
        ((segment % TerrainProjectedMarkers.segments) /
          TerrainProjectedMarkers.segments) *
        Math.PI *
        2;
      for (let edge = 0; edge < 2; edge++) {
        const r = radius * (edge ? 1.055 : 0.945);
        const x = point.x + Math.cos(angle) * r;
        const z = point.z + Math.sin(angle) * r;
        const y = blocks ? supportHeight(x, z, blocks, point.y) : point.y;
        position.setXYZ(
          index * this.verticesPerRing + segment * 2 + edge,
          x,
          y + 0.12,
          z,
        );
      }
    }
    position.needsUpdate = true;
  }
  dispose() {
    this.geometry.dispose();
  }
}
