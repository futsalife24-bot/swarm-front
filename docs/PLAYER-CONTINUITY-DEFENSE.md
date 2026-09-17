# クラウド引き継ぎ・中断再開・週間・日替わり防衛

2026-09-17。作業ブランチ `codex/player-continuity-defense`、base `206f000b857844f2fc4d284a02f4bac75e748ead`。**実装途中・未監査・未公開**。ユーザー指定に従い、Astraが保存/認証/戦闘の基盤を実装し、下記の表示作業をLunaへまとめて引き継ぐ。モデルはユーザーがUIで切り替える。サブエージェントは使わない。

## 確定した仕様

- クラウド認証は引き継ぎコードから開始。コードは公開IDではなく秘密のアクセス鍵。同じコードで最後に同期成功した最新保存を取得する。発行時のスナップショット固定ではない。メール等の外部認証は追加していない。
- オフラインの通常プレイは端末へ保存、接続後に同期。別端末が先に更新した場合は409で停止し、ユーザーが端末/クラウドを見比べて選ぶ。無条件の最終書込み勝ちは禁止。
- 日替わりは仕様書 `SwarmFront_grilling_playtest_spec_v1.md` 第21節が正本。初版は180秒、勝利コインなし、敗北は武装片5、中断/リタイアは追加報酬なし。保証武器1個と回収済み武器は保持。残HP80/60/40/20%以上で追加武器5/4/3/2個、0超20%未満は1個。
- JST 0時に日替わり。ロード完了後「タップで戦場へ」で参加権と保証武器をサーバーで同時保存。開始日を消費し、日付越えでも二重消費しない。強制終了した日替わり戦闘は再開しない。
- 週間は月曜JST 0時。本編3勝150コイン、10勝400コイン、防衛3参加250コイン。オフラインの勝利は次に同期した週に加算。初版調整値でありバランス確定ではない。

## 実装済みの基盤

### クラウド

`server/player-vault.ts` とWorkerの `/api/cloud/*`。既存Gate bindingの独立DO `cloud/<random-id>` にSQLite単一行保存。新しい外部サービス・binding・有料契約は追加していない。コードのID部32hex、秘密部64hex、サーバーは秘密のSHA-256のみ保持。BearerはURL/ログ/解析へ出さない。POST同一Origin、no-store、本文1MiB上限。作成5/IP/日・100/日、操作60/IP/分・全体20,000/日。アカウント全体の無料枠を保証する制限ではない。

保存はversionのCASとmutation UUIDで再試行を冪等化。日替わりの参加記録はアップロード保存と分離し、古い保存の復元だけで参加権を取り戻せない。週間台帳もサーバー側を保持する。ただし通常進行はクライアント保存のバックアップであり、不正改造耐性を提供するものではない。

`src/client/cloud-save.ts` の公開関数:

- `createCloudSave()` 明示操作で有効化しコードを返す。
- `transferCode()` 現端末の秘密コード。必要時だけ表示/コピーする。
- `cloudStatus()` / `swarm-cloud-status`: unlinked/saved/pending/saving/offline/conflict と更新時刻。
- `syncCloud()` 未送信の正確なmutationを再試行。ローカル保存イベント後1.5秒、復帰/オンライン、表示中15秒ごと。変更なしは通信しない。
- `inspectCloud(code)` 検証済み保存とserverNow/day/week/versionを取得。
- `restoreCloud(code, snapshot, expectedLocalRaw)` UIで比較/確認した後だけ実行。`newSaveKey("normal")` のraw一致を要求し、既存保存を `swarm-front-before-cloud-restore-v1` へ退避。戦闘checkpointは破棄。
- `keepLocalAfterConflict(expectedVersion)` 比較したversionへCAS保存。さらに別端末が更新すれば再び停止。
- `deleteCloudSave()` クラウド保存と接続情報のみ削除、端末のゲーム進行は残す。UIで明示確認する。
- `admitDailyDefense(run, day)` / `claimCloudWeekly(id)` 同期完了とローカル一致を確認して操作、返された保存を反映。

週間台帳の反映は `swarm-cloud-progress` でゲーム内の保存オブジェクトへ通知済み。復元・報酬請求をUIから行った後はホーム再描画またはreloadし、古い保存オブジェクトで上書きしない。戦闘中には引き継ぎ操作を配置しない。

### 中断再開

`battle-checkpoint.ts` とplaytest-app。通常ソロの戦闘を5秒ごと・一時停止・pagehideに保存。再起動時は既存dialogで再開/破棄。進行fingerprintと受取済みreceipt、checksum、有限数値、容量を確認。最大約5秒の巻戻りはあり得る。日替わり・テストモードは対象外。チェックサムは破損検出であり不正対策ではない。

協力プレイの再接続資格を最大1時間の期限付きでlocalStorageにも保存。部屋の生存が前提であり、空室掃除等によるサーバー失効は延長していない。

### 日替わり・週間

`daily-defense.ts` / `daily-rewards.ts` / `weekly-missions.ts` / `calendar.ts`。武器庫HP2000仮値、個別敵の近接8m・被弾後4秒の敵視、兵士が武器庫24m外なら武器庫へ戻る。既存の敵攻撃/飛翔物処理で武器庫にダメージ、兵士の無敵/回復とは別。どちらかHP0なら敗北、時間到達との同時判定も敗北優先。180秒で敵残存に関係なく勝利。保証/回収/追加武器の重複付与防止を実装。

専用の平面マップ6種を既存マップの色/biomeから生成。外周壁と色の仮表示。武器庫は中央の小型施設モデルとHPに応じた色変化まで実装、破壊爆発・黒帯・カメラ寄り・結果演出は未実装。論理標的は原点、兵士押出し半径1.6m。通常マップ地形は変更していない。**日替わりはまだ製品として完成していない。**

## Lunaへのまとめ作業

既存の `menuDialog`、設定 `settingsUI`、ホームのutilities、既存CSS/テーマを継承する。別デザインへの作り直しは禁止。横画面844×390と狭幅で重なり・スクロール・ボタンを確認する。

1. **クラウド設定画面**: 未接続時の有効化/コード入力、接続時の同期状態/最終同期、秘密コードの明示表示とコピー、復元プレビュー（日時・進行・武器数等）、端末/クラウドを選ぶ確認、クラウド削除確認。コードを解析/ログ/URLへ出さず、所有者本人用の秘密である旨を短く表示。入力はtrim、テキストは既存esc/textContent、二重押下を防ぐ。失敗時にローカル進行を消さない。コード紛失時のメール復旧は未対応と説明。
2. **週間ミッション画面**: 上記3項目の進捗/報酬/受取済み、オンラインで `claimCloudWeekly`。週判定は `inspectCloud` のweek/serverNowを使い、古い週の表示を今週扱いしない。同期待ち・未接続・エラーの短い案内。既存通貨アイコンを流用。
3. **日替わり表示**: 追加済みの中央施設モデルを既存の描画品質に合わせて磨く。HP5段階と別の破壊状態、破壊爆発/黒帯/カメラ寄り、勝利/敗北結果の既存演出との統一。保証/道中/追加武器を既存武器行で表示。日替わり専用マップの見た目を仕様の進行対応に合わせる。外観だけの追加で遮蔽物と物理判定を乖離させない。広範な新規素材生成・敵デザイン変更は範囲外。
4. 画面の実ブラウザ検証と必要なUIテスト、文書更新、作業ブランチへcommit/push。保存/認証/報酬中核の変更が必要なら勝手に簡略化せずAstraへ戻す。

表示作業後はAstraへ戻し、差分確認・実通信/日替わり通し確認・独立Chat監査・main反映・公開へ進む。現在の基盤だけをmerge/deployしない。モデル変更を自己申告だけで実施済み扱いしない。

## 検証と残課題

- 型チェック成功。playtest構成50件、関連p1/shared-armory/game 68件成功（2026-09-17）。
- `npm run build` / `build:pages` / `server:build:production` 成功。500KB超chunk警告あり。公開用ビルドではなく途中のローカル検証。
- `scripts/check-battle-checkpoint.mjs`: 実Chromeで戦闘→一時停止→reload→再開時のworldと進行一致。証拠 `dist-validation/battle-checkpoint/`。
- `scripts/check-cloud-vault.mjs`: 実ローカルWorker/SQLiteで認証・最新保存・再試行・競合・日替わり保証・1日1回・Origin拒否・削除。証拠 `dist-validation/cloud-vault/checks.json`。
- `scripts/check-cloud-client.mjs`: 独立した2ブラウザの実HTTPで最新進行復元・競合選択・週間受取・削除。証拠 `dist-validation/cloud-client/`。
- `scripts/check-daily-defense.mjs`: ロードでは未消費、入場前保証保存、武器庫HP、強制終了後の保証保持・再開なし。証拠 `dist-validation/daily-defense/checks.json`。
- ローカル検証はVite5197・Worker8793。ブラウザのAPIルートは実HTTPをWorkerへ中継し、応答モックは使用しない。Worker例: `npx wrangler dev --local --config wrangler.production.jsonc --port 8793 --persist-to .wrangler/continuity-sql-validation`。ローカル作成上限も有効、同一fixtureで1日5アカウントまで。
- 検証途中に発見した同期状態の残留とin-flight待合せを修正。Workerの元request streamをDOへ転送する問題は本文を上限内で読み切ってから内部Requestを作る形へ修正。SQLを用いてKVの単一値サイズ制限を回避。修正後実通信検証は成功。
- 実スマホ・通信断時の全OS挙動・3分間通しのプレイバランス・協力プレイのブラウザ閉じ再接続は未確認。端末に保存できる前にOSが終了した直前操作は保証できない。中断checkpointは端末内のみで別端末への戦闘途中移行ではない。
- 公開前に既存Cloudflare契約/アカウント全体の枠を確認。全体の無料運用保証や課金契約変更は未実施。
- baseに含まれる以前の管理ダッシュボード (`2bf86ca`, `206f000`) は独立監査・正しい配信照合の記録不足。今回の監査合格とは別問題であり、公開時に隠さず扱う。集計の期間/重複/容量等の改善は今回の3機能・日替わりとは別の残作業。
