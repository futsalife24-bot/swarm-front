import { Renderer } from "../src/client/render";
import {
  createWorld,
  addPlayer,
  spawn,
  step,
  neutral,
} from "../src/shared/game";
const renderer = new Renderer(document.querySelector("canvas")!);
let w: ReturnType<typeof createWorld>,
  paused = false,
  before = performance.now(),
  mode = "shot";
function reset(value: string) {
  mode = value;
  w = createWorld("preview-" + performance.now(), 1, 1);
  w.phase = "battle";
  w.wave = 1;
  w.nextSpawn = 1e9;
  const p = addPlayer(w, "viewer");
  Object.assign(p, { x: 0, y: 0, z: mode === "slam" ? 2 : 12, hp: 10000 });
  for (let i = 0; i < (mode === "load" ? 8 : 1); i++) {
    const e = spawn(
      w,
      "calyx",
      mode === "load" ? ((i % 4) - 1.5) * 3 : 0,
      mode === "load" ? -Math.floor(i / 4) * 4 : 0,
    )!;
    Object.assign(e, { active: true, cool: mode === "walk" ? 999 : 0 });
  }
  paused = false;
}
for (const key of ["shot", "slam", "walk", "load"])
  document.getElementById(key)!.onclick = () => reset(key);
document.getElementById("pause")!.onclick = () => (paused = !paused);
for (const [id, mode, time] of [
  ["shot-pose", "shot", 1.6],
  ["slam-pose", "slam", 1.05],
  ["cloud-pose", "shot", 5],
] as const) {
  document.getElementById(id)!.onclick = () => {
    reset(mode);
    for (let i = 0; i < Math.round(time / 0.05); i++)
      step(w, { viewer: neutral() }, 0.05);
    paused = true;
  };
}
reset("shot");
const errors: string[] = [];
window.addEventListener("error", (e) => errors.push(e.message));
function frame(now: number) {
  const dt = Math.min(0.05, (now - before) / 1000);
  before = now;
  if (!paused) step(w, { viewer: neutral() }, dt);
  renderer.render(w, "viewer", dt, 0, -0.08, undefined, !paused);
  const structures = (renderer as any).structures as Map<string, any>,
    asset = structures.get("calyx");
  document.getElementById("status")!.textContent = JSON.stringify(
    {
      mode,
      time: +w.time.toFixed(2),
      hp: w.players[0].hp,
      attack: w.enemies[0]?.calyx,
      projectiles: w.projectiles.length,
      clouds: w.pollen?.length ?? 0,
      model: asset?.batch ? "GPU GLB loaded" : asset?.error || "loading",
      bones: asset?.batch?.asset.bones,
      clips: asset?.batch?.asset.clips.map((c: any) => c.name),
      errors,
    },
    null,
    2,
  );
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
