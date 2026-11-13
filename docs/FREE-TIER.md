# 無料運用の前提と見積もり

## 2026-11-13 マルチ残件の計測に基づく試算

本人が本作業中に「現在も無料プランです」と回答し、公開前の契約確認を満たした。API/画面の取得成功とは区別する。既存アカウントの読取で当日UTC 00:00〜02:46:07は全Workers 40 requests・errors 0。契約APIは403、ブラウザはタブ作成タイムアウト後に接続先0件となり、契約画面は未読。認証・権限・プランは変更していない。[今回の取得結果](evidence/coop-comfort-close-20261113/account.json)。

人工混在49体・4人・描画1画面のローカルDO tickは中央値17/p95 38/最大59ms。下りはJSON payload合計475,529B/sで、同じ密度を1時間維持すると約1.71GB/部屋・約428MB/人。WebSocket/TLS等は別。4画面の下り119,073B/sは更新待ちとゲーム進行遅れを伴うため、帯域改善とはしない。合法な通常生存60秒の瞬間平均は4人合計180,469B/s（1時間換算約650MB/部屋）。瞬間値の外挿であり1時間実測ではない。[条件と原本への索引](evidence/coop-comfort-close-20261113/README.md)。

現行公式のFree枠では、4人20Hz入力＋5秒pingは `(288000+2880)/20=14544` DO要求相当/時。独立ACKを各10Hzで最大限加えると約21,744/時、さらにHTTP・alarm・部屋作成等が加わる。受信35件/秒上限から見る保守的な通信分は25,200相当/時。したがって1部屋1時間は枠内の計画だが、4部屋時間では通信分だけで100,800となり得る。複数部屋・他用途・再接続も合算し、日次上限内を保証しない。

タイマーが動く戦闘1部屋1時間は `3600×0.128=460.8 GB-s`、日次13,000 GB-sの約3.55%。この次元だけなら約28.2部屋時間/日。tick CPUを軽くしても、このwall時間をCPU処理時間へ置換しない。保存行の計画値は下記の既存前提を維持し、今回の計測ではSQLite行数・実アカウントDO残量・実クラウドCPUを取得していない。公式枠との条件付き試算であり、現在の契約や残量の保証ではない。[DO料金・20:1・wall時間の公式説明](https://developers.cloudflare.com/durable-objects/platform/pricing/)。

以下は以前の契約確認と設計記録。

2026-11-05の公開前確認: 本人が「無料プランのまま」と明言。今回の契約根拠はこの本人回答で、管理画面/APIの取得成功とは区別する。契約API403は取得可否の記録であり、同じ本人回答を取り直していない。既存Workerへ通常公開し、新規費用・契約/権限変更なし。当日UTC00:00〜12:03:59の全Workersは224 requests・0 errors・239 subrequestsを既存OAuthの正規GraphQLで取得。[今回の公開と配信確認](evidence/survival-result-rewards-20261105/RELEASE.md)。

2026-10-30の公開前確認: 本人が現在も「無料」と回答。管理画面/APIでの契約再取得ではなく本人確認として記録する。既存OAuthで当日UTC 00:00〜08:45の全Workersは173 requests・0 errors・186 subrequests。subscriptionsは403で、standardをFreeの根拠にはしない。新規契約・料金・権限変更なし。[今回の確認と公開記録](evidence/coop-comfort-20261030/release.md)。以下は過去の管理画面確認と見積もり。

現行確認日: 2026-10-15。既存CloudflareアカウントのWorkers Plansで「無料・0ドル・現在の計画」を確認。既存 `swarm-front` Workerは公開運用中。新規契約・費用・権限変更なし。当日UTC 00:00〜06:07のアカウント全Workersは81 requests、0 errors、85 subrequests。DO使用量はこの確認では未取得。[画面証拠](evidence/enemy-report-20261015/cloudflare-free.png)、[API取得記録](evidence/enemy-report-20261015/account-plan.json)。契約APIの`subscriptions`は権限不足で403のため、`account-settings`の`standard`をFreeの根拠にせず管理画面で確認した。

以下の見積もり・上限表は2026-09-06時点の設計記録。現在の使用量を表すものではない。

## 公式資料と採用

Workers Freeで使えるDurable ObjectsはSQLite-backed。設定の `new_sqlite_classes` を使用する。Freeの上限超過は該当操作がエラーになり、日次枠はUTC 00:00に更新される。Paidの無料付帯枠とFreeプランは別。**既存Paidアカウントを「無料枠内のはず」で使わない。** 公開時に契約とアカウント全体の既存利用を確認する必要がある。[Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)

| Freeの対象 | 公式上限 |
| --- | ---: |
| Workersへのリクエスト | 100,000/日（アカウント全体） |
| DOリクエスト | 100,000/日 |
| DO実行時間 | 13,000 GB-s/日 |
| SQLite行読み取り | 5,000,000/日 |
| SQLite行書き込み | 100,000/日 |
| SQLite保存 | 合計5 GB |

上限は本作だけの専用枠ではない。他のWorker・DOも同一アカウントの予算を使う。[Workers limits](https://developers.cloudflare.com/workers/platform/limits/)、[DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/)、[DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)

## 4人が1時間遊ぶ想定

前提: 同じルームで4接続を維持、実行時間の上限見積もりとして1時間ずっと戦闘、入力20回/秒/人、配信10回/秒/人、1時間で10回出撃、各出撃で全員が装備更新1回。再接続・悪意ある利用・他作品の消費は別加算。1時間でルームを閉じる。

- 入力: `4 × 20 × 3,600 = 288,000` メッセージ。5秒ごとのpingも最大2,880個。DOの受信メッセージは課金計算上20:1なので約14,544リクエスト相当。HTTP受付・DO呼出し・アラームを加え、**約14,600（日次DO枠の約14.6%）**。
- 入口WorkersへのHTTPは作成1回、WS接続4回程度。再接続時は入口Workerと受付DOとRoomへの処理が増える。WSの各入力を入口HTTPリクエストとして二重計上しない。
- 実行時間: `3,600 × 0.128 GB = 460.8 GB-s`、日次枠の約3.55%。戦闘中は20Hzのタイマーがあるためハイバネーションによる時間削減を見込まない。Hibernation APIを使い、空室・リザルトで戦闘タイマーを止める。[WebSocket lifecycle](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- CPUの別の仮定: 1更新0.5msなら72,000更新で約36秒のCPU処理。これは本番実測ではなく仮定であり、上の460.8 GB-sという実時間課金の計算を置き換えない。
- 保存: 作成、入室、装備更新、出撃、確定結果、退出にのみ保存。40装備更新＋10開始＋10結果＋初期参加・退出・受付・アラームを含め、おおむね**200行書き込み・100行読み取り以下を計画値**とする。KV APIもSQLite内部行を使用し、アラーム設定も書き込み扱い。実アカウントのメトリクスでの検証は未実施。
- 保存データ: 1ルームの状態を小さな1レコードで保持。40敵の状態メッセージ実測例は5,770バイト。保存レコードにはメンバー・個別報酬もあるため1ルーム100KB以内を目安とする（SQLite自身の管理領域は別）。ルーム削除はdeleteAllを使う。

## 通信量

入力を180バイトと仮定すると約51.8MB/時（4人合計）。40敵・2人の実測状態は5,770バイトだった。4人の装備や射撃イベントを加え**平均8KB/状態と仮定**すると `4 × 10 × 3,600 × 8,000 = 1.152GB/時` のサーバー送信量、各プレイヤー約288MB/時。最大64KiBの上限で計算すると合計約9.44GB/時になり得る。WebSocket/TCP/TLSの付加分は別。

この計測は連続1時間の通信測定ではなく、瞬間値を使った見積もり。携帯回線のデータ消費は無料サービス枠とは別。友人間での実利用前に差分配信・量子化の追加や配信頻度の調整を評価する余地がある。現在は通信時の小数2桁化と未配信イベントだけの送信を実施。

## 防止策と限界

部屋は最大4人・最長1時間、操作なし3分、未認証5秒。空室は定期処理停止＋30秒後の一度きりの掃除、リザルトは戦闘停止＋2分後の掃除。入力2KiB、送信35件/秒/接続、状態64KiB、装備更新120回/人/部屋。部屋作成はアドレスごと10回/10分・全体100回/日、接続60回/10分（全体2,000回/日）。アドレス別カウンター最大1,000。これらは過負荷を制限するが、アカウント全体の枠内を保証するものではない。

**監視表示・本作の上限だけでPaidアカウントの請求を防げるとは扱わない。** Freeプランの確認、他用途の残量確認、公開承認が必要。無料枠を超えた際はゲームが利用できなくなる前提。現行の契約確認と継続公開承認は先頭の記録およびAGENTS.mdを参照する。

## 依存互換性の根拠

採用日付のnpm公式メタデータを確認し、すべて完全固定。Node 24.14.1はVite 8.2.2の `^20.19.0 || >=22.12.0`、Wrangler 4.129.0の `>=22.0.0`、Vitest 5.0.0の `^22.12.0 || ^24.0.0 || >=26.0.0` を満たす。Three.js 0.185.1と型0.185.4、TypeScript 7.0.2、Playwright 1.63.0で型・ビルド・ブラウザ実行を確認。

[Vite公式](https://vite.dev/guide/)、[Three.js公式](https://threejs.org/manual/en/installation.html)、[Wrangler公式](https://developers.cloudflare.com/workers/wrangler/install-and-update/)、[Vitest公式](https://vitest.dev/guide/)、[Playwright公式](https://playwright.dev/docs/intro)、[Microsoftランタイム公式](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist)

## 2026-10-06 生存協力の出撃時間

利用者の明示訂正により、新規の成長規則3・生存協力だけは「出撃開始から60分＋帰還後の保存/再接続2分」とする。準備時間は出撃60分に含めない。出撃時に受付レジストリと一覧の期限を同時更新し、Roomの接続・tick・alarmとクライアントの復帰情報も同じ終了時刻へ揃える。旧規則/攻略等の最長1時間、放置3分、無人時30秒、入力・作成頻度等の既存制限は維持。新規課金や契約変更は行わない。
