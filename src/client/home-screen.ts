import { STAGES, MAPS } from "../shared/stages";
import { menuIcon } from "./menu-ui";
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
// One title composition for both the established game and progression screens.
export function homeMarkup({
  stage,
  inventoryCount,
  pendingCount = 0,
  install = false,
  error = "",
}: {
  stage: (typeof STAGES)[number];
  inventoryCount: number;
  pendingCount?: number;
  install?: boolean;
  error?: string;
}) {
  return `<section class="title"><div class="eyebrow">TACTICAL OPERATIONS <span>戦術作戦本部</span></div><h1 class="title-logo" aria-label="SWARM FRONT"><svg viewBox="469 1580 2322 937" role="presentation" aria-hidden="true" focusable="false"><image href="${import.meta.env.BASE_URL}assets/ui/title-logo-v2.png" width="3258" height="4096" /></svg></h1><p class="tagline">異形の構造体を砕け。<br>仲間と、次の戦場へ。</p><aside class="home-operation"><div class="eyebrow">NEXT OPERATION / ${String(stage.id).padStart(2, "0")}</div><h2>${esc(stage.name)}</h2><p>${esc(MAPS[stage.map].name)} <span>${stage.waves.length} WAVES</span></p><small>${esc(stage.brief)}</small></aside></section><section class="home-command" aria-label="メインメニュー"><div class="command-heading"><span class="eyebrow">COMMAND MENU</span><span class="connection-dot">出撃待機</span></div><div class="title-actions"><button class="primary home-launch" id="solo" aria-label="ソロで出撃準備">${menuIcon("sortie")}<span><small>SOLO OPERATION</small><b>ソロで出撃準備</b><em>ステージと装備を選んで出撃</em></span><i aria-hidden="true">↗</i></button><button id="coop" aria-label="協力プレイ">${menuIcon("squad")}<span><small>CO-OP / 1–4 PLAYERS</small><b>協力プレイ</b><em>部隊を作成・招待から参加</em></span><i aria-hidden="true">↗</i></button><button id="open-armory" aria-label="基地">${menuIcon("armory")}<span><small>BASE</small><b>基地</b><em>武器・アクセサリ・育成${pendingCount ? ` · 整理待ち ${pendingCount}丁` : "・工房"}</em></span><i aria-hidden="true">›</i></button><button id="open-bestiary" aria-label="エネミーレポート">${menuIcon("report")}<span><small>FIELD INTELLIGENCE</small><b>エネミーレポート</b><em>敵の特徴と対処を確認</em></span><i aria-hidden="true">›</i></button></div><div class="home-utilities"><button id="home-settings">${menuIcon("settings")}設定・操作</button>${install ? '<button id="install">ホーム画面に追加</button>' : ""}</div><p class="fine">戦利品はこの端末に保存されます。ソロは通信サーバー不要。</p>${error ? `<p class="error">${esc(error)}</p><button id="export">保存データを書き出す</button>` : ""}</section><div class="home-footer"><button id="changelog">更新履歴</button></div>`;
}
