import type { StoredWeapon } from "../shared/progression";
import type { BuddyId } from "../shared/buddy-progression";
import { freshProgress, loadProgress } from "./progression-save";
import { openWeaponDetail } from "./weapon-detail";
import { getBuddyUiState } from "./buddy-presentation";
import { mountBuddyMenu } from "./buddy-ui";
import { menuDialog } from "./menu-ui";

type Result = {
  type: string;
  name?: string;
  rarity?: string;
  amount?: number;
  weapon?: StoredWeapon;
  buddyId?: BuddyId;
};

/** 結果上で既存の詳細を読み取り専用で開く。受領・保存は行わない。 */
export function openSupplyResult(r: Result) {
  if (r.type === "weapon" && r.weapon) {
    openWeaponDetail(r.weapon, {
      locked: false,
      lockDisabled: true,
      note: "補給結果の詳細です。ロックは武器庫で変更できます。",
      onLock: () => {},
    });
  } else if (r.type === "buddy" && r.buddyId) {
    const state = getBuddyUiState(
      loadProgress("normal", { getItem: (key) => localStorage.getItem(key) }) ??
        freshProgress("normal"),
    );
    state.starterChosen = true;
    state.locked = "結果の詳細表示中";
    const dialog = menuDialog(
      "バディ詳細",
      '<div class="supply-buddy-detail"></div>',
      "SUPPLY DROP",
    );
    dialog.classList.add("supply-buddy-dialog");
    const unavailable = () => {
      throw Error("結果の詳細表示中です");
    };
    const menu = mountBuddyMenu(
      dialog.querySelector<HTMLElement>(".supply-buddy-detail")!,
      state,
      {
        chooseStarter: unavailable,
        equip: unavailable,
        breakthrough: unavailable,
        draw: unavailable,
        requestId: unavailable,
      },
      { tab: "roster", focus: r.buddyId },
    );
    dialog.addEventListener("close", () => menu.destroy(), { once: true });
  }
}

/** 投稿画面を開くだけ。投稿の確定は本人が行う。 */
export function shareSupplyResults(results: Result[], preview = false) {
  const rank = (r: Result) =>
    r.type === "buddy"
      ? 5
      : ["N", "R", "SR", "SSR"].indexOf(r.rarity ?? "") + 1;
  const lines = [...results]
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, 3)
    .map((r) =>
      r.type === "shard"
        ? `武装片 ×${r.amount}`
        : `${r.name}${r.rarity ? ` / ${r.rarity}` : ""}`,
    );
  const game = new URL(
    import.meta.env.VITE_PUBLIC_GAME_URL ||
      "https://swarm-front.melosalife-24.workers.dev/",
  );
  game.search = "?playtest=1";
  const url = new URL("https://twitter.com/intent/tweet");
  url.searchParams.set(
    "text",
    `SWARM FRONT ${preview ? "試しガチャ（取得なし）" : "補給結果"} ${results.length}件\n${lines.join("\n")}\n${game}`,
  );
  window.open(url.href, "_blank", "noopener,noreferrer");
}
