import "../style.css";
import "../mobile-ui.css";
import "../menu-ui.css";
import "../menu-theme.css";
import { Controls } from "./input";
import { Renderer } from "./render";
import { Sound } from "./audio";
import {
  defaultLayout,
  parseLayout,
  placeControls,
  updateScopeButtons,
} from "./layout";
import {
  createTrainingWorld,
  resetTargets,
  stepTraining,
} from "../shared/training";
import { stats, STARTERS, type Weapon } from "../shared/defs";
import { fresh, type Save } from "./save";
import { updateCooldowns } from "./hud";
import { installZoomGuard } from "./zoom-guard";
const $ = (id: string) => document.getElementById(id)!;
document.body.dataset.screen = "battle";
document.body.classList.add("training-mode");
const controls = new Controls(),
  view = new Renderer($("world") as HTMLCanvasElement, 120),
  sound = new Sound();
let layout = defaultLayout(),
  world = createTrainingWorld(),
  started = false,
  paused = false;
$("portrait").remove();
installZoomGuard();
$("hud").innerHTML = '<div class="crosshair">+</div>';
$("ui").innerHTML =
  '<section class="training-toolbar"><div><b>訓練射撃場</b><small>固定標的 · 報酬なし</small></div><output id="training-stats">配置を読み込み中…</output><button id="training-reset">標的リセット</button><button id="training-exit">配置設定に戻る</button></section><div id="training-start-panel"><button id="training-start" class="primary" disabled>タップして試し撃ち開始</button><p>移動・照準・射撃・装填・切替・回避を試せます</p></div>';
const exit = () => {
  controls.enabled = false;
  controls.reset();
  if (document.pointerLockElement) document.exitPointerLock();
  parent.postMessage({ type: "training-exit" }, location.origin);
};
$("training-exit").onclick = exit;
$("training-reset").onclick = () => resetTargets(world);
$("training-start").onclick = () => {
  started = true;
  paused = false;
  $("training-start-panel").hidden = true;
  sound.unlock();
  $("controls").hidden = false;
  $("hud").hidden = false;
  $("pause").hidden = false;
};
$("pause").onclick = () => {
  paused = true;
  controls.reset();
  $("training-start-panel").hidden = false;
  $("training-start").textContent = "タップして試し撃ち再開";
};
window.addEventListener("blur", () => {
  if (started) $("pause").click();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && started) $("pause").click();
});
window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") $("pause").click();
});
window.addEventListener("resize", () => placeControls(layout));
window.addEventListener("message", (event) => {
  if (
    event.origin !== location.origin ||
    event.source !== parent ||
    event.data?.type !== "training-start"
  )
    return;
  layout = parseLayout(JSON.stringify(event.data.layout));
  placeControls(layout);
  const config = event.data.config ?? {},
    preferences = { ...fresh(), ...config.preferences } as Save;
  world = createTrainingWorld(
    config.weapons?.length === 2
      ? (config.weapons as Weapon[])
      : STARTERS.slice(0, 2),
  );
  controls.sensitivity = preferences.sensitivity;
  controls.fireSensitivity =
    preferences.fireSensitivity ?? preferences.sensitivity;
  controls.gyroEnabled = preferences.gyroEnabled === true;
  controls.gyroSensitivity = preferences.gyroSensitivity ?? 1;
  sound.volume = preferences.volume;
  view.quality = preferences.quality;
  view.mapAssets.setQuality(preferences.quality);
  view.damageNumbers = preferences.damageNumbers ?? "self";
  view.resize();
  $("training-stats").textContent = "編集途中のボタン配置・濃さで試せます";
  ($("training-start") as HTMLButtonElement).disabled = false;
});
parent.postMessage({ type: "training-ready" }, location.origin);
placeControls(layout);
let previous = performance.now(),
  accumulator = 0;
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - previous) / 1000);
  previous = now;
  const active = started && !paused && !document.hidden;
  controls.enabled = active;
  controls.setScopeAvailable(active);
  updateScopeButtons(layout, {
    visible: started,
    available: controls.scopeAvailable,
    scoped: controls.scoped,
  });
  $("scope-overlay").hidden = !controls.scoped;
  if (active) {
    accumulator += dt;
    while (accumulator >= 0.05) {
      stepTraining(world, controls.read());
      accumulator -= 0.05;
    }
  } else accumulator = 0;
  const p = world.players[0];
  if (started)
    $("training-stats").textContent =
      `${{ rifle: "ライフル", shotgun: "ショットガン", rocket: "ロケット" }[p.weapons[p.slot].kind]}　${p.ammo[p.slot]} / ${stats(p.weapons[p.slot]).mag}　${p.reload > 0 ? "装填中" : "固定標的に射撃"}`;
  updateCooldowns(world, "training", true);
  sound.update(world, "training", controls.input.yaw, active);
  view.render(
    world,
    "training",
    dt,
    controls.input.yaw,
    controls.input.pitch,
    undefined,
    active,
    controls.scoped,
    controls.aiming,
  );
}
requestAnimationFrame(frame);
if (import.meta.env.DEV)
  Object.defineProperty(window, "__training", {
    get: () => {
      const trooper = view.players.get("training")?.userData.trooper;
      return {
        player: structuredClone(world.players[0]),
        aiming: controls.aiming,
        mode: trooper?.mode,
        lower: trooper?.lowerMode,
        aimProgress: trooper?.aimProgress,
        loaded: !!trooper,
      };
    },
  });
