import "./home-screen.css";
import { STAGES, MAPS } from "../shared/stages";
import { menuIcon } from "./menu-ui";
import type { FtueNextStep } from "./ftue";
import type { UnlockEntry, UnlockState } from "./unlock-stage";

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export type HomeNextEntrance = "solo" | "base" | "supplyBox" | null;

export interface HomeViewState {
  stage: (typeof STAGES)[number];
  inventoryCount: number;
  pendingCount?: number;
  install?: boolean;
  error?: string;
  nextStep?: FtueNextStep;
  unlock?: UnlockState;
}

const STEP_UNLOCK_ENTRIES: Record<FtueNextStep["kind"], UnlockEntry | null> = {
  solo: "solo",
  buddy: "buddy",
  supply: "supply",
  supplyBox: "supplyBox",
  none: null,
} as const;

export function homeNextEntrance(
  step: FtueNextStep | undefined,
  unlock?: UnlockState,
): HomeNextEntrance {
  let entrance: HomeNextEntrance;
  switch (step?.kind) {
    case "solo":
      entrance = "solo";
      break;
    case "buddy":
    case "supply":
      entrance = "base";
      break;
    case "supplyBox":
      entrance = "supplyBox";
      break;
    default:
      return null;
  }
  if (!unlock || !step) return entrance;
  const target = STEP_UNLOCK_ENTRIES[step.kind];
  return target && unlock.entries[target].open ? entrance : null;
}

function homeEntranceView(
  unlock: UnlockState | undefined,
  entry: "base" | "enemyReport",
  openDescription: string,
) {
  const state = unlock?.entries[entry];
  const locked = !!state && !state.open;
  return {
    locked,
    attrs: locked ? ' aria-disabled="true" disabled' : "",
    description: locked ? state!.reason : openDescription,
  };
}

export function homeChallengesMarkup({
  unlock,
  mode,
  developerMode = false,
}: {
  unlock: UnlockState;
  mode: string;
  developerMode?: boolean;
}) {
  if (developerMode) return "";
  let html = "";
  if (unlock.entries.dailyDefense.open)
    html += '<button id="pt-daily-defense">日替わり防衛</button>';
  if (unlock.entries.weekly.open)
    html +=
      '<button id="pt-weekly-missions" class="weekly-title-button">週間ミッション<span class="weekly-notification" aria-hidden="true" hidden></span></button>';
  if (mode === "normal")
    html +=
      '<button id="pt-supply-box" class="weekly-title-button">支給ボックス<span class="weekly-notification" aria-hidden="true" hidden></span></button>';
  return html;
}

// One title composition for both the established game and progression screens.
export function homeMarkup(view: HomeViewState) {
  const {
    stage,
    inventoryCount,
    pendingCount = 0,
    install = false,
    error = "",
    nextStep,
    unlock,
  } = view;
  const entrance = homeNextEntrance(nextStep, unlock);
  const soloClass =
    entrance === "base" || entrance === "supplyBox"
      ? "home-launch"
      : "primary home-launch";
  const armoryClass = entrance === "base" ? ' class="primary"' : "";
  const baseDescription =
    nextStep?.kind === "buddy"
      ? "最初のバディを選べます"
      : nextStep?.kind === "supply"
        ? "初回補給10連ができます"
        : `武器・育成・生存カード${pendingCount ? ` · 整理待ち ${pendingCount}丁` : ""}`;
  const base = homeEntranceView(unlock, "base", baseDescription);
  const report = homeEntranceView(
    unlock,
    "enemyReport",
    "敵の特徴と対処を確認",
  );
  return `<section class="title"><div class="eyebrow">TACTICAL OPERATIONS <span>戦術作戦本部</span></div><h1 class="title-logo" aria-label="SWARM FRONT"><svg viewBox="469 1580 2322 937" role="presentation" aria-hidden="true" focusable="false"><image href="${import.meta.env.BASE_URL}assets/ui/title-logo-v2.png" width="3258" height="4096" /></svg></h1><p class="tagline">異形の構造体を砕け。<br>仲間と、次の戦場へ。</p><aside class="home-operation"><div class="eyebrow">進撃 · 次の作戦 / ${String(stage.id).padStart(2, "0")}</div><h2>${esc(stage.name)}</h2><p>${esc(MAPS[stage.map].name)} <span>${stage.waves.length} WAVES</span></p></aside></section><section class="home-command" aria-label="メインメニュー"><div class="command-heading"><span class="eyebrow">COMMAND MENU</span><span class="connection-dot">出撃待機</span></div><div class="title-actions"><button class="${soloClass}" id="solo" aria-label="ソロ：進撃 または 生存">${menuIcon("sortie")}<span><small>SOLO OPERATION</small><b>ソロ：進撃 または 生存</b><em class="home-next-stage">ひとりで作戦を選ぶ</em></span><i aria-hidden="true">↗</i></button><button id="coop" aria-label="協力：進撃 または 生存">${menuIcon("squad")}<span><small>CO-OP / 1–4 PLAYERS</small><b>協力：進撃 または 生存</b><em>仲間と作戦を選ぶ</em></span><i aria-hidden="true">↗</i></button><button${armoryClass} id="open-armory" aria-label="基地"${base.attrs}>${menuIcon("armory")}<span><small>BASE</small><b>基地</b><em>${esc(base.description)}</em></span><i aria-hidden="true">›</i></button><button id="open-bestiary" aria-label="エネミーレポート"${report.attrs}>${menuIcon("report")}<span><small>FIELD INTELLIGENCE</small><b>エネミーレポート</b><em>${esc(report.description)}</em></span><i aria-hidden="true">›</i></button></div><div class="home-challenges" role="group" aria-label="チャレンジ"></div><div class="home-utilities" role="group" aria-label="ガイドと設定"><button id="home-tutorial">チュートリアル</button><button id="home-settings">${menuIcon("settings")}設定・操作</button>${install ? '<button id="install">ホーム画面に追加</button>' : ""}</div><p class="fine">戦利品はこの端末に保存されます。ソロは通信サーバー不要。</p>${error ? `<p class="error">${esc(error)}</p><button id="export">保存データを書き出す</button>` : ""}</section><div class="home-footer"><button id="changelog">更新履歴</button></div>`;
}
