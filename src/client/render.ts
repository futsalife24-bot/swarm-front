import { CalyxEffects } from "./calyx-effects";
import { DroneCamera } from "./drone-camera";
import "./drone-camera.css";
import { cleanCapture } from "./clean-capture";
import { dropGeometry } from "./drop-design";
import { DefenseVisual } from "./defense-visual";
import { enemySize } from "../shared/enemy-size";
import { dropAt } from "../shared/solo-progression";
import { groundHeight } from "../shared/terrain";
import { TerrainWarnings } from "./terrain-warnings";
import { MapAssets, VIEW_MAPS } from "./map-assets";
import {
  StructureMotion,
  STRUCTURE_ASSETS,
  type StructureInput,
} from "./structure-motion";
import { loadStandardTrooper, StandardTrooper } from "./standard-trooper";
import { AdaptiveQuality } from "./adaptive-quality";
import { FramePacer } from "./frame-pacer";
import type { StructureVisualKind } from "./structure-motion";
import { CombatEffects } from "./combat-effects";
import { EnemySpawnEffects } from "./enemy-spawn-effects";
import { MAPS, DEFENSE_MAPS, mapFor } from "../shared/stages";
import * as T from "three";
import { enemyGeometry, mechanizeMaterial } from "./enemy-model";
import { ENEMIES, EVADE_DURATION } from "../shared/defs";
import { NORMAL_FOV, SCOPE_FOV } from "../shared/aim";
import { aimCamera, cameraShot } from "../shared/game";
import { FoundryWormView, FOUNDRY_WORM_ASSET } from "./foundry-worm";
import {
  foundryLaserOrigin,
  FOUNDRY_TARGET_HEIGHT,
  FOUNDRY_LASER_WARNING,
} from "../shared/foundry-defs";
import { eye, type Enemy, type Player, type World } from "../shared/game";
const mats = new Map<number, T.MeshStandardMaterial>();
function material(color: number) {
  if (!mats.has(color))
    mats.set(
      color,
      new T.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true }),
    );
  return mats.get(color)!;
}
const box = new T.BoxGeometry(1, 1, 1),
  ico = new T.IcosahedronGeometry(1, 0),
  cone = new T.ConeGeometry(1, 1, 5),
  cylinder = new T.CylinderGeometry(1, 1, 1, 6);

// InstancedMesh keeps a cached bounding sphere for frustum culling. Updating
// instance matrices does not invalidate that cache, so moving enemies could be
// culled while their game entities remained active.
export function syncDynamicInstances(mesh: T.InstancedMesh) {
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}
function part(
  g: T.Group,
  geo: T.BufferGeometry,
  color: number,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  rx = 0,
  ry = 0,
  rz = 0,
) {
  const m = new T.Mesh(geo, material(color));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.set(rx, ry, rz);
  g.add(m);
  return m;
}
export function soldier(color: number) {
  const g = new T.Group();
  const legs: T.Group[] = [];
  part(g, box, color, 0, 1.05, 0, 0.65, 0.7, 0.36);
  part(g, box, 0x20343c, 0, 0.67, 0, 0.5, 0.28, 0.35);
  part(g, ico, color, 0, 1.62, 0, 0.34, 0.34, 0.3);
  part(g, box, 0x81e9e4, 0, 1.64, -0.25, 0.43, 0.13, 0.09);
  part(g, box, 0x213944, 0, 1.12, 0.28, 0.45, 0.55, 0.22);
  for (const s of [-1, 1]) {
    const leg = new T.Group();
    leg.position.set(s * 0.2, 0.63, 0);
    part(leg, box, 0x2a414c, 0, -0.29, 0, 0.23, 0.58, 0.23);
    part(leg, box, 0x152832, 0, -0.56, -0.08, 0.25, 0.17, 0.43);
    g.add(leg);
    legs.push(leg);
    part(g, box, color, s * 0.45, 1.05, -0.15, 0.22, 0.5, 0.25, Math.PI / 4);
    part(g, ico, 0x667984, s * 0.45, 1.35, 0, 0.25, 0.2, 0.27);
  }
  const gun = new T.Group();
  part(gun, box, 0x162a36, 0, 0, 0, 0.18, 0.2, 0.7);
  part(gun, cylinder, 0x8b9ba6, 0, 0, -0.55, 0.065, 0.5, 0.065, Math.PI / 2);
  part(gun, box, 0xe4b15b, 0, 0.1, -0.2, 0.07, 0.07, 0.3);
  gun.position.set(0.45, 1.05, -0.6);
  g.add(gun);
  // A separate chest pivot keeps the feet/world position and camera stable.
  const root = new T.Group(),
    pivot = new T.Group();
  g.position.y = -1;
  pivot.position.y = 1;
  pivot.add(g);
  root.add(pivot);
  root.userData = { gun, legs, pivot, axis: new T.Vector3(-1, 0, 0) };
  if (typeof window !== "undefined") {
    loadStandardTrooper()
      .then((assets) => {
        if (root.userData.disposed) return;
        const trooper = new StandardTrooper(assets);
        root.userData.trooper = trooper;
        pivot.visible = false;
        root.add(trooper.model);
      })
      .catch((error) => {
        root.userData.trooperError = String(error);
        console.warn("Standard Trooper unavailable; using fallback", error);
      });
  }
  return root;
}

export function poseSoldier(
  m: T.Group,
  p: Player,
  yaw: number,
  time: number,
  run: string,
  dt = 0,
  visualAim = false,
) {
  const data = m.userData;
  if (data.trooper) {
    m.rotation.set(0, -yaw, 0);
    // Preserve the interpolated feet altitude.
    (data.trooper as StandardTrooper).update(
      p,
      yaw,
      time,
      run,
      dt,
      m.position,
      visualAim,
    );
    return;
  }
  const pivot = data.pivot as T.Group;
  const gun = data.gun as T.Group;
  const rolling = p.hp > 0 && p.evade > 0;
  // Use authoritative displacement, never interpolation lag or camera rotation.
  if (
    rolling &&
    (!(data.evade > 0) || p.evade > data.evade || data.run !== run)
  ) {
    data.elapsed = Math.max(0, EVADE_DURATION - p.evade);
    const dx = data.run === run ? p.x - data.x : 0;
    const dz = data.run === run ? p.z - data.z : 0;
    data.axis.set(dz, 0, -dx);
    if (data.axis.lengthSq() < 0.000001)
      data.axis.set(-Math.cos(yaw), 0, -Math.sin(yaw));
    data.axis.normalize();
  } else if (rolling) {
    // Fill the gaps between 20 Hz snapshots, without rewinding on arrival.
    data.elapsed = Math.max(data.elapsed + dt, EVADE_DURATION - p.evade);
  }
  data.x = p.x;
  data.z = p.z;
  data.evade = p.evade;
  data.run = run;
  const progress = rolling
    ? T.MathUtils.clamp(data.elapsed / EVADE_DURATION, 0, 1)
    : 0;
  const tuck = rolling ? Math.sin(Math.PI * progress) : 0;
  m.rotation.set(p.hp <= 0 ? Math.PI / 2 : 0, -yaw, 0);
  m.position.y =
    (p.y ?? 0) + (p.hp <= 0 ? 0.2 : rolling ? 0 : Math.sin(time * 13) * 0.035);
  // Convert the captured world roll axis into the current facing's local space.
  const axis = (data.axis as T.Vector3)
    .clone()
    .applyAxisAngle(new T.Vector3(0, 1, 0), yaw);
  pivot.quaternion.setFromAxisAngle(axis, Math.PI * 2 * progress);
  pivot.position.y = 1 + 0.12 * tuck;
  for (const leg of data.legs as T.Group[]) leg.rotation.x = -1.65 * tuck;
  gun.position.set(0.45 - 0.15 * tuck, 1.05 + 0.08 * tuck, -0.6 + 0.4 * tuck);
  gun.rotation.x = -0.65 * tuck;
}
export class Renderer {
  /** Authored GLB forward is local -Z; use the rendered transform, including held attack yaw. */
  encounterFront(enemy: Readonly<Enemy>) {
    const matrix = new T.Matrix4();
    if (enemy.segments) {
      const head = this.foundryWorms.get(enemy.id)?.view?.units[0];
      if (head) {
        head.updateWorldMatrix(true, false);
        matrix.copy(head.matrixWorld);
      }
    } else {
      const motion = this.structures.get(enemy.kind);
      const index =
        this.structureInputs
          .get(enemy.kind)
          ?.findIndex((e) => e.id === enemy.id) ?? -1;
      if (motion?.batch && index >= 0)
        motion.batch.parts[0].getMatrixAt(index, matrix);
    }
    return new T.Vector3(0, 0, -1).transformDirection(matrix);
  }

  /** Separate visual clock for one introduction; combat state and other instances stay frozen. */
  encounterIdle(enemy: Readonly<Enemy>) {
    if (enemy.segments) {
      return this.foundryWorms.get(enemy.id)?.view?.inspectionIdle();
    }
    const motion = this.structures.get(enemy.kind);
    const batch = motion?.batch;
    const index =
      this.structureInputs
        .get(enemy.kind)
        ?.findIndex((e) => e.id === enemy.id) ?? -1;
    if (!batch || index < 0) return;
    const attributes = [batch.poseA, batch.poseB, batch.blend];
    const saved = attributes.map((a) =>
      Array.from(a.array.slice(index * a.itemSize, (index + 1) * a.itemSize)),
    );
    const state = motion!.controller.states.get(enemy.id);
    const phase = state?.clip === "Idle" ? state.time : 0;
    return {
      update: (time: number) => {
        batch.setPose(
          index,
          "Idle",
          phase + time,
          state?.clip ?? "Idle",
          state?.time ?? 0,
          Math.min(1, time / 0.25),
        );
        for (const attribute of attributes) attribute.needsUpdate = true;
      },
      restore: () => {
        attributes.forEach((a, i) => {
          a.array.set(saved[i], index * a.itemSize);
          a.needsUpdate = true;
        });
      },
    };
  }

  readonly structures = new Map<StructureVisualKind, StructureMotion>();
  private calyxEffects = new CalyxEffects();
  private structureInputs = new Map<StructureVisualKind, StructureInput[]>();
  enemyGlbDebug = new Map<string, import("./enemy-glb-debug").EnemyGlbDebug>();
  houndDebug?: import("./hound-glb-debug").HoundGlbDebug;
  private houndVisualInputs: import("./hound-motion").HoundVisualInput[] = [];
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(NORMAL_FOV, 1, 0.1, 1200);
  readonly drone = DroneCamera.fromLocation();
  renderer: T.WebGLRenderer;
  enemies = new Map<string, T.InstancedMesh>();
  bossBody!: T.InstancedMesh;
  readonly foundryWorms = new Map<
    number,
    { view?: FoundryWormView; loading: Promise<void>; error?: string }
  >();
  private foundryTime = 0;
  private foundryHeadings = new Map<string, number>();
  foundryWarnings!: T.InstancedMesh;
  foundryLasers!: T.InstancedMesh;
  foundryLaserGlow!: T.InstancedMesh;
  players = new Map<string, T.Group>();
  readonly defenseVisual: DefenseVisual;
  dummy = new T.Object3D();
  particles: T.InstancedMesh;
  projectiles: T.InstancedMesh;
  drops: T.InstancedMesh;
  healDrops: T.InstancedMesh;
  rings: T.InstancedMesh;
  private terrainWarnings = new TerrainWarnings();
  aimWarnings: T.InstancedMesh;
  houndWarnings: T.InstancedMesh;
  effects: { x: number; y: number; z: number; life: number; size: number }[] =
    [];
  combat = new CombatEffects(this.scene);
  spawnEffects = new EnemySpawnEffects(this.scene);
  lastEvent = 0;
  run = "";
  visual = new Map<string, T.Vector3>();
  private crawlerAim = new Map<
    number,
    { cool: number; time: number; until: number; wind: number; yaw: number }
  >();
  fps = 60;
  quality = 1;
  frameRate: 30 | 60 = 60;
  private framePacer = new FramePacer();
  readonly adaptiveQuality = new AdaptiveQuality();
  drawCalls = 0;
  cameraAnchor = { x: 0, z: 0 };
  onSound: (type: string) => void = () => {};
  // "self" shows only your own hits; four players' numbers at once bury the fight.
  damageNumbers: "self" | "all" | "off" = "self";
  damageLayer = document.getElementById("damage")!;
  // Pooled: a rifle lands about eight hits a second and churning nodes is worse
  // than keeping a few dozen around.
  floaters: {
    el: HTMLElement;
    x: number;
    y: number;
    z: number;
    life: number;
  }[] = [];
  spare: HTMLElement[] = [];
  showDamage(x: number, y: number, z: number, amount: number, mine: boolean) {
    if (this.floaters.length >= 28) return;
    const el = this.spare.pop() ?? document.createElement("span");
    el.textContent = String(amount);
    el.className = "damage-number" + (mine ? "" : " ally");
    this.damageLayer.append(el);
    this.floaters.push({ el, x, y, z, life: 0.75 });
  }
  // Anchored to the world point, so turning the camera does not slide the
  // numbers off the enemy that earned them.
  drawDamage(dt: number) {
    if (!this.floaters.length) return;
    // resize() owns the full-window canvas; avoid forcing layout after HUD writes.
    const w = this.viewportWidth,
      h = this.viewportHeight;
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      if (f.life <= 0) {
        f.el.remove();
        this.spare.push(f.el);
        this.floaters.splice(i, 1);
        continue;
      }
      const age = 1 - f.life / 0.75;
      const v = new T.Vector3(f.x, f.y + age * 1.4, f.z).project(this.camera);
      if (v.z > 1) {
        f.el.style.opacity = "0";
        continue;
      }
      f.el.style.transform =
        "translate(-50%,-50%) translate(" +
        ((v.x + 1) / 2) * w +
        "px," +
        ((1 - v.y) / 2) * h +
        "px)";
      f.el.style.opacity = String(Math.min(1, f.life * 3));
    }
  }
  caveLamp = new T.PointLight(0xffd9aa, 55, 28, 1.5);
  mapAssets!: MapAssets;
  frames: number[] = [];
  constructor(canvas: HTMLCanvasElement, enemyCapacity = 80) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.setClearColor(0x829ba5);
    this.scene.fog = new T.Fog(0x829ba5, 40, 145);
    this.scene.add(new T.HemisphereLight(0xd8f4fa, 0x26373c, 2.5));
    const sun = new T.DirectionalLight(0xffeddb, 3);
    sun.position.set(-65, 110, -50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -145,
      right: 145,
      top: 150,
      bottom: -150,
      near: 1,
      far: 420,
    });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.00015;
    sun.shadow.normalBias = 0.12;
    sun.shadow.autoUpdate = false;
    this.scene.add(sun, this.caveLamp);
    this.defenseVisual = new DefenseVisual(this.scene);
    this.mapAssets = new MapAssets(this.scene);
    for (const kind of Object.keys(ENEMIES) as Enemy["kind"][]) {
      const mesh = new T.InstancedMesh(
        enemyGeometry(kind),
        new T.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.8,
          flatShading: true,
        }),
        enemyCapacity,
      );
      if (kind === "ant" || kind === "crawler") {
        mesh.geometry.setAttribute(
          "stride",
          new T.InstancedBufferAttribute(new Float32Array(enemyCapacity), 1),
        );
        mesh.geometry.setAttribute(
          "charge",
          new T.InstancedBufferAttribute(new Float32Array(enemyCapacity), 1),
        );
        const clock = { value: 0 };
        mesh.userData.gaitClock = clock;
        mesh.material.onBeforeCompile = (shader) => {
          shader.uniforms.gaitClock = clock;
          shader.vertexShader =
            "attribute float legPhase; attribute float stride; attribute float charge; uniform float gaitClock;\n" +
            shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
            if (position.z < -.45 && position.z > -.75 && position.y > .6 && abs(legPhase) < .5) { transformed.xy = vec2(position.x, position.y - 1.25) * (1.0 - charge * .4) + vec2(0.0, 1.25); }
            float phase = gaitClock * 12.0 + (legPhase < 0.0 ? 3.14159 : 0.0);
            if (abs(legPhase) > 0.5) {
              transformed.z += sin(phase) * 0.32 * stride;
              transformed.y += max(0.0, cos(phase)) * 0.22 * stride;
            }`,
          );
        };
      }
      if (kind === "hornet") {
        mesh.geometry.setAttribute(
          "flight",
          new T.InstancedBufferAttribute(new Float32Array(enemyCapacity), 1),
        );
        const clock = { value: 0 };
        mesh.userData.wingClock = clock;
        mesh.material.onBeforeCompile = (shader) => {
          shader.uniforms.wingClock = clock;
          shader.vertexShader =
            "attribute float wingSide; attribute float flight; uniform float wingClock;\n" +
            shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
            if (abs(wingSide) > .5) {
              float angle = sin(wingClock * 2.0 + position.z) * .035 * flight;
              float reach = abs(position.x) - .3;
              transformed.x = wingSide * (.3 + reach * cos(angle));
              transformed.y += reach * sin(angle);
            }`,
          );
        };
      }
      if (kind === "boss") {
        mesh.geometry.setAttribute(
          "unfold",
          new T.InstancedBufferAttribute(new Float32Array(enemyCapacity), 1),
        );
        mesh.material.onBeforeCompile = (shader) => {
          shader.vertexShader =
            "attribute float unfold;\n" + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nif (position.y < 2.1) { transformed.x *= 1.0 + unfold * .28; } else { transformed.y += unfold * .7; }",
          );
        };
      }
      mechanizeMaterial(mesh.material);
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      this.enemies.set(kind, mesh);
      this.scene.add(mesh);
    }
    this.bossBody = new T.InstancedMesh(
      enemyGeometry("boss", true),
      mechanizeMaterial(
        new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }),
      ),
      enemyCapacity,
    );
    this.bossBody.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.bossBody.count = 0;
    this.scene.add(this.bossBody);
    this.foundryWarnings = new T.InstancedMesh(
      box,
      new T.MeshBasicMaterial({
        color: 0x50d9fa,
        transparent: true,
        opacity: 0.36,
        depthWrite: false,
      }),
      640,
    );
    this.foundryLasers = new T.InstancedMesh(
      box,
      new T.MeshBasicMaterial({ color: 0xcaffff }),
      100,
    );
    this.foundryLaserGlow = new T.InstancedMesh(
      box,
      new T.MeshBasicMaterial({
        color: 0x39d2ff,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
      100,
    );
    for (const beam of [
      this.foundryWarnings,
      this.foundryLasers,
      this.foundryLaserGlow,
    ]) {
      beam.count = 0;
      beam.instanceMatrix.setUsage(T.DynamicDrawUsage);
      this.scene.add(beam);
    }
    this.particles = new T.InstancedMesh(
      ico,
      new T.MeshBasicMaterial({
        color: 0xffc57e,
        transparent: true,
        opacity: 0.85,
      }),
      100,
    );
    this.projectiles = new T.InstancedMesh(
      ico,
      new T.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.24,
        metalness: 0.15,
      }),
      100,
    );
    this.drops = new T.InstancedMesh(
      dropGeometry(false),
      new T.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        emissive: 0x243d43,
        emissiveIntensity: 0.45,
        roughness: 0.65,
        metalness: 0.25,
      }),
      24,
    );
    this.healDrops = new T.InstancedMesh(
      dropGeometry(true),
      this.drops.material,
      24,
    );
    this.healDrops.count = this.drops.count = 0;
    this.scene.add(this.healDrops);
    this.rings = new T.InstancedMesh(
      new T.RingGeometry(0.9, 1, 192, 4),
      new T.MeshBasicMaterial({
        color: 0xff5d4c,
        side: T.DoubleSide,
        transparent: true,
        opacity: 0.75,
      }),
      enemyCapacity,
    );
    this.houndWarnings = new T.InstancedMesh(
      new T.RingGeometry(0.04, 2.5, 64, 16, Math.PI / 6, (Math.PI * 2) / 3),
      new T.MeshBasicMaterial({
        color: 0xff7755,
        side: T.DoubleSide,
        transparent: true,
        opacity: 0.3,
      }),
      Math.max(40, enemyCapacity),
    );
    this.terrainWarnings.attach(this.rings);
    this.terrainWarnings.attach(this.houndWarnings);
    this.aimWarnings = new T.InstancedMesh(
      new T.BoxGeometry(1, 1, 1),
      new T.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      }),
      120,
    );
    this.aimWarnings.visible = !cleanCapture.enabled;
    this.rings.visible = !cleanCapture.enabled;
    this.houndWarnings.visible = !cleanCapture.enabled;
    this.aimWarnings.count = 0;
    this.scene.add(this.aimWarnings);
    this.houndWarnings.count = 0;
    this.scene.add(
      this.particles,
      this.projectiles,
      this.drops,
      this.rings,
      this.houndWarnings,
      this.calyxEffects.root,
    );
    this.resize();
    for (const kind of Object.keys(STRUCTURE_ASSETS) as StructureVisualKind[]) {
      const query = {
        calyx: "debugCalyxGlb",
        crawler: "debugHoundGlb",
        ant: "debugHoundGlb",
        spider: "debugHoundGlb",
        spitter: "debugPrismGlb",
        hornet: "debugRayGlb",
        boss: "debugFoundryGlb",
      }[kind];
      if (
        import.meta.env.DEV &&
        ["1", "v1", "v2", "v3", "motion"].includes(
          new URLSearchParams(location.search).get(query) ?? "",
        )
      )
        continue;
      this.structures.set(
        kind,
        new StructureMotion(
          this.scene,
          this.enemies.get(kind)!.instanceMatrix.count,
          kind,
        ),
      );
      this.structureInputs.set(kind, []);
    }
    if (
      import.meta.env.DEV &&
      ["1", "v2", "v3", "motion"].includes(
        new URLSearchParams(location.search).get("debugHoundGlb") ?? "",
      )
    ) {
      import("./hound-glb-debug")
        .then(({ HoundGlbDebug }) => {
          const source = this.enemies.get("crawler")!;
          const flag = new URLSearchParams(location.search).get(
            "debugHoundGlb",
          );
          const version =
            flag === "motion" ? "motion" : flag === "v3" ? "v3" : "v2";
          this.houndDebug = new HoundGlbDebug(
            this.scene,
            source.instanceMatrix.count,
            version,
          );
          const button = document.createElement("button");
          button.textContent = `HOUND ${version} loading`;
          button.style.cssText =
            "position:fixed;right:8px;top:8px;z-index:10000;font:12px system-ui;padding:8px";
          button.disabled = true;
          button.onclick = () => {
            this.houndDebug!.enabled = !this.houndDebug!.enabled;
            button.textContent = this.houndDebug!.enabled
              ? `HOUND ${version} → Current`
              : `Current → HOUND ${version}`;
          };
          document.body.append(button);
          void this.houndDebug.loading.then(() => {
            button.disabled = !this.houndDebug!.ready;
            button.textContent = this.houndDebug!.ready
              ? `HOUND ${version} → Current`
              : "HOUND GLB failed · Current";
          });
        })
        .catch((error) =>
          console.warn("HOUND debug module unavailable", error),
        );
    }
    if (import.meta.env.DEV) {
      const specs = [
        ["spitter", "prism", "Prism"],
        ["hornet", "ray", "Ray"],
        ["boss", "foundry_zero", "Foundry"],
      ] as const;
      specs.forEach(([kind, name, query], index) => {
        if (
          !["1", "v1"].includes(
            new URLSearchParams(location.search).get("debug" + query + "Glb") ??
              "",
          )
        )
          return;
        import("./enemy-glb-debug")
          .then(({ EnemyGlbDebug }) => {
            const source = this.enemies.get(kind)!;
            const debug = new EnemyGlbDebug(
              this.scene,
              source.instanceMatrix.count,
              name,
            );
            this.enemyGlbDebug.set(kind, debug);
            const button = document.createElement("button");
            const label = name.toUpperCase().replace("_", " ");
            const update = () => {
              button.textContent = debug.enabled
                ? label + " v1 → Current"
                : "Current → " + label + " v1";
            };
            button.textContent = label + " loading";
            button.disabled = true;
            button.style.cssText =
              "position:fixed;right:8px;top:" +
              (52 + index * 42) +
              "px;z-index:10000;font:12px system-ui;padding:8px";
            button.onclick = () => {
              debug.enabled = !debug.enabled;
              update();
            };
            document.body.append(button);
            void debug.loading.then(() => {
              button.disabled = !debug.ready;
              if (debug.ready) update();
              else button.textContent = label + " GLB failed · Current";
            });
          })
          .catch((error) =>
            console.warn("Enemy prototype module unavailable", error),
          );
      });
    }
    window.addEventListener("resize", () => this.resize());
  }
  instance(
    mesh: T.InstancedMesh,
    i: number,
    x: number,
    y: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
    rx = 0,
    ry = 0,
  ) {
    this.dummy.position.set(x, y, z);
    this.dummy.scale.set(sx, sy, sz);
    this.dummy.rotation.set(rx, ry, 0, "YXZ");
    this.dummy.updateMatrix();
    mesh.setMatrixAt(i, this.dummy.matrix);
  }
  resize() {
    this.viewportWidth = innerWidth;
    this.viewportHeight = innerHeight;
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, 1.5) *
        this.quality *
        this.adaptiveQuality.scale,
    );
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
  private viewportWidth = innerWidth;
  private viewportHeight = innerHeight;
  private clearFoundryWorms() {
    for (const state of this.foundryWorms.values()) state.view?.dispose();
    // A late async result sees its state is no longer in the map and disposes itself.
    this.foundryWorms.clear();
    this.foundryHeadings.clear();
  }
  private foundryHeading(key: string, heading: number, dt: number) {
    const previous = this.foundryHeadings.get(key) ?? heading;
    const difference = Math.atan2(
      Math.sin(heading - previous),
      Math.cos(heading - previous),
    );
    const step =
      Math.sign(difference) *
      Math.min(
        Math.abs(difference) * (1 - Math.exp(-Math.max(0, dt) * 12)),
        Math.max(0, dt) * 4,
      );
    const projected = previous + step;
    this.foundryHeadings.set(key, projected);
    return projected;
  }
  private foundryWorm(id: number) {
    let state = this.foundryWorms.get(id);
    if (!state) {
      const pending: {
        view?: FoundryWormView;
        loading: Promise<void>;
        error?: string;
      } = { loading: Promise.resolve() };
      this.foundryWorms.set(id, pending);
      pending.loading = FoundryWormView.load(FOUNDRY_WORM_ASSET)
        .then((view) => {
          if (this.foundryWorms.get(id) !== pending) {
            view.dispose();
            return;
          }
          view.root.visible = false;
          pending.view = view;
          this.scene.add(view.root);
        })
        .catch((error) => {
          pending.error = String(error);
          console.warn("FOUNDRY ZERO unavailable; using fallback", error);
        });
      state = pending;
    }
    return state;
  }
  private foundryWarning(enemy: Enemy) {
    for (const [part, node] of [enemy, ...(enemy.segments ?? [])].entries()) {
      if (
        !node.pulseAim ||
        node.partHp === 0 ||
        this.foundryWarnings.count >= 640
      )
        continue;
      const origin = foundryLaserOrigin(node, part, enemySize(enemy)),
        target = node.pulseAim;
      const dy = (target.y ?? FOUNDRY_TARGET_HEIGHT) - origin.y;
      const dx = target.x - origin.x,
        dz = target.z - origin.z;
      const charge = T.MathUtils.clamp(
        1 -
          ((node.acidAt ?? this.foundryTime) - this.foundryTime) /
            FOUNDRY_LASER_WARNING,
        0,
        1,
      );
      this.instance(
        this.foundryWarnings,
        this.foundryWarnings.count++,
        (origin.x + target.x) / 2,
        origin.y + dy / 2,
        (origin.z + target.z) / 2,
        0.012 + charge * 0.014,
        0.012 + charge * 0.014,
        Math.hypot(dx, dy, dz),
        -Math.atan2(dy, Math.hypot(dx, dz)),
        Math.atan2(dx, dz),
      );
    }
  }
  render(
    w: World | null,
    id: string,
    dt: number,
    yaw: number,
    pitch: number,
    predict?: { x: number; z: number; y?: number },
    animate = true,
    scoped = false,
    readyAim = false,
  ) {
    if (document.hidden) {
      this.framePacer.reset();
      return;
    }
    const renderDt = this.framePacer.next(dt, this.frameRate);
    if (renderDt === null) return;
    dt = renderDt;
    const local = w?.players.find((p) => p.id === id);
    if (this.adaptiveQuality.update(dt, animate && !!local, this.frameRate))
      this.resize();
    this.combat.detail = this.quality * this.adaptiveQuality.scale;
    this.combat.budget = this.combat.detail < 0.9 ? 120 : 180;
    if (local) this.combat.origin.set(local.x, local.y ?? 0, local.z);
    const droneActive =
      !!this.drone?.enabled && !!local && w?.phase === "battle";
    if (this.drone) {
      this.drone.active = droneActive && animate;
      this.camera.up.set(0, 1, 0);
    }
    if (droneActive) scoped = false;
    const localAim = w && local ? cameraShot(w, local, { yaw, pitch }) : null;
    scoped = scoped && !!local && local.hp > 0 && local.swapCd <= 0;
    const fov = scoped ? SCOPE_FOV : NORMAL_FOV;
    if (this.camera.fov !== fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    const activeMap = mapFor(w ?? {});
    this.terrainWarnings.select(activeMap.blocks);
    this.mapAssets.select(
      VIEW_MAPS.indexOf(activeMap),
      !!w && w.phase !== "lobby",
    );
    const underground = activeMap.biome === "cave";
    this.caveLamp.visible = underground;
    this.caveLamp.position.set(this.cameraAnchor.x, 4, this.cameraAnchor.z);
    for (const light of this.scene.children) {
      if (light instanceof T.HemisphereLight)
        light.intensity = underground ? 1.1 : 1.8;
      if (light instanceof T.DirectionalLight) {
        light.intensity = underground ? 0.3 : 3;
        light.castShadow = !underground;
        if (this.mapAssets.shadowDirty) light.shadow.needsUpdate = true;
      }
    }
    this.mapAssets.shadowDirty = false;
    (this.scene.fog as T.Fog).near = underground ? 12 : 70;
    (this.scene.fog as T.Fog).far = underground ? 48 : 950;
    this.renderer.setClearColor(activeMap.sky);
    (this.scene.fog as T.Fog).color.setHex(activeMap.sky);
    this.fps = this.fps * 0.95 + Math.min(120, 1 / Math.max(dt, 0.001)) * 0.05;
    this.frames.push(dt * 1000);
    if (this.frames.length > 600) this.frames.shift();
    if (w && w.run !== this.run) {
      this.clearFoundryWorms();
      this.foundryTime = w.time;
      this.run = w.run;
      this.lastEvent = 0;
      this.visual.clear();
      this.crawlerAim.clear();
      this.structures.get("crawler")?.controller.states.clear();
      this.combat.clear();
    }
    if (w) {
      this.foundryTime += animate ? Math.max(0, Math.min(0.1, dt)) : 0;
      if (Math.abs(this.foundryTime - w.time) > 0.3) this.foundryTime = w.time;
      const aliveWorms = new Set(
        w.enemies
          .filter((e) => e.kind === "boss" && e.segments)
          .map((e) => e.id),
      );
      for (const [key, state] of this.foundryWorms)
        if (!aliveWorms.has(key)) {
          state.view?.dispose();
          this.foundryWorms.delete(key);
          this.foundryHeadings.delete(String(key));
          for (let part = 0; part < 7; part++)
            this.foundryHeadings.delete(`${key}:segment:${part}`);
        }
    } else this.clearFoundryWorms();
    this.foundryWarnings.count = 0;
    this.defenseVisual.update(w, dt);
    this.calyxEffects.update(w);
    const active = new Set(w?.players.map((p) => p.id));
    for (const [key, m] of this.players)
      if (!active.has(key)) {
        m.userData.disposed = true;
        (m.userData.trooper as StandardTrooper | undefined)?.dispose();
        this.scene.remove(m);
        this.players.delete(key);
      }
    if (w) {
      for (const p of w.players) {
        let m = this.players.get(p.id);
        const target = p.id === id && predict ? predict : p;
        if (!m) {
          m = soldier(p.id === id ? 0xcaa25f : 0x5bbbb1);
          m.position.set(
            target.x,
            (target.y ?? 0) + (p.hp <= 0 ? 0.2 : 0),
            target.z,
          );
          this.players.set(p.id, m);
          this.scene.add(m);
        }
        m.position.lerp(
          new T.Vector3(
            target.x,
            (target.y ?? 0) + (p.hp <= 0 ? 0.2 : 0),
            target.z,
          ),
          1 - Math.exp(-dt * 18),
        );
        const cadence =
          p.id === id
            ? 0
            : local && Math.hypot(p.x - local.x, p.z - local.z) > 25
              ? 1 / 15
              : 1 / 30;
        const state = [
          w.run,
          p.hp <= 0,
          p.slot,
          p.reload > 0,
          p.evade > 0,
          p.swapCd > 0,
        ].join(":");
        m.userData.poseElapsed =
          (m.userData.poseElapsed ?? 0) + (animate ? dt : 0);
        const updatePose =
          !animate ||
          m.userData.poseState !== state ||
          p.cool > (m.userData.poseCool ?? 0) + 0.025 ||
          m.userData.poseElapsed + 1e-6 >= cadence;
        m.rotation.set(0, -p.yaw, 0);
        if (updatePose) {
          poseSoldier(
            m,
            p.id === id && localAim ? { ...p, pitch: localAim.pitch } : p,
            p.id === id && localAim ? localAim.yaw : p.yaw,
            w.time,
            w.run,
            animate ? m.userData.poseElapsed : 0,
            p.id === id && (scoped || readyAim),
          );
          m.userData.poseElapsed = 0;
          m.userData.poseState = state;
          m.userData.poseCool = p.cool;
        }
        m.visible = !(scoped && p.id === id);
        const gun = m.userData.gun as T.Group;
        if (!m.userData.trooper)
          gun.scale.setScalar(
            p.weapons[p.slot].kind === "rocket"
              ? 1.7
              : p.weapons[p.slot].kind === "shotgun"
                ? 1.2
                : 1,
          );
      }
      this.houndVisualInputs.length = 0;
      for (const inputs of this.structureInputs.values()) inputs.length = 0;
      let ai = 0;
      this.bossBody.count = 0;
      let hi = 0;
      let ri = 0,
        bodyCount = 0;
      for (const [kind, mesh] of this.enemies) {
        let n = 0;
        for (const e of w.enemies.filter((e) => e.kind === kind)) {
          const key = String(e.id),
            v = this.visual.get(key) ?? new T.Vector3(e.x, e.y, e.z);
          const moving = Math.hypot(v.x - e.x, v.z - e.z) > 0.015;
          const previousHoundX = v.x,
            previousHoundZ = v.z;
          v.lerp(new T.Vector3(e.x, e.y, e.z), 1 - Math.exp(-dt * 12));
          if (e.kind === "boss" && e.segments) {
            const foundry = this.foundryWorm(e.id);
            if (foundry.view) {
              const projected: Enemy = {
                ...e,
                x: v.x,
                y: e.y,
                z: v.z,
                heading: this.foundryHeading(
                  key,
                  e.heading ?? 0,
                  animate ? dt : 0,
                ),
                segments: e.segments.map((segment, index) => {
                  const segmentKey = `${e.id}:segment:${index}`;
                  const position =
                    this.visual.get(segmentKey) ??
                    new T.Vector3(segment.x, segment.y, segment.z);
                  position.lerp(
                    new T.Vector3(segment.x, segment.y, segment.z),
                    1 - Math.exp(-dt * 12),
                  );
                  position.y = segment.y;
                  this.visual.set(segmentKey, position);
                  return {
                    ...segment,
                    x: position.x,
                    y: position.y,
                    z: position.z,
                    heading: this.foundryHeading(
                      segmentKey,
                      segment.heading ?? 0,
                      animate ? dt : 0,
                    ),
                  };
                }),
              };
              this.visual.set(key, v);
              foundry.view.update(projected, this.foundryTime, (x, z) =>
                groundHeight(x, z, activeMap.blocks),
              );
              this.foundryWarning(projected);
              continue;
            }
            this.foundryWarning(e);
          }
          if (kind === "crawler" && this.houndDebug?.motion)
            this.houndVisualInputs.push({
              id: e.id,
              moving:
                moving &&
                e.active !== false &&
                (e.kind === "crawler" ? !(e.wind > 0) : !e.wind),
              wind: e.wind,
              cool: e.cool,
              distance: Math.hypot(v.x - previousHoundX, v.z - previousHoundZ),
            });
          const inputs = this.structureInputs.get(kind as StructureVisualKind);
          if (inputs && !e.segments)
            inputs.push({
              slot: n,
              calyx: e.calyx,
              worldTime: w.time,
              id: e.id,
              moving:
                moving &&
                e.active !== false &&
                (e.kind === "crawler" ? !(e.wind > 0) : !e.wind),
              wind: e.wind,
              cool: e.cool,
              distance: Math.hypot(v.x - previousHoundX, v.z - previousHoundZ),
            });
          if ((e.perch ?? 0) > 0) v.set(e.x, e.y, e.z);
          else if (e.kind !== "hornet" && !(e.jump ?? 0)) v.y = e.y;
          if (kind === "ant" || kind === "crawler") {
            (
              mesh.geometry.getAttribute("stride") as T.InstancedBufferAttribute
            ).setX(
              n,
              moving &&
                e.active !== false &&
                (e.kind === "crawler" ? !(e.wind > 0) : !e.wind)
                ? 1
                : 0,
            );
            mesh.geometry.getAttribute("stride").needsUpdate = true;
            mesh.userData.gaitClock.value = w.time;
            (
              mesh.geometry.getAttribute("charge") as T.InstancedBufferAttribute
            ).setX(n, e.wind > 0 ? 1 - e.wind / 0.45 : 0);
            mesh.geometry.getAttribute("charge").needsUpdate = true;
          }
          if (kind === "hornet") {
            (
              mesh.geometry.getAttribute("flight") as T.InstancedBufferAttribute
            ).setX(n, (e.perch ?? 0) > 0 ? 0 : 1);
            mesh.geometry.getAttribute("flight").needsUpdate = true;
            mesh.userData.wingClock.value = w.time;
          }
          if (kind === "boss") {
            (
              mesh.geometry.getAttribute("unfold") as T.InstancedBufferAttribute
            ).setX(n, e.phase === 3 && e.wind > 0 ? 1 : 0);
            mesh.geometry.getAttribute("unfold").needsUpdate = true;
          }
          this.visual.set(key, v);
          let crawlerAttacking = false;
          let crawlerAttackYaw: number | undefined;
          if (e.kind === "crawler") {
            const prior = this.crawlerAim.get(e.id);
            const valid = prior && prior.time <= w.time;
            const fired =
              valid &&
              e.wind <= 0 &&
              e.cool > 0.85 &&
              e.cool > prior.cool + 0.4;
            const until =
              e.active === false
                ? 0
                : fired
                  ? w.time + Math.max(0, 0.75 - (1.2 - e.cool))
                  : valid
                    ? prior.until
                    : 0;
            crawlerAttacking =
              e.active !== false && (e.wind > 0 || w.time < until);
            // Hold a direction, not the old target point: movement can cross that point
            // during recovery, which would otherwise turn the whole model backwards.
            const yaw =
              valid &&
              crawlerAttacking &&
              (prior.wind > 0 || (!fired && w.time < prior.until))
                ? prior.yaw
                : Math.atan2(e.tx - e.x, -(e.tz - e.z));
            if (crawlerAttacking) crawlerAttackYaw = yaw;
            this.crawlerAim.set(e.id, {
              cool: e.cool,
              time: w.time,
              until,
              wind: e.wind,
              yaw,
            });
          }
          const t =
            e.wind > 0 || crawlerAttacking
              ? { x: e.tx, z: e.tz }
              : w.players.find(
                  (p) => p.id === e.targetId && p.hp > 0 && p.connected,
                );
          const ya =
            (e.calyx ? Math.PI - e.calyx.yaw : undefined) ??
            crawlerAttackYaw ??
            (e.segments && e.heading !== undefined
              ? Math.PI - e.heading
              : (e.perch ?? 0) > 0
                ? (e.wallYaw ?? 0)
                : t
                  ? Math.atan2(t.x - e.x, -(t.z - e.z))
                  : 0);
          this.instance(
            mesh,
            n,
            v.x +
              ((e.perch ?? 0) > 0
                ? Math.sin(ya) * (ENEMIES[e.kind].radius - 0.15)
                : 0),
            v.y +
              (e.kind === "hornet" && !(e.perch ?? 0) && e.y > 0
                ? Math.sin(w.time * 2 + e.id) * 0.08
                : 0),
            v.z -
              ((e.perch ?? 0) > 0
                ? Math.cos(ya) * (ENEMIES[e.kind].radius - 0.15)
                : 0),
            e.partHp === 0 ? 0 : enemySize(e),
            e.partHp === 0 ? 0 : enemySize(e),
            e.partHp === 0 ? 0 : enemySize(e),
            (e.perch ?? 0) > 0 ? Math.PI / 2 : 0,
            -ya,
          );
          mesh.setColorAt(
            n++,
            new T.Color(
              e.hurt > 0
                ? 0xffe8b0
                : (e.fabrication ?? 0) > 0
                  ? 0x65edff
                  : e.wind > 0
                    ? e.kind === "hornet" && e.wind > 0.4
                      ? 0xffce68
                      : 0xff8866
                    : 0xffffff,
            ),
          );
          if (e.segments) {
            let previous = e;
            for (const [index, segment] of e.segments.entries()) {
              if (segment.partHp === 0) {
                previous = { ...e, ...segment };
                continue;
              }
              // A severed body remains a body in the fallback, too.
              const front = false;
              const segmentKey = `${e.id}:segment:${index}`;
              const position =
                this.visual.get(segmentKey) ??
                new T.Vector3(segment.x, segment.y, segment.z);
              position.lerp(
                new T.Vector3(segment.x, segment.y, segment.z),
                1 - Math.exp(-dt * 12),
              );
              this.visual.set(segmentKey, position);
              const angle = Math.atan2(
                previous.x - segment.x,
                previous.z - segment.z,
              );
              this.instance(
                front ? mesh : this.bossBody,
                front ? n : bodyCount,
                position.x,
                position.y + (front ? 0.35 : 0),
                position.z,
                (front ? 0.55 : 0.92) * enemySize(e),
                (front ? 0.55 : 0.95) * enemySize(e),
                (front ? 0.55 : 0.92) * enemySize(e),
                0,
                (segment.heading ?? angle) + Math.PI,
              );
              (front ? mesh : this.bossBody).setColorAt(
                front ? n++ : bodyCount++,
                new T.Color(e.hurt > 0 ? 0xffe8b0 : 0xc98f6a),
              );
              previous = { ...e, ...segment };
            }
          }
          for (const node of e.segments ? [] : [e]) {
            if (node.pulseAim && node.partHp !== 0)
              this.instance(
                this.rings,
                ri++,
                node.pulseAim.x,
                0.08,
                node.pulseAim.z,
                1,
                1,
                1,
                -Math.PI / 2,
              );
          }
          if (e.wind > 0 && e.kind === "crawler") {
            this.instance(
              this.houndWarnings,
              hi++,
              e.x,
              0.09,
              e.z,
              1,
              1,
              1,
              -Math.PI / 2,
              Math.atan2(-(e.tx - e.x), -(e.tz - e.z)),
            );
          } else if (
            e.wind > 0 &&
            (e.kind === "spitter" || e.kind === "hornet")
          ) {
            const color = new T.Color(
              e.kind === "hornet" && e.wind > 0.4 ? 0xffc46b : 0x65edff,
            );
            for (const [sx, sz] of [
              [1.2, 0.08],
              [0.08, 1.2],
            ]) {
              this.instance(
                this.aimWarnings,
                ai,
                e.tx,
                groundHeight(e.tx, e.tz, activeMap.blocks) + 0.09,
                e.tz,
                sx,
                0.05,
                sz,
              );
              this.aimWarnings.setColorAt(ai++, color);
            }
            const dx = e.tx - e.x,
              dy = groundHeight(e.tx, e.tz, activeMap.blocks) + 1.2 - eye(e),
              dz = e.tz - e.z;
            this.instance(
              this.aimWarnings,
              ai,
              (e.x + e.tx) / 2,
              (eye(e) + groundHeight(e.tx, e.tz, activeMap.blocks) + 1.2) / 2,
              (e.z + e.tz) / 2,
              0.035,
              0.035,
              Math.hypot(dx, dy, dz),
              -Math.atan2(dy, Math.hypot(dx, dz)),
              Math.atan2(dx, dz),
            );
            this.aimWarnings.setColorAt(ai++, color);
          } else if (e.wind > 0 && e.kind !== "calyx") {
            const rad = e.kind === "boss" ? 7 : e.kind === "spitter" ? 2 : 2.5;
            this.instance(
              this.rings,
              ri++,
              e.tx,
              0.08,
              e.tz,
              rad,
              rad,
              1,
              -Math.PI / 2,
            );
          }
        }
        this.bossBody.count = bodyCount;
        syncDynamicInstances(this.bossBody);
        if (this.bossBody.instanceColor)
          this.bossBody.instanceColor.needsUpdate = true;
        mesh.count = n;
        syncDynamicInstances(mesh);
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
      this.aimWarnings.count = ai;
      syncDynamicInstances(this.aimWarnings);
      if (this.aimWarnings.instanceColor)
        this.aimWarnings.instanceColor.needsUpdate = true;
      this.houndWarnings.count = hi;
      syncDynamicInstances(this.houndWarnings);
      this.rings.count = ri;
      syncDynamicInstances(this.rings);
      let projectileCount = 0,
        laserCount = 0;
      w.projectiles.forEach((q) => {
        if (q.style === "laser") {
          const length = Math.max(0.001, Math.hypot(q.dx, q.dy, q.dz));
          const x = q.x - (q.dx / length) * 0.6,
            y = q.y - (q.dy / length) * 0.6,
            z = q.z - (q.dz / length) * 0.6;
          const pitch = -Math.atan2(q.dy, Math.hypot(q.dx, q.dz)),
            yaw = Math.atan2(q.dx, q.dz);
          this.instance(
            this.foundryLasers,
            laserCount,
            x,
            y,
            z,
            0.055,
            0.055,
            1.2,
            pitch,
            yaw,
          );
          this.instance(
            this.foundryLaserGlow,
            laserCount++,
            x,
            y,
            z,
            0.17,
            0.17,
            1.3,
            pitch,
            yaw,
          );
          return;
        }
        const i = projectileCount++;
        this.instance(
          this.projectiles,
          i,
          q.x,
          q.y,
          q.z,
          q.rocket ? 0.14 : q.style === "stake" ? 0.07 : 0.24,
          q.rocket ? 0.14 : q.style === "stake" ? 0.07 : 0.19,
          q.rocket ? 0.5 : q.style === "stake" ? 0.85 : 0.3,
          -Math.atan2(q.dy, Math.hypot(q.dx, q.dz)),
          Math.atan2(q.dx, q.dz),
        );
        this.projectiles.setColorAt(
          i,
          new T.Color(
            q.style === "pollen"
              ? 0xc3a443
              : q.rocket
                ? 0xffbc77
                : q.owner === "enemy"
                  ? 0x65edff
                  : 0xa5e568,
          ),
        );
      });
      this.projectiles.count = projectileCount;
      this.foundryLasers.count = this.foundryLaserGlow.count = laserCount;
      syncDynamicInstances(this.projectiles);
      if (this.projectiles.instanceColor)
        this.projectiles.instanceColor.needsUpdate = true;
      let weaponCount = 0,
        healCount = 0;
      for (const d of w.drops.filter((d) => d.owner === id)) {
        const mesh = d.type === "heal" ? this.healDrops : this.drops;
        const i = d.type === "heal" ? healCount++ : weaponCount++;
        if (i >= mesh.instanceMatrix.count) continue;
        const pos = w.solo ? dropAt(w, d) : { x: d.x, z: d.z, jump: 0 };
        this.instance(
          mesh,
          i,
          pos.x,
          groundHeight(pos.x, pos.z, activeMap.blocks) +
            1 +
            pos.jump +
            Math.sin(w.time * 3) * 0.12,
          pos.z,
          1,
          1,
          1,
          0,
          w.time * 0.7,
        );
      }
      this.drops.count = Math.min(weaponCount, this.drops.instanceMatrix.count);
      this.healDrops.count = Math.min(
        healCount,
        this.healDrops.instanceMatrix.count,
      );
      syncDynamicInstances(this.drops);
      syncDynamicInstances(this.healDrops);
      for (const e of w.events.filter((e) => e.id > this.lastEvent)) {
        this.lastEvent = Math.max(this.lastEvent, e.id);
        this.combat.event(e);
        if (e.type === "kill") {
          for (let n = 0; n < 4 && this.effects.length < 100; n++)
            this.effects.push({
              x: e.x + (Math.random() - 0.5) * 2,
              y: e.y + Math.random() * 2,
              z: e.z + (Math.random() - 0.5) * 2,
              life: 0.45,
              size: 0.5,
            });
        }
        if (e.type === "hit" && e.amount && this.damageNumbers !== "off") {
          const mine = e.owner === id;
          if (mine || this.damageNumbers === "all")
            this.showDamage(e.x, e.y, e.z, e.amount, mine);
        }
        if (e.owner === id || e.type === "down") this.onSound(e.type);
      }
      const p = w.players.find((p) => p.id === id);
      if (p) {
        // Keep the third-person camera anchored to the visual player position.
        // The world updates at 20 Hz; anchoring the camera to the un-smoothed
        // simulation position made the character visibly shake beneath it.
        const rendered = this.players.get(id);
        const pos = rendered
          ? {
              x: rendered.position.x,
              y: rendered.position.y,
              z: rendered.position.z,
            }
          : (predict ?? p);
        this.cameraAnchor.x = pos.x;
        this.cameraAnchor.z = pos.z;
        const { camera } = aimCamera(pos, { yaw, pitch }, mapFor(w).blocks);
        this.camera.position.set(camera.x, camera.y, camera.z);
        // Both ends of the view must use the same interpolated position.
        // A simulation-tick target makes nearby ground jerk while moving.
        const visualAim = cameraShot(w, { ...p, ...pos }, { yaw, pitch });
        this.camera.lookAt(
          visualAim.target.x,
          visualAim.target.y,
          visualAim.target.z,
        );
        this.defenseVisual.camera(w, this.camera);
        if (droneActive) this.drone!.apply(this.camera, pos, dt, animate);
      }
    } else {
      this.run = "";
      this.lastEvent = 0;
      this.visual.clear();
      this.crawlerAim.clear();
      this.structures.get("crawler")?.controller.states.clear();
      this.effects.length = 0;
      for (const f of this.floaters) {
        f.el.remove();
        this.spare.push(f.el);
      }
      this.floaters.length = 0;
      this.houndVisualInputs.length = 0;
      for (const inputs of this.structureInputs.values()) inputs.length = 0;
      this.cameraAnchor.x = this.cameraAnchor.z = 0;
      for (const mesh of this.enemies.values()) mesh.count = 0;
      this.bossBody.count = 0;
      this.foundryLasers.count = this.foundryLaserGlow.count = 0;
      this.aimWarnings.count =
        this.houndWarnings.count =
        this.rings.count =
        this.healDrops.count =
        this.drops.count =
        this.projectiles.count =
          0;
      this.camera.position.set(8, 5.5, 30);
      this.camera.lookAt(-4, 2, -20);
    }
    if (!w) this.combat.clear();
    this.combat.update(animate ? dt : 0, this.camera);
    if (w && animate)
      this.combat.trails(
        w.projectiles.filter((q) => q.style !== "laser"),
        dt,
      );
    for (const beam of [
      this.foundryWarnings,
      this.foundryLasers,
      this.foundryLaserGlow,
    ])
      syncDynamicInstances(beam);
    this.effects.forEach((e, i) => {
      e.life -= dt;
      e.y += dt * 2;
      this.instance(
        this.particles,
        i,
        e.x,
        e.y,
        e.z,
        e.size * e.life,
        e.size * e.life,
        e.size * e.life,
      );
    });
    this.particles.count = this.effects.length;
    syncDynamicInstances(this.particles);
    this.effects = this.effects.filter((e) => e.life > 0);
    this.drawDamage(dt);
    for (const [kind, debug] of this.enemyGlbDebug)
      debug.sync(this.enemies.get(kind as Enemy["kind"])!);
    this.houndDebug?.sync(
      this.enemies.get("crawler")!,
      w ? this.houndVisualInputs : [],
      animate ? dt : 0,
    );
    for (const [kind, motion] of this.structures)
      motion.sync(
        this.enemies.get(kind)!,
        w ? this.structureInputs.get(kind)! : [],
        animate ? dt : 0,
      );
    for (const id of this.crawlerAim.keys()) {
      if (!w?.enemies.some((e) => e.kind === "crawler" && e.id === id))
        this.crawlerAim.delete(id);
    }
    this.spawnEffects.update(w, dt, animate, this.camera);
    this.renderer.render(this.scene, this.camera);
    this.drawCalls = this.renderer.info.render.calls;
    return true;
  }
}
