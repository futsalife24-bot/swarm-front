import * as T from "three";
import type { Block } from "../shared/defs";
import type { Enemy } from "../shared/game";
import { HARROW } from "../shared/harrow";
import {
  HARROW_SPIN_TIMING,
  harrowSpinRotation,
} from "../shared/harrow-motion";
import { supportHeight } from "../shared/terrain";
import { TerrainProjectedMarkers } from "./terrain-projected-marker";

const CAPACITY = 4,
  DUST_PER_SPIN = 64;
const declarations = `
uniform vec4 spinCenters[4];
uniform vec4 spinPhases[4];
varying float spinOwner;
`;
const envelope = `
float wrapAngle(float a) { return atan(sin(a), cos(a)); }
float sweepAlpha(vec2 offset, vec4 center, vec4 phase) {
  float angle = atan(offset.x, offset.y);
  float delta = wrapAngle(angle - center.z - 1.5707963);
  float tail = min(mod(-delta + 6.2831853, 6.2831853), mod(-delta + 9.424778, 6.2831853));
  float arc = (1.0 - smoothstep(0.1, 1.45, tail));
  float flash = exp(-max(phase.x, 0.0) * 24.0);
  return max(arc, flash) * center.w;
}
`;
type SpinState = {
  id: number;
  started: number;
  x: number;
  y: number;
  z: number;
  blocks?: Block[];
  prepared: number;
};

/** Four simultaneous sweeps, two clipped ground bands and 64 dust sprites each.
 * Geometry is prepared during the warning; the active sweep changes uniforms only. */
export class HarrowSpinEffects {
  readonly root = new T.Group();
  readonly centers = Array.from({ length: CAPACITY }, () => new T.Vector4());
  readonly phases = Array.from({ length: CAPACITY }, () => new T.Vector4());
  private readonly states: Array<SpinState | undefined> = [];
  private readonly material = new T.MeshBasicMaterial({
    color: 0xe3ded0,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    side: T.DoubleSide,
  });
  readonly bands = new TerrainProjectedMarkers(this.material, CAPACITY * 2);
  private readonly dustGeometry = new T.BufferGeometry();
  private readonly dustMaterial = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      spinCenters: { value: this.centers },
      spinPhases: { value: this.phases },
      projectionScale: { value: 600 },
    },
    vertexShader: `${declarations}
      attribute float owner; attribute float seed; uniform float projectionScale;
      varying float dustAlpha; varying float dustSeed;
      ${envelope}
      void main() {
        spinOwner = owner; dustSeed = seed;
        int id = int(owner + 0.5); vec4 center = spinCenters[id]; vec4 phase = spinPhases[id];
        dustAlpha = sweepAlpha(position.xz - center.xy, center, phase);
        vec3 p = position; p.y += max(phase.x,0.0) * (0.65 + seed * 0.4);
        vec4 mv = modelViewMatrix * vec4(p,1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(projectionScale * (0.7 + seed * 0.9) / max(1.0,-mv.z), 1.0, 70.0);
      }`,
    fragmentShader: `varying float dustAlpha; varying float dustSeed;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float grain = 0.78 + 0.22 * sin(p.x*17.0+sin(p.y*13.0)+dustSeed*31.0);
        float alpha = (1.0-smoothstep(0.22,1.0,length(p))) * dustAlpha * grain * 0.55;
        if(alpha < 0.015) discard;
        gl_FragColor = vec4(mix(vec3(0.52,0.46,0.36),vec3(0.82,0.78,0.66),dustSeed),alpha);
      }`,
  });
  readonly dust = new T.Points(this.dustGeometry, this.dustMaterial);
  private readonly viewport = new T.Vector2();
  constructor() {
    this.root.name = "HARROW_SPIN_PRESSURE";
    const vertices = this.bands.geometry.getAttribute("position").count;
    const owners = new Float32Array(vertices);
    for (let i = 0; i < vertices; i++)
      owners[i] = Math.floor(
        i / (TerrainProjectedMarkers.maxTrianglesPerRing * 3 * 2),
      );
    this.bands.geometry.setAttribute("owner", new T.BufferAttribute(owners, 1));
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.spinCenters = { value: this.centers };
      shader.uniforms.spinPhases = { value: this.phases };
      shader.vertexShader =
        `attribute float owner; varying float spinOwner; varying vec3 spinLocal;\n${shader.vertexShader}`.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nspinOwner = owner; spinLocal = transformed;",
        );
      shader.fragmentShader =
        `${declarations}\nvarying vec3 spinLocal;\n${envelope}\n${shader.fragmentShader}`.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
        int id = int(spinOwner + 0.5); vec4 center = spinCenters[id]; vec4 phase = spinPhases[id];
        vec2 offset = spinLocal.xz - center.xy; float radius = length(offset);
        if(radius > phase.z) discard;
        float alpha = sweepAlpha(offset, center, phase);
        float lines = pow(0.5 + 0.5 * sin(radius * 12.0 + sin(atan(offset.x,offset.y)*9.0)*0.6 - phase.x*32.0), 6.0);
        diffuseColor.a *= alpha * (0.18 + 0.82 * lines);
        if(diffuseColor.a < 0.02) discard;
      `,
        );
    };
    this.material.customProgramCacheKey = () => "harrow-spin-pressure-v1";
    const positions = new Float32Array(CAPACITY * DUST_PER_SPIN * 3),
      dustOwners = new Float32Array(CAPACITY * DUST_PER_SPIN),
      seeds = new Float32Array(CAPACITY * DUST_PER_SPIN);
    for (let i = 0; i < seeds.length; i++) {
      dustOwners[i] = Math.floor(i / DUST_PER_SPIN);
      seeds[i] = (i * 0.61803398875) % 1;
    }
    this.dustGeometry.setAttribute(
      "position",
      new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage),
    );
    this.dustGeometry.setAttribute(
      "owner",
      new T.BufferAttribute(dustOwners, 1),
    );
    this.dustGeometry.setAttribute("seed", new T.BufferAttribute(seeds, 1));
    this.dust.frustumCulled = false;
    this.dust.onBeforeRender = (renderer, _scene, camera) => {
      renderer.getDrawingBufferSize(this.viewport);
      this.dustMaterial.uniforms.projectionScale.value =
        this.viewport.y * camera.projectionMatrix.elements[5] * 0.5;
    };
    this.root.add(this.bands, this.dust);
    this.root.visible = false;
  }
  update(time: number, enemies: Enemy[], blocks?: Block[]) {
    for (const center of this.centers) center.w = 0;
    let active = 0,
      preparedThisFrame = false,
      visible = false;
    for (const enemy of enemies) {
      const attack = enemy.harrow;
      if (
        enemy.kind !== "harrow" ||
        enemy.hp <= 0 ||
        attack?.kind !== "Spin" ||
        active >= CAPACITY
      )
        continue;
      const age = time - attack.started;
      if (age < 0 || age >= HARROW_SPIN_TIMING.duration) continue;
      const slot = active++;
      let state = this.states[slot];
      if (
        !state ||
        state.id !== enemy.id ||
        state.started !== attack.started ||
        state.blocks !== blocks
      ) {
        state = {
          id: enemy.id,
          started: attack.started,
          x: enemy.x,
          y: enemy.y,
          z: enemy.z,
          blocks,
          prepared: 0,
        };
        this.states[slot] = state;
        const positions = this.dustGeometry.getAttribute(
          "position",
        ) as T.BufferAttribute;
        for (let i = 0; i < DUST_PER_SPIN; i++) {
          const seed = (i * 0.61803398875) % 1,
            angle = (i / DUST_PER_SPIN) * Math.PI * 2;
          const radius = HARROW.spinRadius * (0.76 + seed * 0.2);
          const x = state.x + Math.sin(angle) * radius,
            z = state.z + Math.cos(angle) * radius;
          const y = blocks ? supportHeight(x, z, blocks, state.y) : state.y;
          positions.setXYZ(slot * DUST_PER_SPIN + i, x, y + 0.35, z);
        }
        positions.needsUpdate = true;
      }
      while (
        state.prepared < 2 &&
        (!preparedThisFrame || age >= HARROW_SPIN_TIMING.wind)
      ) {
        const ring = state.prepared++;
        this.bands.setRing(
          slot * 2 + ring,
          state,
          HARROW.spinRadius * (ring ? 1 : 0.84),
          blocks,
        );
        preparedThisFrame = true;
      }
      const elapsed = age - HARROW_SPIN_TIMING.wind;
      const recovery = Math.max(0, elapsed - HARROW_SPIN_TIMING.turn);
      const alpha =
        elapsed < 0
          ? 0
          : Math.max(
              0,
              1 -
                recovery /
                  (HARROW_SPIN_TIMING.duration -
                    HARROW_SPIN_TIMING.wind -
                    HARROW_SPIN_TIMING.turn),
            );
      this.centers[slot].set(
        state.x,
        state.z,
        attack.yaw + harrowSpinRotation(age),
        alpha,
      );
      this.phases[slot].set(elapsed, age, HARROW.spinRadius, 0);
      visible ||= alpha > 0;
    }
    this.bands.setCount(active * 2);
    this.dustGeometry.setDrawRange(0, active * DUST_PER_SPIN);
    this.root.visible = visible;
  }
  dispose() {
    this.bands.dispose();
    this.material.dispose();
    this.dustGeometry.dispose();
    this.dustMaterial.dispose();
    this.root.removeFromParent();
  }
}
