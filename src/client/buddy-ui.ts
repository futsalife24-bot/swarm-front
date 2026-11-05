/**
 * バディUI（初回選択・編成・招集・育成/突破・戦闘HUDの固有スキル）。
 *
 * 表示と操作だけを受け持つ。抽選・育成数値・保存・同期は持たず、主担当の実データを
 * BuddyUiState で受け取り、操作は BuddyUiActions のコールバックへ渡す。
 * 数値（上限・突破素材・確率・保証回数・報酬）はすべて受け取った値を表示する。
 * 接続手順は design/buddy-ui/HANDOFF.md。
 */
import "./buddy-ui.css";

export type BuddyElement = "fire" | "wind" | "ice" | "lightning";

/** 図鑑の1体。名前・役割・スキル文は主担当の定義から渡す。 */
export interface BuddyCatalogItem {
  id: string;
  name: string;
  element: BuddyElement;
  /** 例：火炎 */
  elementLabel: string;
  /** 例：範囲攻撃 */
  role: string;
  skillName: string;
  /** 効果の短い説明。数値は呼出側の定義から作る。 */
  skillText: string;
  /** 固有スキルの再使用秒 */
  cooldown: number;
  /** 立ち絵。無い・読めない場合は属性の紋章を表示する。 */
  portrait?: string | null;
}

export interface BuddyGrowthView {
  level: number;
  levelCap: number;
  /** 現在レベル内の経験値と、次レベルまでの必要量。上限到達時は xpForNext=null。 */
  xpIntoLevel: number;
  xpForNext: number | null;
  breakthrough: number;
  breakthroughMax: number;
  /** 突破後のレベル上限。最大突破なら null。 */
  nextLevelCap: number | null;
  /** 次の突破に必要な突破素材。最大突破なら null。 */
  breakthroughCost: number | null;
}

export interface BuddyRecruitView {
  /** 1回の招集に使うチケット枚数 */
  ticketCost: number;
  /** 各バディの出現率（%）。呼出側の抽選規則から作る。空なら招集できない。 */
  odds: { id: string; percent: number }[];
  /** 未所持がいる間の連続被り数と、保証が発動する回数 */
  pityCount: number;
  pityThreshold: number;
  /** 次の1回が未所持からの保証になる */
  guaranteedNext: boolean;
  /** 被り1回で得る突破素材 */
  duplicateFragments: number;
  /** ステージ初回突破で得るチケット */
  firstClearTickets: number;
  /** 反復クリアの積算（現在値と、チケット1枚になる値） */
  repeatUnits: number;
  repeatUnitsPerTicket: number;
  /** 未決の設定の注記。画面では「調整中」と分かる形で出す。 */
  provisional?: string[];
}

export interface BuddyUiState {
  catalog: BuddyCatalogItem[];
  owned: Record<string, BuddyGrowthView | undefined>;
  selected: string | null;
  starterChosen: boolean;
  tickets: number;
  fragments: number;
  recruit: BuddyRecruitView;
  /** 変更できない理由（出撃中など）。あれば同行変更・招集・突破を止める。 */
  locked?: string | null;
}

export interface BuddyDrawOutcome {
  buddyId: string;
  duplicate: boolean;
  guaranteed: boolean;
  /** 被りで得た突破素材 */
  fragmentsGained: number;
}

/** 既存の Sound.play のキー。音量・無音は Sound 側の設定に従う。 */
export type BuddySoundCue = "menu" | "equip" | "unequip" | "warning" | "ready";

type Maybe<T> = T | Promise<T>;
export interface BuddyUiActions {
  chooseStarter(id: string): Maybe<BuddyUiState>;
  equip(id: string | null): Maybe<BuddyUiState>;
  /** 保存失敗で投げた場合、UIは同じ requestId で再試行する。 */
  draw(
    requestId: string,
  ): Maybe<{ state: BuddyUiState; outcome: BuddyDrawOutcome }>;
  breakthrough(id: string): Maybe<BuddyUiState>;
  requestId(): string;
  sound?(cue: BuddySoundCue): void;
}

export type BuddyTab = "roster" | "recruit";
export interface BuddyMenu {
  readonly root: HTMLElement;
  update(state: BuddyUiState): void;
  destroy(): void;
}

const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const num = (n: number) =>
  Number.isFinite(n) ? Math.max(0, Math.trunc(n)).toLocaleString("ja-JP") : "—";

/** 属性の紋章（色に頼らず形でも区別する）。 */
const GLYPH: Record<BuddyElement, string> = {
  fire: '<path d="M16 3c1 5 6 7 6 13a6 6 0 0 1-12 0c0-3 2-5 3-7 0 3 1 4 3 5-1-4 0-8 0-11Z"/>',
  wind: '<path d="M4 11h15a4 4 0 1 0-4-4M4 17h21a4 4 0 1 1-4 4M4 23h10"/>',
  ice: '<path d="M16 3v26M5 9.5l22 13M27 9.5l-22 13M12 5l4 3 4-3M12 27l4-3 4 3"/>',
  lightning: '<path d="M18 3 7 18h8l-2 11 12-16h-8Z"/>',
};
export const buddyGlyph = (element: BuddyElement, cls = "bd-glyph") =>
  `<svg class="${cls}" viewBox="0 0 32 32" aria-hidden="true" focusable="false">${GLYPH[element] ?? GLYPH.fire}</svg>`;

const ICON = {
  ticket:
    '<path d="M4 9h24v4a3 3 0 0 0 0 6v4H4v-4a3 3 0 0 0 0-6Z"/><path d="M12 9v14" stroke-dasharray="2 2"/>',
  fragment:
    '<path d="m16 3 9 7-3 15-6 4-6-4-3-15Z"/><path d="m7 10 9 4 9-4M16 14v15"/>',
};
function resource(
  kind: "ticket" | "fragment",
  amount: number,
  purpose?: "cost" | "gain",
) {
  const name = kind === "ticket" ? "招集チケット" : "突破素材";
  const sign = purpose === "cost" ? "−" : purpose === "gain" ? "+" : "";
  const label = `${name} ${purpose === "cost" ? "消費" : purpose === "gain" ? "獲得" : "所持"} ${num(amount)}`;
  // 既存の resource-frame の見た目に揃える（クラスを共用、アイコンだけバディ用）。
  return `<span class="resource-frame bd-res bd-res-${kind}" data-purpose="${purpose ?? "owned"}" role="img" aria-label="${label}" title="${label}"><svg class="resource-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false">${ICON[kind]}</svg><strong class="resource-amount">${sign}${num(amount)}</strong></span>`;
}

function portrait(item: BuddyCatalogItem | undefined, size: "s" | "m" | "l") {
  if (!item)
    return `<span class="bd-portrait bd-portrait-${size} is-missing" data-element="none"><span class="bd-missing-mark" aria-hidden="true">?</span></span>`;
  const img = item.portrait
    ? `<img src="${esc(item.portrait)}" alt="" decoding="async" draggable="false">`
    : "";
  return `<span class="bd-portrait bd-portrait-${size}${img ? "" : " is-fallback"}" data-element="${esc(item.element)}">${buddyGlyph(item.element, "bd-portrait-glyph")}${img}</span>`;
}
const elementChip = (item: BuddyCatalogItem) =>
  `<span class="bd-element" data-element="${esc(item.element)}">${buddyGlyph(item.element)}${esc(item.elementLabel)}</span>`;

function pips(done: number, max: number, label: string) {
  return `<span class="bd-pips" role="img" aria-label="${esc(label)}">${Array.from({ length: max }, (_, i) => `<i class="${i < done ? "is-on" : ""}"></i>`).join("")}</span>`;
}

function xpBar(g: BuddyGrowthView) {
  const ratio =
    g.xpForNext === null || g.xpForNext <= 0
      ? 1
      : Math.max(0, Math.min(1, g.xpIntoLevel / g.xpForNext));
  const text =
    g.xpForNext === null
      ? g.level >= g.levelCap
        ? "レベル上限"
        : "—"
      : `次まで ${num(g.xpForNext - g.xpIntoLevel)}`;
  return `<span class="bd-xp" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(ratio * 100)}" aria-label="経験値 ${text}"><i style="--r:${ratio.toFixed(3)}"></i></span><small class="bd-xp-text">${esc(text)}</small>`;
}

type Busy =
  | null
  | { kind: "starter" | "equip" | "breakthrough"; id: string | null }
  | { kind: "draw"; requestId: string };
type Failure = {
  kind: "starter" | "equip" | "breakthrough" | "draw";
  message: string;
  retry: () => void;
};

export function mountBuddyMenu(
  host: HTMLElement,
  initial: BuddyUiState,
  actions: BuddyUiActions,
  options: { tab?: BuddyTab; focus?: string } = {},
): BuddyMenu {
  let state = initial;
  let tab: BuddyTab = options.tab ?? "roster";
  let focus: string | null =
    options.focus ?? state.selected ?? state.catalog[0]?.id ?? null;
  let starterPick: string | null = null;
  let busy: Busy = null;
  let failure: Failure | null = null;
  let result: BuddyDrawOutcome | null = null;
  let toast: string | null = null;
  /** 保存に失敗した招集の要求ID。再試行は必ずこのIDで行う。 */
  let pendingDraw: string | null = null;
  let destroyed = false;

  const root = document.createElement("div");
  root.className = "bd-root";
  host.append(root);

  const item = (id: string | null | undefined) =>
    state.catalog.find((c) => c.id === id);
  const cue = (c: BuddySoundCue) => {
    try {
      actions.sound?.(c);
    } catch {
      /* 音の失敗で操作を止めない */
    }
  };

  async function run<T>(
    b: NonNullable<Busy>,
    kind: Failure["kind"],
    call: () => Maybe<T>,
    done: (value: T) => void,
    retry: () => void,
  ) {
    if (busy || destroyed) return;
    busy = b;
    failure = null;
    toast = null;
    paint();
    try {
      const value = await call();
      if (destroyed) return;
      busy = null;
      done(value);
    } catch (e) {
      if (destroyed) return;
      busy = null;
      failure = {
        kind,
        message: e instanceof Error ? e.message : String(e),
        retry,
      };
      cue("warning");
    }
    paint();
  }

  const chooseStarter = (id: string) =>
    run(
      { kind: "starter", id },
      "starter",
      () => actions.chooseStarter(id),
      (s) => {
        state = s;
        focus = id;
        tab = "roster";
        toast = `${item(id)?.name ?? "バディ"}が同行します`;
        cue("equip");
      },
      () => chooseStarter(id),
    );
  const equip = (id: string | null) =>
    run(
      { kind: "equip", id },
      "equip",
      () => actions.equip(id),
      (s) => {
        state = s;
        toast = id
          ? `${item(id)?.name ?? "バディ"}が同行します`
          : "同行を外しました";
        cue(id ? "equip" : "unequip");
      },
      () => equip(id),
    );
  const breakthrough = (id: string) => {
    const before = state.owned[id];
    return run(
      { kind: "breakthrough", id },
      "breakthrough",
      () => actions.breakthrough(id),
      (s) => {
        state = s;
        const after = s.owned[id];
        toast =
          before && after
            ? `限界突破 Lv上限 ${before.levelCap} → ${after.levelCap}`
            : "限界突破しました";
        cue("equip");
      },
      () => breakthrough(id),
    );
  };
  const draw = () => {
    const requestId = pendingDraw ?? actions.requestId();
    pendingDraw = requestId;
    return run(
      { kind: "draw", requestId },
      "draw",
      () => actions.draw(requestId),
      ({ state: s, outcome }) => {
        state = s;
        pendingDraw = null;
        result = outcome;
        focus = outcome.buddyId;
        cue("equip");
      },
      () => draw(),
    );
  };

  /* ---------- 画面 ---------- */
  function lockedNote() {
    return state.locked
      ? `<p class="bd-locked" role="note">${esc(state.locked)}</p>`
      : "";
  }
  function failureBox() {
    if (!failure) return "";
    const what = {
      starter: "初回のバディを保存できませんでした。",
      equip: "同行の変更を保存できませんでした。",
      breakthrough: "限界突破を保存できませんでした。",
      draw: "招集の結果を保存できませんでした。チケットはまだ使われていません。再試行すると同じ招集として保存します。",
    }[failure.kind];
    return `<div class="bd-failure" role="alert"><p><strong>${what}</strong><small>${esc(failure.message)}</small></p><div><button type="button" data-bd="retry" class="primary">再試行</button><button type="button" data-bd="dismiss">閉じる</button></div></div>`;
  }
  function toastBox() {
    return toast
      ? `<p class="bd-toast" role="status">${esc(toast)}</p>`
      : `<p class="bd-toast" role="status" hidden></p>`;
  }

  function starterView() {
    const pick = item(starterPick);
    return `<section class="bd-starter" aria-labelledby="bd-starter-title">
      <header class="bd-starter-head"><div><h2 id="bd-starter-title">最初のバディを1体選ぶ</h2><p>進撃に1体同行し、自動で攻撃します。固有スキルはボタンで使えます。ほかの3体は招集で仲間にできます。</p></div><div class="bd-starter-confirm"><p aria-live="polite">${pick ? `<strong>${esc(pick.name)}</strong>で始めます。あとから変更はできません。` : "1体を選んでください。"}</p><button type="button" class="primary" data-bd="starter-confirm" ${pick && !busy && !state.locked ? "" : "disabled"} ${busy?.kind === "starter" ? 'aria-busy="true"' : ""}>${busy?.kind === "starter" ? "保存中…" : "このバディで始める"}</button></div></header>
      <div class="bd-starter-grid" role="radiogroup" aria-label="初回のバディ">${state.catalog
        .map(
          (c) =>
            `<button type="button" class="bd-starter-card" role="radio" aria-checked="${starterPick === c.id}" data-bd="starter-pick" data-id="${esc(c.id)}" data-element="${esc(c.element)}">${portrait(c, "m")}<span class="bd-starter-name"><strong>${esc(c.name)}</strong>${elementChip(c)}</span><span class="bd-role">${esc(c.role)}</span><span class="bd-skill-line"><b>${esc(c.skillName)}</b>${esc(c.skillText)}</span><small class="bd-cooldown">再使用 ${num(c.cooldown)}秒</small></button>`,
        )
        .join("")}</div>
      ${failureBox()}${lockedNote()}
    </section>`;
  }

  function rosterRow(c: BuddyCatalogItem) {
    const g = state.owned[c.id];
    const tag =
      state.selected === c.id
        ? '<span class="bd-tag is-escort">同行中</span>'
        : g
          ? ""
          : '<span class="bd-tag is-locked">未所持</span>';
    return `<li><button type="button" class="bd-row${g ? "" : " is-unowned"}" data-bd="focus" data-id="${esc(c.id)}" aria-pressed="${focus === c.id}" data-element="${esc(c.element)}">${portrait(c, "s")}<span class="bd-row-main"><strong>${esc(c.name)}</strong><span class="bd-row-sub">${elementChip(c)}<span class="bd-role">${esc(c.role)}</span></span></span><span class="bd-row-side">${g ? `<span class="bd-lv">Lv<b>${num(g.level)}</b>/${num(g.levelCap)}</span>` : ""}${tag}</span></button></li>`;
  }

  function detail(c: BuddyCatalogItem | undefined) {
    if (!c)
      return `<section class="bd-detail is-empty"><p>バディの情報を読み込めません。</p></section>`;
    const g = state.owned[c.id];
    const locked = !!state.locked;
    const escort = state.selected === c.id;
    let growth = "";
    if (g) {
      const maxed =
        g.breakthrough >= g.breakthroughMax || g.nextLevelCap === null;
      const atCap = g.level >= g.levelCap;
      const cost = g.breakthroughCost ?? 0;
      const enough = state.fragments >= cost;
      const reason = maxed
        ? "最大まで突破済み"
        : !atCap
          ? `Lv${num(g.levelCap)}で突破できます`
          : !enough
            ? `突破素材が${num(cost - state.fragments)}個足りません`
            : "";
      const breaking = busy?.kind === "breakthrough" && busy.id === c.id;
      growth = `<div class="bd-growth">
        <div class="bd-growth-lv"><span>Lv<b>${num(g.level)}</b><small>/ ${num(g.levelCap)}</small></span>${xpBar(g)}</div>
        <div class="bd-growth-bt"><span class="bd-label">限界突破</span>${pips(g.breakthrough, g.breakthroughMax, `限界突破 ${g.breakthrough}/${g.breakthroughMax}`)}${maxed ? "" : `<span class="bd-next">上限 ${num(g.levelCap)} → <b>${num(g.nextLevelCap ?? g.levelCap)}</b></span>`}</div>
        ${maxed ? "" : `<div class="bd-growth-cost"><span class="bd-label">必要</span>${resource("fragment", cost)}<span class="bd-have${enough ? "" : " is-short"}">所持 ${num(state.fragments)}</span></div>`}
        <div class="bd-growth-act"><button type="button" data-bd="breakthrough" data-id="${esc(c.id)}" ${!reason && !locked && !busy ? "" : "disabled"} ${breaking ? 'aria-busy="true"' : ""}>${breaking ? "突破中…" : "限界突破"}</button>${reason ? `<small class="bd-reason">${esc(reason)}</small>` : ""}</div>
      </div>`;
    } else {
      growth = `<div class="bd-growth is-unowned"><p>未所持です。招集で仲間にできます。</p><button type="button" data-bd="tab" data-tab="recruit">招集へ</button></div>`;
    }
    const equipBusy = busy?.kind === "equip";
    const equipBtn = !g
      ? ""
      : escort
        ? `<button type="button" data-bd="equip" data-id="" ${locked || busy ? "disabled" : ""} ${equipBusy ? 'aria-busy="true"' : ""}>同行を外す</button>`
        : `<button type="button" class="primary" data-bd="equip" data-id="${esc(c.id)}" ${locked || busy ? "disabled" : ""} ${equipBusy ? 'aria-busy="true"' : ""}>${equipBusy ? "保存中…" : "同行させる"}</button>`;
    return `<section class="bd-detail" data-element="${esc(c.element)}" aria-labelledby="bd-detail-name">
      <div class="bd-detail-head">${portrait(c, "l")}<div class="bd-detail-id"><div class="bd-detail-title"><h2 id="bd-detail-name">${esc(c.name)}${escort ? '<span class="bd-tag is-escort">同行中</span>' : ""}</h2>${equipBtn}</div><p>${elementChip(c)}<span class="bd-role">${esc(c.role)}</span></p><div class="bd-skill"><span class="bd-label">固有スキル</span><strong>${esc(c.skillName)}</strong><p>${esc(c.skillText)}</p><small class="bd-cooldown">再使用 ${num(c.cooldown)}秒・通常攻撃は自動</small></div></div></div>
      ${growth}
    </section>`;
  }

  function rosterView() {
    return `<div class="bd-roster"><ul class="bd-list" aria-label="バディ一覧">${state.catalog.map(rosterRow).join("")}</ul>${detail(item(focus))}</div>`;
  }

  function recruitView() {
    const r = state.recruit;
    const missing = state.catalog.filter((c) => !state.owned[c.id]);
    const canDraw =
      r.odds.length > 0 &&
      state.tickets >= r.ticketCost &&
      !state.locked &&
      !busy;
    const drawing = busy?.kind === "draw";
    const short = Math.max(0, r.ticketCost - state.tickets);
    const pityLeft = Math.max(0, r.pityThreshold - r.pityCount);
    const pity =
      missing.length === 0
        ? `<p class="bd-pity is-all"><strong>全員所持</strong>被りは突破素材 ${resource("fragment", r.duplicateFragments, "gain")} に変わります。</p>`
        : r.guaranteedNext
          ? `<p class="bd-pity is-ready"><strong>次の1回は未所持から確定</strong>未所持 ${missing.length}体から均等に選ばれます。</p>`
          : `<p class="bd-pity">${pips(r.pityCount, r.pityThreshold, `連続被り ${r.pityCount}/${r.pityThreshold}`)}<span>連続被り <b>${num(r.pityCount)}</b>/${num(r.pityThreshold)}・あと${num(pityLeft)}回被ると次は未所持から確定</span></p>`;
    const odds = r.odds.length
      ? `<ul class="bd-odds" aria-label="出現率">${r.odds
          .map((o) => {
            const c = item(o.id);
            const own = !!state.owned[o.id];
            return `<li data-element="${esc(c?.element ?? "none")}">${portrait(c, "s")}<span class="bd-odds-name"><strong>${esc(c?.name ?? "不明")}</strong><small>${own ? "所持（被り→素材）" : "未所持"}</small></span><b class="bd-percent">${Number.isFinite(o.percent) ? o.percent.toFixed(o.percent % 1 ? 1 : 0) : "—"}%</b></li>`;
          })
          .join("")}</ul>`
      : `<p class="bd-odds-missing" role="alert">出現率を読み込めないため、いまは招集できません。</p>`;
    const provisional = r.provisional?.length
      ? `<p class="bd-provisional"><span>調整中</span>${r.provisional.map(esc).join("・")}</p>`
      : "";
    return `<div class="bd-recruit">
      <section class="bd-recruit-odds" aria-labelledby="bd-odds-title"><h2 id="bd-odds-title">出現率と保証</h2>${odds}${pity}</section>
      <section class="bd-recruit-draw" aria-labelledby="bd-draw-title">
        <h2 id="bd-draw-title">バディ招集</h2>
        <p class="bd-draw-cost">1回 ${resource("ticket", r.ticketCost, "cost")}<span>所持 ${resource("ticket", state.tickets)}</span></p>
        <button type="button" class="primary bd-draw" data-bd="draw" ${canDraw ? "" : "disabled"} ${drawing ? 'aria-busy="true"' : ""}>${drawing ? "招集中…" : pendingDraw ? "招集を再試行" : short > 0 && r.odds.length ? `チケットが${num(short)}枚足りません` : "1回招集する"}</button>
        <ul class="bd-income" aria-label="チケットの入手">
          <li>ステージ初回突破 ${resource("ticket", r.firstClearTickets, "gain")}</li>
          <li>反復クリア <b>${num(r.repeatUnits)}</b>/${num(r.repeatUnitsPerTicket)} で ${resource("ticket", 1, "gain")}</li>
        </ul>
        ${provisional}
      </section>
      ${result ? resultView(result) : ""}
    </div>`;
  }

  function resultView(o: BuddyDrawOutcome) {
    const c = item(o.buddyId);
    return `<div class="bd-result" role="dialog" aria-modal="false" aria-labelledby="bd-result-title" data-element="${esc(c?.element ?? "none")}" data-duplicate="${o.duplicate}">
      <div class="bd-result-card">${portrait(c, "l")}<div class="bd-result-text"><span class="bd-result-kind">${o.duplicate ? "被り" : "新規加入"}${o.guaranteed ? "<em>未所持保証</em>" : ""}</span><h2 id="bd-result-title">${esc(c?.name ?? "不明なバディ")}</h2>${c ? `<p>${elementChip(c)}<span class="bd-role">${esc(c.role)}</span></p>` : ""}${o.duplicate ? `<p class="bd-convert">突破素材に変換 ${resource("fragment", o.fragmentsGained, "gain")}</p>` : `<p class="bd-convert">編成で同行させられます。</p>`}</div></div>
      <div class="bd-result-act"><button type="button" data-bd="result-roster">バディを見る</button><button type="button" class="primary" data-bd="result-close">閉じる</button></div>
    </div>`;
  }

  function toolbar() {
    if (!state.starterChosen) return "";
    return `<div class="bd-toolbar"><div class="bd-tabs" role="tablist" aria-label="バディ">${(
      [
        ["roster", "編成・育成"],
        ["recruit", "招集"],
      ] as const
    )
      .map(
        ([k, l]) =>
          `<button type="button" role="tab" id="bd-tab-${k}" aria-controls="bd-panel" aria-selected="${tab === k}" data-bd="tab" data-tab="${k}">${l}${k === "recruit" && state.tickets >= state.recruit.ticketCost && state.recruit.odds.length ? '<i class="bd-dot" aria-label="招集できます"></i>' : ""}</button>`,
      )
      .join(
        "",
      )}</div>${lockedNote()}<div class="bd-wallet">${resource("ticket", state.tickets)}${resource("fragment", state.fragments)}</div></div>`;
  }

  function paint() {
    if (destroyed) return;
    const prevFocus = (document.activeElement as HTMLElement | null)?.closest(
      ".bd-root [data-bd]",
    ) as HTMLElement | null;
    const key = prevFocus
      ? `${prevFocus.dataset.bd}|${prevFocus.dataset.id ?? ""}|${prevFocus.dataset.tab ?? ""}`
      : null;
    const body = !state.starterChosen
      ? starterView()
      : `<div id="bd-panel" role="tabpanel" aria-labelledby="bd-tab-${tab}" class="bd-panel">${tab === "roster" ? rosterView() : recruitView()}</div>${failureBox()}`;
    root.dataset.view = !state.starterChosen ? "starter" : tab;
    root.innerHTML = toolbar() + body + toastBox();
    if (result)
      root.querySelector<HTMLElement>("[data-bd=result-close]")?.focus();
    else if (failure)
      root.querySelector<HTMLElement>("[data-bd=retry]")?.focus();
    else if (key) {
      const [bd, id, t] = key.split("|");
      root
        .querySelector<HTMLElement>(
          `[data-bd="${bd}"]${id ? `[data-id="${CSS.escape(id)}"]` : ""}${t ? `[data-tab="${t}"]` : ""}`,
        )
        ?.focus({ preventScroll: true });
    }
  }

  root.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-bd]");
    if (!t || t.disabled || !root.contains(t)) return;
    const id = t.dataset.id ?? null;
    switch (t.dataset.bd) {
      case "tab":
        tab = t.dataset.tab === "recruit" ? "recruit" : "roster";
        result = null;
        cue("menu");
        paint();
        root.querySelector<HTMLElement>(`#bd-tab-${tab}`)?.focus();
        return;
      case "focus":
        focus = id;
        toast = null;
        cue("menu");
        paint();
        return;
      case "starter-pick":
        starterPick = id;
        cue("menu");
        paint();
        return;
      case "starter-confirm":
        if (starterPick) void chooseStarter(starterPick);
        return;
      case "equip":
        void equip(id || null);
        return;
      case "breakthrough":
        if (id) void breakthrough(id);
        return;
      case "draw":
        void draw();
        return;
      case "retry": {
        const f = failure;
        failure = null;
        f?.retry();
        return;
      }
      case "dismiss":
        failure = null;
        paint();
        return;
      case "result-close":
        result = null;
        cue("menu");
        paint();
        root.querySelector<HTMLElement>("[data-bd=draw]")?.focus();
        return;
      case "result-roster":
        result = null;
        tab = "roster";
        cue("menu");
        paint();
        return;
    }
  });
  // 立ち絵が読めない場合は紋章に切り替える（欠損時も配置を崩さない）。
  root.addEventListener(
    "error",
    (e) => {
      const img = e.target as HTMLElement;
      if (img instanceof HTMLImageElement) {
        img.closest(".bd-portrait")?.classList.add("is-fallback");
        img.remove();
      }
    },
    true,
  );
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && (result || failure)) {
      result = null;
      failure = null;
      paint();
      e.stopPropagation();
    }
  });

  paint();
  return {
    root,
    update(next) {
      state = next;
      if (focus && !item(focus)) focus = state.catalog[0]?.id ?? null;
      paint();
    },
    destroy() {
      destroyed = true;
      root.remove();
    },
  };
}

/* ---------- 戦闘HUD：固有スキルボタン ---------- */

export interface BuddySkillView {
  id: string;
  name: string;
  element: BuddyElement;
  skillName: string;
  /** 再使用の全体秒と残り秒。残り0で使用可能。 */
  cooldown: number;
  remaining: number;
  /** 効果の持続中（残り秒）。表示だけで、効果判定は主担当側。 */
  activeRemaining?: number;
  /** 戦闘不能・表示不可などで押せない理由 */
  unavailable?: string | null;
}

/** layout.ts の CONTROL_IDS に "buddy" を足す場合の標準配置案（既存ボタンと重ならない位置）。 */
export const BUDDY_SKILL_PLACEMENT = { x: 0.92, y: 0.86, size: 1 } as const;

export function createBuddySkillButton(options: {
  onActivate(): void;
  sound?(cue: BuddySoundCue): void;
  /** layout.ts の placeControls が getElementById で配置するためのID。既定は "buddy"。 */
  id?: string;
  /** PC（pointer: fine）で添えるキー表示。例："V"。タッチ端末では出さない。 */
  keyHint?: string;
}) {
  const button = document.createElement("button");
  button.type = "button";
  button.id = options.id ?? "buddy";
  button.className = "bd-skill-btn";
  button.innerHTML = `<span class="bd-skill-ring" aria-hidden="true"></span><span class="bd-skill-icon" aria-hidden="true"></span><span class="bd-skill-sec" aria-hidden="true"></span><span class="bd-skill-name" aria-hidden="true"></span>${options.keyHint ? `<kbd class="bd-skill-key" aria-hidden="true">${esc(options.keyHint)}</kbd>` : ""}`;
  if (options.keyHint)
    button.setAttribute("aria-keyshortcuts", options.keyHint);
  let view: BuddySkillView | null = null;
  let wasReady = false;
  // 出撃直後に使用可能でも鳴らさない。待ち時間を経て使えるようになった時だけ知らせる。
  let initialized = false;
  let lastKey = "";
  const ring = button.querySelector<HTMLElement>(".bd-skill-ring")!;
  const icon = button.querySelector<HTMLElement>(".bd-skill-icon")!;
  const sec = button.querySelector<HTMLElement>(".bd-skill-sec")!;
  const name = button.querySelector<HTMLElement>(".bd-skill-name")!;
  let element: string | null = null;

  const fire = (e: Event) => {
    e.preventDefault();
    if (!view || view.unavailable || view.remaining > 0) return;
    options.onActivate();
  };
  button.addEventListener("pointerdown", fire);
  button.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") fire(e);
  });
  button.addEventListener("contextmenu", (e) => e.preventDefault());

  return {
    element: button,
    update(next: BuddySkillView | null) {
      view = next;
      button.hidden = !next;
      if (!next) return;
      if (element !== next.element) {
        element = next.element;
        icon.innerHTML = buddyGlyph(next.element);
        button.dataset.element = next.element;
      }
      const total = Math.max(0.001, next.cooldown);
      const remaining = Math.max(0, next.remaining);
      const ready = remaining <= 0 && !next.unavailable;
      const state = next.unavailable
        ? "unavailable"
        : (next.activeRemaining ?? 0) > 0
          ? "active"
          : ready
            ? "ready"
            : "cooldown";
      const seconds = ready
        ? ""
        : next.unavailable
          ? "—"
          : String(Math.ceil(remaining));
      const progress = (1 - Math.min(1, remaining / total)).toFixed(2);
      // 毎フレーム呼ばれる。輪の進み（1%刻み）・秒・状態が変わった時だけDOMを書き換える。
      const key = `${state}|${seconds}|${progress}|${next.name}|${next.skillName}|${next.unavailable ?? ""}`;
      if (key !== lastKey) {
        lastKey = key;
        button.style.setProperty("--p", progress);
        button.dataset.state = state;
        sec.textContent = seconds;
        name.textContent = next.skillName;
        button.setAttribute("aria-disabled", String(!ready));
        button.setAttribute(
          "aria-label",
          `${next.name}の固有スキル ${next.skillName}${ready ? " 使用可能" : next.unavailable ? ` ${next.unavailable}` : ` 再使用まで${seconds}秒`}`,
        );
      }
      if (ready && !wasReady && initialized) {
        // 使用可能になった瞬間だけ1回知らせる（常時の点滅はしない）。
        button.classList.remove("is-ready-flash");
        void button.offsetWidth;
        button.classList.add("is-ready-flash");
        options.sound?.("ready");
      }
      wasReady = ready;
      initialized = true;
      void ring;
    },
    destroy() {
      button.remove();
    },
  };
}
