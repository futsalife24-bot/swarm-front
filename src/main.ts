import "./style.css";
import "./mobile-ui.css";
import {
  defaultLayout,
  parseLayout,
  placeControls,
  LAYOUT_KEY,
} from "./client/layout";
import { openLayoutEditor } from "./client/layout-editor";
import { hudMarkup, updateCooldowns } from "./client/hud";
import { Minimap } from "./client/minimap";
import { CHANGELOG } from "./client/changelog";
import {
  EFFECTS,
  LIMITS,
  WAVE_INTERVAL,
  MOVE_SPEED,
  RARITIES,
  ROLL,
  LOWER_IS_BETTER,
  stats,
  type Roll,
  WEAPONS,
  type Weapon,
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
import { Renderer } from "./client/render";
import { Sound } from "./client/audio";
import { loadNetworkSession, Network } from "./client/network";
import {
  fresh,
  parseSave,
  persist,
  rewards,
  trimToKindCap,
  SAVE_KEY,
  type Save,
} from "./client/save";
const $ = (id: string) => document.getElementById(id)!;
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
  overflow: Weapon[] = [],
  netFatal = false,
  predicted: { x: number; z: number } | undefined;
let turnstileToken = "";
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
  save = parseSave(localStorage.getItem(SAVE_KEY));
  // Armouries built under the old single cap are brought down to the per-family
  // one. Say what went, rather than letting the count quietly shrink.
  const trimmed = trimToKindCap(save);
  if (trimmed.removed.length) {
    save = trimmed.save;
    persist(save);
    status = `武器庫を系統ごと${LIMITS.perKind}丁までに整理し、レア度と威力の低い${trimmed.removed.length}丁を手放しました。装備中の武器は残しています。`;
  }
} catch (e) {
  saveError = String((e as Error).message);
}
try {
  view = new Renderer($("world") as HTMLCanvasElement);
  view.onSound = (t) => sound.play(t);
} catch {
  ui.innerHTML =
    '<section class="panel"><h1>3D描画を開始できません</h1><p>WebGL 2に対応したブラウザで開いてください。</p></section>';
  throw new Error("WebGL2 unavailable");
}
function configured() {
  controls.sensitivity = save.sensitivity;
  sound.volume = save.volume;
  view.quality = save.quality;
  minimap.rotates = save.mapRotates === true;
  view.damageNumbers = save.damageNumbers ?? "self";
  view.resize();
  placeControls(layout);
}
configured();
function write(next: Save) {
  if (saveError) return false;
  try {
    persist(next);
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
  setScreen("title");
  world = null;
  ui.innerHTML = `<section class="title"><div class="eyebrow">FIELD TEST 01 <span>LOCAL BUILD</span></div><div class="mark">SF<span>／</span></div><h1>SWARM<br>FRONT<span class="dot">.</span></h1><p class="tagline">群れを砕け。仲間と、次の戦場へ。</p><p class="intro">三人称3D協力アクション · 開発用仮名</p><div class="title-actions"><button class="primary" id="solo">ソロで出撃準備 <span>↗</span></button><button id="coop">協力プレイ <small>1–4 PLAYERS</small></button>${installPrompt ? '<button id="install">ホーム画面に追加</button>' : ""}</div><p class="fine">ソロは通信サーバー不要。戦利品はこの端末に保存。</p>${saveError ? `<p class="error">${esc(saveError)}</p><button id="export">保存データを書き出す</button>` : ""}</section><aside class="mission-card"><div>01 / OPERATION</div><h2>灰明の街区</h2><p>3つの敵群を突破し、<br>大型個体〈クラウン〉を排除せよ。</p><span>INFANTRY · URBAN DISTRICT</span></aside><footer>FIRST PLAYABLE <span>無料素材・コード生成モデル ／ 公開前ビルド</span></footer><button id="changelog" class="corner-log">更新履歴</button>`;
  $("solo").onclick = () => {
    mode = "solo";
    network?.close();
    network = undefined;
    gear();
  };
  $("coop").onclick = () => {
    mode = "coop";
    gear();
  };
  if (installPrompt)
    $("install").onclick = async () => {
      const prompt = installPrompt;
      if (!prompt) return;
      installPrompt = undefined;
      await prompt.prompt();
      await prompt.userChoice;
      title();
    };
  if (saveError) $("export").onclick = exportSave;
  $("changelog").onclick = showChangelog;
}
function showChangelog() {
  const menu = $("pause-menu");
  menu.hidden = false;
  menu.innerHTML =
    '<div class="pause-card log-card"><h2>更新履歴</h2>' +
    CHANGELOG.map(
      (release) =>
        "<h3>" +
        esc(release.date) +
        "</h3><ul>" +
        release.items.map((line) => "<li>" + esc(line) + "</li>").join("") +
        "</ul>",
    ).join("") +
    '<div class="pause-actions"><button class="primary" id="log-close">閉じる</button></div></div>';
  $("log-close").onclick = () => {
    menu.hidden = true;
    menu.innerHTML = "";
  };
}
// This column is for what the numbers cannot say. Pierce qualifies and carries
// its count; a faster reload is already sitting in the 装填 column, so it is
// marked there instead of being named twice.
const EFFECT_SHORT: Record<Weapon["effect"], string> = {
  none: "—",
  pierce: "貫通 ×3",
  quick: "—",
};
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
        `${KIND_LABELS[k]} ${heldOf(k).length}/${LIMITS.perKind}` +
        (heldOf(k).length >= LIMITS.perKind ? "（満杯）" : ""),
    )
    .join(" · ");
// Tidying only ever offers one family at a time: the one that is actually
// blocking, or the one being browsed. Eighty buttons was not a choice.
function tidyMarkup() {
  const blocking = new Set(overflow.map((w) => w.kind));
  const kinds = (Object.keys(KIND_LABELS) as Weapon["kind"][]).filter((k) =>
    blocking.size ? blocking.has(k) : heldOf(k).length >= LIMITS.perKind,
  );
  const shown = kinds.length
    ? kinds
    : (Object.keys(KIND_LABELS) as Weapon["kind"][]).filter(
        (k) => heldOf(k).length > 0,
      );
  return shown
    .map((k) => {
      const spare = heldOf(k).filter((w) => !save.equipped.includes(w.id));
      const waiting = overflow.filter((w) => w.kind === k).length;
      return (
        `<div class="tidy-kind"><b>${KIND_LABELS[k]} ${heldOf(k).length}/${LIMITS.perKind}</b>` +
        (waiting
          ? `<small>この系統で ${waiting} 丁が保存待ちです。${waiting} 丁ぶん手放すと保存できます。</small>`
          : "<small>満杯です。新しい1丁を受け取るには1丁手放してください。</small>") +
        (spare.length
          ? spare
              .map(
                (w) =>
                  `<button data-discard="${w.id}">${weaponName(w)} · ${RARITIES[w.rarity]} · 威力${Math.round(stats(w).damage)}${w.effect === "none" ? "" : " · " + EFFECTS[w.effect]}</button>`,
              )
              .join("")
          : "<small>装備中の武器しかありません。先に装備を替えてください。</small>") +
        "</div>"
      );
    })
    .join("");
}
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
    diff = base ? Math.round(d.damage - stats(base).damage) : null;
  const damage =
    Math.round(d.damage) + (d.pellets > 1 ? " × " + d.pellets : "");
  // Each figure is graded against its own roll band. Reload is inverted there,
  // so a fast reload and a big magazine both read as the good end.
  const grade = (key: Roll) => {
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
    '</h3><em class="rarity-tag rarity' +
    w.rarity +
    '" title="' +
    EFFECTS[w.effect] +
    '">' +
    RARITIES[w.rarity] +
    '</em></div><div class="weapon-figures">' +
    figure("effect", EFFECT_SHORT[w.effect], "効果") +
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
      ? '<div class="loot-state"><b>獲得</b><small>' +
        (save.inventory.some((a) => a.id === w.id) ? "保存済み" : "未保存") +
        "</small></div>"
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

let weaponFilter = "all",
  weaponSort = "default";
const inviteCode = () =>
  /^[a-f0-9]{32}$/.test(location.hash.slice(1)) ? location.hash.slice(1) : "";
function gear() {
  setScreen("gear");
  world = null;
  predicted = undefined;
  const shown = save.inventory.filter(
    (w) => weaponFilter === "all" || w.kind === weaponFilter,
  );
  if (weaponSort === "power")
    shown.sort(
      (a, b) =>
        WEAPONS[b.kind].damage * b.power - WEAPONS[a.kind].damage * a.power,
    );
  if (weaponSort === "rarity") shown.sort((a, b) => b.rarity - a.rarity);
  const invitation = mode === "coop" ? inviteCode() : "";
  const previous = mode === "coop" ? loadNetworkSession() : null;
  const resumable =
    previous && (!invitation || invitation === previous.code) ? previous : null;
  const launchLabel =
    mode === "solo"
      ? "ソロ出撃 ↗"
      : network?.id
        ? "ルームに戻る ↗"
        : resumable
          ? "進行中の部隊へ戻る ↗"
          : invitation
            ? "招待ルームに参加 ↗"
            : "ルームを作る ↗";
  const endpoint = defaultEndpoint();
  const coopEntry =
    mode === "coop"
      ? `<div class="coop-entry"><b>${resumable ? "進行中の部隊があります" : invitation ? "招待を受け取りました" : "友人と遊ぶ"}</b><p>${resumable ? "30秒以内なら同じ隊員・戦闘状態へ復帰できます。" : invitation ? "装備を選び、上の「招待ルームに参加」を押してください。" : "人間確認の後に「ルームを作る」を押すと、すぐ招待リンクを送れます。作成キーの共有は不要です。"}</p></div>${!resumable && !invitation ? '<div id="turnstile-room-create" class="turnstile-room-create" aria-label="ルーム作成の人間確認"></div><p id="turnstile-status" class="fine">人間確認が終わるまで、ルーム作成はできません。</p>' : ""}<details class="coop-advanced"><summary>接続先を手動設定（開発用）</summary><div class="join"><input id="endpoint" aria-label="協力サーバー" value="${esc(endpoint)}"><input id="creation-key" type="password" aria-label="ローカル作成キー" placeholder="ローカル作成キー" autocomplete="off" maxlength="256"></div></details>`
      : "";
  ui.innerHTML = `<section class="panel gear"><div class="gear-brief"><header><div><div class="eyebrow">LOADOUT / ${mode.toUpperCase()}</div><h1>出撃準備</h1></div><button class="primary" id="launch" ${saveError ? "disabled" : ""}>${launchLabel}</button><button id="home">タイトルへ</button></header><div class="brief"><div><b>01 灰明の街区</b><p>3ウェーブ → クラウン撃破。被弾せず5秒で自動回復、波の間にもHP回復。目標5〜8分。</p></div></div>${coopEntry}<p class="status" role="status">${esc(saveError || status)}</p><div class="gear-tools"><button id="layout-settings">操作ボタンの配置</button><small>${esc(layoutWarning || "ボタンの位置・大きさ・濃さを設定")}</small></div><div class="loadout-slots">${equipped()
    .map(
      (w, i) =>
        `<button type="button" data-pick="${i}" class="${activeSlot === i ? "selected" : ""}" aria-pressed="${activeSlot === i}">装備 ${i + 1}<b>${weaponName(w)}</b></button>`,
    )
    .join(
      "",
    )}</div><p class="slot-hint">装備 ${activeSlot + 1} に入れる武器を右から選んでください。</p><div class="inventory-head"><b>武器庫 <span>${kindTally()}</span></b></div><details class="inventory-management" ${overflow.length ? "open" : ""}><summary>武器を整理する（装備中は保護）</summary>${tidyMarkup()}</details><details><summary>操作・設定・保存について</summary><p>PC: WASD移動 / クリック射撃・マウス照準 / R装填 / Q切替 / Space回避 / E長押し蘇生 / Escマウス解放</p><p>スマホ: 左スティック移動 / 右側ドラッグ照準 / 射撃ボタン長押し。味方3.5m以内で蘇生を2.5秒長押し。</p><label>視点感度 <input id="sense" type="range" min="0.1" max="6" step="0.1" value="${save.sensitivity}"></label><label>音量（0でミュート） <input id="volume" type="range" min="0" max="1" step="0.05" value="${save.volume}"></label><label>描画品質 <select id="quality"><option value="1" ${save.quality === 1 ? "selected" : ""}>標準</option><option value="0.65" ${save.quality === 0.65 ? "selected" : ""}>軽量</option></select></label><label>ミニマップ <select id="map-rotate"><option value="fixed" ${save.mapRotates ? "" : "selected"}>北を上に固定</option><option value="follow" ${save.mapRotates ? "selected" : ""}>視点に合わせて回す</option></select></label><label>ダメージ表示 <select id="damage-numbers"><option value="self" ${(save.damageNumbers ?? "self") === "self" ? "selected" : ""}>自分のみ</option><option value="all" ${save.damageNumbers === "all" ? "selected" : ""}>味方も表示</option><option value="off" ${save.damageNumbers === "off" ? "selected" : ""}>表示しない</option></select></label><p>道中の緑の戦利品は接近して回収。勝利時に確定、敗北・復帰できない切断では未確定品を失います。保存済みの武器は失いません。端末変更・ブラウザデータ削除で引き継げません。クラウド保存や完全な改ざん防止はありません。</p><button id="export">保存データを書き出す</button></details></div><section class="gear-arsenal"><div class="weapon-filters"><select id="weapon-filter" aria-label="武器系統"><option value="all">全系統</option><option value="rifle">ライフル</option><option value="shotgun">ショットガン</option><option value="rocket">ロケット</option></select><select id="weapon-sort" aria-label="武器の並び順"><option value="default">入手順</option><option value="rarity">レア度順</option><option value="power">1発の威力順</option></select></div><div class="weapon-list" aria-label="所持武器リスト"><div class="weapon-head" aria-hidden="true"><span>武器</span><span>効果</span><span>威力</span><span>装弾</span><span>装填</span><span>射程</span><span>連射</span><span></span></div>${shown.map((w) => card(w)).join("")}</div></section></section>`;
  const filter = $("weapon-filter") as HTMLSelectElement,
    sort = $("weapon-sort") as HTMLSelectElement;
  filter.value = weaponFilter;
  sort.value = weaponSort;
  filter.onchange = () => {
    weaponFilter = filter.value;
    gear();
  };
  sort.onchange = () => {
    weaponSort = sort.value;
    gear();
  };
  const gearActions = document.createElement("div");
  gearActions.className = "gear-header-actions";
  ui.querySelector(".gear header")!.append(gearActions);
  for (const id of ["layout-settings", "home", "launch"])
    gearActions.append($(id));
  ui.querySelector(".gear-tools")!.remove();
  if (mode === "coop" && !resumable && !invitation && import.meta.env.PROD) {
    const launch = $("launch") as HTMLButtonElement;
    launch.disabled = true;
    void mountTurnstile(endpoint);
  }
  if (layoutWarning) {
    const note = document.createElement("p");
    note.className = "status";
    note.textContent = layoutWarning;
    gearActions.after(note);
  }
  $("layout-settings").onclick = () => {
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
      () => gear(),
    );
  };
  $("home").onclick = () => {
    network?.close();
    network = undefined;
    title();
  };
  $("launch").onclick = () => {
    sound.unlock();
    if (mode === "solo") solo();
    else if (network?.id) lobby();
    else void connect(!inviteCode() && !resumable, Boolean(resumable));
  };
  ui.querySelectorAll<HTMLButtonElement>("[data-pick]").forEach(
    (b) =>
      (b.onclick = () => {
        activeSlot = Number(b.dataset.pick);
        gear();
      }),
  );
  const equip = (id: string) => {
    const n = structuredClone(save);
    const other = 1 - activeSlot;
    // Both slots must stay distinct, so taking one that is already worn on the
    // other side swaps them rather than duplicating it.
    if (n.equipped[other] === id) n.equipped[other] = n.equipped[activeSlot];
    n.equipped[activeSlot] = id;
    if (write(n)) {
      sound.unlock();
      sound.play("equip");
      network?.equipment(equipped());
    }
    gear();
  };
  ui.querySelectorAll<HTMLElement>("[data-equip]").forEach((el) => {
    el.onclick = () => equip(el.dataset.equip!);
    el.onkeydown = (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      equip(el.dataset.equip!);
    };
  });
  ui.querySelectorAll<HTMLButtonElement>("[data-discard]").forEach(
    (b) =>
      (b.onclick = () => {
        if (!confirm("この武器を整理しますか？ 装備中の武器は対象外です。"))
          return;
        const n = structuredClone(save);
        n.inventory = n.inventory.filter((w) => w.id !== b.dataset.discard);
        write(n);
        gear();
      }),
  );
  $("sense").oninput = () => {
    const next = {
      ...save,
      sensitivity: Number(($("sense") as HTMLInputElement).value),
    };
    if (write(next)) configured();
  };
  $("volume").oninput = () => {
    sound.unlock();
    const next = {
      ...save,
      volume: Number(($("volume") as HTMLInputElement).value),
    };
    if (write(next)) configured();
  };
  $("quality").onchange = () => {
    if (
      write({
        ...save,
        quality: Number(($("quality") as HTMLSelectElement).value),
      })
    )
      configured();
  };
  $("map-rotate").onchange = () => {
    if (
      write({
        ...save,
        mapRotates: ($("map-rotate") as HTMLSelectElement).value === "follow",
      })
    )
      configured();
  };
  const setDamage = (id: string) => {
    $(id).onchange = () => {
      if (
        write({
          ...save,
          damageNumbers: ($(id) as HTMLSelectElement)
            .value as Save["damageNumbers"],
        })
      )
        configured();
    };
  };
  setDamage("damage-numbers");
  $("export").onclick = exportSave;
}
function exportSave() {
  const raw = localStorage.getItem(SAVE_KEY) ?? JSON.stringify(save);
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
  );
  addPlayer(world, myId, equipped());
  start(world);
  resultRun = "";
  controls.reset();
  battle();
}
async function connect(create: boolean, restore = false) {
  status = "接続中…";
  const previous = restore ? loadNetworkSession() : null;
  const endpoint =
    previous?.endpoint ?? ($("endpoint") as HTMLInputElement).value.trim();
  let code = previous?.code ?? inviteCode();
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
    network.onLobby = lobby;
    network.onWorld = (w) => {
      world = w;
      myId = network!.id;
      if (w.phase === "battle") {
        if (screen !== "battle" && !netFatal) battle();
        const p = w.players.find((p) => p.id === myId);
        if (p) {
          if (
            !predicted ||
            Math.hypot(predicted.x - p.x, predicted.z - p.z) > 3
          )
            predicted = { x: p.x, z: p.z };
          else {
            predicted.x += (p.x - predicted.x) * 0.4;
            predicted.z += (p.z - predicted.z) * 0.4;
          }
        }
      } else if (w.phase === "victory" || w.phase === "defeat") {
        if (resultRun !== w.run) result();
      }
    };
    network.ready = () => {
      myId = network!.id;
    };
    if (create) {
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (local) {
        const field = $("creation-key") as HTMLInputElement;
        const key = field.value;
        field.value = "";
        code = await network.create("", key);
      } else {
        if (!turnstileToken) throw new Error("人間確認を完了してください");
        const proof = turnstileToken;
        turnstileToken = "";
        code = await network.create(proof);
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
  if (netFatal || screen === "battle" || screen === "result") return;
  setScreen("lobby");
  const members = network?.members ?? [];
  const link = `${location.origin}${location.pathname}${location.search}#${network?.code ?? ""}`;
  ui.innerHTML = `<section class="panel lobby"><div class="eyebrow">SQUAD / ${members.filter((p) => p.connected).length} OF 4</div><h1>部隊を編成</h1><p>① 招待リンクを友人へ送る　② 友人がリンクを開いて参加　③ 準備完了になったら出撃</p><label>招待リンク <input id="invite" readonly value="${esc(link)}"></label><button class="primary" id="copy">招待リンクを共有</button><p class="status">${esc(status)}</p><div class="members">${members.map((m, i) => `<div><b>0${i + 1} ${m.id === network?.id ? "あなた" : "隊員"}</b><span>${m.connected ? (m.ready ? "準備完了" : "装備待ち") : "切断中"}</span></div>`).join("")}</div><button class="primary" id="begin" ${!network?.id || members.filter((m) => m.connected)[0]?.id !== network.id || members.some((m) => m.connected && !m.ready) ? "disabled" : ""}>全員で出撃 ↗</button><button id="back">装備画面へ</button><p class="fine">ホストだけが出撃を開始できます。進行中への新規参加はできません。</p></section>`;
  $("begin").onclick = () => {
    sound.unlock();
    network?.send({ type: "start" });
  };
  $("copy").onclick = async () => {
    try {
      if (navigator.share)
        await navigator.share({
          title: "SWARM FRONT 協力プレイ",
          text: "このリンクを開いて部隊に参加してください。",
          url: link,
        });
      else {
        await navigator.clipboard.writeText(link);
        $("copy").textContent = "リンクをコピーしました";
      }
    } catch {
      ($("invite") as HTMLInputElement).select();
    }
  };
  $("back").onclick = () => gear();
}
function battle() {
  setScreen("battle");
  ui.innerHTML = "";
  status = mode === "solo" ? "SOLO" : "CO-OP";
  const fallback = placeControls(layout);
  if (fallback) status += " · 標準配置";
}
function result() {
  if (!world) return;
  const w = world;
  resultRun = w.run;
  setScreen("result");
  const items = w.rewards[myId] ?? [];
  overflow = [];
  if (w.phase === "victory") {
    try {
      const r = rewards(save, w.run, items);
      overflow = r.overflow;
      if (write(r.save))
        status = overflow.length
          ? `${[...new Set(overflow.map((w) => KIND_LABELS[w.kind]))].join("・")}が満杯で${overflow.length}丁を保存できませんでした。装備画面の「武器を整理する」で同じ系統から手放すと保存できます。`
          : "戦利品を端末に保存しました";
    } catch (e) {
      status = (e as Error).message;
    }
  }
  ui.innerHTML = `<section class="panel result"><div class="result-summary"><div class="eyebrow">OPERATION 01 / DEBRIEF</div><h1>${w.phase === "victory" ? "MISSION CLEAR" : "MISSION FAILED"}</h1><p>${w.phase === "victory" ? "街区を奪還。新しい武器で、もう一度。" : esc(w.reason || "部隊が全員ダウンしました")}</p><div class="stats"><div><span>TIME</span><b>${Math.floor(w.time / 60)}:${String(Math.floor(w.time % 60)).padStart(2, "0")}</b></div><div><span>ELIMINATIONS</span><b>${w.totalKills}</b></div><div><span>RECOVERED</span><b>${items.length}</b></div></div><div class="result-actions"><button class="primary" id="regear">装備変更・再出撃 ↗</button><button id="retry-save">保存を再試行</button>${overflow.length ? `<p>${esc([...new Set(overflow.map((w) => KIND_LABELS[w.kind]))].join("・"))}が満杯です。装備変更へ進み、同じ系統から手放してからこの画面で保存を再試行してください。</p>` : ""}</div></div><section class="result-loot"><h2>${w.phase === "victory" ? "個別戦利品" : "未確定戦利品は失われました"}</h2><p class="status" role="status">${esc(w.phase === "victory" ? status : "保存済みの武器は保持されています。")}</p><div class="loot-list" aria-label="獲得武器リスト">${items.map((w) => card(w, true)).join("")}</div></section></section>`;
  $("regear").onclick = () => {
    if (items.some((i) => !save.inventory.some((w) => w.id === i.id))) {
      status =
        "未保存の報酬があります。この画面のまま保存を再試行してください。武器庫が満杯なら下の整理を使ってください。";
      const p = ui.querySelector(".status")!;
      p.textContent = status;
      const spare = save.inventory.find(
        (i) =>
          !save.equipped.includes(i.id) && !items.some((w) => w.id === i.id),
      );
      if (spare && !$("free-slot")) {
        const b = document.createElement("button");
        b.id = "free-slot";
        b.textContent = `${weaponName(spare)}を整理して再試行`;
        b.onclick = () => {
          if (confirm(`${weaponName(spare)}を整理しますか？`)) {
            write({
              ...save,
              inventory: save.inventory.filter((i) => i.id !== spare.id),
            });
            result();
          }
        };
        p.after(b);
      }
      return;
    }
    gear();
  };
  $("retry-save").onclick = result;
  $("retry-save").hidden =
    w.phase !== "victory" ||
    (items.every((i) => save.inventory.some((a) => a.id === i.id)) &&
      !overflow.length);
}
// Solo runs the world here, so it can truly stop. Co-op cannot: the server keeps
// stepping and the player keeps taking hits, which the menu has to admit.
let paused = false;
function closePause() {
  paused = false;
  $("pause-menu").hidden = true;
  $("pause-menu").innerHTML = "";
  controls.enabled = screen === "battle";
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
    : `<div class="pause-card"><h2>一時停止</h2>${mode === "coop" ? '<p class="warn">協力プレイは止まりません。この間も戦闘は進み、被弾します。</p>' : "<p>ソロなので戦闘は止まっています。</p>"}<label>視点感度 <input id="pause-sense" type="range" min="0.1" max="6" step="0.1" value="${save.sensitivity}"></label><label>音量 <input id="pause-volume" type="range" min="0" max="1" step="0.05" value="${save.volume}"></label><label>ミニマップ <select id="pause-map"><option value="fixed" ${save.mapRotates ? "" : "selected"}>北を上に固定</option><option value="follow" ${save.mapRotates ? "selected" : ""}>視点に合わせて回す</option></select></label><label>ダメージ表示 <select id="pause-damage"><option value="self" ${(save.damageNumbers ?? "self") === "self" ? "selected" : ""}>自分のみ</option><option value="all" ${save.damageNumbers === "all" ? "selected" : ""}>味方も表示</option><option value="off" ${save.damageNumbers === "off" ? "selected" : ""}>表示しない</option></select></label><div class="pause-actions"><button class="primary" id="pause-resume">戦闘に戻る</button><button id="pause-leave">作戦離脱…</button></div></div>`;
  if (confirming) {
    $("pause-back").onclick = () => openPause(false);
    $("pause-quit").onclick = retreat;
    return;
  }
  $("pause-resume").onclick = closePause;
  $("pause-leave").onclick = () => openPause(true);
  $("pause-sense").oninput = () => {
    const next = {
      ...save,
      sensitivity: Number(($("pause-sense") as HTMLInputElement).value),
    };
    if (write(next)) configured();
  };
  $("pause-volume").oninput = () => {
    sound.unlock();
    const next = {
      ...save,
      volume: Number(($("pause-volume") as HTMLInputElement).value),
    };
    if (write(next)) configured();
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
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  if (screen === "battle" && world && !(paused && mode === "solo")) {
    while (acc >= 0.05) {
      const input = document.hidden ? neutral() : controls.read();
      if (mode === "solo") step(world, { [myId]: input });
      else {
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
          );
        }
      }
      acc -= 0.05;
    }
    if (world.phase === "victory" || world.phase === "defeat") result();
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
  view.render(
    world,
    myId,
    dt,
    controls.input.yaw,
    controls.input.pitch,
    mode === "coop" ? predicted : undefined,
  );
  if (screen === "battle" && world)
    minimap.draw(world, myId, controls.input.yaw, now);
  requestAnimationFrame(frame);
}
window.addEventListener("resize", () => placeControls(layout));
window.visualViewport?.addEventListener("resize", () => placeControls(layout));
window.addEventListener("hashchange", () => {
  if (inviteCode() && !["battle", "lobby", "result"].includes(screen)) {
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
if (inviteCode() || loadNetworkSession()) {
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
      fps: view.fps,
      drawCalls: view.drawCalls,
      frameMs: [...view.frames],
      renderedLocal: (() => {
        const player = view.players.get(myId);
        return player ? { x: player.position.x, z: player.position.z } : null;
      })(),
      cameraAnchor: { ...view.cameraAnchor },
      camera: { x: view.camera.position.x, z: view.camera.position.z },
      inventory: structuredClone(save.inventory),
      equipped: [...save.equipped],
    }),
  });
