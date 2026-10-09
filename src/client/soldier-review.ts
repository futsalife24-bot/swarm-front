import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { loadStandardTrooper, StandardTrooper } from "./standard-trooper";
import { addPlayer, createWorld } from "../shared/game";
import {
  reloadDuration,
  EVADE_DURATION,
  HEAVY_HIT_DURATION,
  WEAPON_SWITCH_DURATION,
} from "../shared/defs";

const status = document.querySelector<HTMLSpanElement>("#status")!;
const renderer = new T.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
document.body.append(renderer.domElement);
const scene = new T.Scene();
scene.background = new T.Color("#16212b");
scene.add(new T.HemisphereLight(0xe8f4ff, 0x55564e, 2.2));
const light = new T.DirectionalLight(0xffffff, 3);
light.position.set(2, 5, -3);
light.castShadow = true;
light.shadow.mapSize.set(2048, 2048);
Object.assign(light.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
light.shadow.normalBias = 0.01;
scene.add(light);
scene.add(light.target);
const floor = new T.Mesh(
  new T.PlaneGeometry(200, 200),
  new T.MeshStandardMaterial({ color: 0x293846, roughness: 1 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.003;
floor.receiveShadow = true;
scene.add(floor);
const grid = new T.GridHelper(14, 28, 0x566875, 0x34434f);
scene.add(grid);
const camera = new T.PerspectiveCamera(40, 1, 0.01, 100);
camera.position.set(0, 2.6, -7);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.85, 0);
controls.update();
function resize() {
  renderer.setSize(
    innerWidth,
    innerHeight - document.querySelector("header")!.clientHeight,
  );
  camera.aspect =
    renderer.domElement.clientWidth / renderer.domElement.clientHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();
const mode = document.querySelector<HTMLSelectElement>("#mode")!,
  weapon = document.querySelector<HTMLSelectElement>("#weapon")!;
let paused = false,
  elapsed = 0,
  last = performance.now(),
  modeTime = 0,
  travel = 0,
  pendingSteps = 0;
const clock = document.querySelector<HTMLOutputElement>("#clock")!;
const speedControl = document.querySelector<HTMLSelectElement>("#speed")!;
document.querySelector("#pause")!.addEventListener("click", (e) => {
  paused = !paused;
  (e.target as HTMLButtonElement).textContent = paused ? "再生" : "一時停止";
});
document.querySelector("#step")!.addEventListener("click", () => {
  paused = true;
  pendingSteps++;
  document.querySelector("#pause")!.textContent = "再生";
});
document.querySelector("#advance")!.addEventListener("click", () => {
  paused = true;
  pendingSteps += 30;
  document.querySelector("#pause")!.textContent = "再生";
});
document.querySelector("#front")!.addEventListener("click", () => {
  controls.target.set(0, 0.85, travel);
  camera.position.set(0, 2.6, travel - 7);
  controls.update();
});
document.querySelector("#side")!.addEventListener("click", () => {
  controls.target.set(0, 0.85, travel);
  camera.position.set(7, 2.6, travel);
  controls.update();
});
document.querySelector("#rear")!.addEventListener("click", () => {
  controls.target.set(0, 0.85, travel);
  camera.position.set(0, 2.6, travel + 7);
  controls.update();
});
document.querySelector("#close")!.addEventListener("click", () => {
  const lowPose = mode.value === "down" || mode.value === "roll";
  controls.target.set(-1.95, lowPose ? 0.35 : 1.1, travel);
  camera.position.set(-1.2, lowPose ? 1.1 : 1.7, travel - 2.5);
  controls.update();
});
mode.addEventListener("change", () => {
  modeTime = 0;
  pendingSteps = 0;
});
weapon.addEventListener("change", () => {
  modeTime = 0;
  pendingSteps = 0;
});
try {
  const assets = await loadStandardTrooper(),
    world = createWorld("soldier-review", 42);
  const actors = Array.from({ length: 4 }, (_, i) => {
    const player = addPlayer(world, `review-${i}`),
      actor = new StandardTrooper(assets);
    actor.model.position.x = (i - 1.5) * 1.3;
    actor.setPlayerAccent(i);
    actor.model.traverse((object) => {
      if (object instanceof T.Mesh) object.castShadow = true;
    });
    scene.add(actor.model);
    return { player, actor };
  });
  status.textContent = `4人・${assets.character.animations.length}動作を読込済み。ゲームと同じ描画処理で検証中`;
  function frame(now: number) {
    const dt =
      pendingSteps > 0
        ? 1 / 60
        : Math.min(0.05, (now - last) / 1000) * Number(speedControl.value);
    last = now;
    if (!paused || pendingSteps > 0) {
      const steps = Math.max(1, pendingSteps);
      for (let step = 0; step < steps; step++) {
        pendingSteps = Math.max(0, pendingSteps - 1);
        elapsed += dt;
        modeTime += dt;
        clock.value = `${modeTime.toFixed(3)}秒`;
        const speed =
          mode.value === "run"
            ? 5
            : mode.value.startsWith("walk")
              ? 1.5
              : mode.value === "back"
                ? -2
                : 0;
        const dz = -speed * dt;
        travel += dz;
        camera.position.z += dz;
        light.position.z += dz;
        light.target.position.z += dz;
        floor.position.z = travel;
        controls.target.z += dz;
        controls.update();
        grid.position.z = Math.round(travel);
        for (const { player: p, actor } of actors) {
          p.weapons[0].kind = weapon.value as (typeof p.weapons)[0]["kind"];
          p.hp = mode.value === "down" ? 0 : 100;
          p.pitch = mode.value === "aim" ? 0.25 : 0;
          // Move the rendered root too: contact locking needs actual world travel.
          p.z = travel;
          actor.model.position.z = travel;
          p.cool =
            mode.value === "fire" || mode.value === "walk-fire"
              ? Math.floor(modeTime * 3) % 2 === 0
                ? 0.25
                : 0
              : 0;
          const reloadSeconds = reloadDuration(p.weapons[p.slot], 0);
          p.reload =
            mode.value === "reload" || mode.value === "walk-reload"
              ? Math.max(0, reloadSeconds - (modeTime % (reloadSeconds + 0.6)))
              : 0;
          // Empty-magazine reload at the weapon's actual duration, followed by
          // a short idle interval so completion and the return pose are visible.
          if (mode.value === "reload" || mode.value === "walk-reload")
            p.ammo[p.slot] = 0;
          p.evade =
            mode.value === "roll"
              ? Math.max(0, EVADE_DURATION - (modeTime % 2))
              : 0;
          p.heavyHit =
            mode.value === "heavy"
              ? Math.max(0, HEAVY_HIT_DURATION - (modeTime % 3))
              : 0;
          if (mode.value === "switch") {
            // Start by selecting the other weapon: a cooldown without a slot
            // change is not a real switch and would test the wrong handoff.
            p.slot = 1 - (Math.floor(modeTime / 2) % 2);
            p.swapCd = Math.max(0, WEAPON_SWITCH_DURATION - (modeTime % 2));
          } else {
            p.slot = 0;
            p.swapCd = 0;
          }
          actor.update(p, 0, elapsed, "review", dt, p, mode.value === "aim");
        }
      }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
} catch (error) {
  status.textContent = `検証失敗: ${String(error)}`;
  console.error(error);
}
