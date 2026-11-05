/**
 * バディUIのプレビュー。製品モジュール src/client/buddy-ui.ts を、実際のゲームCSSと
 * 基地画面のヘッダー構造（playtest-app.ts の header()）の中で表示する。
 * 下の stub は場面を再現するための見本で、抽選・育成・保存の実装ではない。
 * 製品では主担当の applyBuddyAction と保存データへ接続する（HANDOFF.md）。
 * URL: ?scene=<SCENES のキー>&motion=reduce&sound=0
 */
import "../../src/style.css";
import "../../src/mobile-ui.css";
import "../../src/menu-ui.css";
import "../../src/menu-theme.css";
import "../../src/client/playtest.css";
import "../../src/client/resource-frame.css";
import "./preview.css";
import {
  mountBuddyMenu,
  createBuddySkillButton,
  BUDDY_SKILL_PLACEMENT,
  type BuddyCatalogItem,
  type BuddyGrowthView,
  type BuddyUiState,
  type BuddyUiActions,
  type BuddyMenu,
  type BuddyTab,
  type BuddySkillView,
} from "../../src/client/buddy-ui";
import {
  defaultLayout,
  resolveLayout,
  arena,
  placeControls,
  readInsets,
  type Layout,
} from "../../src/client/layout";

const PORTRAIT = `${import.meta.env.BASE_URL}assets/buddy/portraits/`;
// 固有スキルの数値は依頼正本（BUDDY-CLAUDE-DESIGN-HANDOFF-20261105.md）の値。スキル名は未決のため役割名を表示。
const CATALOG: BuddyCatalogItem[] = [
  {
    id: "tatara",
    name: "タタラ",
    element: "fire",
    elementLabel: "火炎",
    role: "攻撃",
    skillName: "範囲攻撃",
    skillText: "周囲半径4mの敵へ爆発ダメージ。",
    cooldown: 20,
    portrait: `${PORTRAIT}tatara.webp`,
  },
  {
    id: "yosuga",
    name: "ヨスガ",
    element: "wind",
    elementLabel: "風",
    role: "回復",
    skillName: "自己回復",
    skillText: "持ち主のHPを5秒かけて最大HPの25%回復。",
    cooldown: 25,
    portrait: `${PORTRAIT}yosuga.webp`,
  },
  {
    id: "tobari",
    name: "トバリ",
    element: "ice",
    elementLabel: "氷結",
    role: "防御",
    skillName: "防御",
    skillText: "持ち主から5m内の味方の被ダメージを6秒間30%軽減。",
    cooldown: 25,
    portrait: `${PORTRAIT}tobari.webp`,
  },
  {
    id: "oriha",
    name: "オリハ",
    element: "lightning",
    elementLabel: "電撃",
    role: "強化",
    skillName: "身体強化",
    skillText: "持ち主から5m内の味方を6秒間、移動+20%・回避の再使用−20%。",
    cooldown: 25,
    portrait: `${PORTRAIT}oriha.webp`,
  },
];
// 主担当の現行値（buddy-progression.ts の BUDDY_LEVEL_CAPS・BUDDY_BREAKTHROUGH_COSTS）を写した見本。
const CAPS = [10, 20, 30, 40];
const COSTS = [3, 6, 10];
const xpFor = (lv: number) => 20 * (lv - 1) ** 2;
function growth(
  level: number,
  breakthrough: number,
  extraXp = 0,
): BuddyGrowthView {
  const cap = CAPS[breakthrough];
  const atCap = level >= cap;
  return {
    level,
    levelCap: cap,
    xpIntoLevel: atCap ? 0 : extraXp,
    xpForNext: atCap ? null : xpFor(level + 1) - xpFor(level),
    breakthrough,
    breakthroughMax: COSTS.length,
    nextLevelCap: breakthrough < COSTS.length ? CAPS[breakthrough + 1] : null,
    breakthroughCost: breakthrough < COSTS.length ? COSTS[breakthrough] : null,
  };
}
function oddsFor(s: Pick<BuddyUiState, "owned">, guaranteed: boolean) {
  const pool = guaranteed ? CATALOG.filter((c) => !s.owned[c.id]) : CATALOG;
  return CATALOG.map((c) => ({
    id: c.id,
    percent: pool.includes(c) ? 100 / pool.length : 0,
  })).filter((o) => o.percent > 0);
}
function base(over: Partial<BuddyUiState> = {}): BuddyUiState {
  const s: BuddyUiState = {
    catalog: CATALOG,
    owned: { tatara: growth(7, 0, 120), tobari: growth(10, 0) },
    selected: "tatara",
    starterChosen: true,
    tickets: 3,
    fragments: 2,
    recruit: {
      ticketCost: 1,
      odds: [],
      pityCount: 2,
      pityThreshold: 4,
      guaranteedNext: false,
      duplicateFragments: 1,
      firstClearTickets: 2,
      repeatUnits: 1,
      repeatUnitsPerTicket: 3,
      provisional: ["難度別の反復報酬", "全員所持後の保証の扱い"],
    },
    ...over,
  };
  if (!over.recruit) s.recruit.odds = oddsFor(s, s.recruit.guaranteedNext);
  return s;
}

interface Scene {
  label: string;
  tab?: BuddyTab;
  focus?: string;
  state: () => BuddyUiState;
  /** stub の挙動 */
  delay?: number;
  fail?: "draw" | "breakthrough" | "equip" | "starter";
  forceDraw?: { buddyId: string };
  autoDraw?: boolean;
  hud?: boolean;
}
const recruitWith = (over: Partial<BuddyUiState["recruit"]>, s = base()) => ({
  ...s,
  recruit: { ...s.recruit, ...over },
});
const SCENES: Record<string, Scene> = {
  starter: {
    label: "初回の1体選択",
    state: () =>
      base({
        owned: {},
        selected: null,
        starterChosen: false,
        tickets: 0,
        fragments: 0,
      }),
  },
  roster: { label: "編成・育成", state: () => base() },
  "roster-cap": {
    label: "上限到達・突破可",
    focus: "tobari",
    state: () => base({ fragments: 4 }),
  },
  "roster-short": {
    label: "突破素材不足",
    focus: "tobari",
    state: () => base({ fragments: 1 }),
  },
  "roster-max": {
    label: "最大突破",
    focus: "tatara",
    state: () =>
      base({ owned: { tatara: growth(40, 3), tobari: growth(10, 0) } }),
  },
  "roster-unowned": {
    label: "未所持の詳細",
    focus: "oriha",
    state: () => base(),
  },
  recruit: { label: "招集", tab: "recruit", state: () => base() },
  "recruit-short": {
    label: "チケット不足",
    tab: "recruit",
    state: () => base({ tickets: 0 }),
  },
  "recruit-guarantee": {
    label: "次は未所持保証",
    tab: "recruit",
    state: () => {
      const s = base();
      return recruitWith(
        { pityCount: 4, guaranteedNext: true, odds: oddsFor(s, true) },
        s,
      );
    },
  },
  "recruit-all": {
    label: "全員所持",
    tab: "recruit",
    state: () => {
      const s = base({
        owned: {
          tatara: growth(12, 1),
          yosuga: growth(5, 0),
          tobari: growth(10, 0),
          oriha: growth(3, 0),
        },
      });
      return recruitWith({ pityCount: 0, odds: oddsFor(s, false) }, s);
    },
  },
  "recruit-busy": {
    label: "招集の処理中",
    tab: "recruit",
    delay: 60000,
    autoDraw: true,
    state: () => base(),
  },
  "result-new": {
    label: "結果：新規",
    tab: "recruit",
    autoDraw: true,
    forceDraw: { buddyId: "oriha" },
    state: () => base(),
  },
  "result-dup": {
    label: "結果：被り",
    tab: "recruit",
    autoDraw: true,
    forceDraw: { buddyId: "tatara" },
    state: () => base(),
  },
  "save-fail": {
    label: "保存失敗と再試行",
    tab: "recruit",
    autoDraw: true,
    fail: "draw",
    state: () => base(),
  },
  missing: {
    label: "データ欠損",
    state: () => {
      const s = base();
      return {
        ...s,
        catalog: s.catalog.map((c) =>
          c.id === "yosuga"
            ? { ...c, portrait: "missing.webp" }
            : c.id === "oriha"
              ? { ...c, portrait: null }
              : c,
        ),
        recruit: { ...s.recruit, odds: [] },
      };
    },
  },
  locked: {
    label: "出撃中は変更不可",
    state: () =>
      base({
        locked: "出撃中はバディを変更できません。基地で変更してください。",
      }),
  },
  hud: { label: "戦闘HUD", hud: true, state: () => base() },
};

const params = new URLSearchParams(location.search);
const sceneKey = SCENES[params.get("scene") ?? ""]
  ? params.get("scene")!
  : "roster";
const scene = SCENES[sceneKey];
const showUi = params.get("ui") !== "0";
document.documentElement.dataset.menuReducedMotion = String(
  params.get("motion") === "reduce",
);
const soundOn = params.get("sound") !== "0";
const soundLog: string[] = [];
(window as unknown as { __buddySounds: string[] }).__buddySounds = soundLog;

/* ---------- 見本の操作（stub。製品では applyBuddyAction へ） ---------- */
let state = scene.state();
let failOnce = scene.fail;
let seq = 0;
// 検査用：招集に渡された要求ID（保存失敗後の再試行が同じIDかを確かめる）。
const drawIds: string[] = [];
(window as unknown as { __drawIds: string[] }).__drawIds = drawIds;
const wait = <T>(v: () => T) =>
  new Promise<T>((ok, ng) =>
    setTimeout(() => {
      try {
        ok(v());
      } catch (e) {
        ng(e);
      }
    }, scene.delay ?? 450),
  );
const failIf = (kind: Scene["fail"]) => {
  if (failOnce === kind) {
    failOnce = undefined;
    throw Error(
      "QuotaExceededError: 端末の保存領域に書き込めませんでした（プレビューの再現）",
    );
  }
};
const actions: BuddyUiActions = {
  requestId: () => `preview-${Date.now().toString(36)}-${seq++}`,
  sound: (cue) => {
    if (soundOn) soundLog.push(cue);
    const log = document.querySelector("#pv-sound");
    if (log)
      log.textContent = soundOn ? `SE: ${cue}` : "SE: 音量0（再生しない）";
  },
  chooseStarter: (id) =>
    wait(() => {
      failIf("starter");
      state = base({
        owned: { [id]: growth(1, 0) },
        selected: id,
        starterChosen: true,
        tickets: 0,
        fragments: 0,
      });
      return state;
    }),
  equip: (id) =>
    wait(() => {
      failIf("equip");
      state = { ...state, selected: id };
      return state;
    }),
  breakthrough: (id) =>
    wait(() => {
      failIf("breakthrough");
      const g = state.owned[id]!;
      const b = g.breakthrough + 1;
      state = {
        ...state,
        fragments: state.fragments - (g.breakthroughCost ?? 0),
        owned: { ...state.owned, [id]: growth(g.level, b) },
      };
      return state;
    }),
  draw: (requestId) => (
    drawIds.push(requestId),
    wait(() => {
      failIf("draw");
      const pool = state.recruit.odds.map((o) => o.id);
      const buddyId =
        scene.forceDraw?.buddyId ??
        pool[Math.floor(Math.random() * pool.length)];
      const duplicate = !!state.owned[buddyId];
      const owned = duplicate
        ? state.owned
        : { ...state.owned, [buddyId]: growth(1, 0) };
      const next = base({
        owned,
        selected: state.selected,
        tickets: state.tickets - state.recruit.ticketCost,
        fragments:
          state.fragments + (duplicate ? state.recruit.duplicateFragments : 0),
      });
      next.recruit.pityCount = duplicate
        ? Math.min(4, state.recruit.pityCount + 1)
        : 0;
      state = next;
      return {
        state: next,
        outcome: {
          buddyId,
          duplicate,
          guaranteed: state.recruit.guaranteedNext,
          fragmentsGained: duplicate ? next.recruit.duplicateFragments : 0,
        },
      };
    })
  ),
};

/* ---------- 基地画面の枠（header() と同じ構造） ---------- */
const ui = document.getElementById("ui")!;
let menu: BuddyMenu | null = null;
function mountMenu() {
  ui.innerHTML = `<section class="panel armory menu-screen pt-screen pt-buddy-screen"><header class="menu-header"><div><div class="eyebrow">BUDDY</div><h1>バディ</h1></div><nav><button id="pt-gear">出撃準備</button><button id="pt-base">基地</button><button id="pt-home">タイトルへ</button></nav></header><p class="pt-status" role="status"></p><div class="pt-buddy"></div></section>`;
  menu = mountBuddyMenu(ui.querySelector(".pt-buddy")!, state, actions, {
    tab: scene.tab,
    focus: scene.focus,
  });
  if (scene.autoDraw)
    queueMicrotask(() =>
      menu!.root.querySelector<HTMLButtonElement>("[data-bd=draw]")?.click(),
    );
}

/* ---------- 戦闘HUD（製品と同じ #controls の構造と共有CSSの上に固有スキルを置く） ---------- */
function mountHud() {
  document.body.dataset.screen = "battle";
  ui.hidden = true;
  const hud = document.getElementById("pv-hud")!;
  hud.hidden = false;
  hud.innerHTML = `<div class="pv-hud-top">HUD（既存・高さ88px）</div><div class="pv-aim" aria-hidden="true"></div>`;
  // index.html の #controls と同じ要素。位置は layout.ts の placeControls（実コード）で決める。
  const wrap = document.createElement("div");
  wrap.innerHTML = `<div id="controls"><div id="move" aria-label="移動スティック"><span></span></div><div id="look" aria-label="視点操作"></div><button id="fire">射撃</button><button id="dodge">回避</button><button id="reload">装填</button><button id="swap">切替</button><button id="revive">蘇生</button><button id="scope" type="button" aria-label="スコープ" aria-pressed="false" hidden>スコープ</button></div><button id="pause" class="pv-pause" type="button">Ⅱ</button>`;
  document.body.append(...wrap.childNodes);
  const controlsEl = document.getElementById("controls")!;
  const layout: Layout = defaultLayout();
  const skill = createBuddySkillButton({
    onActivate: () => {
      remaining = CATALOG[0].cooldown;
      active = 1.2;
      actions.sound?.("menu");
    },
    sound: (c) => actions.sound?.(c),
    keyHint: "V",
  });
  controlsEl.append(skill.element);
  const place = () => {
    placeControls(layout);
    // 主担当が CONTROL_IDS に "buddy" を足した場合と同じ計算（resolveLayout と同式）で置く。
    const a = arena(innerWidth, innerHeight, readInsets());
    const scale = Math.max(
      0.85,
      Math.min(1.15, innerWidth / 900, innerHeight / 400),
    );
    const size = Math.min(
      a.height,
      a.width,
      Math.max(44, 56 * BUDDY_SKILL_PLACEMENT.size * scale),
    );
    const x = Math.max(
      size / 2,
      Math.min(a.width - size / 2, BUDDY_SKILL_PLACEMENT.x * a.width),
    );
    const y = Math.max(
      size / 2,
      Math.min(a.height - size / 2, BUDDY_SKILL_PLACEMENT.y * a.height),
    );
    Object.assign(skill.element.style, {
      left: `${a.left + x - size / 2}px`,
      top: `${a.top + y - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      opacity: String(layout.opacity),
    });
  };
  let remaining = 0;
  let active = 0;
  const startAt = params.get("cd");
  if (startAt) remaining = Number(startAt);
  const hiddenView = params.get("none") === "1";
  const view = (): BuddySkillView | null =>
    hiddenView
      ? null
      : {
          id: "tatara",
          name: "タタラ",
          element: "fire",
          skillName: "範囲攻撃",
          cooldown: CATALOG[0].cooldown,
          remaining,
          activeRemaining: active,
          unavailable:
            params.get("unavailable") === "1" ? "表示できない位置" : null,
        };
  skill.update(view());
  place();
  addEventListener("resize", place);
  let last = performance.now();
  const freeze = params.get("freeze") === "1";
  const tick = (t: number) => {
    const dt = (t - last) / 1000;
    last = t;
    if (!freeze) {
      remaining = Math.max(0, remaining - dt);
      active = Math.max(0, active - dt);
    }
    skill.update(view());
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  (window as unknown as { __buddyHud: unknown }).__buddyHud = {
    rects: () => [
      ...resolveLayout(layout, innerWidth, innerHeight, readInsets()),
      (() => {
        const r = skill.element.getBoundingClientRect();
        return { id: "buddy", left: r.left, top: r.top, size: r.width };
      })(),
    ],
  };
}
/* ---------- プレビューの場面切替（ゲーム画面には含めない） ---------- */
function controls() {
  if (!showUi) return;
  const box = document.createElement("details");
  box.className = "pv-controls";
  box.innerHTML = `<summary aria-label="プレビュー操作">表示</summary><div class="pv-controls-body"><label>場面 <select id="pv-scene">${Object.entries(
    SCENES,
  )
    .map(
      ([k, s]) =>
        `<option value="${k}" ${k === sceneKey ? "selected" : ""}>${s.label}</option>`,
    )
    .join(
      "",
    )}</select></label><label class="pv-check"><input type="checkbox" id="pv-reduce" ${params.get("motion") === "reduce" ? "checked" : ""}> 動きを減らす</label><label class="pv-check"><input type="checkbox" id="pv-mute" ${soundOn ? "" : "checked"}> 音量0</label><p id="pv-sound">SE: —</p><p>見本データ。抽選・保存は再現用のstubです。</p></div>`;
  document.body.append(box);
  const go = (k: string, v: string | null) => {
    const u = new URL(location.href);
    if (v === null) u.searchParams.delete(k);
    else u.searchParams.set(k, v);
    location.href = u.href;
  };
  box.querySelector<HTMLSelectElement>("#pv-scene")!.onchange = (e) =>
    go("scene", (e.target as HTMLSelectElement).value);
  box.querySelector<HTMLInputElement>("#pv-reduce")!.onchange = (e) =>
    go("motion", (e.target as HTMLInputElement).checked ? "reduce" : null);
  box.querySelector<HTMLInputElement>("#pv-mute")!.onchange = (e) =>
    go("sound", (e.target as HTMLInputElement).checked ? "0" : null);
}

if (scene.hud) mountHud();
else mountMenu();
controls();
