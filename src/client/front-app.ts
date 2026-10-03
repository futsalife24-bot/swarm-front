/** 旧版と併設する改装版。所持品・旧セーブへの依存なし。 */
import "../style.css";
import "../mobile-ui.css";
import "../menu-ui.css";
import "../menu-theme.css";
import "./coop-lobby.css";
import "./rebuild.css";
import "./front.css";
import * as T from "three";
import { Renderer } from "./render";
import { Controls } from "./input";
import { Sound } from "./audio";
import { prepareBattle } from "./battle-loading";
import { placeControls, updateScopeButtons } from "./layout";
import { FrontSettings } from "./front-settings";
import { hudMarkup, updateCooldowns } from "./hud";
import { Minimap } from "./minimap";
import { frontUpgradeStrip, frontUpgradeDetails } from "./front-upgrade-ui";
import { homeMarkup } from "./home-screen";
import { roomBrowserMarkup, bindRoomBrowser } from "./room-browser";
import { FrontNetwork, loadFrontNetworkSession } from "./front-network";
import { readFrontProgress, awardFrontProgress } from "./front-progress";
import {
  createFrontRun,
  stepFrontRun,
  chooseFrontUpgrade,
  rerollFrontRunOffer,
  getFrontRunView,
  frontTemporaryWeapons,
  FRONT_RUN_CONFIG,
  type FrontRun,
  type FrontRunView,
  type FrontMode,
  type FrontWeaponKind,
} from "../shared/front-run";
import {
  FRONT_UPGRADE_CATALOG,
  FRONT_FAMILY_CARDS,
  FRONT_EVOLUTIONS,
  type FrontUpgradeId,
} from "../shared/front-upgrades";
import { WEAPONS } from "../shared/defs";
import { STAGES } from "../shared/stages";
import { retireEvents, eye, type World } from "../shared/game";
import {
  createRebuildUiGate,
  acceptRebuildKeydown,
  formatRebuildTime,
  pauseRebuildUi,
  resumeRebuildUi,
} from "./rebuild-ui-state";
const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const controls = new Controls(),
  sound = new Sound(),
  gate = createRebuildUiGate();
const progressStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
};
const view = new Renderer(
  $("world") as HTMLCanvasElement,
  FRONT_RUN_CONFIG.enemyCap + 1,
);
const settings = new FrontSettings(controls, sound, view);
const minimap = new Minimap();
let localRun: FrontRun | null = null,
  world: World | null = null,
  info: FrontRunView | null = null,
  network: FrontNetwork | null = null;
let screen: "home" | "prep" | "rooms" | "lobby" | "battle" | "loading" = "home",
  mode: FrontMode = "survival",
  kinds: FrontWeaponKind[] = ["rifle", "shotgun"],
  id = "front-solo";
let ready = false,
  overlayKey = "",
  accumulator = 0,
  previous = performance.now(),
  actionLockUntil = 0,
  choiceFeedbackUntil = 0,
  noticeUntil = 0,
  loadSerial = 0,
  requestSerial = 0;
let status = "",
  rewardText = "",
  awardedRun = "",
  preparedGeneration = -1;
let connectionFatal = "";
let lastHud = "";
let lastRenderKey = "";
let lobbyPreparation: Promise<void> = Promise.resolve();
const upgradeCopy: Record<FrontUpgradeId, string> = {
  "blast-core": "射撃で撃破すると、周囲を爆破。",
  fuse: "命中で印を付け、次の命中で起爆。",
  "compressed-charge": "同じ敵に3回命中で爆破。",
  "armor-piercer": "弾がもう1体の敵を貫く。",
  ricochet: "3回命中で、近くの敵へ跳弾。",
  "line-shot": "貫通を追加。3体命中で1発返却。",
  "afterimage-mine": "回避の終点に地雷。最大3個。",
  "tactical-reload": "回避後の装填を短縮。",
  interceptor: "命中で充填。装填時に1回迎撃。",
  armor: "最大体力 +5%。増えた分を回復。",
  reload: "装填時間 −5%。",
  magazine: "弾倉 +10%相当。",
};
const now = () =>
  network ? Date.now() / 1000 + network.clockOffset : performance.now() / 1000;
const modeNames = {
  survival: "迎撃戦",
  defense: "防衛戦",
  daily: "日替わり防衛",
};
const familyNames = {
  explosion: "爆発",
  piercing: "貫通",
  interception: "迎撃",
  generic: "補強",
};
function clearInput() {
  controls.enabled = false;
  controls.reset();
  accumulator = 0;
  previous = performance.now();
  if (document.pointerLockElement) document.exitPointerLock();
}
function setView() {
  if (localRun) {
    world = localRun.world;
    info = getFrontRunView(localRun, id);
  }
}
function leave() {
  loadSerial++;
  network?.close();
  network = null;
  localRun = null;
  world = null;
  info = null;
  ready = false;
  choiceFeedbackUntil = 0;
  clearInput();
  Object.assign(gate, createRebuildUiGate());
  $("hud").replaceChildren();
  lastHud = "";
  $("controls").hidden = true;
  $("pause").hidden = true;
  home();
}
function notice(text: string, seconds = 3) {
  $("rebuild-notice").textContent = text;
  $("rebuild-notice").hidden = false;
  noticeUntil = performance.now() + seconds * 1000;
}
function home() {
  screen = "home";
  document.body.dataset.screen = "title";
  const progress = readFrontProgress(progressStorage);
  $("ui").innerHTML = homeMarkup({
    stage: STAGES[0],
    inventoryCount: 0,
    error: progress.error,
  });
  const operation = $("ui").querySelector(".home-operation")!;
  operation.innerHTML = `<div class="eyebrow">改装版</div><h2>強化を選び、群れを崩す</h2><p>爆発・貫通・迎撃 · 約7分の作戦</p><small>旧版の所持品・進行はそのまま保護</small>`;
  const translations = [
    "戦術作戦本部",
    "ソロ出撃",
    "1〜4人協力",
    "旧版へ戻る",
    "進行・解放",
  ];
  $("ui")
    .querySelectorAll<HTMLElement>(
      ".title>.eyebrow,.title-actions button small",
    )
    .forEach((e, i) => (e.textContent = translations[i] ?? ""));
  $("ui").querySelector(".command-heading .eyebrow")!.textContent =
    "出撃メニュー";
  $("solo").onclick = () => prep();
  $("coop").onclick = () => prep(true);
  $("open-armory").querySelector("b")!.textContent = "旧版で遊ぶ";
  $("open-armory").setAttribute("aria-label", "旧版で遊ぶ");
  $("open-armory").querySelector("em")!.textContent =
    "従来の所持武器・進行を使う";
  $("open-armory").onclick = () => {
    location.href = import.meta.env.BASE_URL;
  };
  $("open-bestiary").querySelector("b")!.textContent =
    `${progress.progress.wins}勝 · ${progress.progress.credits}功績`;
  $("open-bestiary").setAttribute("aria-label", "改装版の進行と解放");
  $("ui").querySelector(".home-next-stage")!.textContent =
    "迎撃戦・防衛戦を選んで出撃";
  $("open-bestiary").querySelector("em")!.textContent =
    `初期候補 ${progress.progress.unlocks.length}/9種を解放`;
  $("open-bestiary").onclick = () => {
    notice("初期候補は勝利ごとに1種解放。出撃準備で系統ごとに選べます。", 5);
  };
  $("ui").querySelector(".home-utilities")!.innerHTML =
    '<button id="front-help">操作</button>';
  $("front-help").onclick = () =>
    notice(
      "移動：WASD · 射撃：クリック · 装填：R · 切替：Q · 回避：Space · ジャンプ：F · 蘇生：E",
      8,
    );
  $("ui").querySelector(".fine")!.textContent =
    "改装版の進行はこの端末に独立保存。通常戦は繰り返し、日替わり勝利報酬は1日1回。";
  $("ui").querySelector(".home-footer")!.remove();
  $("ui").querySelector("#export")?.remove();
}
function prep(coop = false) {
  screen = "prep";
  document.body.dataset.screen = "prep";
  const progress = readFrontProgress(progressStorage).progress;
  $("ui").innerHTML =
    `<section class="panel front-prep"><header><h1>出撃準備</h1><button id="front-back">戻る</button></header><div class="front-prep-controls"><label>作戦<select id="front-mode">${Object.entries(
      modeNames,
    )
      .map(
        ([value, name]) =>
          `<option value="${value}" ${mode === value ? "selected" : ""}>${name}</option>`,
      )
      .join(
        "",
      )}</select></label><button id="front-launch" class="primary">${coop ? "部屋を作る・参加" : "出撃"}</button></div><div class="front-weapon-table" role="group" aria-label="支給武器"><div class="front-weapon-head"><span>武器</span><span>威力</span><span>間隔</span><span>弾倉</span><span>装填</span><span>射程</span><span>装備</span></div>${(
      ["rifle", "shotgun", "smg"] as FrontWeaponKind[]
    )
      .map((kind) => {
        const d = WEAPONS[kind];
        return `<div class="front-weapon-row"><b>${d.name}</b><span>${d.damage}${d.pellets > 1 ? `×${d.pellets}` : ""}</span><span>${d.interval}秒</span><span>${d.mag}</span><span>${d.reload}秒</span><span>${d.range}</span><button data-weapon="${kind}" aria-pressed="${kinds.includes(kind)}">${kinds.includes(kind) ? `${kinds.indexOf(kind) + 1}枠目` : "装備"}</button></div>`;
      })
      .join(
        "",
      )}</div><div class="front-initial" role="group" aria-label="最初の候補">${Object.entries(
      FRONT_FAMILY_CARDS,
    )
      .map(
        ([family, cards]) =>
          `<label>${familyNames[family as keyof typeof familyNames]}<select data-initial="${family}" ${coop || mode === "daily" ? "disabled" : ""}>${cards
            .filter((card) => progress.unlocks.includes(card))
            .map(
              (card) =>
                `<option value="${card}">${FRONT_UPGRADE_CATALOG[card].name}</option>`,
            )
            .join("")}</select></label>`,
      )
      .join("")}</div></section>`;
  $("front-back").onclick = home;
  $("front-mode").onchange = () => {
    mode = ($("front-mode") as HTMLSelectElement).value as FrontMode;
    prep(coop);
  };
  $("ui")
    .querySelectorAll<HTMLButtonElement>("[data-weapon]")
    .forEach(
      (button) =>
        (button.onclick = () => {
          const kind = button.dataset.weapon as FrontWeaponKind;
          if (!kinds.includes(kind)) kinds = [kinds[1], kind];
          prep(coop);
        }),
    );
  $("front-launch").onclick = () => {
    if (coop) rooms();
    else void solo();
  };
}
async function solo() {
  const initialCards = [
    ...$("ui").querySelectorAll<HTMLSelectElement>("[data-initial]"),
  ].map((select) => select.value as FrontUpgradeId);
  localRun = createFrontRun(
    {
      runId: crypto.randomUUID(),
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
      mode,
      players: [{ id, weapons: kinds, initialCards }],
    },
    now(),
  );
  setView();
  await loadBattle();
}
async function loadBattle() {
  if (!world) return;
  const current = ++loadSerial;
  screen = "loading";
  ready = false;
  clearInput();
  document.body.dataset.screen = "battle";
  $("ui").innerHTML =
    '<section class="pause-card rebuild-panel"><h1>戦場を準備中</h1><output id="front-loading">0%</output></section>';
  try {
    if (
      network?.assetReady &&
      world.stage === network.stage &&
      world.players.every((p) => view.players.get(p.id)?.userData.trooper)
    ) {
      view.render(world, id, 0, 0, 0, undefined, false);
    } else
      await prepareBattle(
        view,
        world,
        id,
        () => current !== loadSerial,
        (n) => {
          const el = document.getElementById("front-loading");
          if (el) el.textContent = `${n}%`;
        },
      );
    if (current !== loadSerial) return;
    ready = true;
    screen = "battle";
    overlayKey = "";
    paintOverlay();
  } catch (error) {
    if (current !== loadSerial) return;
    $("ui").innerHTML =
      `<section class="pause-card rebuild-panel"><h1>読み込みを完了できませんでした</h1><p>${esc((error as Error).message)}</p><button id="front-back">戻る</button></section>`;
    $("front-back").onclick = leave;
  }
}
function endpoint() {
  return (
    import.meta.env.VITE_SERVER_URL ??
    (import.meta.env.PROD ? `${location.origin}/api` : "http://127.0.0.1:8787")
  );
}
let turnstileToken = "";
async function mountHumanCheck() {
  const holder = document.getElementById("turnstile-room-create");
  if (!holder) return;
  turnstileToken = "";
  if (
    ["localhost", "127.0.0.1"].includes(
      new URL(($("endpoint") as HTMLInputElement).value).hostname,
    )
  ) {
    holder.textContent = "ローカルでは作成キーを使用します。";
    return;
  }
  try {
    const res = await fetch(endpoint() + "/turnstile-config", {
        signal: AbortSignal.timeout(7000),
      }),
      data = await res.json();
    if (!res.ok || typeof data.siteKey !== "string") throw Error();
    const api = () =>
      (
        window as unknown as {
          turnstile?: {
            render: (el: HTMLElement, options: Record<string, unknown>) => void;
          };
        }
      ).turnstile;
    if (!api())
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.onload = () => resolve();
        script.onerror = () => reject(Error());
        document.head.append(script);
      });
    if (!holder.isConnected) return;
    api()!.render(holder, {
      sitekey: data.siteKey,
      theme: "dark",
      action: "create-room",
      callback: (token: string) => {
        turnstileToken = token;
      },
      "expired-callback": () => {
        turnstileToken = "";
      },
      "error-callback": () => {
        turnstileToken = "";
      },
    });
  } catch {
    if (holder.isConnected)
      holder.textContent =
        "人間確認を読み込めません。部屋への参加は利用できます。";
  }
}
function rooms() {
  screen = "rooms";
  $("ui").innerHTML = roomBrowserMarkup(endpoint(), status).replace(
    "CO-OP / SQUAD",
    "改装版 · 1〜4人",
  );
  $("home").onclick = home;
  const current = $("ui").firstElementChild as HTMLElement;
  bindRoomBrowser(
    current,
    async (code) => {
      connectRoom(code, ($("endpoint") as HTMLInputElement).value);
    },
    "front-v1",
  );
  $("launch").onclick = async () => {
    const button = $("launch") as HTMLButtonElement;
    button.disabled = true;
    try {
      const target = new URL(($("endpoint") as HTMLInputElement).value);
      if (
        !["http:", "https:"].includes(target.protocol) ||
        target.username ||
        target.password
      )
        throw Error("接続先を確認してください");
      const net = new FrontNetwork(target.href.replace(/\/$/, ""));
      try {
        const code = await net.create(
          turnstileToken,
          ($("creation-key") as HTMLInputElement).value,
          {
            name: ($("room-name") as HTMLInputElement).value,
            listed:
              ($("room-visibility") as HTMLSelectElement).value === "public",
            ruleset: "front-v1",
            mode,
          },
        );
        connectRoom(code, net.endpoint);
      } finally {
        net.close();
        turnstileToken = "";
      }
    } catch (error) {
      notice((error as Error).message, 5);
      if (button.isConnected) {
        button.disabled = false;
        void mountHumanCheck();
      }
    }
  };
  void mountHumanCheck();
  const session = loadFrontNetworkSession();
  if (session) {
    const button = document.createElement("button");
    button.textContent = "切断した部隊へ復帰";
    button.onclick = () =>
      connectRoom(session.code, session.endpoint, session.token);
    current.querySelector("header")!.append(button);
  }
}
function connectRoom(code: string, target: string, token = "") {
  connectionFatal = "";
  network?.close();
  network = new FrontNetwork(target);
  localRun = null;
  world = null;
  info = null;
  preparedGeneration = -1;
  screen = "lobby";
  ready = false;
  const net = network;
  net.equip = frontTemporaryWeapons("front-lobby", "front-client", kinds);
  net.onStatus = (message, fatal) => {
    status = message;
    if (fatal) {
      connectionFatal = message;
      clearInput();
    }
    notice(message, 5);
    if (screen === "lobby") paintLobby();
  };
  net.ready = () => {
    id = net.id;
    mode = net.mode;
    paintLobby();
  };
  net.onLobby = () => {
    screen = "lobby";
    paintLobby();
    void prepareLobby();
  };
  net.onWorld = (snapshot, first) => {
    if (!net.frontView || snapshot.front?.version !== "front-v1") {
      notice("改装版の戦場を確認できません");
      return;
    }
    const phase = info?.phase;
    const evolvedCount = info?.evolved.length ?? 0;
    world = snapshot;
    info = net.frontView;
    if (info.evolved.length > evolvedCount)
      notice(
        `自動進化 · ${info.evolved.map((f) => FRONT_EVOLUTIONS[f].name).join("・")}`,
        4,
      );
    if (
      phase !== info.phase ||
      info.phase === "selection" ||
      now() < info.resumeUntil
    )
      clearInput();
    if (first) {
      void loadBattle();
    } else if (screen !== "loading") {
      screen = "battle";
      paintOverlay();
    }
  };
  net.connect(code, token);
  paintLobby();
}
function paintLobby() {
  if (!network || screen !== "lobby") return;
  const net = network;
  $("ui").innerHTML =
    `<section class="panel front-lobby"><header><h1>${modeNames[net.mode]} · 協力部隊</h1><button id="front-leave">退出</button></header><p>部屋ID <b>${esc(net.roomId || "接続中")}</b> <button id="front-copy">招待をコピー</button></p><div class="front-members">${net.members
      .filter((m) => m.connected)
      .map(
        (m) =>
          `<p>${esc(m.name ?? "隊員")} · ${m.ready ? "準備完了" : "読み込み中"}</p>`,
      )
      .join(
        "",
      )}</div><p class="status">${esc(status)}</p><button class="primary" id="front-start" ${net.members.find((m) => m.connected)?.id !== net.id || !net.members.filter((m) => m.connected).every((m) => m.ready) ? "disabled" : ""}>出撃</button></section>`;
  $("front-leave").onclick = leave;
  $("front-start").onclick = () => net.send({ type: "start" });
  $("front-copy").onclick = () => {
    const url = new URL(location.href);
    url.searchParams.set("frontRoom", net.roomId);
    void navigator.clipboard.writeText(url.href).then(
      () => notice("招待をコピーしました"),
      () => notice(`部屋ID：${net.roomId}`, 8),
    );
  };
}
async function prepareLobby() {
  const net = network;
  if (
    !net ||
    net.assetReady ||
    preparedGeneration === net.preparationGeneration
  )
    return;
  const generation = net.preparationGeneration;
  const members = net.members.filter((member) => member.connected);
  if (!members.length || members.some((member) => member.weapons?.length !== 2))
    return;
  preparedGeneration = generation;
  const previousPreparation = lobbyPreparation;
  let finished!: () => void;
  lobbyPreparation = new Promise<void>((resolve) => {
    finished = resolve;
  });
  const preview = createFrontRun(
    {
      runId: "front-preview",
      seed: 1,
      mode: net.mode,
      players: members.map((member) => ({
        id: member.id,
        weapons: member.weapons!.map(
          (weapon) => weapon.kind as FrontWeaponKind,
        ),
      })),
    },
    now(),
  );
  preview.world.stage = net.stage;
  try {
    await previousPreparation;
    if (
      network !== net ||
      screen !== "lobby" ||
      net.preparationGeneration !== generation
    )
      return;
    await prepareBattle(
      view,
      preview.world,
      net.id,
      () =>
        network !== net ||
        screen !== "lobby" ||
        net.preparationGeneration !== generation,
      (percentage) => {
        if (network !== net || net.preparationGeneration !== generation) return;
        status = `戦場を準備中 ${percentage}%`;
        paintLobby();
      },
    );
    if (network === net) {
      net.setAssetReady(true, generation);
      paintLobby();
    }
  } catch (error) {
    if (network === net && net.preparationGeneration === generation) {
      preparedGeneration = -1;
      status = `${status} · ${(error as Error).message}`;
      paintLobby();
    }
  } finally {
    finished();
  }
}
function request(offer: NonNullable<FrontRunView["offer"]>) {
  return {
    runId: world!.run,
    offerId: offer.id,
    revision: offer.revision,
    requestId: `${world!.run}:${id}:${++requestSerial}`,
  };
}
function choose(cardId: FrontUpgradeId) {
  if (
    !info?.offer ||
    choiceFeedbackUntil ||
    performance.now() < actionLockUntil
  )
    return;
  if (!localRun && (!network || network.closed || network.ws?.readyState !== 1))
    return;
  const offer = info.offer,
    req = { ...request(offer), cardId };
  clearInput();
  const before = info.evolved.length;
  if (localRun) {
    if (!chooseFrontUpgrade(localRun, id, req, now())) return;
    setView();
    if (info!.evolved.length > before)
      notice(
        `自動進化 · ${info!.evolved.map((f) => FRONT_EVOLUTIONS[f].name).join("・")}`,
        4,
      );
  } else network?.send({ type: "frontChoose", request: req });
  sound.unlock();
  sound.play("menu");
  choiceFeedbackUntil =
    performance.now() + FRONT_RUN_CONFIG.resumeSeconds * 1000;
  actionLockUntil = choiceFeedbackUntil;
  const selection = $("ui").querySelector<HTMLElement>(".rebuild-selection");
  if (selection) {
    selection.style.setProperty(
      "--choice-feedback-ms",
      `${FRONT_RUN_CONFIG.resumeSeconds * 1000}ms`,
    );
    selection.classList.add("is-choosing");
    selection
      .querySelectorAll<HTMLButtonElement>("button")
      .forEach((button) => {
        button.disabled = true;
        if (button.dataset.card)
          button.classList.add(
            button.dataset.card === cardId ? "is-picked" : "is-dismissed",
          );
      });
  }
  paintOverlay();
}
function pause() {
  if (screen !== "battle" || !ready) return;
  choiceFeedbackUntil = 0;
  clearInput();
  pauseRebuildUi(
    gate,
    network
      ? "自分の操作を停止中。部隊の戦闘は続きます。"
      : "戦闘を一時停止しています。",
  );
  paintOverlay();
}
function paintOverlay() {
  if (screen !== "battle" || !ready || !info || !world) return;
  if (settings.opened) return;
  if (
    choiceFeedbackUntil &&
    !gate.paused &&
    !connectionFatal &&
    info.phase !== "victory" &&
    info.phase !== "defeat"
  )
    return;
  const offer = info.offer,
    key = [
      connectionFatal,
      world.run,
      gate.paused,
      info.phase,
      offer?.id,
      info.picks,
      info.rerollsRemaining,
      info.resumeUntil > now(),
      rewardText,
    ].join(":");
  if (key === overlayKey) return;
  overlayKey = key;
  const ui = $("ui");
  ui.dataset.phase = info.phase;
  $("pause").hidden =
    gate.paused || info.phase === "victory" || info.phase === "defeat";
  if (connectionFatal) {
    ui.innerHTML = `<section class="pause-card rebuild-panel"><h1>接続を終了しました</h1><p>${esc(connectionFatal)}</p><button id="front-leave" class="primary">出撃メニューへ</button></section>`;
    $("front-leave").onclick = leave;
  } else if (gate.paused) {
    ui.innerHTML = `<section class="pause-card rebuild-panel front-pause"><header><h1>${network ? "操作を停止中" : "一時停止"}</h1><button id="front-resume" class="primary">再開</button></header><p class="front-pause-note">${gate.pauseReason}</p>${frontUpgradeDetails(info, import.meta.env.BASE_URL)}<div class="pause-actions"><button id="front-settings">設定・操作</button><button id="front-leave">出撃メニューへ</button></div></section>`;
    $("front-settings").onclick = () =>
      settings.open(ui, () => {
        overlayKey = "";
        clearInput();
        paintOverlay();
      });
    $("front-resume").onclick = () => {
      clearInput();
      resumeRebuildUi(gate, false);
      paintOverlay();
    };
    $("front-leave").onclick = leave;
  } else if (info.phase === "selection" && offer) {
    ui.innerHTML = `<section class="pause-card rebuild-panel rebuild-selection"><header><h1 class="front-choice-title">強化を選べ</h1><div class="rebuild-selection-actions">${info.selectionDeadline !== null ? '<span id="front-countdown"></span>' : ""}${offer.kind === "additional" ? `<button id="rebuild-reroll" ${info.canReroll ? "" : "disabled"}>再抽選 残り${info.rerollsRemaining}</button>` : ""}</div></header><div class="rebuild-cards">${offer.cardIds
      .map((card) => {
        const d = FRONT_UPGRADE_CATALOG[card];
        return `<button class="rebuild-card" data-card="${card}" aria-label="${d.name}：${esc(d.description)}"><img class="rebuild-card-icon" src="${import.meta.env.BASE_URL}rebuild/upgrades/${card}.png" alt="" width="96" height="96"><span class="rebuild-card-kind">${familyNames[d.family]}</span><strong>${d.name}</strong><span class="rebuild-card-description">${upgradeCopy[card]}</span></button>`;
      })
      .join("")}</div></section>`;
    ui.querySelectorAll<HTMLButtonElement>("[data-card]").forEach(
      (button) =>
        (button.onclick = () => choose(button.dataset.card as FrontUpgradeId)),
    );
    const reroll = document.getElementById("rebuild-reroll");
    if (reroll)
      reroll.onclick = () => {
        if (performance.now() < actionLockUntil) return;
        const req = request(offer);
        if (localRun) {
          rerollFrontRunOffer(localRun, id, req, now());
          setView();
        } else network?.send({ type: "frontReroll", request: req });
        actionLockUntil = performance.now() + 300;
        paintOverlay();
      };
  } else if (info.phase === "selection") {
    ui.innerHTML =
      '<div class="rebuild-resume-cue" role="status">部隊の選択を待っています<span id="front-countdown"></span></div>';
  } else if (info.phase === "victory" || info.phase === "defeat") {
    ui.innerHTML = `<section class="pause-card rebuild-panel"><header><h1>${info.phase === "victory" ? "作戦成功" : "任務終了"}</h1><button id="front-leave" class="primary">出撃メニューへ</button></header><p>${esc(world.reason)}</p><div class="rebuild-result"><b>${formatRebuildTime(world.time)}</b><b>取得 ${info.picks}/7</b><b>最大 ${info.maxChain}連鎖</b></div><p>${info.evolved.map((f) => FRONT_EVOLUTIONS[f].name).join("・") || "未進化"}</p><p>${esc(rewardText)}</p></section>`;
    $("front-leave").onclick = leave;
  } else ui.replaceChildren();
}
const marks = new T.InstancedMesh(
  new T.TorusGeometry(0.62, 0.1, 4, 12),
  new T.MeshBasicMaterial({ color: 0xffcb69 }),
  FRONT_RUN_CONFIG.enemyCap + 1,
);
const orbs = new T.InstancedMesh(
  new T.OctahedronGeometry(0.3),
  new T.MeshBasicMaterial({ color: 0x98ebc8 }),
  160,
);
const mines = new T.InstancedMesh(
  new T.CylinderGeometry(0.55, 0.7, 0.15, 12),
  new T.MeshBasicMaterial({ color: 0x98ebc8 }),
  12,
);
const marker = new T.Object3D();
const warnings = new T.InstancedMesh(
  new T.TorusGeometry(1, 0.05, 4, 32),
  new T.MeshBasicMaterial({
    color: 0xffcb69,
    transparent: true,
    opacity: 0.75,
  }),
  32,
);
warnings.frustumCulled = false;
marks.count = orbs.count = mines.count = warnings.count = 0;
marks.frustumCulled = orbs.frustumCulled = mines.frustumCulled = false;
view.scene.add(marks, orbs, mines, warnings);
function paintBattle() {
  if (!world || !info) return;
  const p = world.players.find((p) => p.id === id);
  if (!p) return;
  const hud = hudMarkup(world, id, status, info.maxHp, undefined, {
    mission: `${modeNames[info.mode]} · ${formatRebuildTime(world.time)}`,
    detail: `経験値 ${info.xp}${info.nextXpThreshold === null ? "" : `/${info.nextXpThreshold}`}${world.defense ? ` · 拠点 ${Math.max(0, Math.ceil(world.defense.armory.hp))}` : ""}${world.time >= 480 ? ` · 残り ${Math.max(0, Math.ceil(540 - world.time))}秒` : ""}`,
    weapon: `強化 ${info.picks}/7${info.evolved.length ? ` · ${info.evolved.map((f) => FRONT_EVOLUTIONS[f].name).join("・")}` : ""}`,
    help: `WASD 移動 · マウス 照準/射撃 · R 装填 · Q 切替 · SPACE 回避 · F ジャンプ${world.players.length > 1 ? " · E 蘇生" : ""}`,
  });
  const upgradeStrip = frontUpgradeStrip(info, import.meta.env.BASE_URL);
  if (lastHud !== hud + upgradeStrip) {
    $("hud").innerHTML = hud;
    $("hud")
      .querySelector(".weapon-hud")
      ?.insertAdjacentHTML("beforeend", upgradeStrip);
    lastHud = hud + upgradeStrip;
  }
  minimap.draw(world, id, controls.input.yaw, performance.now());
  const state = world.front!;
  let count = 0;
  for (const e of world.enemies)
    if (
      e.hp > 0 &&
      state.players[id]?.statuses[e.id]?.marked &&
      count < FRONT_RUN_CONFIG.enemyCap + 1
    ) {
      marker.position.set(e.x, eye(e) + 0.8, e.z);
      marker.quaternion.copy(view.camera.quaternion);
      marker.updateMatrix();
      marks.setMatrixAt(count++, marker.matrix);
    }
  marks.count = count;
  marks.instanceMatrix.needsUpdate = true;
  marker.rotation.set(0, 0, 0);
  count = 0;
  for (const orb of state.orbs) {
    marker.position.set(orb.x, orb.y + 0.45, orb.z);
    marker.updateMatrix();
    orbs.setMatrixAt(count++, marker.matrix);
  }
  orbs.count = count;
  orbs.instanceMatrix.needsUpdate = true;
  count = 0;
  for (const mine of state.mines) {
    marker.position.set(mine.x, mine.y + 0.12, mine.z);
    marker.updateMatrix();
    mines.setMatrixAt(count++, marker.matrix);
  }
  mines.count = count;
  mines.instanceMatrix.needsUpdate = true;
  count = 0;
  marker.rotation.set(Math.PI / 2, 0, 0);
  for (const warning of info.spawnWarnings) {
    if (count >= 32) break;
    marker.position.set(warning.x, 0.08, warning.z);
    marker.scale.setScalar(warning.radius);
    marker.updateMatrix();
    warnings.setMatrixAt(count++, marker.matrix);
  }
  warnings.count = count;
  warnings.instanceMatrix.needsUpdate = true;
  marker.scale.setScalar(1);
  const countdown = document.getElementById("front-countdown");
  if (countdown && info.selectionDeadline !== null)
    countdown.textContent = `残り ${Math.max(0, Math.ceil(info.selectionDeadline - now()))}秒`;
}
function frame(time: number) {
  requestAnimationFrame(frame);
  const wallDt = Math.max(0, (time - previous) / 1000),
    dt = Math.min(0.1, wallDt);
  previous = time;
  if (choiceFeedbackUntil && time >= choiceFeedbackUntil) {
    choiceFeedbackUntil = 0;
    overlayKey = "";
    clearInput();
  }
  let active =
    screen === "battle" &&
    ready &&
    !gate.paused &&
    !document.hidden &&
    !!info &&
    (info.phase === "combat" || info.phase === "boss") &&
    now() >= info.resumeUntil &&
    !choiceFeedbackUntil &&
    (!network || (!network.closed && network.ws?.readyState === 1));
  controls.enabled = active;
  controls.setScopeAvailable(active);
  if (
    localRun &&
    ready &&
    !gate.paused &&
    !document.hidden &&
    !choiceFeedbackUntil
  ) {
    if (active) {
      accumulator += dt;
      while (accumulator >= 0.05 && active) {
        const phase = localRun.phase;
        stepFrontRun(localRun, { [id]: controls.read() }, 0.05, now());
        accumulator -= 0.05;
        if (phase !== localRun.phase) {
          clearInput();
          active = false;
        }
      }
    } else {
      accumulator = 0;
      stepFrontRun(localRun, {}, 0.05, now());
    }
    setView();
  } else if (network && active) network.input(controls.read());
  $("controls").hidden = !active;
  $("minimap").hidden =
    screen !== "battle" ||
    !ready ||
    !info ||
    (info.phase !== "combat" && info.phase !== "boss");
  $("scope-overlay").hidden = !controls.scoped;
  updateScopeButtons(settings.layout, {
    visible: active,
    available: controls.scopeAvailable,
    scoped: controls.scoped,
  });
  if (time > noticeUntil) $("rebuild-notice").hidden = true;
  if (screen === "battle" && ready && world && info) {
    if (
      (info.phase === "victory" || info.phase === "defeat") &&
      awardedRun !== world.run
    ) {
      const result = awardFrontProgress(progressStorage, {
        id: world.run,
        won: info.phase === "victory",
        mode: info.mode,
        day: info.day,
        at: Date.now(),
      });
      awardedRun = world.run;
      rewardText = result.saved
        ? `功績 +${result.reward} · 初期候補 ${result.progress.unlocks.length}/9種を解放`
        : result.error;
    }
    paintOverlay();
    paintBattle();
    $("revive").hidden = world.players.length <= 1;
    updateCooldowns(world, id, world.players.length <= 1);
    for (const buttonId of ["dodge", "reload", "revive"]) {
      const detail = document.querySelector(`#${buttonId} small`);
      if (detail?.textContent)
        detail.textContent = detail.textContent
          .replace("READY", "準備完了")
          .replace(/s$/, "秒");
    }
    sound.update(world, id, controls.input.yaw, active);
    const renderKey = [
      world.run,
      world.time,
      info.phase,
      info.picks,
      controls.input.yaw,
      controls.input.pitch,
      innerWidth,
      innerHeight,
    ].join(":");
    if (
      active ||
      (network && (info.phase === "combat" || info.phase === "boss")) ||
      renderKey !== lastRenderKey
    ) {
      view.render(
        world,
        id,
        dt,
        controls.input.yaw,
        controls.input.pitch,
        undefined,
        active,
        controls.scoped,
        controls.aiming,
      );
      lastRenderKey = renderKey;
    }
    if (localRun)
      retireEvents(
        world,
        Math.min(view.consumed(world.run), sound.consumed(world.run)),
      );
  }
}
window.addEventListener(
  "keydown",
  (event) => {
    if (!acceptRebuildKeydown(event.code, event.repeat, controls.keys)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  { capture: true },
);
$("pause").onclick = pause;
window.addEventListener("keydown", (event) => {
  if (event.code === "Escape") {
    event.preventDefault();
    pause();
  }
});
window.addEventListener("blur", () => {
  if (screen === "battle") pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && screen === "battle") pause();
});
window.addEventListener("pagehide", clearInput);
window.addEventListener("resize", () => placeControls(settings.layout));
window.visualViewport?.addEventListener("resize", () =>
  placeControls(settings.layout),
);
placeControls(settings.layout);
home();
const invitation = new URL(location.href).searchParams.get("frontRoom");
if (invitation && /^[A-Fa-f0-9]{8}$/.test(invitation)) {
  rooms();
  ($("room-id") as HTMLInputElement).value = invitation;
  notice("部屋IDを確認し、参加を押してください", 5);
}
requestAnimationFrame(frame);
