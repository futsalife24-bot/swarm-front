import { backgroundMusic } from "./client/bgm";
import { installCloudSync } from "./client/cloud-save";
installCloudSync();
import { resourceFrame } from "./client/resource-frame";
import { newSaveKey } from "./client/progression-save";
import {
  CAPACITY,
  GRADES,
  weaponGrade,
  weaponYield,
  weaponTier,
  type NewWeapon,
} from "./shared/progression";
import {
  loadSharedCoopSave,
  persistSharedCoopSave,
} from "./client/shared-armory";
import { prepareBattle } from "./client/battle-loading";
import { playerName, addPlayerNameSetting } from "./client/player-profile";
import { enhanceGameSelects, syncGameSelects } from "./client/game-select";
import { updateScopeButtons } from "./client/layout";
import "./client/coop-lobby.css";
import { roomBrowserMarkup, bindRoomBrowser } from "./client/room-browser";
import { homeMarkup } from "./client/home-screen";
import { openDeveloperLogin } from "./client/developer-access";
import { STAGES, MAPS, mapFor, stageFor } from "./shared/stages";
import { recordCoopEncounters } from "./client/progression-coop";
let selectedStage = 1;
const stageOptions = () =>
  STAGES.map(
    (s) =>
      `<option value="${s.id}" ${s.id === selectedStage ? "selected" : ""}>${String(s.id).padStart(2, "0")} ${s.name} / ${MAPS[s.map].name}</option>`,
  ).join("");
import "./style.css";
import "./mobile-ui.css";
import "./menu-ui.css";
import "./menu-theme.css";
import "./client/stage-clear.css";
import { menuDialog, menuIcon, restoreMenuPosition } from "./client/menu-ui";
import {
  defaultLayout,
  parseLayout,
  placeControls,
  LAYOUT_KEY,
} from "./client/layout";
import { openLayoutEditor } from "./client/layout-editor";
import { hudMarkup, updateCooldowns } from "./client/hud";
import { Minimap } from "./client/minimap";
import { weaponDetails } from "./client/reward-choice";
import {
  kindHelp,
  effectHelp,
  effectText,
  kindSummary,
} from "./client/weapon-help";
import { openBestiary } from "./client/bestiary";
import { CHANGELOG } from "./client/changelog";
import {
  effectLabel,
  WAVE_INTERVAL,
  MOVE_SPEED,
  ROLL,
  LOWER_IS_BETTER,
  stats,
  type Roll,
  WEAPONS,
  type Weapon,
  type Kind,
} from "./shared/defs";
import {
  addPlayer,
  createWorld,
  move,
  neutral,
  start,
  step,
  type World,
} from "./shared/game";
import { Controls } from "./client/input";
import { installLandscapeGuard } from "./client/landscape";
import { installZoomGuard } from "./client/zoom-guard";
import { Renderer } from "./client/render";
import { Sound } from "./client/audio";
import { loadNetworkSession, Network } from "./client/network";
import {
  fresh,
  bankRewards,
  dismantleWeapons,
  POWDER_NAME,
  SAVE_KEY,
  type Save,
} from "./client/save";
const $ = (id: string) => document.getElementById(id)!;
installZoomGuard();
interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      theme: "dark";
      action: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ): string;
  reset(widgetId?: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}
const showFps = new URLSearchParams(location.search).get("qa") === "1";
const ui = $("ui"),
  hud = $("hud"),
  controls = new Controls(),
  minimap = new Minimap(),
  sound = new Sound();
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let installPrompt: InstallPromptEvent | undefined;
let layout = defaultLayout(),
  layoutWarning = "";
try {
  layout = parseLayout(localStorage.getItem(LAYOUT_KEY));
} catch (e) {
  layoutWarning = (e as Error).message;
}
let view: Renderer;
let save: Save = fresh(),
  saveError = "",
  world: World | null = null,
  mode: "solo" | "coop" = "solo",
  screen = "title",
  network: Network | undefined,
  myId = "solo",
  status = "",
  resultRun = "",
  clearRun = "",
  clearStartedAt = 0,
  netFatal = false,
  predicted: { x: number; z: number; y?: number } | undefined;
let turnstileToken = "";
let loadingGeneration = 0;
let lobbyPreview: World | null = null;
let preparedKey = "";
let preparingKey = "";
let preparationMessage = "";
window.addEventListener("swarm-invite-leave", () => {
  network?.close();
  network = undefined;
});
window.addEventListener("player-name-changed", () =>
  network?.setPlayerName(playerName()),
);

function renderLobbyChat() {
  const log = document.getElementById("chat-log");
  if (!log || !network) return;
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 36;
  const ids = new Set(
    [...log.children].map((el) => (el as HTMLElement).dataset.id),
  );
  for (const message of network.messages) {
    if (ids.has(message.id)) continue;
    const row = document.createElement("li");
    row.dataset.id = message.id;
    const name = document.createElement("b");
    name.textContent = message.name;
    const text = document.createElement("span");
    text.textContent = message.text;
    row.append(name, text);
    log.append(row);
  }
  while (log.children.length > 50) log.firstElementChild?.remove();
  if (atBottom) log.scrollTop = log.scrollHeight;
}

async function prepareLobby() {
  const connection = network;
  if (
    !connection?.id ||
    !["lobby", "gear", "armory", "layout"].includes(screen)
  )
    return;
  const members = connection.members.filter((m) => m.connected);
  if (!members.length || members.some((m) => !m.weapons?.length)) return;
  const currentKey = () =>
    JSON.stringify([
      connection.code,
      connection.preparationGeneration,
      connection.stage,
      connection.members
        .filter((m) => m.connected)
        .map((m) => [m.id, m.weapons?.map((w) => [w.id, w.kind, w.rarity])]),
      save.quality,
    ]);
  const key = currentKey();
  const preparationGeneration = connection.preparationGeneration;
  if (key === preparedKey) {
    if (!connection.assetReady)
      connection.setAssetReady(true, preparationGeneration);
    return;
  }
  if (key === preparingKey) return;
  const generation = ++loadingGeneration;
  preparedKey = "";
  preparingKey = key;
  connection.setAssetReady(false);
  lobbyPreview = createWorld("preview", 1, connection.stage);
  for (const member of members)
    addPlayer(lobbyPreview, member.id, member.weapons!);
  const cancelled = () =>
    generation !== loadingGeneration ||
    currentKey() !== key ||
    network !== connection ||
    ["battle", "loading", "title", "error"].includes(screen);
  try {
    await prepareBattle(
      view,
      lobbyPreview,
      connection.id,
      cancelled,
      (percent) => {
        preparationMessage = `戦場を準備中 ${percent}%`;
        const line = ui.querySelector(".lobby-actions .status");
        if (line) line.textContent = preparationMessage;
      },
    );
    if (cancelled()) return;
    preparedKey = key;
    preparingKey = "";
    preparationMessage = "";
    connection.setAssetReady(true, preparationGeneration);
    if (screen === "lobby") lobby();
  } catch (error) {
    if (cancelled()) return;
    preparingKey = "";
    preparationMessage = (error as Error).message;
    const line = ui.querySelector(".lobby-actions .status");
    if (line) line.textContent = preparationMessage;
    const retry = document.createElement("button");
    retry.textContent = "再読み込みして再接続";
    retry.onclick = () => location.reload();
    ui.querySelector(".lobby-actions")?.append(retry);
  } finally {
    if (generation === loadingGeneration && preparingKey === key)
      preparingKey = "";
  }
}

async function loadBattle(soloStart: boolean) {
  if (!world) return;
  const generation = ++loadingGeneration;
  const loadingWorld = world;
  lobbyPreview = null;
  preparingKey = "";
  setScreen("loading");
  ui.innerHTML =
    '<section class="panel battle-loading"><h1>戦場を準備中</h1><progress max="100" value="0"></progress><p id="load-status" role="status">マップ・兵士・武器を読み込んでいます</p><button id="load-cancel">出撃を中止</button></section>';
  $("load-cancel").onclick = () => {
    network?.close();
    network = undefined;
    title();
  };
  const cancelled = () =>
    generation !== loadingGeneration ||
    screen !== "loading" ||
    world?.run !== loadingWorld.run;
  try {
    await prepareBattle(view, loadingWorld, myId, cancelled, (percent) => {
      ui.querySelector<HTMLProgressElement>("progress")!.value = percent;
      $("load-status").textContent = `戦場を準備中 ${percent}%`;
    });
    if (cancelled()) return;
    if (soloStart) start(loadingWorld);
    battle();
  } catch (error) {
    if (cancelled()) return;
    $("load-status").textContent = (error as Error).message;
    const retry = document.createElement("button");
    retry.textContent = "再読み込み";
    retry.onclick = () => location.reload();
    ui.firstElementChild?.append(retry);
  }
}
// Which loadout slot the armoury is filling. Picking a weapon replaces this one.
let activeSlot = 0;
function defaultEndpoint() {
  return (
    import.meta.env.VITE_SERVER_URL ??
    (import.meta.env.PROD ? `${location.origin}/api` : "http://127.0.0.1:8787")
  );
}
async function mountTurnstile(endpoint: string) {
  const holder = document.getElementById("turnstile-room-create");
  if (!holder) return;
  turnstileToken = "";
  holder.textContent = "人間確認を準備中…";
  try {
    const response = await fetch(
      `${endpoint.replace(/\/$/, "")}/turnstile-config`,
      {
        signal: AbortSignal.timeout(7000),
      },
    );
    const data: unknown = await response.json();
    const siteKey =
      data &&
      typeof data === "object" &&
      typeof (data as { siteKey?: unknown }).siteKey === "string"
        ? (data as { siteKey: string }).siteKey
        : "";
    if (!response.ok || !siteKey) throw new Error("設定未完了");
    const render = () => {
      if (!document.body.contains(holder)) return;
      if (!window.turnstile) {
        setTimeout(render, 50);
        return;
      }
      holder.textContent = "";
      window.turnstile.render(holder, {
        sitekey: siteKey,
        theme: "dark",
        action: "create-room",
        callback: (token) => {
          turnstileToken = token;
          const launch = document.getElementById(
            "launch",
          ) as HTMLButtonElement | null;
          if (launch) launch.disabled = false;
          const note = document.getElementById("turnstile-status");
          if (note) note.textContent = "確認済みです。ルームを作れます。";
        },
        "expired-callback": () => {
          turnstileToken = "";
          const launch = document.getElementById(
            "launch",
          ) as HTMLButtonElement | null;
          if (launch) launch.disabled = true;
        },
        "error-callback": () => {
          turnstileToken = "";
          holder.textContent =
            "人間確認を完了できません。通信を確認して再試行してください。";
        },
      });
    };
    render();
  } catch {
    holder.textContent =
      "ルーム作成の準備中です。招待リンクからの参加は利用できます。";
  }
}
try {
  save = loadSharedCoopSave();
  // Armouries built under the old single cap are brought down to the per-family
  // one. Say what went, rather than letting the count quietly shrink.
  // Preserve old inventory verbatim. Progression initialization has an explicit
  // backup/confirmation flow; opening the legacy client must never delete loot.
} catch (e) {
  saveError = String((e as Error).message);
}
try {
  view = new Renderer($("world") as HTMLCanvasElement);
  // Audio is driven by authoritative state, independently of rendering.
} catch {
  ui.innerHTML =
    '<section class="panel"><h1>3D描画を開始できません</h1><p>WebGL 2に対応したブラウザで開いてください。</p></section>';
  throw new Error("WebGL2 unavailable");
}
function configured() {
  controls.sensitivity = save.sensitivity;
  controls.fireSensitivity = save.fireSensitivity ?? save.sensitivity;
  controls.gyroEnabled = save.gyroEnabled === true;
  controls.gyroSensitivity = save.gyroSensitivity ?? 1;
  sound.volume = save.volume;
  view.quality = save.quality;
  view.frameRate = save.frameRate ?? 60;
  view.mapAssets.setQuality(save.quality);
  minimap.rotates = save.mapRotates === true;
  view.damageNumbers = save.damageNumbers ?? "self";
  view.resize();
  placeControls(layout);
}
configured();
function write(next: Save) {
  if (saveError) return false;
  try {
    persistSharedCoopSave(next);
    save = next;
    return true;
  } catch (e) {
    status = (e as Error).message;
    return false;
  }
}
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const weaponName = (w: Weapon) => WEAPONS[w.kind].name;
const equipped = () =>
  save.equipped.map((id) => save.inventory.find((w) => w.id === id)!);
function setScreen(name: string) {
  backgroundMusic().setScreen(name, world?.phase === "victory");
  queueMicrotask(() =>
    enhanceGameSelects(
      ui,
      "#stage-select, #weapon-filter, #weapon-sort, #armory-filter, #armory-sort, #lobby-stage",
    ),
  );
  if (name !== screen)
    document
      .querySelectorAll<HTMLDialogElement>("dialog[open]")
      .forEach((dialog) => dialog.close());
  screen = name;
  document.body.dataset.screen = name;
  ui.scrollTop = 0;
  if (name !== "battle" && paused) closePause();
  controls.enabled = name === "battle" && !paused;
  if (!controls.enabled) {
    controls.reset();
    if (document.pointerLockElement) void document.exitPointerLock();
  }
  hud.hidden = name !== "battle";
  $("controls").hidden = name !== "battle";
  $("minimap").hidden = name !== "battle";
  $("pause").hidden = name !== "battle";
}
function title() {
  loadingGeneration++;
  lobbyPreview = null;
  preparedKey = "";
  preparingKey = "";
  network?.close();
  location.assign(import.meta.env.BASE_URL);
}

function showChangelog() {
  menuDialog(
    "更新履歴",
    CHANGELOG.map(
      (release) =>
        `<section class="release-entry"><h3>${esc(release.date)}</h3><ul>${release.items.map((line) => `<li>${esc(line)}</li>`).join("")}</ul></section>`,
    ).join(""),
    "LATEST UPDATES",
  );
}

const KIND_LABELS: Record<Weapon["kind"], string> = {
  rifle: "ライフル",
  shotgun: "ショットガン",
  rocket: "ロケット",
};
const heldOf = (kind: Weapon["kind"]) =>
  save.inventory.filter((w) => w.kind === kind);
// Counts per family, because that is the cap the player now runs into.
const kindTally = () =>
  (Object.keys(KIND_LABELS) as Weapon["kind"][])
    .map(
      (k) =>
        `${KIND_LABELS[k]} ${heldOf(k).length}/${CAPACITY.perKind}` +
        (heldOf(k).length >= CAPACITY.perKind ? "（満杯）" : ""),
    )
    .join(" · ");
// `group` decides which tab shows this figure; the row stays one line either way.
const figure = (group: string, value: string, label: string, cls = "") =>
  '<span data-stat="' +
  group +
  '" class="' +
  cls +
  '"><b>' +
  value +
  "</b><i>" +
  label +
  "</i></span>";
function card(w: Weapon, lootOnly = false) {
  const d = stats(w),
    base = equipped().find((a) => a.kind === w.kind),
    diff = !lootOnly && base ? Math.round(d.damage - stats(base).damage) : null;
  const damage =
    Math.round(d.damage) + (d.pellets > 1 ? " × " + d.pellets : "");
  // Each figure is graded against its own roll band. Reload is inverted there,
  // so a fast reload and a big magazine both read as the good end.
  const grade = (key: Roll) => {
    if ((w as NewWeapon).format === 2) {
      if (key === "mag") return "";
      const variance = (w as NewWeapon).variance[key];
      return variance >= 10 ? "roll-high" : variance < 0 ? "roll-low" : "";
    }
    const milli = Math.round((w.rolls?.[key] ?? 1) * ROLL.scale);
    let at = (milli - ROLL.min) / (ROLL.max - ROLL.min);
    if (LOWER_IS_BETTER.includes(key)) at = 1 - at;
    return at >= 0.8 ? "roll-high" : at <= 0.2 ? "roll-low" : "";
  };
  const rollClass = grade("power");
  const slot = lootOnly ? -1 : save.equipped.indexOf(w.id);
  return (
    '<article class="weapon-row rarity' +
    w.rarity +
    (slot < 0 ? "" : " equipped-" + slot) +
    (lootOnly
      ? '"'
      : '" data-equip="' + w.id + '" role="button" tabindex="0"') +
    '><div class="weapon-identity"><h3>' +
    weaponName(w) +
    "</h3>" +
    (lootOnly ? kindHelp(w.kind) : "") +
    '<em class="rarity-tag rarity' +
    w.rarity +
    '" title="' +
    effectLabel(w) +
    '">' +
    weaponGrade(w) +
    '</em></div><div class="weapon-figures">' +
    figure("effect", effectHelp(w.effect, w.kind), "特殊効果") +
    // One line of figures rather than three stacked blocks, so more of the
    // armoury fits on a landscape phone.
    // The comparison rides inside the power cell; as a sibling it would claim a
    // column of its own and shunt every row out of line with the header.
    figure(
      "power",
      damage +
        (diff === null
          ? ""
          : '<span class="weapon-diff' +
            (diff >= 0 ? "" : " down") +
            '">' +
            (diff >= 0 ? "+" : "") +
            diff +
            "</span>"),
      d.pellets > 1 ? "威力/散弾" : "威力",
      rollClass,
    ) +
    figure("load", String(d.mag), "装弾", grade("mag")) +
    figure("load", d.reload.toFixed(2) + "s", "装填", grade("reload")) +
    figure("reach", Math.round(d.range) + "m", "射程", grade("range")) +
    figure("reach", (1 / d.interval).toFixed(1), "発/s", grade("rate")) +
    "</div>" +
    (lootOnly
      ? favoriteButton(w, true)
      : slot < 0
        ? ""
        : '<span class="equipped-flag" title="装備中 ' +
          (slot + 1) +
          '">E' +
          (slot + 1) +
          "</span>") +
    "</article>"
  );
}

let weaponFilter: Kind | "all" = "all";
let weaponSort = "default";
const inviteCode = () =>
  /^[a-f0-9]{32}$/.test(location.hash.slice(1)) ? location.hash.slice(1) : "";
function gear() {
  const listTop = ui.querySelector(".weapon-list")?.scrollTop ?? 0;
  const focused = document.activeElement as HTMLElement | null;
  const focusSelector = focused?.dataset.equip
    ? `[data-equip="${CSS.escape(focused.dataset.equip)}"]`
    : focused?.dataset.pick
      ? `[data-pick="${focused.dataset.pick}"]`
      : focused?.id
        ? `#${CSS.escape(focused.id)}`
        : undefined;
  if (mode === "coop" && network?.id && !network.preparing)
    network.preparation(true);
  setScreen("gear");
  world = null;
  predicted = undefined;
  const shown = save.inventory.filter(
    (w) => weaponFilter === "all" || w.kind === weaponFilter,
  );
  if (weaponSort === "power")
    shown.sort((a, b) => stats(b).damage - stats(a).damage);
  if (weaponSort === "rarity")
    shown.sort((a, b) => weaponTier(b) - weaponTier(a));
  const invitation = mode === "coop" ? inviteCode() : "";
  const previous = mode === "coop" ? loadNetworkSession() : null;
  const resumable =
    previous && (!invitation || invitation === previous.code) ? previous : null;
  const launchLabel =
    mode === "solo"
      ? "ソロ出撃 ↗"
      : network?.id
        ? "準備完了してロビーへ ↗"
        : resumable
          ? "進行中の部隊へ戻る ↗"
          : invitation
            ? "招待ルームに参加 ↗"
            : "ルームを作る ↗";
  const endpoint = defaultEndpoint();
  const coopEntry =
    mode === "coop" && !network?.id
      ? `<div class="coop-entry"><b>${resumable ? "進行中の部隊があります" : invitation ? "招待を受け取りました" : "友人と遊ぶ"}</b><p>${resumable ? "30秒以内なら同じ隊員・戦闘状態へ復帰できます。" : invitation ? "下の「招待ルームに参加」を押してください。" : "人間確認の後に「ルームを作る」を押すと、すぐ招待リンクを送れます。"}</p></div>${!resumable && !invitation ? '<div id="turnstile-room-create" class="turnstile-room-create" aria-label="ルーム作成の人間確認"></div><p id="turnstile-status" class="fine">人間確認が終わるまで、ルーム作成はできません。</p>' : ""}<details class="coop-advanced"><summary>接続先を手動設定（開発用）</summary><div class="join"><input id="endpoint" aria-label="協力サーバー" value="${esc(endpoint)}"><input id="creation-key" type="password" aria-label="ローカル作成キー" placeholder="ローカル作成キー" autocomplete="off" maxlength="256"></div></details>`
      : "";
  if (mode === "coop" && !network?.id) {
    if (!resumable && !invitation) {
      ui.innerHTML = roomBrowserMarkup(endpoint, saveError || status);
      $("home").onclick = () => {
        network?.close();
        network = undefined;
        title();
      };
      ($("launch") as HTMLButtonElement).disabled = !!saveError;
      $("launch").onclick = () => void connect(true, false);
      bindRoomBrowser(ui.firstElementChild as HTMLElement, (code) =>
        connect(false, false, code),
      );
      if (import.meta.env.PROD) {
        ($("launch") as HTMLButtonElement).disabled = true;
        void mountTurnstile(endpoint);
      }
      return;
    }
    ui.innerHTML = `<section class="panel room-entry"><header><div><div class="eyebrow">CO-OP / SQUAD</div><h1>協力プレイ</h1></div><button id="home">タイトルへ</button></header>${coopEntry}<p>武器の変更とステージ選択は、入室後のロビーで行えます。</p><p class="status" role="status">${esc(saveError || status)}</p><button class="primary" id="launch" ${saveError ? "disabled" : ""}>${launchLabel}</button></section>`;
    $("home").onclick = () => {
      network?.close();
      network = undefined;
      title();
    };
    $("launch").onclick = () => {
      sound.unlock();
      void connect(!invitation && !resumable, Boolean(resumable));
    };
    if (!resumable && !invitation && import.meta.env.PROD) {
      ($("launch") as HTMLButtonElement).disabled = true;
      void mountTurnstile(endpoint);
    }
    return;
  }

  ui.innerHTML = `<section class="panel gear menu-screen"><header class="menu-header"><div><div class="eyebrow">LOADOUT / ${mode.toUpperCase()}</div><h1>出撃準備</h1></div><div class="weapon-filters"><label><span class="sr-only">武器系統</span><select id="weapon-filter" aria-label="武器系統"><option value="all">全系統</option><option value="rifle">ライフル</option><option value="shotgun">ショットガン</option><option value="rocket">ロケット</option></select></label><label><span class="sr-only">並び順</span><select id="weapon-sort" aria-label="武器の並び順"><option value="default">入手順</option><option value="rarity">レア度順</option><option value="power">1発の威力順</option></select></label><button id="kind-info" aria-label="武器系統の説明">系統ガイド ⓘ</button></div><nav><button id="gear-armory">${menuIcon("armory")}武器庫</button><button id="gear-settings">${menuIcon("settings")}設定・操作</button><button id="home">ホームへ</button></nav></header><div class="gear-workspace"><aside class="gear-brief"><section class="mission-select"><div class="section-label"><span>01 / 出撃先</span><button id="mission-info" aria-label="作戦詳細">作戦詳細 ⓘ</button></div><label class="sr-only" for="stage-select">ステージ</label><select id="stage-select">${stageOptions()}</select><p id="stage-brief" class="sr-only">${esc(STAGES[selectedStage - 1].brief)}</p></section><section class="equipment-select"><div class="section-label"><span>02 / 装備を選択</span><small>2 SLOTS</small></div><div class="loadout-slots">${equipped()
    .map(
      (w, i) =>
        `<button type="button" data-pick="${i}" class="rarity${w.rarity} ${activeSlot === i ? "selected" : ""}" aria-pressed="${activeSlot === i}"><span class="slot-number">0${i + 1}</span><span><small>装備 ${i + 1} <em>${weaponGrade(w)}</em></small><b>${weaponName(w)}</b><strong>${effectText(w.effect, w.kind)}</strong></span><i aria-hidden="true">${activeSlot === i ? "選択中" : "変更"}</i></button>`,
    )
    .join(
      "",
    )}</div></section></aside><section class="gear-arsenal"><p class="slot-hint">装備 <b>${activeSlot + 1}</b> を選択中 <span>→ 武器を押すと装備を変更</span><small class="gear-scroll-hint">${shown.length}丁 · 上下にスクロール ↕</small></p><div class="weapon-list" tabindex="0" aria-label="所持武器リスト"><div class="weapon-head" aria-hidden="true"><span>武器</span><span>特殊効果</span><span>威力</span><span>装弾</span><span>装填</span><span>射程</span><span>連射</span><span></span></div>${shown.map((w) => card(w)).join("") || '<p class="armory-empty">この系統の武器はありません。<br>「全系統」で所持武器を確認できます。</p>'}</div></section></div><div class="gear-footer"><p class="status" role="status">${esc(saveError || status || "装備を確認したら、出撃しましょう。")}</p><button class="primary" id="launch" ${saveError ? "disabled" : ""}>${launchLabel}</button></div></section>`;
  const currentStage = () =>
    STAGES[
      (mode === "coop" && network?.id ? network.stage : selectedStage) - 1
    ];
  $("mission-info").onclick = () => {
    const st = currentStage();
    menuDialog(
      st.name,
      `<div class="mission-facts"><span>${esc(MAPS[st.map].name)}</span><span>${st.waves.length} WAVES</span></div><p>${esc(st.brief)}</p>${mode === "coop" ? "<p>ステージはロビーでホストが選択します。</p>" : ""}`,
      "OPERATION BRIEF",
    );
  };
  $("kind-info").onclick = () =>
    menuDialog(
      "武器系統ガイド",
      `<p>${kindSummary(weaponFilter)}</p><p>特殊効果の ⓘ を押すと、発動条件と効果を確認できます。</p>`,
    );
  if (mode === "coop" && network?.id) {
    const stage = $("stage-select") as HTMLSelectElement;
    stage.value = String(network.stage);
    stage.disabled = true;
    $("home").textContent = "部隊を退出";
  }
  $("gear-armory").onclick = armory;
  $("gear-settings").onclick = () => openSettings(gear);
  const filter = $("weapon-filter") as HTMLSelectElement,
    sort = $("weapon-sort") as HTMLSelectElement;
  filter.value = weaponFilter;
  sort.value = weaponSort;
  filter.onchange = () => {
    weaponFilter = filter.value as Kind | "all";
    gear();
    ui.querySelector(".weapon-list")!.scrollTop = 0;
    $("weapon-filter").focus();
  };
  sort.onchange = () => {
    weaponSort = sort.value;
    gear();
    ui.querySelector(".weapon-list")!.scrollTop = 0;
    $("weapon-sort").focus();
  };
  $("stage-select").onchange = (e) => {
    selectedStage = Number((e.target as HTMLSelectElement).value);
    $("stage-brief").textContent = STAGES[selectedStage - 1].brief;
  };
  $("home").onclick = () => {
    network?.close();
    network = undefined;
    title();
  };
  $("launch").onclick = () => {
    sound.unlock();
    if (mode === "solo") solo();
    else if (network?.id) {
      network.preparation(false);
      lobby();
    }
  };
  ui.querySelectorAll<HTMLButtonElement>("[data-pick]").forEach(
    (b) =>
      (b.onclick = () => {
        activeSlot = Number(b.dataset.pick);
        gear();
      }),
  );
  const equip = (id: string) => {
    if (save.equipped[activeSlot] === id) return;
    const n = structuredClone(save),
      other = 1 - activeSlot;
    if (n.equipped[other] === id) n.equipped[other] = n.equipped[activeSlot];
    n.equipped[activeSlot] = id;
    if (write(n)) {
      sound.unlock();
      sound.play("unequip");
      sound.play("equip", 1, 0, "equip", 0.12);
      network?.equipment(equipped());
      status = `装備 ${activeSlot + 1} を変更しました。`;
    }
    gear();
  };
  ui.querySelectorAll<HTMLElement>("[data-equip]").forEach((el) => {
    el.onclick = (event) => {
      if ((event.target as Element).closest('[data-stat="effect"]')) return;
      el.focus({ preventScroll: true });
      equip(el.dataset.equip!);
    };
    el.onkeydown = (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      equip(el.dataset.equip!);
    };
  });
  restoreMenuPosition(ui, ".weapon-list", listTop, focusSelector);
}
function openSettings(back: () => void) {
  const dialog = menuDialog(
    "設定・操作",
    `<p class="settings-status" role="status">${esc(saveError || "変更はこの端末に自動保存されます。")}</p><div class="settings-content settings-columns"><p>PC: WASD移動 / クリック射撃・マウス照準 / R装填 / Q切替 / Space回避 / E長押し蘇生 / Escマウス解放</p><p>スマホ: 左スティック移動 / 右側ドラッグ照準 / 射撃ボタン長押し。味方3.5m以内で蘇生を2.5秒長押し。</p><label>視点感度 <input id="sense" type="range" min="0.1" max="6" step="0.1" value="${save.sensitivity}"></label><label>射撃ボタンの視点感度 <input id="fire-sense" type="range" min="0.1" max="6" step="0.1" value="${save.fireSensitivity ?? save.sensitivity}"></label><label>ジャイロ <button id="gyro" type="button" role="switch" aria-label="ジャイロ" aria-checked="${save.gyroEnabled === true}">${save.gyroEnabled ? "オン" : "オフ"}</button><span id="gyro-status" role="status">端末を動かして照準。反応しない場合はオフ→オンで許可を確認。</span></label><label>ジャイロ感度 <input id="gyro-sense" type="range" min="0.1" max="6" step="0.1" value="${save.gyroSensitivity ?? 1}"></label><label>音量（0でミュート） <input id="volume" type="range" min="0" max="1" step="0.05" value="${save.volume}"></label><label>描画品質 <select id="quality"><option value="1" ${save.quality === 1 ? "selected" : ""}>標準（精細な地形・質感）</option><option value="0.65" ${save.quality === 0.65 ? "selected" : ""}>軽量（従来の描画）</option></select></label><label>描画上限 <select id="frame-rate"><option value="60" ${(save.frameRate ?? 60) === 60 ? "selected" : ""}>60fps（なめらか）</option><option value="30" ${save.frameRate === 30 ? "selected" : ""}>30fps（省電力）</option></select></label><label>ミニマップ <select id="map-rotate"><option value="fixed" ${save.mapRotates ? "" : "selected"}>北を上に固定</option><option value="follow" ${save.mapRotates ? "selected" : ""}>視点に合わせて回す</option></select></label><label>ダメージ表示 <select id="damage-numbers"><option value="self" ${(save.damageNumbers ?? "self") === "self" ? "selected" : ""}>自分のみ</option><option value="all" ${save.damageNumbers === "all" ? "selected" : ""}>味方も表示</option><option value="off" ${save.damageNumbers === "off" ? "selected" : ""}>表示しない</option></select></label><p>道中の緑の戦利品は接近して回収。勝利時に確定、敗北・復帰できない切断では未確定品を失います。保存済みの武器は失いません。端末変更・ブラウザデータ削除で引き継げません。クラウド保存や完全な改ざん防止はありません。</p><button id="export">保存データを書き出す</button></div>`,
    "SYSTEM CONFIGURATION",
  );
  addPlayerNameSetting(dialog.querySelector<HTMLElement>(".menu-dialog-body")!);
  const content = dialog.querySelector<HTMLElement>(".settings-content")!;
  const original = [...content.children];
  for (const key of ["preferences", "save"]) {
    const panel = document.createElement("section");
    panel.id = "settings-" + key;
    panel.setAttribute(
      "aria-label",
      key === "preferences" ? "環境設定" : "保存データ",
    );
    panel.innerHTML = `<h3>${key === "preferences" ? "環境設定" : "保存データ"}</h3>`;
    content.append(panel);
  }
  original.slice(0, 2).forEach((el) => el.remove());
  original
    .slice(2)
    .forEach((el) =>
      dialog
        .querySelector(
          el.tagName === "LABEL" ? "#settings-preferences" : "#settings-save",
        )!
        .append(el),
    );
  const layoutButton = document.createElement("button");
  const developerButton = document.createElement("button");
  developerButton.id = "settings-developer";
  developerButton.textContent = "管理者モード";
  developerButton.className = "settings-developer-entry";
  developerButton.onclick = () => {
    dialog.close();
    openDeveloperLogin("main");
  };
  dialog.querySelector(".menu-dialog-body")!.append(developerButton);
  layoutButton.id = "layout-settings";
  layoutButton.textContent = "操作ボタンの配置";
  dialog.querySelector("#settings-preferences")!.append(layoutButton);
  layoutButton.onclick = () => {
    dialog.close();
    setScreen("layout");
    openLayoutEditor(
      ui,
      layout,
      (value) => {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(value));
        layout = value;
        layoutWarning = "";
        placeControls(layout);
      },
      back,
      {
        config: () => ({
          preferences: save,
          weapons: save.equipped.map((id) =>
            save.inventory.find((w) => w.id === id)!,
          ),
        }),
      },
    );
  };
  if (layoutWarning) {
    const note = document.createElement("p");
    note.textContent = layoutWarning;
    dialog.querySelector("#settings-preferences")!.append(note);
  }
  const update = (next: Save) => {
    const ok = write(next);
    if (ok) configured();
    dialog.querySelector(".settings-status")!.textContent = ok
      ? "設定を保存しました。"
      : `保存できませんでした。${saveError || status}`;
    return ok;
  };
  alignSettings(dialog.querySelector("#settings-preferences")!);
  bindAimRanges("", update);
  bindGyro("", update);
  $("quality").onchange = () => {
    const input = $("quality") as HTMLSelectElement;
    if (!update({ ...save, quality: Number(input.value) }))
      input.value = String(save.quality);
  };
  $("frame-rate").onchange = () => {
    const input = $("frame-rate") as HTMLSelectElement;
    if (!update({ ...save, frameRate: input.value === "30" ? 30 : 60 }))
      input.value = String(save.frameRate ?? 60);
  };
  $("map-rotate").onchange = () => {
    const input = $("map-rotate") as HTMLSelectElement;
    if (!update({ ...save, mapRotates: input.value === "follow" }))
      input.value = save.mapRotates ? "follow" : "fixed";
  };
  $("damage-numbers").onchange = () => {
    const input = $("damage-numbers") as HTMLSelectElement;
    if (
      !update({ ...save, damageNumbers: input.value as Save["damageNumbers"] })
    )
      input.value = save.damageNumbers ?? "self";
  };
  dialog.querySelector<HTMLButtonElement>("#export")!.onclick = exportSave;
}

function alignSettings(container: Element) {
  container
    .querySelectorAll<HTMLLabelElement>(":scope > label")
    .forEach((row) => {
      row.classList.add("setting-row");
      const name = document.createElement("span");
      name.className = "setting-name";
      name.textContent = row.firstChild?.textContent?.trim() ?? "";
      row.firstChild?.replaceWith(name);
      const control = row.querySelector<HTMLInputElement>(
        "input, select, button",
      )!;
      row.htmlFor = control.id;
      const field = document.createElement("span");
      field.className = "setting-control";
      control.before(field);
      field.append(control);
      const note = row.querySelector<HTMLElement>('[role="status"]');
      if (note) {
        note.className = "setting-note";
        control.setAttribute("aria-describedby", note.id);
      }
    });
  if (container.matches(".pause-card")) {
    const rows = [...container.querySelectorAll(":scope > .setting-row")];
    const scroll = document.createElement("div");
    scroll.className = "pause-settings";
    rows[0]?.before(scroll);
    scroll.append(...rows);
  }
}

function bindAimRanges(prefix: string, update: (next: Save) => boolean) {
  for (const [id, key] of [
    ["sense", "sensitivity"],
    ["fire-sense", "fireSensitivity"],
    ["gyro-sense", "gyroSensitivity"],
    ["volume", "volume"],
  ] as const) {
    const input = $(prefix + id) as HTMLInputElement;
    const output = document.createElement("output");
    output.htmlFor = input.id;
    input.after(output);
    const value = () =>
      (output.textContent =
        id === "volume"
          ? `${Math.round(Number(input.value) * 100)}%`
          : Number(input.value).toFixed(1));
    value();
    input.oninput = () => {
      if (id === "volume") sound.unlock();
      if (
        !update({
          ...save,
          fireSensitivity: save.fireSensitivity ?? save.sensitivity,
          [key]: Number(input.value),
        })
      )
        input.value = String(
          save[key] ?? (key === "gyroSensitivity" ? 1 : save.sensitivity),
        );
      value();
    };
  }
}

function bindGyro(prefix: string, update: (next: Save) => boolean) {
  const button = $(prefix + "gyro") as HTMLButtonElement;
  const message = $(prefix + "gyro-status");
  button.onclick = async () => {
    const enabled = !save.gyroEnabled;
    button.disabled = true;
    try {
      if (enabled) await controls.requestGyro();
      if (!update({ ...save, gyroEnabled: enabled })) {
        message.textContent = "設定を保存できませんでした。";
        return;
      }
      button.textContent = enabled ? "オン" : "オフ";
      button.setAttribute("aria-checked", String(enabled));
      message.textContent = enabled
        ? "ジャイロをオンにしました。対応端末で端末を動かすと照準が動きます。"
        : "ジャイロをオフにしました。";
    } catch (error) {
      message.textContent =
        error instanceof Error ? error.message : "ジャイロを利用できません。";
    } finally {
      button.disabled = false;
    }
  };
}

function exportSave() {
  const raw =
    localStorage.getItem(newSaveKey("normal")) ??
    localStorage.getItem(SAVE_KEY) ??
    JSON.stringify(save);
  const url = URL.createObjectURL(
    new Blob([raw], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "swarm-front-save.json";
  a.click();
  URL.revokeObjectURL(url);
}
function solo() {
  mode = "solo";
  myId = "solo";
  world = createWorld(
    crypto.randomUUID(),
    crypto.getRandomValues(new Uint32Array(1))[0],
    selectedStage,
  );
  addPlayer(world, myId, equipped());
  resultRun = "";
  controls.reset();
  void loadBattle(true);
}
async function connect(create: boolean, restore = false, joinCode?: string) {
  const requestedStage = selectedStage;
  status = "接続中…";
  const previous = restore ? loadNetworkSession() : null;
  const endpoint =
    previous?.endpoint ?? ($("endpoint") as HTMLInputElement).value.trim();
  let code = joinCode ?? previous?.code ?? inviteCode();
  const token = previous?.token ?? "";
  try {
    const url = new URL(endpoint);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      (url.protocol === "http:" &&
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error("サーバーURLを確認してください");
    network?.close();
    network = new Network(endpoint.replace(/\/$/, ""));
    network.equip = equipped();
    network.playerName = playerName();
    network.onChat = renderLobbyChat;
    network.onStatus = (s, fatal) => {
      status = s;
      netFatal = fatal;
      if (fatal) {
        controls.reset();
        setScreen("error");
        ui.innerHTML = `<section class="panel"><h1>通信が終了しました</h1><p>${esc(s)}</p><p>未確定戦利品は保存されません。確定済み武器は保持されます。</p><button id="back">装備画面へ</button></section>`;
        $("back").onclick = () => {
          network?.close();
          network = undefined;
          gear();
        };
      } else if (screen === "lobby") lobby();
    };
    network.onLobby = () => {
      selectedStage = network!.stage;
      if (screen === "gear") {
        ($("stage-select") as HTMLSelectElement).value = String(selectedStage);
        $("stage-brief").textContent =
          `${STAGES[selectedStage - 1].brief}（${STAGES[selectedStage - 1].waves.length}波）`;
      }
      if (screen === "lobby") lobby();
      else void prepareLobby();
      syncGameSelects(ui);
    };
    network.onWorld = (w) => {
      try {
        recordCoopEncounters(w);
      } catch {
        status = "遭遇記録を保存できません。端末の保存容量を確認してください。";
      }
      world = w;
      myId = network!.id;
      sound.update(
        w,
        myId,
        controls.input.yaw,
        w.phase === "battle" && !paused,
      );
      if (w.phase === "battle") {
        if (screen !== "battle" && screen !== "loading" && !netFatal)
          void loadBattle(false);
        const p = w.players.find((p) => p.id === myId);
        if (p) {
          if (
            !predicted ||
            Math.hypot(predicted.x - p.x, predicted.z - p.z) > 3
          )
            predicted = { x: p.x, z: p.z, y: p.y ?? 0 };
          else {
            predicted.x += (p.x - predicted.x) * 0.4;
            predicted.z += (p.z - predicted.z) * 0.4;
            predicted.y = p.y ?? 0;
          }
        }
      } else if (w.phase === "victory" || w.phase === "defeat") {
        if (resultRun !== w.run && !netFatal) finishMission();
        network!.onLobby();
      }
    };
    network.ready = () => {
      if (create) network!.send({ type: "stage", stage: requestedStage });
      myId = network!.id;
    };
    if (create) {
      const options = {
        name:
          document.querySelector<HTMLInputElement>("#room-name")?.value ??
          "協力部隊",
        listed:
          document.querySelector<HTMLSelectElement>("#room-visibility")
            ?.value === "public",
      };
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (local) {
        const field = $("creation-key") as HTMLInputElement;
        const key = field.value;
        field.value = "";
        code = await network.create("", key, options);
      } else {
        if (!turnstileToken) throw new Error("人間確認を完了してください");
        const proof = turnstileToken;
        turnstileToken = "";
        code = await network.create(proof, "", options);
      }
    }
    if (!/^[a-f0-9]{32}$/.test(code))
      throw new Error("招待コードは32文字の英数字です");
    netFatal = false;
    network.connect(code, token);
    lobby();
  } catch (e) {
    network?.close();
    network = undefined;
    status = `接続できません: ${(e as Error).message}。ソロは利用できます。`;
    gear();
  }
}
function lobby() {
  if (netFatal || ["battle", "stage-clear", "result"].includes(screen)) return;
  const oldInput = document.getElementById(
    "chat-input",
  ) as HTMLInputElement | null;
  const draft = oldInput?.value ?? "";
  const focused = document.activeElement === oldInput;
  const selection = oldInput?.selectionStart ?? draft.length;
  setScreen("lobby");
  const members = network?.members ?? [];
  const link = `${location.origin}${location.pathname}${location.search}#${network?.code ?? ""}`;
  const present = members.filter((m) => m.connected);
  const host = present[0]?.id;
  const isHost = Boolean(network?.id && host === network.id);
  const stage = STAGES[(network?.stage ?? selectedStage) - 1];
  selectedStage = stage.id;
  const online = network?.ws?.readyState === 1 && !network?.retry;
  const canStart =
    online && isHost && present.length > 0 && present.every((m) => m.ready);
  ui.innerHTML = `<section class="panel lobby"><header class="lobby-header"><div><div class="eyebrow">CO-OP / SQUAD</div><h1>協力ロビー</h1></div><div class="lobby-share"><button id="share">招待リンクを共有</button><span id="invite-feedback" role="status"></span></div><span>${present.length} / 4 人</span><button id="leave-lobby">退出</button></header><div class="lobby-workspace"><section class="lobby-mission" aria-label="出撃ステージ"><div class="eyebrow">OPERATION ${String(stage.id).padStart(2, "0")}</div><h2>${esc(MAPS[stage.map].name)}</h2><strong>${esc(stage.name)}</strong><label>ホストが選択<select id="lobby-stage" ${!online || !isHost ? "disabled" : ""}>${stageOptions()}</select></label><div class="mission-facts"><span>${stage.waves.length} WAVES</span><span>道中ドロップ ${Math.round(stage.dropRate * 100)}%</span></div><p>${esc(stage.brief)}</p><div class="lobby-actions"><p class="status" role="status">${!online ? esc(status) : canStart ? "全員の準備が整いました" : isHost ? "隊員の準備完了を待っています" : "ホストの出撃を待っています"}</p><button id="back">出撃準備・装備変更</button><button class="primary" id="begin" ${canStart ? "" : "disabled"}>全員で出撃 ↗</button></div></section><section class="lobby-squad" aria-label="参加メンバー"><div class="squad-heading"><h2>参加メンバー</h2><small>装備 / 状況</small></div><div class="squad-cards">${Array.from(
    { length: 4 },
    (_, i) => {
      const m = members[i];
      if (!m)
        return `<article class="squad-member empty"><span class="member-number">0${i + 1}</span><div><b>参加待ち</b><small>招待リンクから参加できます</small></div></article>`;
      return `<article class="squad-member ${m.id === network?.id ? "self" : ""}"><div class="member-heading"><b><span class="member-number">0${i + 1}</span> ${esc(m.name || `隊員 ${String(i + 1).padStart(2, "0")}`)}${m.id === network?.id ? "（あなた）" : ""}</b><small>${m.id === host ? "HOST" : "MEMBER"}</small><span class="member-status ${m.connected && m.ready ? "is-ready" : "is-preparing"}">${!m.connected ? "切断中" : m.ready ? "準備完了" : "準備中…"}</span></div><div class="member-weapons">${[
        0, 1,
      ]
        .map((slot) => {
          const w = m.weapons?.[slot];
          return `<span><small>${slot + 1}</small> ${w ? `${weaponGrade(w)} · ${esc(weaponName(w))}` : "装備を確認中"}</span>`;
        })
        .join("")}</div></article>`;
    },
  ).join(
    "",
  )}</div></section><section class="lobby-chat" aria-label="部隊チャット"><h2>チャット</h2><ol id="chat-log" role="log" aria-live="polite" aria-relevant="additions"></ol><form id="chat-form"><label class="sr-only" for="chat-input">メッセージ</label><input id="chat-input" maxlength="400" autocomplete="off" placeholder="メッセージを入力…" ${online ? "" : "disabled"}><button type="submit" ${online ? "" : "disabled"}>送信</button><p id="chat-status" role="status"></p></form></section></div></section>`;
  const chatInput = $("chat-input") as HTMLInputElement;
  if (network?.roomId)
    ui.querySelector(".lobby-header h1")!.insertAdjacentHTML(
      "afterend",
      `<div class="lobby-room"><small class="lobby-room-name">${esc(network.roomName)}</small><span class="lobby-room-id">部屋ID <code id="room-code">${esc(network.roomId)}</code><button id="copy" aria-label="部屋IDをコピー" title="部屋IDをコピー"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg></button><span id="room-id-feedback" role="status"></span></span></div>`,
    );
  chatInput.value = draft;
  if (focused) {
    chatInput.focus();
    chatInput.setSelectionRange(selection, selection);
  }
  $("chat-form").onsubmit = (event) => {
    event.preventDefault();
    if (!chatInput.value.trim()) return;
    if (Array.from(chatInput.value.trim()).length > 200) {
      $("chat-status").textContent = "200文字以内で入力してください。";
      return;
    }
    if (network?.sendChat(chatInput.value)) {
      chatInput.value = "";
      $("chat-status").textContent = "";
    } else
      $("chat-status").textContent =
        "少し待ってから送信してください。接続中のロビーで送信できます。";
  };
  renderLobbyChat();
  enhanceGameSelects(ui, "#lobby-stage");
  void prepareLobby();
  $("leave-lobby").onclick = () => {
    network?.close();
    network = undefined;
    title();
  };
  $("lobby-stage").onchange = (e) => {
    network?.send({
      type: "stage",
      stage: Number((e.target as HTMLSelectElement).value),
    });
  };
  $("begin").onclick = () => {
    sound.unlock();
    network?.send({ type: "start" });
  };
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(link);
      $("invite-feedback").textContent = "コピーしました";
    } catch {
      window.prompt("招待リンクをコピーしてください", link);
    }
  };
  const copyId = document.getElementById("copy");
  if (copyId)
    copyId.onclick = async () => {
      const id = network?.roomId;
      if (!id) return;
      try {
        await navigator.clipboard.writeText(id);
        $("room-id-feedback").textContent = "IDをコピーしました";
      } catch {
        window.prompt("部屋IDをコピーしてください", id);
      }
    };
  $("share").onclick = async () => {
    if (!navigator.share) return copyInvite();
    try {
      await navigator.share({
        title: "SWARM FRONT 協力プレイ",
        text: `部屋ID: ${network?.roomId ?? ""}。ホーム画面のアプリでは「協力プレイ」にIDまたは招待リンクを貼り付けて参加できます。`,
        url: link,
      });
    } catch (error) {
      if ((error as Error).name !== "AbortError") await copyInvite();
    }
  };
  $("back").onclick = () => gear();
}
function battle() {
  lobbyPreview = null;
  setScreen("battle");
  ui.innerHTML = "";
  status = mode === "solo" ? "SOLO" : "CO-OP";
  const fallback = placeControls(layout);
  if (fallback) status += " · 標準配置";
}
function favoriteButton(w: Weapon, compact = false) {
  const marked = save.favorites?.includes(w.id) ?? false;
  return `<button data-favorite="${esc(w.id)}" data-compact="${compact}" aria-label="${esc(weaponName(w))}のお気に入り" title="お気に入り" aria-pressed="${marked}" ${![...save.inventory, ...(save.pendingWeapons ?? [])].some((a) => a.id === w.id) ? "disabled" : ""}>${compact ? (marked ? "★" : "☆") : marked ? "★ お気に入り" : "☆ お気に入り"}</button>`;
}
function bindFavorites() {
  ui.querySelectorAll<HTMLButtonElement>("[data-favorite]").forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.favorite!;
      if (
        ![...save.inventory, ...(save.pendingWeapons ?? [])].some(
          (w) => w.id === id,
        )
      )
        return;
      const favorites = new Set(save.favorites ?? []);
      if (favorites.has(id)) favorites.delete(id);
      else favorites.add(id);
      if (write({ ...save, favorites: [...favorites] })) {
        b.setAttribute("aria-pressed", String(favorites.has(id)));
        b.textContent =
          b.dataset.compact === "true"
            ? favorites.has(id)
              ? "★"
              : "☆"
            : favorites.has(id)
              ? "★ お気に入り"
              : "☆ お気に入り";
        if (screen === "armory") armory();
      } else ui.querySelector(".status")!.textContent = saveError || status;
    };
  });
}
let armoryFilter = "all";
let armorySelected = "";
let armoryOrganizing = false;
const armoryChecked = new Set<string>();
function armory() {
  const scrollTop = ui.querySelector(".armory-list")?.scrollTop ?? 0;
  const previousSelection = ui
    .querySelector("[data-armory-select][aria-pressed='true']")
    ?.getAttribute("data-armory-select");
  const detailScroll =
    ui.querySelector(".armory-detail-scroll")?.scrollTop ?? 0;
  const favoriteFocus = (document.activeElement as HTMLElement | null)?.dataset
    .favorite;
  setScreen("armory");
  world = null;
  const waiting = save.pendingWeapons ?? [];
  const shown = [...waiting, ...save.inventory].filter(
    (w) =>
      armoryFilter === "all" ||
      (armoryFilter === "favorites"
        ? save.favorites?.includes(w.id)
        : armoryFilter === "pending"
          ? waiting.some((a) => a.id === w.id)
          : w.kind === armoryFilter),
  );
  if (!shown.some((w) => w.id === armorySelected))
    armorySelected = shown[0]?.id ?? "";
  const all = [...waiting, ...save.inventory];
  const isProtected = (w: Weapon) =>
    save.equipped.includes(w.id) ||
    !!save.favorites?.includes(w.id) ||
    !!save.protectedWeapons?.includes(w.id);
  for (const id of armoryChecked) {
    if (!all.some((w) => w.id === id && !isProtected(w)))
      armoryChecked.delete(id);
  }
  const checked = all.filter((w) => armoryChecked.has(w.id));
  const yieldTotal = checked.reduce((n, w) => n + weaponYield(w), 0);
  const selected = shown.find((w) => w.id === armorySelected);
  const state = (w: Weapon) => {
    const slot = save.equipped.indexOf(w.id);
    return `${slot >= 0 ? `<span class="armory-equipped">装備 ${slot + 1}</span>` : ""}${waiting.some((a) => a.id === w.id) ? '<span class="armory-pending">整理待ち</span>' : ""}${save.favorites?.includes(w.id) ? '<span class="armory-star" aria-label="お気に入り">★</span>' : ""}`;
  };
  const row = (w: Weapon, pending: boolean) => {
    const protectedWeapon =
      save.equipped.includes(w.id) ||
      save.favorites?.includes(w.id) ||
      save.protectedWeapons?.includes(w.id);
    const d = stats(w);
    const base = equipped().find((a) => a.kind === w.kind && a.id !== w.id);
    const bd = base ? stats(base) : null;
    const metrics: [
      string,
      number,
      number | undefined,
      string,
      number,
      boolean,
    ][] = [
      [
        d.pellets > 1 ? `威力（${d.pellets}発合計）` : "威力",
        d.damage * d.pellets,
        bd ? bd.damage * bd.pellets : undefined,
        "",
        0,
        false,
      ],
      ["装弾数", d.mag, bd?.mag, "発", 0, false],
      ["装填時間", d.reload, bd?.reload, "秒", 2, true],
      ["射程", d.range, bd?.range, "m", 0, false],
      [
        "連射速度",
        1 / d.interval,
        bd ? 1 / bd.interval : undefined,
        "発/秒",
        1,
        false,
      ],
    ];
    return `<div class="armory-detail-heading"><span class="armory-kind">${KIND_LABELS[w.kind]} · ${weaponGrade(w)}</span>${kindHelp(w.kind)}<h2>${esc(WEAPONS[w.kind].name)}</h2><div class="armory-badges">${state(w)}</div></div><p class="armory-effect">特殊効果 ${effectHelp(w.effect, w.kind)}<button id="armory-compare-open">比較を拡大 ↗</button></p><div class="armory-detail-scroll" tabindex="0" aria-label="性能比較と保護の説明"><p class="armory-compare">${base ? `装備 ${save.equipped.indexOf(base.id) + 1} の同系統武器と比較` : save.equipped.includes(w.id) ? "現在装備している武器" : "同系統の装備なし"}</p><table class="armory-stats"><thead><tr><th>性能</th><th>選択中</th><th>装備との差</th></tr></thead><tbody>${metrics
      .map(([label, value, other, unit, digits, lower]) => {
        const delta =
          other === undefined ? null : Number((value - other).toFixed(digits));
        const cls =
          delta === null || delta === 0
            ? ""
            : (lower ? delta < 0 : delta > 0)
              ? "better"
              : "worse";
        return `<tr><th>${label}</th><td>${value.toFixed(digits)}<small>${unit}</small></td><td class="${cls}">${delta === null ? "—" : delta === 0 ? "同じ" : `${delta > 0 ? "+" : ""}${delta.toFixed(digits)}${unit}`}</td></tr>`;
      })
      .join(
        "",
      )}</tbody></table><p class="armory-help">${protectedWeapon ? "登録装備・お気に入りは分解から保護されます。" : `分解で${resourceFrame("powder", weaponYield(w), "gain")}。実行前に確認できます。`}${pending ? " 整理待ちは保存済み。空きができると入手順に収納します。" : ""}</p></div><div class="armory-detail-actions">${favoriteButton(w)}<button data-discard="${esc(w.id)}" ${protectedWeapon ? "disabled" : ""}>${protectedWeapon ? "保護中" : `分解 ${resourceFrame("powder", weaponYield(w), "gain")}`}</button></div>`;
  };
  ui.innerHTML = `<section class="panel armory ${armoryOrganizing ? "organizing" : ""}"><header><div class="armory-title"><h1>武器庫 <small>${save.inventory.length}丁${waiting.length ? ` · 整理待ち ${waiting.length}` : ""}</small></h1><button id="armory-organize" aria-pressed="${armoryOrganizing}">${armoryOrganizing ? "整理を終了" : "整理モード"}</button><select id="armory-filter" aria-label="武器庫の絞り込み"><option value="all">全武器</option><option value="favorites">お気に入り</option><option value="pending">整理待ち</option><option value="rifle">ライフル</option><option value="shotgun">ショットガン</option><option value="rocket">ロケット</option></select></div><nav aria-label="武器庫の移動"><button id="armory-home">ホームへ</button><button id="armory-gear">出撃準備へ</button></nav></header><div class="armory-toolbar"><span>${shown.length}丁を表示</span><small>${kindTally()}</small></div><div class="armory-powder">${resourceFrame("powder", save.powder ?? 0)}${armoryOrganizing ? `<button id="armory-dismantle" ${checked.length ? "" : "disabled"}>選択 ${checked.length}丁を分解 ${resourceFrame("powder", yieldTotal, "gain")}</button><small>装備中・お気に入りは保護</small>` : ""}</div><p class="status" role="status">${esc(saveError || status)}</p><div class="armory-workspace"><section class="armory-catalog" aria-label="武器一覧"><div class="armory-list" tabindex="0" aria-label="武器一覧。上下にスクロールできます"><div class="armory-list-head" aria-hidden="true"><span>武器 / 状態</span><span>特殊効果</span><span>威力</span><span>装弾</span><span title="装填時間（秒）">装填</span><span title="射程（m）">射程</span><span title="連射速度（発/秒）">連射</span></div>${
    shown
      .map((w) => {
        const d = stats(w);
        return `<article>${armoryOrganizing ? `<label class="armory-check"><input type="checkbox" data-dismantle-check="${esc(w.id)}" aria-label="${esc(WEAPONS[w.kind].name)} ${weaponGrade(w)}を分解対象にする" ${isProtected(w) ? "disabled" : ""} ${armoryChecked.has(w.id) ? "checked" : ""}></label>` : ""}<button class="armory-row rarity${w.rarity}" data-armory-select="${esc(w.id)}" aria-pressed="${w.id === armorySelected}"><span class="armory-identity"><strong>${esc(WEAPONS[w.kind].name)}</strong><span><em class="rarity-tag rarity${w.rarity}">${weaponGrade(w)}</em>${state(w)}</span></span><span class="armory-row-effect ${w.effect === "none" ? "standard-effect" : ""}">${effectText(w.effect, w.kind)}</span><span data-label="威力">${Math.round(d.damage)}${d.pellets > 1 ? `<small> ×${d.pellets}</small>` : ""}</span><span data-label="装弾">${d.mag}</span><span data-label="装填 / 秒">${d.reload.toFixed(2)}</span><span data-label="射程 / m">${Math.round(d.range)}</span><span data-label="連射 / 秒">${(1 / d.interval).toFixed(1)}</span></button></article>`;
      })
      .join("") ||
    '<p class="armory-empty">該当する武器はありません。<br>絞り込みを変更してください。</p>'
  }</div><div class="list-guide">${shown.length}丁を表示 <span>上下にスクロール ↕</span></div></section><section class="armory-detail ${selected ? `rarity${selected.rarity}` : ""}" aria-label="選択した武器の詳細">${
    selected
      ? row(
          selected,
          waiting.some((w) => w.id === selected.id),
        )
      : '<p class="armory-empty">武器を選ぶと性能を確認できます。</p>'
  }</section></div></section>`;
  const leave = (next: () => void) => {
    armoryOrganizing = false;
    armoryChecked.clear();
    next();
  };
  if (selected)
    $("armory-compare-open").onclick = () =>
      menuDialog(
        weaponName(selected),
        ui.querySelector(".armory-detail-scroll")!.innerHTML,
        "WEAPON COMPARISON",
      );
  $("armory-home").onclick = () => leave(title);
  $("armory-gear").onclick = () => leave(gear);
  $("armory-organize").onclick = () => {
    armoryOrganizing = !armoryOrganizing;
    armoryChecked.clear();
    armory();
    $("armory-organize").focus();
  };
  ui.querySelectorAll<HTMLInputElement>("[data-dismantle-check]").forEach(
    (input) => {
      input.onchange = () => {
        const id = input.dataset.dismantleCheck!;
        if (input.checked) armoryChecked.add(id);
        else armoryChecked.delete(id);
        armory();
        ui.querySelector<HTMLInputElement>(
          `[data-dismantle-check="${CSS.escape(id)}"]`,
        )?.focus({ preventScroll: true });
      };
    },
  );
  const dismantle = async (weapons: Weapon[]) => {
    if (!weapons.length || weapons.some(isProtected)) return;
    const amount = weapons.reduce((n, w) => n + weaponYield(w), 0);
    const breakdown = GRADES.map(
      (label) =>
        `${label}: ${weapons.filter((w) => weaponGrade(w) === label).length}丁`,
    ).join(" / ");
    const review = menuDialog(
      "武器を分解しますか",
      `<p>選択した <b>${weapons.length}丁</b>を分解し、${resourceFrame("powder", amount, "gain")}を獲得します。元には戻せません。</p><p>${breakdown}</p><ul class="dismantle-review">${weapons.map((w) => `<li><b>${weaponGrade(w)} · ${weaponName(w)}</b><span>${esc(weaponDetails(w))}</span></li>`).join("")}</ul>`,
      "ARSENAL / DISMANTLE",
    );
    const actions = document.createElement("div");
    actions.className = "dialog-actions";
    actions.innerHTML = `<button id="dismantle-cancel">やめる</button><button id="dismantle-confirm" class="danger">${weapons.length}丁を分解（+${amount}）</button>`;
    review.append(actions);
    const approved = await new Promise<boolean>((resolve) => {
      review.addEventListener(
        "close",
        () => resolve(review.returnValue === "confirm"),
        { once: true },
      );
      $("dismantle-cancel").onclick = () => review.close();
      $("dismantle-confirm").onclick = () => review.close("confirm");
      $("dismantle-cancel").focus();
    });
    if (!approved || weapons.some(isProtected)) return;
    try {
      if (
        write(
          dismantleWeapons(
            save,
            weapons.map((w) => w.id),
          ),
        )
      ) {
        armoryChecked.clear();
        status = `${weapons.length}丁を分解しました。`;
        armory();
        ui.querySelector(".status")!.insertAdjacentHTML(
          "beforeend",
          resourceFrame("powder", amount, "gain"),
        );
        (
          ui.querySelector<HTMLElement>(
            "[data-armory-select][aria-pressed='true']",
          ) ?? $("armory-organize")
        ).focus({ preventScroll: true });
      } else
        ui.querySelector(".status")!.textContent =
          (saveError || status) +
          ` 武器は削除していません。${POWDER_NAME}も変更していません。`;
    } catch (error) {
      ui.querySelector(".status")!.textContent = (error as Error).message;
    }
  };
  if (armoryOrganizing)
    $("armory-dismantle").onclick = () => dismantle(checked);
  const filter = $("armory-filter") as HTMLSelectElement;
  filter.value = armoryFilter;
  filter.onchange = () => {
    armoryFilter = filter.value;
    armory();
    ui.querySelector(".armory-list")!.scrollTop = 0;
    $("armory-filter").focus();
  };
  ui.querySelectorAll<HTMLButtonElement>("[data-armory-select]").forEach(
    (b) => {
      b.onclick = () => {
        armorySelected = b.dataset.armorySelect!;
        armory();
        ui.querySelector<HTMLButtonElement>(
          `[data-armory-select="${armorySelected}"]`,
        )?.focus({ preventScroll: true });
      };
    },
  );
  ui.querySelector(".armory-list")!.scrollTop = scrollTop;
  if (previousSelection === armorySelected) {
    const detail = ui.querySelector(".armory-detail-scroll");
    if (detail) detail.scrollTop = detailScroll;
    if (favoriteFocus)
      ui.querySelector<HTMLButtonElement>(
        `[data-favorite="${favoriteFocus}"]`,
      )?.focus({ preventScroll: true });
  }
  bindFavorites();
  ui.querySelectorAll<HTMLButtonElement>("[data-discard]").forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.discard!;
      const w = [...save.inventory, ...waiting].find((w) => w.id === id);
      if (
        !w ||
        save.equipped.includes(id) ||
        save.favorites?.includes(id) ||
        save.protectedWeapons?.includes(id)
      )
        return;
      dismantle([w]);
    };
  });
}
// Shared solo/co-op presentation boundary. Future BGM switches can subscribe
// to swarm:stage-clear; repeated terminal snapshots do not replay the cue.
function finishMission() {
  if (!world || resultRun === world.run) return;
  if (world.phase !== "victory") {
    result();
    return;
  }
  if (clearRun === world.run) return;
  clearRun = world.run;
  clearStartedAt = performance.now();
  storeMissionRewards(world);
  setScreen("stage-clear");
  ui.innerHTML = `<section class="stage-clear" role="status" aria-label="ステージクリア"><div class="clear-band"><p class="clear-kicker">OPERATION ${String(stageFor(world).id).padStart(2, "0")} · COMPLETE</p><h1 class="clear-title">STAGE CLEAR</h1><p class="clear-caption">作戦完了</p><div class="clear-line" aria-hidden="true"></div></div></section>`;
  window.dispatchEvent(
    new CustomEvent("swarm:stage-clear", {
      detail: { run: world.run, stage: stageFor(world).id, durationMs: 3200 },
    }),
  );
}
function storeMissionRewards(w: World) {
  try {
    const stored = write(bankRewards(save, w.run, w.rewards[myId] ?? []));
    if (stored)
      status = save.pendingWeapons?.length
        ? "獲得武器は端末に保存済みです。上限を超えた武器はホームの武器庫で整理できます。"
        : "戦利品を端末に保存しました";
    return stored;
  } catch (e) {
    status = (e as Error).message;
    return false;
  }
}
function result() {
  if (!world) return;
  const w = world;
  resultRun = w.run;
  setScreen("result");
  const returnToSquad = mode === "coop" && Boolean(network?.id) && !netFatal;
  const items = w.rewards[myId] ?? [];
  let stored = w.phase !== "victory";
  if (w.phase === "victory") {
    stored = storeMissionRewards(w);
  }
  ui.innerHTML = `<section class="panel result"><div class="result-summary"><div class="eyebrow">OPERATION ${String(stageFor(w).id).padStart(2, "0")} / ${mapFor(w).name}</div><h1>${w.phase === "victory" ? "MISSION CLEAR" : "MISSION FAILED"}</h1><p>${w.phase === "victory" ? "作戦を達成しました。戦利品を確認して、次の戦場へ。" : esc(w.reason || "部隊が全員ダウンしました")}</p><div class="stats"><div><span>作戦時間</span><b>${Math.floor(w.time / 60)}:${String(Math.floor(w.time % 60)).padStart(2, "0")}</b></div><div><span>撃破数</span><b>${w.totalKills}</b></div><div><span>回収武器</span><b>${items.length}</b></div></div><div class="result-actions"><button class="primary" id="regear">${returnToSquad ? "同じ部隊のロビーへ戻る ↗" : "ホームへ戻る ↗"}</button><button id="retry-save" ${stored ? "hidden" : ""}>保存を再試行</button></div></div><section class="result-loot"><h2>${w.phase === "victory" ? "獲得武器" : "未確定戦利品は失われました"}</h2><p class="status" role="status">${esc(saveError || (w.phase === "victory" ? status : "保存済みの武器は保持されています。"))}</p><div class="loot-list loot-table" aria-label="獲得武器リスト"><div class="weapon-head"><span>武器</span><span>特殊効果</span><span>威力</span><span>装弾</span><span>装填</span><span>射程</span><span>連射</span><span title="お気に入り">☆</span></div>${items.map((item) => card(item, true)).join("")}</div></section></section>`;
  $("regear").onclick = () => {
    if (!stored) {
      ui.querySelector(".status")!.textContent =
        saveError || "端末への保存に失敗しています。保存を再試行してください。";
      return;
    }
    status = "";
    if (returnToSquad && network && !netFatal) {
      // Keep this socket and its tab-local resume identity for the next sortie.
      // The completed run remains recorded so terminal snapshots cannot reopen results.
      loadingGeneration++;
      lobbyPreview = null;
      preparedKey = "";
      preparingKey = "";
      predicted = undefined;
      network.setAssetReady(false);
      network.preparation(false);
      setScreen("lobby");
      lobby();
    } else title();
  };
  $("retry-save").onclick = result;
  bindFavorites();
}
// Solo runs the world here, so it can truly stop. Co-op cannot: the server keeps
// stepping and the player keeps taking hits, which the menu has to admit.
let paused = false;
installLandscapeGuard(() => {
  controls.reset();
  if (screen === "battle" && !paused) openPause();
});
function closePause() {
  paused = false;
  $("pause-menu").hidden = true;
  $("pause-menu").innerHTML = "";
  controls.enabled = screen === "battle";
  const p = world?.players.find((p) => p.id === myId);
  controls.setScopeAvailable(
    controls.enabled && !!p && p.hp > 0 && p.swapCd <= 0,
  );
}
function retreat() {
  if (mode === "coop") {
    network?.close();
    network = undefined;
  }
  closePause();
  status = "作戦を離脱しました。未確定品は保存されません。";
  gear();
}
function openPause(confirming = false) {
  paused = true;
  controls.enabled = false;
  controls.reset();
  if (document.pointerLockElement) void document.exitPointerLock();
  const pending = (world?.pending[myId] ?? []).length;
  const menu = $("pause-menu");
  menu.hidden = false;
  menu.innerHTML = confirming
    ? `<div class="pause-card"><h2>作戦を離脱しますか</h2><p>${pending ? `未確定の戦利品 <b>${pending} 件</b>を失います。` : "未確定の戦利品はありません。"}確定済みの武器は残ります。</p>${mode === "coop" ? '<p class="warn">部隊は作戦を続けます。あなたは戻れません。</p>' : ""}<div class="pause-actions"><button id="pause-back">やめる</button><button class="danger" id="pause-quit">離脱する</button></div></div>`
    : `<div class="pause-card"><h2>一時停止</h2>${mode === "coop" ? '<p class="warn">協力プレイは止まりません。この間も戦闘は進み、被弾します。</p>' : "<p>ソロなので戦闘は止まっています。</p>"}<label>視点感度 <input id="pause-sense" type="range" min="0.1" max="6" step="0.1" value="${save.sensitivity}"></label><label>射撃ボタンの視点感度 <input id="pause-fire-sense" type="range" min="0.1" max="6" step="0.1" value="${save.fireSensitivity ?? save.sensitivity}"></label><label>ジャイロ <button id="pause-gyro" type="button" role="switch" aria-label="ジャイロ" aria-checked="${save.gyroEnabled === true}">${save.gyroEnabled ? "オン" : "オフ"}</button><span id="pause-gyro-status" role="status">端末を動かして照準。反応しない場合はオフ→オンで許可を確認。</span></label><label>ジャイロ感度 <input id="pause-gyro-sense" type="range" min="0.1" max="6" step="0.1" value="${save.gyroSensitivity ?? 1}"></label><label>音量 <input id="pause-volume" type="range" min="0" max="1" step="0.05" value="${save.volume}"></label><label>描画品質 <select id="pause-quality"><option value="1" ${save.quality === 1 ? "selected" : ""}>標準（精細な地形・質感）</option><option value="0.65" ${save.quality === 0.65 ? "selected" : ""}>軽量（従来の描画）</option></select></label><label>ミニマップ <select id="pause-map"><option value="fixed" ${save.mapRotates ? "" : "selected"}>北を上に固定</option><option value="follow" ${save.mapRotates ? "selected" : ""}>視点に合わせて回す</option></select></label><label>ダメージ表示 <select id="pause-damage"><option value="self" ${(save.damageNumbers ?? "self") === "self" ? "selected" : ""}>自分のみ</option><option value="all" ${save.damageNumbers === "all" ? "selected" : ""}>味方も表示</option><option value="off" ${save.damageNumbers === "off" ? "selected" : ""}>表示しない</option></select></label><div class="pause-actions"><button class="primary" id="pause-resume">戦闘に戻る</button><button id="pause-layout">操作ボタンの配置</button><button id="pause-leave">作戦離脱…</button></div></div>`;
  if (confirming) {
    $("pause-back").onclick = () => openPause(false);
    $("pause-quit").onclick = retreat;
    return;
  }
  $("pause-layout").onclick = () => {
    setScreen("layout");
    ui.hidden = false;
    openLayoutEditor(
      ui,
      layout,
      (value) => {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(value));
        layout = value;
        placeControls(layout);
      },
      () => {
        ui.innerHTML = "";
        ui.hidden = true;
        setScreen("battle");
        openPause();
      },
      {
        enabled: mode !== "coop",
        config: () => ({
          preferences: save,
          weapons: world?.players.find((p) => p.id === myId)?.weapons,
        }),
      },
    );
    if (mode === "coop")
      $("layout-message").textContent =
        "協力プレイは進行中です。試し撃ちはホームから利用できます。";
  };
  $("pause-resume").onclick = closePause;
  $("pause-leave").onclick = () => openPause(true);
  bindGyro("pause-", (next) => {
    const ok = write(next);
    if (ok) configured();
    return ok;
  });
  alignSettings(menu.querySelector(".pause-card")!);
  bindAimRanges("pause-", (next) => {
    const ok = write(next);
    if (ok) configured();
    return ok;
  });
  $("pause-quality").onchange = () => {
    const input = $("pause-quality") as HTMLSelectElement;
    if (write({ ...save, quality: Number(input.value) })) configured();
    else input.value = String(save.quality);
  };
  $("pause-damage").onchange = () => {
    if (
      write({
        ...save,
        damageNumbers: ($("pause-damage") as HTMLSelectElement)
          .value as Save["damageNumbers"],
      })
    )
      configured();
  };
  $("pause-map").onchange = () => {
    if (
      write({
        ...save,
        mapRotates: ($("pause-map") as HTMLSelectElement).value === "follow",
      })
    )
      configured();
  };
}
// Bound once, outside the HUD's ten-times-a-second rewrite.
$("pause").onclick = () => openPause(false);
let last = performance.now(),
  acc = 0,
  hudAt = 0;
function frame(now: number) {
  // Keep the next frame alive even if one simulation/render callback throws.
  // Otherwise menus still respond, but retreat and every later sortie freeze.
  requestAnimationFrame(frame);
  try {
    updateFrame(now);
  } catch (error) {
    acc = 0;
    throw error;
  }
}
function updateFrame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  const scopePlayer = world?.players.find((p) => p.id === myId);
  controls.setScopeAvailable(
    screen === "battle" &&
      !paused &&
      !!scopePlayer &&
      scopePlayer.hp > 0 &&
      scopePlayer.swapCd <= 0,
  );
  if (screen === "battle" && world && !(paused && mode === "solo")) {
    while (acc >= 0.05) {
      const input = document.hidden ? neutral() : controls.read();
      if (mode === "solo") {
        step(world, { [myId]: input });
        sound.update(world, myId, controls.input.yaw, !paused);
      } else {
        network?.input(input);
        const p = world.players.find((p) => p.id === myId);
        if (predicted && p?.hp && network?.ws?.readyState === 1) {
          const n = Math.max(1, Math.hypot(input.mx, input.mz)),
            distance =
              (p.evade > 0 ? MOVE_SPEED.dodge : MOVE_SPEED.walk) * 0.05;
          move(
            predicted,
            ((input.mx * Math.cos(input.yaw) + input.mz * Math.sin(input.yaw)) /
              n) *
              distance,
            ((input.mx * Math.sin(input.yaw) - input.mz * Math.cos(input.yaw)) /
              n) *
              distance,
            0.55,
            mapFor(world).blocks,
          );
        }
      }
      acc -= 0.05;
    }
    if (world.phase === "victory" || world.phase === "defeat") finishMission();
    else if (now - hudAt > 100) {
      hudAt = now;
      const p = world.players.find((p) => p.id === myId);
      if (p) {
        hud.innerHTML = hudMarkup(
          world,
          myId,
          status + (showFps ? ` · ${Math.round(view.fps)}FPS` : ""),
        );
        updateCooldowns(world, myId);
      }
    }
  } else acc = 0;
  if (screen === "stage-clear" && world?.run === clearRun) {
    if (now - clearStartedAt >= 2800)
      ui.firstElementChild?.classList.add("is-leaving");
    if (now - clearStartedAt >= 3200) result();
  }
  const currentPlayer = world?.players.find((p) => p.id === myId);
  controls.setScopeAvailable(
    screen === "battle" &&
      !paused &&
      !!currentPlayer &&
      currentPlayer.hp > 0 &&
      currentPlayer.swapCd <= 0,
  );
  updateScopeButtons(layout, {
    visible: screen === "battle" && !!currentPlayer && currentPlayer.hp > 0,
    available: controls.scopeAvailable,
    scoped: controls.scoped,
  });
  $("scope-overlay").hidden = !controls.scoped;
  sound.update(world, myId, controls.input.yaw, screen === "battle" && !paused);
  view.render(
    !["battle", "loading", "stage-clear", "result"].includes(screen) &&
      lobbyPreview
      ? lobbyPreview
      : world,
    myId,
    dt,
    controls.input.yaw,
    controls.input.pitch,
    mode === "coop" ? predicted : undefined,
    screen === "battle" && !(paused && mode === "solo"),
    controls.scoped,
    controls.aiming,
  );
  if (screen === "battle" && world)
    minimap.draw(world, myId, controls.input.yaw, now);
}
// Capture before menu handlers replace their DOM; native click covers keyboard too.
document.addEventListener(
  "click",
  (event) => {
    const target =
      event.target instanceof Element
        ? event.target.closest("button, select, [data-equip]")
        : null;
    if (!target || target.matches(":disabled") || target.closest("#controls"))
      return;
    sound.unlock();
    if (!target.matches("[data-equip]")) sound.play("menu");
  },
  true,
);
document.addEventListener("change", (event) => {
  if (event.target instanceof HTMLSelectElement) {
    sound.unlock();
    sound.play("menu");
  }
});
window.addEventListener("resize", () => placeControls(layout));
window.visualViewport?.addEventListener("resize", () => placeControls(layout));
window.addEventListener("hashchange", () => {
  if (
    inviteCode() &&
    !["battle", "stage-clear", "lobby", "result"].includes(screen)
  ) {
    mode = "coop";
    gear();
  }
});
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event as InstallPromptEvent;
  if (screen === "title") title();
});
window.addEventListener("appinstalled", () => {
  installPrompt = undefined;
  if (screen === "title") title();
});
if ("serviceWorker" in navigator)
  void navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .catch(() => {});
if (
  inviteCode() ||
  loadNetworkSession() ||
  new URLSearchParams(location.search).get("coop") === "1"
) {
  mode = "coop";
  gear();
} else title();
requestAnimationFrame(frame);
// Read-only diagnostics in development; no mission skip or debug damage endpoint.
if (import.meta.env.DEV)
  Object.defineProperty(window, "__swarm", {
    get: () => ({
      world: world ? structuredClone(world) : null,
      screen,
      id: myId,
      input: { ...controls.input },
      scoped: controls.scoped,
      cameraFov: view.camera.fov,
      mapAssets: view.mapAssets.status.map((s) => ({ ...s })),
      fps: view.fps,
      drawCalls: view.drawCalls,
      frameMs: [...view.frames],
      performance: {
        resolutionScale: view.adaptiveQuality.scale,
        pixelRatio: view.renderer.getPixelRatio(),
        triangles: view.renderer.info.render.triangles,
        effects: view.combat.items.length,
      },
      renderedLocal: (() => {
        const player = view.players.get(myId);
        return player ? { x: player.position.x, z: player.position.z } : null;
      })(),
      trooper: (() => {
        const model = view.players.get(myId);
        const trooper = model?.userData.trooper;
        return trooper
          ? {
              loaded: true,
              mode: trooper.mode,
              bones: trooper.bones.length,
              weapons: trooper.weapons.map(
                (w: { parent?: { name: string } }) => w.parent?.name,
              ),
            }
          : { loaded: false, error: model?.userData.trooperError ?? null };
      })(),
      cameraAnchor: { ...view.cameraAnchor },
      camera: { x: view.camera.position.x, z: view.camera.position.z },
      inventory: structuredClone(save.inventory),
      equipped: [...save.equipped],
    }),
  });
