/** Separate entry: no save, bootstrap, network client, daily ledger or reward writer. */
import "../style.css";
import "../mobile-ui.css";
import "../menu-ui.css";
import "../menu-theme.css";
import "./rebuild.css";
import * as T from "three";
import { Renderer } from "./render";
import { Controls } from "./input";
import { Sound } from "./audio";
import { prepareBattle } from "./battle-loading";
import { defaultLayout, placeControls, updateScopeButtons } from "./layout";
import { updateCooldowns } from "./hud";
import { stats } from "../shared/defs";
import { eye, retireEvents } from "../shared/game";
import {
  createRebuildRun,
  chooseRebuildUpgrade,
  getRebuildRunView,
  rerollRebuildRunOffer,
  stepRebuildRun,
} from "../shared/rebuild-run";
import {
  REBUILD_UPGRADE_CATALOG,
  canRerollRebuildUpgrade,
  REBUILD_EXPLOSION_UPGRADES,
  REBUILD_UPGRADE_IDS,
  type RebuildUpgradeId,
} from "../shared/rebuild-upgrades";
import {
  createRebuildUiGate,
  acceptRebuildKeydown,
  formatRebuildTime,
  pauseRebuildUi,
  rebuildUiActive,
  resumeRebuildUi,
  tickRebuildUi,
} from "./rebuild-ui-state";
const $ = (id: string) => document.getElementById(id)!;
const controls = new Controls();
const sound = new Sound();
const layout = defaultLayout();
const gate = createRebuildUiGate();
let run = createRebuildRun({ runId: crypto.randomUUID() });
let view: Renderer;
let ready = false,
  loadingError = "",
  overlayKey = "",
  accumulator = 0,
  lastHud = "";
let actionLockUntil = 0,
  resumeTime = 0;
const esc = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const upgradeCopy: Record<RebuildUpgradeId, string> = {
  "blast-core": "射撃で撃破すると、周囲を爆破。",
  fuse: "命中で印を付け、次の命中で起爆。",
  "compressed-charge": "同じ敵に3回命中で爆破。重なる爆発は範囲拡大。",
  armor: "最大HP +5%。増えた分を回復。",
  reload: "装填時間 −5%。",
  magazine: "弾倉 +10%相当（切り上げ・最低1発）。",
};
function clearInput() {
  controls.enabled = false;
  controls.reset();
  accumulator = 0;
  previous = performance.now();
  if (document.pointerLockElement) document.exitPointerLock();
}
function pause(reason: string) {
  if (!ready || run.phase === "victory" || run.phase === "defeat") return;
  clearInput();
  pauseRebuildUi(gate, reason);
  paintOverlay();
}
function resume() {
  clearInput();
  resumeRebuildUi(gate, run.phase === "combat" || run.phase === "boss");
  paintOverlay();
}
function retry() {
  clearInput();
  run = createRebuildRun({ runId: crypto.randomUUID() });
  Object.assign(gate, createRebuildUiGate());
  lastHud = "";
  resumeTime = 0;
  $("rebuild-notice").hidden = true;
  noticeUntil = 0;
  actionLockUntil = performance.now() + 300;
  paintOverlay();
}
function buildSummary() {
  return (
    REBUILD_UPGRADE_IDS.filter((id) => run.upgrades.levels[id])
      .map(
        (id) =>
          `${REBUILD_UPGRADE_CATALOG[id].name}${REBUILD_UPGRADE_CATALOG[id].maxLevel > 1 ? ` ${run.upgrades.levels[id]}` : ""}`,
      )
      .join(" / ") || "未選択"
  );
}
function measurements() {
  const m = run.metrics,
    r = run.world.rebuild!,
    p = run.world.players[0];
  return `<details class="rebuild-measurements"><summary>試遊の計測値</summary><dl>
    <dt>兵士位置 X / Z</dt><dd data-testid="rebuild-position">${p.x.toFixed(3)} / ${p.z.toFixed(3)}</dd>
    <dt>戦闘 / 選択 / 再開予告</dt><dd>${formatRebuildTime(run.world.time)} / ${formatRebuildTime(m.selectionTime)} / ${resumeTime.toFixed(1)}秒</dd>
    <dt>進化 / 進化後戦闘</dt><dd>${m.evolutionAt === null ? "未進化" : formatRebuildTime(m.evolutionAt)} / ${formatRebuildTime(m.evolvedCombatTime)}</dd>
    <dt>初発動 / 手動命中</dt><dd>${m.firstEffectAt === null ? "未発動" : formatRebuildTime(m.firstEffectAt)} / ${r.manualHits}</dd>
    <dt>撃破 / 二次撃破 / 最大連鎖</dt><dd>${m.kills} / ${r.secondaryKills} / ${r.maxChain}</dd>
    <dt>取得 / XP / 6権利までの不足</dt><dd>${run.upgrades.picks} / ${r.xp} / ${m.xpShortfall}</dd>
    <dt>最大生存敵 / 処理予算到達</dt><dd>${m.maxEnemies} / ${r.effectBudgetExhaustions}</dd>
    <dt>XP閾値到達（戦闘時刻）</dt><dd>${m.thresholdReachedAt.map((t) => (t === null ? "—" : formatRebuildTime(t))).join(" / ")}</dd>
    <dt>強化選択（戦闘時刻）</dt><dd>${m.selectedAt.map((p) => `${REBUILD_UPGRADE_CATALOG[p.cardId].name} ${formatRebuildTime(p.combatTime)}`).join(" / ") || "—"}</dd>
  </dl></details>`;
}
function paintOverlay() {
  const offer = run.upgrades.offer;
  const key = [
    ready,
    loadingError,
    gate.paused,
    gate.pauseReason,
    gate.resumeRemaining > 0,
    run.phase,
    offer?.id,
    run.upgrades.revision,
  ].join(":");
  if (key === overlayKey) return;
  overlayKey = key;
  const ui = $("ui");
  ui.dataset.phase = run.phase;
  $("pause").hidden =
    !ready || run.phase === "victory" || run.phase === "defeat" || gate.paused;
  if (loadingError) {
    ui.innerHTML = `<section class="pause-card rebuild-panel"><h1>読み込みを完了できませんでした</h1><p>${esc(loadingError)}</p><button id="rebuild-reload" class="primary">読み込みを再試行</button></section>`;
    $("rebuild-reload").onclick = () => location.reload();
  } else if (!ready) {
    ui.innerHTML =
      '<section class="pause-card rebuild-panel"><div class="eyebrow">SWARM FRONT · P1a</div><h1>戦場を準備中</h1><p>既存の兵士・武器・地形を読み込んでいます。戦闘は始まりません。</p><output id="rebuild-loading">0%</output></section>';
  } else if (gate.paused) {
    ui.innerHTML = `<section class="pause-card rebuild-panel"><header><h1>一時停止</h1><button id="rebuild-resume" class="primary">再開</button></header><p>${esc(gate.pauseReason)} · 敵・弾・時計・クールダウンは停止中</p><p>構成: ${buildSummary()}</p><p class="rebuild-help">WASD: 移動 / 左クリック: 射撃 / 右ドラッグ: 照準 / R: 装填 / Q: 切替 / Space: 回避 / F: ジャンプ / Z: スコープ</p>${measurements()}<footer><span>この試作は保存・報酬なし</span><button id="rebuild-retry">最初から試す</button></footer></section>`;
    $("rebuild-resume").onclick = resume;
    $("rebuild-retry").onclick = retry;
  } else if (gate.resumeRemaining > 0) {
    ui.innerHTML =
      '<div class="rebuild-resume-cue" role="status">まもなく再開<br><small>射撃・移動入力をリセットしました</small></div>';
  } else if (run.phase === "selection" && offer) {
    const family = REBUILD_EXPLOSION_UPGRADES.filter(
      (id) => run.upgrades.levels[id],
    ).length;
    ui.innerHTML = `<section class="pause-card rebuild-panel rebuild-selection" aria-labelledby="rebuild-selection-title"><header><h1 id="rebuild-selection-title">${offer.kind === "initial" ? "最初の強化を選択" : "補給 · 強化を選択"}</h1><div class="rebuild-selection-actions"><span class="rebuild-evolution">${run.upgrades.evolved ? "連鎖崩落" : `爆発 ${family}/3`}</span><span class="rebuild-pick-count">${run.upgrades.picks}/7</span>${offer.kind === "additional" ? `<button id="rebuild-reroll" ${!canRerollRebuildUpgrade(run.upgrades) ? "disabled" : ""}>再抽選 残り${run.upgrades.rerollsRemaining}</button>` : ""}</div></header>
    <div class="rebuild-cards">${offer.cardIds
      .map((id) => {
        const def = REBUILD_UPGRADE_CATALOG[id];
        return `<button class="rebuild-card" data-card="${id}" data-testid="rebuild-card-${id}" aria-label="${def.name}: ${esc(def.description)}"><img class="rebuild-card-icon" src="${import.meta.env.BASE_URL}rebuild/upgrades/${id}.png" alt="" width="96" height="96" draggable="false"><span class="rebuild-card-kind">${def.family === "explosion" ? "爆発" : `強化 ${run.upgrades.levels[id] + 1}/4`}</span><strong>${def.name}</strong><span class="rebuild-card-description">${upgradeCopy[id]}</span></button>`;
      })
      .join("")}</div>
    </section>`;
    ui.querySelectorAll<HTMLButtonElement>("[data-card]").forEach((button) => {
      const displayedOffer = offer.id;
      button.onclick = () => {
        if (
          performance.now() < actionLockUntil ||
          run.upgrades.offer?.id !== displayedOffer ||
          gate.paused
        )
          return;
        const wasEvolved = run.upgrades.evolved;
        clearInput();
        if (!chooseRebuildUpgrade(run, button.dataset.card as RebuildUpgradeId))
          return;
        sound.unlock();
        sound.play("menu");
        actionLockUntil = performance.now() + 300;
        if (!wasEvolved && run.upgrades.evolved) {
          sound.play("ready");
          notice("自動進化 · 連鎖崩落！ 印のついた敵から狙おう", 4);
        }
        if (run.phase !== "selection") resumeRebuildUi(gate, true);
        paintOverlay();
      };
    });
    const rerollButton = document.getElementById("rebuild-reroll");
    if (rerollButton)
      rerollButton.onclick = () => {
        if (performance.now() < actionLockUntil) return;
        if (rerollRebuildRunOffer(run)) {
          actionLockUntil = performance.now() + 300;
          paintOverlay();
        } else notice("新しい候補組がありません · 回数は消費しません", 3);
      };
  } else if (run.phase === "victory" || run.phase === "defeat") {
    ui.innerHTML = `<section class="pause-card rebuild-panel"><header><div><div class="eyebrow">SWARM FRONT · P1a</div><h1>${run.phase === "victory" ? "大型撃破" : "任務終了"}</h1></div><button id="rebuild-retry" class="primary">もう一度試す</button></header><p>${run.status}</p><div class="rebuild-result"><b>戦闘 ${formatRebuildTime(run.world.time)}</b><b>最大 ${run.world.rebuild!.maxChain}連鎖</b><b>${run.upgrades.evolved ? "連鎖崩落に進化" : "未進化"}</b></div><p>構成: ${buildSummary()}</p><p>報酬なし · 既存武器・セーブへの変更なし</p>${measurements()}<p class="rebuild-help">狙う最初の敵を変える理由があったか、1分で強化の違いが分かったかを試してください</p></section>`;
    $("rebuild-retry").onclick = retry;
  } else ui.replaceChildren();
}
let noticeUntil = 0;
function notice(message: string, seconds: number) {
  $("rebuild-notice").textContent = message;
  $("rebuild-notice").hidden = false;
  noticeUntil = performance.now() + seconds * 1000;
}
function paintHud() {
  const p = run.world.players[0],
    v = getRebuildRunView(run),
    r = run.world.rebuild!;
  const html = `<div class="rebuild-hud-rail"><div><b data-testid="rebuild-hp">HP ${Math.ceil(p.hp)} / ${Math.ceil(v.maxHp)}</b><span data-testid="rebuild-ammo">AR ${p.slot + 1} · ${p.ammo[p.slot]} / ${stats(p.weapons[p.slot]).mag}${p.reload > 0 ? " 装填中" : ""}</span></div><div><b data-testid="rebuild-time">${formatRebuildTime(v.combatTime)}</b><span>${v.status}</span></div><div><b data-testid="rebuild-xp">XP ${v.xp}${v.nextXpThreshold === null ? " · 最終確定" : ` / ${v.nextXpThreshold}`}</b><span>取得 ${v.picks}/7 · ${v.evolved ? "連鎖崩落" : `爆発 ${REBUILD_EXPLOSION_UPGRADES.filter((id) => r.levels[id]).length}/3`} · 最大${v.maxChain}連鎖</span></div></div><div class="crosshair">+</div>${v.bossHp !== null ? `<div class="rebuild-boss">大型 ${Math.max(0, Math.ceil(v.bossHp))} / ${v.bossMaxHp}<progress max="${v.bossMaxHp}" value="${v.bossHp}"></progress></div>` : ""}${v.lastChainAt !== null && run.world.time - v.lastChainAt < 1.5 ? `<div class="rebuild-chain">手動射撃起点 · ${v.lastChain}連鎖</div>` : ""}`;
  if (lastHud !== html) {
    $("hud").innerHTML = html;
    lastHud = html;
  }
}
// Renderer-only pooled markers; damage and XP are never decided by these meshes.
const markGeometry = new T.TorusGeometry(0.62, 0.1, 4, 12);
const orbGeometry = new T.OctahedronGeometry(0.3);
const marks = new T.InstancedMesh(
  markGeometry,
  new T.MeshBasicMaterial({ color: 0xffcb69, depthTest: true }),
  40,
);
const orbs = new T.InstancedMesh(
  orbGeometry,
  new T.MeshBasicMaterial({ color: 0x98ebc8 }),
  160,
);
const marker = new T.Object3D();
marks.frustumCulled = orbs.frustumCulled = false;
function paintMarkers() {
  let count = 0;
  for (const e of run.world.enemies)
    if (
      e.hp > 0 &&
      run.world.rebuild!.enemyStatus[e.id]?.marked &&
      count < 40
    ) {
      marker.position.set(e.x, eye(e) + 0.8, e.z);
      marker.quaternion.copy(view.camera.quaternion);
      marker.updateMatrix();
      marks.setMatrixAt(count++, marker.matrix);
    }
  marks.count = count;
  marks.instanceMatrix.needsUpdate = true;
  count = 0;
  marker.rotation.set(0, 0, 0);
  for (const orb of run.world.rebuild!.xpOrbs) {
    marker.position.set(orb.x, orb.y + 0.45, orb.z);
    marker.updateMatrix();
    orbs.setMatrixAt(count++, marker.matrix);
  }
  orbs.count = count;
  orbs.instanceMatrix.needsUpdate = true;
}
// Capture before Controls' bubbling listener. Reset/selection may clear held
// keys, but an OS-generated repeat must not resurrect movement after resume.
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
$("pause").onclick = () => pause("手動で停止しました");
window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    e.preventDefault();
    if (!gate.paused) pause("手動で停止しました");
  }
});
window.addEventListener("blur", () => pause("画面から離れたため停止しました"));
window.addEventListener("pagehide", () =>
  pause("画面から離れたため停止しました"),
);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause("画面が非表示のため停止しました");
});
window.addEventListener("resize", () => {
  placeControls(layout);
});
placeControls(layout);
paintOverlay();
async function initialize() {
  try {
    view = new Renderer($("world") as HTMLCanvasElement, 40);
    view.scene.add(marks, orbs);
    await prepareBattle(
      view,
      run.world,
      run.world.players[0].id,
      () => false,
      (n) => {
        $("rebuild-loading").textContent = `${n}%`;
      },
    );
    ready = true;
    previous = performance.now();
    paintOverlay();
    requestAnimationFrame(frame);
  } catch (error) {
    loadingError = error instanceof Error ? error.message : String(error);
    paintOverlay();
  }
}
let previous = performance.now(),
  firstEffectSeen = false;
function frame(now: number) {
  requestAnimationFrame(frame);
  const wallDt = Math.max(0, (now - previous) / 1000);
  const dt = Math.min(0.1, wallDt);
  previous = now;
  const countingDown = gate.resumeRemaining > 0;
  if (!document.hidden && !gate.paused) {
    resumeTime += Math.min(wallDt, gate.resumeRemaining);
    if (tickRebuildUi(gate, wallDt)) clearInput();
  }
  let active =
    rebuildUiActive(gate, run.phase, document.hidden) && !countingDown;
  controls.enabled = active;
  controls.setScopeAvailable(active);
  if (active) {
    accumulator += dt;
    while (accumulator >= 0.05 && rebuildUiActive(gate, run.phase)) {
      const before = run.phase;
      stepRebuildRun(run, controls.read());
      accumulator -= 0.05;
      if (run.phase !== before) {
        clearInput();
        active = false;
      }
    }
  } else {
    accumulator = 0;
    if (
      !gate.paused &&
      !document.hidden &&
      !countingDown &&
      run.phase === "selection"
    )
      stepRebuildRun(run, undefined, wallDt);
  }
  if (!firstEffectSeen && run.world.rebuild!.firstEffectAt !== null) {
    firstEffectSeen = true;
    notice("初発動！ 手動射撃から爆発", 2);
  }
  if (run.world.rebuild!.firstEffectAt === null) firstEffectSeen = false;
  $("controls").hidden = !active;
  $("scope-overlay").hidden = !controls.scoped;
  updateScopeButtons(layout, {
    visible: active,
    available: controls.scopeAvailable,
    scoped: controls.scoped,
  });
  if (now > noticeUntil) $("rebuild-notice").hidden = true;
  paintOverlay();
  paintHud();
  paintMarkers();
  const id = run.world.players[0].id;
  updateCooldowns(run.world, id, true);
  sound.update(run.world, id, controls.input.yaw, active);
  view.render(
    run.world,
    id,
    dt,
    controls.input.yaw,
    controls.input.pitch,
    undefined,
    active,
    controls.scoped,
    controls.aiming,
  );
  retireEvents(
    run.world,
    Math.min(view.consumed(run.world.run), sound.consumed(run.world.run)),
  );
}
void initialize();
