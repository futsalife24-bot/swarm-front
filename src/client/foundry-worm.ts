import { enemySize } from "../shared/enemy-size";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Enemy } from "../shared/game";
import type { WormNode } from "../shared/worm";
import {
  foundryLaserOrigin,
  foundryLaserDirection,
  FOUNDRY_LASER_WARNING,
} from "../shared/foundry-defs";
import { FoundryWormGait } from "./foundry-worm-gait";
import { windupPressure } from "./enemy-windup-clip";

export const FOUNDRY_WORM_ASSET = `${import.meta.env.BASE_URL}assets/enemies/foundry_zero_mechanical_legs_v2.glb`;

const UNIT_NAMES = [
  "FZ_HEAD",
  ...Array.from(
    { length: 7 },
    (_, i) => `FZ_BODY_${String(i + 1).padStart(2, "0")}`,
  ),
] as const;
const CONNECTOR_LENGTH = 1.11;
const CONNECTOR_ORIGIN = new T.Vector3(0, 1.65, -1.04);
const REAR_SOCKET = new T.Vector3(0, 1.65, 1.05);
const FORWARD = new T.Vector3(0, 0, -1);

type Resources = {
  geometries: Set<T.BufferGeometry>;
  materials: Set<T.Material>;
  textures: Set<T.Texture>;
};

function ownedResources(root: T.Object3D): Resources {
  const resources: Resources = {
    geometries: new Set(),
    materials: new Set(),
    textures: new Set(),
  };
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    resources.geometries.add(object.geometry);
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      resources.materials.add(material);
      for (const value of Object.values(material))
        if (value instanceof T.Texture) resources.textures.add(value);
    }
  });
  return resources;
}

function release(resources: Resources) {
  for (const geometry of resources.geometries) geometry.dispose();
  for (const material of resources.materials) material.dispose();
  for (const texture of resources.textures) texture.dispose();
}

function requiredNode(root: T.Object3D, name: string): T.Object3D {
  const matches: T.Object3D[] = [];
  root.traverse((object) => {
    if (object.name === name) matches.push(object);
  });
  if (matches.length !== 1)
    throw new Error(
      `FOUNDRY ZERO requires one ${name}; found ${matches.length}`,
    );
  return matches[0];
}

function alive(node: Readonly<WormNode>) {
  return node.partHp === undefined || node.partHp > 0;
}

type BatchPart = {
  source: T.Mesh;
  batch: T.BatchedMesh;
  instance: number;
};
type BatchState = { meshes: T.BatchedMesh[]; parts: BatchPart[] };

// BatchedMesh.addGeometry copies complete buffers, ignoring drawRange/groups.
// Extract their intersection and compact its indices before adding a material.
function geometryRange(source: T.BufferGeometry, start: number, count: number) {
  const geometry = new T.BufferGeometry();
  try {
    const position = source.getAttribute("position");
    const sourceIndex = source.getIndex();
    const vertices: number[] = [];
    const indices: number[] = [];
    const remap = new Map<number, number>();
    for (let i = start; i < start + count; i++) {
      const original = sourceIndex ? sourceIndex.getX(i) : i;
      if (
        !Number.isInteger(original) ||
        original < 0 ||
        original >= position.count
      )
        throw new Error(
          "FOUNDRY ZERO geometry contains an invalid vertex index",
        );
      let compact = remap.get(original);
      if (compact === undefined) {
        compact = vertices.length;
        vertices.push(original);
        remap.set(original, compact);
      }
      indices.push(compact);
    }
    for (const [name, attribute] of Object.entries(source.attributes)) {
      if (attribute.count !== position.count)
        throw new Error("FOUNDRY ZERO geometry attribute counts must agree");
      const values = new Float32Array(vertices.length * attribute.itemSize);
      for (let i = 0; i < vertices.length; i++)
        for (let component = 0; component < attribute.itemSize; component++)
          values[i * attribute.itemSize + component] = attribute.getComponent(
            vertices[i],
            component,
          );
      // getComponent decodes normalized and interleaved source attributes.
      geometry.setAttribute(
        name,
        new T.BufferAttribute(values, attribute.itemSize),
      );
    }
    geometry.setIndex(indices);
    return geometry;
  } catch (error) {
    geometry.dispose();
    throw error;
  }
}

function buildBatches(root: T.Group): BatchState {
  const state: BatchState = { meshes: [], parts: [] };
  const temporary: T.BufferGeometry[] = [];
  const buckets = new Map<
    string,
    {
      material: T.Material;
      entries: { source: T.Mesh; geometry: T.BufferGeometry }[];
    }
  >();
  const sources: T.Mesh[] = [];
  try {
    root.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      if (
        object instanceof T.SkinnedMesh ||
        object instanceof T.InstancedMesh ||
        Object.keys(object.geometry.morphAttributes).length
      )
        throw new Error("FOUNDRY ZERO batching requires rigid mesh geometry");
      sources.push(object);
      const source = object.geometry;
      const position = source.getAttribute("position");
      if (!position)
        throw new Error("FOUNDRY ZERO mesh has no position attribute");
      const length = source.index?.count ?? position.count;
      const groups = Array.isArray(object.material)
        ? source.groups
        : [{ start: 0, count: length, materialIndex: 0 }];
      for (const group of groups) {
        const material = Array.isArray(object.material)
          ? object.material[group.materialIndex ?? 0]
          : object.material;
        if (!material) continue;
        const start = Math.max(0, source.drawRange.start, group.start);
        const end = Math.min(
          length,
          source.drawRange.start + source.drawRange.count,
          group.start + group.count,
        );
        const count = end - start;
        if (count <= 0) continue;
        if (
          !Number.isInteger(start) ||
          !Number.isInteger(count) ||
          start % 3 ||
          count % 3
        )
          throw new Error(
            "FOUNDRY ZERO material ranges must contain complete triangles",
          );
        const geometry = geometryRange(source, start, count);
        temporary.push(geometry);
        // Different vertex layouts cannot share a BatchedMesh without losing attributes.
        const layout = Object.keys(geometry.attributes)
          .sort()
          .map((name) => `${name}:${geometry.getAttribute(name).itemSize}`)
          .join(",");
        const key = `${material.uuid}/${layout}/${object.layers.mask}/${object.renderOrder}/${object.castShadow}/${object.receiveShadow}`;
        let bucket = buckets.get(key);
        if (!bucket) {
          bucket = { material, entries: [] };
          buckets.set(key, bucket);
        }
        bucket.entries.push({ source: object, geometry });
      }
    });
    for (const { material, entries } of buckets.values()) {
      const vertices = entries.reduce(
        (total, entry) => total + entry.geometry.getAttribute("position").count,
        0,
      );
      const indices = entries.reduce(
        (total, entry) => total + entry.geometry.index!.count,
        0,
      );
      const batch = new T.BatchedMesh(
        entries.length,
        vertices,
        indices,
        material,
      );
      state.meshes.push(batch);
      batch.name = `FOUNDRY_BATCH_${material.name || state.meshes.length}`;
      const source = entries[0].source;
      batch.layers.mask = source.layers.mask;
      batch.renderOrder = source.renderOrder;
      batch.castShadow = source.castShadow;
      batch.receiveShadow = source.receiveShadow;
      for (const entry of entries) {
        const geometry = batch.addGeometry(entry.geometry);
        state.parts.push({
          source: entry.source,
          batch,
          instance: batch.addInstance(geometry),
        });
      }
    }
    // Suppress only source rendering. Their visible flags and hierarchy remain
    // authoritative for unit, connector, and individual physical-part visibility.
    for (const source of sources) source.layers.disableAll();
    root.add(...state.meshes);
    return state;
  } catch (error) {
    for (const batch of state.meshes) batch.dispose();
    throw error;
  } finally {
    // addGeometry owns copies in its combined buffer, not these temporary slices.
    for (const geometry of temporary) geometry.dispose();
  }
}

/**
 * Rigid eight-unit view. The caller supplies its URL and owns this view.
 * Every load creates a separate asset; no cache or cross-view resource sharing.
 * Meshes inside one asset may share resources, which dispose releases once.
 * Do not independently dispose, clone, or lend these resources to another view.
 *
 * This adapter does not select gameplay behavior or generate world movement.
 * Local leg IK follows measured displacement; the inspection-only
 * ArticulationPreview clip is deliberately not played here.
 * Source pieces remain independently addressable in the transform hierarchy.
 * Material batches own their copied GPU geometry and matrix textures. Draw-call
 * reduction depends on WEBGL_multi_draw; Three falls back to individual draws
 * where unavailable, so target-device performance still needs measurement.
 */
export class FoundryWormView {
  readonly root: T.Group;
  readonly units: readonly T.Object3D[];
  private readonly connectors: readonly T.Object3D[];
  private readonly resources: Resources;
  private readonly batches: BatchState;
  private readonly gait: FoundryWormGait;
  private readonly lasers: T.Object3D[];
  private readonly emitters: T.Object3D[];
  private readonly chargeTurn = new T.Quaternion();
  private readonly chargeAngles = new T.Euler();
  private readonly aims: {
    target?: { x: number; y?: number; z: number };
    until: number;
  }[];
  private readonly socket = new T.Vector3();
  private readonly direction = new T.Vector3();
  private readonly inverse = new T.Quaternion();
  private readonly rootInverse = new T.Matrix4();
  private readonly matrix = new T.Matrix4();
  private lastTime?: number;
  private disposed = false;

  static async load(url: string): Promise<FoundryWormView> {
    if (!url.trim()) throw new TypeError("FOUNDRY ZERO asset URL is required");
    const { scene } = await new GLTFLoader().loadAsync(url);
    const resources = ownedResources(scene);
    try {
      return new FoundryWormView(scene, resources);
    } catch (error) {
      release(resources);
      throw error;
    }
  }

  private constructor(root: T.Group, resources: Resources) {
    const assembly = requiredNode(root, "FOUNDRY_ZERO_ROOT");
    const units = UNIT_NAMES.map((name) => requiredNode(assembly, name));
    if (units.some((unit) => unit.parent !== assembly))
      throw new Error("FOUNDRY ZERO units must share the assembly parent");
    const connectors = units.slice(1).map((unit) => {
      const connector = requiredNode(unit, `${unit.name}_CONNECTOR`);
      if (connector.parent !== unit)
        throw new Error(`${connector.name} must be a direct unit child`);
      return connector;
    });
    this.root = root;
    this.units = Object.freeze(units);
    this.connectors = Object.freeze(connectors);
    this.resources = resources;
    this.lasers = units.map((unit, index) =>
      requiredNode(
        unit,
        index ? `${unit.name}_LASER` : "FZ_HEAD_CENTRAL_LASER",
      ),
    );
    this.aims = units.map(() => ({ until: -Infinity }));
    this.emitters = Array.from({length:6},(_,i)=>requiredNode(units[0],`FZ_HEAD_EMITTER_${String(i+1).padStart(2,'0')}`));
    this.gait = new FoundryWormGait(units);
    this.batches = buildBatches(root);
    try {
      this.syncBatches();
    } catch (error) {
      for (const batch of this.batches.meshes) batch.dispose();
      throw error;
    }
  }

  private syncBatches() {
    this.root.updateMatrixWorld(true);
    this.rootInverse.copy(this.root.matrixWorld).invert();
    for (const { source, batch, instance } of this.batches.parts) {
      let visible = true;
      for (
        let parent: T.Object3D | null = source;
        parent;
        parent = parent.parent
      ) {
        visible = visible && parent.visible;
        if (parent === this.root) break;
      }
      batch.setVisibleAt(instance, visible);
      this.matrix.multiplyMatrices(this.rootInverse, source.matrixWorld);
      batch.setMatrixAt(instance, this.matrix);
    }
    for (const batch of this.batches.meshes) batch.computeBoundingSphere();
  }

  /**
   * Read-only snapshot projection: e is slot 0; segments[0..6] are slots 1..7.
   * Broken slots stay in place. A body never becomes a replacement head.
   * Coordinates are in root-local game metres; callers may transform root for
   * an inspection scene. time is the monotonic visual clock within one run.
   */
  update(enemy: Readonly<Enemy>, time: number, ground?: (x:number,z:number)=>number): void {
    const size = enemySize(enemy);
    // Run the existing articulated solver in model metres, then scale the whole
    // assembly. This preserves planted feet, socket joints and laser direction.
    this.root.scale.setScalar(size);
    const normalize = (node: Readonly<WormNode>): WormNode => ({
      ...node, x: node.x / size, y: node.y / size, z: node.z / size,
      pulseAim: node.pulseAim ? { x: node.pulseAim.x / size,
        y: (node.pulseAim.y ?? 1.2) / size, z: node.pulseAim.z / size } : undefined,
    });
    enemy = { ...enemy, ...normalize(enemy), segments: enemy.segments?.map(normalize) };
    this.gait.ground = ground ? (x, z) => ground(x * size, z * size) / size : undefined;
    if (this.disposed) throw new Error("FOUNDRY ZERO view has been disposed");
    if (enemy.kind !== "boss" || enemy.segments?.length !== 7)
      throw new Error(
        "FOUNDRY ZERO requires one boss with seven fixed body slots",
      );
    const nodes: readonly Readonly<WormNode>[] = [enemy, ...enemy.segments];
    if (
      !Number.isFinite(time) ||
      nodes.some(
        (node) =>
          ![node.x, node.y, node.z].every(Number.isFinite) ||
          (node.heading !== undefined && !Number.isFinite(node.heading)),
      )
    )
      throw new Error("FOUNDRY ZERO snapshot coordinates must be finite");

    if (
      this.lastTime !== undefined &&
      (time < this.lastTime || time - this.lastTime > 0.3)
    ) {
      for (const aim of this.aims) {
        aim.target = undefined;
        aim.until = -Infinity;
      }
    }
    this.lastTime = time;

    this.root.visible = nodes.some(alive);
    for (const [index, node] of nodes.entries()) {
      const unit = this.units[index];
      const previous = nodes[index - 1];
      const heading =
        node.heading ??
        (previous && alive(previous)
          ? Math.atan2(previous.x - node.x, previous.z - node.z)
          : 0);
      unit.visible = alive(node);
      unit.position.set(node.x, node.y, node.z);
      unit.rotation.set(0, heading + Math.PI, 0);
      unit.scale.set(1, 1, 1);
    }

    for (let index = 1; index < this.units.length; index++) {
      const unit = this.units[index];
      const previous = this.units[index - 1];
      const connector = this.connectors[index - 1];
      connector.visible = alive(nodes[index]) && alive(nodes[index - 1]);
      connector.position.copy(CONNECTOR_ORIGIN);
      connector.quaternion.identity();
      connector.scale.set(1, 1, 1);
      if (!connector.visible) continue;

      // Convert the previous rear socket into this unit's local coordinates.
      this.socket.copy(REAR_SOCKET).applyQuaternion(previous.quaternion);
      this.socket.add(previous.position).sub(unit.position);
      this.inverse.copy(unit.quaternion).invert();
      this.socket.applyQuaternion(this.inverse);
      this.direction.copy(this.socket).sub(CONNECTOR_ORIGIN);
      const length = this.direction.length();
      if (length < 0.000001) {
        connector.visible = false;
        continue;
      }
      connector.quaternion.setFromUnitVectors(
        FORWARD,
        this.direction.multiplyScalar(1 / length),
      );
      connector.scale.z = length / CONNECTOR_LENGTH;
    }
    this.gait.update(time);
    // Fan the head's articulated launchers while its central laser builds pressure.
    const headProgress=1-((enemy.acidAt ?? time)-time)/FOUNDRY_LASER_WARNING;
    const headCharge=enemy.pulseAim && alive(enemy) ? windupPressure(headProgress) : 0;
    this.emitters.forEach((organ,i)=>organ.quaternion.setFromEuler(this.chargeAngles.set(-.32*headCharge,(i%2?1:-1)*.40*headCharge,0)));
    for (const [index, node] of nodes.entries()) {
      const aim = this.aims[index];
      if (node.pulseAim) {
        aim.target = { ...node.pulseAim };
        aim.until = time + 0.12;
      }
      const laser = this.lasers[index];
      if (!aim.target || time > aim.until || !alive(node)) {
        laser.quaternion.identity();
        continue;
      }
      const direction = foundryLaserDirection(
        foundryLaserOrigin(node, index),
        aim.target,
      );
      this.direction.set(direction.x, direction.y, direction.z);
      this.inverse.copy(this.units[index].quaternion).invert();
      this.direction.applyQuaternion(this.inverse);
      laser.quaternion.setFromUnitVectors(FORWARD, this.direction);
      const progress=1-((node.acidAt ?? time)-time)/FOUNDRY_LASER_WARNING;
      const charge=node.pulseAim ? windupPressure(progress) : 0;
      // The muzzle pivot stays fixed; the original firing direction is restored at release.
      laser.quaternion.multiply(this.chargeTurn.setFromEuler(this.chargeAngles.set(-.52*charge,0,0)));
    }
    this.syncBatches();
  }

  /** Observation sweep while planted; no gait, aim, or simulation clock is advanced. */
  inspectionIdle() {
    const organs = [...this.lasers, ...Array.from({ length: 6 }, (_, i) =>
      requiredNode(this.units[0], `FZ_HEAD_EMITTER_${String(i + 1).padStart(2, "0")}`))];
    const rotations = organs.map(organ => organ.quaternion.clone());
    const turn = new T.Quaternion(), angles = new T.Euler();
    return {
      update: (time: number) => {
        organs.forEach((laser, i) => {
          const fade = Math.min(1, time / .4), phase = time * Math.PI / 3 + i * .65;
          angles.set(Math.sin(phase * 2) * .08 * fade, Math.sin(phase) * .24 * fade, 0);
          laser.quaternion.copy(rotations[i]).multiply(turn.setFromEuler(angles));
        });
        this.syncBatches();
      },
      restore: () => {
        organs.forEach((laser, i) => laser.quaternion.copy(rotations[i]));
        this.syncBatches();
      },
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.visible = false;
    this.root.removeFromParent();
    for (const batch of this.batches.meshes) batch.dispose();
    release(this.resources);
    this.root.clear();
  }
}
