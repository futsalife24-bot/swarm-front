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
import {
  clearTutorialLoot,
  placeKillTargets,
  placeSampleDrop,
  prepareTutorialHealth,
  stepTutorial,
  type TutorialArena,
} from "../shared/tutorial";
import {
  TUTORIAL_STEPS,
  TutorialRun,
  lineSeconds,
  type TutorialAction,
  type TutorialDevice,
} from "./tutorial-run";
import { WEAPONS, stats, STARTERS, type Weapon } from "../shared/defs";
import { maxHp, useMedkit } from "../shared/solo-progression";
import { retireEvents } from "../shared/game";
import { fresh, type Save } from "./save";
import { updateCooldowns } from "./hud";
import { installZoomGuard } from "./zoom-guard";
const $ = (id: string) => document.getElementById(id)!;
document.body.dataset.screen = "battle";
document.body.classList.add("training-mode");
const controls = new Controls(),
  view = new Renderer($("world") as HTMLCanvasElement, 120),
  sound = new Sound();
/** 基礎訓練（tutorial-proposal §4-1）。同じ訓練射撃場を、手順つきの訓練として開く。 */
const tutorialMode =
  new URLSearchParams(location.search).get("tutorial") === "1";
const run = tutorialMode ? new TutorialRun() : undefined;
const device: TutorialDevice = matchMedia("(pointer: coarse)").matches
  ? "touch"
  : "pc";
let layout = defaultLayout(),
  world = createTrainingWorld(),
  arena: TutorialArena = "practice",
  started = false,
  paused = false,
  leaving = false;
$("portrait").remove();
installZoomGuard();
$("hud").innerHTML = '<div class="crosshair">+</div>';
$("ui").innerHTML = tutorialMode
  ? `<section class="training-toolbar tutorial-toolbar"><div><b>基礎訓練</b><small id="tutorial-count">報酬なし · 失敗なし</small></div><output id="training-stats" aria-live="polite">読み込み中…</output><button id="tutorial-skip" hidden>この手順を飛ばす</button><button id="tutorial-next" hidden>次へ</button><button id="tutorial-finish" class="primary" hidden>訓練を終える</button></section><div id="training-start-panel"><button id="training-start" class="primary" disabled>訓練を始める</button><p>${TUTORIAL_STEPS[0].title} · ${TUTORIAL_STEPS[0].how[device]}</p><button id="training-exit" hidden>訓練を終了</button></div>`
  : '<section class="training-toolbar"><div><b>訓練射撃場</b><small>固定標的 · 報酬なし</small></div><output id="training-stats">配置を読み込み中…</output><button id="training-reset">標的リセット</button><button id="training-exit">配置設定に戻る</button></section><div id="training-start-panel"><button id="training-start" class="primary" disabled>タップして試し撃ち開始</button><p>移動・照準・射撃・装填・切替・回避を試せます</p></div>';
const exit = (completed = false) => {
  if (leaving) return;
  leaving = true;
  controls.enabled = false;
  controls.reset();
  if (document.pointerLockElement) document.exitPointerLock();
  clearTutorialLoot(world);
  parent.postMessage({ type: "training-exit", completed }, location.origin);
};
function apply(actions: TutorialAction[]) {
  for (const action of actions) {
    if (action.type === "say") sound.controlVoice.request(action.id);
    else if (action.type === "arena") {
      arena = action.arena;
      if (arena === "kill") placeKillTargets(world);
      else if (arena === "drop") placeSampleDrop(world, controls.input.yaw);
      else if (arena === "health") prepareTutorialHealth(world);
      else resetTargets(world);
    }
  }
}
$("training-exit").onclick = () => {
  if (!run) return exit();
  // 一時停止から「訓練を終了」。台詞の長さの見込みだけ待ってから抜ける。
  apply(run.quit());
  const wait = sound.controlVoice.current ? lineSeconds("tut-skip") * 1000 : 0;
  setTimeout(() => exit(), wait);
};
document
  .getElementById("training-reset")
  ?.addEventListener("click", () => resetTargets(world));
document.getElementById("tutorial-skip")?.addEventListener("click", () => {
  if (run) apply(run.skip());
});
document.getElementById("tutorial-next")?.addEventListener("click", () => {
  if (run) apply(run.next());
});
document
  .getElementById("tutorial-finish")
  ?.addEventListener("click", () => exit(true));
$("training-start").onclick = () => {
  started = true;
  paused = false;
  $("training-start-panel").hidden = true;
  sound.unlock();
  $("controls").hidden = false;
  $("hud").hidden = false;
  $("pause").hidden = false;
  // T0「訓練を始める」。音の再生もここで有効になる。
  if (run && !run.started) apply(run.begin());
};
// 蘇生の長押し入力と違い、救急箱は短いタップも1回の操作として受ける。
const medkit = () => {
  if (run?.step.id === "T10" && started && !paused && !document.hidden)
    useMedkit(world);
};
$("revive").addEventListener("pointerdown", medkit);
$("revive").addEventListener("click", (e) => {
  if (e.detail === 0) medkit();
});
$("pause").onclick = () => {
  paused = true;
  controls.reset();
  $("training-start-panel").hidden = false;
  $("training-start").textContent = tutorialMode
    ? "タップして再開"
    : "タップして試し撃ち再開";
  if (tutorialMode) $("training-exit").hidden = false;
};
window.addEventListener("blur", () => {
  if (started) $("pause").click();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && started) $("pause").click();
});
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyH") medkit();
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
  sound.setVolumes(
    preferences.volume,
    preferences.bgmVolume,
    preferences.seVolume,
  );
  view.quality = preferences.quality;
  view.frameRate = preferences.frameRate === 30 ? 30 : 60;
  view.mapAssets.setQuality(preferences.quality);
  view.damageNumbers = preferences.damageNumbers ?? "self";
  view.resize();
  if (run) {
    // 訓練の間は兵士の掛け声を止め、選択中の声の訓練分だけを読み込む（§8-1・§8-4）。
    sound.soldierVoiceEnabled = false;
    void sound.prepareControlScene("training");
    $("training-stats").textContent = "「訓練を始める」で開始します";
  } else
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
      if (run) stepTutorial(world, controls.read(), arena);
      else stepTraining(world, controls.read());
      accumulator -= 0.05;
    }
    if (run) apply(run.observe(world, controls.input.yaw, dt));
  } else accumulator = 0;
  const p = world.players[0];
  if (run && started) {
    $("training-stats").textContent =
      run.text(device) +
      (run.step.id === "T10"
        ? `　HP ${Math.ceil(p.hp)} / ${maxHp(world)}`
        : "");
    $("tutorial-count").textContent =
      run.number > 0 ? `${run.number} / ${run.total}` : "報酬なし · 失敗なし";
    $("tutorial-skip").hidden = !run.canSkip;
    $("tutorial-next").hidden = run.manual !== "next";
    $("tutorial-finish").hidden = run.manual !== "finish";
  } else if (started)
    $("training-stats").textContent =
      `${WEAPONS[p.weapons[p.slot].kind].name}　${p.ammo[p.slot]} / ${stats(p.weapons[p.slot]).mag}　${p.reload > 0 ? "装填中" : "固定標的に射撃"}`;
  updateCooldowns(world, "training", true);
  if (run) {
    const med = $("revive") as HTMLButtonElement;
    med.hidden = run.step.id !== "T10";
    med.disabled =
      !active || !world.solo?.medkit || p.hp <= 0 || p.hp >= maxHp(world);
    med.innerHTML = `<span>救急箱</span><small>${world.solo?.medkit ? "1 / H" : "使用済み"}</small>`;
    med.setAttribute(
      "aria-label",
      world.solo?.medkit ? "救急箱で全快" : "救急箱 使用済み",
    );
  }
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
  retireEvents(
    world,
    Math.min(view.consumed(world.run), sound.consumed(world.run)),
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
