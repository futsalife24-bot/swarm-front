import { WAVE_INTERVAL, stats } from "../shared/defs";
import { visible, type Player, type World } from "../shared/game";
// Mirrors the authoritative revive rule in src/shared/game.ts (range and hold time).
const REVIVE_RANGE = 3.5,
  REVIVE_TIME = 2.5;
export type Rescue =
  | { state: "none" }
  | { state: "far"; distance: number }
  | { state: "blocked" }
  | { state: "ready"; progress: number };
// What the rescuer needs to know: who is being revived and which condition is missing.
export function rescue(w: World, id: string): Rescue {
  const self = w.players.find((p) => p.id === id);
  if (!self || self.hp <= 0) return { state: "none" };
  const downed = w.players.filter(
    (p) => p.id !== id && p.connected && p.hp <= 0 && p.down > 0,
  );
  if (!downed.length) return { state: "none" };
  // Prefer a target the server would actually accept over the merely closest one.
  const rank = (p: Player) => {
    const d = Math.hypot(p.x - self.x, p.z - self.z);
    return (d >= REVIVE_RANGE ? 2 : visible(self, p) ? 0 : 1) * 1e4 + d;
  };
  const target = downed.reduce((a, b) => (rank(a) <= rank(b) ? a : b));
  const distance = Math.hypot(target.x - self.x, target.z - self.z);
  if (distance >= REVIVE_RANGE) return { state: "far", distance };
  if (!visible(self, target)) return { state: "blocked" };
  return { state: "ready", progress: target.revive / REVIVE_TIME };
}
const RESCUE_NOTE: Record<Rescue["state"], string> = {
  none: "対象なし",
  far: "近づく",
  blocked: "遮蔽物",
  ready: "長押し",
};
function updateRevive(w: World, id: string) {
  const r = rescue(w, id),
    b = document.getElementById("revive")!,
    ratio = r.state === "ready" ? Math.max(0, Math.min(1, r.progress)) : 0,
    note =
      r.state === "far"
        ? r.distance.toFixed(1) + "m"
        : ratio > 0
          ? (ratio * REVIVE_TIME).toFixed(1) + "s"
          : RESCUE_NOTE[r.state];
  b.style.setProperty("--remaining", String(ratio));
  b.classList.toggle("cooling", ratio > 0);
  b.classList.toggle("idle", r.state === "none");
  b.dataset.remaining = String(ratio);
  b.dataset.rescue = r.state;
  b.setAttribute("aria-label", "蘇生 · " + RESCUE_NOTE[r.state]);
  b.innerHTML = "<span>蘇生</span><small>" + note + "</small>";
}
export function updateCooldowns(w: World, id: string) {
  const p = w.players.find((x) => x.id === id)!;
  const duration = stats(p.weapons[p.slot]).reload;
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
  updateRevive(w, id);
}
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
// The rescuer saw nothing at all before this: no progress, no reason for failure.
function rescueMarkup(w: World, id: string) {
  const r = rescue(w, id);
  if (r.state === "none") return "";
  const detail =
    r.state === "far"
      ? "あと " + (r.distance - REVIVE_RANGE).toFixed(1) + "m 近づく"
      : r.state === "blocked"
        ? "遮蔽物があります。回り込んでください"
        : "蘇生を長押し";
  return (
    '<div class="rescue" data-rescue="' +
    r.state +
    '">味方がダウン<small>' +
    detail +
    "</small>" +
    (r.state === "ready"
      ? '<progress value="' + r.progress + '" max="1"></progress>'
      : "") +
    "</div>"
  );
}
export function hudMarkup(w: World, id: string, status: string) {
  const p = w.players.find((p) => p.id === id)!;
  const def = stats(p.weapons[p.slot]),
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
    // The pause control lives outside this markup: everything here is replaced
    // ten times a second, which drops taps that land mid-rewrite.
    "</b></div><small>" +
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
        (p.down > 0 ? "味方の蘇生を待っています" : "部隊の戦闘を観戦中") +
        '</small><progress value="' +
        p.revive +
        '" max="2.5"></progress></div>'
      : rescueMarkup(w, id)) +
    '<div class="pc-help">WASD 移動 · マウス 照準/射撃 · R 装填 · Q 切替 · SPACE 回避 · E 蘇生</div>'
  );
}
