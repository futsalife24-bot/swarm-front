# 協力生存・実ローカルWorkerの通信計測（2026-10-27）

## 条件

- 対象: main 518c97261fdff13e4f70b7f11ef970a8e9af43c7 のserver/shared。作業中の主担当の描画変更は通信計測へ影響しない。
- 既存wrangler.test.jsonc、server/testing.ts経由で製品Roomを利用。特別なfixtureルートは一切呼ばず、通常の部屋作成→hello/equip/ready/start→初期候補選択→入力の実WebSocket。
- 専用127.0.0.1:8793、保存先dist-mobile-network/worker-state。既存ローカル認証値を内部利用し、値・部屋コード・復帰トークンは証拠に保存しない。
- 1人と4人を各1試行、戦闘開始後30秒。frontGrowth=3、frontCatalog=2、frontOpening=2、equipmentCache=1、stateOmissions=1。合成支給rifle/smg。初回強化は配信された既定候補を選択。
- 50msごとに旋回移動。射撃なし。描画なしのNode WebSocket。部屋seedはサーバーの生成値で試行間で異なるため、固定seedの同条件比較ではない。
- 起動中に主担当の重い描画ベンチを重ねないよう連絡。ただし同じPCの他プロセスやローカルWorker環境の負荷は統制していない。

## 結果

|人数|標本数/クライアント|受信間隔p50 ms|p95 ms|最大 ms|250ms超|最大JSON bytes|最大敵数|最大オーブ|ゲーム時刻末尾|
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
|1|241|126.41|143.36|170.00|0|44,032|56|0|23.9秒|
|4|240|122.51〜122.92|150.91〜151.33|179.13〜180.81|全員0|47,964|56|0|23.8秒|

全員が最後までcombat。製品からのerror・試験中の切断は0。手動終了のcloseは集計外。受信JSONは全て64KiB以下。省略ありかどうかの各標本はresults.jsonのomittedEnemiesを参照。

30秒の実時間に対しゲーム内経過は約23.8〜23.9秒であり、設計上の100ms状態配信より遅い。主因がローカル実行環境、権威計算、タイマーの実装等のどれかは今回未切り分け。本番Workerの遅延や本人動画の原因と断定しない。実スマホの復号/描画、PWA、実インターネット回線、長時間、96体/オーブ160/射撃多数の条件は未検証。

## 失敗と訂正

1. 最初のWorker起動はnode_modulesのパスがdist-h直下にないためMODULE_NOT_FOUND。既存親node_modulesを明示して起動。
2. 初回測定でyawを無制限に増やし、±πを超えた約9.2秒に4001「入力値が不正です」。計測器の問題であり製品不具合ではない。invalid-yaw-results.jsonに1人の失敗を保存。4人の途中で計測を中止。入力角をatan2(sin,cos)で製品の許容範囲へ正規化して再実行。
3. 当初の入力はshoot:trueという使われないフィールドを指定していた。製品が読むfireはneutral()のfalseのままで、実際は射撃なし。結果を移動のみの計測として記録し、再現スクリプトから無効なshoot指定を削除。射撃あり試験の成功とは扱わない。

## 再現

cwd: C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/dist-h

既存依存のみ。インストール不要。別端末で以下のWorkerを起動:

`node ../node_modules/wrangler/bin/wrangler.js dev --local --config wrangler.test.jsonc --ip 127.0.0.1 --port 8793 --persist-to dist-mobile-network/worker-state --log-level error`

次に `node dist-mobile-network/measure.mjs` 。最初に既存TSの定義をローカルのshared.mjsへbundleする。results.jsonには各標本の受信時刻・ゲーム時刻・サイズ・敵数等を保存する。実セーブ・本番部屋不使用。初回試験の起動制限は通常の権限申請を利用し、保護は変更していない。

今回開始したWorker/計測プロセスは終了済み、8793の待受なしを確認。製品ソース・STATE編集、Git操作、外部送信なし。作成物は本フォルダのみ。自己レビューとnode --check成功。独立監査ではない。主担当へ条件と未確認を引き継いだ。
