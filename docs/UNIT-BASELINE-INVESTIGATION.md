# 既定単体5ファイルのWindows再分類（2026-10-07）

現行mainの指定5ファイルだけを**1回**実行した。結果は53件成功・4件失敗、別に1ファイルがDOM不足で読み込み停止。分類は古い期待値2件、実行環境不足1件、未確定2件。製品不具合と確定できた件数は0だが、不具合がないことを意味しない。修正・期待値変更・main反映・公開は今回の範囲外。

## 対象と実行条件

- 正本: https://github.com/futsalife24-bot/swarm-front 。作業場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。
- 対象main/base: `1c2f4ba44348ab95558ca0362f4f50a561e900d0`。開始時にローカルmain、origin/main、GitHub mainの一致を確認。公開製品ソースは`b10e685b7a13374bfb66e06feeb47a9d162ca064`、PR146/記録PR147の公開状態を維持。
- 調査branch: `codex/unit-baseline-investigation-20261007`。cleanなmainから作成。前の非表示調査branch `codex/visibility-cleanup-investigation-20261007` / `85388dcba3c13bae0d8f43b34012751c82685885` は保存済みで変更しない。
- Windows NT 10.0.26200.0、Node v24.19.0、Vitest 5.0.0。既存の依存を使用。既定`vitest.config.ts`の`fileParallelism:false`、各試験30秒上限を変更しない。
- 実行開始19:52 JST、終了約19:53 JST。約40秒で終了、exit code 1。環境作成時刻とVitest開始時刻は数秒異なる。モデルID・推論設定は未確認。
- 全件単体・ブラウザ・hidden再測定・Worker・buildは実行しない。追加のゲーム実行や失敗ケース再試行もしていない。後続の切り分けはコード・既存文書・Git履歴の読み取りだけ。

```powershell
node node_modules/vitest/vitest.mjs run tests/aim.test.ts tests/maps.test.ts tests/render.test.ts tests/stages.test.ts tests/weapon-stat-marks.test.ts --config vitest.config.ts --reporter=json --outputFile=dist-validation/unit-baseline-20261007/result.json
```

[実行環境](evidence/unit-baseline-20261007/environment.json)、[生JSON](evidence/unit-baseline-20261007/result.json)、[標準出力・標準エラー](evidence/unit-baseline-20261007/run.txt)、[終了コード](evidence/unit-baseline-20261007/exit-code.txt)、[分類集計](evidence/unit-baseline-20261007/summary.json)、[証拠・参照ソースのSHA256](evidence/unit-baseline-20261007/manifest.json)。JSON reporterでは`console.log`の戦闘途中状態は出力されておらず、失敗時の被弾履歴はない。再実行で補完していない。

## 結果と最小対応案

| ファイル | 今回の結果 | 分類 | 根拠と最小対応案（未実施） |
| --- | --- | --- | --- |
| `aim.test.ts` | 9成功、1失敗 | 仕様や期待値の古さ | 127行目で中心から着弾点まで1.25を期待、実測1.875。敵サイズ1.5倍採用後の`1.25 × 1.5`と一致。旧固定半径の試験を、採用済みサイズと個体差を明示したfixtureへ更新する案。方向・近遠・仰角の検証は維持する。 |
| `render.test.ts` | 5成功、1失敗 | 仕様や期待値の古さ | 32行目で0.05秒後のz=-7.5を期待、実測-6。PR135で描画速度150→120となり、`120 × 0.05 = 6`。現行描画仕様の速度を明示して試験を更新し、短弾・最大輪径・破棄の検証を維持する案。古い説明文も時点を明示する。 |
| `weapon-stat-marks.test.ts` | 読込失敗、収集・実行0件 | 環境不足 | `document is not defined`。`gear-weapon-list`→`weapon-help`のimportで、トップレベルの`document.addEventListener`へ到達する。Nodeの既定設定にDOMなし。純粋な行生成とブラウザイベント登録を分離するか、既存のDOM試験環境を明示する案。数値試験をskip・無条件mockで通さない。 |
| `maps.test.ts` | 5成功、1失敗 | 未確定（試験対象域の不整合が有力） | 洞窟の103行目、敵出現後の`blocked`がtrue。現行試験は全敵種を強制出現させ、先頭がHARROW。静的に、飛行高34.5＋半径3.4は洞窟天井の上限10.5を超える。既存の通常洞窟ST10/16にはHARROWがいない。合法な編成に対する出現安全性と、未対応の敵・地形を直接生成した時の契約を分けて確認する案。現段階では除外や閾値緩和をしない。 |
| `stages.test.ts` | 34成功、1失敗 | 未確定 | seed814・合法装備・既存pilotでST25が128.15秒/78撃破でdefeat。ST1〜24と残り10試験は成功。HARROW/武器/敵/操縦は過去から変更されており、どの変更が原因か未特定。別の有限調査でST25の同条件だけに被弾元・位置・入力・敵状態を記録し、回避可能性と試験操縦を切り分ける案。敵弱体化、勝利条件緩和、無敵化はしない。 |

生JSONの`numTotalTestSuites:7`/`numFailedTestSuites:6`はdescribe階層を含む集計で、ファイル数ではない。`testResults`は指定5ファイル。実行された57試験の内訳は53成功・4失敗、`weapon-stat-marks`の読込停止はその4件に含めない。今回の成功数だけで全体テスト成功とは扱わない。

## 分類の根拠と限界

### 照準

[敵サイズ1.5倍の採用記録](MONSTER-SIZE-150.md)はPR47/実装`ce32074`。現行`enemy-size.ts`の`enemySize`はcrawlerに1.5倍を適用し、`game.ts`の`enemyBodies`→`cameraShot`がその半径を使う。試験のfixtureは先頭個体サイズ1。観測値1.875の説明が一致する。[CALYX記録](CALYX.md)にも「aimの旧半径期待値」の既知失敗があり、今回が初発とはしない。旧SHAの再実行や全角度の成功は主張しない（最初の失敗で当該試験は終了）。

### 弾の描画

`6e376a9f0ddeeacd5da3dea095f23e3c562b3c7e`で`combat-effects.ts`の寿命`distance / 150`と速度150が、寿命`distance / 120`と速度120へ同時に変更されている。PR135の[採用・公開記録](FRONT-EXPANSION-EFFECTS-RELEASE.md)は全モード共通の見やすさ改善を扱う。試験の-7.5は2026-09-12から残っている。[旧説明](COMBAT-EFFECTS.md)の150m/sも当時の値で、今回その文書や試験を変更していない。失敗行以降の同一試験内の輪径・破棄は今回未到達。

### 洞窟の出現位置

実行ログにseedや敵kindの直接記録はなく、HARROWの特定は**コードを順に追った推論**。`ENEMIES`の先頭HARROW→`spawn`の洞窟ノード選択→高度加算→`caveBlocked`で天井超過、という経路は現在のソースから説明できる。通常の編成ではHARROWがST20/25と15-Aの地上マップへ配置されることを[導入仕様](HARROW-INTEGRATION.md)と`stages.ts`で確認した。ただし全モード・保存復帰・開発用の生成経路を網羅していない。製品到達性や、汎用`spawn`が未対応の組み合わせを拒否すべきかまで未確定のため、「テストだけ直せばよい」と断定しない。

### ST25の敗北

テストは`createWorld`の通常ルール・1人pilotであり、`/front`の実プレイ、実通信協力、人の難易度体感ではない。[HARROW導入時](HARROW-INTEGRATION.md)には通常25面35試験の成功記録がある。その後[強化仕様](HARROW-BALANCE-V8.md)でHP5200→8800や攻撃・間隔が変わり、回転範囲も`8b96d4777c696553335b3b6558f6a438c25639d2`で28mへ変更。現行pilotはHARROWの予告半径を参照しており、「HARROWを知らない古いbot」とも断定できない。78撃破時点の敗北だけからHARROWが直接の死因とも判断できない。変更点二分探索、別seed、別装備、実プレイは今回未実施。

### DOM不足

`tests/weapon-stat-marks.test.ts:12`→`src/client/gear-weapon-list.ts:2`→`src/client/weapon-help.ts:123,181`。既定`vitest.config.ts`にはDOM環境・setupFilesの指定がない。[CALYX記録](CALYX.md)にも`weapon-help`のdocument依存による停止が記録済み。これは「武器性能印の全試験が失敗した」結果ではなく、試験を収集できない状態。実ブラウザの製品で`document`がないという不具合を再現したものではない。

## 継続時の扱い

[メニュー品質記録](MENU-POLISH.md)と[PR142公開記録](MENU-POLISH-RELEASE.md)に残っていたLinuxの5ファイル失敗を、今回は現行mainのWindowsで確認した。Linuxの当時の全失敗ケース/数値との完全一致は検証していない。前回から未検証だった項目を「既知だから合格」へ変更しない。

今回の変更はこの調査文書、STATE先頭、証拠のみ。製品・試験・設定・依存・Hooks・CI・main・Workerを変更しない。独立監査は依頼せず、製品変更の監査合格とも扱わない。次の実装に進む場合は対象を選び、必要な再現証拠を得た上で既存の検証・独立監査・公開手順を適用する。特にST25を最初の追加調査候補とするが、この記録を追加実行の承認や自動予定にはしない。
