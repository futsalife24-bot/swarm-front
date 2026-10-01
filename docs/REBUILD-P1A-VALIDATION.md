# P1a 自動検証と残る受入条件

2026-10-01。対象は `codex/rebuild-p1a-cloud-20261001` の独立ソロ試作。実装の保存と、実ブラウザ・人間・実機・独立監査による受入を区別する。mainへの統合・公開は今回の対象外。

## 環境と再現

- Node v24.19.0 / npm 11.9.0、既存lockfileの依存を使用
- client/Worker型検査: `npm run typecheck`
- 焦点検証: `npm run test:rebuild`
- 旧保存回帰: `npm run test:save`
- 集約: `npm test`
- 試作build: `npm run build:rebuild` → `dist-rebuild/rebuild-p1a.html`
- 通常build: `npm run build`。通常入口には試作HTMLを追加しない
- Worker dry-run: `XDG_CONFIG_HOME=/tmp/swarm-rebuild-xdg WRANGLER_LOG_PATH=/tmp/swarm-rebuild-wrangler-final.log npm run server:build:production`
- UI: `CHROMIUM_PATH=/usr/bin/chromium npm run test:rebuild:e2e`。Chromeがある通常環境では環境変数を省略可能

## 自動検証の対象

- 全410到達構成と全有効候補組、3枚提示、同系統続き/進化完成の保証
- 再抽選の出撃合計2回、既出組回避、代替候補がない場合の無効化、回数不消費
- run/offer/revision/request ID・カード・壊れた状態・再送の検証
- 手動起源、同一対象/射撃起源の重複抑制、二次撃破、印の世代、伝播深度2、効果処理予算
- XP近距離/境界回収、最大6追加権利、5:45最終確定、選択中の全戦闘停止
- 基準値からの汎用強化、ボス勝利/敗北/9分時間切れ、結果後停止、報酬なし、旧セーブ経路との分離
- 再開予告と非表示/一時停止の入力ゲート、OSキーリピートからの移動復活防止（実際の兵士座標を用いる単体回帰）
- 予兆と実際の敵出現座標、種類ごとの半径、プレイヤーの接近時の生成取消

通常の保存API・保存writer・日替わり台帳・通信clientを試作入口から参照しない。試作bundleにも `localStorage` / `indexedDB` / `save-writer` / `/api/save` / `/api/events` は含まれていないことを確認。これは実ブラウザ保存回帰の代替ではない。

## 自動pilotの意味と限界

seed 4520、既定候補を選び、既存 `tests/bot.ts` の合法な移動・照準・手動射撃・回避・装填入力だけを実行。HP、敵性能、XP、時計の上書きはしない。測定値は `tests/rebuild-run.test.ts` のnormal-inputケースから再現する。

このsampleはライフサイクルの自動成立を確認するもので、面白さや人間の勝率を認定しない。最終sampleは374.45秒（6:14.45）で勝利、初発動1.95秒、進化75秒、進化後299.45秒、7取得、最終補給XP411、203撃破、終了HP192。熟練自動入力では敵が早く倒れ、最大生存敵は6、最大連鎖は2だった。大群感・狙う最初の敵を変える理由・進化の主観的な差は人間の試遊で未検証。

## 既存の集約失敗を基準SHAで照合

基準 `4520c57ede444d44b8699753645f36ce479b72bf` を別のdetached worktreeへ展開し、同じ依存・Nodeで次を再実行した。元のcheckoutや未保存差分は変更していない。

```sh
npm test -- tests/stages.test.ts tests/aim.test.ts tests/maps.test.ts tests/weapon-stat-marks.test.ts
```

基準も試作も同じ4 suiteが失敗（3 assertion失敗＋1 import失敗）。基準限定再実行は48成功/3失敗、4 suite失敗。

1. `tests/weapon-stat-marks.test.ts`: `src/client/weapon-help.ts:123` のmodule評価時 `ReferenceError: document is not defined`
2. `tests/aim.test.ts:127`: rocket中心距離、期待1.25に対し1.8750000000000022
3. `tests/maps.test.ts:103`: 晶脈の地底巣の出現位置がblocked、期待falseに対しtrue
4. `tests/stages.test.ts:61`: Stage25、time128.1499999999949、kills78でdefeat、期待victory

この4件をP1aのために書換えたり、除外して全件合格とは報告しない。

## 実ブラウザは起動前に遮断

`e2e/rebuild-p1a.spec.ts` に7ケースを準備。テスト発見・単独TypeScript検査・Prettierは成功。初回実行と許可された書込み可能な一時HOMEによる再実行の双方で、Chromiumが画面遷移前に終了した。

```text
FATAL:chrome/browser/process_singleton_posix.cc:297
Check failed: . socket() failed: Operation not permitted (1)
```

別のcloud browserによるlocalhost表示も `net::ERR_BLOCKED_BY_CLIENT`。制限を回避しない。ブラウザでアプリを観察した証拠やスクリーンショットは取得していない。

未検証のUIケース: 844×390/640×360の横3枚と可読性、読み込み中、初期選択、1秒再開、繰返し操作、押しっぱなし射撃/移動/キーリピート、実際のblur/非表示、再挑戦、再読込み、合成旧保存fixtureの不変、console error。実環境がheadlessで非表示を再現しない場合は該当ケースをskipし、実機で補う。

## 独立監査・人間・端末

- リポジトリ指定はユーザーPCのIAB通常Chat。今回利用できる許可済み実行環境にはその経路がなく、未依頼・未合格
- 内部の別担当コードレビューは不具合発見/修正に使用したが、指定の外部監査合格とは扱わない
- 人間の試遊、物理スマホの入力・フレーム時間・10分発熱、協力2〜4人はいずれも未実施。協力は今回P1aの範囲外
- 既存の本番Worker・旧PC・新PCには変更を加えていない

## 最終実行結果

- P1a焦点: 4 files / 120 tests 成功。内訳は強化32・戦闘24・run47・UIゲート17
- client/Worker型検査、旧保存10 files / 147 tests、P1a build、通常build、Worker dry-run 成功
- 最終集約: 58 files中54成功/4失敗、794 tests中791成功/3失敗。失敗は上記基準再現済みの4 suiteのみ（うち1 suiteはimport失敗のためテスト未実行）
- 変更ファイルのPrettierと `git diff --check` を確認。既存の500kB超bundle警告は残る
- ブラウザ7ケースは準備/発見/型検査のみ。実行は起動前の環境制限で未検証。独立IAB監査も未実施
- 内部別担当レビューの3指摘（押しっぱなしキー復活、再抽選不可時のボタン、出現座標のfallback）を修正。元の再現条件で再確認済み。独立監査とは別
- 出現回帰には1,248組の実地形/敵種/距離照合と大型6位置の確認を含む


検証対象のソース/テストのSHA-256は [source-hashes.json](evidence/rebuild-p1a/source-hashes.json) に保存。最終Git treeの照合は専用ブランチの引き継ぎ記録を参照。
