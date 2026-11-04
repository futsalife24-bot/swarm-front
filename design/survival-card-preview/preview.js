/* 生存カードのデザインプレビュー。ゲームの処理・保存・通信は使わず、書き出した定義データだけで描く。
 * URL: ?scene=base|run|hud|owned|compare &case=opening|levelup|fusion|samples|long|picked|disabled
 *      &kinds=family|deck|basic &motion=reduce &tab=upgrades|fusions|samples &ui=0（操作パネルを隠す） */
(function () {
  "use strict";
  const DATA = window.SURVIVAL_CARD_DATA;
  const SAMPLES = window.SURVIVAL_CARD_SAMPLES;
  const { render, emptySlot, esc, svg, SHOT, GLYPH, levelText } =
    window.SurvivalCard;
  // スマホ用の公開版（tools/build-artifact.mjs）は画像の場所とURL同期を差し替える。
  const CFG = window.SC_PREVIEW || {};
  const ICONS = CFG.iconBase || "../../public/rebuild/upgrades/";
  const real = new Map(DATA.cards.map((c) => [c.id, c]));
  const sample = new Map(SAMPLES.cards.map((c) => [c.id, c]));
  const params = new URLSearchParams(location.search);
  const S = {
    scene: params.get("scene") || "base",
    runCase: params.get("case") || "opening",
    kinds: params.get("kinds") || "family",
    reduce: params.get("motion") === "reduce",
    ui: params.get("ui") !== "0",
    tab: params.get("tab") || "upgrades",
    inspect: params.get("inspect") || "blast-core",
    unlockedStage: 3,
    // 例：開放済みの基礎候補から一部を外した構成（実プレイの保存とは無関係）。
    pool: new Set(
      DATA.baseIds.filter(
        (id) =>
          !["magnet", "reload", "tactical-reload"].includes(id) &&
          (real.get(id).unlockStage ?? 0) <= 3,
      ),
    ),
    samplePool: new Set([
      "sample-fire",
      "sample-lightning",
      "sample-fire-split",
    ]),
    discovered: new Set([
      "fusion-collapse",
      "fusion-counter",
      "fusion-reactor",
    ]),
    picked: null,
  };

  /* ---------- データ → CardView ---------- */
  function kindOf(c) {
    if (c.fusion || c.kind === "fusion") return "fusion";
    if (S.kinds === "deck" || S.kinds === "basic") return S.kinds;
    if (c.kind) return c.kind;
    return c.family === "generic" ? "basic" : "deck"; // 仮の割当：補強系＝基礎、その他＝デッキ
  }
  function view(id, extra = {}) {
    const c = real.get(id);
    if (c)
      return {
        id,
        name: c.name,
        kind: extra.kind || kindOf(c),
        affinity: { key: c.family, label: c.familyLabel },
        art: { kind: c.icon.kind, file: c.icon.file, index: c.icon.index },
        description: c.effectByLevel[0],
        level: { current: 0, max: c.maxLevel },
        ...extra,
      };
    const s = sample.get(id);
    return {
      id,
      name: s.name,
      kind: extra.kind || kindOf({ ...s, fusion: s.kind === "fusion" }),
      affinity: { key: s.affinity, label: SAMPLES.affinities[s.affinity] },
      shot: s.shot ? { key: s.shot, label: SAMPLES.shots[s.shot] } : undefined,
      art: { kind: "glyph", glyph: s.affinity },
      description: s.description,
      level: { current: 0, max: s.maxLevel },
      sample: true,
      ...extra,
    };
  }
  const nameOf = (id) => (real.get(id) || sample.get(id)).name;
  const materialsOf = (id) => (real.get(id) || sample.get(id)).materials || [];
  const isFusion = (id) =>
    !!(real.get(id)?.fusion || sample.get(id)?.kind === "fusion");
  const lockedText = (id) => {
    const st = real.get(id)?.unlockStage;
    return st && st > S.unlockedStage ? `攻略${st}クリアで解放` : null;
  };
  /** プレイ中の3択に出すカード。owned＝取得済みの段階。文面は現行の3択と同じ関数の書き出し。 */
  function offerView(id, owned, extra = {}) {
    const c = real.get(id);
    const fusion = isFusion(id);
    const max = (c || sample.get(id)).maxLevel;
    const v = view(id, {
      level: { current: owned, next: owned + 1, max },
      acquisition: fusion
        ? owned
          ? "fusion-up"
          : "fusion-new"
        : owned
          ? "level-up"
          : "new",
      ...extra,
    });
    if (c) v.description = c.offerCopy[owned].description;
    if (fusion && !owned) v.materials = materialsOf(id).map((m) => view(m));
    return v;
  }
  function ownedView(id, level) {
    const c = real.get(id);
    const v = view(id, {
      level: { current: level, max: (c || sample.get(id)).maxLevel },
    });
    if (c) v.description = c.effectByLevel[level - 1];
    return v;
  }

  /* ---------- 共通の見た目（既存UIの写し：パネル・ボタン） ---------- */
  const btn = (id, label, cls = "") =>
    `<button type="button" class="pv-btn ${cls}" id="${id}">${label}</button>`;

  /* ---------- 場面1：基地・デッキ編集 ---------- */
  function baseScene() {
    const tabIds = {
      upgrades: DATA.baseIds,
      fusions: DATA.fusionIds,
      samples: SAMPLES.cards.map((c) => c.id),
    };
    const ids = tabIds[S.tab];
    const poolCount = S.pool.size;
    const short = poolCount < DATA.limits.minPool;
    const grid = ids
      .map((id) => {
        if (isFusion(id)) {
          const known = !real.get(id) || S.discovered.has(id);
          const pool = real.get(id) ? S.pool : S.samplePool;
          const n = materialsOf(id).filter((m) => pool.has(m)).length;
          return render.M(
            view(id, {
              undiscovered: !known,
              fusionProgress: known
                ? `素材 ${n}/2${n === 2 ? " · 狙える" : ""}`
                : null,
              inspecting: S.inspect === id,
            }),
            ICONS,
          );
        }
        const pool = real.get(id) ? S.pool : S.samplePool;
        return render.M(
          view(id, {
            deck: pool.has(id) ? "in" : "out",
            locked: lockedText(id),
            inspecting: S.inspect === id,
          }),
          ICONS,
        );
      })
      .join("");
    const discoveredReady = DATA.fusionIds.filter(
      (f) => S.discovered.has(f) && materialsOf(f).every((m) => S.pool.has(m)),
    ).length;
    return `<section class="pv-panel pv-base" aria-label="生存カード設定・デッキ編成">
      <header class="pv-header"><h1>生存カード</h1><span class="pv-service">0勝 · 0功績</span><nav>${btn("pv-workshop", "武器工房")}${btn("pv-set", "出撃にセット", "primary")}${btn("pv-back", "戻る")}</nav></header>
      <div class="pv-deckbar"><select aria-label="保存デッキ"><option>1 · 未保存</option></select><input aria-label="デッキ名" placeholder="デッキ名（24文字まで）"><button type="button" class="pv-btn">デッキ保存</button><button type="button" class="pv-btn" disabled>呼び出す</button><span class="pv-count${short ? " is-short" : ""}">候補 ${poolCount}種${short ? `（あと${DATA.limits.minPool - poolCount}種）` : ""}</span></div>
      <div class="pv-workbench"><section class="pv-catalog" aria-label="強化候補">
        <div class="pv-catalog-heading"><div role="tablist" aria-label="強化と融合">${[
          ["upgrades", `強化 ${DATA.baseIds.length}`],
          ["fusions", `融合 ${DATA.fusionIds.length}`],
          ["samples", `仮例 ${SAMPLES.cards.length}`],
        ]
          .map(
            ([k, l]) =>
              `<button type="button" role="tab" class="pv-tab${k === "samples" ? " is-sample" : ""}" data-tab="${k}" aria-selected="${S.tab === k}">${l}</button>`,
          )
          .join(
            "",
          )}</div><span class="pv-fusion-count">発見 ${S.discovered.size}/${DATA.fusionIds.length} · 狙える融合 ${discoveredReady}</span></div>
        <div class="pv-grid" role="tabpanel">${grid}</div>
      </section><aside class="pv-detail" aria-label="強化・融合の説明">${detail()}</aside></div>
      <p class="pv-status" role="status">${S.tab === "samples" ? "「仮例」はデザイン確認用。ゲームに存在しない属性・射撃方式です。" : "開幕も選んだ候補からランダム3択。候補は6種以上。出撃には「出撃にセット」。"}</p>
    </section>`;
  }
  function detail() {
    const id = S.inspect;
    const c = real.get(id);
    const fusion = isFusion(id);
    if (fusion && c && !S.discovered.has(id))
      return `<ul class="pv-detail-card">${render.row({ ...view(id), undiscovered: true, description: `${c.name}＝？？ × ？？`, level: null, art: { kind: "glyph", glyph: "unknown" } }, ICONS)}</ul><p>作戦中に初めて融合すると、素材と効果をここで確認できます。</p><p class="pv-rule">融合元の能力をレベルMAXで融合可能。1枠空く</p>`;
    const v = view(id, {
      description: c
        ? fusion
          ? c.catalogDescription
          : c.effectByLevel[0]
        : sample.get(id).description,
    });
    const pool = c ? S.pool : S.samplePool;
    const maxText = c ? c.effectByLevel[c.maxLevel - 1] : null;
    const recipes = fusion
      ? [id]
      : (c
          ? DATA.fusionIds.filter((f) => S.discovered.has(f))
          : SAMPLES.cards.filter((x) => x.kind === "fusion").map((x) => x.id)
        ).filter((f) => materialsOf(f).includes(id));
    const locked = lockedText(id);
    return `<ul class="pv-detail-card">${render.row(v, ICONS)}</ul>
      ${v.sample ? '<p class="pv-sample-note">デザイン用の仮例。効果・数値・段階数は未確定です。</p>' : ""}
      ${maxText && !fusion ? `<details class="pv-ranks"><summary>最大段階（${c.maxLevel}）の効果</summary><p>${esc(maxText)}</p></details>` : ""}
      ${fusion && c ? `<details class="pv-ranks"><summary>融合後の詳しい効果</summary><p>1段階：${esc(c.effectByLevel[0])}</p><p>最大段階：${esc(c.effectByLevel[c.maxLevel - 1])}</p></details>` : ""}
      ${locked ? `<p class="pv-locked">${locked}</p>` : ""}
      <section class="pv-recipes"><h3>${fusion ? "融合レシピ" : "この強化から狙える融合"}</h3>${
        recipes.length
          ? recipes
              .map((f) => {
                const ms = materialsOf(f);
                const ready = ms.every((m) => pool.has(m));
                return `<div class="pv-recipe" data-ready="${ready}">${!fusion ? `<button type="button" class="pv-recipe-result" data-inspect="${f}">${render.S(view(f, { level: null }), ICONS)}<strong>${esc(nameOf(f))}</strong><span aria-hidden="true">›</span></button>` : ""}<div class="pv-recipe-materials">${ms
                  .map(
                    (m) =>
                      `<button type="button" data-inspect="${m}">${render.S(view(m, { level: null }), ICONS)}<span>${esc(nameOf(m))}<small>${lockedText(m) || (pool.has(m) ? "✓ 候補に選択中" : "候補に未選択")}</small></span></button>`,
                  )
                  .join(
                    '<b aria-hidden="true">＋</b>',
                  )}</div><button type="button" class="pv-btn pv-add" data-add="${f}" ${ready || ms.some(lockedText) ? "disabled" : ""}>${ms.some(lockedText) ? "未解放の素材あり" : ready ? "素材を選択済み" : "素材2種を候補に加える"}</button></div>`;
              })
              .join("")
          : '<p class="pv-muted">この強化を素材にする発見済みの融合はありません。</p>'
      }</section>`;
  }

  /* ---------- 場面2：プレイ中の強化選択 ---------- */
  const RUN_CASES = {
    opening: {
      label: "開幕の3択（新規）",
      cards: [
        ["afterimage-mine", 0],
        ["emergency-armor", 0],
        ["magnet", 0],
      ],
      owned: [],
    },
    levelup: {
      label: "新規・段階アップ・最大へ",
      cards: [
        ["armor-piercer", 0],
        ["fuse", 1],
        ["armor", 3],
      ],
      owned: [
        ["fuse", 1],
        ["armor", 3],
        ["afterimage-mine", 2],
      ],
    },
    fusion: {
      label: "融合進化・融合強化",
      cards: [
        ["fusion-collapse", 0],
        ["blast-radius", 2],
        ["fusion-reactor", 1],
      ],
      owned: [
        ["fuse", 3],
        ["blast-radius", 2],
        ["fusion-reactor", 1],
        ["armor", 2],
      ],
    },
    samples: {
      label: "属性・射撃方式（仮例）",
      cards: [
        ["sample-fire", 0],
        ["sample-ice-rear", 1],
        ["sample-lightning", 0],
      ],
      owned: [
        ["sample-ice-rear", 1],
        ["sample-fire-split", 2],
        ["armor", 1],
      ],
    },
    long: {
      label: "長い名前・長い説明",
      cards: [
        ["sample-long", 2],
        ["fusion-skewer", 0],
        ["compressed-charge", 2],
      ],
      owned: [
        ["sample-long", 2],
        ["ricochet", 3],
        ["opening-shot", 3],
        ["compressed-charge", 2],
      ],
    },
    picked: {
      label: "選んだ直後",
      cards: [
        ["afterimage-mine", 0],
        ["emergency-armor", 0],
        ["magnet", 0],
      ],
      owned: [],
      picked: 1,
    },
    disabled: {
      label: "選択不可（仮の状態）",
      cards: [
        ["interceptor", 0, "6枠すべて使用中（新規は選べない場合の表示例）"],
        ["fuse", 2],
        ["reload", 1],
      ],
      owned: [
        ["fuse", 2],
        ["reload", 1],
        ["armor", 2],
        ["magazine", 1],
        ["afterimage-mine", 1],
        ["life-drain", 1],
      ],
    },
  };
  function runScene() {
    const rc = RUN_CASES[S.runCase] || RUN_CASES.opening;
    const pickedIndex = S.picked != null ? S.picked : rc.picked;
    const cards = rc.cards
      .map(([id, owned, reason], i) =>
        render.L(
          offerView(id, owned, {
            state: reason
              ? "disabled"
              : pickedIndex == null
                ? undefined
                : pickedIndex === i
                  ? "picked"
                  : "dismissed",
            reason,
          }),
          ICONS,
        ),
      )
      .join("");
    const ownedCount = rc.owned.length;
    return `<div class="pv-battle"></div><section class="pv-selection" aria-label="強化を選べ">
      <header><button type="button" class="pv-btn pv-owned-open" id="pv-owned-open" aria-haspopup="dialog">現在の強化 ${ownedCount}/${DATA.limits.maxTypes}枠</button><h1 class="pv-choice-title">強化を選べ</h1><div class="pv-sel-actions">${S.runCase === "opening" || S.runCase === "picked" ? "" : `<button type="button" class="pv-btn" id="pv-reroll">再抽選 残り${DATA.limits.rerolls}</button>`}</div></header>
      <div class="pv-cards${pickedIndex == null ? " sc-enter" : ""}">${cards}</div>
      <dialog class="pv-owned-dialog" id="pv-owned-dialog" aria-label="現在の強化"><header>${btn("pv-owned-close", "3択へ戻る")}</header>${ownedList(rc.owned)}</dialog>
    </section>`;
  }
  function ownedList(owned) {
    const rows = owned
      .map(([id, lv]) => render.row(ownedView(id, lv), ICONS))
      .join("");
    const empty = Array.from(
      { length: Math.max(0, DATA.limits.maxTypes - owned.length) },
      () => emptySlot("row"),
    ).join("");
    return `<section class="pv-upgrade-details" aria-label="強化状況"><h2>強化状況 <small>${owned.length}/${DATA.limits.maxTypes}枠</small></h2><ul class="pv-owned">${rows}${empty}</ul></section>`;
  }

  /* ---------- 場面3：取得済み（HUD・一時停止） ---------- */
  const OWNED_BUILD = [
    ["fusion-collapse", 1],
    ["afterimage-mine", 3],
    ["armor-piercer", 2],
    ["armor", 1],
    ["sample-fire", 2],
  ];
  const hudRight = () => {
    const strip =
      OWNED_BUILD.map(([id, lv]) => render.S(ownedView(id, lv), ICONS)).join(
        "",
      ) + emptySlot("S").repeat(DATA.limits.maxTypes - OWNED_BUILD.length);
    return `<div class="pv-hud-right"><span class="pv-hud-ammo">残弾 <b>32</b> / 32</span><span class="pv-hud-note">強化 ${OWNED_BUILD.length}/${DATA.limits.maxTypes}枠</span><div class="pv-strip" role="list" aria-label="取得済み強化">${strip}</div></div>`;
  };
  /** 戦闘中のHUD（右上の取得済み一覧）。戦闘の他の表示は省略。 */
  function hudScene() {
    return `<div class="pv-battle pv-battle-clear"></div>${hudRight()}<button type="button" class="pv-btn pv-hud-pause" data-scene="owned" aria-label="一時停止">Ⅱ</button>`;
  }
  function ownedScene() {
    return `<div class="pv-battle"></div>${hudRight()}
      <section class="pv-pause" aria-label="一時停止"><header><h1>一時停止</h1>${btn("pv-resume", "再開", "primary")}</header>
      <section class="pv-upgrade-details"><h2>強化状況 <small>${OWNED_BUILD.length}/${DATA.limits.maxTypes}枠 · 取得9回</small></h2><ul class="pv-owned">${OWNED_BUILD.map(([id, lv]) => render.row(ownedView(id, lv), ICONS)).join("")}${emptySlot("row")}</ul>
      <div class="pv-fusion-list"><h3>融合条件</h3><span class="pv-rule">融合元の能力をレベルMAXで融合可能。1枠空く</span>${DATA.fusionIds.map((f) => `<p>${esc(nameOf(f))}＝${S.discovered.has(f) ? materialsOf(f).map(nameOf).map(esc).join(" × ") : "？？ × ？？"}</p>`).join("")}</div></section>
      <div class="pv-pause-actions">${btn("pv-settings", "設定・操作")}${btn("pv-title", "タイトルへ")}</div></section>`;
  }

  /* ---------- 場面4：比較表 ---------- */
  function compareScene() {
    const affinityCards = [
      "blast-core",
      "armor-piercer",
      "afterimage-mine",
      "magazine",
      "sample-fire",
      "sample-ice",
      "sample-lightning",
      "sample-curse",
      "sample-wind",
    ];
    const shotCards = [
      "sample-fire-split",
      "sample-ice-rear",
      "sample-wind-sides",
      "sample-lightning-clone",
    ];
    const kinds = ["basic", "deck", "fusion"];
    const kindLabel = {
      basic: "基礎（銀・角1つ欠け）",
      deck: "デッキ選択（青・対角の欠け）",
      fusion: "融合（金・二重線と四隅金具）",
    };
    const same = (id, owned) =>
      `<div class="pv-same"><div class="pv-same-l">${render.L(offerView(id, owned), ICONS)}</div><div class="pv-same-small"><div class="pv-cell-label">M デッキ編集</div>${render.M(view(id, { deck: "in" }), ICONS)}<div class="pv-cell-label">row 取得一覧</div><ul class="pv-owned pv-owned-1">${render.row(ownedView(id, owned || 1), ICONS)}</ul><div class="pv-cell-label">S 戦闘HUD</div><div class="pv-strip">${render.S(ownedView(id, owned || 1), ICONS)}</div></div></div>`;
    return `<section class="pv-compare">
      <h1>生存カード 比較表 <small>枠＝表示分類（仮） · 紋章と図柄＝系統・属性 · 矢印チップ＝射撃方式 · 丸＝段階 · 四角チェック＝候補（デッキ）</small></h1>
      <h2>1. 同じカードを各場面で</h2><div class="pv-row">${same("fuse", 1)}${same("fusion-collapse", 0)}${same("magazine", 2)}</div>
      <h2>2. 表示分類（仮） <small>同じ仮例カードを3種類の枠で。強さの等級ではない</small></h2>
      <div class="pv-row pv-kinds">${kinds.map((k) => `<div class="pv-kind-col"><div class="pv-cell-label">${kindLabel[k]}</div><div class="pv-l-box">${render.L(offerView("sample-fire", 0, { kind: k, acquisition: k === "fusion" ? "fusion-new" : "new" }), ICONS)}</div>${render.M(view("sample-fire", { kind: k, deck: "in" }), ICONS)}<div class="pv-strip">${render.S(ownedView("sample-fire", 1), ICONS).replace(/data-kind="\w+"/, `data-kind="${k}"`)}</div></div>`).join("")}</div>
      <h2>3. 系統（現行） と 属性（仮例） <small>色に加えて紋章の形と文字で区別</small></h2><div class="pv-grid pv-grid-wide">${affinityCards.map((id) => render.M(view(id, { deck: "out" }), ICONS)).join("")}</div>
      <h2>4. 射撃方式（仮例） <small>属性と別の四角いチップ。中央の点＝自分、矢印＝弾の向き</small></h2>
      <div class="pv-shot-legend">${Object.entries(SAMPLES.shots)
        .map(
          ([k, l]) =>
            `<span class="sc-shot" data-shot="${k}">${svg(SHOT[k], "sc-shot-glyph")}<span>${l}</span></span>`,
        )
        .join("")}</div>
      <div class="pv-grid pv-grid-wide">${shotCards.map((id) => render.M(view(id, { deck: "out" }), ICONS)).join("")}</div>
      <h2>5. 状態 <small>基地の「候補（デッキ）」は四角いチェック、作戦中の「取得」は丸い段階</small></h2>
      <h3>基地・デッキ編集（M）</h3><div class="pv-grid pv-grid-wide pv-states">${[
        ["未選択", view("ricochet", { deck: "out" })],
        ["候補に入れた", view("ricochet", { deck: "in" })],
        ["詳細表示中", view("ricochet", { deck: "in", inspecting: true })],
        [
          "未解放",
          view("power-cell", { deck: "out", locked: "攻略4クリアで解放" }),
        ],
        ["融合 未発見", view("fusion-aegis", { undiscovered: true })],
        [
          "融合 素材1/2",
          view("fusion-collapse", { fusionProgress: "素材 1/2" }),
        ],
        [
          "融合 狙える",
          view("fusion-counter", { fusionProgress: "素材 2/2 · 狙える" }),
        ],
        ["長い名前（仮例）", view("sample-long", { deck: "in" })],
      ]
        .map(
          ([l, v]) =>
            `<div><div class="pv-cell-label">${l}</div>${render.M(v, ICONS)}</div>`,
        )
        .join("")}</div>
      <h3>プレイ中の3択（L）</h3><div class="pv-row pv-l-states">${[
        ["新規獲得", offerView("ricochet", 0)],
        ["段階アップ", offerView("ricochet", 2)],
        ["融合進化", offerView("fusion-counter", 0)],
        ["決定（選んだ直後）", offerView("magnet", 0, { state: "picked" })],
        ["選ばれなかった", offerView("reload", 1, { state: "dismissed" })],
        [
          "選択不可（仮）",
          offerView("interceptor", 0, {
            state: "disabled",
            reason: "選べない理由をここに表示",
          }),
        ],
      ]
        .map(
          ([l, v]) =>
            `<div class="pv-l-box"><div class="pv-cell-label">${l}</div>${render.L(v, ICONS)}</div>`,
        )
        .join("")}</div>
      <h3>取得済み（row・S）</h3><div class="pv-row"><ul class="pv-owned pv-owned-3">${render.row(ownedView("line-shot", 1), ICONS)}${render.row(ownedView("line-shot", 3), ICONS)}${render.row(ownedView("fusion-magazine", 2), ICONS)}</ul><div class="pv-strip">${render.S(ownedView("line-shot", 1), ICONS)}${render.S(ownedView("line-shot", 3), ICONS)}${render.S(ownedView("fusion-magazine", 2), ICONS)}${emptySlot("S")}</div></div>
    </section>`;
  }

  /* ---------- 操作パネル（プレビュー専用） ---------- */
  function controls() {
    if (!S.ui) return "";
    const scenes = [
      ["base", "基地・デッキ編集"],
      ["run", "プレイ中の3択"],
      ["hud", "戦闘HUD"],
      ["owned", "一時停止の一覧"],
      ["compare", "比較表"],
    ];
    return `<details class="pv-controls"><summary aria-label="プレビュー操作">表示</summary><div class="pv-controls-body">
      <div class="pv-ctl-group">${scenes.map(([k, l]) => `<button type="button" data-scene="${k}" aria-pressed="${S.scene === k}">${l}</button>`).join("")}</div>
      <label>3択の例 <select id="pv-case">${Object.entries(RUN_CASES)
        .map(
          ([k, c]) =>
            `<option value="${k}" ${S.runCase === k ? "selected" : ""}>${c.label}</option>`,
        )
        .join("")}</select></label>
      <label>表示分類の仮割当 <select id="pv-kinds"><option value="family" ${S.kinds === "family" ? "selected" : ""}>補強＝基礎・他＝デッキ</option><option value="deck" ${S.kinds === "deck" ? "selected" : ""}>すべてデッキ</option><option value="basic" ${S.kinds === "basic" ? "selected" : ""}>すべて基礎</option></select></label>
      <label class="pv-ctl-check"><input type="checkbox" id="pv-reduce" ${S.reduce ? "checked" : ""}> 動きを減らす</label>
      <p>表示分類・属性・射撃方式・「仮例」カードはデザイン用の仮置きです。</p></div></details>`;
  }

  /* ---------- 描画と操作 ---------- */
  const app = document.getElementById("app");
  function paint() {
    document.documentElement.dataset.menuReducedMotion = S.reduce
      ? "true"
      : "false";
    document.body.dataset.scene = S.scene;
    const scene =
      {
        base: baseScene,
        run: runScene,
        hud: hudScene,
        owned: ownedScene,
        compare: compareScene,
      }[S.scene] || baseScene;
    const scroll = app.querySelector(".pv-grid")?.scrollTop ?? 0;
    app.innerHTML = scene() + controls();
    const grid = app.querySelector(".pv-base .pv-grid");
    if (grid) grid.scrollTop = scroll;
    if (CFG.syncUrl === false) return;
    const url = new URL(location.href);
    url.searchParams.set("scene", S.scene);
    if (S.scene === "run") url.searchParams.set("case", S.runCase);
    if (S.scene === "base") url.searchParams.set("tab", S.tab);
    history.replaceState(null, "", url);
  }
  app.addEventListener("click", (e) => {
    // body にも data-scene があるので、ボタン以外（「表示」の開閉など）を拾わないよう button に限る。
    const t = e.target.closest("button");
    if (!t || !app.contains(t)) return;
    if (t.dataset.scene) {
      S.scene = t.dataset.scene;
      S.picked = null;
      paint();
      return;
    }
    if (t.dataset.tab) {
      S.tab = t.dataset.tab;
      S.inspect = {
        upgrades: "blast-core",
        fusions: "fusion-collapse",
        samples: "sample-fire",
      }[S.tab];
      paint();
      return;
    }
    if (t.dataset.pool) {
      const id = t.dataset.pool;
      S.inspect = id;
      if (t.getAttribute("aria-disabled") === "true") {
        paint();
        return;
      }
      const pool = real.get(id) ? S.pool : S.samplePool;
      pool.has(id) ? pool.delete(id) : pool.add(id);
      paint();
      app
        .querySelector(`[data-pool="${CSS.escape(id)}"]`)
        ?.focus({ preventScroll: true });
      return;
    }
    if (t.dataset.inspect) {
      S.inspect = t.dataset.inspect;
      paint();
      app
        .querySelector(`.pv-grid [data-inspect="${CSS.escape(S.inspect)}"]`)
        ?.focus({ preventScroll: true });
      return;
    }
    if (t.dataset.add) {
      const pool = real.get(t.dataset.add) ? S.pool : S.samplePool;
      materialsOf(t.dataset.add).forEach((m) => pool.add(m));
      paint();
      return;
    }
    if (t.dataset.card && S.scene === "run") {
      const i = [...app.querySelectorAll(".pv-cards [data-card]")].indexOf(t);
      if (t.disabled || S.picked != null) return;
      S.picked = i;
      paint();
      setTimeout(() => {
        if (S.scene === "run") {
          S.picked = null;
          paint();
        }
      }, 1600);
      return;
    }
    if (t.id === "pv-owned-open")
      app.querySelector("#pv-owned-dialog").showModal();
    if (t.id === "pv-owned-close")
      app.querySelector("#pv-owned-dialog").close();
  });
  app.addEventListener("change", (e) => {
    if (e.target.id === "pv-case") {
      S.runCase = e.target.value;
      S.scene = "run";
      S.picked = null;
    }
    if (e.target.id === "pv-kinds") S.kinds = e.target.value;
    if (e.target.id === "pv-reduce") S.reduce = e.target.checked;
    const open = app.querySelector(".pv-controls")?.open;
    paint();
    if (open) app.querySelector(".pv-controls").open = true;
  });
  paint();
})();
