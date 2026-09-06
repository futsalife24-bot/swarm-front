import { WEAPONS, WAVE_INTERVAL } from "../shared/defs";
import type { Player, World } from "../shared/game";
export function updateCooldowns(p: Player) {
  const duration =
    WEAPONS[p.weapons[p.slot].kind].reload *
    (p.weapons[p.slot].effect === "quick" ? 0.8 : 1);
  for (const [id, label, left, total] of [
    ["dodge", "回避", p.evadeCd, 2.2],
    ["reload", "装填", p.reload, duration],
  ] as const) {
    const b = document.getElementById(id)!;
    const remaining = Math.max(0, left),
      ratio = Math.max(0, Math.min(1, remaining / total));
    b.style.setProperty("--remaining", String(ratio));
    b.classList.toggle("cooling", remaining > 0);
    b.setAttribute(
      "aria-label",
      label +
        (remaining > 0 ? " 残り" + remaining.toFixed(1) + "秒" : " 準備完了"),
    );
    b.dataset.remaining = String(ratio);
    b.innerHTML =
      "<span>" +
      label +
      "</span><small>" +
      (remaining > 0 ? remaining.toFixed(1) + "s" : "READY") +
      "</small>";
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
export function hudMarkup(w: World, id: string, status: string) {
  const p = w.players.find((p) => p.id === id)!;
  const def = WEAPONS[p.weapons[p.slot].kind],
    boss = w.enemies.find((e) => e.kind === "boss");
  const next =
    w.waveClearAt != null
      ? "WAVE CLEAR · 次波 " +
        Math.max(0, Math.ceil(WAVE_INTERVAL - (w.time - w.waveClearAt))) +
        "秒"
      : w.enemies.length + " 体 · " + w.totalKills + " 撃破";
  return (
    '<div class="hud-rail"><div class="vitals"><div class="vital-number"><small>ARMOR</small><b>' +
    Math.ceil(p.hp) +
    '<small> / 160</small></b></div><div class="hp"><i style="width:' +
    (p.hp / 160) * 100 +
    '%"></i></div><div class="squad-strip">' +
    w.players
      .filter((a) => a.id !== id)
      .map(
        (a, i) =>
          "<span>味方" +
          (i + 1) +
          " " +
          (!a.connected ? "切断" : a.hp <= 0 ? "DOWN" : Math.ceil(a.hp)) +
          "</span>",
      )
      .join("") +
    '</div></div><div class="mission-hud"><div class="mission-line"><b>' +
    (boss ? "クラウンを撃破" : "WAVE " + w.wave + " / 3") +
    '</b><button id="retreat">作戦離脱</button></div><small>' +
    next +
    " · " +
    Math.floor(w.time / 60) +
    ":" +
    String(Math.floor(w.time % 60)).padStart(2, "0") +
    "</small>" +
    (boss
      ? '<div class="boss-meter"><i style="width:' +
        (boss.hp / boss.maxHp) * 100 +
        '%"></i></div>'
      : "") +
    '</div><div class="weapon-hud"><span>' +
    esc(def.name) +
    " · " +
    (p.slot + 1) +
    "/2</span><b>" +
    (p.reload > 0 ? p.reload.toFixed(1) + "s" : p.ammo[p.slot]) +
    " <small>/ " +
    def.mag +
    (p.reload > 0 ? " 装填中" : "") +
    "</small></b><small>未確定 " +
    (w.pending[id] ?? []).length +
    " · " +
    esc(status) +
    '</small></div></div><div class="crosshair ' +
    (p.hurt > 0 ? "hurt" : "") +
    '">+</div>' +
    (p.hurt > 0 ? '<div class="damage"></div>' : "") +
    (p.hp <= 0
      ? '<div class="downed">DOWNED<small>' +
        (p.down > 0 ? "味方の蘇生を待っています" : "蘇生期限が切れました") +
        '</small><progress value="' +
        p.revive +
        '" max="2.5"></progress></div>'
      : "") +
    '<div class="pc-help">WASD 移動 · マウス 照準/射撃 · R 装填 · Q 切替 · SPACE 回避 · E 蘇生</div>'
  );
}
