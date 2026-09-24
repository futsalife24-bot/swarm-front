import * as T from "three";
import type { World } from "../shared/game";
import { HARROW, harrowMissilePosition } from "../shared/harrow";
import { mapFor } from "../shared/stages";
import { TerrainProjectedMarkers } from "./terrain-projected-marker";

/** Shared combat/report view; authoritative missiles remain read-only. */
export class HarrowEffects {
  readonly root = new T.Group();
  private readonly capacity = 40;
  private readonly bodyGeometry = new T.ConeGeometry(0.11, 0.65, 6);
  private readonly tailGeometry = new T.ConeGeometry(0.1, 0.65, 5)
    .rotateZ(Math.PI)
    .translate(0, -0.58, 0);
  private readonly markerMaterial = new T.MeshBasicMaterial({
    color: 0xff283b,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: T.DoubleSide,
  });
  private readonly bodyMaterial = new T.MeshBasicMaterial({ color: 0xffa552 });
  private readonly tailMaterial = new T.MeshBasicMaterial({
    color: 0xff3b19,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  private readonly markers = new TerrainProjectedMarkers(
    this.markerMaterial,
    this.capacity,
  );
  private readonly bodies = new T.InstancedMesh(
    this.bodyGeometry,
    this.bodyMaterial,
    this.capacity,
  );
  private readonly tails = new T.InstancedMesh(
    this.tailGeometry,
    this.tailMaterial,
    this.capacity,
  );
  private readonly warnings = new TerrainProjectedMarkers(
    this.markerMaterial,
    this.capacity,
  );
  private readonly matrix = new T.Matrix4();
  private readonly rotation = new T.Quaternion();
  private readonly position = new T.Vector3();
  private readonly direction = new T.Vector3();
  private readonly up = new T.Vector3(0, 1, 0);
  private readonly unit = new T.Vector3(1, 1, 1);
  constructor() {
    for (const mesh of [this.markers, this.bodies, this.tails, this.warnings]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      if (mesh instanceof T.InstancedMesh)
        mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    }
    this.root.add(this.markers, this.bodies, this.tails, this.warnings);
  }
  update(
    w:
      | (Pick<World, "time" | "harrowMissiles"> &
          Partial<
            Pick<
              World,
              "enemies" | "stage" | "campaignPlan" | "training" | "defense"
            >
          >)
      | null,
  ) {
    let markers = 0,
      bodies = 0,
      warnings = 0;
    const blocks =
      w && (w.stage !== undefined || w.training || w.campaignPlan || w.defense)
        ? mapFor(w).blocks
        : undefined;
    if (w)
      for (const enemy of w.enemies ?? []) {
        const attack = enemy.harrow;
        if (
          enemy.kind !== "harrow" ||
          enemy.hp <= 0 ||
          !attack ||
          warnings >= this.capacity
        )
          continue;
        const spin =
          attack.kind === "Spin" && w.time - attack.started < HARROW.spinWind;
        const dive =
          (attack.kind === "Glide" || attack.kind === "Dive") && attack.to;
        if (!spin && !dive) continue;
        const point = dive || enemy;
        const radius = spin ? HARROW.spinRadius : HARROW.diveRadius;
        this.warnings.setRing(warnings++, point, radius, blocks);
      }
    if (w)
      for (const missile of w.harrowMissiles ?? []) {
        if (w.time >= missile.impact || markers >= this.capacity) continue;
        this.markers.setRing(markers++, missile.target, missile.radius, blocks);
        if (w.time < missile.launch) continue;
        const p = harrowMissilePosition(missile, w.time);
        const next = harrowMissilePosition(
          missile,
          Math.min(missile.impact, w.time + 0.01),
        );
        this.position.set(p.x, p.y, p.z);
        this.direction
          .set(next.x - p.x, next.y - p.y, next.z - p.z)
          .normalize();
        if (this.direction.lengthSq() < 1e-8) this.direction.copy(this.up);
        this.rotation.setFromUnitVectors(this.up, this.direction);
        this.matrix.compose(this.position, this.rotation, this.unit);
        this.bodies.setMatrixAt(bodies, this.matrix);
        this.tails.setMatrixAt(bodies++, this.matrix);
      }
    this.markers.setCount(markers);
    this.bodies.count = this.tails.count = bodies;
    this.warnings.setCount(warnings);
    for (const mesh of [this.bodies, this.tails])
      mesh.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    for (const mesh of [this.markers, this.bodies, this.tails, this.warnings])
      mesh.dispose();
    for (const geometry of [this.bodyGeometry, this.tailGeometry])
      geometry.dispose();
    for (const material of [
      this.markerMaterial,
      this.bodyMaterial,
      this.tailMaterial,
    ])
      material.dispose();
    this.root.removeFromParent();
  }
}
