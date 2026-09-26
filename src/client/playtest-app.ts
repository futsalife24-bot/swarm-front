import { backgroundMusic } from "./bgm";
import {
  normalSaveId,
  campaignNumber,
  SOLO_STAGE_IDS,
  validSoloStage,
} from "../shared/campaign";
import "../style.css";
import "../mobile-ui.css";
import "../menu-ui.css";
import "../menu-theme.css";
import "./playtest.css";
import "./gear-weapon-list.css";
import { growthMarkup, bindGrowthUI, growthConfirmation } from "./growth-ui";
import {
  resourceFrame,
  resourceWallet,
  bindResourceHelp,
} from "./resource-frame";
import { menuSamples } from "./menu-samples";
import { homeMarkup } from "./home-screen";
import { openTutorialGuide } from "./tutorial-guide";
import { canInstallApp, installApp } from "./app-install";
import { CHANGELOG } from "./changelog";
import { hudMarkup, updateCooldowns } from "./hud";
import { createPlaytestPreferences } from "./playtest-preferences";
import { FramePacer } from "./frame-pacer";
import { openLayoutEditor } from "./layout-editor";
import * as T from "three";
import { Renderer } from "./render";
import {
  encounterCamera,
  encounterVisible,
  harrowEncounterDistance,
} from "./encounter-camera";
import { prepareBattle } from "./battle-loading";
import { addPlayerNameSetting } from "./player-profile";
import { enhanceGameSelects } from "./game-select";
import { stagePickerLabel, renderStageOption } from "./stage-picker";
import { Controls } from "./input";
import { Sound } from "./audio";
import { Minimap } from "./minimap";
import {
  defaultLayout,
  parseLayout,
  LAYOUT_KEY,
  placeControls,
  updateScopeButtons,
} from "./layout";
import { installLandscapeGuard } from "./landscape";
import { installZoomGuard } from "./zoom-guard";
import { menuDialog } from "./menu-ui";
import { RewardedAdSession, type AdOutcome } from "./rewarded-ad";

import { openBestiary } from "./bestiary";
import { developerProgress } from "./developer-mode";
import {
  developerAuthorized,
  developerRequested,
  openDeveloperLogin,
  exitDeveloperMode,
  checkDeveloperSession,
  returnToNormal,
} from "./developer-access";
import { stageFor, mapFor, troopCount } from "../shared/stages";
import {
  WEAPONS,
  FAMILY_NAMES,
  familyOf,
  stats,
  effectLabel,
  type Family,
  type Kind,
} from "../shared/defs";
import {
  createWorld,
  addPlayer,
  start,
  step,
  finish,
  random,
  eye,
  rayVisible,
  retireEvents,
  type World,
  type Enemy,
} from "../shared/game";
import {
  initSolo,
  maxHp,
  useMedkit,
  reviveSolo,
  collectionStep,
} from "../shared/solo-progression";
import {
  SKILLS,
  GRADES,
  YIELDS,
  VARIANCE_KEYS,
  ACCESSORY_NAMES,
  ACCESSORY_VALUES,
  BRANCH_HINT,
  settings,
  victoryCoins,
  stageLabel,
  missionKey,
  varianceClass,
  varianceMark,
  weaponStatVariance,
  makeWeapon,
  type NewWeapon,
  type StoredWeapon,
  weaponGrade,
  weaponTier,
  type Difficulty,
  type Skill,
  type AccessoryKind,
  type Variances,
} from "../shared/progression";
import {
  loadProgress,
  newSaveKey,
  SaveConflictError,
  initializeProgress,
  persistProgress,
  validateProgress,
  allWeapons,
  soldier,
  spent,
  weaponProtected,
  accessoryProtected,
  canSortie,
  dismantle,
  unlockSkill,
  allocate,
  grantResult,
  appendCollected,
  prepareChoice,
  chooseReward,
  createAccessory,
  synthesize,
  blankLevels,
  type ProgressSave,
  type SaveMode,
} from "./progression-save";
import { recoverUnsavedResult } from "./save-recovery";
import {
  readBattleCheckpoint,
  writeBattleCheckpoint,
  clearBattleCheckpoint,
  type BattleCheckpoint,
} from "./battle-checkpoint";
import { track } from "./analytics";
import {
  installCloudSync,
  admitDailyDefense,
  inspectCloud,
  transferCode,
  syncCloud,
} from "./cloud-save";
import { openCloudSettings, openWeeklyMissions } from "./continuity-ui";
import { WEEKLY_MISSIONS } from "../shared/weekly-missions";
import { japanWeek } from "../shared/calendar";
import { initDailyDefense } from "../shared/daily-defense";
import {
  defenseStage,
  collectDefense,
  settleDefense,
} from "../shared/daily-rewards";
import { gearWeaponRows, lockMarkup } from "./gear-weapon-list";

// Keep the future ad UI private, including in developer mode, until launch.
const SHOW_AD_UI = false;

async function launch(resume?: BattleCheckpoint, daily?: { day: string }) {
  if (sampleMenus || !canSortie(save, stage, difficulty)) return;
  if (!resume) track("sortie");
  const generation = ++loadingGeneration;
  loadReady = false;
  paused = false;
  setScreen("loading");
  const p = soldier(save);
  world = createWorld(
    crypto.randomUUID(),
    crypto.getRandomValues(new Uint32Array(1))[0],
    campaignNumber(stage),
  );
  initSolo(
    world,
    stage,
    difficulty,
    mode === "test",
    p.levels,
    save.accessories.find((a) => a.id === p.accessory),
  );
  world.solo!.acquired = save.serial;
  const actor = addPlayer(
    world,
    "solo",
    p.equipped.map((id) => save.inventory.find((w) => w.id === id)!),
  );
  actor.hp = maxHp(world);
  if (daily) initDailyDefense(world, daily.day);
  if (resume) world = structuredClone(resume.world);
  const tips = [
    "自動回復と回復ドロップを活用しましょう。",
    "街区には、本筋とは違う道があるかもしれません。",
    "装備中の武器とロックした武器は解体から保護されます。",
    "自動回復は最大HPの半分まで。回復品は満タンなら残ります。",
  ];
  ui.innerHTML =
    '<section class="pt-loading"><h1>戦場を準備中</h1><progress id="pt-progress" max="100" value="0"></progress><b id="pt-load-percent">0%</b><p>自動回復と回復ドロップを活用しましょう。</p><p>街区には、本筋とは違う道があるかもしれません。</p><button id="pt-enter" hidden>タップで戦場へ</button><div id="pt-load-error"></div></section>';
  ui.querySelector(".pt-loading p")!.textContent =
    tips[Math.floor(Math.random() * tips.length)];
  ui.querySelectorAll(".pt-loading p")[1]?.remove();
  const progress = (n: number) => {
    if (generation !== loadingGeneration) return;
    ($("pt-progress") as HTMLProgressElement).value = n;
    $("pt-load-percent").textContent = `${n}%`;
  };
  try {
    await prepareBattle(
      view,
      world,
      "solo",
      () => generation !== loadingGeneration || screen !== "loading",
      progress,
    );
    if (generation !== loadingGeneration || screen !== "loading") return;
    loadReady = true;
    $("pt-enter").hidden = false;
    bind("pt-enter", () => {
      void (async () => {
        if (!loadReady || generation !== loadingGeneration) return;
        if (daily) {
          loadReady = false;
          try {
            const granted = await admitDailyDefense(world!.run, daily.day);
            save = loadProgress("normal")!;
            world!.defense!.day = granted.daily!.day;
            world!.solo!.acquired = save.serial;
          } catch (error) {
            loadReady = true;
            $("pt-load-error").textContent = (error as Error).message;
            return;
          }
        }
        if (!resume) start(world!);
        controls.input.yaw = world!.players[0].yaw;
        controls.input.pitch = world!.players[0].pitch;
        accumulator = 0;
        previous = performance.now();
        battleUI();
        checkpointNow();
        if (!resume && !daily)
          tutorial(
            "combat",
            "戦闘の基本",
            "移動しながら照準を合わせて射撃。PCはWASD／マウス、R装填・Q切替・Space回避・Fジャンプ。救急箱はHまたはボタンで全快します。使用すると今回のミッション③は未達成になります。使う必要はありません。",
          );
      })();
    });
  } catch (error) {
    if (generation !== loadingGeneration) return;
    loadReady = false;
    $("pt-load-error").innerHTML =
      `<p>${esc((error as Error).message)}</p><button id="pt-load-retry">再試行</button><button id="pt-load-home">ホームへ戻る</button>`;
    bind("pt-load-retry", () => {
      if (resume) {
        void launch(resume);
        return;
      }
      if (daily) {
        void launch(undefined, daily);
        return;
      }
      sessionStorage.setItem(
        retryKey,
        JSON.stringify({ mode, stage, difficulty }),
      );
      location.reload();
    });
    bind("pt-load-home", () => {
      loadingGeneration++;
      home();
    });
  }
}
function tutorial(id: string, title: string, body: string) {
  if (developerMode || save.tutorials.includes(id)) return;
  const n = structuredClone(save);
  n.tutorials.push(id);
  commit(n, () => {
    const d = dialog(
      title,
      `<p>${esc(body)}</p><button id="pt-tutorial-skip">スキップして続ける</button>`,
    );
    d.querySelector<HTMLButtonElement>("#pt-tutorial-skip")!.onclick = () =>
      d.close();
  });
}
function battleUI(next: "battle" | "collection" = "battle") {
  setScreen(next);
  ui.hidden = true;
  hud.hidden = false;
  $("controls").hidden = false;
  $("minimap").hidden = false;
  $("pause").hidden = false;
  controls.enabled = true;
  $("revive").hidden = false;
}
function pause() {
  if (!["battle", "collection"].includes(screen) || paused) return;
  paused = true;
  controls.reset();
  checkpointNow();
  const d = dialog(
    "一時停止",
    '<button id="pt-resume">タップで再開</button><button id="pt-pause-layout">操作ボタンの配置</button><button id="pt-retire">リタイア</button>',
  );
  view.drone?.mount(d.querySelector<HTMLElement>(".menu-dialog-body")!);
  d.querySelector<HTMLButtonElement>("#pt-pause-layout")!.onclick = () => {
    const previousScreen = screen;
    const collectionNodes =
      previousScreen === "collection" ? [...ui.childNodes] : [];
    const collectionFade = document.querySelector(".pt-fade");
    d.close();
    editControlLayout(() => {
      battleUI(previousScreen === "collection" ? "collection" : "battle");
      if (previousScreen === "collection") {
        ui.replaceChildren(...collectionNodes);
        ui.classList.add("pt-clear");
        ui.hidden = false;
        if (collectionFade) document.body.append(collectionFade);
      }
      paused = false;
      pause();
    });
  };
  d.querySelector<HTMLButtonElement>("#pt-resume")!.onclick = () => d.close();
  d.querySelector<HTMLButtonElement>("#pt-retire")!.onclick = () => {
    confirmAction(
      "リタイア",
      screen === "collection"
        ? "<p>未回収品を残して結果へ進みます。</p>"
        : "<p>敗北として進捗コインを受け取ります。未確定武器は失います。</p>",
      () => {
        d.close();
        screen === "collection" ? endCollection() : defeat();
      },
    );
  };
  d.addEventListener("close", () => {
    paused = false;
  });
}
function defeatChoice() {
  if (screen === "down") return;
  discardCheckpoint();
  setScreen("down");
  header(
    "ダウン",
    `<div class="pt-intro">${SHOW_AD_UI ? `<p>復活成功時はHP50%・2秒無敵。戦況・残弾・救急箱は維持されます。ミッション③は復活後も未達成です。</p><button id="pt-revive" ${mode === "test" && !world!.solo!.revived ? "" : "disabled"}>${mode === "test" ? "テスト広告で復活" : "広告は準備中"}</button>` : ""}<button id="pt-defeat">敗北を確定</button><p id="pt-ad-note"></p></div>`,
    false,
  );
  bind("pt-defeat", defeat);
  bind("pt-revive", () => void requestAd("revive"));
}
async function requestAd(benefit: "revive" | "reward") {
  if (!SHOW_AD_UI || mode !== "test") return;
  const outcome = await adSession.request({
    kind: "development",
    show: (notify) => {
      const d = dialog(
        "テスト広告",
        '<p>実広告ではありません。テストセーブだけに作用します。</p><button data-ad="success">疑似成功</button><button data-ad="cancelled">中断</button><button data-ad="failed">失敗</button><button data-ad="duplicate">成功を二重通知</button>',
      );
      let answered = false;
      d.querySelectorAll<HTMLButtonElement>("[data-ad]").forEach(
        (b) =>
          (b.onclick = () => {
            answered = true;
            const value =
              b.dataset.ad === "duplicate"
                ? "success"
                : (b.dataset.ad as AdOutcome);
            notify(value);
            if (b.dataset.ad === "duplicate") notify("success");
            d.close();
          }),
      );
      d.addEventListener("close", () => {
        if (!answered) notify("cancelled");
      });
    },
  });
  if (outcome === "success") {
    notice = "";
    if (benefit === "revive") {
      if (reviveSolo(world!)) battleUI();
    } else commit(chooseReward(save, true), result);
  } else {
    notice =
      outcome === "cancelled"
        ? "広告を中断しました。再試行できます。"
        : "広告に失敗しました。再試行できます。";
    benefit === "revive" ? ((screen = "battle"), defeatChoice()) : choice();
  }
}
function defeat() {
  if (!world) return;
  if (world.defense) {
    world.phase = "defeat";
    world.reason = "防衛作戦をリタイアしました";
    finishDaily(true);
    return;
  }
  discardCheckpoint();
  finish(world, false, "リタイア／敗北確定");
  const s = world.solo!,
    planned = stageFor(world).waves.reduce(
      (n, w) => n + troopCount(w) + w.bosses.length,
      0,
    ),
    kills = Math.min(planned, s.plannedKills),
    n = grantResult(
      save,
      {
        run: world.run,
        stage: s.stage,
        difficulty: s.difficulty,
        win: false,
        time: world.time,
        kills,
        missions: [false, false, false],
        weapons: [],
        collected: 0,
      },
      () => random(world!),
    );
  if (n !== save) {
    const coins = Math.floor(
      ((victoryCoins(s.stage, s.difficulty) * kills) / Math.max(1, planned)) *
        0.5,
    );
    n.coins += coins;
    n.result!.coins = coins;
  }
  commit(n, result);
}
function victory() {
  if (!world || screen !== "battle") return;
  if (world.defense) {
    finishDaily();
    return;
  }
  track("clear");
  const w = world,
    s = w.solo!,
    missions = [
      true,
      w.time <= settings(s.stage, s.difficulty, w.campaignPlan).timeLimit,
      s.medkit && !s.revived,
    ],
    items = w.rewards.solo as NewWeapon[];
  const n = grantResult(
    save,
    {
      run: w.run,
      stage: s.stage,
      difficulty: s.difficulty,
      win: true,
      time: w.time,
      kills: w.totalKills,
      missions,
      weapons: items,
      collected: w.pending.solo.length,
    },
    () => random(w),
  );
  n.serial = Math.max(n.serial, ...items.map((w) => w.acquired + 1));
  if (s.stage === 3 && s.branchReached) n.branch = true;
  commit(n, () => {
    setScreen("collection");
    ui.classList.add("pt-clear");
    ui.innerHTML =
      '<div class="pt-clear-title">STAGE CLEAR<small>残ったアイテムを回収できます</small></div><button id="pt-end-collection">結果へ</button>';
    $("controls").hidden = false;
    hud.hidden = false;
    $("minimap").hidden = false;
    $("pause").hidden = false;
    bind("pt-end-collection", () => {
      const left = w.drops.filter((d) => d.type !== "heal").length;
      if (left)
        confirmAction(
          "回収を切り上げる",
          `<p>未回収武器 ${left}個を残して結果へ進みます。</p>`,
          endCollection,
        );
      else endCollection();
    });
  });
}
async function openDailyDefense() {
  if (developerMode) {
    message("日替わり防衛は通常プレイで利用してください。");
    return;
  }
  try {
    await syncCloud();
    const code = transferCode();
    if (!code)
      throw Error(
        "日替わり防衛にはクラウド保存が必要です。設定から有効にしてください。",
      );
    const remote = await inspectCloud(code);
    if (remote.daily?.day === remote.day)
      throw Error("今日の防衛作戦は挑戦済みです。日本時間0時に更新されます。");
    // A successful retry resolves the previous admission error, including the
    // cloud-required notice shown before cloud saving was enabled.
    notice = "";
    const status = ui.querySelector(".pt-status");
    if (status) status.textContent = "";
    const d = dialog(
      "日替わり武器庫防衛",
      '<p>3分間、中央の武器庫を守ってください。1日1回、再挑戦はできません。開始時の保証武器と回収済み戦利品は敗北しても残ります。</p><p>読み込み後の「タップで戦場へ」で挑戦権を使います。</p><button id="pt-defense-prepare">現在の装備で準備</button>',
    );
    d.querySelector<HTMLButtonElement>("#pt-defense-prepare")!.onclick = () => {
      if (save.pending.length || save.result?.choice === "pending") {
        message("武器庫の整理と戦果の受取りを完了してください。");
        return;
      }
      stage = normalSaveId(defenseStage(save));
      difficulty = "normal";
      d.close();
      void launch(undefined, { day: remote.day });
    };
  } catch (error) {
    message((error as Error).message);
  }
}
function finishDaily(interrupted = false) {
  if (!world?.defense || screen !== "battle") return;
  const w = world,
    d = w.defense!;
  const outcome = interrupted
    ? "interrupted"
    : w.phase === "victory"
      ? "victory"
      : "defeat";
  const collected = collectDefense(save, w.run, w.pending.solo as NewWeapon[]);
  commit(
    settleDefense(collected, w.run, outcome, d.armory.hp, d.maxHp, () =>
      random(w),
    ),
    () => {
      setScreen("daily-cinematic");
      ui.classList.add("pt-clear");
      const ledger = save.dailyDefense!;
      ui.innerHTML = `<div class="daily-cinematic"><strong>${outcome === "victory" ? "武器庫を守り抜いた" : d.armory.hp <= 0 ? "武器庫が破壊された" : "防衛作戦終了"}</strong></div>`;
      const showResult = () => {
        if (world !== w || screen !== "daily-cinematic") return;
        setScreen("daily-result");
        backgroundMusic().setScreen("result", outcome === "victory");
        const items = allWeapons(save).filter((item) =>
          item.id.startsWith(w.run + "-"),
        );
        header(
          outcome === "victory" ? "武器庫防衛成功" : "武器庫防衛終了",
          `<p>${esc(w.reason)} · 保証1個 / 道中${ledger.collected.length}個 / 追加${ledger.bonus}個${outcome === "defeat" ? " · 武装片5個" : ""}</p><button id="pt-daily-home">ホームへ戻る</button>${gearWeaponRows(items, save, false, new Set())}`,
          false,
        );
        ui.querySelectorAll<HTMLButtonElement>(
          "[data-lock],[data-detail]",
        ).forEach((b) => (b.disabled = true));
        bind("pt-daily-home", home);
      };
      setTimeout(showResult, interrupted ? 0 : 2400);
      void syncCloud();
    },
  );
}
function endCollection() {
  if (!save.result) return;
  commit(
    prepareChoice(save, () => (world ? random(world) : Math.random())),
    choice,
  );
}
function choice() {
  setScreen("choice");
  world = null;
  const r = save.result!;
  header(
    "報酬を受け取る",
    `<div class="pt-intro"><h2>通常武器 ${r.weapons.length}個 · ${resourceFrame("coins", r.coins + r.firstCoins, "gain")}</h2><p>報酬は保存済みです。</p>${SHOW_AD_UI ? `<p>広告成功で武器 ${r.collected + 2}個を追加抽選・毎回 ${resourceFrame("coins", r.coins, "gain")}。初回限定報酬は対象外です。</p>` : ""}<button id="pt-normal-reward" class="primary">受け取る</button>${SHOW_AD_UI ? `<button id="pt-ad-reward" ${mode === "test" ? "" : "disabled"}>${mode === "test" ? "テスト広告で追加報酬" : "広告は準備中"}</button>` : ""}</div>`,
    false,
  );
  bind("pt-normal-reward", () => commit(chooseReward(save, false), result));
  bind("pt-ad-reward", () => void requestAd("reward"));
}
function result() {
  setScreen("result");
  const r = save.result!;
  world = null;
  header(
    r.win ? "戦果" : "敗北",
    `<div class="pt-result"><aside><div class="pt-summary"><span>${Math.floor(r.time)}秒</span><span>${r.kills}撃破</span>${resourceFrame("coins", r.coins * (r.choice === "ad" ? 2 : 1) + r.firstCoins, "gain")}</div><p>${stageLabel(r.stage)} ${r.difficulty === "normal" ? "通常" : "中難易度"}</p><p>${r.missions.map((v, i) => `${i + 1}${v ? "✓" : "○"}`).join("　")}</p>${r.first ? `<p>初達成 ${r.stage === 21 ? `${resourceFrame("coins", 500, "gain")}＋武器3個` : `${resourceFrame("points", 3, "gain")}${r.stage <= 4 && r.difficulty === "normal" ? resourceFrame("materials", 1, "gain") : ""}`}</p>` : ""}<button id="pt-result-home">ホームへ</button><button id="pt-result-retry">出撃準備へ</button></aside><section>${weaponList(r.weapons, "result")}</section></div>`,
    false,
  );
  bindList("result");
  bind("pt-result-home", home);
  bind("pt-result-retry", gear);
}
function report() {
  modalCount++;
  controls.enabled = false;
  openBestiary({
    encounters: save.encounters,
    onClose: () => {
      modalCount--;
      controls.reset();
    },
  });
}
function encounter() {
  if (!world || encounterActive || modalCount) return;
  const soldier = world.players.find((p) => p.id === "solo");
  if (!soldier || soldier.hp <= 0) return;
  for (const e of world.enemies) {
    const key = e.segments ? "worm" : e.kind;
    if (save.encounters[key] === "solo") continue;
    if (view.spawnEffects.active(e.id)) continue;
    // Let the normal renderer place an asynchronously loaded model before freezing it.
    const visual = e.segments
      ? view.foundryWorms.get(e.id)
      : view.structures.get(e.kind);
    if (
      e.segments
        ? !(visual && (("view" in visual && visual.view) || visual.error))
        : !(visual && (("batch" in visual && visual.batch) || visual.error))
    )
      continue;
    const pos = new T.Vector3(e.x, eye(e), e.z),
      projected = pos.clone().project(view.camera);
    if (
      !encounterVisible(
        e.kind,
        projected,
        Math.hypot(e.x - soldier.x, e.z - soldier.z),
        rayVisible(
          e,
          {
            x: view.camera.position.x,
            y: view.camera.position.y - 1.2,
            z: view.camera.position.z,
          },
          mapFor(world).blocks,
        ),
      )
    )
      continue;
    const n = structuredClone(save);
    n.encounters[key] = "solo";
    commit(n, () => {
      // A save conflict opens its own dialog without starting a cutscene.
      encounterActive = true;
      const d = dialog(
        `新たなANOMALYを確認：${names[key]}`,
        '<p>エネミーレポートに記録しました。</p><button id="pt-intro-skip">スキップして戦闘へ</button>',
      );
      d.classList.add("pt-cutscene");
      d.dataset.enemy = key;
      const title = d.querySelector("h2")!;
      const [family, variant] = names[key].split(" / ");
      title.innerHTML =
        key === "worm"
          ? 'FOUNDRY ZERO<span class="pt-intro-variant">連結炉</span>'
          : `${esc(family)}${variant ? `<span class="pt-intro-variant">${esc(variant)}</span>` : ""}`;
      d.querySelector(".eyebrow")!.textContent = "ANOMALY // FIRST CONTACT";
      const oldPosition = view.camera.position.clone(),
        oldQuaternion = view.camera.quaternion.clone(),
        oldFov = view.camera.fov;
      const distance =
        e.kind === "harrow"
          ? harrowEncounterDistance(view.camera.aspect)
          : Math.max(6, (e.size ?? 1) * (e.kind === "boss" ? 12 : 5)) *
            (e.segments ? 1 : 1.35);
      const cameraPose = encounterCamera(
        view.camera.clone(),
        pos,
        view.encounterFront(e),
        distance,
        e.kind === "harrow" ? 0 : 0.14,
      );
      // Keep the rendered world frozen; only the camera moves after the bars enter.
      let elapsed = 0,
        previous = performance.now(),
        animation = 0;
      let idle: ReturnType<Renderer["encounterIdle"]>,
        idleTime = 0;
      const introPacer = new FramePacer();
      const animate = (now: number) => {
        if (!d.open) return;
        const delta = document.hidden ? 0 : Math.min(now - previous, 50);
        elapsed += delta;
        previous = now;
        const bars = Math.min(1, Math.max(0, (elapsed - 180) / 320));
        const zoom = Math.min(1, Math.max(0, (elapsed - 500) / 1200));
        const eased = zoom * zoom * (3 - 2 * zoom);
        d.style.setProperty("--intro-bars", String(bars));
        d.dataset.phase =
          elapsed < 180
            ? "freeze"
            : elapsed < 500
              ? "bars"
              : zoom < 1
                ? "zoom"
                : "text";
        const pose = cameraPose(eased);
        view.camera.position.copy(pose.position);
        view.camera.quaternion.copy(pose.quaternion);
        view.camera.fov = T.MathUtils.lerp(oldFov, 40, eased);
        view.camera.updateProjectionMatrix();
        if (zoom === 1) {
          if (!d.classList.contains("pt-cutscene-ready")) {
            idle = view.encounterIdle(e);
            d.classList.add("pt-cutscene-ready");
            d.querySelector<HTMLButtonElement>("#pt-intro-skip")!.focus({
              preventScroll: true,
            });
          } else idleTime += delta / 1000;
          idle?.update(idleTime);
        }
        if (
          !document.hidden &&
          introPacer.next(delta / 1000, view.frameRate) !== null
        )
          view.renderer.render(view.scene, view.camera);
        animation = requestAnimationFrame(animate);
      };
      d.dataset.phase = "freeze";
      animation = requestAnimationFrame(animate);
      d.querySelector<HTMLButtonElement>("#pt-intro-skip")!.onclick = () =>
        d.close();
      d.addEventListener("close", () => {
        cancelAnimationFrame(animation);
        idle?.restore();
        view.camera.position.copy(oldPosition);
        view.camera.quaternion.copy(oldQuaternion);
        view.camera.fov = oldFov;
        view.camera.updateProjectionMatrix();
        encounterActive = false;
      });
    });
    break;
  }
}
function openDeveloperEntry() {
  if (developerMode) {
    void exitDeveloperMode();
    return;
  }
  if (document.querySelector("#developer-login")) return;
  modalCount++;
  controls.enabled = false;
  openDeveloperLogin("playtest", () => {
    modalCount--;
    controls.reset();
  });
}
function editControlLayout(returnTo: () => void) {
  const weapons = ["battle", "collection"].includes(screen)
    ? world?.players[0]?.weapons
    : save
      ? soldier(save).equipped.map((id) =>
          save.inventory.find((w) => w.id === id)!,
        )
      : undefined;
  setScreen("layout");
  openLayoutEditor(
    ui,
    layout,
    (next) => {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
      layout = next;
      placeControls(layout);
    },
    returnTo,
    {
      config: () => ({
        preferences: preferences.snapshot(),
        weapons,
        solo: true,
      }),
    },
  );
  ui.querySelector('[data-layout-button="revive"]')!.innerHTML =
    "<span>救急箱</span><small>1 / H</small>";
  ui.querySelector('option[value="revive"]')!.textContent = "救急箱";
}
function settingsUI() {
  const d = dialog(
    "設定",
    `<label>音量 <input id="pt-volume" type="range" min="0" max="1" step=".05" value="${sound.volume}"></label><label>描画 <select id="pt-quality"><option value="1">標準</option><option value="0.65">軽量</option></select></label><button id="pt-save-export">現在の保存を書き出す</button>`,
  );
  addPlayerNameSetting(d.querySelector<HTMLElement>(".menu-dialog-body")!);
  const developerEntry = document.createElement("button");
  developerEntry.id = "pt-developer-entry";
  developerEntry.textContent = developerMode
    ? "通常モードへ戻る"
    : "管理者モード";
  developerEntry.className = "settings-developer-entry";
  developerEntry.onclick = () => {
    d.close();
    openDeveloperEntry();
  };
  d.querySelector("#pt-save-export")!.after(developerEntry);
  if (developerMode) {
    const note = document.createElement("p");
    note.textContent =
      "全ステージ・全敵情報・全武器レア度・アクセサリを解放。変更は再読み込みでリセットされ、通常の進行は変更しません。";
    developerEntry.after(note);
  }
  preferences.mount(d, () => {
    const returnTo =
      screen === "gear" ? gear : () => (save ? home() : onboard());
    d.close();
    editControlLayout(returnTo);
  });
  d.querySelector(".menu-dialog-body")!.append(developerEntry);
  d.querySelector("#pt-volume")!.addEventListener(
    "input",
    (e) => (sound.volume = Number((e.target as HTMLInputElement).value)),
  );
  d.querySelector("#pt-quality")!.addEventListener("change", (e) => {
    view.quality = Number((e.target as HTMLSelectElement).value);
    view.mapAssets.setQuality(view.quality);
    view.resize();
  });
  d.querySelector<HTMLButtonElement>("#pt-save-export")!.onclick = () =>
    download(
      new Blob([JSON.stringify(save ?? null, null, 2)]),
      `swarm-front-${mode}.json`,
    );
  if (!developerMode) {
    const cloud = document.createElement("button");
    cloud.id = "pt-cloud-settings";
    cloud.textContent = "クラウド引き継ぎ";
    d.querySelector("#pt-save-export")!.after(cloud);
    cloud.onclick = () => {
      d.close();
      cloudSettingsUI();
    };
  }
}

function cloudSettingsUI() {
  openCloudSettings(dialog, () => {
    loadMode("normal");
  });
}
function weeklyMissionsUI() {
  openWeeklyMissions(dialog, () => {
    save = loadProgress("normal")!;
    home();
  });
}
function updateWeeklyBadge() {
  const button = ui.querySelector<HTMLButtonElement>("#pt-weekly-missions");
  if (!button) return;
  // This is a local display hint; rewards still use the server's week and ledger.
  let count = 0;
  try {
    const weekly = loadProgress("normal")?.weekly;
    if (weekly?.week === japanWeek(Date.now()))
      count = WEEKLY_MISSIONS.filter(
        (mission) =>
          weekly[mission.kind].length >= mission.target &&
          !weekly.claimed.includes(mission.id),
      ).length;
  } catch {
    /* Keep the title usable when save recovery is required. */
  }
  const badge = button.querySelector<HTMLElement>(".weekly-notification")!;
  badge.textContent = String(count);
  badge.hidden = count === 0;
  button.setAttribute(
    "aria-label",
    count ? `週間ミッション、受取可能な報酬${count}件` : "週間ミッション",
  );
}
function generator() {
  if (mode !== "test") return;
  const d = dialog(
    "TEST DATA 指定生成",
    `<label>武器 <select id="pt-gen-kind">${Object.keys(WEAPONS)
      .map((k) => `<option value="${k}">${k}</option>`)
      .join(
        "",
      )}</select></label><label>レア <select id="pt-gen-rarity">${GRADES.map((r, i) => `<option value="${i}">${r}</option>`).join("")}</select></label>${VARIANCE_KEYS.map((k) => `<label>${k} 補正% <input data-variance="${k}" type="number" min="-10" max="20" step="1" value="0"></label>`).join("")}<button id="pt-gen-weapon">武器を生成</button><label>アクセサリ <select id="pt-gen-accessory">${Object.entries(
      ACCESSORY_NAMES,
    )
      .map(([k, v]) => `<option value="${k}">${v}</option>`)
      .join(
        "",
      )}</select></label><label>R <input id="pt-gen-accessory-rarity" type="number" min="1" max="6" value="1"></label><button id="pt-gen-accessory-add">アクセサリを生成</button>`,
  );
  d.querySelector<HTMLButtonElement>("#pt-gen-weapon")!.onclick = () => {
    try {
      const n = structuredClone(save),
        v = Object.fromEntries(
          [...d.querySelectorAll<HTMLInputElement>("[data-variance]")].map(
            (e) => [e.dataset.variance, Number(e.value)],
          ),
        ) as Variances,
        w = makeWeapon(
          `test-${crypto.randomUUID()}`,
          (d.querySelector("#pt-gen-kind") as HTMLSelectElement).value as Kind,
          Number(
            (d.querySelector("#pt-gen-rarity") as HTMLSelectElement).value,
          ),
          v,
          true,
          n.serial++,
        );
      const same = n.inventory.filter((a) => a.kind === w.kind).length;
      if (same < 16 && n.inventory.length < 160) n.inventory.push(w);
      else n.pending.push(w);
      commit(n, () => {
        d.close();
        armory();
      });
    } catch (e) {
      message((e as Error).message);
    }
  };
  d.querySelector<HTMLButtonElement>("#pt-gen-accessory-add")!.onclick = () => {
    const rarity = Number(
      (d.querySelector("#pt-gen-accessory-rarity") as HTMLInputElement).value,
    );
    if (!Number.isInteger(rarity) || rarity < 1 || rarity > 6) return;
    const n = structuredClone(save);
    n.accessories.push({
      id: `test-accessory-${n.serial++}`,
      kind: (d.querySelector("#pt-gen-accessory") as HTMLSelectElement)
        .value as AccessoryKind,
      rarity,
      locked: false,
      testData: true,
    });
    commit(n, () => {
      d.close();
      accessories();
    });
  };
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function shareWeapon(w: StoredWeapon) {
  try {
    const { shareImage } = await import("./weapon-sharing");
    await shareImage(w);
  } catch (e) {
    message((e as Error).message);
  }
}
let previous = performance.now(),
  accumulator = 0;
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0, (now - previous) / 1000));
  previous = now;
  const active = !document.hidden && !paused && !modalCount && !saving;
  controls.enabled = active && (screen === "battle" || screen === "collection");
  controls.setScopeAvailable(controls.enabled && !!world?.players[0]?.hp);
  updateScopeButtons(layout, {
    visible: controls.enabled,
    available: controls.scopeAvailable,
    scoped: controls.scoped,
  });
  $("scope-overlay").hidden = !controls.scoped;
  if (active && world && screen === "battle") {
    accumulator += dt;
    while (
      accumulator >= 0.05 &&
      world.phase === "battle" &&
      world.players[0].hp > 0
    ) {
      const input = controls.read();
      if (input.revive) useMedkit(world);
      step(world, { solo: input });
      accumulator -= 0.05;
    }
    if (world.defense) {
      const ledger = save.dailyDefense;
      const fresh = (world.pending.solo as NewWeapon[]).filter(
        (w) => !ledger?.collected.includes(w.id),
      );
      if (fresh.length && !commit(collectDefense(save, world.run, fresh)))
        return;
      if (world.phase === "victory" || world.phase === "defeat") finishDaily();
    } else if (world.phase === "victory") victory();
    else if (world.players[0].hp <= 0) defeatChoice();
  } else if (active && world && screen === "collection") {
    const before = world.pending.solo.length;
    collectionStep(world, controls.read(), dt);
    if (world.pending.solo.length > before)
      commit(
        appendCollected(save, world.pending.solo.slice(before) as NewWeapon[]),
      );
    if (world.solo!.collection >= 10 && !saving) endCollection();
  } else accumulator = 0;
  if (world && ["battle", "collection"].includes(screen)) {
    const p = world.players[0],
      s = world.solo!,
      cfg = settings(s.stage, s.difficulty, world.campaignPlan),
      warn =
        s.waveCompleteAt !== null && world.wave < stageFor(world).waves.length
          ? cfg.waveWait[world.wave - 1] - (world.time - s.waveCompleteAt)
          : Infinity;
    hud.innerHTML = hudMarkup(
      world,
      "solo",
      [
        p.swapCd > 0 ? "切替中" : "",
        s.branchReached ? "クリアで分岐解放" : "",
        warn <= 10 ? `増援まで ${Math.ceil(warn)}秒` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      maxHp(world),
      world.defense
        ? `防衛 ${Math.max(0, Math.ceil(world.defense.duration - world.time))}秒 · 武器庫 ${Math.ceil(world.defense.armory.hp)} / ${world.defense.maxHp}`
        : s.waveCompleteAt !== null && Number.isFinite(warn)
          ? `次波まで ${Math.max(0, Math.ceil(warn))}秒`
          : undefined,
    );
    updateCooldowns(world, "solo", true);
    const med = $("revive") as HTMLButtonElement;
    med.disabled = !s.medkit || p.hp <= 0 || p.hp >= maxHp(world);
    med.innerHTML = `<span>救急箱</span><small>${s.medkit ? "1 / H" : "使用済み"}</small>`;
    med.setAttribute(
      "aria-label",
      s.medkit ? "救急箱で全快" : "救急箱 使用済み",
    );
    hud.querySelector(".pc-help")!.textContent =
      "WASD 移動 · マウス 照準/射撃 · R 装填 · Q 切替 · SPACE 回避 · F ジャンプ · H 救急箱";
    minimap.draw(world, "solo", controls.input.yaw, now);
  }
  sound.update(
    world,
    "solo",
    controls.input.yaw,
    active && screen === "battle",
  );
  const rendered =
    !encounterActive &&
    view.render(
      world,
      "solo",
      dt,
      controls.input.yaw,
      controls.input.pitch,
      undefined,
      active && (screen === "battle" || screen === "collection"),
      controls.scoped,
      controls.aiming,
    );
  // Only what both the picture and the sound have taken is retired, so an
  // introduction that skips drawing keeps its events for the next frame.
  if (world)
    retireEvents(
      world,
      Math.min(view.consumed(world.run), sound.consumed(world.run)),
    );
  // A new spawn must exist in the scene before the camera freezes for its introduction.
  if (rendered && active && screen === "battle" && !encounterActive)
    encounter();
}

const $ = (id: string) => document.getElementById(id)!;
const esc = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const ui = $("ui"),
  hud = $("hud"),
  controls = new Controls(),
  view = new Renderer($("world") as HTMLCanvasElement, 120),
  sound = new Sound(),
  minimap = new Minimap();
document.body.classList.add("playtest");
void document.fonts.load('700 32px "Rajdhani"').catch(() => {});
let mode: SaveMode = "normal",
  save!: ProgressSave,
  world: World | null = null,
  screen = "home",
  stage = 1,
  difficulty: Difficulty = "normal",
  paused = false,
  modalCount = 0,
  loadingGeneration = 0,
  notice = "",
  saving: ProgressSave | undefined,
  retryAfter: (() => void) | undefined;
const developerMode = developerAuthorized && developerRequested;
const retryKey = developerMode
  ? "swarm-front-developer-retry"
  : "swarm-front-playtest-retry";
const sampleMenus =
  developerMode &&
  new URLSearchParams(location.search).get("menuSample") === "1";
let gearOrganizing = false;
let selectedGearSlot = 0;
let armoryKind: Family | null = null;
const weaponGenres: Record<Family, string> = FAMILY_NAMES;
let filter = "all",
  sort = "acquired",
  rarityFilter = "all",
  favoritesOnly = false,
  checked = new Set<string>(),
  listScroll = 0,
  perfScroll = 0,
  encounterActive = false,
  loadReady = false;
const adSession = new RewardedAdSession();
const names: Record<Enemy["kind"] | "worm", string> = {
  harrow: "HARROW",
  calyx: "CALYX",
  crawler: "PLEAT",
  ant: "HOUND / VOLLEY",
  spider: "HOUND / LEAPER",
  spitter: "PRISM",
  hornet: "RAY",
  boss: "FOUNDRY ZERO",
  worm: "FOUNDRY ZERO 連結炉",
};
const preferences = createPlaytestPreferences(controls, sound, view, minimap);
installZoomGuard();
installLandscapeGuard(() => pause());
let layout = defaultLayout();
try {
  layout = parseLayout(localStorage.getItem(LAYOUT_KEY));
} catch {
  /* Keep default controls if old layout is unreadable. */
}
placeControls(layout);
window.addEventListener("resize", () => {
  view.resize();
  placeControls(layout);
});
window.addEventListener("blur", () => pause());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
document.addEventListener("click", () => sound.unlock(), true);
$("pause").onclick = () => pause();
document.addEventListener("keydown", (e) => {
  if (
    e.code === "KeyH" &&
    screen === "battle" &&
    !paused &&
    !modalCount &&
    world
  )
    useMedkit(world);
  if (e.code === "Escape" && screen === "battle") pause();
});
function bind(id: string, fn: () => void) {
  const e = document.getElementById(id);
  if (e)
    e.onclick = () => {
      try {
        fn();
      } catch (error) {
        message((error as Error).message);
      }
    };
}
function message(text: string) {
  notice = text;
  const node = ui.querySelector(".pt-status");
  if (node) node.textContent = text;
  else dialog("お知らせ", `<p>${esc(text)}</p>`);
}
function dialog(title: string, content: string) {
  modalCount++;
  controls.enabled = false;
  const d = menuDialog(esc(title), content, "SWARM FRONT");
  d.addEventListener("close", () => {
    modalCount--;
    controls.reset();
  });
  return d;
}
function confirmAction(title: string, content: string, action: () => void) {
  const d = dialog(
    title,
    `${content}<button id="pt-confirm" class="primary">確定</button><button id="pt-cancel">キャンセル</button>`,
  );
  d.querySelector<HTMLButtonElement>("#pt-cancel")!.onclick = () => d.close();
  d.querySelector<HTMLButtonElement>("#pt-confirm")!.onclick = () => {
    d.close();
    try {
      action();
    } catch (e) {
      message((e as Error).message);
    }
  };
  return d;
}
const PENDING_RESULT_KEY = "swarm-front-pending-result-v3";
function forgetPendingResult() {
  try {
    sessionStorage.removeItem(PENDING_RESULT_KEY);
  } catch {
    /* Replay is idempotent. */
  }
}
function showSaveConflict(base: ProgressSave, pending: ProgressSave) {
  saving = pending;
  paused = true;
  controls.enabled = false;
  controls.reset();
  const hasResult =
    !!pending.result &&
    JSON.stringify(base.result) !== JSON.stringify(pending.result);
  const recovery = {
    base: structuredClone(base),
    pending: structuredClone(pending),
  };
  let retained = false;
  if (hasResult) {
    try {
      sessionStorage.setItem(PENDING_RESULT_KEY, JSON.stringify(recovery));
      retained = true;
    } catch {
      /* Keep the in-memory battle result and offer a downloadable copy. */
    }
  }
  const d = dialog(
    "保存データが更新されています",
    `<div id="pt-save-conflict"><p role="status">${hasResult ? "未保存の戦果を、最新の武器庫へ重複しないよう反映します。" : "別の保存更新を検出しました。最新のデータを読み込み、操作をやり直せます。"}</p>${hasResult ? '<button id="pt-recover-result">戦果を最新の保存へ反映</button>' : '<button id="pt-reload-save">最新の保存で再開</button>'}<button id="pt-export-unsaved">未保存データの控えを書き出す</button>${hasResult && !retained ? "<p>このタブの控えを保存できませんでした。反映が済むまで画面を閉じず、先に控えを書き出してください。</p>" : ""}</div>`,
  );
  let completed = false;
  d.querySelector<HTMLButtonElement>("#pt-export-unsaved")!.onclick = () =>
    download(
      new Blob([JSON.stringify(recovery)], { type: "application/json" }),
      "swarm-front-unsaved-result.json",
    );
  const resume = () => {
    try {
      const latest = hasResult
        ? recoverUnsavedResult(recovery.base, recovery.pending)
        : loadProgress("normal");
      if (!latest) throw new Error("最新の保存が見つかりません。");
      if (hasResult) forgetPendingResult();
      save = latest;
      saving = undefined;
      retryAfter = undefined;
      paused = false;
      completed = true;
      d.close();
      notice = hasResult
        ? "未保存の戦果を反映しました。"
        : "最新の保存を読み込みました。操作をやり直してください。";
      home();
    } catch (error) {
      d.querySelector('[role="status"]')!.textContent = (
        error as Error
      ).message;
    }
  };
  d.querySelector<HTMLButtonElement>(
    hasResult ? "#pt-recover-result" : "#pt-reload-save",
  )!.onclick = resume;
  if (hasResult) {
    d.querySelector(".dialog-close")?.remove();
    d.addEventListener("cancel", (event) => event.preventDefault());
  } else
    d.addEventListener("close", () => {
      if (!completed) resume();
    });
}
function commit(next: ProgressSave, after: () => void = () => {}) {
  if (saving) return false;
  try {
    if (sampleMenus || developerMode) validateProgress(next);
    else persistProgress(next);
  } catch (e) {
    if (e instanceof SaveConflictError) {
      showSaveConflict(save, next);
      return false;
    }
    saving = next;
    retryAfter = after;
    controls.enabled = false;
    const d = dialog(
      "保存を再試行",
      `<p>${esc((e as Error).message)}</p><button id="pt-save-retry">保存を再試行</button>`,
    );
    d.querySelector(".dialog-close")?.remove();
    d.addEventListener("cancel", (e) => e.preventDefault());
    d.querySelector<HTMLButtonElement>("#pt-save-retry")!.onclick = () => {
      const n = saving!,
        a = retryAfter!;
      saving = undefined;
      retryAfter = undefined;
      d.close();
      commit(n, a);
    };
    return false;
  }
  save = next;
  if (world && next.receipts.includes(world.run)) discardCheckpoint();
  after();
  checkpointNow();
  return true;
}
function setScreen(next: string) {
  backgroundMusic().setScreen(next, save?.result?.win === true, world);
  queueMicrotask(() => {
    enhanceGameSelects(ui, "#pt-difficulty, #pt-bulk-grade");
    enhanceGameSelects(ui, "#pt-stage", (option, button) =>
      renderStageOption(save, option, button),
    );
  });
  if (document.pointerLockElement) document.exitPointerLock();
  if (next !== "gear") gearOrganizing = false;
  if (next !== "armory") armoryKind = null;
  screen = next;
  document.body.dataset.screen =
    next === "home" || next === "intro"
      ? "title"
      : next === "collection" || next === "daily-cinematic"
        ? "stage-clear"
        : next;
  controls.reset();
  controls.enabled = false;
  hud.hidden = true;
  $("controls").hidden = true;
  $("minimap").hidden = true;
  $("pause").hidden = true;
  $("scope-overlay").hidden = true;
  ui.hidden = false;
  ui.classList.remove("pt-clear");
  document
    .querySelectorAll(".pt-battle-button,.pt-fade")
    .forEach((e) => e.remove());
}
function header(title: string, body: string, nav = true) {
  setScreen(screen);
  const eyebrow =
    screen === "gear"
      ? "LOADOUT / SOLO"
      : screen === "base"
        ? "BASE"
        : screen === "armory"
          ? "ARSENAL"
          : screen === "growth"
            ? "PERSONNEL"
            : screen === "accessories"
              ? "EQUIPMENT"
              : "OPERATION RESULTS";
  const panel =
    screen === "gear" ? "gear" : screen === "result" ? "result" : "armory";
  ui.innerHTML = `<section class="panel ${panel} menu-screen pt-screen"><header class="menu-header"><div><div class="eyebrow">${eyebrow}${developerMode ? " · 管理者モード" : mode === "test" ? " · TEST DATA" : ""}</div><h1>${esc(title)}</h1></div>${nav ? '<nav><button id="pt-gear">出撃準備</button><button id="pt-base">基地</button><button id="pt-home">タイトルへ</button></nav>' : ""}</header><p class="pt-status" role="status">${esc(notice)}</p>${["base", "armory", "growth", "accessories"].includes(screen) ? resourceWallet(save) : ""}${body}</section>`;
  bindResourceHelp(ui, dialog);
  bind("pt-home", home);
  if (sampleMenus && nav) {
    $("pt-home").textContent = "サンプル終了";
    bind("pt-home", () => {
      const url = new URL(location.href);
      url.searchParams.delete("menuSample");
      location.href = url.href;
    });
  }
  bind("pt-gear", gear);
  bind("pt-base", base);
  if (nav) {
    ui.querySelector("#pt-" + screen)?.remove();
    ui.querySelector(".menu-header nav")!.insertAdjacentHTML(
      "beforeend",
      '<button id="pt-settings">設定・操作</button>',
    );
    bind("pt-settings", settingsUI);
  }
}

function loadMode(next: SaveMode) {
  if (developerMode) {
    mode = "test";
    save = sampleMenus ? menuSamples() : developerProgress();
    if (sampleMenus) gear();
    else home();
    return;
  }

  mode = next;
  try {
    sessionStorage.setItem("swarm-front-playtest-mode", mode);
    let found = loadProgress(mode);
    const journal =
      mode === "normal" ? sessionStorage.getItem(PENDING_RESULT_KEY) : null;
    if (journal) {
      const { base, pending } = JSON.parse(journal) as {
        base: ProgressSave;
        pending: ProgressSave;
      };
      found = recoverUnsavedResult(base, pending);
      forgetPendingResult();
      notice = "未保存だった戦果を復元しました。";
    }
    if (!found) {
      onboard();
      return;
    }
    save = found;
    if (save.dailyDefense?.state === "active") {
      const interrupted = settleDefense(
        save,
        save.dailyDefense.run,
        "interrupted",
        0,
        1,
        Math.random,
      );
      if (
        !commit(interrupted, () => {
          notice =
            "中断した防衛作戦の保証武器と保存済み戦利品を保持しています。";
        })
      )
        return;
    }
    if (save.result?.choice === "pending") {
      if (!save.result.collectionDone) {
        commit(prepareChoice(save, Math.random), choice);
        return;
      }
      choice();
    } else home();
  } catch (e) {
    setScreen("blocked");
    let pendingJournal: string | null = null;
    try {
      pendingJournal = sessionStorage.getItem(PENDING_RESULT_KEY);
    } catch {
      /* Storage can be unavailable; keep the original error visible. */
    }
    ui.innerHTML = `<section class="pt-screen"><h1>保存を読めません</h1><p>${esc((e as Error).message)}</p><p>上書きは停止しています。</p><button id="pt-export">保存を書き出す</button>${pendingJournal ? '<p>未保存の戦果の控えが残っています。書き出して保管できます。保存できる状態になったら再試行してください。</p><button id="pt-export-unsaved">未保存の戦果を書き出す</button><button id="pt-retry-recovery">復元を再試行</button>' : ""}</section>`;
    bind("pt-export", () =>
      download(
        new Blob([localStorage.getItem(newSaveKey(mode)) ?? ""]),
        `progression-${mode}.json`,
      ),
    );
    if (pendingJournal) {
      bind("pt-export-unsaved", () =>
        download(
          new Blob([pendingJournal!], { type: "application/json" }),
          "unsaved-result.json",
        ),
      );
      bind("pt-retry-recovery", () => loadMode(mode));
    }
  }
}
function onboard() {
  showHome(false);
}
function home() {
  if (save.result?.choice === "pending") {
    choice();
    return;
  }
  showHome(true);
}
function showHome(initialized: boolean) {
  world = null;
  setScreen(initialized ? "home" : "intro");
  ui.innerHTML = homeMarkup({
    stage: stageFor({
      stage: campaignNumber(stage),
      solo: { stage, difficulty },
    }),
    inventoryCount: initialized ? save.inventory.length : 0,
    pendingCount: initialized ? save.pending.length : 0,
    install: canInstallApp(),
  });
  if (canInstallApp()) bind("install", () => void installApp());
  const enter = (after: () => void) =>
    initialized
      ? after()
      : confirmAction(
          "新しい進行を開始",
          "<p>所持武器は1人プレイと協力プレイで共通です。以前の武器は性能を保って引き継ぎ、元の保存データも控えとして残します。</p>",
          () => {
            save = initializeProgress(mode);
            after();
          },
        );
  bind("solo", () => enter(gear));
  if (!developerMode) {
    ui.querySelector(".home-challenges")!.insertAdjacentHTML(
      "beforeend",
      '<button id="pt-daily-defense">日替わり防衛</button><button id="pt-weekly-missions" class="weekly-title-button">週間ミッション<span class="weekly-notification" aria-hidden="true" hidden></span></button>',
    );
    bind("pt-daily-defense", () =>
      enter(() => {
        void openDailyDefense();
      }),
    );
    bind("pt-weekly-missions", weeklyMissionsUI);
    updateWeeklyBadge();
  }
  bind("open-armory", () => enter(base));
  if (developerMode)
    ui.querySelector(".home-utilities")!.insertAdjacentHTML(
      "beforeend",
      '<button id="pt-menu-sample">武器48丁で表示を試す</button>',
    );
  if (developerMode)
    bind("pt-menu-sample", () => {
      const url = new URL(location.href);
      url.searchParams.set("menuSample", "1");
      location.href = url.href;
    });
  bind("open-bestiary", () => enter(report));
  bind("home-settings", settingsUI);
  bind("home-tutorial", () => openTutorialGuide(dialog));
  bind("coop", () => {
    location.href = location.hostname.endsWith(".trycloudflare.com")
      ? "https://swarm-front.melosalife-24.workers.dev/?coop=1"
      : import.meta.env.BASE_URL + "?coop=1";
  });
  bind("changelog", () =>
    dialog(
      "更新履歴",
      CHANGELOG.map(
        (r) =>
          `<section class="release-entry"><h3>${esc(r.date)}</h3><ul>${r.items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></section>`,
      ).join(""),
    ),
  );
  if (mode === "test")
    ui.querySelector(".connection-dot")!.textContent = developerMode
      ? "管理者モード · 全解放"
      : "TEST DATA";
  if (developerMode) {
    ui.querySelector(".fine")!.textContent =
      "全解放の検証用。変更は再読み込みでリセット。通常進行は変更しません。";
    ui.querySelector(".home-utilities")!.insertAdjacentHTML(
      "beforeend",
      '<button id="pt-developer-exit">通常モード<br>へ戻る</button>',
    );
    bind("pt-developer-exit", () => {
      void exitDeveloperMode();
    });
  }
}

function gear() {
  if (save.result?.choice === "pending") {
    choice();
    return;
  }
  if (screen !== "gear") selectedGearSlot = 0;
  setScreen("gear");
  const cfg = settings(stage, difficulty),
    m = save.missions[missionKey(stage, difficulty)] ?? [false, false, false];
  const ready = canSortie(save, stage, difficulty),
    p = soldier(save);
  header(
    "出撃準備",
    `<div class="gear-workspace"><aside class="gear-brief"><section class="mission-select"><div class="section-label"><span>01 出撃先</span><button id="pt-mission-info">作戦詳細</button></div><select id="pt-stage" aria-label="ステージ">${SOLO_STAGE_IDS.map((id) => `<option value="${id}" ${id === stage ? "selected" : ""}>${esc(stagePickerLabel(save, id))}</option>`).join("")}</select><div class="pt-difficulty"><select id="pt-difficulty" aria-label="難易度"><option value="normal">通常</option><option value="medium">ハード</option><option value="expert" disabled>EXPERT（未解放）</option></select><small title="クリア報酬">${resourceFrame("coins", victoryCoins(stage, difficulty), "gain")}</small></div></section><section class="equipment-select"><div class="section-label"><span>02 入替先</span><small>一覧タップで変更</small></div><div class="loadout-slots">${p.equipped
      .map((id, i) => {
        const w = save.inventory.find((w) => w.id === id)!;
        return `<button data-gear-slot="${i}" aria-pressed="${selectedGearSlot === i}"><span class="slot-number">0${i + 1}</span><span class="slot-info"><small class="pt-grade-${weaponTier(w)}">装備${i + 1} ${selectedGearSlot === i ? "選択中 · " : ""}${weaponGrade(w)}</small><b>${esc(WEAPONS[w.kind].name)}</b><strong>${esc(effectLabel(w))}</strong></span><i>詳細 ›</i></button>`;
      })
      .join(
        "",
      )}</div></section></aside><section class="gear-arsenal"><div class="slot-hint"><b>所持武器</b><span>タップで比較・装備変更</span></div>${weaponList(allWeapons(save), "gear")}</section></div><footer class="gear-footer"><p class="status">${!ready ? (save.pending.length ? "所持上限を超えています。武器庫で整理してください。" : "通常ステージのクリアで解放されます。") : esc(p.name)}<small>${m.map((v, i) => `${v ? "✓" : "○"} ${["クリア", cfg.timeLimit + "秒以内", "救急箱・復活なし"][i]}`).join(" · ")}</small></p><button id="pt-start" class="primary" ${ready ? "" : "disabled"}>ソロ出撃 ↗</button></footer>`,
  );
  // Use the existing header toolbar slot; keep the arsenal available for rows.
  const toolbar = ui.querySelector(".pt-list-tools")!;
  const headerNode = ui.querySelector(".menu-header")!;
  headerNode.insertBefore(toolbar, headerNode.querySelector("nav"));
  ($("pt-difficulty") as HTMLSelectElement).value = difficulty;
  $("pt-stage").onchange = () => {
    stage = Number(($("pt-stage") as HTMLSelectElement).value);
    gear();
  };
  $("pt-difficulty").onchange = () => {
    difficulty = ($("pt-difficulty") as HTMLSelectElement).value as Difficulty;
    gear();
  };
  bind("pt-start", () => void launch());
  if (sampleMenus) {
    ($("pt-start") as HTMLButtonElement).disabled = true;
    $("pt-start").textContent = "サンプル表示中";
    ui.querySelector(".gear-footer .status small")!.innerHTML =
      `<span class="pt-var-low"><sup>${varianceMark(-10)}</sup> 0%未満</span> · <span class="pt-var-good"><sup>${varianceMark(10)}</sup> 0%超〜+10%</span> · <span class="pt-var-great"><sup>${varianceMark(19)}</sup> +10%超（+20%除く）</span> · <span class="pt-var-max"><sup>${varianceMark(20)}</sup> +20%</span>`;
  }
  bind("pt-mission-info", () =>
    dialog(
      "作戦詳細",
      `<p>${esc(stageFor({ stage: campaignNumber(stage), solo: { stage, difficulty } }).brief)}</p>${stage === 3 ? `<p>${BRANCH_HINT}</p>` : ""}<ol>${["クリア", cfg.timeLimit + "秒以内にクリア", "救急箱・復活なしでクリア"].map((t, i) => `<li>${m[i] ? "達成済み" : "未達成"} · ${t}</li>`).join("")}</ol>`,
    ),
  );
  ui.querySelectorAll<HTMLButtonElement>("[data-gear-slot]").forEach(
    (b) =>
      (b.onclick = () => {
        selectedGearSlot = Number(b.dataset.gearSlot);
        gear();
      }),
  );
  bindList("gear");
}

function metric(w: StoredWeapon, key: string) {
  const d = stats(w);
  return key === "power"
    ? d.damage.toFixed(0)
    : key === "reload"
      ? d.reload.toFixed(2)
      : key === "range"
        ? d.range.toFixed(1)
        : key === "rate"
          ? (1 / d.interval).toFixed(2)
          : String(d.mag);
}
function metricValue(w: StoredWeapon, key: string) {
  const d = stats(w);
  return key === "power"
    ? d.damage
    : key === "reload"
      ? d.reload
      : key === "range"
        ? d.range
        : key === "rate"
          ? 1 / d.interval
          : d.mag;
}
function metricDifference(w: StoredWeapon, base: StoredWeapon, key: string) {
  const delta = metricValue(w, key) - metricValue(base, key);
  return `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`;
}
function weaponList(items: StoredWeapon[], context: string) {
  const shown = items
    .filter((w) =>
      context === "armory"
        ? familyOf(w.kind) === armoryKind
        : filter === "all" || familyOf(w.kind) === filter,
    )
    .filter(
      (w) => rarityFilter === "all" || weaponTier(w) === Number(rarityFilter),
    )
    .filter((w) => !favoritesOnly || save.locks.includes(w.id))
    .sort((a, b) =>
      sort === "favorites"
        ? Number(save.locks.includes(b.id)) -
            Number(save.locks.includes(a.id)) || a.acquired - b.acquired
        : sort === "acquired"
          ? a.acquired - b.acquired
          : sort === "rarity"
            ? weaponTier(b) - weaponTier(a)
            : sort === "reload"
              ? metricValue(a, sort) - metricValue(b, sort)
              : metricValue(b, sort) - metricValue(a, sort),
    );
  const choices = (key: string, values: string[][], selected: string) =>
    values
      .map(
        ([value, label]) =>
          `<button type="button" data-list-choice="${key}" data-value="${value}" aria-pressed="${value === selected}">${label}</button>`,
      )
      .join("");
  const toolbar = `<div class="pt-list-tools">${context === "armory" ? '<button id="pt-genres">‹ ジャンル</button>' : ""}<details class="pt-view-menu" name="weapon-tools"><summary>ソート・絞り込み</summary><div class="pt-view-options"><fieldset><legend>並び順</legend>${choices(
    "sort",
    [
      ["acquired", "入手順"],
      ["favorites", "お気に入り"],
      ["rarity", "レア度"],
      ["power", "威力"],
      ["mag", "装弾"],
      ["reload", "装填"],
      ["range", "射程"],
      ["rate", "連射"],
    ],
    sort,
  )}</fieldset><fieldset><legend>武器種</legend>${choices(
    "kind",
    [
      ...(context === "armory" ? [] : [["all", "全武器"]]),
      ...Object.entries(weaponGenres),
    ],
    context === "armory" ? armoryKind! : filter,
  )}</fieldset><fieldset><legend>レア度</legend>${choices("rarity", [["all", "すべて"], ...GRADES.map((g, i) => [String(i), g])], rarityFilter)}</fieldset><fieldset><legend>お気に入り（ロック）</legend>${choices(
    "favorites",
    [
      ["all", "すべて"],
      ["only", "お気に入りのみ"],
    ],
    favoritesOnly ? "only" : "all",
  )}</fieldset><button type="button" id="pt-view-close">閉じる</button></div></details><span>${shown.length}丁</span>${context === "gear" ? `<button id="pt-organize" aria-pressed="${gearOrganizing}">${gearOrganizing ? "整理終了" : "整理"}</button>` : ""}${context === "armory" || (context === "gear" && gearOrganizing) ? `<details class="pt-bulk-menu" name="weapon-tools"><summary>${context === "gear" ? "一括操作" : "整理"}</summary><div class="pt-bulk-options"><label><select id="pt-bulk-grade" aria-label="一括選択のレア度">${GRADES.map((r, i) => `<option value="${i}">${r}以下</option>`).join("")}</select></label><label><input type="checkbox" id="pt-include-good">当たり補正も含める</label><button id="pt-bulk-select">一括選択</button><button id="pt-dismantle">選択を解体 (${checked.size})</button></div></details>` : ""}</div>`;
  return (
    toolbar +
    gearWeaponRows(
      shown,
      save,
      context === "armory" || (context === "gear" && gearOrganizing),
      checked,
      context === "gear" ? selectedGearSlot : undefined,
    )
  );
}

function bindList(context: string) {
  if (context === "gear")
    bind("pt-organize", () => {
      gearOrganizing = !gearOrganizing;
      checked.clear();
      gear();
    });
  const redraw = () => {
    const menu = ui.querySelector<HTMLDetailsElement>(".pt-bulk-menu");
    const grade = ui.querySelector<HTMLSelectElement>("#pt-bulk-grade")?.value;
    const includeGood =
      ui.querySelector<HTMLInputElement>("#pt-include-good")?.checked;
    const open = menu?.open ?? false;
    const viewOpen =
      ui.querySelector<HTMLDetailsElement>(".pt-view-menu")?.open ?? false;
    const focused = document.activeElement as HTMLElement | null;
    const choice = focused?.dataset.listChoice;
    const value = focused?.dataset.value;
    context === "result" ? result() : context === "gear" ? gear() : armory();
    const nextMenu = ui.querySelector<HTMLDetailsElement>(".pt-bulk-menu");
    if (nextMenu) nextMenu.open = open;
    const nextView = ui.querySelector<HTMLDetailsElement>(".pt-view-menu");
    if (nextView) nextView.open = viewOpen;
    if (choice)
      ui.querySelector<HTMLButtonElement>(
        `[data-list-choice="${choice}"][data-value="${value}"]`,
      )?.focus();
    const nextGrade = ui.querySelector<HTMLSelectElement>("#pt-bulk-grade");
    if (nextGrade && grade !== undefined) nextGrade.value = grade;
    const nextIncludeGood =
      ui.querySelector<HTMLInputElement>("#pt-include-good");
    if (nextIncludeGood) nextIncludeGood.checked = includeGood ?? false;
  };
  const viewMenu = ui.querySelector<HTMLDetailsElement>(".pt-view-menu")!;
  bind("pt-view-close", () => {
    viewMenu.open = false;
    viewMenu.querySelector<HTMLElement>("summary")!.focus();
  });
  viewMenu.onkeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      viewMenu.open = false;
      viewMenu.querySelector<HTMLElement>("summary")!.focus();
    }
  };
  ui.querySelectorAll<HTMLButtonElement>("[data-list-choice]").forEach(
    (button) => {
      button.onclick = () => {
        const value = button.dataset.value!;
        if (button.dataset.listChoice === "sort") sort = value;
        else if (button.dataset.listChoice === "rarity") rarityFilter = value;
        else if (button.dataset.listChoice === "favorites")
          favoritesOnly = value === "only";
        else if (context === "armory") armoryKind = value as Family;
        else filter = value;
        if (button.dataset.listChoice !== "sort") checked.clear();
        listScroll = 0;
        redraw();
      };
    },
  );
  const list = ui.querySelector<HTMLElement>(".pt-weapon-list")!;
  list.scrollTop = listScroll;
  list.scrollLeft = perfScroll;
  list.onscroll = () => {
    listScroll = list.scrollTop;
    perfScroll = list.scrollLeft;
  };
  ui.querySelectorAll<HTMLElement>("[data-row],[data-pinned]").forEach(
    (row) => {
      if (
        context === "gear" &&
        !gearOrganizing &&
        save.inventory.some((w) => w.id === row.dataset.row)
      ) {
        const button = row.querySelector<HTMLButtonElement>("[data-detail]")!;
        button.setAttribute(
          "aria-label",
          button
            .getAttribute("aria-label")!
            .replace(/ 詳細$/, " を装備" + (selectedGearSlot + 1) + "へ"),
        );
      }
      let origin = { x: 0, y: 0 };
      row.onpointerdown = (e) => {
        origin = { x: e.clientX, y: e.clientY };
      };
      row.onclick = (e) => {
        if (
          (e.target as Element).closest("[data-lock],[data-check]") ||
          (e.detail !== 0 &&
            Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > 8)
        )
          return;
        const w = allWeapons(save).find(
          (w) => w.id === (row.dataset.row ?? row.dataset.pinned),
        )!;
        if (
          !row.dataset.pinned &&
          context === "gear" &&
          !gearOrganizing &&
          save.inventory.some((item) => item.id === w.id)
        )
          equipWeapon(w.id, selectedGearSlot, gear);
        else detail(w, context);
      };
    },
  );
  ui.querySelectorAll<HTMLButtonElement>("[data-lock]").forEach(
    (b) =>
      (b.onclick = (event) => {
        event.stopPropagation();
        toggleLock(b.dataset.lock!, () => {
          const locked = save.locks.includes(b.dataset.lock!);
          b.setAttribute("aria-pressed", String(locked));
          b.innerHTML = lockMarkup(locked);
          if (context !== "result") {
            const checkbox = b
              .closest("[data-row]")
              ?.querySelector<HTMLInputElement>("[data-check]");
            if (locked) checked.delete(b.dataset.lock!);
            if (checkbox) {
              checkbox.disabled = weaponProtected(save, b.dataset.lock!);
              checkbox.checked = checked.has(b.dataset.lock!);
            }
            const action = document.getElementById("pt-dismantle");
            if (action) action.textContent = `選択を解体 (${checked.size})`;
          }
          if (favoritesOnly || sort === "favorites") redraw();
        });
      }),
  );
  ui.querySelectorAll<HTMLInputElement>("[data-check]").forEach(
    (b) =>
      (b.onchange = () => {
        b.checked
          ? checked.add(b.dataset.check!)
          : checked.delete(b.dataset.check!);
        $("pt-dismantle").textContent = `選択を解体 (${checked.size})`;
      }),
  );
  bind("pt-bulk-select", () => {
    const grade = Number(($("pt-bulk-grade") as HTMLSelectElement).value),
      include = ($("pt-include-good") as HTMLInputElement).checked;
    checked = new Set(
      allWeapons(save)
        .filter(
          (w) =>
            (context === "armory"
              ? familyOf(w.kind) === armoryKind
              : filter === "all" || familyOf(w.kind) === filter) &&
            (rarityFilter === "all" ||
              weaponTier(w) === Number(rarityFilter)) &&
            (!favoritesOnly || save.locks.includes(w.id)) &&
            weaponTier(w) <= grade &&
            !weaponProtected(save, w.id) &&
            (include ||
              VARIANCE_KEYS.every((k) => w.format === 2 && w.variance[k] < 10)),
        )
        .map((w) => w.id),
    );
    redraw();
  });
  bind("pt-dismantle", () => dismantleUI([...checked], redraw));
}
function toggleLock(id: string, after: () => void) {
  const apply = () => {
    const n = structuredClone(save);
    n.locks = n.locks.includes(id)
      ? n.locks.filter((x) => x !== id)
      : [...n.locks, id];
    commit(n, after);
  };
  if (save.locks.includes(id))
    confirmAction(
      "ロックを解除",
      `<p>${esc(WEAPONS[allWeapons(save).find((w) => w.id === id)!.kind].name)} のロックを解除します。</p>`,
      apply,
    );
  else apply();
}
function base() {
  setScreen("base");
  header(
    "基地",
    `<div class="pt-base-menu">
      <button id="pt-base-weapons"><strong>武器</strong><span>一覧・比較・整理</span><small>${allWeapons(save).length}丁を所持</small></button>
      <button id="pt-base-accessories"><strong>アクセサリ</strong><span>作成・装備・合成</span><small>${save.accessories.length}個を所持</small></button>
      <button id="pt-base-growth"><strong>育成</strong><span>兵士の能力を強化</span><small>兵士ごとの成長を管理</small></button>
      <button id="pt-base-workshop" disabled aria-describedby="pt-workshop-note"><strong>工房</strong><span>工事中</span><small id="pt-workshop-note">武器のグレードアップ施設を準備中</small></button>
    </div>`,
  );
  bind("pt-base-weapons", armory);
  bind("pt-base-accessories", accessories);
  bind("pt-base-growth", growth);
}
function armory() {
  setScreen("armory");
  if (!armoryKind) {
    checked.clear();
    header(
      "武器",
      `<div class="pt-armory-genres">${(Object.keys(weaponGenres) as Family[]).map((family) => `<button data-genre="${family}"><strong>${weaponGenres[family]}</strong><span>${allWeapons(save).filter((w) => familyOf(w.kind) === family).length}丁</span><small>武器一覧へ ›</small></button>`).join("")}</div>`,
    );
    ui.querySelectorAll<HTMLButtonElement>("[data-genre]").forEach(
      (b) =>
        (b.onclick = () => {
          armoryKind = b.dataset.genre as Family;
          listScroll = perfScroll = 0;
          armory();
        }),
    );
    return;
  }
  checked = new Set(
    [...checked].filter(
      (id) =>
        allWeapons(save).some((w) => w.id === id) && !weaponProtected(save, id),
    ),
  );
  header(
    weaponGenres[armoryKind],
    `<p class="pt-armory-summary">通常 ${save.inventory.length}丁 / 超過 ${save.pending.length}丁 · 系統ごと16丁、全体160丁</p>${weaponList(allWeapons(save), "armory")}`,
  );
  const toolbar = ui.querySelector(".pt-list-tools")!;
  ui.querySelector(".menu-header")!.insertBefore(
    toolbar,
    ui.querySelector(".menu-header nav"),
  );
  bindList("armory");
  const genreBack = $("pt-genres");
  genreBack.onclick = () => {
    armoryKind = null;
    armory();
  };
}
function dismantleUI(ids: string[], redraw: () => void = armory) {
  const items = allWeapons(save).filter((w) => ids.includes(w.id));
  if (!items.length) return;
  const n = dismantle(save, ids);
  confirmAction(
    "武器を解体",
    `<p>${items.length}丁 → ${resourceFrame("powder", n.powder - save.powder, "gain")}</p>${items.map((w) => `<p>${esc(WEAPONS[w.kind].name)} ${weaponGrade(w)}${weaponTier(w) === 4 || VARIANCE_KEYS.some((k) => w.format === 2 && w.variance[k] === 20) ? " ⚠ LR／最大補正あり" : ""}</p>`).join("")}`,
    () =>
      commit(n, () => {
        checked.clear();
        redraw();
      }),
  );
}
function equipWeapon(id: string, slot: number, after: () => void) {
  if (!save.inventory.some((w) => w.id === id) || (slot !== 0 && slot !== 1))
    return;
  const n = structuredClone(save),
    p = soldier(n),
    other = p.equipped.indexOf(id);
  if (other === slot) {
    after();
    return;
  }
  if (other >= 0)
    [p.equipped[slot], p.equipped[other]] = [
      p.equipped[other],
      p.equipped[slot],
    ];
  else p.equipped[slot] = id;
  commit(n, () => {
    // Reuse the combat switch clip, including first-gesture decoding.
    void sound.load().then(() => sound.play("switch"));
    after();
  });
}
function detail(w: StoredWeapon, context: string) {
  const d = dialog(
    `${WEAPONS[w.kind].name} / ${weaponGrade(w)}`,
    `<div id="pt-weapon-preview"></div><p>${esc(effectLabel(w))}</p><label>比較相手 <select id="pt-compare">${soldier(
      save,
    )
      .equipped.map(
        (id, i) =>
          `<option value="${id}">装備${i + 1} ${esc(WEAPONS[save.inventory.find((a) => a.id === id)!.kind].name)}</option>`,
      )
      .join(
        "",
      )}</select></label><div id="pt-comparison"></div><button id="pt-detail-lock">${lockMarkup(save.locks.includes(w.id), true)}</button>${context !== "result" && !save.pending.some((a) => a.id === w.id) ? '<button data-slot="0">装備1へ</button><button data-slot="1">装備2へ</button>' : ""}<button id="pt-share">共有画像</button>`,
  );
  const draw = () => {
    const base = save.inventory.find(
      (a) =>
        a.id === (d.querySelector("#pt-compare") as HTMLSelectElement).value,
    )!;
    d.querySelector("#pt-comparison")!.innerHTML =
      `<table><tr><th>性能</th><th>実数値</th><th>同レア基準差</th><th>装備差分</th></tr>${[
        ["power", "威力"],
        ["mag", "装弾"],
        ["reload", "装填秒"],
        ["range", "射程m"],
        ["rate", "連射/秒"],
      ]
        .map(
          ([k, t]) =>
            `<tr><th>${t}</th><td class="pt-var-${varianceClass(weaponStatVariance(w, k as "mag" | keyof Variances))}">${metric(w, k)}<sup>${varianceMark(weaponStatVariance(w, k as "mag" | keyof Variances))}</sup></td><td>${w.format === 2 && k === "mag" ? "固定" : `${w.format === 2 ? "" : "約"}${weaponStatVariance(w, k as "mag" | keyof Variances) >= 0 ? "+" : ""}${Number(weaponStatVariance(w, k as "mag" | keyof Variances).toFixed(3))}%`}</td><td>${metricDifference(w, base, k)}</td></tr>`,
        )
        .join(
          "",
        )}</table><p>印は同じ武器種・レア度の標準性能との差です。装填は速度換算、特殊効果は除外。★は+20%ちょうど。</p>`;
  };
  if (context === "gear")
    (d.querySelector("#pt-compare") as HTMLSelectElement).value =
      soldier(save).equipped[selectedGearSlot];
  draw();
  d.querySelector("#pt-compare")!.addEventListener("change", draw);
  d.querySelector<HTMLButtonElement>("#pt-detail-lock")!.onclick = () =>
    toggleLock(w.id, () => {
      d.close();
      context === "result" ? result() : context === "gear" ? gear() : armory();
    });
  d.querySelectorAll<HTMLButtonElement>("[data-slot]").forEach(
    (b) =>
      (b.onclick = () => {
        equipWeapon(w.id, Number(b.dataset.slot), () => {
          d.close();
          context === "gear" ? gear() : armory();
        });
      }),
  );
  d.querySelector<HTMLButtonElement>("#pt-share")!.onclick = () =>
    void shareWeapon(w);
  void import("./weapon-sharing")
    .then((m) =>
      m.previewWeapon(d.querySelector<HTMLElement>("#pt-weapon-preview")!, w),
    )
    .then((dispose) => d.addEventListener("close", dispose));
}
function growth() {
  tutorial(
    "growth",
    "兵士の育成",
    "通常ST1〜4の初クリアで解放素材、各面・難易度の初クリアでポイントを獲得します。兵士ごとに配分でき、割当を戻す確定には500コイン必要です。",
  );
  setScreen("growth");
  const p = soldier(save);
  header(
    "兵士の育成",
    `<div class="pt-growth">${growthMarkup(p.levels, save.unlocked, save.materials)}<p id="pt-point-preview" aria-live="polite">${resourceFrame("points", spent(p.levels), "used")} / ${save.points}</p><button id="pt-allocate">配分を確定</button><button id="pt-growth-cancel">編集をキャンセル</button></div>`,
  );
  ui.querySelectorAll<HTMLButtonElement>("[data-unlock]").forEach(
    (b) =>
      (b.onclick = () =>
        commit(unlockSkill(save, b.dataset.unlock as Skill), growth)),
  );
  const levels = () => {
    const v = { ...p.levels };
    ui.querySelectorAll<HTMLSelectElement>("[data-level]").forEach(
      (e) => (v[e.dataset.level as Skill] = Number(e.value)),
    );
    return v;
  };
  ui.querySelectorAll("[data-level]").forEach((e) =>
    e.addEventListener("change", () => {
      $("pt-point-preview").innerHTML =
        `${resourceFrame("points", spent(levels()), "used")} / ${save.points}`;
    }),
  );
  bind("pt-allocate", () => {
    const v = levels();
    if (!SKILLS.some((k) => v[k] !== p.levels[k])) return;
    const n = allocate(save, p.id, v);
    const d = confirmAction(
      "育成内容の確認",
      growthConfirmation(p.levels, v),
      () => commit(n, growth),
    );
    const actions = document.createElement("footer");
    actions.className = "growth-confirm-actions";
    actions.append(
      d.querySelector("#pt-cancel")!,
      d.querySelector("#pt-confirm")!,
    );
    d.append(actions);
  });
  bindGrowthUI(ui, p.levels, save.points, save.coins);
  bind("pt-growth-cancel", growth);
  const growthFooter = document.createElement("footer");
  growthFooter.className = "gear-footer pt-growth-footer";
  for (const id of ["pt-point-preview", "pt-growth-cancel", "pt-allocate"])
    growthFooter.append($(id));
  ui.querySelector(".pt-screen")!.append(growthFooter);
  ui.querySelector(".pt-growth")!.insertAdjacentHTML(
    "beforebegin",
    `<div class="pt-personnel"><label>登録兵士 <select id="pt-soldier">${save.soldiers.map((p) => `<option value="${esc(p.id)}" ${p.id === save.selectedSoldier ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label><button id="pt-register">兵士を登録</button>${mode === "test" ? '<button id="pt-generator">テスト品を指定生成</button>' : ""}</div>`,
  );
  ui.querySelector(".pt-personnel")!.prepend(
    ui.querySelector(".resource-wallet")!,
  );
  bind("pt-register", () => {
    const n = structuredClone(save);
    n.soldiers.push({
      id: `soldier-${n.serial++}`,
      name: `STANDARD TROOPER ${n.soldiers.length + 1}`,
      levels: blankLevels(),
      equipped: [...soldier(n).equipped],
    });
    commit(n, growth);
  });
  $("pt-soldier").onchange = () => {
    const n = structuredClone(save);
    n.selectedSoldier = ($("pt-soldier") as HTMLSelectElement).value;
    commit(n, growth);
  };
  bind("pt-generator", generator);
}
function accessoryEffect(kind: AccessoryKind, rarity: number) {
  const v = ACCESSORY_VALUES[kind][rarity];
  return kind === "pickup"
    ? `回収範囲 ×${v}`
    : kind === "healing"
      ? `最大HPの${Math.round(v * 100)}%回復`
      : `被弾後 ${v}秒で回復開始`;
}
function accessories() {
  tutorial(
    "accessories",
    "アクセサリの作成と合成",
    "武装片で作成します。同種・同レア品は合成して昇格できます。一括合成は消費品と完成品を確認してから実行します。全兵士の登録品とロック品は保護されます。",
  );
  setScreen("accessories");
  header(
    "アクセサリ",
    `<div class="pt-brief"><button id="pt-craft">通常作成 ${resourceFrame("powder", 10, "cost")}</button><select id="pt-accessory-kind">${Object.entries(
      ACCESSORY_NAMES,
    )
      .map(([k, v]) => `<option value="${k}">${v}</option>`)
      .join(
        "",
      )}</select><button id="pt-target-craft">指定作成 ${resourceFrame("powder", 30, "cost")}</button><button id="pt-synthesis">一括合成</button><button id="pt-accessory-off">装備を外す</button></div><div class="pt-accessories">${save.accessories.map((a) => `<div class="accessory-row ${soldier(save).accessory === a.id ? "is-equipped" : ""}" data-rarity="${a.rarity}"><span class="accessory-grade">R${a.rarity}</span><button class="accessory-info" data-accessory-info="${a.id}"><strong>${ACCESSORY_NAMES[a.kind]}</strong><small>${accessoryEffect(a.kind, a.rarity)} · ${soldier(save).accessory === a.id ? "装備中" : save.soldiers.some((p) => p.accessory === a.id) ? "他の兵士に登録" : "詳細を見る"}</small></button><button data-accessory-equip="${a.id}" ${soldier(save).accessory === a.id ? "disabled" : ""}>${soldier(save).accessory === a.id ? "装備中" : "装備"}</button><button data-accessory-lock="${a.id}">${a.locked ? "🔒解除" : "🔓ロック"}</button><button data-accessory-delete="${a.id}" ${accessoryProtected(save, a.id) ? "disabled" : ""}>解体 ${resourceFrame("powder", a.rarity, "gain")}</button></div>`).join("")}</div>`,
  );
  ui.querySelectorAll<HTMLButtonElement>("[data-accessory-info]").forEach(
    (button) =>
      (button.onclick = () => {
        const a = save.accessories.find(
          (item) => item.id === button.dataset.accessoryInfo,
        )!;
        const explanation = {
          pickup: "地面に落ちたアイテムを回収できる距離を広げます。",
          healing: "回復アイテムを拾ったときの回復量を増やします。",
          recovery:
            "ダメージを受けてから自動回復が始まるまでの時間を短縮します。",
        };
        dialog(
          `${ACCESSORY_NAMES[a.kind]} R${a.rarity}`,
          `<p>${explanation[a.kind]}</p><p class="accessory-effect">${accessoryEffect(a.kind, a.rarity)}</p><p>${a.locked ? "ロック中。解体・一括合成から保護されています。" : "兵士に登録した装備は、解体・一括合成から保護されます。"}</p>`,
        );
      }),
  );
  bind("pt-craft", () => commit(createAccessory(save), accessories));
  bind("pt-target-craft", () =>
    commit(
      createAccessory(
        save,
        ($("pt-accessory-kind") as HTMLSelectElement).value as AccessoryKind,
      ),
      accessories,
    ),
  );
  bind("pt-synthesis", () => {
    const preview = synthesize(save);
    confirmAction(
      "一括合成の確認",
      `<p>消費 ${preview.consumed.length}個 / 完成 ${preview.created.length}個</p>${preview.consumed.map((a) => `<p>消費 ${ACCESSORY_NAMES[a.kind]} R${a.rarity}</p>`).join("")}${preview.created.map((a) => `<p>完成 ${ACCESSORY_NAMES[a.kind]} R${a.rarity}</p>`).join("")}`,
      () => commit(preview.save, accessories),
    );
  });
  bind("pt-accessory-off", () => {
    const n = structuredClone(save);
    delete soldier(n).accessory;
    commit(n, accessories);
  });
  ui.querySelectorAll<HTMLButtonElement>("[data-accessory-equip]").forEach(
    (b) =>
      (b.onclick = () => {
        const n = structuredClone(save);
        soldier(n).accessory = b.dataset.accessoryEquip;
        commit(n, accessories);
      }),
  );
  ui.querySelectorAll<HTMLButtonElement>("[data-accessory-lock]").forEach(
    (b) =>
      (b.onclick = () => {
        const a = save.accessories.find(
            (a) => a.id === b.dataset.accessoryLock,
          )!,
          change = () => {
            const n = structuredClone(save);
            n.accessories.find((x) => x.id === a.id)!.locked = !a.locked;
            commit(n, accessories);
          };
        a.locked
          ? confirmAction(
              "ロック解除",
              `<p>${ACCESSORY_NAMES[a.kind]} R${a.rarity}</p>`,
              change,
            )
          : change();
      }),
  );
  ui.querySelectorAll<HTMLButtonElement>("[data-accessory-delete]").forEach(
    (b) =>
      (b.onclick = () => {
        const a = save.accessories.find(
          (a) => a.id === b.dataset.accessoryDelete,
        )!;
        if (accessoryProtected(save, a.id)) return;
        confirmAction(
          "アクセサリ解体",
          `<p>${ACCESSORY_NAMES[a.kind]} R${a.rarity} → ${resourceFrame("powder", a.rarity, "gain")}</p>`,
          () => {
            const n = structuredClone(save);
            n.accessories = n.accessories.filter((x) => x.id !== a.id);
            n.powder += a.rarity;
            commit(n, accessories);
          },
        );
      }),
  );
}

window.addEventListener("app-install-changed", () => {
  if (screen === "home" || screen === "intro") showHome(screen === "home");
});
loadMode("normal");
if (!developerMode) {
  installCloudSync();
  window.addEventListener("swarm-progress-saved", updateWeeklyBadge);
  window.addEventListener("swarm-cloud-progress", updateWeeklyBadge);
  document.addEventListener("visibilitychange", updateWeeklyBadge);
  setInterval(updateWeeklyBadge, 60000);
  window.addEventListener("swarm-cloud-progress", () => {
    if (mode !== "normal" || saving) return;
    try {
      const latest = loadProgress("normal");
      if (latest) {
        save = latest;
        checkpointNow();
      }
    } catch {
      /* The ordinary save-conflict path preserves unresolved local work. */
    }
  });
}
let checkpointAt = 0;
let checkpointErrorShown = false;
function discardCheckpoint() {
  if (developerMode || mode !== "normal") return;
  try {
    clearBattleCheckpoint();
  } catch {
    /* A result receipt also prevents replay. */
  }
}
function checkpointNow() {
  if (
    developerMode ||
    mode !== "normal" ||
    saving ||
    !world ||
    screen !== "battle"
  )
    return;
  try {
    writeBattleCheckpoint(world, save);
    checkpointAt = performance.now();
  } catch {
    if (!checkpointErrorShown) {
      checkpointErrorShown = true;
      notice = "戦闘の中断保存ができません。進行保存は保持しています。";
      if (!document.hidden) message(notice);
    }
  }
}
// Persist periodically as mobile operating systems may terminate without pagehide.
setInterval(() => {
  if (performance.now() - checkpointAt >= 5000) checkpointNow();
}, 5000);
window.addEventListener("pagehide", checkpointNow, { capture: true });
if (!developerMode && save && screen === "home") {
  try {
    const checkpoint = readBattleCheckpoint(save);
    if (checkpoint) {
      const d = dialog(
        "中断した作戦",
        `<p>${stageLabel(checkpoint.world.solo!.stage)}・${Math.floor(checkpoint.world.time)}秒時点から再開できます。直前の最大約5秒は戻る場合があります。</p><button id="pt-resume-battle">作戦を再開</button><button id="pt-discard-battle">中断した作戦を終了</button>`,
      );
      d.querySelector(".dialog-close")?.remove();
      d.addEventListener("cancel", (e) => e.preventDefault());
      d.querySelector<HTMLButtonElement>("#pt-resume-battle")!.onclick = () => {
        stage = checkpoint.world.solo!.stage;
        difficulty = checkpoint.world.solo!.difficulty;
        d.close();
        void launch(checkpoint);
      };
      d.querySelector<HTMLButtonElement>("#pt-discard-battle")!.onclick =
        () => {
          discardCheckpoint();
          d.close();
        };
    }
  } catch (error) {
    message((error as Error).message);
  }
}
const unauthorizedDeveloper = developerRequested && !developerMode;
const retryLaunch =
  sampleMenus || unauthorizedDeveloper
    ? null
    : sessionStorage.getItem(retryKey);
if (!sampleMenus && !unauthorizedDeveloper) sessionStorage.removeItem(retryKey);
if (retryLaunch && save && save.result?.choice !== "pending") {
  try {
    const retry = JSON.parse(retryLaunch);
    if (
      retry.mode === mode &&
      Number.isInteger(retry.stage) &&
      retry.stage >= 1 &&
      validSoloStage(retry.stage) &&
      ["normal", "medium"].includes(retry.difficulty)
    ) {
      stage = retry.stage;
      difficulty = retry.difficulty;
      void launch();
    }
  } catch {
    /* An invalid navigation hint never changes saved progression. */
  }
}
requestAnimationFrame(frame);
if (unauthorizedDeveloper) openDeveloperEntry();
if (developerMode) {
  let checking = false;
  const verify = async () => {
    if (checking || document.hidden) return;
    checking = true;
    if (!(await checkDeveloperSession())) returnToNormal();
    checking = false;
  };
  setInterval(() => {
    void verify();
  }, 60000);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) void verify();
  });
  document.addEventListener("visibilitychange", () => {
    void verify();
  });
}
if (import.meta.env.DEV)
  Object.defineProperty(window, "__playtest", {
    get: () => ({
      completeDefenseForTest: (win: boolean) => {
        if (!world?.defense || screen !== "battle")
          throw Error("No active defense fixture");
        if (win) world.time = world.defense.duration;
        else world.defense.armory.hp = 0;
        step(world, { solo: controls.read() });
        finishDaily();
      },
      screen,
      mode,
      world: world ? structuredClone(world) : null,
      save: save ? structuredClone(save) : null,
      paused,
      modalCount,
      encounterActive,
      camera: {
        position: view.camera.position.toArray(),
        quaternion: view.camera.quaternion.toArray(),
        fov: view.camera.fov,
      },
      loadReady,
      mapAssets: view.mapAssets.status.map((state) => ({ ...state })),
      trooper: (() => {
        const model = view.players.get("solo");
        const trooper = model?.userData.trooper;
        return trooper
          ? { loaded: true, bones: trooper.bones.length }
          : { loaded: false, error: model?.userData.trooperError ?? null };
      })(),
      input: { ...controls.input },
      renderedEnemies: Object.fromEntries(
        [...view.structures].map(([kind, visual]) => [
          kind,
          [...visual.controller.states.keys()],
        ]),
      ),
    }),
  });
