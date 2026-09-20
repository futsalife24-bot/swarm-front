import * as T from "three";
import type { World } from "../shared/game";
import { CALYX, pollenContains, pollenRadius } from "../shared/calyx";
import { mapFor } from "../shared/stages";
import { groundHeight, supportHeight } from "../shared/terrain";

/** Bounded instances; wall clipping is cached per stationary cloud, not raycast every frame. */
export class CalyxEffects {
  readonly root = new T.Group();
  private mistPositions = new Float32Array(6000 * 3);
  private mist = new T.Points(
    new T.BufferGeometry().setAttribute(
      "position",
      new T.BufferAttribute(this.mistPositions, 3).setUsage(T.DynamicDrawUsage),
    ),
    new T.PointsMaterial({
      color: 0xcbb957,
      size: 1.9,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    }),
  );
  private mistCount = 0;
  private marks = new T.InstancedMesh(
    new T.CircleGeometry(1, 8),
    new T.MeshBasicMaterial({
      color: 0xcbb957,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: T.DoubleSide,
    }),
    6000,
  );
  // Attack warnings have their own budget: persistent clouds must never crowd them out.
  private warnings = new T.InstancedMesh(
    this.marks.geometry,
    this.marks.material,
    12000, // Solo permits 120 actors; each full Slam warning uses 96 instances.
  );
  private cells = new Map<
    number,
    { x: number; y: number; z: number; distance: number }[]
  >();
  private dummy = new T.Object3D();
  private run = "";
  constructor() {
    this.mist.material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        "#include <color_fragment>\nfloat d=length(gl_PointCoord-vec2(0.5))*2.0; diffuseColor.a*=pow(max(0.0,1.0-d*d),2.0);",
      );
    };
    this.root.name = "CALYX_POLLEN";
    this.root.add(this.mist, this.marks, this.warnings);
    this.mist.frustumCulled =
      this.marks.frustumCulled =
      this.warnings.frustumCulled =
        false;
  }
  update(w?: World | null) {
    this.mistCount = this.marks.count = this.warnings.count = 0;
    this.mist.geometry.setDrawRange(0, 0);
    if (!w || w.phase !== "battle") {
      this.cells.clear();
      return;
    }
    if (this.run !== w.run) {
      this.cells.clear();
      this.run = w.run;
    }
    const blocks = mapFor(w).blocks,
      active = new Set<number>();
    let markBatch = this.marks;
    const mark = (x: number, y: number, z: number, size: number) => {
      if (markBatch.count >= markBatch.instanceMatrix.count) return;
      this.dummy.position.set(x, y + 0.035, z);
      this.dummy.rotation.set(-Math.PI / 2, 0, 0);
      this.dummy.scale.setScalar(size);
      this.dummy.updateMatrix();
      markBatch.setMatrixAt(markBatch.count++, this.dummy.matrix);
    };
    for (const c of w.pollen ?? []) {
      active.add(c.id);
      let cells = this.cells.get(c.id);
      if (!cells) {
        cells = [];
        for (let x = -9; x <= 9; x += 1.2)
          for (let z = -9; z <= 9; z += 1.2) {
            const p = {
              x: c.x + x,
              z: c.z + z,
              y: supportHeight(c.x + x, c.z + z, blocks, c.y),
            };
            if (pollenContains(c, p, c.born + 1, blocks))
              cells.push({ ...p, distance: Math.hypot(x, z) });
          }
        this.cells.set(c.id, cells);
      }
      const radius = pollenRadius(c, w.time);
      for (const p of cells) {
        if (p.distance > radius || this.mistCount >= 6000) continue;
        mark(p.x, p.y, p.z, 0.58);
        this.mistPositions.set(
          [
            p.x + 0.15 * Math.sin(p.z * 9),
            p.y + 0.65 + 0.16 * Math.sin(w.time * 2 + p.x),
            p.z + 0.15 * Math.cos(p.x * 9),
          ],
          this.mistCount++ * 3,
        );
      }
    }
    for (const id of this.cells.keys())
      if (!active.has(id)) this.cells.delete(id);
    markBatch = this.warnings;
    for (const e of w.enemies) {
      const a = e.calyx;
      if (!a) continue;
      if (a.fired) {
        const age = w.time - a.started - CALYX.slamWind;
        if (a.kind === "Slam" && age >= 0 && age < 0.3) {
          const r = CALYX.slamRange * Math.min(1, age / 0.18);
          for (let angle = -Math.PI / 3; angle <= Math.PI / 3; angle += 0.12) {
            const x = e.x + Math.sin(a.yaw + angle) * r,
              z = e.z + Math.cos(a.yaw + angle) * r;
            mark(x, groundHeight(x, z, blocks), z, 0.3);
          }
        }
        continue;
      }
      if (a.kind === "PollenShot") {
        const r = 0.6 + 0.1 * Math.sin(w.time * 8);
        mark(e.tx, e.ty ?? 0, e.tz, r);
      } else {
        for (let r = 0.5; r <= CALYX.slamRange; r += 0.5)
          for (let angle = -Math.PI / 3; angle <= Math.PI / 3; angle += 0.18) {
            const x = e.x + Math.sin(a.yaw + angle) * r,
              z = e.z + Math.cos(a.yaw + angle) * r;
            mark(x, groundHeight(x, z, blocks), z, 0.15);
          }
      }
    }
    this.mist.geometry.setDrawRange(0, this.mistCount);
    this.mist.geometry.attributes.position.needsUpdate = true;
    this.marks.instanceMatrix.needsUpdate = true;
    this.warnings.instanceMatrix.needsUpdate = true;
  }
}
