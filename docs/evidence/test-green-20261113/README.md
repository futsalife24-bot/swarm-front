# 既存の試験失敗とformat警告の一掃（2026-11-13）

目的は、`npm test` と `npm run format:check` を最新mainで全件成功させ、以後の統合・リファクタ・マルチ改善の基準線にすること。

- 作業場所: `task-test-green-20261113`（別worktree）、branch `claude/test-green-20261113`、基点 origin/main `aa886b0df6bd57c331b6308bdd2c31e49941bce7`。
- 環境: Windows 11、Node v24.19.0、npm 11.17.0、`npm ci` 済み。試験は既定設定（`testTimeout` 30秒、ファイル直列）のまま。
- 独立Chat監査なし（2026-10-15方針）。自己レビューと下記の機械照合のみ。

## 結果

| 検証 | 基準線（`aa886b0d`） | 最終（`9f321ca0`） | 生ログ |
| --- | --- | --- | --- |
| `npm run typecheck` | 成功 | 成功（終了コード0） | `final-typecheck.txt` |
| `npm test -- --reporter=verbose` | 1766件中16件失敗・10ファイル・snapshot 5件、359秒 | **1766件すべて成功・172ファイル、255秒（終了コード0）** | `baseline-full-test.txt` / `final-full-test.txt` |
| `npm run format:check` | 16ファイル警告（終了コード1） | **警告0（終了コード0）** | `baseline-format.txt` / `final-format.txt` |
| `npm run build` | — | 成功（終了コード0） | `final-build.txt` |
| `npm run server:build`（dry-run） | — | 成功（終了コード0） | `final-server-build.txt` |

5つの終了コードと対象HEADは `final-summary.txt`。最終ログ取得後の変更は、`tests/maps.test.ts` のコメント内の日付1か所（再実行して6件成功）と、この記録・STATEだけ。

skip / only / quarantine、timeout延長、assertの削除は行っていない。期待値は実測値の転記ではなく、製品の定義値（半径×倍率、踏み込み距離など）と仕様文書から導出した。

## 基準線と依頼時一覧の照合

依頼時の一覧（2026-11-10、`../catena-resume-20261110/integrated-full-comparison.json` の23件）と機械照合した。

- 開始時点で既に合格していたもの: 8件（下表の「解消済み」）。今回は変更していない。
- 引き続き失敗していたもの: 15件。
- 一覧に無い新規の失敗: 1件（`game-step-equivalence` の「前線・日替わり・融合」）。
- 合計16件を今回修正した。

## 失敗ごとの分類・原因・修正・根拠

分類は (a) 試験が古い、(b) 製品の不具合、(c) 環境・時間依存。**(b) は0件**で、ゲームルール・報酬・保存形式・難易度は変更していない。

| # | 試験 | 分類 | 原因 | 修正 | 根拠 |
| --- | --- | --- | --- | --- | --- |
| 1 | `aim.test.ts` ロケットの中心命中 | a | 着弾点と敵中心の距離を固定値1.25m（倍率1の半径）で期待。2026-09-19の全敵1.5倍化で当たり判定半径は1.875m | 期待値を `ENEMIES.crawler.radius * enemySize(e)` から導出し、倍率1.5も明示確認 | commit `ce32074d`、`docs/MONSTER-SIZE-150.md`、`enemyBodies()` の半径式 |
| 2–3 | `bgm-layout-return.test.ts` 2件 | a | 実 `pause()` を切り出して実行する検証器に、後から `pause()` が使うようになった `cancelOperationCue` と `world` が無く ReferenceError | 検証器へ2つを追加。作戦表示の停止が「最初の停止」と「配置画面から戻った後の再停止」の2回呼ばれることも確認 | commit `a7de3990`（作戦表示の中断）、`src/client/playtest-app.ts` の `pause()` |
| 4–5 | `briefing-cache.test.ts` 2件 | a | `front` 入口はSWが扱わない前提のまま。2026-10-30のPWA事前保存で、入口HTMLは通信優先で取得しroot/indexとfrontを別キーへ保存する仕様になった | `front` 3経路を「扱わない一覧」から外し、`front.html` キーへ保存されること、rootは `index.html` キーへ保存されることを確認。briefing・admin・api・rebuild-p1a の除外確認はそのまま | commit `61559830`、`../coop-comfort-20261030/pwa-implementation.md`（「root/indexとfrontの入口を別々に扱う」） |
| 6 | `enemy-report-motion.test.ts` ミサイル10発 | a | HARROW演出グループの子に、2026-10-26採用の立体予告（突進・爆撃専用）が1つ増え、子の並びの完全一致が崩れた | 立体予告を名前で取り出し、上向きミサイルでは0本・非表示であることを確認。従来7要素の並びは値を変えずに照合 | commit `39fc988d`、`docs/STATE.md`「承認済みのHARROW立体予告」 |
| 7 | `front-feedback.test.ts` 最大密集の64KiB | a | `server/worker.ts` の実 `broadcast` を切り出す目印（`broadcast() {`）が引数追加で一致せず、検証器が起動前に失敗。配送処理も `state-delivery.ts` へ分かれていた | 現行の `send` / `sendEncoded` / `broadcast` と配送補助を実コードのまま実行する形へ組み直し、配送クレジット・分割・差分も実物を使用。判定状態の件数確認は維持し、弾・経験値・地雷の件数確認を追加。下記「64KiB」参照 | `server/worker.ts`、`server/state-delivery.ts` |
| 8–11 | `game-step-equivalence.test.ts` 前線・旧方式／生存1人／生存2人／防衛 | c＋a | 下記「step同値」参照。日付依存（4件共通）と、表示用項目の追加（融合3件） | 採取時のUTC日付を入力として固定。融合3件のスナップショットを更新 | `step-front-causality.json` |
| 12 | 同「前線・日替わり・融合」（新規） | a | 表示用項目の追加のみ（日付は元から指定済み） | スナップショットを更新 | 同上 |
| 13 | `maps.test.ts` 晶脈の地底巣 | a | 全敵種を洞窟へ出して出現位置を確かめるが、HARROWは地上34.5mの空中から現れる仕様（2026-09-24）で、天井のある洞窟では岩の中になる。製品でHARROWが出るのは草原マップの3作戦だけ | 洞窟ではHARROWを対象から外し、代わりに「洞窟マップにHARROWを出す作戦が無い」ことを確認する条件を追加（追加された時に失敗する）。他の全敵種・全マップの確認はそのまま | commit `4da040d1`、`src/shared/stages.ts`（HARROWは map 3 のみ） |
| 14 | `standard-trooper.test.ts` 回避とheavy clip | a | PLEATは2026-11-06から「0.8秒予告→4mを0.3秒で踏み込み、経路上で各隊員1回命中」。試験は予告終了tickの即時被弾を期待 | 踏み込み完了まで進め、被害が定義値ちょうど1回分であること、heavy clipが出ないことを確認（従来の「減った」より厳密） | commit `e0a7c635`（PR288）、`../pleat-pressure-20261106/README.md` |
| 15 | `state-receipt.test.ts` front接続 | a | 現行クライアントは生存の専用武器編成に未対応の通信先を旧版として切断する。試験のwelcomeに `frontSurvivalBuild: 1` が無く、切断されていた | 対応済みサーバーのwelcomeを再現 | commit `9dcdeea6`、`src/client/front-network.ts`、`server/worker.ts` のwelcome |
| 16 | `structure-v2.test.ts` PLEATの予告から衝撃波 | a | #14と同じ | 予告終了tickは無被害で踏み込みが始まること、6〜7tickで4m進むこと、正面の1人だけが定義値どおり1回被弾することを確認 | #14と同じ |
| — | `asset-download-manifest.test.ts` 1件 | 解消済み | 開始時の最新mainで合格（武器モデル統合 `341ecd6b` で試験が更新済み） | なし | `baseline-full-test.txt` |
| — | `front-shot-origin.test.ts` 6件 | 解消済み | 同上（`117d6281`、`341ecd6b`） | なし | 同上 |
| — | `pleat-pose-wire.test.ts` 1件 | 解消済み | 同上（`f1705edf`、依頼文の「修正済み」1件） | なし | 同上 |

### step同値（リファクタ候補2の開始ゲート）

結論: **非決定性は無い。** 前線5条件の不一致は、試験入力の日付依存と、意図した表示用項目1つの追加で全て説明できる。

1. 同一プロセスで2回実行した結果は5条件とも一致（基点・現行の両方）。
2. `createFrontRun` は `day` 省略時に実行日のUTC日付を run 状態へ保存する（`src/shared/front-run.ts`）。試験は run 全体を直列化するため、日付を渡していない4条件は採取日にしか一致しなかった。スナップショットの採取は commit `2c97bc85`（2026-11-10 07:59 JST＝UTC 2026-11-09）。`day: "2026-11-09"` を固定すると「前線・旧方式」は**スナップショット無更新で一致**した。生存・防衛では `day` は記録値で、seedや敵の出方には使われない。
3. 分割前の基点 `303b7745` と現行 `aa886b0d` を毎tick・項目単位で比較した。融合4条件の初差は tick 0 で、差分は各隊員の武器に追加された `appearanceTier: 1` だけ。この項目を除くと**全tick（800〜1500）が基点と一致**した。試験本体の直列化から同項目だけを一時的に除いても、旧スナップショット5件すべてに無更新で一致した（確認後に元へ戻した）。
4. `appearanceTier` は強化後も武器の見た目を保つための表示用の値（commit `0e7bde8c`、PR319、独立再監査合格）。数値・判定順・乱数の消費順は変わっていない。
5. 以上から、融合4条件のスナップショットを更新した。差分は `sha256` の4行だけで、`time` / `kills` / `serial` / `seed` / `events` などの要約値は不変。

再現: `step-front-diag.ts` は対象commitの `src/shared` と同じ階層へ置いてesbuildで束ねる診断（`IGNORE_KEYS=appearanceTier` で項目を除外）。結果は `step-front-causality.json`。

残る注意: 製品の `createFrontRun` が `day` を省略時に実行日から取る点は変更していない。試験で前線の run を直列化する時は `day` を必ず渡すこと。

### 64KiB（B-4 マルチ快適化への引継ぎ）

判定状態は落としていない。4人・敵97・弾100・経験値160・地雷20・演出160件の最大密集で、実 `broadcast` が4人全員へ切断（4009）なしで送信できることを確認した。実測は `front-feedback-wire-sizes.txt`（`FRONT_FEEDBACK_SIZES=1 npx vitest run tests/front-feedback.test.ts --reporter=verbose` で再取得できる）。

| 受信側 | 装備キャッシュ | 1通のサイズ | 上限までの余裕 |
| --- | --- | --- | --- |
| 旧クライアント（素のJSON） | なし | 65,520バイト | 16バイト |
| 旧クライアント | あり | 65,388〜65,389バイト | 約147バイト |
| 現行クライアント（省略・タプルv2・PLEAT姿勢・分割・差分） | なし | 59,467〜59,470バイト | 約6,066バイト |
| 現行クライアント | あり | 58,346〜58,349バイト | 約7,187バイト |

- 旧クライアント向けは、古い演出イベントを削って上限ぎりぎりへ収める設計どおりに動いている。**余裕は16バイトしかない**ため、戦況へ項目を1つ足すだけで削られる演出が増える。削る対象が演出の間は切断にならないが、判定状態だけで上限を超える構成になると4009で切断される。
- 現行クライアント向けは初回の全量送信でも約59KB・1フレームに収まる。2通目以降の差分送信のサイズはこの試験では測っていない。
- これは `broadcast` を単体で実行した検証で、実WebSocket・実回線の確認ではない。B-4では、敵・弾・状態の上限値を上げる前にこの試験へ同じ条件を足して余裕を測ること。

## format

`prettier --write` で13ファイルを整形した。

- 製品側9ファイル（`src/client` 6、`server` 3）と試験・設定3ファイルは、整形前後を `scripts/check-format-only-diff.mjs` で照合し、12ファイルすべて意味同一（`format-only-diff.json`）。CSSは `.28em`→`0.28em` のような数値表記の差も含めて正規化して比べた。
- `tests/fixtures/save-regression/` のJSON 3件は、`index.mjs` が `manifest.json` のSHA-256とbyte単位で照合する固定入力のため整形せず、`.prettierignore` で除外した。同じ場所の `README.md` は表の桁揃えだけ整形した。
- 基準線の警告は16ファイル（依頼時の14＋`combat-effects.ts`、`supply-result-actions.ts`）。

## 所要時間とtimeoutの安定性

| 実行 | 条件 | 全体 |
| --- | --- | --- |
| 2026-11-10の記録 | 専用プロセス | 548秒 |
| 基準線（今回） | 開始時にtypecheck・formatと重複 | 359秒 |
| 修正後1回目 | 単独 | 287秒 |
| 最終（`9f321ca0`） | 単独 | 255秒 |

- 3回ともtimeoutによる失敗は0件。
- **時間依存の不安定要因を1つ解消した。** `structure-v2.test.ts` の「更新履歴に旧表現がない」は、更新履歴の生成器がcommitごとにgitを3回起動するため、履歴の増加に比例して遅くなっていた（11/10は77.7秒、今回の基準線35.8秒、上限90秒）。`scripts/automatic-changelog.mjs` を、first-parentの履歴を1回の `git log` で読む形へ変更。旧生成器と結果が完全一致することを `scripts/check-changelog-equivalence.mjs` で確認（47日分・195項目、`changelog-equivalence.json`）。生成は32.6秒→0.3秒、同ファイルの試験は約36秒→約4秒。buildの更新履歴生成も同じ分だけ速くなる。
- 最終実行で重いのは `foundry-movement`（37.9秒）、`stages`（34.1秒）、`harrow-model`（27.7秒）、`game-step-equivalence`（14.0秒）の4ファイルで、試験時間の合計165.6秒の約69%を占める。
- 所要時間はPCの負荷で大きく変わる。単体で最長の `harrow-model`「全レポートclipの中間姿勢」（個別上限120秒）は、11/10の記録で77.1秒、他の検証と重なった基準線で33.3秒、単独の最終実行で19.0秒。上限内だが、重い検証を並行させると余裕が半分以下になる。全体テストは他の重い処理と同時に走らせないこと。

### 通常の `npm test` を短くする案（未実施）

試験の意味・対象が変わるため、今回は実施していない。

1. 上記4ファイル（全経路の移動・全ステージ完走・全clipの姿勢・step全状態）を `npm run test:heavy` へ分け、通常の `npm test` は残りだけにする。効果は試験時間の約7割。反映前の検証では両方を実行する決まりが必要で、片方だけの成功を全体合格と呼ばない運用にする。
2. vitestの `isolate: false`（ファイル間でworkerを再利用）。vitest自身の見積りで約20秒短縮。fake timerやグローバルの差し替えを使う試験があり、相互干渉しないことの確認が先に必要。
3. `harrow-model` の中間姿勢検査は、clipごとの独立した試験へ分けると1件あたりの時間が下がり、30秒上限への余裕が増える（合計時間は変わらない）。

## 公開

**既存Workerへの公開は行っていない（不要と判断）。** 変更は試験、検証スクリプト、整形、buildスクリプトの内部処理で、配信物の動作は変わらない。

- 製品ソースの差分は整形のみで、意味同一を機械照合済み。
- 更新履歴の生成結果は旧生成器と完全一致。
- 次回の公開時に、更新履歴へ「内部処理の整理（遊び方・性能の変更なし）」が1項目入る（commit本文の `Player-Note`）。

実画面・ローカルWorkerでの動作確認は行っていない（製品の挙動を変えていないため）。

## 未確認・残る制限

- 実WebSocket・実回線・実機での確認はしていない。64KiBの確認は `broadcast` 単体の実行。
- 洞窟マップ×HARROWは製品に存在しない組合せとして試験対象から外した。`game-step-equivalence` の「通常・洞窟・全種を直接配置」は試験専用にこの組合せを含むが、状態の一致確認が目的で出現位置の妥当性は見ていない。洞窟へHARROWを出す作戦を作る時は、出現高度の扱いを先に決める必要がある。
- `npm run test:e2e`、`test:save:browser`、各 `test:*:integration` は今回の対象外で実行していない。
- リファクタ候補2・3の本体、マルチ快適化の本体は範囲外。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `baseline-*.txt` | 基点 `aa886b0d` での typecheck / 全体テスト / format の生ログ |
| `final-*.txt`、`final-summary.txt` | 最終 `9f321ca0` での5検証の生ログと終了コード |
| `step-front-causality.json`、`step-front-diag.ts` | 前線5条件の初差tick・項目と、項目除外後の全tick一致 |
| `front-feedback-wire-sizes.txt` | 最大密集時の実送信サイズ |
| `format-only-diff.json` | 整形前後の意味同一の照合結果 |
| `changelog-equivalence.json` | 更新履歴の新旧生成結果の一致と所要時間 |
