/* 生存カードの共通部品（デザイン試作）。
 * どの場面でも同じ「枠＝表示分類」「紋章＝系統／属性」「矢印チップ＝射撃方式」「段階の丸」で描き、
 * 場面ごとに大きさ（L: 3択 / M: デッキ編集 / S: HUD / row: 取得一覧）だけを変える。
 * 文字列だけを返す純関数。ゲームへ組み込む際は同じ引数（CardView）を渡せば同じ見た目になる。 */
(function () {
  "use strict";
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

  /* 紋章（24×24）。色は currentColor。系統は現行データ、属性はデザイン用の仮例。 */
  const GLYPH = {
    explosion:
      '<path d="M12 1.8l2.1 5.3 5.2-2.6-2 5.4 5.5 1.9-5.3 2.2 2.6 5.2-5.4-2-1.9 5.5-2.2-5.3-5.2 2.6 2-5.4-5.5-1.9 5.3-2.2L4.5 5.4l5.4 2z" fill="currentColor"/><circle cx="12" cy="12" r="3.1" fill="#0b1b24"/>',
    piercing:
      '<path d="M3 12h15.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M15 6.5L21.5 12 15 17.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/><path d="M8 5v14M12.5 7v10" stroke="currentColor" stroke-width="1.5" opacity=".55"/>',
    interception:
      '<circle cx="12" cy="12" r="7.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 1.5v6M12 16.5v6M1.5 12h6M16.5 12h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="2" fill="currentColor"/>',
    generic:
      '<path d="M12 2.2l8.5 4.9v9.8L12 21.8l-8.5-4.9V7.1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 7.6v8.8M7.6 12h8.8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    fire: '<path d="M12.4 1.9c.6 3.6 4.6 5.6 5.4 9.6.9 4.6-2.3 9.6-6.2 9.6-3.6 0-6.4-2.8-6.1-6.6.2-2.6 1.8-4.2 2.9-5.2-.1 1.8.5 3.1 1.6 3.6-.6-3.9 1.4-7.6 2.4-11z" fill="currentColor"/><path d="M12 13.2c.4 1.6 2.3 2.4 2.1 4.4-.1 1.5-1.3 2.4-2.6 2.4-1.5 0-2.6-1.2-2.4-2.7.1-1 .8-1.6 1.3-2 .1.6.4 1 .8 1.1-.2-1.3.3-2.3.8-3.2z" fill="#2a120a" opacity=".55"/>',
    ice: '<g stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9.3 3.6L12 6l2.7-2.4M9.3 20.4L12 18l2.7 2.4M3.6 10.7L6.7 9.6 6 6.1M20.4 13.3l-3.1 1.1.7 3.5M3.6 13.3l3.1 1.1L6 17.9M20.4 10.7l-3.1-1.1.7-3.5"/></g>',
    lightning:
      '<path d="M13.6 1.6L4.6 13.4h5.9l-1.8 9 9.7-12.6h-6z" fill="currentColor" stroke="#0b1b24" stroke-width=".6" stroke-linejoin="round"/>',
    curse:
      '<path d="M2 12c2.7-4.4 6.1-6.6 10-6.6s7.3 2.2 10 6.6c-2.7 4.4-6.1 6.6-10 6.6S4.7 16.4 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.6c1.3 1.2 1.9 2.7 1.9 4.4s-.6 3.2-1.9 4.4c-1.3-1.2-1.9-2.7-1.9-4.4s.6-3.2 1.9-4.4z" fill="currentColor"/><path d="M12 19.5v3M8 18.6l-1 2.4M16 18.6l1 2.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>',
    wind: '<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M2.5 8.5h11.2a3.2 3.2 0 1 0-3.1-4"/><path d="M2.5 13h16a3.3 3.3 0 1 1-3.2 4.2"/><path d="M5 17.5h6"/></g>',
    unknown:
      '<path d="M8.4 8.6a3.7 3.7 0 1 1 5.4 3.3c-1.2.6-1.8 1.4-1.8 2.7v.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/>',
  };
  /* 射撃方式（24×24）。中央下の点が自分、矢印が弾の向き。属性と重ねて使う（仮例）。 */
  const SHOT = {
    split:
      '<circle cx="12" cy="17" r="2.2" fill="currentColor"/><path d="M12 14.5V4M12 4l-2.4 2.6M12 4l2.4 2.6M10 15L3.5 8.8M3.5 8.8l.4 3.4M3.5 8.8l3.4.2M14 15l6.5-6.2M20.5 8.8l-.4 3.4M20.5 8.8l-3.4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
    rear: '<circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M12 9.5V2.5M12 2.5L9.6 5.1M12 2.5l2.4 2.6M12 14.5v7M12 21.5l-2.4-2.6M12 21.5l2.4-2.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
    sides:
      '<circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M12 9.5V3M12 3L9.6 5.6M12 3l2.4 2.6M9.5 12H2.5M2.5 12l2.6-2.4M2.5 12l2.6 2.4M14.5 12h7M21.5 12l-2.6-2.4M21.5 12l-2.6 2.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
    clone:
      '<circle cx="8" cy="17" r="2.1" fill="currentColor"/><circle cx="16" cy="17" r="2.1" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 1.6"/><path d="M8 14.5V4.5M8 4.5L5.8 6.9M8 4.5l2.2 2.4M16 14.5V4.5M16 4.5l-2.2 2.4M16 4.5l2.2 2.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
  };
  const svg = (inner, cls = "") =>
    `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${inner}</svg>`;

  /* 表示分類（仮）。枠の形・二重線・文字ラベルで区別し、色だけに頼らない。 */
  const KIND = {
    basic: { label: "基礎", aria: "基礎カード" },
    deck: { label: "デッキ", aria: "デッキ選択カード" },
    fusion: { label: "融合", aria: "融合カード" },
  };
  const ACQ = {
    new: { mark: "＋", label: "新規獲得" },
    "level-up": { mark: "↑", label: "段階アップ" },
    "fusion-new": { mark: "◆", label: "融合進化" },
    "fusion-up": { mark: "◆", label: "融合強化" },
  };

  function art(view, base) {
    const a = view.art;
    if (!a) return "";
    if (a.kind === "image")
      return `<img class="sc-art-img" src="${esc(base + a.file)}" alt="">`;
    if (a.kind === "atlas")
      return `<span class="sc-art-img sc-art-atlas" aria-hidden="true" style="background-image:url('${esc(base + a.file)}');background-position:${(a.index % 3) * 50}% ${Math.floor(a.index / 3) * 50}%"></span>`;
    if (a.kind === "glyph")
      return svg(GLYPH[a.glyph] || GLYPH.unknown, "sc-art-glyph");
    return "";
  }
  function affinity(view, withText = true) {
    const f = view.affinity;
    return `<span class="sc-affinity" data-affinity="${esc(f.key)}">${svg(GLYPH[f.key] || GLYPH.generic, "sc-affinity-glyph")}${withText ? `<span>${esc(f.label)}</span>` : ""}</span>`;
  }
  function shot(view, withText = true) {
    if (!view.shot) return "";
    return `<span class="sc-shot" data-shot="${esc(view.shot.key)}" title="射撃方式：${esc(view.shot.label)}">${svg(SHOT[view.shot.key], "sc-shot-glyph")}${withText ? `<span>${esc(view.shot.label)}</span>` : ""}</span>`;
  }
  /* 段階の丸。before→after は「増える1つ」を中抜きの明るい丸で示す。 */
  function pips(level) {
    if (!level || level.max <= 1) return "";
    const now = level.current ?? 0,
      next = level.next ?? now;
    let out = "";
    for (let i = 1; i <= level.max; i++)
      out += `<i data-pip="${i <= now ? "on" : i <= next ? "gain" : "off"}"></i>`;
    return `<span class="sc-pips" aria-hidden="true">${out}</span>`;
  }
  function levelText(level) {
    if (!level) return "";
    if (level.next != null && level.next !== level.current)
      return level.current
        ? `${level.current} → ${level.next}段階`
        : `未取得 → ${level.next}段階`;
    if (level.current >= level.max) return `最大 ${level.max}段階`;
    return level.current
      ? `${level.current}/${level.max}段階`
      : `最大${level.max}段階`;
  }
  function kindTag(view) {
    return `<span class="sc-kind-tag">${esc(KIND[view.kind].label)}</span>`;
  }
  function sampleTag(view) {
    return view.sample
      ? '<span class="sc-sample-tag" title="ゲームに存在しないデザイン用の仮例">仮例</span>'
      : "";
  }
  const dataAttrs = (view, size) =>
    [
      `data-size="${size}"`,
      `data-kind="${view.kind}"`,
      `data-affinity="${esc(view.affinity.key)}"`,
      view.deck ? `data-deck="${view.deck}"` : "",
      view.acquisition ? `data-acquisition="${view.acquisition}"` : "",
      view.locked ? 'data-locked="true"' : "",
      view.undiscovered ? 'data-undiscovered="true"' : "",
      view.state ? `data-state="${view.state}"` : "",
      view.sample ? 'data-sample="true"' : "",
      view.level && view.level.current >= view.level.max
        ? 'data-max="true"'
        : "",
    ]
      .filter(Boolean)
      .join(" ");
  /* 枠の層。sc-ring（選択・注目の縁）→ sc-frame（分類の枠）→ sc-face（内容）。 */
  const shell = (inner) =>
    `<span class="sc-ring" aria-hidden="true"></span><span class="sc-frame" aria-hidden="true"></span><span class="sc-face">${inner}</span>`;

  /** L：プレイ中の強化3択。押すと選択。重要な説明はすべて表面に出す。 */
  function cardL(view, base) {
    const acq = view.acquisition ? ACQ[view.acquisition] : null;
    const label = `${acq ? acq.label + "・" : ""}${levelText(view.level)}：${view.name}（${KIND[view.kind].aria}・${view.affinity.label}${view.shot ? "・射撃方式 " + view.shot.label : ""}）：${view.description}${view.materials ? " 素材：" + view.materials.map((m) => m.name).join(" × ") : ""}${view.sample ? "（デザイン用の仮例）" : ""}`;
    return `<button type="button" class="sc-card" ${dataAttrs(view, "L")} data-card="${esc(view.id)}" aria-label="${esc(label)}"${view.state === "disabled" ? " disabled" : ""}>${shell(
      `<span class="sc-top">${kindTag(view)}${acq ? `<span class="sc-acq"><b aria-hidden="true">${acq.mark}</b>${acq.label}</span>` : ""}${sampleTag(view)}</span>
      <span class="sc-art">${art(view, base)}${affinity(view, false)}${shot(view, false)}</span>
      <span class="sc-meta">${affinity(view)}${shot(view)}</span>
      <strong class="sc-name">${esc(view.name)}</strong>
      <span class="sc-level">${pips(view.level)}<span>${esc(levelText(view.level))}</span></span>
      <span class="sc-desc">${esc(view.description)}</span>
      ${view.materials ? `<span class="sc-materials">${view.materials.map((m) => `<span>${art(m, base)}<span>${esc(m.name)}</span></span>`).join('<b aria-hidden="true">×</b>')}</span>` : ""}
      ${view.state === "disabled" && view.reason ? `<span class="sc-reason">${esc(view.reason)}</span>` : ""}
      ${view.state === "picked" ? '<span class="sc-stamp" aria-hidden="true">決定</span>' : ""}`,
    )}</button>`;
  }

  /** M：基地のデッキ編集。本体を押すと詳細、右端の広い当たり判定でデッキの出し入れ。 */
  function cardM(view, base) {
    const sub = view.undiscovered
      ? "？？ × ？？"
      : view.locked
        ? view.locked
        : view.fusionProgress
          ? view.fusionProgress
          : `${view.affinity.label} · 最大${view.level ? view.level.max : "-"}`;
    // チェックの文字は既存の用語「候補」。分類ラベル「デッキ」と同じ語を使わない。
    const check = view.deck
      ? `<button type="button" class="sc-check" role="checkbox" aria-checked="${view.deck === "in"}" data-pool="${esc(view.id)}" aria-label="${esc(view.name)}を候補に含める"${view.locked ? ' aria-disabled="true"' : ""}><span class="sc-checkbox" aria-hidden="true">${view.locked ? svg('<rect x="5" y="10.5" width="14" height="10" rx="1.5" fill="currentColor"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" fill="none" stroke="currentColor" stroke-width="2.2"/>') : view.deck === "in" ? "✓" : ""}</span><span class="sc-check-label">${view.locked ? "未解放" : view.deck === "in" ? "候補" : ""}</span></button>`
      : "";
    return `<div class="sc-card" ${dataAttrs(view, "M")}${view.inspecting ? ' data-inspecting="true"' : ""}>${shell(
      `<button type="button" class="sc-pick" data-inspect="${esc(view.id)}" aria-label="${esc(view.name)}（${KIND[view.kind].aria}）の詳細を見る"${view.inspecting ? ' aria-current="true"' : ""}>
        <span class="sc-art">${view.undiscovered ? '<span class="sc-art-unknown" aria-hidden="true">？</span>' : art(view, base)}${view.undiscovered ? "" : affinity(view, false)}${view.shot ? shot(view, false) : ""}${kindTag(view)}</span>
        <span class="sc-text"><strong class="sc-name">${esc(view.name)}</strong><small>${sampleTag(view)}${esc(sub)}</small></span>
      </button>${check}`,
    )}</div>`;
  }

  /** S：戦闘HUDの取得済み一覧。枠の形と段階数字で、L・Mと同じカードと分かる。 */
  function cardS(view, base) {
    const lv = view.level;
    return `<span class="sc-card" ${dataAttrs(view, "S")} role="listitem" aria-label="${esc(view.name)}（${KIND[view.kind].label}）${lv ? ` ${lv.current}/${lv.max}段階` : ""}">${shell(
      `<span class="sc-art">${art(view, base)}</span>${lv && lv.max > 1 ? `<em>${lv.current >= lv.max ? "M" : lv.current}</em>` : ""}`,
    )}</span>`;
  }

  /** row：一時停止・3択中の「現在の強化」。小さな絵札＋名前＋段階＋効果。 */
  function cardRow(view, base) {
    return `<li class="sc-card" ${dataAttrs(view, "row")}>${shell(
      `<span class="sc-art">${art(view, base)}${affinity(view, false)}</span>
       <span class="sc-text"><span class="sc-row1">${kindTag(view)}${sampleTag(view)}<strong class="sc-name">${esc(view.name)}</strong>${pips(view.level)}<small class="sc-lv">${esc(levelText(view.level))}</small></span><span class="sc-desc">${esc(view.description)}</span></span>`,
    )}</li>`;
  }

  /** 空き枠（取得一覧・HUD）。 */
  const emptySlot = (size) =>
    size === "S"
      ? '<span class="sc-slot-empty" data-size="S" role="listitem" aria-label="空き枠"></span>'
      : '<li class="sc-slot-empty" data-size="row"><span>空き枠</span></li>';

  window.SurvivalCard = {
    render: { L: cardL, M: cardM, S: cardS, row: cardRow },
    emptySlot,
    GLYPH,
    SHOT,
    KIND,
    ACQ,
    svg,
    esc,
    levelText,
  };
})();
