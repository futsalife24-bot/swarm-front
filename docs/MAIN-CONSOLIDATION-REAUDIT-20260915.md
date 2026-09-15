# main集約：独立監査の指摘への対応

## 受領した判定

Chat「スワフロgrilling」の独立監査を受領。対象head `d72871c58a9ffc374c1175e7e8d615e8e530b53d`、base `25d95e35ba1e5dfd9ad1ee088a5c72689c169fcd`、判定は要修正。mergeを止める指摘は、協力ロビーのstage受信が固定10を上限にしていること。

20面対応のWorkerと共通 `validStage()` に対し、クライアントだけST11〜20を無視する。既存ST7同期テストや、出撃後のworld.stageだけを見るST20テストでは検出できなかった。

監査で重点確認した保存・協力再出撃・代表的テスト・main運用文書には追加blockerなし。ただしローカルZIP/bundle/退避コピー・全バイナリ・実機・広告SDK・PWA・CI再実行は独立確認されていない。未確認事項を合格に読み替えない。

## 修正と回帰テスト

- `src/client/network.ts`: ロビー受信時のステージ判定をWorkerと同じ `validStage()` にする。範囲外値の拒否は維持。
- `e2e/lobby-stage-sync.spec.ts`: 2つのブラウザーcontextと実Workerで確認。ホストが11・20を選び、受信側ゲストの値を待ってから双方を照合。ゲストのステージ変更不可、ST20の出撃準備復帰、ホスト側準備待ち、ゲストready後の両者ST20保持と出撃可能を確認する。通信・stage状態への直接代入はしない。
- `docs/PROGRESSION.md`: 上限10についての過去記録に修正先の注記を付ける。

## 検証結果

- 修正前の同じ実通信テストは、ゲスト `#lobby-stage` で Expected `11` / Received `1` として失敗（`stage-sync-red.log`）。初回は作成ボタン名末尾の矢印によるテスト指定ミスで失敗したため、現行表記に合わせてから不具合を再現した。
- 共通判定への修正後は `1 passed (35.9s)`（`stage-sync-green.log`）。ST11、ST20、ゲスト出撃準備の20保持、準備中の出撃不可、ready後の双方20保持・出撃可能まで成功。
- `npm run typecheck`、`npm run build`、`npm run build:pages`、`npm run format:check` はすべて終了コード0。ログは `dist-validation/main-consolidation-20260915/stage-sync-*.log`。
- 以前に成功した無関係な327件・全E2Eは再実行していない。今回の変更はクライアント受信判定のみで、Workerコード変更・再公開はない。

テスト本体は通常の `npm run test:e2e -- e2e/lobby-stage-sync.spec.ts` でも選択できる。今回の実行ではローカルの検証用Playwright configでVite :5186と実Worker :8794を起動し、Chrome `--use-angle=d3d11`、`SWARM_TEST_ENDPOINT=http://127.0.0.1:8794` を使用。Workerは `wrangler dev --local --config wrangler.test.jsonc --ip 127.0.0.1 --port 8794 --persist-to .wrangler/main-consolidation-fixtures-final --log-level error`。contextのService Worker登録をblockしており、PWAの検証とは扱わない。

## 再監査への引き継ぎ

検証したコード/テストは `1fb2395e408170c13c2b665953f13c6d7fb30a63`。その後はこの記録とSTATE・PROGRESSIONの文書変更のみ。最終監査対象headはPR #3で固定して引き渡す。

今回の差分は旧監査headからの差分を対象にする。PR #3の新headをChatへ渡し、合格するまでmainへmergeしない。既存Workerの再公開は今回も行わない。
