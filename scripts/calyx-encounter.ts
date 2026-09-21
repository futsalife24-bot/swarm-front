import * as T from "three";
import { Renderer } from "../src/client/render";
import { createWorld, addPlayer, spawn } from "../src/shared/game";
import { mapFor, STAGES } from "../src/shared/stages";
import { VIEW_MAPS } from "../src/client/map-assets";
import { supportHeight } from "../src/shared/terrain";
import { encounterCamera } from "../src/client/encounter-camera";
const status = document.querySelector("#status")!,
  button = document.querySelector<HTMLButtonElement>("#record")!;
const film = document.querySelector<HTMLCanvasElement>("#film")!,
  ctx = film.getContext("2d")!;
const view = new Renderer(document.querySelector<HTMLCanvasElement>("#world")!);
const w = createWorld("calyx-film", 1, 1);
w.stage = 7;
w.phase = "battle";
w.nextSpawn = 1e9;
const p = addPlayer(w, "film");
Object.assign(p, { x: 0, z: 38, hp: 10000 });
p.y = supportHeight(p.x, p.z, mapFor(w).blocks);
const e = spawn(w, "calyx", 0, 0)!;
Object.assign(e, {
  heading: 0,
  targetId: p.id,
  tx: p.x,
  tz: p.z,
  cool: 999,
  wind: 0,
});
const errors: string[] = [];
window.addEventListener("error", (e) => errors.push(e.message));
async function prepare() {
  const start = performance.now(),
    map = VIEW_MAPS.indexOf(mapFor(w));
  while (
    !view.structures.get("calyx")?.batch ||
    view.mapAssets.status[map]?.state !== "ready" ||
    view.mapAssets.distantStatus[map]?.state !== "ready"
  ) {
    view.render(w, p.id, 0, 0, 0, undefined, false, false);
    status.textContent = JSON.stringify({
      model: !!view.structures.get("calyx")?.batch,
      map,
      states: view.mapAssets.status,
      distant: view.mapAssets.distantStatus,
    });
    if (performance.now() - start > 60000)
      throw Error("Model/map load timeout");
    await new Promise(requestAnimationFrame);
  }
  view.render(w, p.id, 0, 0, 0, undefined, false, false);
  // Let the arrival dust/rocks finish before freezing the encounter shot.
  for (let i = 0; i < 40; i++)
    view.render(w, p.id, 0.1, 0, 0, undefined, true, false);
  for (const actor of view.players.values()) actor.visible = false;
  view.renderer.setPixelRatio(1);
  view.renderer.setSize(1280, 720, false);
  view.camera.aspect = 1280 / 720;
  view.camera.fov = 55;
  const focus = new T.Vector3(e.x, (e.y ?? 0) + 1.2, e.z),
    front = view.encounterFront(e);
  view.camera.position.copy(focus).addScaledVector(front, 22);
  view.camera.position.y = focus.y + 3;
  view.camera.lookAt(focus);
  view.camera.updateProjectionMatrix();
  await view.renderer.compileAsync(view.scene, view.camera);
  const sample = encounterCamera(view.camera.clone(), focus, front, 8.1),
    idle = view.encounterIdle(e)!;
  const frozen = JSON.stringify(w);
  let origin = performance.now(),
    recording = false,
    recorder: MediaRecorder | undefined,
    chunks: Blob[] = [];
  button.disabled = false;
  status.textContent = "準備完了・作戦7の実ゲーム描画 / GLB 64719fde";
  button.onclick = () => {
    origin = performance.now();
    recording = true;
    chunks = [];
    button.disabled = true;
    recorder = new MediaRecorder(film.captureStream(30), {
      mimeType: "video/webm;codecs=vp9",
      videoBitsPerSecond: 6000000,
    });
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const result = await fetch("/__calyx-film", {
        method: "POST",
        body: blob,
      });
      status.textContent = JSON.stringify({
        saved: result.ok,
        bytes: blob.size,
        worldFrozen: JSON.stringify(w) === frozen,
        errors,
        stage: 7,
        glb: "64719fde1175e427",
        duration: 10,
      });
    };
    recorder.start();
  };
  function frame(now: number) {
    const time = recording ? (now - origin) / 1000 : 0;
    const zoom = T.MathUtils.clamp((time - 0.5) / 1.2, 0, 1),
      smooth = zoom * zoom * (3 - 2 * zoom);
    const pose = sample(smooth);
    view.camera.position.copy(pose.position);
    view.camera.quaternion.copy(pose.quaternion);
    view.camera.fov = T.MathUtils.lerp(55, 40, smooth);
    view.camera.updateProjectionMatrix();
    idle.update(Math.max(0, time - 1.7));
    view.renderer.render(view.scene, view.camera);
    ctx.drawImage(view.renderer.domElement, 0, 0, 1280, 720);
    const bars = T.MathUtils.clamp((time - 0.18) / 0.32, 0, 1);
    ctx.fillStyle = "#05090d";
    ctx.fillRect(0, 0, 1280, 72 * bars);
    ctx.fillRect(0, 720 - 96 * bars, 1280, 96 * bars);
    if (time >= 1.7) {
      ctx.fillStyle = "#d6eee7";
      ctx.font = "bold 44px sans-serif";
      ctx.fillText("CALYX", 64, 126);
      ctx.font = "18px sans-serif";
      ctx.fillText("ANOMALY / 生物型", 66, 157);
      ctx.font = "23px sans-serif";
      ctx.fillText(
        "灰緑と赤茶の蕾。三本のしなやかな根が、その重みを支える。",
        64,
        672,
      );
    }
    if (recording && time >= 10) {
      recording = false;
      recorder?.stop();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
prepare().catch((e) => (status.textContent = String(e)));
