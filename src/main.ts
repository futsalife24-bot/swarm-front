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
import {
  EFFECTS,
  LIMITS,
  WAVE_INTERVAL,
  MOVE_SPEED,
  RARITIES,
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
  SAVE_KEY,
  type Save,
} from "./client/save";
const $ = (id: string) => document.getElementById(id)!;
const showFps = new URLSearchParams(location.search).get("qa") === "1";
const ui = $("ui"),
  hud = $("hud"),
  controls = new Controls(),
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
try {
  save = parseSave(localStorage.getItem(SAVE_KEY));
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
  controls.enabled = name === "battle";
  if (!controls.enabled) {
    controls.reset();
    if (document.pointerLockElement) void document.exitPointerLock();
  }
  hud.hidden = name !== "battle";
  $("controls").hidden = name !== "battle";
}
function title() {
  setScreen("title");
  world = null;
  ui.innerHTML = `<section class="title"><div class="eyebrow">FIELD TEST 01 <span>LOCAL BUILD</span></div><div class="mark">SF<span>／</span></div><h1>SWARM<br>FRONT<span class="dot">.</span></h1><p class="tagline">群れを砕け。仲間と、次の戦場へ。</p><p class="intro">三人称3D協力アクション · 開発用仮名</p><div class="title-actions"><button class="primary" id="solo">ソロで出撃準備 <span>↗</span></button><button id="coop">協力プレイ <small>1–4 PLAYERS</small></button>${installPrompt ? '<button id="install">ホーム画面に追加</button>' : ""}</div><p class="fine">ソロは通信サーバー不要。戦利品はこの端末に保存。</p>${saveError ? `<p class="error">${esc(saveError)}</p><button id="export">保存データを書き出す</button>` : ""}</section><aside class="mission-card"><div>01 / OPERATION</div><h2>灰明の街区</h2><p>3つの敵群を突破し、<br>大型個体〈クラウン〉を排除せよ。</p><span>INFANTRY · URBAN DISTRICT</span></aside><footer>FIRST PLAYABLE <span>無料素材・コード生成モデル ／ 公開前ビルド</span></footer>`;
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
}
function card(w: Weapon, lootOnly = false) {
  const d = WEAPONS[w.kind],
    base = equipped().find((a) => a.kind === w.kind),
    diff = base ? Math.round(d.damage * (w.power - base.power)) : null;
  const damage =
    Math.round(d.damage * w.power) + (d.pellets > 1 ? " × " + d.pellets : "");
  return (
    '<article class="weapon-row rarity' +
    w.rarity +
    '"><div class="weapon-identity"><h3>' +
    weaponName(w) +
    "</h3><small>" +
    RARITIES[w.rarity] +
    " · " +
    EFFECTS[w.effect] +
    '</small></div><div class="weapon-stat"><small>威力' +
    (d.pellets > 1 ? " / 散弾" : "") +
    "</small><b>" +
    damage +
    "</b><small>" +
    (diff === null
      ? "同系統未装備"
      : (diff >= 0 ? "+" : "") + diff + " / 装備比較") +
    '</small></div><div class="weapon-stat"><small>装弾 / 装填</small><b>' +
    d.mag +
    " / " +
    (d.reload * (w.effect === "quick" ? 0.8 : 1)).toFixed(2) +
    "s</b><small>" +
    d.range +
    "m · " +
    (1 / d.interval).toFixed(1) +
    "発/s</small></div>" +
    (lootOnly
      ? '<div class="loot-state"><b>獲得</b><small>' +
        (save.inventory.some((a) => a.id === w.id) ? "保存済み" : "未保存") +
        "</small></div>"
      : '<div class="equip-actions">' +
        [0, 1]
          .map(
            (slot) =>
              '<button data-equip="' +
              w.id +
              '" data-slot="' +
              slot +
              '" ' +
              (save.equipped[1 - slot] === w.id ? "disabled" : "") +
              ' class="' +
              (save.equipped[slot] === w.id ? "selected" : "") +
              '">' +
              (save.equipped[slot] === w.id ? "装備中" : "装備") +
              " " +
              (slot + 1) +
              "</button>",
          )
          .join("") +
        "</div>") +
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
  const endpoint =
    import.meta.env.VITE_SERVER_URL ??
    (import.meta.env.PROD ? `${location.origin}/api` : "http://127.0.0.1:8787");
  const coopEntry =
    mode === "coop"
      ? `<div class="coop-entry"><b>${resumable ? "進行中の部隊があります" : invitation ? "招待を受け取りました" : "友人と遊ぶ"}</b><p>${resumable ? "30秒以内なら同じ隊員・戦闘状態へ復帰できます。" : invitation ? "装備を選び、上の「招待ルームに参加」を押してください。" : "装備を選び、上の「ルームを作る」を押します。次の画面から友人へリンクを送れます。"}</p></div><details class="coop-advanced"><summary>招待コード・接続先を手動設定</summary><div class="join"><input id="code" aria-label="招待コード" placeholder="32文字の招待コード" value="${esc(invitation)}" maxlength="32"><button id="join">コードで参加</button><input id="creation-key" type="password" aria-label="ルーム作成キー" placeholder="管理者用の作成キー" autocomplete="off" maxlength="256"><input id="endpoint" aria-label="協力サーバー" value="${esc(endpoint)}"></div></details>`
      : "";
  ui.innerHTML = `<section class="panel gear"><header><div><div class="eyebrow">LOADOUT / ${mode.toUpperCase()}</div><h1>出撃準備</h1></div><button id="home">タイトルへ</button></header><div class="brief"><div><b>01 灰明の街区</b><p>3ウェーブ → クラウン撃破。被弾せず5秒で自動回復、波の間にもHP回復。目標5〜8分。</p></div><button class="primary" id="launch" ${saveError ? "disabled" : ""}>${launchLabel}</button></div>${coopEntry}<p class="status" role="status">${esc(saveError || status)}</p><div class="gear-tools"><button id="layout-settings">操作ボタンの配置</button><small>${esc(layoutWarning || "ボタンの位置・大きさ・濃さを設定")}</small></div><div class="loadout-slots">${equipped()
    .map((w, i) => `<span>装備 ${i + 1}<b>${weaponName(w)}</b></span>`)
    .join(
      "",
    )}</div><div class="inventory-head"><b>武器庫 <span>${save.inventory.length} / ${LIMITS.inventory}</span></b><div class="weapon-filters"><select id="weapon-filter" aria-label="武器系統"><option value="all">全系統</option><option value="rifle">ライフル</option><option value="shotgun">ショットガン</option><option value="rocket">ロケット</option></select><select id="weapon-sort" aria-label="武器の並び順"><option value="default">入手順</option><option value="rarity">レア度順</option><option value="power">1発の威力順</option></select></div></div><div class="weapon-list" aria-label="所持武器リスト">${shown.map((w) => card(w)).join("")}</div><details class="inventory-management"><summary>武器を整理する（装備中は保護）</summary>${save.inventory
    .filter((w) => !save.equipped.includes(w.id))
    .map(
      (w) =>
        `<button data-discard="${w.id}">${weaponName(w)} · 威力${Math.round(WEAPONS[w.kind].damage * w.power)}を整理</button>`,
    )
    .join(
      "",
    )}</details><details><summary>操作・設定・保存について</summary><p>PC: WASD移動 / クリック射撃・マウス照準 / R装填 / Q切替 / Space回避 / E長押し蘇生 / Escマウス解放</p><p>スマホ: 左スティック移動 / 右側ドラッグ照準 / 射撃ボタン長押し。味方3.5m以内で蘇生を2.5秒長押し。</p><label>視点感度 <input id="sense" type="range" min="0.3" max="2.5" step="0.1" value="${save.sensitivity}"></label><label>音量（0でミュート） <input id="volume" type="range" min="0" max="1" step="0.05" value="${save.volume}"></label><label>描画品質 <select id="quality"><option value="1" ${save.quality === 1 ? "selected" : ""}>標準</option><option value="0.65" ${save.quality === 0.65 ? "selected" : ""}>軽量</option></select></label><p>道中の緑の戦利品は接近して回収。勝利時に確定、敗北・復帰できない切断では未確定品を失います。保存済みの武器は失いません。端末変更・ブラウザデータ削除で引き継げません。クラウド保存や完全な改ざん防止はありません。</p><button id="export">保存データを書き出す</button></details></section>`;
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
  if (mode === "coop") $("join").onclick = () => void connect(false);
  ui.querySelectorAll<HTMLButtonElement>("[data-equip]").forEach(
    (b) =>
      (b.onclick = () => {
        const n = structuredClone(save);
        n.equipped[Number(b.dataset.slot)] = b.dataset.equip!;
        if (write(n)) {
          network?.equipment(equipped());
        }
        gear();
      }),
  );
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
  let code = previous?.code ?? ($("code") as HTMLInputElement).value.trim();
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
      const field = $("creation-key") as HTMLInputElement;
      const key = field.value;
      field.value = "";
      code = await network.create(key);
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
          ? `所持上限で${overflow.length}個が未保存です。整理して再試行してください。`
          : "戦利品を端末に保存しました";
    } catch (e) {
      status = (e as Error).message;
    }
  }
  ui.innerHTML = `<section class="panel result"><div class="result-summary"><div class="eyebrow">OPERATION 01 / DEBRIEF</div><h1>${w.phase === "victory" ? "MISSION CLEAR" : "MISSION FAILED"}</h1><p>${w.phase === "victory" ? "街区を奪還。新しい武器で、もう一度。" : esc(w.reason || "部隊が全員ダウンしました")}</p><div class="stats"><div><span>TIME</span><b>${Math.floor(w.time / 60)}:${String(Math.floor(w.time % 60)).padStart(2, "0")}</b></div><div><span>ELIMINATIONS</span><b>${w.totalKills}</b></div><div><span>RECOVERED</span><b>${items.length}</b></div></div><div class="result-actions"><button class="primary" id="regear">装備変更・再出撃 ↗</button><button id="retry-save">保存を再試行</button>${overflow.length ? "<p>所持上限: 装備画面で整理後、この結果を再度保存できます。</p>" : ""}</div></div><section class="result-loot"><h2>${w.phase === "victory" ? "個別戦利品" : "未確定戦利品は失われました"}</h2><p class="status" role="status">${esc(w.phase === "victory" ? status : "保存済みの武器は保持されています。")}</p><div class="loot-list" aria-label="獲得武器リスト">${items.map((w) => card(w, true)).join("")}</div></section></section>`;
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
let last = performance.now(),
  acc = 0,
  hudAt = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  if (screen === "battle" && world) {
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
        updateCooldowns(p);
        $("retreat").onclick = () => {
          if (mode === "coop") {
            network?.close();
            network = undefined;
          }
          status = "作戦を離脱しました。未確定品は保存されません。";
          gear();
        };
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
