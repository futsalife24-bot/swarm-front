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
import {
  HARROW,
  harrowDiveRootForTarget,
  queueHarrowMissiles,
  queueHarrowBombs,
  queueHarrowSnipes,
} from "../src/shared/harrow";
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
  sideView = false,
  frontView = false,
  recording = false;
const canvas = document.querySelector("canvas")!;
const saveStatus = document.getElementById("saved")!;
const takeoffVariant = document.getElementById(
  "takeoff-variant",
) as HTMLSelectElement;
const captureMode = () =>
  mode === "takeoff" ? `takeoff-${takeoffVariant.selectedIndex}` : mode;
function captureMetadata() {
  return {
    overview,
    sideView,
    frontView,
    status: JSON.parse(document.getElementById("status")!.textContent!),
  };
}
async function save(
  blob: Blob,
  kind: "image" | "video",
  name: string,
  metadata = captureMetadata(),
) {
  if (location.port !== "5200") {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `harrow-game-${name}.${kind === "image" ? "png" : "webm"}`;
    link.textContent = `生成済みファイルを保存: ${link.download}`;
    saveStatus.replaceChildren(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 300000);
    return;
  }
  const response = await fetch("/__harrow-spin", {
    method: "POST",
    headers: {
      "Content-Type": blob.type,
      "x-harrow-kind": kind,
      "x-harrow-name": name,
      "x-harrow-metadata": encodeURIComponent(JSON.stringify(metadata)),
    },
    body: blob,
  });
  saveStatus.textContent = JSON.stringify(await response.json());
}
function seekSpin(target: number) {
  reset("spin");
  while (w.time < target - 1e-9) {
    const dt = Math.min(0.025, target - w.time);
    step(w, { viewer: neutral() }, dt);
    // Advance the actual animation controller as well as simulation when seeking.
    draw(dt);
  }
  paused = true;
}
document
  .querySelectorAll<HTMLButtonElement>("[data-time]")
  .forEach(
    (button) => (button.onclick = () => seekSpin(Number(button.dataset.time))),
  );
document.getElementById("overview")!.onclick = () => (overview = !overview);
document.getElementById("side-view")!.onclick = () => {
  sideView = !sideView;
  frontView = false;
  overview = true;
};
document.getElementById("front-view")!.onclick = () => {
  frontView = !frontView;
  sideView = false;
  overview = true;
};
document.getElementById("capture")!.onclick = () => {
  draw(0);
  const name = `v14-${captureMode()}-${frontView ? "front" : sideView ? "side" : "high"}-${w.time.toFixed(3).replace(".", "-")}`;
  const metadata = captureMetadata();
  canvas.toBlob((blob) => {
    if (blob) void save(blob, "image", name, metadata);
  }, "image/png");
};
document.getElementById("record")!.onclick = () => {
  if (recording) return;
  reset(mode);
  recording = true;
  const stream = canvas.captureStream(30),
    recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  recorder.onstop = () => {
    for (const track of stream.getTracks()) track.stop();
    void save(
      new Blob(chunks, { type: "video/webm" }),
      "video",
      `v14-${captureMode()}-${frontView ? "front" : sideView ? "side" : "high"}-cycle`,
    );
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
  renderer.structures.get("harrow")?.controller.states.clear();
  w = createWorld(`harrow-${performance.now()}`, 1, 20);
  w.phase = "battle";
  w.wave = 2;
  w.nextSpawn = 1e9;
  const p = addPlayer(w, "viewer");
  Object.assign(p, {
    x: 0,
    y: 0,
    z:
      mode === "encounter" ||
      mode === "missile" ||
      mode === "ground-missile" ||
      mode === "bomb"
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
  if (mode === "flight") {
    e.y = groundHeight(0, 0, mapFor(w).blocks) + HARROW.flightHeight;
    e.harrowAirborne = true;
    e.harrowSwitchAt = 1e9;
    e.harrow = undefined;
  }
  if (["walk", "dash", "snipe", "takeoff", "ground-missile"].includes(mode)) {
    e.y = groundHeight(0, 0, mapFor(w).blocks);
    e.harrowAirborne = false;
    e.harrowSwitchAt = 1e9;
  }
  if (mode === "dash")
    e.harrow = {
      kind: "Dash",
      started: 0,
      fired: false,
      yaw: 0,
      from: { x: 0, y: e.y, z: 0 },
      to: { x: 0, y: e.y, z: HARROW.dashDistance },
    };
  if (mode === "snipe") {
    e.harrow = { kind: "Snipe", started: 0, fired: false, yaw: 0 };
    queueHarrowSnipes(w, e, p);
  }
  if (mode === "missile" || mode === "ground-missile") {
    e.harrow = { kind: "Threat", started: 0, fired: false, yaw: 0 };
    queueHarrowMissiles(w, e, [p]);
  }
  if (mode === "bomb") {
    e.y = groundHeight(0, 0, mapFor(w).blocks) + HARROW.flightHeight;
    e.harrowAirborne = true;
    e.harrow = {
      kind: "BombPass",
      started: 0,
      fired: false,
      yaw: 0,
      from: { x: 0, y: e.y, z: 0 },
      to: { x: 0, y: e.y, z: 80 },
    };
    queueHarrowBombs(w, e, p);
  }
  if (mode === "takeoff")
    e.harrow = {
      kind: "Takeoff",
      started: 0,
      fired: false,
      yaw: 0,
      flapSeed: Number(takeoffVariant.value),
      from: { x: 0, y: e.y, z: 0 },
      to: { x: 0, y: e.y + HARROW.flightHeight, z: 0 },
    };
  if (mode === "spin") {
    e.y = groundHeight(0, 0, mapFor(w).blocks);
    e.harrowAirborne = false;
    e.harrow = { kind: "Spin", started: 0, fired: false, yaw: 0 };
  }
  if (mode === "dive") {
    const blocks = mapFor(w).blocks;
    const root = harrowDiveRootForTarget({ x: p.x, y: p.y ?? 0, z: p.z }, 0);
    root.y = groundHeight(root.x, root.z, blocks);
    e.harrow = {
      kind: "Glide",
      started: 0,
      fired: false,
      yaw: 0,
      from: { x: 0, y: e.y, z: 0 },
      to: root,
    };
  }
  if (mode === "fall")
    hurtEnemy(w, e, e.maxHp * HARROW.staggerFraction, "viewer");
  paused = false;
}
document
  .querySelectorAll<HTMLButtonElement>("[data-mode]")
  .forEach((b) => (b.onclick = () => reset(b.dataset.mode!)));
document.getElementById("pause")!.onclick = () => (paused = !paused);
document.getElementById("seek")!.onclick = () => {
  const target = Math.max(
    0,
    Math.min(
      20,
      Number(
        (document.getElementById("seek-time") as HTMLInputElement).value,
      ) || 0,
    ),
  );
  reset(mode);
  while (w.time < target - 1e-9) {
    const dt = Math.min(0.025, target - w.time);
    step(w, { viewer: neutral() }, dt);
    draw(dt);
  }
  paused = true;
};
document.getElementById("camera")!.onclick = () =>
  (groundCamera = !groundCamera);
document.getElementById("advance")!.onclick = () => {
  paused = true;
  for (let i = 0; i < 10; i++) {
    step(w, { viewer: neutral() }, 0.05);
    draw(0.05);
  }
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
    renderer.camera.position.set(
      e.x + (sideView ? 55 : frontView ? 8 : 43),
      e.y + (sideView || frontView ? 12 : 48),
      e.z + (sideView ? 8 : 52),
    );
    renderer.camera.lookAt(e.x, e.y + (sideView || frontView ? 12 : 1), e.z);
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
      sideView,
      frontView,
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
  const recordEnd: Record<string, number> = {
    spin: 3.2,
    dash: 2.3,
    snipe: 4.2,
    bomb: 4.8,
    takeoff: 4.4,
    dive: 5.0,
    fall: 4.5,
    walk: 8.4,
    encounter: 17,
    flight: 17,
    missile: 7.2,
    "ground-missile": 7.2,
  };
  if (recording && w.time >= (recordEnd[mode] ?? 7.2)) stopRecording?.();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
