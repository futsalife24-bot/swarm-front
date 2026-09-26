# 保存・更新・再開の回帰テスト

対象リポジトリ: https://github.com/futsalife24-bot/swarm-front 。今回の検証開始点はmain `782543709a7479fdeabd9114df48d47bc95a3f1d`、作業branchは `codex/save-regression-baseline`。既存作業場所に別件の差分があるため、独立した作業コピーを使用した。保存形式・ゲーム本体・通信・配信設定の変更はない。

## 次回の最小セット

完全なGit履歴、固定依存（`npm ci`）、インストール済みChromeを用意して、リポジトリルートで実行する。

```powershell
npm run test:save
npm run test:save:browser
```

前者は既存9ファイル＋追加1ファイルの147件。後者は自分専用のloopbackポートでViteを起動し、実Chromeの新規・隔離BrowserContextで保存競合7ケース、固定fixture等10ケース、分解済み報酬の回復3ケース、戦闘再開1シナリオ（3回の再開＋合成勝利の報酬）を順に実行する。通常のユーザープロファイルと本番URLは使用しない。終了時に自分のViteを閉じる。

ブラウザ結果は `dist-validation/save-regression/<UTC開始時刻>/results.json`。コマンド別exit code・実測秒数・開始/終了時刻・HEAD・dirty状態・実行時ソースとfixtureのSHA256を残す。途中失敗は全体PASSにしない。過去の `docs/evidence` や以前の結果ファイルを今回の合格証拠へ流用しない。

## 保存対象と保証の境界

| 対象 | 仕様/期待値 | 自動テストの対応 | 今回の確認 |
| --- | --- | --- | --- |
| 通常保存→再読込 | 現行キー `swarm-front-shared-progress-v3`、本文versionは2。revision更新後に同じ内容を読める | `shared-armory`, `save-regression`、実Chrome `check-save-fixtures` | 合成進行を実localStorageへ保存・3回のページreloadで一致 |
| 武器・育成・アクセサリ | 旧武器性能、装備、ロック、兵士ごとの育成/装備、選択兵士、アクセサリ、通貨・ミッションを保持 | `shared-armory`, `playtest`, 固定progress-v2/shared-v2 | 単体5回・実Chrome3回の保存/読込で保持 |
| 旧v1武器庫 | `swarm-front-save-v1`。旧性能式を保持し、移行前の生文字列をbackupに保存 | `game`, `armory`, `shared-armory`, 固定inventory-v1 | 元キー/backupのbyte一致、再移行なし |
| 旧通常v2/旧共通武器庫 | `swarm-front-progression-v2-normal`。`armoryMigration`有無を分岐し、旧タブの更新が新キーを巻き戻さない | `shared-armory`、`check-save-safety`の旧実モジュール2版、固定fixture2種 | 旧実writerと新タブを併存させた実Chrome検証成功 |
| ステージ途中→再開 | 通常ソロ、生存中・戦闘中のみ。約5秒間隔、pause/pagehideでも保存 | `playtest-checkpoint`、`check-battle-checkpoint` | 実UI開始→pause→reload→再開を3回。再開前World全体と進行保存が一致 |
| 敵・Wave・StagePlan | seed、time、敵/HP、Wave/spawned、戦場状態、固定StagePlanを保持。旧編成は現行バランスで置き換えない | `playtest-checkpoint`。旧ST7/ST18/ST20、3-A、15-A/ST25、HARROW移行を含む | メモリ上の保存経路と実localStorageの両方。ただし全ステージの実ブラウザ攻略ではない |
| checkpoint旧v1–v4 | 保存キー名はv1のまま、envelope内部versionは現行4。v1旧編成復元、v2/v3のHARROW安全移行、v4の再移行なし | `playtest-checkpoint`内の歴史形式envelope（合成） | 今回実行。固定JSONの進行fixtureとは別の合成checkpoint群 |
| 報酬の二重取得 | run receipt・武器receiptを保持。再読込/競合回復/既に分解した武器の復活を防ぐ | `shared-armory`, `playtest`, `armory`、`check-save-safety`、拡張checkpoint | 合成勝利→保存→reload→同run再受取を試し、武器1本・通貨1回・checkpoint無効を確認 |
| 複数タブ/書込み競合 | Web Locksで通常/協力のwriterを1つに限定。旧revision保存を拒否し、最新装備を維持して未保存戦果の差分のみ回復 | `shared-armory`、`check-save-safety` | 実Web Locks/実localStorage。タブを閉じた後の取得、非戦果のreload/retryも確認 |
| 容量不足/書込み失敗 | 保存失敗を通知し、成功前のrevisionと保存済み内容を守る。戦果journalを成功まで保持 | `shared-armory`, `playtest`、`check-save-safety` | 単体の例外注入に加え、Chrome実容量上限を使う失敗→再試行→回復 |
| 欠損・破損・未知版 | キー不在は新規開始。存在する不正データは上書き停止・書出し。checkpoint破損でも進行は保持 | `game`, `armory`, `save-regression`, `playtest-checkpoint`, `check-save-fixtures` | JSON切断/null/空object/未知version/必須項目欠損を実画面で拒否・原文書出し、checksum不一致も保持 |
| 進行変更後の古いcheckpoint | 進行スナップショット不一致または受領済みrunは再開不可 | `playtest-checkpoint`、拡張checkpoint | 今回成功。古い戦闘を巻き戻して報酬再取得しない |

`rewards`だけの純粋関数テストやMap保存は、端末永続化の成功証拠として単独では扱わない。今回のブラウザ検証は実localStorageとページreloadを使用する。OS強制終了後のディスク耐久性までは保証しない。

## 既存テスト一覧と追加実行の選び方

| 区分 | ファイル / 入口 | 用途 |
| --- | --- | --- |
| 最小セットの既存9ファイル | `tests/shared-armory.test.ts`, `armory.test.ts`, `game.test.ts`, `p1.test.ts`, `training.test.ts`, `playtest.test.ts`, `playtest-checkpoint.test.ts`, `playtest-boundaries.test.ts`, `playtest-economy.test.ts` | 通常/協力共通武器庫、旧保存、受領/回復、再接続データ、報酬/育成、checkpointと進行境界。ファイル単位で実行し関連する既存ケースも維持 |
| 追加した単体 | `tests/save-regression.test.ts`（9件） | 固定fixture3種、破損5種、欠損/削除後の古い書込み |
| 既存ブラウザ | `scripts/check-save-safety.mjs`（7ケース） | writer排他、旧実writer2版、戦果回復3経路、設定競合 |
| 既存ブラウザ | `scripts/check-recovery-receipts.mjs`（3ケース） | 同run/後続runで分解済み報酬が復活しない、未受領差分を1回だけ反映 |
| 拡張したブラウザ | `scripts/check-battle-checkpoint.mjs` | 既存の1回再開を3回へ拡張、再開後の合成勝利・実報酬保存・二重受取拒否 |
| 追加したブラウザ | `scripts/check-save-fixtures.mjs`（10ケース） | 固定fixture3種、破損5種、未作成、checkpoint破損 |
| 攻撃/地形変更時の追加 | `tests/harrow.test.ts`, `jump-audit-regressions.test.ts`, `calyx.test.ts`, `state-wire.test.ts` | 飛翔物・旧地形への埋没/構造物変更・敵攻撃状態・通信snapshot。今回この追加群は未実行 |
| 作戦ID/設定互換の追加 | `tests/playtest-campaign.test.ts`, `aim.test.ts`, `frame-pacer.test.ts` | 旧3-Aの進行をST21と混同しない、15-Aの保存、旧感度/gyro/フレームレート設定の互換 |
| 日次/週次/クラウド変更時の追加 | `tests/playtest-defense.test.ts`, `playtest-weekly.test.ts`, `playtest-vault.test.ts`, `rewarded-ad.test.ts` | 日次保証/中断、週次二重受領、クラウドrevision/巻戻し/認証、SDK未接続時の拒否。今回未実行。vaultのfake storageを実クラウド証明にしない |
| 実通信変更時の追加 | `tests/network.test.ts`、`e2e/coop.spec.ts`, `coop-result.spec.ts`, `reward-choice.spec.ts`, `stage-clear-coop.spec.ts` | 実ローカルWorker、再接続、協力戦果。今回未実行 |
| 通し攻略/関連UI変更時の追加 | `e2e/mission.spec.ts`, `pause.spec.ts`, `training-scope.spec.ts`, `armory-ui.spec.ts` | 自動操縦での勝利・報酬装備・再出撃、pause、訓練隔離、装備UI。今回未実行 |
| 個別の既存補助スクリプト | `scripts/check-cloud-client.mjs`, `check-continuity-ui.mjs`, `check-playtest-audit.mjs`, `check-playtest-boundaries.mjs`, `check-weekly-title.mjs` | クラウド復元、更新/継続UI、旧test-modeの報酬/境界、週次表示。今回未実行。固定ポート・旧管理者導線など実行前に現行との対応確認が必要 |
| 保存をseedに使うUI補助 | `scripts/check-frame-rate-solo.mjs`, `check-gear-ui-baseline.mjs`, `check-hidden-copy.mjs`, `check-playtest-motion.mjs`, `check-resource-frames.mjs`, `check-title-layout.mjs`, `check-weapon-rarity-glow.mjs`, `check-weapon-realism-motion.mjs` | 保存APIの利用は主に画面/描画fixture準備。これだけで保存の回帰保証に数えない。今回未実行 |

通常の `npm test` は列挙式の `vitest.config.ts` を使い、checkpointを含むplaytest群を含まない。回帰の入口は専用 `vitest.save.config.ts`。リポジトリにGitHub Actions workflowはなく、CI・権限・料金の設定は追加/変更していない。

| 変更 | 最低限 | 追加 | 必要時の全体 |
| --- | --- | --- | --- |
| 文書のみ | 内容/リンク/差分確認 | なし | なし |
| 保存・装備・育成・報酬・再開 | 上の2コマンド、`npm run typecheck` | 関係する追加群と関連build | 共通形式・広範囲変更は `npm test` とplaytest config全件 |
| StagePlan・敵状態・地形 | 上の2コマンド、型 | 上記攻撃/地形の4ファイル | campaign通し試験と影響マップの実UI |
| クラウド/協力通信 | 上の2コマンド、型 | vault/weekly/defenseと実Worker/E2E | 権限・サーバーbuild・実通信の範囲を個別に決める |

## 今回の結果・限界

2026-09-26 JST、Windows、Node v24.14.1、npm11.11.0、Chrome153.0.8010.53。最初に既存単体71件（9.13秒）とcheckpoint/進行61件（7.64秒）、既存ブラウザ7ケース（52.76秒）を実行した。その後、専用セット147件（13.90秒）・型チェック（3.35秒）が成功。

ブラウザ統合実行 `2026-09-26T02-20-31-082Z` は18ケース/シナリオ成功、実測164.66秒（Vite起動等含む）。内訳は競合7ケース50.91秒、fixture等10ケース55.33秒、途中再開44.77秒。再開3回の各snapshotには敵3体・Wave1・2秒以上進んだ経過時間が存在した。再開テストには空の戦場での自明な一致を避けるassertionも追加した。ソースはbaseからゲーム本体不変・テスト差分ありの状態で実行し、ソースhashを保存。commit後に走ったという記録ではない。

追加テストの初回は旧v1移行時の取得順を0/1/2とした期待値の誤りで1件失敗した。既存仕様のserial開始値3に合わせて3/4/5へ修正し、147件で再成功。保存処理本体の不具合修正ではない。

追加確認でcampaign互換6件（Vitest 1.89秒）、旧設定互換2件（5.56秒、無関係20件はfilterでskip）が成功。途中再開の単独再実行では、初会敵UIの読込が従来スクリプトの固定待ち時間を超え、pause操作でtimeoutが1回発生した。テストを通常のスキップ操作と実戦開始条件を待つ方式へ変更し、失敗時JSON/画像も保存する。ゲーム側は変更していない。

最終の統合実行は `2026-09-26T02-28-30-039Z`、対象commit `6c3e859fdb520638758642e87cff80ca2252e4bf` のclean状態で全21ケース/シナリオ成功。実測245.18秒、内訳は競合91.39秒、固定fixture71.67秒、分解済み報酬21.21秒、途中再開44.36秒（合計との差はVite起動等）。実行中の159ファイルのSHA不変を照合した。先行した単体147件のテスト/fixture/config内容はこのcommitでも同一。追加互換8件と合わせて関連単体155件が成功した。[機械可読記録](evidence/save-regression/20260926.json)。

初回独立監査は [通常Chat](https://chatgpt.com/c/6ab72f35-0dc8-83ee-ab05-ece436487714) に上記SHAを送信。ZIPは `save-regression-audit-6c3e859.zip`、957,341 bytes、SHA256 `16164965650c7a0588457d02700dcb6b290ea60026a0bcda130ca2bea17dc5bb`。判定は必須P2が1件（下記checkpoint更新停止の見逃し）、P0/P1なし。固定fixture・実行入口の作り直しやruntime変更は要求されていない。

監査側は添付203ファイル・実行時159ファイルのハッシュを照合し、隔離Node/Mapで保存境界・故障条件と実行入口の失敗判定を独立確認した。固定依存を取得できない環境のため、標準Vitest155件・型・実Chrome21ケースを独立再実行した判定ではない。GitHub上のGitオブジェクトとの独立照合も未実施。任意指摘はfixture来歴ログ/書出し原本の同梱補強と証拠索引の明確化。`checkpoint-final.log` は修正前timeoutの記録で、最終成功はUTC時刻別出力と機械可読記録を参照する。

### checkpoint更新停止の検出を追加

監査中の反証確認で、最初のcheckpoint保存後に更新が止まっても、毎回その古いWorldへ戻るだけで再開検査が通る余地を確認した。`cc6b45c0b6f2b2155fddc211b1d364da3bd9d8b1` はテストだけの20行追加。各再開後に実時間を進め、pause後の実localStorageのWorld/進行が実行中状態と一致し、保存時刻・戦闘時刻が前回より進むことを検査する。

隔離ブラウザで初回保存後のcheckpoint `setItem` だけを落とす反例を使用し、修正前は誤って成功（exit0、49.26秒）、修正後は状態不一致のassertionで失敗（期待exit1、53.34秒）、改変なしの実保存では成功（exit0、101.28秒）。失敗を成功扱いするテストではなく、検査が回帰を検出できることの証拠。3回の保存時刻は戦闘時刻0.90→1.25→1.60秒に対応し、各実状態と一致した。[反例と差分再検証](evidence/save-regression/checkpoint-refresh-20260926.json)。変更のない他のテスト/ゲームソースは再実行していない。

監査依頼文の「敵3体」は先行18ケース実行の値を取り違えた説明で、機械証拠を訂正していない。cleanな21ケース実行では1/1/1体、上記修正版の再開直前は1/1/2体。保証は非空の敵状態の保存一致であり、3体固定の検証ではない。

再監査依頼文の「同じevaluateで取得」は説明の誤り。実コードはpause後にメモリ状態と保存checkpointを2回のevaluateで取得し、paused/World/進行を比較する。提出ソースと実行証拠を正とし、原子的な単一取得を保証したとは扱わない。

### 独立再監査の判定

同じ通常Chatの限定再監査は **PASS、必須P0/P1/P2各0件、F1解消**。対象テストSHAは `cc6b45c0b6f2b2155fddc211b1d364da3bd9d8b1`。ZIPサイズ/hash、20行の差分、実行コードhash、正常・負例ログを照合した。監査側は比較部分を抽出して継承runtime・隔離Map・合成page操作で12の期待結果を独立確認した。これは正規単体や実Chromeの追加12ケースではない。

任意P3は、上記2回取得の説明修正（本文で対応）と、使い捨て負例probeの期待AssertionErrorをさらに限定する余地。今回は監査が失敗箇所を実際のWorld比較行へ照合し、timeoutや別assertionによる偽成功ではないと確認した。監査側のChrome/155単体/21ブラウザ全体/型/buildの再実行、Git commit tree照合は未実施。後続の証拠・記録文書まで別途監査合格したとの主張はしない。[判定記録](evidence/save-regression/audit-cc6b45c.json)。

未対象/未確認: Service Workerキャッシュを伴う実配信更新、Android/iOS実機、別端末/クラウド復元、ブラウザやOSの強制終了、OSレベルの容量不足、全過去版×全フィールドの組合せ、悪意ある再checksum済み任意データ、全ステージの実ブラウザ通し勝利。協力戦闘・防衛/訓練の途中checkpointは通常ソロと同じ対応を約束しない。報酬までのブラウザ試験では残敵/編成完了と報酬入力を合成しており、実戦難易度の証明ではない。

Service WorkerはPlaywrightで明示的にblock。今回のconsoleにはその警告とWebGL/テクスチャ関連の出力があり、console errorゼロとは報告しない。保存アサーションと未捕捉pageerrorを判定する。映像品質や端末性能の合格を意味しない。pauseを含む経路の成功だけで、約5秒間隔の定期保存とpagehide単独のトリガーそれぞれの成功までは断定しない。

実行担当モデルID・reasoning effortは取得できず未確認。モデル切替・利用料金の測定は行っていない。
