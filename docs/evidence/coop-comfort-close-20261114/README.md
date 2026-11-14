# マルチ快適化・判定材料の再確認（2026-11-14）

**goalは未完了。閉じる判断は本人が行う。** 指定されたB-4依頼は11/13に実装・計測・公開済みだったため、その成果を保持し、最新mainで現状を追加測定した。A-1のPR #326・merge後main `3fd6e65` の補記も既に存在し、重複追加していない。

基点はfetch済みorigin/main `eb65297747dca36dfc42c994114a7e285913b21d`、branchは `codex/coop-comfort-close-20261114`。作業場所は既存の `task-coop-comfort-close-20261113` を再利用。元root・他worktreeの差分は保持。今回の変更は記録と集計器の入出力指定だけで、製品コード・ゲームルール・通信契約・判定・報酬・保存形式を変更していない。製品変更がないため再公開は行わない。

| 残件 | 判定 | 証拠・現在の限界 |
| --- | --- | --- |
| 1. 64KiBの余裕 | 解消（証拠あり、検査範囲内） | 実Worker・実WebSocketの旧object/v1/現行、各4人×100/400弾の6条件が成功。最大61,423B、余裕4,113B。core超過の旧版は部分状態を送らず更新案内＋4000、現行は全状態を復元。同tokenの現行版への復帰も同じ隊員・敵97/弾400・エラー0。[今回の容量結果](wire-summary.json)。全合法状態256KiB以内の証明は未完了。 |
| 2. 高負荷時の入力 | 改善したが残る（数値） | 既存対策は維持。ただし今回の通常生存60秒でも入力最大691.7ms、250ms超は各人1件、猶予外ACK=0は3/2/0/2件。人工混在では描画1画面で最大3,144.6ms、4画面で8,941.1ms。上り1000B/sで解除送信→受理944.5〜978.3ms。前回の通常条件での成功を今回へ引き継がない。 |
| 3. 単発の描画待ち | 実機確認待ち | 例外は全試行0。計測開始前を除いたRAF最大は人工混在1画面149.9ms、4画面716.8ms、低速上り1画面1,166.5ms。通常生存は100.0ms。今回CPU profileは採取せず、過去の約96% idleの499.9msや本人症状と同じ原因とは未確定。 |
| 4. 着弾抜け・敵消失 | 解消（証拠あり、特定済みの症状） | [11/13の旧コード失敗・現行成功の回帰照合](../coop-comfort-close-20261113/regression.md)を保持。対象のshared・通信・描画コードはその公開ソースから不変。[照合範囲](sources.json)。今回の実通信でも敵97・弾100/400・オーブ160・地雷20・HPを欠落なく復元。未知の別原因・全実機症状の解消は主張しない。 |
| 5. サーバー負荷・無料枠 | 改善したが残る（数値・条件付き試算） | 人工混在1画面のローカルDO tick中央値12/p95 35/最大130ms、下り合計327,603B/s。4画面では23/278/1,554ms。既存対策の性能保証にはせず、実クラウドCPU・当日DO残量・SQLite利用量は未確認。下記の公式枠による試算のみ。 |

Wi-Fi固定36後の周期停止解消と自機の歩行予測は再調査していない。周期停止は11/02本人確認の「製品外の要因（根拠あり）」を維持し、今回の単発停止や連射へ一般化しない。

## 条件と数値

Windows、Node v24.19.0、npm 11.17.0。実ローカルWrangler/workerd、実WebSocket、独立したChrome 4プロセス、844×390、実FrontNetwork・NetworkInputLoop・Rendererを使用。本人セーブ・本番部屋・他人の部屋は使用していない。計測中に全件テスト・ビルドは実行していない。

人工混在は前回と同じseed4520、PLEAT40・BASTION3・HARROW3・CATENA3、開始時100弾・160オーブ・20地雷。密集維持の耐久変更とCATENA用の既存草原地形はローカル検査口だけ。自然な生存戦・合法最大とは扱わない。描画側とサーバー側の地形を揃えている。通常生存はfixtureなしでseed固定ではなく、前回と同一入力列の厳密比較ではない。

| 条件 | 入力間隔最大 | 猶予外ACK=0（4人順） | RAF最大 | tick中央値/p95/最大 | 4人合計下りpayload |
| --- | ---: | --- | ---: | --- | ---: |
| 人工混在・描画1・45秒 | 3,144.6ms | 16/14/14/18 | 149.9ms | 12/35/130ms | 327,603B/s |
| 同じ人工混在・描画4・45秒 | 8,941.1ms | 19/23/20/20 | 716.8ms | 23/278/1,554ms | 31,869.5B/s |
| 人工混在・描画1・上り1000B/s・片道75ms・30秒 | 1,687.2ms | 18/17/22/17 | 1,166.5ms | 9/25/254ms | 122,800.8B/s |
| 通常生存・描画1・60秒 | 691.7ms | 3/2/0/2 | 100.0ms | 今回採取対象外 | 175,619.6B/s |

匿名集計は [measurements.json](measurements.json)、対象HEAD・検査完走・例外数・rawのSHAは [sources.json](sources.json)。先頭RAFを除外し、長いフレームは開始と終了が計測窓内のものだけを採用。猶予外はcombat/bossで `serverNow > resumeUntil+1`、隣接する同じphase・resumeUntilの入力だけを比較。受理ACKと適用ACKを区別し、deltaも含むinputWindowの受理確認を使用する。rawのneutralAck総数とは一致しない。

全4試行は検査器の完走条件を満たし、画面例外・console.error・WebGLエラー0、測定前後の製品ソース同一。完走条件は快適性の閾値ではない。4画面で下りが少ないのは更新・ゲーム進行も遅いためで、通信改善とはしない。各1試行で、PC資源・OSスケジューリング・他処理は固定できていない。製品コードに差がなくても前回より悪い数値があり、原因を回帰や家庭回線へ断定しない。スマホ4台や実クラウドの測定に換算しない。

## 既存修正と今回の判断

64KiB対策の採否は[11/13の4案比較](../coop-comfort-close-20261113/README.md)を維持。60KiB予算＋交渉済み早期分割、非対応の旧版は収まる間だけ継続し、超過時に更新案内を出す。判定状態を削る案、上限引上げ、無条件の旧版拒否は採用しない。今回の6条件は現行版の確認であり、旧製品との修正前比較は同ページのwire-before/afterを参照する。人工1000弾と旧分割互換の前回証拠も保持し、不変の処理を再調査していない。

着弾・消失は、敵弾100で空発射する旧版、ロケット球面通過の旧版、受信済み敵の省略中消失の旧版で失敗した回帰試験が既にある。今回も全件テストに現行の対象試験を含む。HARROW突進予告の容量例外も既存回帰を維持し、敵モデル・識別・予告・公平性を変更していない。

本人の[11/13実機診断](../coop-comfort-close-20261113/device-feedback-20261113.md)と「押しっぱなし中に連射間隔がばらつく」という報告を維持する。今回の自動操作は人工混在でfire=trueの入力を継続送信しているが、物理タッチを計測せず、サーバー射出時刻や描画提出との1発ごとの対応も未取得。入力空白が再現しただけで本人の連射症状の原因確定とはしない。射撃速度や入力失効期限を推測で変更する案は採らない。次の切分けは、同じ武器・人数・seed・回線で押下継続→入力受理/適用→サーバー射出→描画を対応させること。

## 無料枠の条件付き試算

11/14に[Cloudflare公式DO料金](https://developers.cloudflare.com/durable-objects/platform/pricing/)を再読取りし、Freeは100,000要求/日・13,000GB-s/日、受信WebSocketの20:1、128MBのwall時間、送信WebSocketメッセージの要求課金なしを確認した。超過時は該当操作が失敗し、日次枠はUTC00:00更新。現行契約の最新根拠は11/13の本人のFree回答。今回契約API・当日使用量は再取得せず、以前の403を現在の再試行結果とは扱わない。

- 4人×20Hz×3600秒＋5秒ごとのapplication pingは14,544 DO要求相当/時。独立ACKを各10Hzで最大加算すると21,744/時。受信35件/秒上限の通信分だけなら25,200/時。HTTP・alarm・再接続・他用途は別加算し、4部屋時間で通信分が100,800になり得る。
- 1部屋1時間は `3600×0.128=460.8 GB-s`、13,000の約3.55%。tickの経過時間は課金用クラウドCPUではなく、このwall時間の計算と置き換えない。
- 今回の人工混在1画面の下りを1時間へ外挿すると約1.18GB/部屋・約295MB/人。通常生存は約632MB/部屋・約158MB/人。実測は45/60秒、WebSocket/TCP/TLS分は別。携帯回線のデータ消費とCloudflare無料枠は別。

したがって1部屋1時間は公式枠内を想定できる計画だが、実アカウント全体の残量・クラウド性能・SQLiteを含む無料運用保証はできない。[既存前提](../../FREE-TIER.md)を維持し、契約・費用・権限変更は行っていない。

## 検証と再現

`typecheck`、`npm test`（1,769件すべて成功、258.20秒）、`format:check`、`build`、`server:build` は全て終了コード0。[終了コード・対象ソース・日時](checks/summary.json)と同ディレクトリの生ログを参照。全件テストと負荷計測は直列実行。集計器は入力ディレクトリ・出力JSON・試行名を任意指定できるようにし、旧来の既定値と集計規則を保持した。旧raw6試行を再集計し、既存measurements.jsonとのdeepEqualが成功。構文・差分・文書内リンクも確認した。

Git保存用のチェックログは改行をLFにし、行末空白と末尾空行だけを除去した。原本はGit除外 `dist-validation/coop-comfort-close-20261114/checks-raw/` に保持し、[原本と保存用テキストのSHA](checks/log-hashes.json)を記録。結果や警告本文は削除していない。

```powershell
node scripts/setup-local.mjs
node node_modules/wrangler/bin/wrangler.js dev --local --config wrangler.test.jsonc --port 8796 --inspector-port 9346 --persist-to ../output/close-do14
# 別shell、ローカル専用。出力先を試行別に指定する。
$env:SWARM_CLOSE_OUTPUT='dist-validation/coop-comfort-close-20261114/wire'
node scripts/measure-coop-comfort-close.mjs
$env:SWARM_LIVE_ENDPOINT='http://127.0.0.1:8796'
$env:SWARM_LIVE_NETWORK_TIMING='1'
$env:SWARM_LIVE_GL_PROBE='end'
# FIXTURE=mixed、RENDER_CLIENTS=1/4、SECONDS=45。通常生存はFIXTURE空・SECONDS=60。
# 低速条件はLINK_LATENCY_MS=75、UP_BYTES_PER_SECOND=1000、RELEASE_AFTER=15、SECONDS=30。
# 上記の変数名にはすべてSWARM_LIVE_接頭辞、出力はSWARM_LIVE_OUTPUTで試行別に指定。
node scripts/check-coop-live.mjs
node scripts/summarize-coop-comfort-close.mjs dist-validation/coop-comfort-close-20261114 docs/evidence/coop-comfort-close-20261114/measurements.json mixed-render1,mixed-render4-aligned,mixed-slow-up,survival-render1
```

raw・全Chrome画像はGit除外 `dist-validation/coop-comfort-close-20261114/`。[通常生存](survival-render1.png)と[人工混在](mixed-render1.png)の描画1画面を目視し、兵士・敵・地形・射撃・予告が描かれていることを確認した。検査用ページの画像であり、通常製品UI・ホーム画面版の受入証拠とは区別する。ローカルWorker初回起動はsandboxによるログ書込/親ディレクトリ読取拒否で失敗し、正式な権限昇格後の同じ起動コマンドで成功。認証回避・権限設定変更はしていない。

本人用は[5分実機確認票](device-check.md)。実機報告を受領済みであることを維持し、goal終了の未受領と区別する。通常ソロ/協力UI・本番配信は11/13の[既存公開証拠](../coop-comfort-close-20261113/README.md)を参照し、今回の追加検証としない。

GitHub正本: https://github.com/futsalife24-bot/swarm-front 。主担当の実モデルID/推論設定は取得不可・未確認、サブエージェントなし。今回の独立Chat監査は依頼されておらず追加していない。
