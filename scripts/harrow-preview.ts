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
import { groundHeight } from "../src/shared/terrain";
import { mapFor } from "../src/shared/stages";
const renderer = new Renderer(document.querySelector("canvas")!);
let w: ReturnType<typeof createWorld>,
  paused = false,
  before = performance.now(),
  mode = "encounter",
  groundCamera = false;
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
function frame(now: number) {
  const dt = Math.min(0.05, (now - before) / 1000);
  before = now;
  if (!paused) step(w, { viewer: neutral() }, dt);
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
      missiles: w.harrowMissiles?.length ?? 0,
      model: model?.batch ? "GLB loaded" : model?.error || "loading",
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
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
