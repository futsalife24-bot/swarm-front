import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { weaponTier } from "../shared/progression";
import type { Weapon, Kind } from "../shared/defs";

const COLORS = [0x92aaa6, 0x83d8b0, 0x7cbdf4, 0xd5a4f4, 0xffd472];
// Authored in the Blender source basis: forward, height, half-width (metres).
// Trace the major silhouette, not screws, rail teeth or overlapping mesh edges.
type Point = [number, number, number];
const PROFILES: Record<Kind, Point[]> = {
  rifle: [
    [-0.34, 0.076, 0.034],
    [-0.25, 0.096, 0.034],
    [-0.11, 0.096, 0.039],
    [0.31, 0.102, 0.035],
    [0.38, 0.087, 0.027],
    [0.4, 0.059, 0.014],
    [0.617, 0.059, 0.014],
    [0.619, 0.065, 0.021],
    [0.661, 0.065, 0.021],
    [0.661, 0.021, 0.021],
    [0.618, 0.021, 0.021],
    [0.613, 0.029, 0.014],
    [0.395, 0.029, 0.014],
    [0.37, 0.005, 0.035],
    [0.151, -0.002, 0.032],
    [0.124, -0.045, 0.022],
    [0.128, -0.13, 0.022],
    [0.157, -0.23, 0.022],
    [0.078, -0.246, 0.022],
    [0.051, -0.14, 0.022],
    [0.046, -0.052, 0.032],
    [0.025, -0.044, 0.024],
    [-0.022, -0.153, 0.024],
    [-0.082, -0.136, 0.024],
    [-0.053, -0.044, 0.031],
    [-0.122, -0.036, 0.033],
    [-0.251, -0.043, 0.033],
    [-0.287, -0.113, 0.034],
    [-0.34, -0.118, 0.034],
  ],
  shotgun: [
    [-0.391, 0.002, 0.032],
    [-0.206, 0.025, 0.03],
    [-0.13, 0.02, 0.03],
    [-0.075, 0.049, 0.031],
    [-0.025, 0.08, 0.031],
    [0.134, 0.08, 0.031],
    [0.148, 0.07, 0.017],
    [0.661, 0.07, 0.017],
    [0.661, -0.004, 0.019],
    [0.47, -0.004, 0.019],
    [0.459, -0.017, 0.03],
    [0.265, -0.017, 0.03],
    [0.249, -0.003, 0.016],
    [0.136, -0.003, 0.03],
    [0.044, -0.006, 0.03],
    [0.022, -0.045, 0.031],
    [-0.041, -0.045, 0.031],
    [-0.078, -0.07, 0.03],
    [-0.11, -0.048, 0.03],
    [-0.188, -0.072, 0.03],
    [-0.38, -0.138, 0.032],
  ],
  rocket: [
    [-0.365, 0.176, 0.038],
    [-0.31, 0.166, 0.038],
    [0.553, 0.166, 0.038],
    [0.609, 0.176, 0.038],
    [0.609, 0.004, 0.038],
    [0.55, 0.014, 0.038],
    [0.342, 0.014, 0.038],
    [0.335, -0.032, 0.024],
    [0.185, -0.032, 0.024],
    [0.18, 0.009, 0.038],
    [0.034, 0.009, 0.025],
    [0.03, -0.12, 0.025],
    [-0.028, -0.125, 0.025],
    [-0.031, -0.026, 0.025],
    [-0.247, -0.026, 0.049],
    [-0.251, 0.014, 0.038],
    [-0.31, 0.014, 0.038],
    [-0.365, 0.004, 0.038],
  ],
};

/** Rounded, closed neon trim on both sides of the unchanged weapon model. */
export function neonGeometry(kind: Kind, radius: number) {
  const tubes: T.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const points = PROFILES[kind].map(
      ([forward, up, width]) => new T.Vector3(side * width, up, -forward),
    );
    const path = new T.CurvePath<T.Vector3>();
    const corners = points.map((p, i) => {
      const prev = points[(i + points.length - 1) % points.length];
      const next = points[(i + 1) % points.length];
      const distance = Math.min(
        0.008,
        p.distanceTo(prev) * 0.25,
        p.distanceTo(next) * 0.25,
      );
      return {
        p,
        entry: p
          .clone()
          .add(prev.clone().sub(p).normalize().multiplyScalar(distance)),
        exit: p
          .clone()
          .add(next.clone().sub(p).normalize().multiplyScalar(distance)),
      };
    });
    corners.forEach((c, i) => {
      path.add(new T.QuadraticBezierCurve3(c.entry, c.p, c.exit));
      path.add(
        new T.LineCurve3(c.exit, corners[(i + 1) % corners.length].entry),
      );
    });
    tubes.push(new T.TubeGeometry(path, points.length * 8, radius, 8, true));
  }
  const result = mergeGeometries(tubes)!;
  for (const tube of tubes) tube.dispose();
  return result;
}

export class WeaponRarityGlow {
  private readonly color: T.Color;
  private readonly core: T.MeshBasicMaterial;
  private readonly halo: T.MeshBasicMaterial;
  private readonly lines: T.Mesh[] = [];

  constructor(root: T.Object3D, weapon: Weapon) {
    this.color = new T.Color(COLORS[weaponTier(weapon)]);
    // Opaque core gives a stable, continuous line; no additive white hotspots.
    this.core = new T.MeshBasicMaterial({
      color: this.color,
      toneMapped: false,
    });
    this.halo = new T.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    });
    for (const [radius, material] of [
      [0.0035, this.core],
      [0.007, this.halo],
    ] as const) {
      const line = new T.Mesh(neonGeometry(weapon.kind, radius), material);
      line.name = material === this.core ? "WeaponNeonCore" : "WeaponNeonHalo";
      line.raycast = () => {};
      root.add(line);
      this.lines.push(line);
    }
    this.update(0);
  }

  update(seconds: number) {
    const breath = 0.5 + 0.5 * Math.sin((seconds * Math.PI) / 2);
    this.core.color.copy(this.color).multiplyScalar(0.78 + 0.22 * breath);
    this.halo.opacity = 0.1 + 0.08 * breath;
  }

  dispose() {
    for (const line of this.lines) {
      line.removeFromParent();
      line.geometry.dispose();
    }
    this.lines.length = 0;
    this.core.dispose();
    this.halo.dispose();
  }
}
