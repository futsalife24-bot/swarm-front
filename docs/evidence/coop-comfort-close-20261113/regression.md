# 着弾抜けと省略中の敵消失の回帰照合（2026-11-13）

基点は `main` の `3fd6e65faa6af9fe6ed3c147abe17b3d8607f28b`、作業branchは `codex/coop-comfort-close-20261113`。旧製品ソースは `scripts/check-coop-comfort-regression.mjs` が `git show` で Git 除外の `dist-validation/coop-comfort-regression/` へ展開する。製品本体は旧版へ戻していない。新規インストールは行っていない。

|症状|旧製品SHA|旧版の結果|現行の結果|
|---|---|---|---|
|敵弾100個で発射弾が消える、ロケットが敵球を通過する|`3e1dc640e15d747cc2a06ac72c59833db2072f74`|`tests/player-projectile-pressure.test.ts` の13件中6件成功・7件失敗。対象の2件では、発射後の味方弾が期待1・実際0、敵HPが80.75から減らない。残る5件は同じ修正で守る球面入射・床・静止弾の回帰。|同じ13件すべて成功|
|送信で敵IDが省略された際、受信済みの敵が消える|`7c33c877ff87e4ca18043d902c14bb316d7e3067`（省略通知・保持導入直前）|`tests/coop-comfort-regression.test.ts` の1件失敗。敵ID `4` を受信した後、省略中の受信列が期待 `[4]`・実際 `[]`。|同じ1件成功。受信列は `[[4],[4],[]]`。最後の空配列は確定消滅時。|

実行: `node scripts/check-coop-comfort-regression.mjs`。旧版は期待どおり失敗、現行版は両方成功した。機械可読の実行結果と各試験の失敗行は、Git 除外の `dist-validation/coop-comfort-regression/{summary,projectile-before,projectile-current,omission-before,omission-current}.json` にある。再実行で生成する一時証拠であり、リポジトリには追加しない。

現行送信側については `node node_modules/vitest/vitest.mjs run tests/front-wire-pressure.test.ts --maxWorkers=1 -t '演出、遠いオーブ|省略時は直前表示'` を実行し、2件成功・8件スキップした。遠方の敵IDを容量内に収めるため省略し、受信済み個体だけ表示を保ち、確定消滅時に除く既存試験である。

省略中の敵表示の新規1件は、製品の `Network` 受信処理へ模擬WebSocketで3状態を送る局所試験である。旧版サーバーが実際に省略IDを送ったことの証明ではない。上記の送信側既存試験との組合せで送受信の契約を確認した。実Workerとの通信、実ブラウザ描画、通信遅延・負荷計測はこの担当では実施していない。現行の実通信計測は主担当の別証拠を参照する。

両旧版はその時点の `src/shared`（省略症状は `src/client` も）を隔離して実行した。旧版への現行試験の適用であり、当時存在しなかった将来の追加条件も含むため、失敗7件全てを当時の報告済み症状と同一視しない。診断時の直接2症状は [実体弾診断](../coop-comfort-20261030/projectile-diagnosis.md) と一致する。

## HARROW Dashのfilled予告容量（追加診断）

`mixed-render4` のページ例外 `Terrain marker exceeds fixed tessellation capacity` を、既存の草原 `MAPS[3]` と防衛地図 `DEFENSE_MAPS[3]` の両方で局所再現した。正規のDash半径4m・1024三角形枠を使うと、小数中心 `(5.25, 10.3)` と `(5.3, 10.25)` で例外が出る。対照 `(5.25, 10.25)` は1012面、`(5.2, 10.2)` は1020面で収まる。正規Dive claw半径1.45mは同じ候補で容量内。座標と個別の結果はGit除外の `dist-validation/coop-comfort-close-20261113/marker-capacity.json` に残した。この再現は地形不一致がなくても成立するが、実ブラウザ試行の各例外が全て同じ中心・同じ攻撃によるとまでは特定していない。

製品の `HarrowEffects.update` に正規Dash予告を渡す `tests/front-terrain-marker-capacity.test.ts` は、修正前の1024面枠で1件失敗。期待する「例外なし」に対し、同じ容量例外が出た。主担当が `dashFills` の1枠予算を既存共通上限4096面に変更した後、同じ1件が成功した。13枠の固定数、攻撃半径、当たり判定はこの変更対象外。機械可読の実行結果はGit除外の `dist-validation/coop-comfort-close-20261113/marker-before.json` と `marker-after.json`。局所Three試験であり、実ブラウザでの再確認とエネミーレポート画面の確認は主担当が別途実施する。
