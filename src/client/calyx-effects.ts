import * as T from "three";
import { wallDistance, type World } from "../shared/game";
import {
  CALYX,
  calyxPredictedImpact,
  pollenPointContains,
  pollenRadius,
} from "../shared/calyx";
import { mapFor } from "../shared/stages";
import { supportHeight } from "../shared/terrain";
import type { Block } from "../shared/map-blocks";
import { redWarningAfterStart } from "./attack-telegraph";

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
      size: 2.6,
      transparent: true,
      opacity: 0.2,
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
    new T.MeshBasicMaterial({
      color: 0xff4054,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      side: T.DoubleSide,
    }),
    32000, // Dense PollenShot coverage remains bounded even at the Solo actor cap.
  );
  private cells = new Map<
    number,
    {
      mist: { x: number; y: number; z: number; distance: number }[];
      dome: T.Mesh<T.SphereGeometry, T.MeshBasicMaterial>;
      reach: Float32Array;
    }
  >();
  private shotWarnings = new Map<
    number,
    {
      started: number;
      blocks: Block[];
      cells: { x: number; y: number; z: number }[];
    }
  >();
  private domeTemplate = new T.SphereGeometry(
    1,
    32,
    16,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2,
  );
  private domeMaterial = new T.MeshBasicMaterial({
    color: 0xc4b465,
    transparent: true,
    opacity: 0.085,
    depthWrite: false,
    side: T.DoubleSide,
  });
  private domes = new T.Group();
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
    this.domes.name = "POLLEN_DOMES";
    this.root.add(this.mist, this.marks, this.warnings, this.domes);
    this.mist.frustumCulled =
      this.marks.frustumCulled =
      this.warnings.frustumCulled =
        false;
  }
  private clear() {
    for (const c of this.cells.values()) c.dome.geometry.dispose();
    this.cells.clear();
    this.domes.clear();
    this.shotWarnings.clear();
  }
  /** Local camera haze only, no persistent blindness or stacking. */
  haze(w: World | null | undefined, p: T.Vector3) {
    if (!w || w.phase !== "battle") return 0;
    let strength = 0;
    for (const c of w.pollen ?? []) {
      if (!pollenPointContains(c, p, w.time, mapFor(w).blocks)) continue;
      const r = pollenRadius(c, w.time),
        d = Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z);
      strength = Math.max(strength, Math.min(1, (r - d) / 2));
    }
    return strength;
  }
  update(w?: World | null) {
    this.mistCount = this.marks.count = this.warnings.count = 0;
    this.mist.geometry.setDrawRange(0, 0);
    if (!w || w.phase !== "battle") {
      this.clear();
      return;
    }
    if (this.run !== w.run) {
      this.clear();
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
        const mist: { x: number; y: number; z: number; distance: number }[] =
          [];
        // Deterministic 3D samples throughout the hemisphere: 288 x 16 < 6000.
        for (let i = 0; i < 288; i++) {
          const y = (i + 0.5) / 288,
            angle = i * 2.399963229728653,
            radial = Math.sqrt(1 - y * y),
            distance =
              CALYX.radius * Math.cbrt((((i * 137) % 288) + 0.5) / 288),
            p = {
              x: c.x + Math.cos(angle) * radial * distance,
              y: c.y + y * distance,
              z: c.z + Math.sin(angle) * radial * distance,
            };
          if (pollenPointContains(c, p, c.born + CALYX.growth, blocks))
            mist.push({ ...p, distance });
        }
        const dome = new T.Mesh(this.domeTemplate.clone(), this.domeMaterial);
        dome.position.set(c.x, c.y, c.z);
        dome.frustumCulled = false;
        const directions = this.domeTemplate.attributes.position,
          reach = new Float32Array(directions.count);
        for (let i = 0; i < reach.length; i++)
          reach[i] = Math.max(
            0,
            wallDistance(
              c.x,
              c.y + 0.08,
              c.z,
              directions.getX(i),
              directions.getY(i),
              directions.getZ(i),
              CALYX.radius,
              blocks,
            ) - 0.025,
          );
        this.domes.add(dome);
        cells = { mist, dome, reach };
        this.cells.set(c.id, cells);
      }
      const radius = pollenRadius(c, w.time);
      const positions = cells.dome.geometry.attributes.position,
        directions = this.domeTemplate.attributes.position;
      cells.dome.visible = radius > 0;
      for (let i = 0; i < positions.count; i++) {
        const r = Math.min(radius, cells.reach[i]);
        positions.setXYZ(
          i,
          directions.getX(i) * r,
          directions.getY(i) * r,
          directions.getZ(i) * r,
        );
      }
      positions.needsUpdate = true;
      // The hemisphere and suspended mist show the hazard volume; no floor-dot carpet.
      for (const p of cells.mist) {
        if (p.distance > radius || this.mistCount >= 6000) continue;
        this.mistPositions.set([p.x, p.y, p.z], this.mistCount++ * 3);
      }
    }
    for (const id of this.cells.keys())
      if (!active.has(id)) {
        const old = this.cells.get(id)!;
        old.dome.geometry.dispose();
        this.domes.remove(old.dome);
        this.cells.delete(id);
      }
    markBatch = this.warnings;
    const activeShots = new Set<number>();
    for (const e of w.enemies) {
      const a = e.calyx;
      if (!a) continue;
      if (a.kind === "PollenShot" && !a.fired) activeShots.add(e.id);
      if (a.fired) {
        const age = w.time - a.started - CALYX.slamWind;
        if (a.kind === "Slam" && age >= 0 && age < 0.3) {
          const r = CALYX.slamRange * Math.min(1, age / 0.18);
          for (let angle = -Math.PI / 3; angle <= Math.PI / 3; angle += 0.12) {
            const x = e.x + Math.sin(a.yaw + angle) * r,
              z = e.z + Math.cos(a.yaw + angle) * r;
            mark(x, supportHeight(x, z, blocks, e.y), z, 0.3);
          }
        }
        continue;
      }
      const wind = a.kind === "Slam" ? CALYX.slamWind : CALYX.shotWind;
      if (!redWarningAfterStart(w.time - a.started, wind)) continue;
      if (a.kind === "PollenShot") {
        let cached = this.shotWarnings.get(e.id);
        if (
          !cached ||
          cached.started !== a.started ||
          cached.blocks !== blocks
        ) {
          const impact = calyxPredictedImpact(e, a.yaw, blocks);
          const cells: { x: number; y: number; z: number }[] = [];
          if (impact) {
            const cloud = { id: 0, ...impact, born: 0, damage: 0 };
            for (let dx = -13.5; dx <= 13.5; dx += 1.5)
              for (let dz = -13.5; dz <= 13.5; dz += 1.5) {
                const x = impact.x + dx,
                  z = impact.z + dz;
                if (Math.hypot(dx, dz) > CALYX.radius) continue;
                const y = supportHeight(x, z, blocks, impact.y);
                if (
                  pollenPointContains(
                    cloud,
                    { x, y: y + 0.9, z },
                    CALYX.growth,
                    blocks,
                  )
                )
                  cells.push({ x, y, z });
              }
          }
          cached = { started: a.started, blocks, cells };
          this.shotWarnings.set(e.id, cached);
        }
        for (const cell of cached.cells) mark(cell.x, cell.y, cell.z, 1.2);
      } else {
        for (let r = 0.5; r <= CALYX.slamRange; r += 0.5)
          for (let angle = -Math.PI / 3; angle <= Math.PI / 3; angle += 0.18) {
            const x = e.x + Math.sin(a.yaw + angle) * r,
              z = e.z + Math.cos(a.yaw + angle) * r;
            mark(x, supportHeight(x, z, blocks, e.y), z, 0.42);
          }
      }
    }
    for (const id of this.shotWarnings.keys())
      if (!activeShots.has(id)) this.shotWarnings.delete(id);
    this.mist.geometry.setDrawRange(0, this.mistCount);
    this.mist.geometry.attributes.position.needsUpdate = true;
    this.marks.instanceMatrix.needsUpdate = true;
    this.warnings.instanceMatrix.needsUpdate = true;
  }
}
