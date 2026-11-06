/**
 * 進撃（playtest-app.ts）の停止メニュー・ダウン画面・pauseボタンの表示専用HTML。
 * 戦闘・保存・通信・抽選は持たない。ボタンは既存id（pt-resume / pt-pause-layout /
 * pt-retire / pt-defeat / pt-ad-note）を保ち、処理は呼び出し側の既存コールバックが接続する。
 * 表示文字は全てescapeし、undefined / NaN / Infinity を出さない。
 */

export interface AdvanceBuddyMarkupView {
  status: "present" | "none" | "unavailable";
  name?: string;
  level?: number | null;
  elementLabel?: string;
  skillName?: string;
  skillText?: string;
  cooldown?: number;
  remaining?: number | null;
  activeRemaining?: number | null;
  unavailable?: string | null;
}
export interface AdvanceDownStats {
  stageLabel: string;
  elapsed: string;
  kills: number | null;
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
/** 文字列で、空白だけでないものだけを表示に使う。 */
const text = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;
/** 有限の数だけを表示に使う（null / undefined / NaN / Infinity は無い扱い）。 */
const finite = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const seconds = (v: number) => `${Math.max(0, Math.ceil(v))}秒`;

/** 属性名は本人指定の4種。色だけでなく字形と文字でも示す。 */
const ELEMENTS: Record<string, { key: string; glyph: string }> = {
  火炎: {
    key: "fire",
    glyph:
      '<path d="M12 3c1 3.2 4.6 5 4.6 9.4A4.6 4.6 0 0 1 7.4 12.4c0-2 .9-3.3 2.1-4.3-.1 1.7.6 2.9 1.7 3.4C11 8.4 11.3 5.6 12 3z"/>',
  },
  風: {
    key: "wind",
    glyph: '<path d="M3 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h7"/>',
  },
  氷結: {
    key: "ice",
    glyph:
      '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 4l3 3 3-3M9 20l3-3 3 3"/>',
  },
  電撃: {
    key: "lightning",
    glyph: '<path d="M13 2L5 13.5h6L10 22l9-12h-6z"/>',
  },
};
const elementOf = (label: string | null) =>
  (label && ELEMENTS[label]) || {
    key: "none",
    glyph: '<circle cx="12" cy="12" r="5"/>',
  };
const glyph = (paths: string) =>
  `<svg class="ap-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;

/**
 * 同行バディの情報。status=none（同行していない）と unavailable（情報を読めない）を
 * 文言で区別する。停止中に使えないことと、再使用待ちの残り秒は別の行で示す。
 */
export function advanceBuddyMarkup(
  buddy: AdvanceBuddyMarkupView | null | undefined,
): string {
  const status = buddy?.status;
  if (status === "none")
    return `<section class="ap-buddy" data-status="none" aria-label="同行バディ"><p class="ap-buddy-kicker">同行バディ</p><p class="ap-buddy-empty"><strong>同行なし</strong><span>この出撃にはバディが同行していません。</span></p></section>`;
  if (status !== "present")
    return `<section class="ap-buddy" data-status="unavailable" aria-label="同行バディ"><p class="ap-buddy-kicker">同行バディ</p><p class="ap-buddy-empty"><strong>情報を表示できません</strong><span>同行の状態を読み取れませんでした。戦闘はそのまま再開できます。</span></p></section>`;

  const name = text(buddy!.name) ?? "同行バディ";
  const level = finite(buddy!.level);
  const elementLabel = text(buddy!.elementLabel);
  const element = elementOf(elementLabel);
  const skillName = text(buddy!.skillName);
  const skillText = text(buddy!.skillText);
  const cooldown = finite(buddy!.cooldown);
  const remaining = finite(buddy!.remaining);
  const active = finite(buddy!.activeRemaining);
  const blocked = text(buddy!.unavailable);

  // 再開後の状態（効果中 / 再使用まで / 使用可能）。停止中の操作不可は下の注記で別に示す。
  let state: { key: string; label: string; value: string } | null = null;
  if (active !== null && active > 0)
    state = { key: "active", label: "効果中", value: `残り${seconds(active)}` };
  else if (remaining !== null && remaining > 0)
    state = { key: "cooldown", label: "再使用まで", value: seconds(remaining) };
  else if (remaining !== null)
    state = blocked
      ? { key: "blocked", label: "今は使えません", value: blocked }
      : { key: "ready", label: "再開後に使用可能", value: "" };
  else if (blocked)
    state = { key: "blocked", label: "今は使えません", value: blocked };
  const meter =
    state?.key === "cooldown" && cooldown !== null && cooldown > 0
      ? `<span class="ap-meter" aria-hidden="true"><i style="--p:${Math.min(1, Math.max(0, 1 - remaining! / cooldown)).toFixed(3)}"></i></span>`
      : "";

  return `<section class="ap-buddy" data-status="present" data-element="${element.key}" aria-label="同行バディ ${esc(name)}"><div class="ap-buddy-head"><p class="ap-buddy-kicker">同行バディ</p><h3 class="ap-buddy-name">${esc(name)}</h3>${level !== null ? `<span class="ap-buddy-lv">Lv<b>${Math.floor(level)}</b></span>` : ""}${elementLabel ? `<span class="ap-element">${glyph(element.glyph)}${esc(elementLabel)}</span>` : ""}</div><div class="ap-skill"><p class="ap-skill-title"><span class="ap-skill-kicker">固有スキル</span><b>${skillName ? esc(skillName) : "スキル情報なし"}</b>${cooldown !== null && cooldown > 0 ? `<small>再使用 ${seconds(cooldown)}</small>` : ""}</p>${skillText ? `<p class="ap-skill-text">${esc(skillText)}</p>` : ""}${state ? `<p class="ap-skill-state" data-state="${state.key}"><span>${state.label}</span>${state.value ? `<b>${esc(state.value)}</b>` : ""}${meter}</p>` : ""}<p class="ap-skill-paused">停止中は時間が止まり、スキルは使えません。</p></div></section>`;
}

/**
 * 停止ダイアログ（既存 menuDialog「一時停止」）の本文。バディ情報と、既存の3操作を
 * まとめる。主操作は再開。出撃中の編成変更は置かない。
 */
export function advancePauseMarkup(
  buddy: AdvanceBuddyMarkupView | null | undefined,
): string {
  return `<div class="ap-pause">${advanceBuddyMarkup(buddy)}<nav class="ap-pause-actions" aria-label="停止メニューの操作"><button id="pt-resume" class="primary ap-resume">タップで再開</button><button id="pt-pause-layout">設定・操作</button><button id="pt-retire" class="ap-retire">リタイア</button></nav></div>`;
}

/**
 * ダウン画面の本文（既存 header('ダウン', body, false) の body）。まだ敗北確定前。
 * 状態・戦況・次の操作を近くに並べ、主操作は既存 pt-defeat。復活・再挑戦・報酬は置かない。
 * 戦況は渡された値だけ（無い値は「—」）。広告非表示の通常経路用で pt-ad-note を含む。
 */
export function advanceDownMarkup(
  stats: Partial<AdvanceDownStats> | null | undefined,
): string {
  const stage = text(stats?.stageLabel);
  const elapsed = text(stats?.elapsed);
  const kills = finite(stats?.kills);
  const cell = (label: string, value: string | null) =>
    `<div><dt>${label}</dt><dd${value === null ? ' class="is-missing"' : ""}>${value === null ? "—" : esc(value)}</dd></div>`;
  return `<div class="pt-intro ap-down"><div class="ap-down-state"><span class="ap-down-mark" aria-hidden="true"></span><div><p class="ap-down-kicker">戦闘不能</p><p class="ap-down-lead">まだ敗北は確定していません</p></div></div><dl class="ap-down-stats" aria-label="この出撃の戦況">${cell("作戦", stage)}${cell("経過", elapsed)}${cell("撃破", kills === null ? null : `${Math.max(0, Math.floor(kills))}体`)}</dl><div class="ap-down-next"><button id="pt-defeat" class="primary">敗北を確定</button><p class="ap-down-hint">押すと敗北として結果画面へ進みます。</p></div><p id="pt-ad-note"></p></div>`;
}

/** 共通pauseボタンの中身。既存 id="pause"・aria-label・操作接続・寸法はそのまま。 */
export const pauseButtonMarkup =
  '<span class="ap-pause-bars" aria-hidden="true"><i></i><i></i></span><span class="ap-pause-label" aria-hidden="true">停止</span>';
