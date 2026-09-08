import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BLOCKS, ENEMIES } from "../shared/defs";
import {
  wallDistance,
  type Enemy,
  type Player,
  type World,
} from "../shared/game";
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
function bug(kind: Enemy["kind"]) {
  const g = new T.Group();
  const shell =
    kind === "spitter"
      ? 0x789849
      : kind === "boss"
        ? 0x9b584c
        : kind === "hornet"
          ? 0xd8a13c
          : 0x48666b;
  part(g, ico, shell, 0, 1.2, 0.35, 0.85, 0.7, 1.3);
  part(g, ico, 0x172e37, 0, 0.95, -0.9, 0.65, 0.5, 0.65);
  part(g, ico, 0xafd87c, 0, 1.5, 0.6, 0.45, 0.2, 0.75);
  for (const s of [-1, 1]) {
    part(g, ico, 0xffa859, s * 0.35, 1.1, -1.35, 0.16, 0.14, 0.13);
    part(
      g,
      cone,
      0xc9d5b0,
      s * 0.35,
      0.6,
      -1.55,
      0.18,
      0.85,
      0.18,
      -0.9,
      0,
      s * 0.3,
    );
    for (let j = 0; j < 3; j++) {
      part(
        g,
        cylinder,
        0x273e43,
        s * 1.05,
        0.68,
        j * 0.7 - 0.6,
        0.11,
        1.55,
        0.11,
        0,
        0,
        s * 1.1,
      );
      part(
        g,
        cone,
        shell,
        s * 1.65,
        0.3,
        j * 0.8 - 0.6,
        0.13,
        0.9,
        0.13,
        0,
        0,
        -s * 0.35,
      );
    }
  }
  if (kind === "spitter") part(g, ico, 0xe5bd67, 0, 1.6, 0.3, 0.65, 0.8, 0.65);
  if (kind === "hornet") {
    // Wings read as a silhouette from below, which is where it is usually seen.
    for (const s of [-1, 1])
      part(g, box, 0xdfeef2, s * 0.9, 1.45, 0.1, 0.95, 0.05, 0.5, 0, s * 0.25);
    g.scale.setScalar(0.75);
  }
  if (kind === "boss") {
    for (let j = 0; j < 4; j++)
      part(g, cone, 0xf3b174, 0, 2, j * 0.6 - 0.8, 0.36, 1, 0.36);
    g.scale.setScalar(2.6);
  }
  g.updateMatrixWorld(true);
  const geos: T.BufferGeometry[] = [];
  g.traverse((o) => {
    if (o instanceof T.Mesh) {
      const geom = o.geometry.clone().applyMatrix4(o.matrixWorld);
      const colors = new Float32Array(geom.attributes.position.count * 3);
      const c = (o.material as T.MeshStandardMaterial).color;
      for (let i = 0; i < colors.length; i += 3) {
        colors[i] = c.r;
        colors[i + 1] = c.g;
        colors[i + 2] = c.b;
      }
      geom.setAttribute("color", new T.BufferAttribute(colors, 3));
      geos.push(geom.toNonIndexed());
      geom.dispose();
    }
  });
  const merged = mergeGeometries(geos);
  geos.forEach((g) => g.dispose());
  return merged;
}
function soldier(color: number) {
  const g = new T.Group();
  part(g, box, color, 0, 1.05, 0, 0.65, 0.7, 0.36);
  part(g, box, 0x20343c, 0, 0.67, 0, 0.5, 0.28, 0.35);
  part(g, ico, color, 0, 1.62, 0, 0.34, 0.34, 0.3);
  part(g, box, 0x81e9e4, 0, 1.64, -0.25, 0.43, 0.13, 0.09);
  part(g, box, 0x213944, 0, 1.12, 0.28, 0.45, 0.55, 0.22);
  for (const s of [-1, 1]) {
    part(g, box, 0x2a414c, s * 0.2, 0.34, 0, 0.23, 0.58, 0.23);
    part(g, box, 0x152832, s * 0.2, 0.07, -0.08, 0.25, 0.17, 0.43);
    part(g, box, color, s * 0.45, 1.05, -0.15, 0.22, 0.5, 0.25, Math.PI / 4);
    part(g, ico, 0x667984, s * 0.45, 1.35, 0, 0.25, 0.2, 0.27);
  }
  const gun = new T.Group();
  part(gun, box, 0x162a36, 0, 0, 0, 0.18, 0.2, 0.7);
  part(gun, cylinder, 0x8b9ba6, 0, 0, -0.55, 0.065, 0.5, 0.065, Math.PI / 2);
  part(gun, box, 0xe4b15b, 0, 0.1, -0.2, 0.07, 0.07, 0.3);
  gun.position.set(0.45, 1.05, -0.6);
  g.add(gun);
  g.userData.gun = gun;
  return g;
}
export class Renderer {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(65, 1, 0.1, 180);
  renderer: T.WebGLRenderer;
  enemies = new Map<string, T.InstancedMesh>();
  players = new Map<string, T.Group>();
  dummy = new T.Object3D();
  particles: T.InstancedMesh;
  projectiles: T.InstancedMesh;
  drops: T.InstancedMesh;
  rings: T.InstancedMesh;
  effects: { x: number; y: number; z: number; life: number; size: number }[] =
    [];
  traces: { line: T.Line; life: number }[] = [];
  lastEvent = 0;
  run = "";
  visual = new Map<string, T.Vector3>();
  fps = 60;
  quality = 1;
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
    const canvas = this.renderer.domElement,
      w = canvas.clientWidth,
      h = canvas.clientHeight;
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
  frames: number[] = [];
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.setClearColor(0x829ba5);
    this.scene.fog = new T.Fog(0x829ba5, 40, 145);
    this.scene.add(new T.HemisphereLight(0xd8f4fa, 0x26373c, 2.5));
    const sun = new T.DirectionalLight(0xffd8a5, 3);
    sun.position.set(-20, 40, -20);
    this.scene.add(sun);
    const ground = new T.Mesh(
      new T.PlaneGeometry(220, 220),
      material(0x36464c),
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
    const geo = new T.BoxGeometry(1, 1, 1);
    const buildings = new T.InstancedMesh(
      geo,
      material(0x526770),
      BLOCKS.length,
    );
    const windows = new T.InstancedMesh(
      geo,
      new T.MeshBasicMaterial({ color: 0x9db9b7 }),
      BLOCKS.length * 20,
    );
    let wi = 0;
    BLOCKS.forEach((b, i) => {
      this.instance(buildings, i, b.x, b.h / 2, b.z, b.w, b.h, b.d);
      for (let y = 2; y < b.h - 1; y += 3) {
        for (const s of [-1, 1]) {
          this.instance(
            windows,
            wi++,
            b.x + s * (b.w / 2 + 0.01),
            y,
            b.z,
            0.03,
            0.6,
            b.d * 0.7,
          );
        }
      }
      const roof = new T.Mesh(box, material(0x344953));
      roof.position.set(b.x, b.h + 0.5, b.z);
      roof.scale.set(b.w * 0.45, 1, b.d * 0.35);
      this.scene.add(roof);
    });
    windows.count = wi;
    this.scene.add(buildings, windows);
    const lanes = new T.InstancedMesh(box, material(0xc8c8a3), 70);
    let li = 0;
    for (let z = -50; z < 52; z += 5) {
      this.instance(lanes, li++, 0, 0.015, z, 0.16, 0.02, 2.4);
      for (const x of [-10.5, 10.5])
        this.instance(lanes, li++, x, 0.03, z, 0.17, 0.04, 4.8);
    }
    lanes.count = li;
    this.scene.add(lanes);
    const curbs = new T.InstancedMesh(box, material(0x78868a), 40);
    BLOCKS.forEach((b, i) =>
      this.instance(curbs, i, b.x, 0.1, b.z, b.w + 1, 0.2, b.d + 1),
    );
    curbs.count = BLOCKS.length;
    this.scene.add(curbs);
    for (let i = 0; i < 30; i++) {
      const x = (i % 2 ? -1 : 1) * (55 + (i % 3) * 10),
        z = (i - 15) * 8;
      const m = new T.Mesh(box, material(0x657b85));
      m.position.set(x, 8 + (i % 6) * 3, z);
      m.scale.set(10, 16 + (i % 6) * 6, 8);
      this.scene.add(m);
    }
    for (const kind of ["crawler", "spitter", "boss", "hornet"] as const) {
      const mesh = new T.InstancedMesh(
        bug(kind),
        new T.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.8,
          flatShading: true,
        }),
        40,
      );
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      this.enemies.set(kind, mesh);
      this.scene.add(mesh);
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
      new T.MeshBasicMaterial({ color: 0xffcf83 }),
      100,
    );
    this.drops = new T.InstancedMesh(
      new T.OctahedronGeometry(0.55),
      new T.MeshStandardMaterial({
        color: 0x69efcb,
        emissive: 0x2d957e,
        emissiveIntensity: 1,
      }),
      24,
    );
    this.rings = new T.InstancedMesh(
      new T.RingGeometry(0.9, 1, 40),
      new T.MeshBasicMaterial({
        color: 0xff5d4c,
        side: T.DoubleSide,
        transparent: true,
        opacity: 0.75,
      }),
      40,
    );
    this.scene.add(this.particles, this.projectiles, this.drops, this.rings);
    this.resize();
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
    this.dummy.rotation.set(rx, ry, 0);
    this.dummy.updateMatrix();
    mesh.setMatrixAt(i, this.dummy.matrix);
  }
  resize() {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5) * this.quality);
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
  render(
    w: World | null,
    id: string,
    dt: number,
    yaw: number,
    pitch: number,
    predict?: { x: number; z: number },
  ) {
    this.fps = this.fps * 0.95 + Math.min(120, 1 / Math.max(dt, 0.001)) * 0.05;
    this.frames.push(dt * 1000);
    if (this.frames.length > 600) this.frames.shift();
    if (w && w.run !== this.run) {
      this.run = w.run;
      this.lastEvent = 0;
      this.visual.clear();
    }
    const active = new Set(w?.players.map((p) => p.id));
    for (const [key, m] of this.players)
      if (!active.has(key)) {
        this.scene.remove(m);
        this.players.delete(key);
      }
    if (w) {
      for (const p of w.players) {
        let m = this.players.get(p.id);
        const target = p.id === id && predict ? predict : p;
        if (!m) {
          m = soldier(p.id === id ? 0xcaa25f : 0x5bbbb1);
          m.position.set(target.x, p.hp <= 0 ? 0.2 : 0, target.z);
          this.players.set(p.id, m);
          this.scene.add(m);
        }
        m.position.lerp(
          new T.Vector3(target.x, p.hp <= 0 ? 0.2 : 0, target.z),
          1 - Math.exp(-dt * 18),
        );
        m.rotation.set(
          p.hp <= 0 ? Math.PI / 2 : 0,
          -(p.id === id ? yaw : p.yaw),
          0,
        );
        const gun = m.userData.gun as T.Group;
        gun.scale.setScalar(
          p.weapons[p.slot].kind === "rocket"
            ? 1.7
            : p.weapons[p.slot].kind === "shotgun"
              ? 1.2
              : 1,
        );
        if (p.hp > 0) m.position.y = Math.sin(w.time * 13) * 0.035;
      }
      let ri = 0;
      for (const [kind, mesh] of this.enemies) {
        let n = 0;
        for (const e of w.enemies.filter((e) => e.kind === kind)) {
          const key = String(e.id),
            v = this.visual.get(key) ?? new T.Vector3(e.x, e.y, e.z);
          v.lerp(new T.Vector3(e.x, e.y, e.z), 1 - Math.exp(-dt * 12));
          this.visual.set(key, v);
          const t = w.players.reduce<Player | undefined>(
            (a, b) =>
              !a ||
              Math.hypot(a.x - e.x, a.z - e.z) >
                Math.hypot(b.x - e.x, b.z - e.z)
                ? b
                : a,
            undefined,
          );
          const ya = t ? Math.atan2(t.x - e.x, -(t.z - e.z)) : 0;
          this.instance(
            mesh,
            n,
            v.x,
            v.y + Math.sin(w.time * 9 + e.id) * 0.08,
            v.z,
            1,
            1,
            1,
            0,
            -ya,
          );
          mesh.setColorAt(n++, new T.Color(e.hurt > 0 ? 0xffe8b0 : 0xffffff));
          if (e.wind > 0) {
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
        mesh.count = n;
        syncDynamicInstances(mesh);
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
      this.rings.count = ri;
      syncDynamicInstances(this.rings);
      w.projectiles.forEach((q, i) => {
        this.instance(
          this.projectiles,
          i,
          q.x,
          q.y,
          q.z,
          q.rocket ? 0.3 : 0.22,
          q.rocket ? 0.3 : 0.22,
          q.rocket ? 0.3 : 0.22,
        );
        this.projectiles.setColorAt(
          i,
          new T.Color(q.rocket ? 0xffbc77 : 0xa5e568),
        );
      });
      this.projectiles.count = w.projectiles.length;
      syncDynamicInstances(this.projectiles);
      if (this.projectiles.instanceColor)
        this.projectiles.instanceColor.needsUpdate = true;
      w.drops
        .filter((d) => d.owner === id)
        .forEach((d, i) =>
          this.instance(
            this.drops,
            i,
            d.x,
            1 + Math.sin(w.time * 3) * 0.2,
            d.z,
            1,
            1,
            1,
            0,
            w.time,
          ),
        );
      this.drops.count = w.drops.filter((d) => d.owner === id).length;
      syncDynamicInstances(this.drops);
      for (const e of w.events.filter((e) => e.id > this.lastEvent)) {
        this.lastEvent = Math.max(this.lastEvent, e.id);
        if (e.type === "shot" && this.traces.length < 50) {
          const line = new T.Line(
            new T.BufferGeometry().setFromPoints([
              new T.Vector3(e.x, e.y, e.z),
              new T.Vector3(e.tx!, e.ty!, e.tz!),
            ]),
            new T.LineBasicMaterial({
              color: 0xffe5a7,
              transparent: true,
              opacity: 0.7,
            }),
          );
          this.scene.add(line);
          this.traces.push({ line, life: 0.08 });
        }
        if (e.type === "burst" || e.type === "kill") {
          for (
            let n = 0;
            n < (e.type === "burst" ? 10 : 4) && this.effects.length < 100;
            n++
          )
            this.effects.push({
              x: e.x + (Math.random() - 0.5) * 2,
              y: e.y + Math.random() * 2,
              z: e.z + (Math.random() - 0.5) * 2,
              life: 0.45,
              size: e.type === "burst" ? 1.5 : 0.5,
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
          ? { x: rendered.position.x, z: rendered.position.z }
          : (predict ?? p);
        this.cameraAnchor.x = pos.x;
        this.cameraAnchor.z = pos.z;
        const aim = new T.Vector3(
          pos.x + Math.sin(yaw) * 30 * Math.cos(pitch),
          1.5 + Math.sin(pitch) * 30,
          pos.z - Math.cos(yaw) * 30 * Math.cos(pitch),
        );
        const pivot = new T.Vector3(pos.x, 1.9, pos.z);
        const desired = new T.Vector3(
          pos.x - Math.sin(yaw) * 5.2 + Math.cos(yaw) * 0.8,
          2.9 - Math.sin(pitch) * 4,
          pos.z + Math.cos(yaw) * 5.2 + Math.sin(yaw) * 0.8,
        );
        const delta = desired.clone().sub(pivot),
          len = delta.length();
        delta.normalize();
        const wall = wallDistance(
          pivot.x,
          pivot.y,
          pivot.z,
          delta.x,
          delta.y,
          delta.z,
          len,
        );
        desired.copy(pivot).addScaledVector(delta, Math.max(0.2, wall - 0.25));
        this.camera.position.copy(desired);
        this.camera.lookAt(aim);
      }
    } else {
      for (const mesh of this.enemies.values()) mesh.count = 0;
      this.rings.count = this.drops.count = this.projectiles.count = 0;
      this.camera.position.set(8, 5.5, 30);
      this.camera.lookAt(-4, 2, -20);
    }
    for (const tr of this.traces) {
      tr.life -= dt;
      if (tr.life <= 0) {
        this.scene.remove(tr.line);
        tr.line.geometry.dispose();
        (tr.line.material as T.Material).dispose();
      }
    }
    this.traces = this.traces.filter((t) => t.life > 0);
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
    this.renderer.render(this.scene, this.camera);
    this.drawCalls = this.renderer.info.render.calls;
  }
}
