import "../../style.css";
import "../../mobile-ui.css";
import "../../menu-ui.css";
import "../../menu-theme.css";
import { Sound } from "../audio";
import { createMockStore } from "./storage";
import { MockViewport } from "./viewport";
import { MockOrientation } from "./orientation";
import { MockLayouts, mountLayoutEditor } from "./layouts";
import { mountSettings, readSettings } from "./settings";
import { MockBattle, type BattleScene } from "./battle";
import {
  mountMockMenu,
  SCREEN_CATALOG,
  type MockBattleResult,
  type MockMenuActions,
} from "./menus";
import "./mock.css";
import { mockProgress } from "./fixtures";
import { newSaveKey, validateProgress } from "../progression-save";

const root = document.getElementById("ui")!,
  bar = document.getElementById("mock-bar")!;
const store = createMockStore({
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
});
const viewport = new MockViewport(),
  orientation = new MockOrientation(store),
  layouts = new MockLayouts(store),
  settings = readSettings(store),
  sound = new Sound();
let cleanup: (() => void) | undefined,
  screen = "home",
  settingsReturn = "home",
  layoutReturn = "settings",
  pvReturn = "home",
  battleResult: MockBattleResult | undefined,
  navigation = 0;
const sceneNames: Record<BattleScene, string> = {
  training: "射撃場",
  skirmish: "小規模戦",
  boss: "大型戦",
  dense: "密集戦",
};
const battle = new MockBattle(viewport, layouts, settings, sound, {
  pause: () => open("pause"),
  result: () => {
    const s = battle.snapshot();
    battleResult = {
      victory: s.phase === "victory",
      scene: sceneNames[s.scene],
      kills: s.player.kills,
      time: s.time,
    };
    open("result");
  },
  exitTraining: () => {
    battle.endTrial();
    open("layout");
  },
});
const scenes: BattleScene[] = ["training", "skirmish", "boss", "dense"];
const catalog = [
  ...SCREEN_CATALOG,
  { id: "settings", label: "設定・画面の向き", group: "操作確認" },
  { id: "layout", label: "縦横の配置編集", group: "操作確認" },
  ...scenes.map((id) => ({
    id: `battle-${id}`,
    label: `実${sceneNames[id]}`,
    group: "操作確認",
  })),
];
const actions: MockMenuActions = {
  openScreen: open,
  startBattle: start,
  openSettings: () => {
    settingsReturn = screen;
    open("settings");
  },
  openLayout: () => {
    layoutReturn = screen;
    open("layout");
  },
  resume,
  battleResult: () => battleResult,
  pvBack: () => pvReturn,
  read: (key, fallback) => store.read(key, fallback),
  write: (key, value) => store.write(key, value),
  sound,
};
function prepare(next: string) {
  navigation++;
  cleanup?.();
  cleanup = undefined;
  battle.hide();
  root.replaceChildren();
  screen = next;
  document.body.dataset.screen = "menu";
  document.body.dataset.mockScene = next;
  root.className = next === "layout" ? "mock-layout-root" : "";
  document.getElementById("mock-catalog")!.hidden = next === "layout";
}
function open(id: string) {
  if (id === "battle") {
    resume();
    return;
  }
  if (id.startsWith("battle-") && scenes.includes(id.slice(7) as BattleScene)) {
    start(id.slice(7) as BattleScene);
    return;
  }
  if (id === "pv" && screen !== "settings") pvReturn = "home";
  prepare(id);
  history.replaceState(null, "", `#${id}`);
  if (id === "settings") {
    cleanup = mountSettings(
      root,
      settings,
      store,
      orientation,
      battle.controls,
      {
        back: () => open(settingsReturn),
        layout: () => {
          layoutReturn = "settings";
          open("layout");
        },
        pv: () => {
          pvReturn = "settings";
          open("pv");
        },
        changed: () => battle.applySettings(),
      },
    );
  } else if (id === "layout") {
    cleanup = mountLayoutEditor(root, viewport, layouts, {
      back: () => open(layoutReturn),
      test: () => start("training", true),
      fullscreen: () => void orientation.fullscreen(),
    });
  } else if (id === "catalog") {
    root.innerHTML =
      '<section class="mock-page"><header><button id="catalog-home">タイトルへ</button><h1>画面一覧</h1></header><p>縦横の手触り確認用です。協力・保存復旧・報酬はデモです。</p><div class="mock-catalog-grid"></div></section>';
    const grid = root.querySelector(".mock-catalog-grid")!;
    for (const group of [...new Set(catalog.map((s) => s.group))]) {
      const section = document.createElement("section");
      section.innerHTML = `<h2>${group}</h2>`;
      for (const item of catalog.filter((s) => s.group === group)) {
        const b = document.createElement("button");
        b.textContent = item.label;
        b.dataset.scene = item.id;
        b.onclick = () => open(item.id);
        section.append(b);
      }
      grid.append(section);
    }
    root.querySelector<HTMLElement>("#catalog-home")!.onclick = () =>
      open("home");
  } else
    cleanup = mountMockMenu(
      root,
      catalog.some((s) => s.id === id) ? id : "home",
      actions,
    );
  root.scrollTop = 0;
  root.scrollLeft = 0;
}
function start(scene: BattleScene, draft = false) {
  battleResult = undefined;
  prepare("battle");
  root.innerHTML =
    '<div class="mock-loading" role="status">戦場を準備しています…</div>';
  const ticket = navigation;
  requestAnimationFrame(() =>
    setTimeout(() => {
      if (ticket !== navigation) return;
      try {
        let progress = mockProgress();
        try {
          progress = validateProgress(
            JSON.parse(
              store.read(
                `menu-storage:${newSaveKey("normal")}`,
                JSON.stringify(progress),
              ),
            ),
          );
        } catch {
          /* Fictional defaults are safe when a mock save is damaged. */
        }
        const soldier = progress.soldiers.find(
          (s) => s.id === progress.selectedSoldier,
        )!;
        const weapons = soldier.equipped.map((id) =>
          progress.inventory.find((w) => w.id === id)!,
        );
        root.replaceChildren();
        battle.start(scene, draft, weapons);
        history.replaceState(null, "", `#battle-${scene}`);
      } catch (error) {
        root.innerHTML =
          '<section class="mock-page"><h1>3D描画を開始できませんでした</h1><p>Chromeの更新とハードウェアアクセラレーションをご確認ください。</p><button id="render-back">画面一覧へ</button></section>';
        root.querySelector<HTMLElement>("#render-back")!.onclick = () =>
          open("catalog");
        console.error(error);
      }
    }, 0),
  );
}
function resume() {
  prepare("battle");
  battle.show();
  history.replaceState(null, "", "#battle");
}
document.getElementById("mock-catalog")!.onclick = () => open("catalog");
document.getElementById("mock-fullscreen")!.onclick = () =>
  void orientation.fullscreen();
viewport.subscribe((v) => {
  bar.dataset.orientation = v.mode;
  document.getElementById("mock-dimensions")!.textContent =
    `${v.width}×${v.height} ${v.mode === "portrait" ? "縦" : "横"}`;
});
viewport.refresh();
battle.applySettings();
Object.defineProperty(window, "__orientationMock", {
  get: () => ({
    screen,
    catalog: catalog.map((s) => ({ ...s })),
    orientation: {
      preference: orientation.preference,
      status: orientation.status,
    },
    battle: battle.snapshot(),
  }),
});
open(location.hash.slice(1) || "home");
