# legacy進撃の実通信互換確認（2026-10-30）

独立監査ではなく、主担当の依頼による実装の検証補助。現行の既存ローカルWorker `http://127.0.0.1:8793` を使用し、新規Worker起動・他process停止・製品ソース変更を行っていない。

`tests/network.test.ts` を既存 `vitest.integration.config.ts` のまま選択実行した。`SWARM_TEST_ENDPOINT` と `SWARM_FIXTURE_ENDPOINT` を8793へ指定し、credentials helperが既存.dev.varsからキーを内部読取。認証値・token・room codeは会話・可搬証拠へ出力しない。

## 結果

6件成功、0件失敗、対象外7件skip。実行前healthは200。

- 4人参加と5人目拒否。
- 2socket間の敵HP・撃破数・戦況一致、途中参加拒否、同一identityでの再接続。
- 不正入力・受信サイズ超過・送信洪水の拒否。
- 通常v2/legacy武器の端数、弾倉、戦闘送信、報酬、保存後の再装備、無効武器の拒否。
- ABA stage変更、他参加者装備変更、再接続後の古い準備完了を拒否し、現世代全員readyでのみ開始。
- 現行Networkの即時chat連投防止、装備変更時のassetReady解除。

既存ClientはhelloでstateTuples/stateChunksを交渉しない旧形式のため、新Workerが旧wire互換を保つ経路を含む。現行Networkの確認は上のロビー操作範囲で、旧server実体を別起動した試験ではない。HARROW/大量弾/実描画/実スマホ/本番回線や全integration13件の成功とは扱わない。

## 証拠

可搬要約と対象コードSHA: [legacy-compat-results.json](legacy-compat-results.json)。実行前後の8対象source hashは一致し、確認中にこの範囲のコード変更がなかった。

元のJSON reporter、run.log、source-before/source-after、既存テストが生成した武器/ready証拠のコピーは `dist-validation/coop-comfort-20261030/legacy-compat/`。生成先に既存証拠があった場合はbefore-*へ保全してから実行した。元の既存テスト・期待値・fixture手順を変更していない。

実行:

`node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts --maxWorkers=1 -t 'accepts four participants|two sockets share enemy HP|rejects invalid input, oversized packets|preserves normal v2 and legacy weapon stats|rejects stale readiness after ABA|client blocks immediate chat repeats' --reporter=json --outputFile dist-validation/coop-comfort-20261030/legacy-compat/results.json`

上記2環境変数はこの実行process内だけで指定。過去に接続先を固定した8789用の別3件、長い放置・50chat等の対象外試験は実行しなかった。

commit/push・公開・本番操作なし。実モデル/effort実値は未確認、呼出指定gpt-6.1-sol/high。
