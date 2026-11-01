import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { StructureMotion } from "../src/client/structure-motion";

import {
  createPleat,
  stepPleat,
  type PleatSurface,
} from "../src/shared/pleat-locomotion";
import { surfaceRay } from "../src/shared/surface-ray";
import type { Block } from "../src/shared/map-blocks";

// ?course=slab（既定：壁→天井→薄板の外縁）| yard（生存戦の薄い外壁）| roof（屋上の縁→壁→床）
// ?scale=1.5 で個体サイズ、?speed=3.5 で指示速度を変える。
const query = new URLSearchParams(location.search);
const course = query.get("course") ?? "slab";
const scale = Number(query.get("scale") ?? 1);
const speed = Number(query.get("speed") ?? 1.6);
const courses: Record<
  string,
  { blocks: Block[]; start: { x: number; y: number; z: number } }
> = {
  slab: {
    blocks: [
      { x: 0, z: -5, w: 16, d: 2, h: 8 },
      { x: 0, z: 0, w: 16, d: 8, h: 4.3, terrainBase: 4 },
    ],
    start: { x: 0, y: 0, z: 1 },
  },
  yard: {
    blocks: [{ x: 0, z: 0, w: 16, d: 2, h: 4 }],
    start: { x: 0, y: 0, z: 6 },
  },
  roof: {
    blocks: [{ x: 0, z: 0, w: 12, d: 12, h: 4 }],
    start: { x: 0, y: 4, z: 2 },
  },
};
const blocks = courses[course]?.blocks ?? courses.slab.blocks;
const surface: PleatSurface = {
  ray: (o, d, max) => surfaceRay(o, d, max, blocks),
};
const fresh = () =>
  createPleat(
    courses[course]?.start ?? courses.slab.start,
    { x: 0, y: 0, z: -1 },
    scale,
    surface,
  );
let state = fresh(),
  time = 0,
  running = true,
  follow = false;
const scene = new T.Scene();
scene.background = new T.Color(0x091419);
const renderer = new T.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = T.SRGBColorSpace;
document.body.append(renderer.domElement);
const camera = new T.PerspectiveCamera(46, innerWidth / innerHeight, 0.05, 100);
camera.position.set(15, 7, 10);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 3, -0.5);
controls.enableDamping = true;
scene.add(new T.HemisphereLight(0xdcefff, 0x54705c, 2.6));
const light = new T.DirectionalLight(0xffedc7, 3.2);
light.position.set(8, 12, 5);
scene.add(light);
const floor = new T.Mesh(
  new T.PlaneGeometry(32, 32),
  new T.MeshStandardMaterial({ color: 0x273936, roughness: 0.9 }),
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const grid = new T.GridHelper(32, 32, 0x698a83, 0x3a5750);
grid.position.y = 0.003;
scene.add(grid);
for (const b of blocks) {
  const bottom = b.terrainBase ?? 0;
  const geometry = new T.BoxGeometry(b.w, b.h - bottom, b.d);
  const mesh = new T.Mesh(
    geometry,
    new T.MeshStandardMaterial({
      color: bottom ? 0x41595e : 0x3b4c55,
      roughness: 0.8,
    }),
  );
  mesh.position.set(b.x, (bottom + b.h) / 2, b.z);
  scene.add(mesh);
  const edge = new T.LineSegments(
    new T.EdgesGeometry(geometry),
    new T.LineBasicMaterial({ color: 0x88aaab }),
  );
  edge.position.copy(mesh.position);
  scene.add(edge);
}
const status = document.querySelector<HTMLElement>("#status")!;
const stats = document.querySelector<HTMLElement>("#stats")!;
const play = document.querySelector<HTMLButtonElement>("#play")!;
const motion = new StructureMotion(scene, 1, "crawler");
const source = new T.InstancedMesh(
  new T.SphereGeometry(0.1),
  new T.MeshBasicMaterial(),
  1,
);
source.count = 1;
source.setMatrixAt(0, new T.Matrix4());
source.setColorAt(0, new T.Color(0xffffff));
scene.add(source);
const footMarkers = Array.from({ length: 4 }, () => {
  const mesh = new T.Mesh(
    new T.SphereGeometry(0.035, 8, 6),
    new T.MeshBasicMaterial({ color: 0x80ffd0 }),
  );
  scene.add(mesh);
  return mesh;
});
function advance(seconds: number) {
  for (let elapsed = 0; elapsed < seconds - 1e-8; elapsed += 1 / 60) {
    stepPleat(state, state.forward, speed, 1 / 60, surface);
    time += 1 / 60;
  }
}
function reset() {
  state = fresh();
  time = 0;
  motion.sync(source, [], 0);
  status.textContent = "ドラッグで視点移動・ホイールで拡大";
}
play.onclick = () => {
  running = !running;
  play.textContent = running ? "一時停止" : "再生";
};
document.querySelector<HTMLButtonElement>("#reset")!.onclick = reset;
document.querySelector<HTMLButtonElement>("#step")!.onclick = () => {
  running = false;
  play.textContent = "再生";
  advance(0.25);
};
document.querySelector<HTMLButtonElement>("#follow")!.onclick = (event) => {
  follow = !follow;
  (event.currentTarget as HTMLButtonElement).textContent = follow
    ? "全体表示"
    : "接近表示";
  if (!follow) {
    camera.position.set(15, 7, 10);
    controls.target.set(0, 3, -0.5);
  }
};
document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(
  (button) =>
    (button.onclick = () => {
      reset();
      running = false;
      play.textContent = "再生";
      const target = Number(button.dataset.view);
      while (state.switches < target && time < 45) advance(1 / 60);
      if (state.switches >= target) advance(0.25);
      status.textContent =
        state.switches < target
          ? "この面にはまだ到達できていません。移行状態を確認してください。"
          : "実際の歩行を進めて到達した位置です";
      motion.sync(source, [], 0);
    }),
);
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
motion.loading
  .then(() => {
    if (motion.error) throw new Error(motion.error);
    status.textContent = "ドラッグで視点移動・ホイールで拡大";
  })
  .catch((error) => {
    status.textContent = `モデル読込失敗：${String(error)}`;
  });
let last = performance.now(),
  accumulator = 0;
function render(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (running && motion.batch) {
    accumulator += dt;
    while (accumulator >= 1 / 60) {
      advance(1 / 60);
      accumulator -= 1 / 60;
    }
  }
  motion.setSurroundings(camera.position, blocks);
  motion.sync(
    source,
    [
      {
        id: 1,
        slot: 0,
        moving: state.speed > 0.01,
        wind: 0,
        cool: 0,
        distance: state.speed * dt,
        pleat: state,
      },
    ],
    running ? dt : 0,
  );
  // Feet are placed by the renderer now; show its contacts.
  const contacts = motion.pleatContacts(1);
  footMarkers.forEach((mesh, i) => {
    const foot = contacts?.[i];
    mesh.visible = !!foot;
    if (!foot) return;
    mesh.position.copy(foot.point);
    mesh.material.color.set(foot.planted ? 0x80ffd0 : 0xffb86a);
  });
  if (follow) {
    const target = new T.Vector3(state.body.x, state.body.y, state.body.z);
    const normal = new T.Vector3(
      state.normal.x,
      state.normal.y,
      state.normal.z,
    );
    const forward = new T.Vector3(
      state.forward.x,
      state.forward.y,
      state.forward.z,
    );
    const side = forward.clone().cross(normal).normalize();
    camera.position
      .copy(target)
      .addScaledVector(side, 4)
      .addScaledVector(normal, 2.2)
      .addScaledVector(forward, -1.2);
    controls.target.copy(target);
  }
  controls.update();
  renderer.render(scene, camera);
  const n = state.normal;
  stats.textContent = `経過 ${time.toFixed(2)} 秒　面の移行 ${state.switches} 回　サイズ ${scale}\n面法線 ${n.x.toFixed(2)} / ${n.y.toFixed(2)} / ${n.z.toFixed(2)}　描画 ${renderer.info.render.calls}\n接地（端末側）　${["前左", "前右", "後左", "後右"].map((name, i) => `${name} ${contacts?.[i]?.planted ? "●" : "○"}`).join("　")}\n${state.transfer ? `縁を移行中 ${state.transfer.age.toFixed(2)} / ${state.transfer.duration?.toFixed(2)} 秒` : state.settling ? "新しい面で姿勢を整え中" : "通常歩行"}`;
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
