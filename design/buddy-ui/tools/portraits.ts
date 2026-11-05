/**
 * 採用GLB（public/assets/buddy/*.glb）から、UI用の立ち絵を書き出す。
 * 素材の色・形・動作は変更しない。Idle の先頭フレームを斜め前から撮る。
 * 実行は tools/render-portraits.mjs（Playwright）から。window.__render(id) が webp の dataURL を返す。
 */
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { BUDDY_ASSETS, type BuddyKind } from "../../../src/client/buddy-assets";

const SIZE = 320;
const renderer = new T.WebGLRenderer({
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE);
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.setClearColor(0x000000, 0);
document.body.append(renderer.domElement);

async function render(kind: BuddyKind) {
  const scene = new T.Scene();
  scene.add(new T.HemisphereLight(0xdfefff, 0x1a2228, 1.6));
  const key = new T.DirectionalLight(0xffffff, 2.4);
  key.position.set(2, 4, 3);
  scene.add(key);
  const rim = new T.DirectionalLight(0x9fd8ff, 1.2);
  rim.position.set(-3, 2, -2);
  scene.add(rim);
  const gltf = await new GLTFLoader().loadAsync(
    `${import.meta.env.BASE_URL}assets/buddy/${BUDDY_ASSETS[kind].file}`,
  );
  const model = gltf.scene;
  scene.add(model);
  const idle = gltf.animations.find((a) => /idle/i.test(a.name));
  if (idle) {
    const mixer = new T.AnimationMixer(model);
    mixer.clipAction(idle).play();
    mixer.update(0);
  }
  model.updateMatrixWorld(true);
  // 骨の行列は描画時に更新されるため、寸法を測る前に Idle の姿勢へ更新しておく。
  model.traverse((o) => {
    if (o instanceof T.SkinnedMesh) o.skeleton.update();
  });
  const box = new T.Box3().setFromObject(model, true);
  const center = box.getCenter(new T.Vector3());
  const size = box.getSize(new T.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.62;
  const camera = new T.PerspectiveCamera(30, 1, 0.01, 100);
  const dir = new T.Vector3(0.55, 0.28, 1).normalize();
  let dist = radius / Math.sin(T.MathUtils.degToRad(15));
  const target = center.clone();
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(
    (i) =>
      new T.Vector3(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z,
      ),
  );
  // 細長い個体（オリハなど）も枠に収まる大きさへ、投影した外接枠で距離と中心を合わせる。
  for (let i = 0; i < 4; i++) {
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const p = corners.map((c) => c.clone().project(camera));
    const minX = Math.min(...p.map((v) => v.x)),
      maxX = Math.max(...p.map((v) => v.x)),
      minY = Math.min(...p.map((v) => v.y)),
      maxY = Math.max(...p.map((v) => v.y));
    const extent = Math.max(maxX - minX, maxY - minY) / 2;
    const shift = new T.Vector3((minX + maxX) / 2, (minY + maxY) / 2, 0.5)
      .unproject(camera)
      .sub(camera.position)
      .normalize()
      .multiplyScalar(dist);
    target.copy(camera.position).add(shift).addScaledVector(dir, 0);
    dist *= extent / 0.86;
  }
  camera.position.copy(target).addScaledVector(dir, dist);
  camera.lookAt(target);
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL("image/webp", 0.9);
}

(window as unknown as { __render: typeof render }).__render = render;
(window as unknown as { __ready: boolean }).__ready = true;
