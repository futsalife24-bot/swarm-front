import { Renderer } from "../src/client/render";
import {
  createWorld,
  addPlayer,
  spawn,
  step,
  neutral,
  hurtEnemy,
  eye,
} from "../src/shared/game";
import { HARROW } from "../src/shared/harrow";
import { harrowSpinRotation } from "../src/shared/harrow-motion";
import { groundHeight } from "../src/shared/terrain";
import { mapFor } from "../src/shared/stages";
const renderer = new Renderer(document.querySelector("canvas")!);
let w: ReturnType<typeof createWorld>,
  paused = false,
  before = performance.now(),
  mode = "encounter",
  groundCamera = false;
let overview = true,
  recording = false;
const canvas = document.querySelector("canvas")!;
const saveStatus = document.getElementById("saved")!;
async function save(blob: Blob, kind: "image" | "video", name: string) {
  const response = await fetch("/__harrow-spin", {
    method: "POST",
    headers: {
      "Content-Type": blob.type,
      "x-harrow-kind": kind,
      "x-harrow-name": name,
      "x-harrow-metadata": encodeURIComponent(
        JSON.stringify({
          overview,
          status: JSON.parse(document.getElementById("status")!.textContent!),
        }),
      ),
    },
    body: blob,
  });
  saveStatus.textContent = JSON.stringify(await response.json());
}
function seekSpin(target: number) {
  reset("spin");
  while (w.time < target - 1e-9)
    step(w, { viewer: neutral() }, Math.min(0.025, target - w.time));
  paused = true;
}
document
  .querySelectorAll<HTMLButtonElement>("[data-time]")
  .forEach(
    (button) => (button.onclick = () => seekSpin(Number(button.dataset.time))),
  );
document.getElementById("overview")!.onclick = () => (overview = !overview);
document.getElementById("capture")!.onclick = () => {
  draw(0);
  canvas.toBlob((blob) => {
    if (blob)
      void save(blob, "image", `spin-${w.time.toFixed(3).replace(".", "-")}`);
  }, "image/png");
};
document.getElementById("record")!.onclick = () => {
  if (recording) return;
  reset("spin");
  recording = true;
  const stream = canvas.captureStream(30),
    recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  recorder.onstop = () => {
    for (const track of stream.getTracks()) track.stop();
    void save(new Blob(chunks, { type: "video/webm" }), "video", "spin-cycle");
  };
  recorder.start();
  stopRecording = () => {
    recorder.stop();
    recording = false;
    paused = true;
  };
};
let stopRecording: (() => void) | undefined;
function reset(value: string) {
  mode = value;
  w = createWorld(`harrow-${performance.now()}`, 1, 20);
  w.phase = "battle";
  w.wave = 2;
  w.nextSpawn = 1e9;
  const p = addPlayer(w, "viewer");
  Object.assign(p, {
    x: 0,
    y: 0,
    z:
      mode === "encounter" || mode === "missile"
        ? 60
        : mode === "walk"
          ? 45
          : 24,
    hp: 10000,
  });
  p.y = groundHeight(p.x, p.z, mapFor(w).blocks);
  const e = spawn(w, "harrow", 0, 0)!;
  Object.assign(e, { active: true, cool: 999, heading: 0 });
  // Freeze campaign spawning, leaving ordinary authority movement/attacks active.
  w.spawned = 9999;
  if (mode === "missile") e.cool = 0;
  if (mode === "walk") {
    e.y = groundHeight(0, 0, mapFor(w).blocks);
    e.harrowAirborne = false;
    e.harrowSwitchAt = 1e9;
  }
  if (mode === "spin") {
    e.y = groundHeight(0, 0, mapFor(w).blocks);
    e.harrowAirborne = false;
    e.harrow = { kind: "Spin", started: 0, fired: false, yaw: 0 };
  }
  if (mode === "dive")
    e.harrow = {
      kind: "Glide",
      started: 0,
      fired: false,
      yaw: 0,
      from: { x: 0, y: e.y, z: 0 },
      to: { x: 0, y: groundHeight(0, 12, mapFor(w).blocks), z: 12 },
    };
  if (mode === "fall")
    hurtEnemy(w, e, e.maxHp * HARROW.staggerFraction, "viewer");
  paused = false;
}
document
  .querySelectorAll<HTMLButtonElement>("[data-mode]")
  .forEach((b) => (b.onclick = () => reset(b.dataset.mode!)));
document.getElementById("pause")!.onclick = () => (paused = !paused);
document.getElementById("camera")!.onclick = () =>
  (groundCamera = !groundCamera);
document.getElementById("advance")!.onclick = () => {
  paused = true;
  for (let i = 0; i < 10; i++) step(w, { viewer: neutral() }, 0.05);
};
reset("encounter");
function draw(dt: number) {
  const e = w.enemies.find((e) => e.kind === "harrow");
  const p = w.players[0];
  const pitch = e
    ? Math.min(
        1.05,
        Math.atan2(eye(e) - (p.y ?? 0) - 1, Math.hypot(e.x - p.x, e.z - p.z)),
      )
    : 0;
  renderer.render(
    w,
    "viewer",
    dt,
    0,
    groundCamera ? -0.35 : pitch,
    undefined,
    !paused,
  );
  if (overview && e) {
    renderer.camera.position.set(e.x + 43, e.y + 48, e.z + 52);
    renderer.camera.lookAt(e.x, e.y + 1, e.z);
    renderer.renderer.render(renderer.scene, renderer.camera);
  }
  const model = renderer.structures.get("harrow");
  document.getElementById("status")!.textContent = JSON.stringify(
    {
      mode,
      time: +w.time.toFixed(2),
      hp: w.players[0].hp,
      height: e?.y,
      scale: HARROW.scale,
      movementSpeed: HARROW.speed,
      attack: e?.harrow?.kind,
      spinRotation:
        e?.harrow?.kind === "Spin"
          ? harrowSpinRotation(w.time - e.harrow.started)
          : null,
      overview,
      paused,
      recording,
      missiles: w.harrowMissiles?.length ?? 0,
      model: model?.batch ? "GLB loaded" : model?.error || "loading",
      assetURL:
        performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((name) => name.includes("harrow_motion_"))
          .at(-1) ?? null,
      clips: model?.batch?.asset.clips.map((c) => c.name),
      drawBatches: model?.batch?.parts.length,
      pose: e ? model?.controller.states.get(e.id) : undefined,
      palettePose: model?.batch
        ? Array.from(model.batch.poseB.array).slice(0, 3)
        : undefined,
    },
    null,
    2,
  );
}
function frame(now: number) {
  const dt = Math.min(0.05, (now - before) / 1000);
  before = now;
  if (!paused) step(w, { viewer: neutral() }, dt);
  draw(dt);
  if (recording && w.time >= 3.2) stopRecording?.();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
