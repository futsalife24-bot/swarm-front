import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CombatEffects } from "../src/client/combat-effects";

async function start() {
  const canvas = document.querySelector("canvas")!;
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.setScissorTest(true);
  const camera = new T.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(3.8, 2.7, 6);
  camera.lookAt(0, 1, 0);
  const scenes = [new T.Scene(), new T.Scene()];
  for (const scene of scenes) {
    scene.background = new T.Color(0x26333b);
    scene.add(new T.HemisphereLight(0xc5e8ff, 0x313323, 2));
    const floor = new T.Mesh(
      new T.PlaneGeometry(30, 30),
      new T.MeshStandardMaterial({ color: 0x596454 }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    scene.add(new T.GridHelper(30, 30, 0x74816c, 0x687666));
  }
  const encoded = (window as Window & { previewModel: string }).previewModel;
  const binary = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const model = await new GLTFLoader().parseAsync(binary.buffer, "");
  const box = new T.Box3().setFromObject(model.scene);
  const size = box.getSize(new T.Vector3());
  const center = box.getCenter(new T.Vector3());
  model.scene.position.sub(center);
  model.scene.scale.setScalar(2.3 / Math.max(size.x, size.y, size.z));
  model.scene.position.multiplyScalar(model.scene.scale.x);
  model.scene.position.y += 1.15;
  scenes.forEach((scene) => scene.add(model.scene.clone(true)));
  const effects = new CombatEffects(scenes[1]);
  const wall = new T.Mesh(
    new T.PlaneGeometry(6, 6),
    new T.MeshBasicMaterial({ color: 0x596771, side: T.DoubleSide }),
  );
  wall.position
    .copy(camera.position)
    .multiplyScalar(0.5)
    .add(new T.Vector3(0, 0.6, 0));
  wall.quaternion.copy(camera.quaternion);
  const fire = () =>
    effects.event({ id: 1, type: "hit", x: 0, y: 1.2, z: 0, amount: 35 });
  let paused = false;
  let last = performance.now();
  let next = 0;
  document.querySelector<HTMLButtonElement>("#pause")!.onclick = (event) => {
    paused = !paused;
    (event.currentTarget as HTMLButtonElement).textContent = paused
      ? "再生"
      : "一時停止";
  };
  document.querySelector<HTMLButtonElement>("#fire")!.onclick = () => {
    effects.clear();
    fire();
  };
  function draw(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) {
      next -= dt;
      if (next <= 0) {
        fire();
        next = 1;
      }
      effects.update(dt, camera);
    }
    const width = canvas.clientWidth,
      height = canvas.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / 2 / height;
    camera.updateProjectionMatrix();
    for (let i = 0; i < 2; i++) {
      renderer.setViewport((i * width) / 2, 0, width / 2, height);
      renderer.setScissor((i * width) / 2, 0, width / 2, height);
      renderer.render(scenes[i], camera);
      if (i === 1)
        (window as Window & { previewCalls?: number }).previewCalls =
          renderer.info.render.calls;
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  (window as Window & { previewReady?: boolean }).previewReady = true;
  (window as Window & { previewFrame?: () => void }).previewFrame = () => {
    paused = true;
    effects.clear();
    fire();
    effects.update(0.08, camera);
  };
  (
    window as Window & { previewWall?: (visible: boolean) => void }
  ).previewWall = (visible) => {
    if (visible) scenes[1].add(wall);
    else scenes[1].remove(wall);
  };
  (window as Window & { previewClear?: () => void }).previewClear = () =>
    effects.clear();
  (
    window as Window & { previewStress?: (count: number) => void }
  ).previewStress = (count) => {
    effects.clear();
    for (let i = 0; i < count; i++) fire();
    effects.update(0.08, camera);
  };
}
start().catch((error) => {
  console.error(error);
  document.body.textContent = "比較画面を読み込めませんでした。";
});
