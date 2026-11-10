# 候補2開始ゲートの実測と停止（2026-11-10）

## 基点と範囲

- 正本: `https://github.com/futsalife24-bot/swarm-front.git`。`git ls-remote origin refs/heads/main` は `3f2c429c442c44d54bf4a8132cc791f30534ae9d`、明示的な `git fetch origin main:refs/remotes/origin/main` 後も同SHA。
- 専用worktree: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-refactor-worker-message-20261110`。branch `codex/refactor-worker-message-20261110`、開始HEADは上記main、開始時clean。元rootの未コミット・未追跡成果は保持した。
- 候補1: PR296のmerge commitが同SHA。`docs/STATE.md` 先頭は対象実装HEAD `1c6a8a071e3ca690310b336f8f8acf0e8793c0cc` に対し、型成功、全体1694中19失敗、format14警告、特性22条件一致、build/Worker dry-run成功と記す。`tests/game-step-equivalence.test.ts` と固定snapshotは現行mainに存在し、テスト追加commit `2c97bc85c2d2ec86cb7550dc267e323ec1eb0b32` から現行mainまで変更なし。
- 既存rootの `node_modules` へのjunctionを本worktreeに作成。新規依存インストールなし。TEMP/TMPはこのworktreeの `docs/evidence/refactor-worker-start-gate-20261110/tmp`。対象HEADのコード、テスト、snapshotを変更していない。

## 今回の実行結果

| コマンド | 今回の実測 | 全文ログ |
| --- | --- | --- |
| `npm run typecheck` | exit 0、クライアントとWorkerの両tsc成功 | `docs/evidence/refactor-worker-start-gate-20261110/typecheck.txt` |
| `npm test` | exit 1、165ファイル中13ファイル失敗、1694件中1670成功・24失敗、snapshot4失敗。所要774.63秒 | `docs/evidence/refactor-worker-start-gate-20261110/npm-test.txt` |
| `npm run format:check` | exit 1、14ファイル警告（旧STATEと件数一致） | `docs/evidence/refactor-worker-start-gate-20261110/format-check.txt` |
| `node node_modules/vitest/vitest.mjs run tests/game-step-equivalence.test.ts` | exit 1、22件中18成功・前線4条件失敗。全体テストと並列時の初回、全体終了後の単独逐次再実行1回とも同じ4件・期待/実際SHAが完全一致 | `docs/evidence/refactor-worker-start-gate-20261110/step-equivalence.txt`、`step-equivalence-sequential.txt` |

全体テストの失敗24件は `aim` 1、`asset-download-manifest` 1、`bgm-layout-return` 2、`briefing-cache` 2、`enemy-report-motion` 1、`front-feedback` 1、`front-shot-origin` 6、**`game-step-equivalence` 4**、`maps` 1、`stages` 1、`standard-trooper` 1、`state-receipt` 1、`structure-v2` 2。旧STATEは失敗19件のファイル群を記すが個々の試験一覧はない。今回の24件との差5件のうち4件は特性テストで特定できる。残る1件を特定の試験や新回帰と断定しない。`structure-v2` の今回の2件はPLEATのHP期待差と90秒timeout。以前の個別内訳は未照合。

### 特性テストの4差

| 条件 | 期待SHA先頭 | 実測SHA先頭 |
| --- | --- | --- |
| 前線・生存・融合・1人 | `55bcffc5` | `af5b0bff` |
| 前線・生存・融合・2人 | `45d5e6e6` | `c64c67b3` |
| 前線・防衛・融合 | `c072c30f` | `74718c06` |
| 前線・旧方式 | `e93f1b32` | `67e0ba97` |

上記4件では他の集計項目（ticks、phase、time、wave、seed等）はsnapshotと一致し、毎tickのrun全体SHAだけが異なる。全体実行でも同じ4件、単独逐次再実行でも期待/実測SHAが一致したため、並列負荷だけの偶発ではない。`front-run.ts` は `options.day ?? new Date().toISOString().slice(0, 10)` を使い、返すrunに`day`を含む。特性テストの4条件は`day`を指定せず、成功した日替わり条件は`2026-09-20`を固定している。snapshot追加commitは2026-11-10 07:59 JST（UTC 11/9）、今回の試験はUTC 11/10。**実行日によるハッシュ差が原因と強く推定できる**が、日付固定での対照実験はしていない。実装の挙動差なしと証明した扱いにはしない。snapshot更新・時計変更・テストの書換えは行っていない。

## 判断と再開条件

ご本人は候補1の開始ゲートで、通常の既存失敗でも不合格なら候補2を止めるよう指示した。今回 `npm test` と `format:check` に実失敗があるため、`server/worker.ts` の `Room.webSocketMessage` 分割へ進まない。既存失敗の修正、仕様変更、候補3、描画/画面系ファイル、外部送信、公開は今回の範囲外。証拠のローカル保存だけを行う。

再開には、最新mainの同一HEADを明記して4チェックを全て成功させ、失敗24件とformat14件の扱い、特性4件の日時依存を解消した証拠を記録する必要がある。スナップショットを無条件に更新して合格扱いしない。ご本人の次指示を受けるまで候補2実装は保留。
