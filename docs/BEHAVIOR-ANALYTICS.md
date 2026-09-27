# T5 行動イベント連携（非本番、2026-09-27）

作業: `codex/t5-game-events`、`../behavior-t5`。base は PR99 統合後の `df3b0c2670997300bd264d68b139b50b659abab4`。正本: https://github.com/futsalife24-bot/swarm-front 。Hub の確定済み v1 契約に接続する。武器、育成、難易度、保存形式には変更なし。

## イベントの意味と実際の発火位置

|event|`src/client/playtest-app.ts` の位置|対象|
|---|---|---|
|visit|`showHome` の UI 構築・バインド後、および初期 `loadMode` 後の result/choice 表示|通常ソロの初回入口、タイトル、再開入口、保存済み戦果。developer/練習/協力直行/初期化失敗は除外|
|sortie_start|新規 `launch` の pt-enter で開始待ちを記録し、`checkpointNow` の保存成功後に消費|通常ソロ新規開始。再開/日替わり/他モードは除外。初期保存失敗なら後続の保存成功まで数えない。開始待ちはメモリのみで、ホーム/次の launch/日替わりでは無効|
|first_victory|`victory` の `commit(n, after)` 成功 callback|未受領の通常ソロ勝利の報酬保存成功。その JST 日の初回であり、生涯初勝利ではない。保存再試行の成功時も対象。保存済み戦果の表示だけでは数えない|
|sortie_again|上記新規開始成功時に同日勝利フラグを確認|同じ JST 日の勝利保存後の新規通常ソロ出撃。敗北だけの再挑戦、翌日、中断再開は除外|

各イベントはブラウザプロフィール・origin・JST 日ごとに最大1件。人間の人数や連続ファネル、継続率ではない。Hub の今日/7日/30日は日次値の延べ数で、旧アクセスを母数に使わない。

## payload と保持

送信は `{version:1,event,day,token,admin}` の5項目のみ。day は JST `YYYY-MM-DD`、token は当日だけの32桁小文字hex乱数、admin は既存 `app-analytics-admin` フラグ。ID は既存 visitor と共用しない。

`swarm-front-behavior-day-v1` の単一 localStorage スロットに日付、当日token、勝利済みboolean、4種の送信状態/試行回数/短い実行中期限だけを置く。セーブ・クラウドには追加しない。日替わりの次の処理で全置換し、古い再送を当日へ付け替えない。閉じたブラウザの期限切れ値を時刻ぴったりに物理消去する保証はない。保存消去/別端末は別標本。

Web Locks で生成と更新を直列化。試行数を送信前に保存し、最大2回/イベント/日（最大8 POST）。リロードや並行呼出しも上限を共有する。再送は同一payload。成功と400/403/409等の終端拒否は再送せず、429/5xx/通信失敗は1回まで。送信/lock待ちのtimeoutは1500ms、送信中の短いleaseは2000ms。処理中に閉じた場合の再試行は次の行動時のみで、永久キューはない。

ゲームは送信完了をawaitしない。JSON/storage/Web Locks/乱数/ネットワークの例外を計測内で吸収し、代替IDは作らない。ゲーム保存と計測状態は別トランザクションなので、クラッシュ境界等の欠測は残る。送信不能を「利用なし」と断定しない。Hub は当日event別digestを重複排除に使い、日次合計365日を保持する。

氏名、メール、位置、IP保存用データ、UA/指紋、広告ID、永続ID、セーブ内容、武器一覧、個人別プレイ履歴は送らない。Cookieは追加せず `credentials: omit`、referrerも送らない。既存アクセス集計の契約と実装は不変。

## 有効化の境界

現在は Vite DEV かつ `VITE_BEHAVIOR_ENDPOINT=http://127.0.0.1:<port>/api/behavior/collect/swarm-front` の場合だけ稼働。本番buildでは無効。Hubも通常/production設定は無効のまま。公開と本番計測開始は別で、コードmerge・deploy・本番送信は今回行わない。

将来の本番有効化には別承認とレビュー済み変更が必要。DEV guardの解除だけでfixture開始を本番へ転用しない。source/開始操作・表示・許可Origin・インフラ側ログ等をその時点で確認する。

## 再現と検証限界

Hub側 `scripts/check-game-behavior.mjs` に `SWARM_ROOT` でこのcheckoutを指定して実行。loopbackのViteと隔離SQLite Workerを起動し、外向き通信を拒否する。ゲームの実 fetch/CORS、初期checkpoint、victory/commit、集計API、管理画面を通す。勝利はテスト専用Vite変換から既存 `finish(world,true)` を呼ぶ合成終了で、実戦クリアや人間初見成功ではない。テスト制御はゲームソース/本番bundleへ追加しない。

型、計測関連15件、保存147件、保存ブラウザ21シナリオ、production build/Worker dry-runを確認。実経路で4イベント各1、reload/戻る/報酬後再出撃/中断再開、重複、不正event、Origin拒否、403/切断/timeout/実Worker停止を確認。通信異常時も出撃・保存・報酬が成功。checkpoint保存失敗中は出撃未計上、後続保存成功で加算。勝利保存失敗中は勝利未計上、保存再試行成功で1件。Hubは型/単体8/API・SQLite95/4画面幅/既存管理API/dry-run成功。Hub320pxで4値一致、ゲーム844×390/640×360を確認。

保存ブラウザ初回はreceiptsの起動待ちでtimeout（初期HTML、pageerrorなし）。他のゲームブラウザと同時にしない再実行で21件成功。原因は未確定。統合fixture初回はrewards無しの勝利生成を既存finish関数へ修正して再実行成功。これらを製品の成功結果と混同しない。

監査中の追加確認で、writeBattleCheckpointが例外を投げずfalse（保存対象外）を返す境界も成功から除外した。例えば初期保存失敗後、死亡状態で呼ばれた場合に出撃を誤計上しない。統合テストではhp=0の保存対象外で未計上/保存なしを確認し、hpを戻して実保存した後だけ1件になることを確認。製品の死亡状態やゲームバランスは変更していない。

T2人間初見、T3実機性能、自然流入の効果評価は対象外。独立監査は自己検証と別に記録する。実行モデルID/effortは取得できず未確認。
