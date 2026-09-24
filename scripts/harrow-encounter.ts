import * as T from "three";
import { Renderer } from "../src/client/render";
import { createWorld, addPlayer, spawn, eye } from "../src/shared/game";
import { HARROW } from "../src/shared/harrow";
import { mapFor } from "../src/shared/stages";
import { VIEW_MAPS } from "../src/client/map-assets";
import { supportHeight } from "../src/shared/terrain";
import {
  encounterCamera,
  harrowEncounterDistance,
} from "../src/client/encounter-camera";

// Uses the production renderer, model adapter and frozen-contact visual clock.
// No save/profile or combat state is advanced by this recording fixture.
const status = document.querySelector("#status")!,
  button = document.querySelector<HTMLButtonElement>("#record")!,
  film = document.querySelector<HTMLCanvasElement>("#film")!,
  ctx = film.getContext("2d")!,
  view = new Renderer(document.querySelector<HTMLCanvasElement>("#world")!);
const world = createWorld("harrow-film-v7", 1, 20);
world.phase = "battle";
world.nextSpawn = 1e9;
world.spawned = 9999;
const soldier = addPlayer(world, "film");
Object.assign(soldier, { x: 0, z: 72, hp: 10000 });
soldier.y = supportHeight(soldier.x, soldier.z, mapFor(world).blocks);
const enemy = spawn(world, "harrow", 0, 0)!;
Object.assign(enemy, { heading: 0, targetId: soldier.id, cool: 999, wind: 0 });
const errors: string[] = [];
window.addEventListener("error", (event) => errors.push(event.message));

async function prepare() {
  const start = performance.now(),
    map = VIEW_MAPS.indexOf(mapFor(world));
  while (
    !view.structures.get("harrow")?.batch ||
    view.mapAssets.status[map]?.state !== "ready" ||
    view.mapAssets.distantStatus[map]?.state !== "ready"
  ) {
    view.render(world, soldier.id, 0, 0, 0, undefined, false, false);
    status.textContent = JSON.stringify({
      model: !!view.structures.get("harrow")?.batch,
      map,
      states: view.mapAssets.status,
    });
    if (performance.now() - start > 90000)
      throw Error("Model/map load timeout");
    await new Promise(requestAnimationFrame);
  }
  const batch = view.structures.get("harrow")!.batch!;
  const flight = batch.asset.clips.find((clip) => clip.name === "Flight")!;
  if (flight.duration < 4.1 || HARROW.scale < 1.9)
    throw Error(
      "HARROW v7 / 3x runtime model is required; refusing to record v6",
    );
  const glbUrl = performance
    .getEntriesByType("resource")
    .find((entry) =>
      /\/harrow_motion_v7\.glb(?:[?#]|$)/.test(entry.name),
    )?.name;
  if (!glbUrl) throw Error("Loaded HARROW v7 resource is not identifiable");
  const resource = await fetch(glbUrl);
  if (!resource.ok) throw Error("Cannot verify loaded HARROW asset");
  const glbSha256 = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await resource.arrayBuffer()),
    ),
  )
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  view.render(world, soldier.id, 0, 0, 0, undefined, false, false);
  for (let i = 0; i < 40; i++)
    view.render(world, soldier.id, 0.1, 0, 0, undefined, true, false);
  for (const actor of view.players.values()) actor.visible = false;
  view.renderer.setPixelRatio(1);
  view.renderer.setSize(1280, 720, false);
  view.camera.aspect = 1280 / 720;
  view.camera.fov = 55;
  const focus = new T.Vector3(enemy.x, eye(enemy), enemy.z),
    front = view.encounterFront(enemy);
  const distance = harrowEncounterDistance(view.camera.aspect);
  view.camera.position.copy(focus).addScaledVector(front, distance * 1.5);
  view.camera.position.y = focus.y - 18;
  view.camera.lookAt(focus);
  view.camera.updateProjectionMatrix();
  await view.renderer.compileAsync(view.scene, view.camera);
  const sample = encounterCamera(
      view.camera.clone(),
      focus,
      front,
      distance,
      0,
    ),
    idle = view.encounterIdle(enemy)!;
  const frozen = JSON.stringify(world);
  let origin = performance.now(),
    recording = false,
    recorder: MediaRecorder | undefined,
    chunks: Blob[] = [];
  button.disabled = false;
  status.textContent = JSON.stringify({
    ready: true,
    version: "v7",
    stage: 20,
    height: enemy.y,
    scale: HARROW.scale,
    flightDuration: flight.duration,
    distance,
  });
  button.onclick = () => {
    origin = performance.now();
    recording = true;
    chunks = [];
    button.disabled = true;
    const mimeType = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ].find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw Error("WebM recording unavailable");
    recorder = new MediaRecorder(film.captureStream(30), {
      mimeType,
      videoBitsPerSecond: 8000000,
    });
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = async () => {
      try {
        const blob = new Blob(chunks, { type: mimeType });
        const metadata = {
          worldFrozen: JSON.stringify(world) === frozen,
          errors,
          stage: 20,
          version: "v7",
          duration: 14,
          height: enemy.y,
          scale: HARROW.scale,
          flightDuration: flight.duration,
          glbUrl,
          glbSha256,
        };
        const result = await fetch("/__harrow-film", {
          method: "POST",
          headers: { "X-Harrow-Metadata": JSON.stringify(metadata) },
          body: blob,
        });
        if (!result.ok) throw Error(`Recording receiver: ${result.status}`);
        status.textContent = JSON.stringify({
          saved: true,
          bytes: blob.size,
          ...metadata,
        });
      } catch (error) {
        status.textContent = String(error);
      }
      button.disabled = false;
    };
    recorder.start();
  };
  function frame(now: number) {
    const time = recording ? (now - origin) / 1000 : 0;
    const zoom = T.MathUtils.clamp((time - 0.5) / 1.2, 0, 1),
      smooth = zoom * zoom * (3 - 2 * zoom),
      pose = sample(smooth);
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
      ctx.font = "bold 40px sans-serif";
      ctx.fillText("HARROW", 52, 52);
      ctx.font = "18px sans-serif";
      ctx.fillText("ANOMALY / 異構型", 270, 48);
      ctx.font = "23px sans-serif";
      ctx.fillText(
        "支柱で組まれた巨大な翼が、空をゆっくりと押し下げる。",
        52,
        671,
      );
    }
    if (recording && time >= 14) {
      recording = false;
      recorder?.stop();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
prepare().catch((error) => {
  status.textContent = String(error);
});
