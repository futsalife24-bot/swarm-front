import "./style.css";
import { EFFECTS, LIMITS, RARITIES, WEAPONS, type Weapon } from "./shared/defs";
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
import { Network } from "./client/network";
import {
  fresh,
  parseSave,
  persist,
  rewards,
  SAVE_KEY,
  type Save,
} from "./client/save";
const $ = (id: string) => document.getElementById(id)!;
const ui = $("ui"),
  hud = $("hud"),
  controls = new Controls(),
  sound = new Sound();
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
  ui.innerHTML = `<section class="title"><div class="eyebrow">FIELD TEST 01 <span>LOCAL BUILD</span></div><div class="mark">SF<span>／</span></div><h1>SWARM<br>FRONT<span class="dot">.</span></h1><p class="tagline">群れを砕け。仲間と、次の戦場へ。</p><p class="intro">三人称3D協力アクション · 開発用仮名</p><div class="title-actions"><button class="primary" id="solo">ソロで出撃準備 <span>↗</span></button><button id="coop">協力プレイ <small>1–4 PLAYERS</small></button></div><p class="fine">ソロは通信サーバー不要。戦利品はこの端末に保存。</p>${saveError ? `<p class="error">${esc(saveError)}</p><button id="export">保存データを書き出す</button>` : ""}</section><aside class="mission-card"><div>01 / OPERATION</div><h2>灰明の街区</h2><p>3つの敵群を突破し、<br>大型個体〈クラウン〉を排除せよ。</p><span>INFANTRY · URBAN DISTRICT</span></aside><footer>FIRST PLAYABLE <span>無料素材・コード生成モデル ／ 公開前ビルド</span></footer>`;
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
  if (saveError) $("export").onclick = exportSave;
}
function card(w: Weapon) {
  const def = WEAPONS[w.kind],
    base = equipped().find((a) => a.kind === w.kind) ?? equipped()[0],
    diff = Math.round(
      def.damage * w.power - WEAPONS[base.kind].damage * base.power,
    );
  return `<article class="weapon rarity${w.rarity}"><div class="weapon-top"><span>${RARITIES[w.rarity]}</span><b>${w.kind === "rifle" ? "━━╾" : w.kind === "shotgun" ? "═╦═" : "◉━━"}</b></div><h3>${weaponName(w)}</h3><p>${w.kind === "rifle" ? "連射で群れを削る" : w.kind === "shotgun" ? "近距離・8発の散弾" : "爆風半径6.5m"}</p><dl><div><dt>威力${def.pellets > 1 ? " / 1発" : ""}</dt><dd>${Math.round(def.damage * w.power)} <small>${diff >= 0 ? "+" : ""}${diff}</small></dd></div><div><dt>装弾 / 装填</dt><dd>${def.mag} / ${def.reload * (w.effect === "quick" ? 0.8 : 1)}s</dd></div></dl><p class="effect">${EFFECTS[w.effect]}</p><div class="equip-actions">${[0, 1].map((slot) => `<button data-equip="${w.id}" data-slot="${slot}" ${save.equipped[1 - slot] === w.id ? "disabled" : ""} class="${save.equipped[slot] === w.id ? "selected" : ""}">${save.equipped[slot] === w.id ? "装備中" : "装備"} ${slot + 1}</button>`).join("")}</div>${!save.equipped.includes(w.id) ? `<button class="discard" data-discard="${w.id}">整理して空きを作る</button>` : ""}</article>`;
}
function gear() {
  setScreen("gear");
  world = null;
  predicted = undefined;
  ui.innerHTML = `<section class="panel gear"><header><div><div class="eyebrow">LOADOUT / ${mode.toUpperCase()}</div><h1>出撃準備</h1></div><button id="home">タイトルへ</button></header><div class="brief"><div><b>01 灰明の街区</b><p>3ウェーブ → クラウン撃破。被弾せず5秒で自動回復、波の間にもHP回復。目標5〜8分。</p></div><button class="primary" id="launch" ${saveError ? "disabled" : ""}>${mode === "solo" ? "ソロ出撃 ↗" : network?.id ? "ルームに戻る ↗" : "ルーム作成 ↗"}</button></div>${mode === "coop" ? `<div class="join"><input id="code" aria-label="招待コード" placeholder="32文字の招待コード" value="${esc(location.hash.slice(1))}" maxlength="32"><button id="join">招待から参加</button><input id="endpoint" aria-label="協力サーバー" value="${esc(import.meta.env.VITE_SERVER_URL ?? "http://127.0.0.1:8787")}"></div>` : ""}<p class="status" role="status">${esc(saveError || status)}</p><div class="inventory-head"><b>武器庫 <span>${save.inventory.length} / ${LIMITS.inventory}</span></b><span>2本を持ち込み · 数字の差は同系統の装備（なければ装備1）との単発比較</span></div><div class="weapon-grid">${save.inventory.map(card).join("")}</div><details><summary>操作・設定・保存について</summary><p>PC: WASD移動 / クリック射撃・マウス照準 / R装填 / Q切替 / Space回避 / E長押し蘇生 / Escマウス解放</p><p>スマホ: 左スティック移動 / 右側ドラッグ照準 / 射撃ボタン長押し。味方3.5m以内で蘇生を2.5秒長押し。</p><label>視点感度 <input id="sense" type="range" min="0.3" max="2.5" step="0.1" value="${save.sensitivity}"></label><label>音量（0でミュート） <input id="volume" type="range" min="0" max="1" step="0.05" value="${save.volume}"></label><label>描画品質 <select id="quality"><option value="1" ${save.quality === 1 ? "selected" : ""}>標準</option><option value="0.65" ${save.quality === 0.65 ? "selected" : ""}>軽量</option></select></label><p>道中の緑の戦利品は接近して回収。勝利時に確定、敗北・復帰できない切断では未確定品を失います。保存済みの武器は失いません。端末変更・ブラウザデータ削除で引き継げません。クラウド保存や完全な改ざん防止はありません。</p><button id="export">保存データを書き出す</button></details></section>`;
  $("home").onclick = () => {
    network?.close();
    network = undefined;
    title();
  };
  $("launch").onclick = () => {
    sound.unlock();
    if (mode === "solo") solo();
    else if (network?.id) lobby();
    else void connect(true);
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
async function connect(create: boolean) {
  status = "接続中…";
  const endpoint = ($("endpoint") as HTMLInputElement).value.trim();
  let code = ($("code") as HTMLInputElement).value.trim();
  try {
    const url = new URL(endpoint);
    if (
      !["http:", "https:"].includes(url.protocol) ||
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
    if (create) code = await network.create();
    if (!/^[a-f0-9]{32}$/.test(code))
      throw new Error("招待コードは32文字の英数字です");
    netFatal = false;
    network.connect(code);
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
  const link = `${location.origin}${location.pathname}#${network?.code ?? ""}`;
  ui.innerHTML = `<section class="panel lobby"><div class="eyebrow">SQUAD / ${members.filter((p) => p.connected).length} OF 4</div><h1>部隊を編成</h1><p>出撃前のロビーから参加できます。進行中への新規参加はできません。</p><label>招待URL <input id="invite" readonly value="${esc(link)}"></label><button id="copy">招待URLをコピー</button><p class="status">${esc(status)}</p><div class="members">${members.map((m, i) => `<div><b>0${i + 1} ${m.id === network?.id ? "あなた" : "隊員"}</b><span>${m.connected ? (m.ready ? "準備完了" : "装備待ち") : "切断中"}</span></div>`).join("")}</div><button class="primary" id="begin" ${!network?.id || members.filter((m) => m.connected)[0]?.id !== network.id || members.some((m) => m.connected && !m.ready) ? "disabled" : ""}>全員で出撃 ↗</button><button id="back">装備画面へ</button><p class="fine">ホストだけが出撃を開始できます。通信: 入力20Hz / 状態10Hz。</p></section>`;
  $("begin").onclick = () => {
    sound.unlock();
    network?.send({ type: "start" });
  };
  $("copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText(link);
      $("copy").textContent = "コピーしました";
    } catch {
      ($("invite") as HTMLInputElement).select();
    }
  };
  $("back").onclick = () => gear();
}
function battle() {
  setScreen("battle");
  ui.innerHTML = "";
  status = mode === "solo" ? "SOLO / LOCAL" : "CO-OP / SERVER";
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
  ui.innerHTML = `<section class="panel result"><div class="eyebrow">OPERATION 01 / DEBRIEF</div><h1>${w.phase === "victory" ? "MISSION CLEAR" : "MISSION FAILED"}</h1><p>${w.phase === "victory" ? "街区を奪還。新しい武器で、もう一度。" : esc(w.reason || "部隊が全員ダウンしました")}</p><div class="stats"><div><span>TIME</span><b>${Math.floor(w.time / 60)}:${String(Math.floor(w.time % 60)).padStart(2, "0")}</b></div><div><span>ELIMINATIONS</span><b>${w.totalKills}</b></div><div><span>RECOVERED</span><b>${items.length}</b></div></div><h2>${w.phase === "victory" ? "個別戦利品" : "未確定戦利品は失われました"}</h2><p class="status" role="status">${esc(w.phase === "victory" ? status : "保存済みの武器は保持されています。")}</p><div class="loot-grid">${items.map((w) => `<article class="weapon rarity${w.rarity}"><div class="eyebrow">${RARITIES[w.rarity]}</div><h3>${weaponName(w)}</h3><p>威力 ${Math.round(WEAPONS[w.kind].damage * w.power)} · ${EFFECTS[w.effect]}</p><small>${save.inventory.some((a) => a.id === w.id) ? "保存済み" : "未保存"}</small></article>`).join("")}</div><button class="primary" id="regear">装備変更・再出撃 ↗</button><button id="retry-save">保存を再試行</button>${overflow.length ? "<p>所持上限: 装備画面で整理後、この結果を再度保存できます。</p>" : ""}</section>`;
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
          const n = Math.max(1, Math.hypot(input.mx, input.mz));
          move(
            predicted,
            ((input.mx * Math.cos(input.yaw) + input.mz * Math.sin(input.yaw)) /
              n) *
              0.35,
            ((input.mx * Math.sin(input.yaw) - input.mz * Math.cos(input.yaw)) /
              n) *
              0.35,
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
        const weapon = p.weapons[p.slot],
          boss = world.enemies.find((e) => e.kind === "boss");
        hud.innerHTML = `<div class="hud-top"><div class="mission-hud"><span>OPERATION 01 / 灰明の街区</span><b>${world.wave === 4 ? "クラウンを撃破せよ" : `WAVE 0${world.wave} / 03`}</b><small>${world.enemies.length} HOSTILES · ${Math.floor(world.time / 60)}:${String(Math.floor(world.time % 60)).padStart(2, "0")} · ${world.totalKills} KILLS</small></div><div class="squad-hud">${world.players.map((a) => `<div>${a.id === myId ? "YOU" : "ALLY"} <span>${!a.connected ? "切断" : a.hp <= 0 ? `DOWN ${Math.ceil(a.down)}s` : Math.ceil(a.hp)}</span></div>`).join("")}<small>${Math.round(view.fps)} FPS · ${esc(status)}</small><button id="retreat">作戦離脱</button></div></div>${boss ? `<div class="boss"><span>大型個体 / CROWN</span><div><i style="width:${(boss.hp / boss.maxHp) * 100}%"></i></div></div>` : ""}<div class="crosshair ${p.hurt > 0 ? "hurt" : ""}">+</div>${p.hurt > 0 ? '<div class="damage"></div>' : ""}${p.hp <= 0 ? `<div class="downed">DOWNED <small>${p.down > 0 ? "味方の蘇生を待っています" : "この作戦での蘇生期限が切れました"}</small><progress value="${p.revive}" max="2.5"></progress></div>` : ""}<div class="vitals"><span>INFANTRY / 01</span><b>${Math.ceil(p.hp)} <small>/ 160</small></b><div class="hp"><i style="width:${(p.hp / 160) * 100}%"></i></div><small>回避 ${p.evadeCd > 0 ? p.evadeCd.toFixed(1) + "s" : "READY"} · 未確定品 ${(world.pending[myId] ?? []).length}</small></div><div class="weapon-hud"><span>${weaponName(weapon)}</span><b>${p.reload > 0 ? "RELOADING" : p.ammo[p.slot]} <small>/ ${WEAPONS[weapon.kind].mag}</small></b><small>${EFFECTS[weapon.effect]} · ${p.slot + 1}/2</small></div>${world.enemies.length === 0 && world.wave < 4 && world.spawned > 0 ? '<div class="wave-note">周辺警戒 · 緑の戦利品を回収しよう</div>' : ""}<div class="pc-help">WASD 移動 · マウス 照準/射撃 · R 装填 · Q 切替 · SPACE 回避 · E 蘇生</div>`;
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
title();
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
      inventory: structuredClone(save.inventory),
      equipped: [...save.equipped],
    }),
  });
