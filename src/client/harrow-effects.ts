import * as T from "three";
import { move, type World } from "../shared/game";
import {
  HARROW,
  harrowDiveClawCircles,
  harrowMissilePosition,
} from "../shared/harrow";
import { mapFor } from "../shared/stages";
import { supportHeight } from "../shared/terrain";
import type { Block } from "../shared/defs";
import { TerrainProjectedMarkers } from "./terrain-projected-marker";
import { HarrowSpinEffects } from "./harrow-spin-effects";
import {
  redWarningAfterStart,
  redWarningBeforeLaunch,
} from "./attack-telegraph";

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
  private readonly clawFillMaterial = new T.MeshBasicMaterial({
    color: 0xff283b,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    side: T.DoubleSide,
  });
  private readonly dashFillMaterial = new T.MeshBasicMaterial({
    color: 0xff4054,
    transparent: true,
    opacity: 0.24,
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
  private readonly clawFills = new TerrainProjectedMarkers(
    this.clawFillMaterial,
    30,
    1024,
  );
  private readonly dashFills = new TerrainProjectedMarkers(
    this.dashFillMaterial,
    13,
    1024,
  );
  private readonly clawOutlineGeometry = new T.BufferGeometry();
  private readonly clawOutlineMaterial = new T.LineBasicMaterial({
    color: 0xff5060,
    depthWrite: false,
  });
  private readonly clawOutlines = new T.LineSegments(
    this.clawOutlineGeometry,
    this.clawOutlineMaterial,
  );
  private readonly matrix = new T.Matrix4();
  private readonly rotation = new T.Quaternion();
  private readonly position = new T.Vector3();
  private readonly direction = new T.Vector3();
  private readonly up = new T.Vector3(0, 1, 0);
  private readonly unit = new T.Vector3(1, 1, 1);
  private readonly spin = new HarrowSpinEffects();
  constructor() {
    this.clawOutlineGeometry.setAttribute(
      "position",
      new T.BufferAttribute(new Float32Array(6 * 10 * 2 * 3), 3).setUsage(
        T.DynamicDrawUsage,
      ),
    );
    this.clawOutlineGeometry.setDrawRange(0, 0);
    this.clawOutlines.frustumCulled = false;
    for (const mesh of [
      this.markers,
      this.bodies,
      this.tails,
      this.warnings,
      this.clawFills,
      this.dashFills,
    ]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      if (mesh instanceof T.InstancedMesh)
        mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    }
    this.root.add(
      this.markers,
      this.bodies,
      this.tails,
      this.warnings,
      this.clawFills,
      this.clawOutlines,
      this.dashFills,
    );
    this.root.add(this.spin.root);
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
      warnings = 0,
      claws = 0,
      dashDiscs = 0;
    const blocks =
      w && (w.stage !== undefined || w.training || w.campaignPlan || w.defense)
        ? mapFor(w).blocks
        : undefined;
    this.spin.update(w?.time ?? 0, w?.enemies ?? [], blocks);
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
        const age = w.time - attack.started;
        const spin =
          attack.kind === "Spin" && redWarningAfterStart(age, HARROW.spinWind);
        const dive =
          ((attack.kind === "Glide" && age >= 0.4) || attack.kind === "Dive") &&
          attack.to;
        const dash =
          attack.kind === "Dash" && redWarningAfterStart(age, HARROW.dashWind);
        if (!spin && !dive && !dash) continue;
        if (dash) {
          const from = attack.from ?? enemy;
          const position = { x: from.x, y: from.y, z: from.z };
          const interval = HARROW.dashDistance / 60;
          for (let step = 0; step <= 60; step++) {
            if (step > 0)
              move(
                position,
                Math.sin(attack.yaw) * interval,
                Math.cos(attack.yaw) * interval,
                3.4 * HARROW.scale,
                blocks,
              );
            if (step % 5 !== 0 || dashDiscs >= this.dashFills.capacity)
              continue;
            this.dashFills.setDisc(
              dashDiscs++,
              position,
              HARROW.dashRadius,
              blocks,
            );
          }
          continue;
        }
        if (dive) {
          if (claws >= this.clawFills.capacity) continue;
          const circles = harrowDiveClawCircles(dive, attack.yaw);
          for (const circle of circles) {
            if (claws >= this.clawFills.capacity) break;
            this.clawFills.setDisc(claws++, circle, circle.radius, blocks);
          }
          this.setClawOutline(circles, blocks);
          continue;
        }
        const point = dive || enemy;
        const radius = spin ? HARROW.spinRadius : HARROW.diveRadius;
        this.warnings.setRing(warnings++, point, radius, blocks);
      }
    if (w)
      for (const missile of w.harrowMissiles ?? []) {
        if (w.time >= missile.impact || bodies >= this.capacity) continue;
        const wind =
          missile.trajectory !== "straight"
            ? HARROW.threatWind
            : missile.radius === HARROW.snipeRadius
              ? HARROW.snipeWind
              : HARROW.bombWind;
        if (
          markers < this.capacity &&
          redWarningBeforeLaunch(w.time, missile.launch, wind)
        )
          this.markers.setRing(
            markers++,
            missile.target,
            missile.radius,
            blocks,
          );
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
    this.clawFills.setCount(claws);
    this.dashFills.setCount(dashDiscs);
    if (!claws) this.clawOutlineGeometry.setDrawRange(0, 0);
    for (const mesh of [this.bodies, this.tails])
      mesh.instanceMatrix.needsUpdate = true;
  }
  private setClawOutline(
    circles: ReturnType<typeof harrowDiveClawCircles>,
    blocks?: Block[],
  ) {
    const position = this.clawOutlineGeometry.getAttribute(
      "position",
    ) as T.BufferAttribute;
    let vertex = 0;
    for (let claw = 0; claw < 6; claw++) {
      const centers = circles.slice(claw * 5, claw * 5 + 5);
      const left: Array<{ x: number; y: number; z: number }> = [];
      const right: typeof left = [];
      for (let i = 0; i < centers.length; i++) {
        const center = centers[i],
          before = centers[Math.max(0, i - 1)],
          after = centers[Math.min(centers.length - 1, i + 1)];
        const length = Math.hypot(after.x - before.x, after.z - before.z) || 1,
          nx = -(after.z - before.z) / length,
          nz = (after.x - before.x) / length;
        left.push({
          x: center.x + nx * center.radius,
          y: center.y,
          z: center.z + nz * center.radius,
        });
        right.push({
          x: center.x - nx * center.radius,
          y: center.y,
          z: center.z - nz * center.radius,
        });
      }
      const boundary = [...left, ...right.reverse()];
      for (let i = 0; i < boundary.length; i++) {
        for (const point of [
          boundary[i],
          boundary[(i + 1) % boundary.length],
        ]) {
          position.setXYZ(
            vertex++,
            point.x,
            (blocks
              ? supportHeight(point.x, point.z, blocks, point.y)
              : point.y) + 0.15,
            point.z,
          );
        }
      }
    }
    this.clawOutlineGeometry.setDrawRange(0, vertex);
    position.addUpdateRange(0, vertex * 3);
    position.needsUpdate = true;
  }
  dispose() {
    this.spin.dispose();
    for (const mesh of [
      this.markers,
      this.bodies,
      this.tails,
      this.warnings,
      this.clawFills,
      this.dashFills,
    ])
      mesh.dispose();
    this.clawOutlineGeometry.dispose();
    this.clawOutlineMaterial.dispose();
    for (const geometry of [this.bodyGeometry, this.tailGeometry])
      geometry.dispose();
    for (const material of [
      this.markerMaterial,
      this.clawFillMaterial,
      this.dashFillMaterial,
      this.bodyMaterial,
      this.tailMaterial,
    ])
      material.dispose();
    this.root.removeFromParent();
  }
}
