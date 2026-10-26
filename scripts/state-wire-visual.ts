import { Renderer } from "../src/client/render";
import { StateOmissionCache } from "../src/client/state-omissions";
import { prepareState } from "../src/shared/state-wire";
import { createFrontRun } from "../src/shared/front-run";
import { spawn } from "../src/shared/game";

const run = createFrontRun(
  {
    runId: "wire-visual-fixture",
    seed: 4520,
    mode: "survival",
    fusion: true,
    clearedStage: 1,
    players: [{ id: "viewer" }],
  },
  0,
);
const world = run.world;
const player = world.players[0];
Object.assign(player, { x: 0, y: 0, z: 16, hp: 10000 });
const enemy = spawn(world, "ant", 0, 0)!;
Object.assign(enemy, { x: 0, y: 0, z: 0, active: true, cool: 999 });
world.front!.orbs = [{ id: 9000, x: 1, y: 0, z: 2, value: 2 }];
const baseline = JSON.parse(prepareState(world, 0, {}).packet("viewer")).world;
const cache = new StateOmissionCache();
cache.restore(baseline, undefined);
let shown = baseline;
const renderer = new Renderer(document.querySelector("canvas")!);
let label = "受信前";
const show = (mode: string) => {
  const next = structuredClone(baseline);
  if (mode !== "受信前") {
    next.enemies = [];
    next.front.orbs = [];
  }
  cache.restore(
    next,
    mode === "省略中" ? { enemies: [enemy.id], orbs: [9000] } : undefined,
  );
  shown = next;
  label = mode;
};
document.getElementById("original")!.onclick = () => show("受信前");
document.getElementById("omitted")!.onclick = () => show("省略中");
document.getElementById("removed")!.onclick = () => show("サーバーから消滅");
function frame() {
  renderer.render(shown, "viewer", 1 / 60, 0, 0);
  renderer.camera.position.set(12, 12, 20);
  renderer.camera.lookAt(0, 0, 0);
  renderer.renderer.render(renderer.scene, renderer.camera);
  document.getElementById("status")!.textContent =
    `${label} / 敵 ${shown.enemies.length} / オーブ ${shown.front.orbs.length}`;
  requestAnimationFrame(frame);
}
frame();
