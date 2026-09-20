import * as T from "three";
import { wallDistance, type World } from "../shared/game";
import { CALYX, pollenPointContains, pollenRadius } from "../shared/calyx";
import { mapFor } from "../shared/stages";
import { supportHeight } from "../shared/terrain";

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
    this.marks.material,
    12000, // Solo permits 120 actors; each full Slam warning uses 96 instances.
  );
  private cells = new Map<
    number,
    {
      mist: { x: number; y: number; z: number; distance: number }[];
      dome: T.Mesh<T.SphereGeometry, T.MeshBasicMaterial>;
      reach: Float32Array;
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
            mark(x, supportHeight(x, z, blocks, e.y), z, 0.3);
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
            mark(x, supportHeight(x, z, blocks, e.y), z, 0.15);
          }
      }
    }
    this.mist.geometry.setDrawRange(0, this.mistCount);
    this.mist.geometry.attributes.position.needsUpdate = true;
    this.marks.instanceMatrix.needsUpdate = true;
    this.warnings.instanceMatrix.needsUpdate = true;
  }
}
