import type { Sound } from "../audio";
import { homeMarkup } from "../home-screen";
import { gearWeaponRows, lockMarkup } from "../gear-weapon-list";
import { growthMarkup, bindGrowthUI } from "../growth-ui";
import { openFrontBase } from "../front-base";
import { openWeaponWorkshop } from "../weapon-workshop-ui";
import {
  newSaveKey,
  validateProgress,
  weaponProtected,
  type ProgressSave,
} from "../progression-save";
import { FRONT_PROGRESS_KEY, emptyFrontProgress } from "../front-progress";
import { FRONT_FUSION_DISCOVERY_KEY } from "../front-fusion-discovery";
import {
  frontUpgradeCardMarkup,
  frontUpgradeDetails,
} from "../front-upgrade-ui";
import {
  FRONT_FUSION_IDS,
  FRONT_UPGRADE_CATALOG,
  type FrontUpgradeId,
} from "../../shared/front-upgrades";
import { STAGES, MAPS } from "../../shared/stages";
import { WEAPONS, stats } from "../../shared/defs";
import { SKILLS, weaponGrade, type Skill } from "../../shared/progression";
import {
  ENEMY_REPORT_NAMES,
  type EnemyReportId,
} from "../../shared/enemy-identity";
import { ENEMY_REPORT_ORDER } from "../../shared/enemy-report-order";
import { ENCOUNTER_FILM_FILES } from "../encounter-film-files";
import { ANOMALY_VOICE_PROFILES, ANOMALY_VOICE_PATH } from "../anomaly-voice";
import { createEnemyViewer } from "../enemy-viewer";
import {
  mockProgress,
  mockUpgrades,
  MOCK_ROOMS,
  MOCK_ENEMY_NOTES,
} from "./fixtures";
import "./menus.css";

export interface MockMenuActions {
  openScreen(id: string): void;
  startBattle(scene: "training" | "skirmish" | "boss" | "dense"): void;
  openSettings(): void;
  openLayout(): void;
  resume(): void;
  /** Set only when a real mock battle ended; rewards stay demo values. */
  battleResult(): MockBattleResult | undefined;
  pvBack(): string;
  read<T>(key: string, fallback: T): T;
  write(key: string, value: unknown): boolean;
  sound: Sound;
}

export interface MockBattleResult {
  victory: boolean;
  scene: string;
  kills: number;
  time: number;
}

export const SCREEN_CATALOG: readonly {
  id: string;
  label: string;
  group: string;
}[] = [
  { id: "home", label: "タイトル", group: "開始・出撃" },
  { id: "start", label: "初回開始", group: "開始・出撃" },
  { id: "name", label: "隊員名", group: "開始・出撃" },
  { id: "mode", label: "モード選択", group: "開始・出撃" },
  { id: "operations", label: "作戦選択", group: "開始・出撃" },
  { id: "gear", label: "出撃準備・装備", group: "基地・装備" },
  { id: "gear-organize", label: "武器の整理", group: "基地・装備" },
  { id: "gear-detail", label: "武器の詳細", group: "基地・装備" },
  { id: "base", label: "基地", group: "基地・装備" },
  { id: "decks", label: "強化・デッキ編成", group: "基地・装備" },
  { id: "soldier", label: "兵士・育成", group: "基地・装備" },
  { id: "accessories", label: "装身具", group: "基地・装備" },
  { id: "armory", label: "武器庫", group: "基地・装備" },
  { id: "workshop", label: "武器工房", group: "基地・装備" },
  { id: "rooms", label: "協力の部屋一覧", group: "協力デモ" },
  { id: "lobby", label: "部隊ロビー", group: "協力デモ" },
  { id: "chat", label: "部隊チャット", group: "協力デモ" },
  { id: "invite", label: "招待", group: "協力デモ" },
  { id: "upgrade", label: "強化3択", group: "戦闘・結果" },
  { id: "upgrades", label: "現在の強化", group: "戦闘・結果" },
  { id: "pause", label: "一時停止", group: "戦闘・結果" },
  { id: "leave", label: "離脱確認", group: "戦闘・結果" },
  { id: "recovery", label: "戦利品回収", group: "戦闘・結果" },
  { id: "result", label: "作戦結果", group: "戦闘・結果" },
  { id: "weekly", label: "週任務", group: "任務・保存" },
  { id: "save-error", label: "保存失敗", group: "任務・保存" },
  { id: "restore", label: "保存の復旧", group: "任務・保存" },
  { id: "cloud", label: "クラウド比較", group: "任務・保存" },
  { id: "bestiary", label: "図鑑・3D・モーション", group: "資料・映像" },
  { id: "voices", label: "異構体の声", group: "資料・映像" },
  { id: "encounter", label: "会敵ムービー", group: "資料・映像" },
  { id: "pv", label: "PV", group: "資料・映像" },
  { id: "tutorial", label: "操作ガイド", group: "資料・映像" },
  { id: "changelog", label: "更新履歴", group: "資料・映像" },
];

const esc = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const button = (id: string, text: string, primary = false) =>
  `<button data-screen="${id}"${primary ? ' class="primary"' : ""}>${text}</button>`;
const base = import.meta.env.BASE_URL;

/** Only this adapter is passed to reusable screens. Their keys remain under the mock namespace. */
function menuStorage(actions: MockMenuActions) {
  const defaults: Record<string, string> = {
    [newSaveKey("normal")]: JSON.stringify(mockProgress()),
    [FRONT_PROGRESS_KEY]: JSON.stringify({
      ...emptyFrontProgress(),
      wins: 8,
      runs: 12,
      credits: 480,
    }),
    [FRONT_FUSION_DISCOVERY_KEY]: JSON.stringify({
      version: 1,
      ids: [...FRONT_FUSION_IDS],
    }),
  };
  return {
    getItem: (key: string) =>
      actions.read<string | null>(`menu-storage:${key}`, defaults[key] ?? null),
    setItem(key: string, value: string) {
      if (!actions.write(`menu-storage:${key}`, value))
        throw new Error("モック専用データを保存できませんでした。");
    },
  };
}

export function mountMockMenu(
  root: HTMLElement,
  screen: string,
  actions: MockMenuActions,
): () => void {
  const storage = menuStorage(actions);
  const disposers: (() => void)[] = [];
  let disposed = false;
  let save: ProgressSave;
  try {
    save = validateProgress(JSON.parse(storage.getItem(newSaveKey("normal"))!));
  } catch {
    save = mockProgress();
  }
  const currentSoldier = () =>
    save.soldiers.find((s) => s.id === save.selectedSoldier)!;
  const status = (text: string) => {
    const node = root.querySelector<HTMLElement>("[data-menu-status]");
    if (node) node.textContent = text;
  };
  const saveProgress = () => {
    try {
      storage.setItem(newSaveKey("normal"), JSON.stringify(save));
      return true;
    } catch {
      status(
        "モック専用の保存に失敗しました。操作中の内容はこの画面に保持しています。",
      );
      return false;
    }
  };
  const shell = (title: string, content: string, back = "home", nav = "") => {
    root.innerHTML = `<section class="panel menu-screen pt-screen mock-menu mock-${screen}" aria-label="${esc(title)}"><header class="menu-header"><h1>${title}</h1><nav>${nav}${button(back, "戻る")}</nav></header>${content}<p class="mock-menu-status" data-menu-status role="status"></p></section>`;
  };
  const on = (
    selector: string,
    callback: (event: Event) => void,
    event = "click",
  ) =>
    root
      .querySelectorAll<HTMLElement>(selector)
      .forEach((node) => node.addEventListener(event, callback));
  const selectedStage = Math.min(
    STAGES.length - 1,
    Math.max(0, actions.read("selected-stage", 0)),
  );
  const selectedWeapon = () =>
    save.inventory.find((w) => w.id === actions.read("selected-weapon", "")) ??
    save.inventory[0];

  const click = (event: Event) => {
    const target = (event.target as Element | null)?.closest<HTMLElement>(
      "[data-screen], [data-battle], [data-menu-settings], [data-menu-layout], [data-menu-resume]",
    );
    if (!target || !root.contains(target)) return;
    if (target.dataset.screen) actions.openScreen(target.dataset.screen);
    else if (target.dataset.battle)
      actions.startBattle(
        target.dataset.battle as "training" | "skirmish" | "boss" | "dense",
      );
    else if (target.hasAttribute("data-menu-settings")) actions.openSettings();
    else if (target.hasAttribute("data-menu-layout")) actions.openLayout();
    else actions.resume();
  };
  root.addEventListener("click", click);
  disposers.push(() => root.removeEventListener("click", click));

  if (screen === "home") {
    root.innerHTML = `<div class="mock-home">${homeMarkup({ stage: STAGES[selectedStage], inventoryCount: save.inventory.length })}</div>`;
    on("#solo", () => actions.openScreen("mode"));
    on("#coop", () => actions.openScreen("rooms"));
    on("#open-armory", () => actions.openScreen("base"));
    on("#open-bestiary", () => actions.openScreen("bestiary"));
    on("#home-settings", actions.openSettings);
    on("#home-tutorial", () => actions.openScreen("tutorial"));
    on("#changelog", () => actions.openScreen("changelog"));
    root.querySelector(".home-challenges")!.innerHTML =
      button("weekly", "週任務") +
      button("start", "初回開始を見る") +
      button("catalog", "全画面カタログ");
    root.querySelector(".fine")!.textContent =
      "縦横対応モック · 架空の進行データを使います。";
  } else if (screen === "start" || screen === "name") {
    shell(
      screen === "start" ? "SWARM FRONTを始める" : "隊員名を登録",
      `<div class="mock-intro"><h2>仲間と、次の戦場へ。</h2><p>これは操作確認用のモックです。名前・装備・進行はモック専用領域に保存します。</p><form id="mock-name-form"><label>隊員名<input id="mock-player-name" maxlength="18" value="${esc(actions.read("player-name", "隊員メロ"))}" autocomplete="off" required></label><p class="fine">1〜18文字。ロビーと作戦結果に表示されます。</p><button class="primary" type="submit">登録して進む</button></form></div>`,
    );
    on(
      "#mock-name-form",
      (e) => {
        e.preventDefault();
        const name = root
          .querySelector<HTMLInputElement>("#mock-player-name")!
          .value.trim();
        if (!name) {
          status("隊員名を入力してください。");
          return;
        }
        if (actions.write("player-name", name)) actions.openScreen("mode");
        else status("名前を保存できませんでした。");
      },
      "submit",
    );
  } else if (screen === "mode") {
    shell(
      "作戦モード",
      `<div class="mock-option-grid"><button data-screen="operations"><span class="eyebrow">CAMPAIGN</span><h2>進撃</h2><p>作戦を選び、波ごとに現れる異構体を撃破。</p><small>作戦・装備を確認して出撃</small></button><button data-screen="gear"><span class="eyebrow">SURVIVAL</span><h2>生存</h2><p>強化と融合で部隊を育て、長く生き残る。</p><small>ランダムな強化3択を確認</small></button><button data-battle="training"><span class="eyebrow">TRAINING</span><h2>訓練場</h2><p>移動・照準・射撃と、縦横の操作配置を試す。</p><small>すぐに操作確認を開始</small></button></div>`,
    );
  } else if (screen === "operations") {
    let stageIndex = selectedStage;
    shell(
      "作戦を選択",
      `<div class="mock-operation-layout"><div class="mock-operation-list" role="list" aria-label="作戦一覧">${STAGES.map((stage, i) => `<button data-stage="${i}" aria-pressed="${i === stageIndex}"><span>ST${String(stage.id).padStart(2, "0")}</span><strong>${esc(stage.name)}</strong><small>${esc(MAPS[stage.map].name)}</small></button>`).join("")}</div><aside class="mock-operation-detail"></aside></div>`,
      "mode",
      button("gear", "出撃準備", true),
    );
    const showStage = () => {
      const stage = STAGES[stageIndex];
      root.querySelector(".mock-operation-detail")!.innerHTML =
        `<span class="eyebrow">STAGE ${stage.id}</span><h2>${esc(stage.name)}</h2><p>${esc(stage.brief)}</p><dl><dt>戦場</dt><dd>${esc(MAPS[stage.map].name)}</dd><dt>敵の波</dt><dd>${stage.waves.length} WAVES</dd><dt>隊員</dt><dd>${esc(actions.read("player-name", "隊員メロ"))}</dd></dl><p class="fine">攻略状況はデモ表示。出撃後は操作確認シーンへ進みます。</p>${button("gear", "この作戦の出撃準備", true)}`;
      root
        .querySelectorAll<HTMLElement>("[data-stage]")
        .forEach((b) =>
          b.setAttribute(
            "aria-pressed",
            String(Number(b.dataset.stage) === stageIndex),
          ),
        );
    };
    on("[data-stage]", (e) => {
      stageIndex = Number((e.currentTarget as HTMLElement).dataset.stage);
      actions.write("selected-stage", stageIndex);
      showStage();
    });
    showStage();
  } else if (
    ["gear", "gear-organize", "armory", "gear-detail"].includes(screen)
  ) {
    let organizing = screen === "gear-organize";
    let filter = "all";
    let slot = 0;
    const checked = new Set<string>();
    const showDetail = (id: string) => {
      const w = save.inventory.find((item) => item.id === id)!;
      const d = stats(w);
      actions.write("selected-weapon", id);
      const dialog = document.createElement("dialog");
      dialog.className = "mock-weapon-dialog";
      dialog.innerHTML = `<header><h2>${esc(WEAPONS[w.kind].name)} <small>${weaponGrade(w)}</small></h2><button data-close>閉じる</button></header><dl class="mock-stats"><dt>威力</dt><dd>${d.damage.toFixed(1)}${d.pellets > 1 ? ` × ${d.pellets}` : ""}</dd><dt>装弾数</dt><dd>${d.mag}</dd><dt>装填</dt><dd>${d.reload.toFixed(2)}秒</dd><dt>射程</dt><dd>${d.range.toFixed(1)}m</dd><dt>連射</dt><dd>${(1 / d.interval).toFixed(1)}/秒</dd><dt>特殊効果</dt><dd>${w.effect === "none" ? "なし" : esc(w.effect)}</dd></dl><p>武器を装備する枠を選んでください。</p><div class="mock-button-row"><button data-equip="0" class="primary">武器1へ装備</button><button data-equip="1">武器2へ装備</button><button data-detail-lock>${lockMarkup(save.locks.includes(id), true)}</button>${button("workshop", "工房へ")}</div><p data-detail-status role="status"></p>`;
      root.append(dialog);
      dialog.showModal();
      const close = () => {
        dialog.close();
        dialog.remove();
        drawGear();
      };
      dialog.querySelector<HTMLButtonElement>("[data-close]")!.onclick = close;
      dialog.addEventListener("cancel", (e) => {
        e.preventDefault();
        close();
      });
      dialog.querySelectorAll<HTMLButtonElement>("[data-equip]").forEach(
        (b) =>
          (b.onclick = () => {
            const equipped = currentSoldier().equipped;
            const destination = Number(b.dataset.equip);
            const other = equipped.indexOf(id);
            if (other >= 0)
              [equipped[other], equipped[destination]] = [
                equipped[destination],
                equipped[other],
              ];
            else equipped[destination] = id;
            if (saveProgress()) {
              close();
              status(
                `武器${destination + 1}に${WEAPONS[w.kind].name}を装備しました。`,
              );
            }
          }),
      );
      dialog.querySelector<HTMLButtonElement>("[data-detail-lock]")!.onclick =
        () => {
          save.locks = save.locks.includes(id)
            ? save.locks.filter((key) => key !== id)
            : [...save.locks, id];
          if (saveProgress()) {
            dialog.querySelector("[data-detail-lock]")!.innerHTML = lockMarkup(
              save.locks.includes(id),
              true,
            );
          }
        };
    };
    const drawGear = () => {
      const p = currentSoldier();
      const items =
        filter === "all"
          ? save.inventory
          : save.inventory.filter((w) => w.kind === filter);
      shell(
        screen === "armory" ? "武器庫" : "出撃準備",
        `<div class="mock-loadout-bar">${p.equipped.map((id, i) => `<button data-slot="${i}" aria-pressed="${i === slot}"><small>武器${i + 1}</small><b>${esc(WEAPONS[save.inventory.find((w) => w.id === id)!.kind].name)}</b></button>`).join("")}<label><span class="sr-only">武器種</span><select id="mock-kind"><option value="all">全武器 ${save.inventory.length}</option>${Object.entries(
          WEAPONS,
        )
          .map(
            ([kind, d]) =>
              `<option value="${kind}" ${filter === kind ? "selected" : ""}>${esc(d.name)}</option>`,
          )
          .join(
            "",
          )}</select></label><button id="mock-organize" aria-pressed="${organizing}">${organizing ? "整理を終える" : "整理"}</button>${organizing ? '<button id="mock-dismantle">選択を解体</button>' : '<button class="primary" data-battle="skirmish">出撃</button>'}</div>${gearWeaponRows(items, save, organizing, checked, organizing ? undefined : slot)}<div class="mock-gear-footer"><small>${organizing ? "装備中・ロック中は解体対象にできません。" : "武器名で詳細。名前とロックは固定、狭い画面では性能欄を横へ。"}</small>${button("workshop", "工房")}${button("soldier", "兵士")}</div>`,
        "base",
      );
      on(
        "#mock-kind",
        (e) => {
          filter = (e.currentTarget as HTMLSelectElement).value;
          drawGear();
        },
        "change",
      );
      on("#mock-organize", () => {
        organizing = !organizing;
        checked.clear();
        drawGear();
      });
      on("[data-slot]", (e) => {
        slot = Number((e.currentTarget as HTMLElement).dataset.slot);
        drawGear();
      });
      on("[data-detail], [data-pinned-detail]", (e) => {
        const b = e.currentTarget as HTMLElement;
        showDetail(b.dataset.detail ?? b.dataset.pinnedDetail!);
      });
      on("[data-lock]", (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.lock!;
        save.locks = save.locks.includes(id)
          ? save.locks.filter((key) => key !== id)
          : [...save.locks, id];
        if (saveProgress()) drawGear();
      });
      on(
        "[data-check]",
        (e) => {
          const checkbox = e.currentTarget as HTMLInputElement;
          if (checkbox.checked) checked.add(checkbox.dataset.check!);
          else checked.delete(checkbox.dataset.check!);
          status(`${checked.size}丁を選択`);
        },
        "change",
      );
      on("#mock-dismantle", () => {
        const eligible = [...checked].filter(
          (id) => !weaponProtected(save, id),
        );
        if (!eligible.length) {
          status("解体する武器にチェックを入れてください。");
          return;
        }
        save.inventory = save.inventory.filter((w) => !eligible.includes(w.id));
        save.powder += eligible.length;
        if (saveProgress()) {
          checked.clear();
          drawGear();
          status(
            `デモ：${eligible.length}丁を解体し、武装片を受け取りました。`,
          );
        }
      });
      on(".effect-help", () =>
        status(
          "特殊効果の数値は武器詳細で確認できます。今回のデモ武器は通常弾です。",
        ),
      );
    };
    drawGear();
    if (screen === "gear-detail") showDetail(selectedWeapon().id);
  } else if (screen === "base") {
    shell(
      "基地",
      `<div class="mock-wallet">功績 480 · コイン ${save.coins} · 武装片 ${save.powder} · 育成 ${save.points}pt</div><div class="mock-option-grid">${[
        ["gear", "出撃準備", "武器2枠を選び、性能を確認"],
        [
          "armory",
          "武器庫",
          `所持武器${save.inventory.length}丁・ロックと整理`,
        ],
        ["decks", "強化・デッキ", "候補を編成して融合を狙う"],
        ["soldier", "兵士の育成", "HP・照準・移動・武器切替"],
        ["accessories", "装身具", "補助効果を選択・装備"],
        ["workshop", "武器工房", "武装片で変換・改造"],
      ]
        .map(
          ([id, title, detail]) =>
            `<button data-screen="${id}"><h2>${title}</h2><p>${detail}</p></button>`,
        )
        .join("")}</div>`,
      "home",
      button("gear", "出撃準備", true),
    );
  } else if (screen === "decks") {
    openFrontBase(root, storage, () => actions.openScreen("base"));
    root.firstElementChild?.classList.add("mock-menu", "mock-decks");
  } else if (screen === "workshop") {
    openWeaponWorkshop(
      root,
      storage,
      () => actions.openScreen("armory"),
      selectedWeapon().id,
    );
    const decorate = () =>
      root.firstElementChild?.classList.add("mock-menu", "mock-workshop");
    decorate();
    // The established workshop redraws its whole root after each selection.
    const observer = new MutationObserver(decorate);
    observer.observe(root, { childList: true });
    disposers.push(() => observer.disconnect());
  } else if (screen === "soldier") {
    const p = currentSoldier();
    shell(
      "兵士の育成",
      `<div class="mock-wallet">${esc(p.name)} · 配分可能 ${save.points}pt · コイン ${save.coins}</div><div class="pt-growth">${growthMarkup(p.levels, save.unlocked, save.materials)}</div><div class="mock-button-row"><button id="pt-allocate" class="primary">配分を確定</button>${button("accessories", "装身具")}${button("gear", "装備へ")}</div>`,
      "base",
    );
    bindGrowthUI(root, p.levels, save.points, save.coins);
    on("#pt-allocate", () => {
      const levels = { ...p.levels };
      root
        .querySelectorAll<HTMLSelectElement>("[data-level]")
        .forEach((select) => {
          levels[select.dataset.level as Skill] = Number(select.value);
        });
      if (SKILLS.some((k) => levels[k] < p.levels[k])) save.coins -= 500;
      p.levels = levels;
      if (saveProgress()) actions.openScreen("soldier");
    });
  } else if (screen === "accessories") {
    const equipped = actions.read("accessory", "armor");
    shell(
      "装身具",
      `<p>兵士に1個装備。選ぶとモック専用の装備状態へ保存します。</p><div class="mock-option-grid">${[
        ["armor", "防護プレート", "最大HP +10%", "R"],
        ["focus", "照準補助レンズ", "AIM補助 +8%", "SR"],
        ["boots", "軽量ブーツ", "移動速度 +6%", "SSR"],
      ]
        .map(
          ([id, name, effect, rarity]) =>
            `<button data-accessory="${id}" aria-pressed="${equipped === id}"><small>${rarity}${equipped === id ? " · 装備中" : ""}</small><h2>${name}</h2><p>${effect}</p><strong>${equipped === id ? "装備を外す" : "装備する"}</strong></button>`,
        )
        .join(
          "",
        )}</div><p class="fine">効果と合成素材の表示はデモです。戦闘の性能には反映しません。</p>`,
      "base",
      button("soldier", "兵士"),
    );
    on("[data-accessory]", (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.accessory!;
      if (actions.write("accessory", equipped === id ? "" : id))
        actions.openScreen("accessories");
    });
  } else if (["rooms", "lobby", "chat", "invite"].includes(screen)) {
    const name = esc(actions.read("player-name", "隊員メロ"));
    if (screen === "rooms") {
      shell(
        "協力プレイ · デモ",
        `<p class="mock-demo-note">架空の部屋です。作成・参加・送信はこのモック内だけで動作します。</p><div class="room-browser-columns"><section class="room-create"><h2>部屋を作る</h2><label>部屋名<input id="mock-room-name" maxlength="24" value="縦横チェック部隊"></label><label>募集方法<select><option>公開</option><option>ID・招待のみ</option></select></label><button id="mock-room-create" class="primary">デモ部屋を作る</button></section><section class="room-browse"><header><h2>部屋を探す</h2><button id="mock-room-refresh">更新</button></header><form id="mock-room-join"><input id="mock-room-id" aria-label="デモ部屋ID" maxlength="8" placeholder="DEMO0001"><button type="submit">参加</button></form><div>${MOCK_ROOMS.map((room) => `<div class="room-list-row"><strong>${room.name}</strong><small>${room.stage} · ${room.players}/4人 · ${room.id}</small><button data-room="${room.id}">入る</button></div>`).join("")}</div></section></div>`,
      );
      on("#mock-room-refresh", () => status("デモ部屋3件を表示しました。"));
      on("#mock-room-create", () => {
        actions.write(
          "room-name",
          root
            .querySelector<HTMLInputElement>("#mock-room-name")!
            .value.trim() || "協力部隊",
        );
        actions.openScreen("lobby");
      });
      on("[data-room]", (e) => {
        actions.write(
          "room-name",
          MOCK_ROOMS.find(
            (room) => room.id === (e.currentTarget as HTMLElement).dataset.room,
          )!.name,
        );
        actions.openScreen("lobby");
      });
      on(
        "#mock-room-join",
        (e) => {
          e.preventDefault();
          const id = root
            .querySelector<HTMLInputElement>("#mock-room-id")!
            .value.trim()
            .toUpperCase();
          if (MOCK_ROOMS.some((room) => room.id === id))
            actions.openScreen("lobby");
          else status("デモ部屋ID「DEMO0001〜DEMO0003」を入力してください。");
        },
        "submit",
      );
    } else if (screen === "lobby") {
      shell(
        "部隊ロビー · デモ",
        `<div class="mock-lobby-title"><h2>${esc(actions.read("room-name", "縦横チェック部隊"))}</h2><span>DEMO0001 · 3/4人</span></div><div class="mock-squad">${[
          [name, "あなた・ホスト"],
          ["隊員アオ", "準備完了"],
          ["隊員ユキ", "装備を確認中"],
          ["参加待ち", "空き枠"],
        ]
          .map(
            ([player, state], i) =>
              `<article><span class="eyebrow">UNIT 0${i + 1}</span><h3>${player}</h3><p>${state}</p><small>${i < 3 ? "アサルトライフル / 散弾銃" : "部屋IDで招待できます"}</small></article>`,
          )
          .join(
            "",
          )}</div><div class="mock-button-row">${button("gear", "装備")}${button("chat", "チャット")}${button("invite", "招待")}<button id="mock-ready">準備完了にする</button><button class="primary" data-battle="skirmish">デモ出撃</button></div><p class="fine">架空の隊員です。出撃は単独の操作確認シーンです。</p>`,
        "rooms",
      );
      on("#mock-ready", (e) => {
        (e.currentTarget as HTMLElement).textContent = "準備完了 ✓";
        status("あなたの準備状態をデモ画面に反映しました。");
      });
    } else if (screen === "chat") {
      const messages = actions.read<string[]>("chat-messages", []);
      shell(
        "部隊チャット · デモ",
        `<div class="mock-chat-log" aria-live="polite"><p><strong>隊員アオ</strong> よろしくお願いします！</p><p><strong>隊員ユキ</strong> 装備を確認しています。</p>${messages.map((message) => `<p><strong>${name}</strong> ${esc(message)}</p>`).join("")}</div><form id="mock-chat-form"><label class="sr-only" for="mock-chat-message">メッセージ</label><input id="mock-chat-message" placeholder="デモメッセージ" maxlength="100" required><button class="primary" type="submit">送信</button></form><p class="fine">送信先はありません。この端末のデモ履歴だけに追加します。</p>`,
        "lobby",
      );
      on(
        "#mock-chat-form",
        (e) => {
          e.preventDefault();
          const input =
            root.querySelector<HTMLInputElement>("#mock-chat-message")!;
          const message = input.value.trim();
          if (
            message &&
            actions.write("chat-messages", [...messages, message].slice(-30))
          )
            actions.openScreen("chat");
        },
        "submit",
      );
    } else
      shell(
        "部隊へ招待 · デモ",
        `<div class="mock-intro"><h2>部屋IDで集合</h2><label>デモ部屋ID<input value="DEMO0001" readonly aria-label="デモ部屋ID"></label><p>「協力プレイ → 部屋を探す」でこのIDを入力すると、架空のロビーへ進めます。</p><p class="mock-demo-note">このIDはモック内だけで使えます。</p>${button("rooms", "部屋一覧へ")}</div>`,
        "lobby",
      );
  } else if (screen === "upgrade" || screen === "upgrades") {
    const view = actions.read("upgrades", mockUpgrades());
    if (screen === "upgrades")
      shell(
        "現在の強化",
        frontUpgradeDetails(view, base, [...FRONT_FUSION_IDS]),
        "pause",
        '<button data-menu-resume class="primary">戦闘へ戻る</button>',
      );
    else {
      // Keep the countdown across sub-screens, but start a new demo choice
      // once it has expired so later visits can still show the timer.
      const stored = actions.read("upgrade-deadline", 0);
      const deadline = stored > Date.now() ? stored : Date.now() + 20000;
      actions.write("upgrade-deadline", deadline);
      let rerolls = actions.read("upgrade-rerolls", 2);
      const choices: FrontUpgradeId[] = [
        "blast-core",
        "armor-piercer",
        "power-cell",
      ];
      const remaining = () =>
        Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      shell(
        "強化を1つ選択",
        `<div class="mock-upgrade-deadline"><strong>タップで即決</strong><span>デモ期限 <b id="mock-choice-seconds">${remaining()}</b>秒</span></div><div class="rebuild-cards mock-upgrade-cards">${choices.map((id) => frontUpgradeCardMarkup(view, id, base)).join("")}</div><div class="mock-button-row"><button id="mock-reroll" ${rerolls <= 0 ? "disabled" : ""}>引き直し（残り${rerolls}回）</button>${button("upgrades", "現在の強化")}</div>`,
        "pause",
      );
      on("#mock-reroll", (e) => {
        rerolls--;
        actions.write("upgrade-rerolls", rerolls);
        const b = e.currentTarget as HTMLButtonElement;
        b.textContent = `引き直し（残り${rerolls}回）`;
        b.disabled = rerolls <= 0;
        const area = root.querySelector(".mock-upgrade-cards")!;
        area.append(area.firstElementChild!);
        status("デモ：候補の並びを更新しました。");
      });
      on("[data-card]", (e) => {
        const id = (e.currentTarget as HTMLElement).dataset
          .card as FrontUpgradeId;
        view.levels[id] = Math.min(
          FRONT_UPGRADE_CATALOG[id].maxLevel,
          view.levels[id] + 1,
        );
        view.picks++;
        actions.write("upgrades", view);
        actions.write("upgrade-deadline", 0);
        actions.write("upgrade-rerolls", 2);
        actions.write("last-upgrade", FRONT_UPGRADE_CATALOG[id].name);
        actions.resume();
      });
      const timer = window.setInterval(() => {
        const seconds = remaining();
        const label = root.querySelector("#mock-choice-seconds");
        if (label) label.textContent = String(seconds);
        if (seconds === 0) {
          window.clearInterval(timer);
          status("デモ期限終了。表示確認のため選択待ちを維持しています。");
        }
      }, 250);
      disposers.push(() => clearInterval(timer));
    }
  } else if (screen === "pause") {
    shell(
      "一時停止",
      `<div class="mock-intro"><h2>作戦を中断中</h2><p>向きや操作配置を確認してから再開できます。</p><div class="mock-button-row"><button data-menu-resume class="primary">再開</button><button data-menu-settings>設定</button><button data-menu-layout>操作配置</button>${button("upgrades", "現在の強化")}${button("upgrade", "強化3択")}${button("leave", "作戦から離脱")}</div></div>`,
    );
  } else if (screen === "leave") {
    shell(
      "作戦から離脱しますか",
      `<div class="mock-intro"><h2>回収済みの戦利品を確認</h2><p>デモ：撃破 128体 · 経過 03:24 · 戦利品 3丁</p><p>離脱すると作戦結果へ進みます。再開する場合は「戦闘に戻る」を選んでください。</p><div class="mock-button-row"><button data-menu-resume class="primary">戦闘に戻る</button>${button("recovery", "離脱して戦利品へ")}</div></div>`,
      "pause",
    );
  } else if (screen === "recovery" || screen === "result") {
    // A real battle reports its own outcome, time and kills. The demo values
    // stay for the catalog and the withdrawal flow.
    const real = screen === "result" ? actions.battleResult() : undefined;
    const clock = (seconds: number) =>
      `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
    const heading =
      screen === "recovery"
        ? ["RECOVERY", "回収品を確認"]
        : real && !real.victory
          ? ["OPERATION FAILED", "作戦失敗"]
          : ["OPERATION COMPLETE", "作戦完了"];
    shell(
      screen === "result" ? "作戦結果" : "戦利品回収",
      `<div class="mock-result-heading"><span class="eyebrow">${heading[0]}</span><h2>${heading[1]}</h2><p>${esc(actions.read("player-name", "隊員メロ"))} · ${real ? `${esc(real.scene)} · ${clock(real.time)}` : "ST5 · 03:24"}</p></div><div class="mock-result-stats"><div><small>撃破</small><b>${real ? real.kills : 128}</b></div><div><small>功績</small><b>+40</b></div><div><small>コイン</small><b>+320</b></div><div><small>戦利品</small><b>3丁</b></div></div>${gearWeaponRows(save.inventory.slice(8, 11), save, false, new Set())}<p class="fine">${real ? "勝敗・時間・撃破数は今回の戦闘の値です。功績・コイン・戦利品はデモ表示で、本番の進行・報酬は更新しません。" : "架空の作戦結果です。本番の進行・報酬は更新しません。"}</p><div class="mock-button-row">${screen === "recovery" ? button("result", "回収して結果へ", true) : button("gear", "次の出撃準備", true)}${button("home", "タイトルへ")}${button("save-error", "保存失敗の表示")}</div>`,
      "pause",
    );
    on("[data-lock]", (e) => {
      const b = e.currentTarget as HTMLElement;
      const locked = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", String(locked));
      b.innerHTML = lockMarkup(locked);
      status("デモ回収品のロック表示を変更しました。");
    });
    on("[data-detail]", (e) => {
      actions.write(
        "selected-weapon",
        (e.currentTarget as HTMLElement).dataset.detail,
      );
      actions.openScreen("gear-detail");
    });
  } else if (screen === "weekly") {
    const claimed = actions.read<string[]>("weekly-claimed", []);
    shell(
      "週任務",
      `<p>デモ週 · 残り3日。任務の達成・受取状態を確認できます。</p><div class="mock-mission-list">${[
        ["campaign", "進撃の作戦を3回クリア", "3 / 3", "コイン 600", true],
        ["kills", "異構体を500体撃破", "328 / 500", "武装片 15", false],
        ["defense", "防衛作戦を1回クリア", "1 / 1", "育成素材 2", true],
      ]
        .map(
          ([id, title, progress, reward, done]) =>
            `<article><div><h2>${title}</h2><p>${progress} · ${reward}</p><progress max="100" value="${done ? 100 : 65}" aria-label="${title}"></progress></div><button data-claim="${id}" ${!done || claimed.includes(String(id)) ? "disabled" : ""}>${claimed.includes(String(id)) ? "受取済み" : done ? "受け取る" : "進行中"}</button></article>`,
        )
        .join("")}</div>`,
    );
    on("[data-claim]", (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.claim!;
      if (actions.write("weekly-claimed", [...claimed, id]))
        actions.openScreen("weekly");
    });
  } else if (["save-error", "restore", "cloud"].includes(screen)) {
    if (screen === "save-error") {
      shell(
        "保存を再試行",
        `<div class="mock-intro"><h2>デモ：端末へ保存できませんでした</h2><p>受取結果はこの画面に保持されています。空き容量を確認してから再試行する流れを確認できます。</p><dl><dt>保留中の報酬</dt><dd>コイン320・武器3丁</dd><dt>直前の記録</dt><dd>ST5 / 03:24</dd></dl><div class="mock-button-row"><button id="mock-save-retry" class="primary">保存を再試行</button>${button("restore", "復旧方法を見る")}${button("result", "結果を確認")}</div></div>`,
      );
      on("#mock-save-retry", () => {
        if (actions.write("save-retry-demo", true))
          status("デモ：再試行が成功しました。結果画面から続行できます。");
        else
          status(
            "モック専用領域にも保存できません。ブラウザの空き容量・保存設定をご確認ください。",
          );
      });
    } else if (screen === "restore") {
      shell(
        "保存の復旧 · デモ",
        `<div class="mock-option-grid"><article><h2>この端末のバックアップ</h2><p>ST5 · 所持24丁 · 直前の保存</p><button id="mock-restore" class="primary">デモバックアップを確認</button></article><article><h2>クラウドとの比較</h2><p>2つの架空データを並べて、選択の手順を確認します。</p>${button("cloud", "比較を開く")}</article></div><p class="fine">本番のバックアップ・クラウドには接続しません。</p>`,
        "save-error",
      );
      on("#mock-restore", () =>
        status(
          "デモバックアップ：武器24丁・兵士1名・ST5。モックデータは保持されています。",
        ),
      );
    } else {
      shell(
        "保存データを比較 · デモ",
        `<div class="mock-option-grid"><article><h2>この端末</h2><dl><dt>到達</dt><dd>ST5</dd><dt>武器</dt><dd>24丁</dd><dt>コイン</dt><dd>4,200</dd><dt>更新</dt><dd>本日 10:30（デモ）</dd></dl><button data-cloud-choice="端末" class="primary">端末のデータを選択</button></article><article><h2>クラウド</h2><dl><dt>到達</dt><dd>ST4</dd><dt>武器</dt><dd>21丁</dd><dt>コイン</dt><dd>3,600</dd><dt>更新</dt><dd>昨日 21:15（デモ）</dd></dl><button data-cloud-choice="クラウド">クラウドのデータを選択</button></article></div><p class="mock-demo-note">比較表示のみのデモです。実際の保存データは取得しません。</p>`,
        "restore",
      );
      on("[data-cloud-choice]", (e) =>
        status(
          `デモ：${(e.currentTarget as HTMLElement).dataset.cloudChoice}のデータを選択しました。実データの上書きはありません。`,
        ),
      );
    }
  } else if (screen === "bestiary") {
    shell(
      "エネミーレポート",
      `<div class="report-layout"><nav class="enemy-list" aria-label="敵の一覧">${ENEMY_REPORT_ORDER.map((key, i) => `<button data-enemy="${key}" aria-pressed="false"><span class="eyebrow">${String(i + 1).padStart(2, "0")}</span><strong>${ENEMY_REPORT_NAMES[key]}</strong></button>`).join("")}</nav><section class="report-detail"><div class="specimen"><div class="specimen-label eyebrow">3D SPECIMEN</div><div class="enemy-viewport"></div><p class="viewer-hint">ドラッグで回転 · ピンチ / ホイールで拡大</p></div><div class="report-playback"><div class="motion-buttons"><button data-motion="idle" aria-pressed="true">待機</button><button data-motion="move">移動</button><button data-motion="attack">攻撃</button></div><p id="mock-model-status" role="status">モデルを読み込み中…</p></div><article class="enemy-description"></article><div class="mock-button-row">${button("voices", "声を聴く")}${button("encounter", "会敵ムービー")}</div></section></div>`,
    );
    const host = root.querySelector<HTMLElement>(".enemy-viewport")!;
    let viewer: ReturnType<typeof createEnemyViewer> | undefined;
    try {
      viewer = createEnemyViewer(host);
    } catch {
      host.dataset.asset = "error";
    }
    const showEnemy = (key: EnemyReportId) => {
      actions.write("enemy", key);
      viewer?.show(key === "worm" ? "boss" : key, key === "worm");
      root.querySelector(".enemy-description")!.innerHTML =
        `<h2>${ENEMY_REPORT_NAMES[key]}</h2><p>${MOCK_ENEMY_NOTES[key]}</p>`;
      root
        .querySelectorAll<HTMLElement>("[data-enemy]")
        .forEach((b) =>
          b.setAttribute("aria-pressed", String(b.dataset.enemy === key)),
        );
    };
    const update = () => {
      const state = host.dataset.asset;
      root.querySelector("#mock-model-status")!.textContent =
        state === "ready"
          ? "3D標本を操作できます"
          : state === "error"
            ? "モデルを読み込めませんでした。別の敵を選び直してください。"
            : "モデルを読み込み中…";
    };
    const observer = new MutationObserver(update);
    observer.observe(host, {
      attributes: true,
      attributeFilter: ["data-asset"],
    });
    on("[data-enemy]", (e) =>
      showEnemy(
        (e.currentTarget as HTMLElement).dataset.enemy as EnemyReportId,
      ),
    );
    on("[data-motion]", (e) => {
      const motion = (e.currentTarget as HTMLElement).dataset.motion as
        "idle" | "move" | "attack";
      viewer?.play(motion);
      root
        .querySelectorAll<HTMLElement>("[data-motion]")
        .forEach((b) =>
          b.setAttribute("aria-pressed", String(b.dataset.motion === motion)),
        );
    });
    const key = actions.read<EnemyReportId>("enemy", "bastion");
    showEnemy(ENEMY_REPORT_ORDER.includes(key) ? key : "bastion");
    update();
    disposers.push(() => {
      observer.disconnect();
      viewer?.dispose();
    });
  } else if (screen === "voices") {
    shell(
      "異構体の声",
      `<p>各個体の声を再生します。音量は設定の効果音へ連動します。</p><div class="mock-voice-list">${Object.entries(
        ANOMALY_VOICE_PROFILES,
      )
        .map(
          ([key, entry]) =>
            `<article><div><h2>${entry.name}</h2><p>${entry.description}</p></div><div class="mock-button-row"><button data-voice="${key}-0">声1</button><button data-voice="${key}-1">声2</button></div></article>`,
        )
        .join("")}</div>`,
      "bestiary",
    );
    const audio = new Audio();
    audio.preload = "none";
    audio.volume = actions.sound.effectsVolume;
    on("[data-voice]", (e) => {
      audio.pause();
      audio.src = `${base}${ANOMALY_VOICE_PATH}${(e.currentTarget as HTMLElement).dataset.voice}.wav`;
      void audio
        .play()
        .then(() => status("声を再生中"))
        .catch(() => {
          if (!disposed)
            status(
              "声を再生できませんでした。音量設定を確認して再度お試しください。",
            );
        });
    });
    const hide = () => {
      if (document.hidden) audio.pause();
    };
    document.addEventListener("visibilitychange", hide);
    disposers.push(() => {
      document.removeEventListener("visibilitychange", hide);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    });
  } else if (screen === "encounter" || screen === "pv") {
    const selected = actions.read<EnemyReportId>("enemy", "bastion");
    const key = Object.hasOwn(ENCOUNTER_FILM_FILES, selected)
      ? selected
      : "bastion";
    shell(
      screen === "pv" ? "SWARM FRONT · PV" : "会敵ムービー",
      `${screen === "encounter" ? `<label>敵を選択<select id="mock-film-enemy">${ENEMY_REPORT_ORDER.map((id) => `<option value="${id}" ${id === key ? "selected" : ""}>${ENEMY_REPORT_NAMES[id]}</option>`).join("")}</select></label>` : ""}<div class="mock-video"><video controls playsinline preload="metadata" src="${base}${screen === "pv" ? "assets/video/swarm-front-pv-v13.mp4" : ENCOUNTER_FILM_FILES[key]}" aria-label="${screen === "pv" ? "PV" : "会敵ムービー"}"></video></div><p>再生ボタンで映像を開始。端末を回して表示の収まりを確認できます。</p>`,
      screen === "pv" ? actions.pvBack() : "bestiary",
    );
    const video = root.querySelector("video")!;
    video.addEventListener("error", () =>
      status("映像を読み込めませんでした。戻ってから再度開いてください。"),
    );
    on(
      "#mock-film-enemy",
      (e) => {
        actions.write("enemy", (e.currentTarget as HTMLSelectElement).value);
        actions.openScreen("encounter");
      },
      "change",
    );
    disposers.push(() => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    });
  } else if (screen === "tutorial") {
    shell(
      "操作ガイド",
      `<div class="mock-option-grid"><article><h2>移動と照準</h2><p>左側のスティックで移動。右側の空き領域をドラッグして視点を動かします。</p><p>指を離す・画面を切り替えると入力は解除されます。</p></article><article><h2>射撃と回避</h2><p>射撃ボタンを押して攻撃。回避・装填・武器切替は各ボタンで操作します。</p><p>縦横の向きに合わせて、操作配置を別々に調整できます。</p></article></div><div class="mock-button-row"><button data-battle="training" class="primary">訓練場で試す</button><button data-menu-layout>操作配置を調整</button><button data-menu-settings>設定を開く</button></div>`,
    );
  } else if (screen === "changelog") {
    shell(
      "モックの更新内容",
      `<div class="mock-intro"><h2>縦横表示の確認</h2><p>既存のタイトル・武器行・強化カード・基地・工房・3D標本を使って、縦横の表示と操作を確認します。</p><ul><li>すべての画面へカタログから直通。</li><li>協力・報酬・クラウド比較は架空のデータ。</li><li>向きの変更後も画面内容と操作を確認できます。</li></ul>${button("catalog", "全画面カタログへ", true)}</div>`,
    );
  } else
    shell(
      "画面を選択",
      `<p>カタログから確認する画面を選んでください。</p>${button("catalog", "全画面カタログへ", true)}`,
    );

  return () => {
    disposed = true;
    disposers.forEach((dispose) => dispose());
    root.querySelectorAll<HTMLDialogElement>("dialog").forEach((dialog) => {
      dialog.close();
      dialog.remove();
    });
  };
}
