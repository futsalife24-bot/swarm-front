# 保留機能の統合検証（2026-11-10）

対象は `codex/resume-gameplay-20261110`。基点mainは `3f2c429c442c44d54bf4a8132cc791f30534ae9d`、統合製品HEADは `7fe26b9af49122343dea518ab44635b6f26d916d`、最初の記録HEADは `f0d29c85776db624bf60014d16497d6311369116`。後者は文書のみ。PRは [297](https://github.com/futsalife24-bot/swarm-front/pull/297)。CATENA Ω・候補2リファクタ・縦横モックをこのPRへ含めない。Worker公開は行わない。

| 確認 | 結果 |
| --- | --- |
| `npm run typecheck` | クライアント・Workerとも成功 |
| `npm run build` | 成功、48.81秒。既存のchunkサイズ警告あり |
| `npm run server:build` | 既存Worker設定のdry-run成功、515.94 KiB / gzip 132.38 KiB |
| `node node_modules/vitest/vitest.mjs run --config vitest.support-integration.config.ts` | 実ローカルWorker / WebSocketの7条件成功、33.20秒 |
| `npm run format:check` | 失敗。基点mainと同じ14ファイルの警告。今回の変更に警告増加なし |
| `npm test` | 通常sandbox・正式昇格の2回とも長時間化が続き、全体終了前に中断。全体合格ではない |
| step特性22条件 | 正式昇格の再実行で18成功、前線の既知4件不一致。更新対象6件は全成功 |

基点mainの検査は別worktree `task-refactor-worker-message-20261110` の記録 `2cc75da3c4fcf8cb04c21f40eb621ce350a37ef8`。全体1694件中1670成功・24失敗、format14警告、step特性22件中18成功・前線4件不一致。本人の「開始ゲート失敗なら候補2を止める」に従い、候補2は未実装。この記録は既存GitHubの `codex/refactor-worker-message-20261110` へpushし、remote SHA一致を確認した。

GitHubの公開APIによる事前確認では、同mainは `protected: false`、required status contexts/checksは空、`rules/branches/main` は空配列。設定変更・管理者バイパスは行っていない。最終HEADのチェックとmainの進行を反映前に再確認する。

武器段階1/2で意図した追加6件のsnapshot差は、元main・段階1のみ・段階2のみ・統合版の同一入力対照で原因を特定済み。元mainが旧期待値に一致することを確認してから6件だけ更新し、証拠commitを `50b303e96c9c52f03da51254682b98fa2b8ad484` として取り込んだ。製品コードの追加変更なし。既知の前線4件は更新しない。詳細は [武器調整の記録](../../EQUIPMENT-RESUME-20261110.md)。

最初の全体検査は通常sandboxで他の重い検査と並行して実行した。`structure-v2` の履歴生成340秒、`foundry-movement` の4条件43〜155秒、`harrow-model` の2条件86/212秒等の長時間化があり、全体終了前に主担当が中断した。途中結果は `npm-test-sandbox-interrupted.txt` に保存し、全件完了や成功とは扱わない。基点の実行権限は担当が正式昇格と記憶しているが当時のログには記載がなく未確証。実行環境・同時負荷を切り分けるため、他の重い検査を止めて正式 `require_escalated` で上記50b303eの `npm test` を再実行した。TEMP/TMPは同じ専用worktree内、テストの時間上限・判定・入力は変更していない。

再実行でも移動5条件（30〜118秒）、HARROW描画2条件（65/206秒）、協力シミュレーション1条件（31.86秒）の長時間化があり、同条件を無益に反復せず中断した。途中ログは `npm-test-elevated-interrupted.txt`。失敗名の機械照合は `partial-failure-comparison.json` で、基点24件のうち23件を今回も観測し、追加8項目を分離した。基点のST25失敗は今回の途中結果では未観測で、解消とは扱わない。追加8項目は既定の壁時計上限を超えているが、全体中断により最終エラー詳細は未集計であり、負荷原因だけと断定して合格にはしない。

CPUの読み取り測定でBlender接続補助4系統が負荷を占め、本体プロセスは0件だった。共有セッションへの影響を説明して本人へ確認し、「補助プロセス4系統を停止する」の明示承認を受領。対象のPID・起動時刻・子孫名を再照合してその4系統だけを停止し、当該対象の残存0件を確認した。ファイル・設定の変更なし。実行権限の変更だけでは時間切れが解消しなかったことも保持する。

補助停止後、追加8項目だけを既定条件で実行し、4成功/4timeout（`resource-retry.txt`）。HARROW翼加工と切断後の移動map1/2/4が成功した。残り4項目は検査Node親子のCPU優先度だけを起動時からAboveNormal（`os.getPriority(0)=-7`）へ揃え、すべて成功（`priority-retry.txt`、114.69秒）。移動map0の2条件は11.530/24.569秒、HARROW全中間姿勢は63.325秒、協力決定性は7.784秒。既定上限30秒/120秒とassert/inputは変更していない。これにより**追加8項目は分割確認ですべて成功**。最初の8件実行中にも検査NodeだけをAboveNormalへ変更したが、新しい子へ保証されなかったため、最後の4件は次の2行を一時preloadとして子にも適用した。`NODE_OPTIONS`は当該コマンドのtry/finallyで復元し、共有アプリの優先度は変更していない。

```js
const os = require('node:os');
os.setPriority(0, os.constants.priority.PRIORITY_ABOVE_NORMAL);
```

現在の残件: 全体検査の未完了範囲と既存失敗の照合、最終HEADのPR確認・通常merge。追加8項目の不合格と補助停止の承認待ちは解消した。全体合格とは区別し、PR297はDraftを維持している。

CATENAの最新版は本人の追加指示「Ωに忠実すぎるよ、自然に跳ねる感じね」に基づいて別branchで自然な跳躍へ調整中。これはPR297へ含めない。CPUを使う検証は担当間で直列化する。基点の24失敗/format14警告と候補2の開始ゲート停止は別途維持する。

HARROW実Renderer4条件、BASTION実WSと実Chrome、ソロ/協力のMD報酬実WS、支援報酬の保存・合成条件・説明画面、補給演出の26条件・3画面サイズ228場面は、各機能の記録を参照。模擬状態を使う画面確認と、実WebSocketによる権威処理の確認を区別する。実Android、長時間のバランス評価、公開版での通し確認は未実施。

主担当モデルID・推論設定は取得できず未確認。子2体の割当は `gpt-6-sol` / `high`（実行時の自己取得値は未確認）。Claude UI表示は `Opus 5.5` / 高。元rootの他担当12差分と既存worktreeは保持した。
