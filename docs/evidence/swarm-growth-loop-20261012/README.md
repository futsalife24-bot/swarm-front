# 成長循環候補の検証（2026-10-12）

基点 `35125e556c85a249a024cd4c033c39ce249b8d67`、ブランチ `codex/swarm-growth-loop-20261012`。実装は [候補仕様](../../SWARM-GROWTH-REDESIGN.md)。本番セーブと既存公開版を変更していない。

## 合格した確認

- client / Worker型検査。
- 生存・成長・旧セーブ・再受取・不正データ・工房など関連139件。
- 保存回帰147件。旧所持品・旧pending >3・回復ドロップ・勝利後手動回収を保持。
- クラウド保存・共有武器庫・保存fixtures・成長循環59件。新規フィールドの検証、成長を消す旧端末の上書き拒否、初回ST1→生存Lv2武器→改造の費用3片、未保存進撃の武装片回復も確認。
- 実ローカルWorker/WebSocket13件。部隊長進度、参加者進度との差、進度0への復帰、恒久武器と改造、死亡時の個人戦果、再接続時の同一結果、不正進度拒否、既存の開幕/融合/60分終了/旧画面復帰。
- 実Chrome UI4件＋武器一覧1件。844×390と667×390のタイトル、反復遷移、進撃/協力生存導線、reduced-motion保存、改造の連打・変換・再読込、演出スキップと取消、全レア度/Lv60/最大改造の性能列重なり・横スクロールなし。

主な画像: [共通タイトル844](title-844.png)、[小さい横画面667](title-667.png)、[工房](workshop-844.png)、[成長値の武器行](gear-growth-844.png)。工房の数値は仮設定のテストセーブ。正式演出素材の完成デザインではない。

## 全体試験と既存失敗

全体実行は952件中948件通過・4 assertion failure、別途1 import suite failure。最終の初回費用調整後は関連139件・クラウド59件・ブラウザを再確認した。件数を足し合わせて全件合格とはしない。

変更前の独立 `baseline` worktree（同じ35125e5）で失敗5件を再現:

1. `aim.test.ts`: ロケットのカメラ位置期待値 1.25 と実1.875。
2. `render.test.ts`: 弾描画の期待位置 -7.5 と実-6。
3. `maps.test.ts`: 晶脈の地底巣の通路/敵侵入点判定。
4. `enemy-report-motion.test.ts`: HARROW空中発射位置の期待値。
5. `weapon-stat-marks.test.ts`: `weapon-help.ts` の document未定義によるimport失敗。

途中の「document未定義が新規問題」という推測は誤りだった。変更前の再実行で既存と確定し、今回その失敗を無断で修正・除外していない。

`npm ci` は依存High5件を検出。依存更新・脆弱性解消は実施していない。

Windows sandboxでVitestの別プロセスがSSR一時ファイルを読めず、`--pool=threads`で実行。初期ブラウザ/HTTP制限には専用localhostサーバーと権限レビュー付き起動を使用。部屋作成・接続制限は変更せず、test-only Workerでケースごとの試験クライアントを区別した。通信や保存そのものをモックにはしていない。ローカルfixtureの早送りは終了/受取の検証であり、長時間バランスの証明ではない。

## 未完了・再開条件

- 正式演出ZIP `libfile_6fe7f021941c819192d14b213859e75a` は転送helperのWindows非対応 (`os.setxattr`) により取得未完。README/consumer-manifestは未読。契約の推測で正式素材を差し込まない。
- 通常Chat独立監査は未実施。指定のiab起動が `cannot locate required Windows platform directory: HRESULT 0x80070003` で失敗。別の監査経路に切り替えていない。
- 実スマホ・長時間GPU・25任務を通じた収集/素材費用の調整・実クラウドの複数端末UI・正式デザインの美術的採用は未確認。
- merge・公開・破壊的移行は未実施。素材取得、本人の候補レビュー、既存失敗/Highの受入方針、独立監査を満たしてから通常手順で再開する。

生ログは作業場所の `dist-validation/growth-review-front.json`, `growth-review-cloud.json`, `growth-final-transport.json`, `growth-review-unit.json`, `growth-baseline.json`, `growth-baseline-marks.json`。本記録とソース・テスト・画像をレビュー用に保存する。
