# 無料運用の前提と見積もり

確認日: 2026-09-06。現在はローカルのみ。Cloudflare/GitHubの本作用アカウント・契約・remoteは確認／作成していない。本番公開・課金・認証は未実施。

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

**監視表示・本作の上限だけでPaidアカウントの請求を防げるとは扱わない。** Freeプランの確認、他用途の残量確認、公開承認が必要。無料枠を超えた際はゲームが利用できなくなる前提。公開・契約確認なしの今はローカル検証に限定。

## 依存互換性の根拠

採用日付のnpm公式メタデータを確認し、すべて完全固定。Node 24.14.1はVite 8.2.2の `^20.19.0 || >=22.12.0`、Wrangler 4.129.0の `>=22.0.0`、Vitest 5.0.0の `^22.12.0 || ^24.0.0 || >=26.0.0` を満たす。Three.js 0.185.1と型0.185.4、TypeScript 7.0.2、Playwright 1.63.0で型・ビルド・ブラウザ実行を確認。

[Vite公式](https://vite.dev/guide/)、[Three.js公式](https://threejs.org/manual/en/installation.html)、[Wrangler公式](https://developers.cloudflare.com/workers/wrangler/install-and-update/)、[Vitest公式](https://vitest.dev/guide/)、[Playwright公式](https://playwright.dev/docs/intro)、[Microsoftランタイム公式](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist)
