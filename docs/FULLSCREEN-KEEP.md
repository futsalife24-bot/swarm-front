# 全画面の維持・復帰（2026-09-12）

実装・自己検証完了。前のUI修正と合わせて本番公開承認待ち。

## 挙動
- タッチ端末の全ゲーム画面で、通常のタップからrequestFullscreen({ navigationUI: "hide" })を要求。従来のソロ/協力/出撃ボタンだけという限定を解除。
- 全画面中は再要求しない。OSの操作や他アプリへの切替で解除された後は、次のゲーム操作で再要求する。戦闘中のpreventDefaultされた操作もpointerupで拾い、元の操作は妨げない。
- pointerupとclickの重複は500msでまとめ、要求中も多重実行しない。タイマーによる要求連発なし。API拒否/未対応も捕捉し、ゲーム操作は継続。
- fullscreen後の横向きロック、復帰時のロック、縦向き時の入力解除・ソロ停止は保持。
- 前ターンのCSSによる上下safe-area強制0を撤回。端末の安全領域は尊重し、全画面APIでブラウザ領域を非表示にする。

ブラウザは全画面要求にユーザー操作を必要とするため、解除そのものを禁止したり、別アプリから戻った瞬間に必ず全画面化したりはできない。端末の案内や一時的なシステム表示もWeb側から消せない。参照: https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen

## 検証
- typecheck、client build成功。
- APIスタブ: navigationUI hide、武器庫からの開始、全画面中は再要求なし、復帰イベントだけでは連発なし、準備/戦闘タップで復帰、拒否時の操作継続、pointerup/click重複抑止、ページ例外0。
- 実ChromeのFullscreen API: 武器庫から開始、exitFullscreen後に準備へ移動して復帰、戦闘でexitFullscreen後に射撃タップで復帰。成功。
- 既存check-landscape --api-only 2条件成功。横向きロックの要求順を保持。
- scripts/check-menu-fullscreen.mjsもCSS撤回に合わせ、安全領域が残ることを期待する試験へ変更。
- 実Android/iPhoneでのシステムバー・他アプリからの復帰は未確認。公開版の確認も未実施。

## 差分・残作業
branch: codex/home-armory。base/head: 4186f25f7c9695f95ea897ad182db5f85fac3091。commit/mergeなし。既存の未コミット・未追跡差分を保持。
変更: src/client/landscape.ts（全画面維持）、src/menu-ui.css（安全領域上書きを撤回）、scripts/check-fullscreen-keep.mjs（検証）、scripts/check-menu-fullscreen.mjs（期待値訂正）。
証拠: dist-validation/fullscreen-keep/change.patch、checks.json、battle.png。今回限定差分はchange.patchで前ターンからの追加を確認できる。
前ターンで自動承認レビューが本番公開の明示承認不足を理由に拒否。今回の指示は追加仕様の実装として扱い、公開を再試行していない。前の一覧UI修正と本変更をまとめて公開承認後に反映し、配信物一致・health・公開画面を検証する。

## 公開完了（2026-09-13）
ユーザーの「公開して、承認するから毎回聞かないで」により明示承認。前の一覧UI修正とまとめて公開済み。
Version: 051e66c2-d647-4b9f-8cc2-1b6339198460
URL: https://swarm-front.melosalife-24.workers.dev
公開版でAPI成功/拒否スタブと実Chrome全画面APIを検証。武器庫から全画面開始、解除後の準備画面への移動で復帰、戦闘中の解除後に射撃タップで復帰が成功。UI4サイズ・配信JS/CSSハッシュ一致・health成功も確認。実Android/iPhoneのシステムバー挙動は未確認。
証拠: dist-validation/fullscreen-keep/published.json、published-battle.png、dist-validation/menu-density/published.json。scripts/check-fullscreen-keep.mjsに公開URL指定を追加。以前の承認待ち記載は履歴。commit/mergeなし、branch/headは上記から変更なし。
