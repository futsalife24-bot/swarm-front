# 協力プレイ募集画面の配置整理（2026-11-16）

本人の `C:/Users/futsa/bibi-bridge/inbox/coop-ui-tidy-brief-20261116.md` に基づく。作業場所は `C:/Users/futsa/swarm-coop-ui-tidy-20261116`、GitHub正本は https://github.com/futsalife24-bot/swarm-front 。基点はmain `7a615285d896b9791a6f7544286453a034343322`、製品変更commitは `98456262ee62c6a862fade98173e2ac4edae90b2`。

## 変更と自己レビュー

- 製品変更は `src/client/coop-lobby.css` のみ。画面幅と高さ、見出し、入力欄、認証欄、操作ボタン、最下部設定の間隔を整理。左右を同じ段へ揃えた。既存の紺・ティール・ミントの表現を継承。
- Turnstileは通常の300×65表示を保ち、カラム左端を入力・操作ボタンと揃えた。ウィジェット自体の拡縮、認証設定、トークン、コールバック、部屋作成・参加・公開一覧・ゲーム・保存処理は変更なし。HTMLとTypeScriptの製品変更なし。
- `scripts/check-coop-entry-layout.mjs` は実Chromeの表示検証器。1280×720と844×390のID招待・フリーマッチングについて、スクロール量、見出し位置、入力位置と幅、操作位置と高さ、設定・認証欄との非重複、画面例外0を確認する。部屋の作成・参加や認証操作は行わない。
- 変更前の844×390は左入力領域に46pxの縦スクロールがあり、認証が途中で切れていた。初回調整では既存モバイル指定の列位置が干渉し、続いてボタンと設定の重複を目視で検出。列指定と余白を修正し、重複の検証を加えて最終成功した。失敗を最終結果と混同しない。

## 検証

- `npm test`: 184ファイル1907件すべて成功（319.38秒）。
- `npm run typecheck` / `npm run format:check`: 成功。
- `npm run build` / `npm run server:build:production`: 実装commitから成功。既存の大きなchunkとplugin所要時間警告は残る。
- 実配信画面に候補CSSだけを適用した4条件が成功。本物の認証ウィジェットを表示して目視した。これは公開完了の証明とは区別する。
- ローカル実装の4条件も成功。ローカルは既存仕様どおり作成キー案内を表示するため、認証成功の証明にはしない。
- 変更前・候補の測定値は同ディレクトリのJSON。`iframe: false` はclosed shadow内部を通常DOM検索できないためで、ウィジェット未表示を意味しない。認証の合格や実スマホ検証は主張しない。
- 元rootと既存の別worktreeの差分は保持。通常タスクの現行方針に従い独立Chat監査は未実施。実モデルID・推論設定は取得不可のため未確認、委任なし。

## 公開と成果物

[実装PR #357](https://github.com/futsalife24-bot/swarm-front/pull/357) を通常merge。公開ソースmain `35a8eca4f62f0cbc9d1023cb13e6cdb4ff979253` から再build/production dry-runが成功し、既存Worker `swarm-front` / https://swarm-front.melosalife-24.workers.dev/ に公開した。Version `28850f2a-bb7b-4a8f-a734-6591cd0ce49e`。新規サービス・契約・認証設定・移行の変更なし。

配信HTML/JS/CSS/Service Workerの28ファイルがHTTP200・SHA一致し、配信JSのソースSHA埋込一致と `/api/health` の正常応答を確認。`delivery.json`。公開後の実Chromeでも4条件すべてスクロール0・整列・非重複・画面例外0で成功し、認証ウィジェットを省略せず撮影/目視した。`published-measurements.json` と同ディレクトリの画像。認証の合格は未検証。GitHubのcommit statusとworkflow runは0件で、CI成功とは読み替えず、mergeable=trueを確認して通常mergeした。主要コマンドの実ログは `checks/`。

指定outboxは `C:/Users/futsa/bibi-bridge/outbox/`。

- `20261116-coop-ui-before.png`: 変更前の1280×720と844×390を原寸で並べた比較画像。
- `20261116-coop-ui-after-1280.png` / `20261116-coop-ui-after-mobile.png`: 公開後の実配信画面から取得済み。候補CSSの注入なし。
- `20261116-coop-ui-tidy-status.md`: 公開識別子・最終main・後片付けの確定結果を記載する。

公開記録のmain取り込みとcleanを確認後、今回のworktreeだけを削除する。元rootや他worktreeは削除しない。実スマホ、多人数実戦、Turnstileの認証合格・部屋作成は今回の表示確認では未実施。

最終main/取り込み確認と削除の確定結果は指定outboxの状態ファイルに記載する。ローカルmainは既存の別worktreeが使用しているため触らず、今回の専用HEADをorigin/mainへ同期して確認する。
