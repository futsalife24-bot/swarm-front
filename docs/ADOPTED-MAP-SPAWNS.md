# 採用済み編成の限定出現テスト候補（2026-10-07）

## 目的と範囲

[洞窟契約の静的調査](https://github.com/futsalife24-bot/swarm-front/blob/b8ea4bc695cc22381cef26dcc7366d484d942352/docs/CAVE-SPAWN-CONTRACT.md)で、全敵種を洞窟へ直接生成する既存試験と、採用済み編成の対象域が一致しないと判明した。元の`tests/maps.test.ts`と期待値・skip条件を保持し、新しい`tests/maps-adopted-spawns.test.ts`で元の草原・雪峡・洞窟3地形とseed 1〜30を確認する。値を調整して成功を作らず、候補の型確認後に限定試験を1回だけ実行する。

- 正本: https://github.com/futsalife24-bot/swarm-front 。作業場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。
- base/product source: `1c2f4ba44348ab95558ca0362f4f50a561e900d0`。再開時もローカルmain・origin/main・GitHub mainが一致。branch `codex/adopted-map-spawns-20261007`、停止記録HEAD `bbd2657682a78113a5afc21d143711be7ea7dcbf` から継続。
- 2026-10-07の本人「作業再開」で停止を解除。作成・自己レビュー・型確認・限定1回実行・証拠保存・commit/push・保管庫記録が今回の範囲。UI・独立Chat・PR・main反映・公開は含めない。
- 製品のspawn/保存/敵性能/天井、既存テスト、設定、CI、Hooksは変更しない。全件試験、maps既存失敗の再試行、ST20/ST25、戦闘step、描画、Worker、buildも実行しない。モデルID・推論設定は未確認。

## 固定許可表とfixture

| 地形 | 通常ST番号 | 雑魚・増援 | ボス形態 | 通常位置fixture / 増援fixtureのST |
| --- | --- | --- | --- | --- |
| 草原 map 3 | 2/4/7/15/17/20/24/25、別に15-A | crawler/ant/spider/spitter/hornet/calyx | crown/worm/harrow | 2 / 15 |
| 雪峡 map 4 | 13/14/19/23 | crawler/ant/spider/spitter/hornet/calyx | crown/worm | 13 / 13 |
| 洞窟 map 5 | 10/16 | crawler/ant/spider/spitter/hornet | worm | 10 / 10 |

表は対象ソースの採用済み編成を静的に記した期待値。実装から期待値を動的生成しない。実ST番号、雑魚/ボス形態の和集合、15-Aの割当、連結炉の許可リストが表と一致しなければ失敗する。HARROWだけをskipする構成ではない。元と同じ基底MAPSの3地形を使うため、別の高台版の位置は対象外。

- 床の接続は元と同じ2m間隔、x=-92〜92・z=-102〜102、半径0.55・高度0で検査する。
- 通常位置はseedごとに実`createWorld`/`spawn`を使用。雑魚全種とボス各形態を順に生成し、最終x/y/zに対して元と同じ基本半径の実`blocked`がfalseかを確認する。洞窟は実際のworm形態も生成する。胴体座標は記録するが全胴体やモデル縮尺の安全性はこの条件の保証に含めない。
- 増援は実wormを生成し、実`queueFoundrySpawn`で接続胴体7個のキューを作る。頭の撃破直後をfixtureとして初期化し、実`flushFoundrySpawns`を1回呼ぶ。乱数抽選前のキュー30 seedと、許可された各種の抽選済みキュー30 seedを分けて確認。抽選済みは7枠をその合法種に固定した保存状態で、乱数や配置処理のmockはない。
- 増援の全7件が配置できない時も失敗として記録する。ただし未配置キューが残る結果だけで、製品が永久に進まない不具合とは断定しない。通常戦闘の後続stepでの再試行は対象外。
- soft assertionで観測可能な位置を保存し、期待値・座標・地形は修正しない。未対応の直接生成や編集保存を拒否する契約は引き続き未定義。

予定は契約3件＋床3件＋通常位置90件＋増援600件＝696試験。位置判定は通常690個体＋増援元600個体＋増援4200個体＝5490個体（全生成成功時）。この予定数を実行成功数と扱わない。

## 実行方法と結果

候補だけを既存tsconfig継承の一時設定で型確認する。既存Vitestのincludeはファイル列挙なので、[有限実行補助](evidence/adopted-map-spawns-20261007/run-once.mjs)は既存`vitest.config.ts`を読み、実行時のincludeとファイルフィルターで候補1ファイルを選ぶ。30秒上限・fileParallelism:false・Node環境は継承する。設定ファイルを変更しない。実行開始マーカーが存在したら反復を拒否する。

実行時の候補は未コミットなので、実行時HEADと候補SHA256を別々に記録した。候補SHA256は`11190c7bb8e0ed2b328036f103851282110e0473e6e45d7d105383d564476d3c`。実行後に候補・元maps・既存Vitest設定のハッシュ不変を確認した。

Windows / Node v24.19.0 / Vitest 5.0.0、22:51:30〜22:51:34 JSTに**1回だけ**実行。結果は696件中694成功・2失敗、skip 0、exit 1。実際に選択されたファイルは候補1件のみ。既存includeに候補が追加された実行時設定となったが、ファイルフィルターにより旧mapsを含む他ファイルは実行されていない。解決後の30秒上限・fileParallelism:false・Node環境も記録した。

| 区分 | 成功 / 失敗 | 確認した範囲 |
| --- | --- | --- |
| 草原 | 242 / 0 | 固定表・床・通常位置・未抽選/合法抽選済み増援の30 seed |
| 雪峡 | 242 / 0 | 同上 |
| 洞窟 | 210 / 2 | 通常wormを含む通常位置は全成功。増援hornetの最終位置2条件で失敗 |
| 固定表と床 | 6 / 0 | 3地形の採用済み編成・許可リスト・床接続 |
| 通常位置 | 90 / 0 | 690個体の最終位置 |
| 増援 | 598 / 2 | 元worm 600個体と増援4200個体。未配置キュー0 |

位置観測は予定と同じ5490個体、衝突trueは以下の2個体。soft assertionのため、失敗後も観測を保存した。値や期待を変更せず、試験の再実行もしていない。

| 条件 | 最終x / y / z | 基本半径 | 天井（数式から算出） | 高度＋半径 | 天井超過 |
| --- | --- | --- | --- | --- | --- |
| 洞窟ST10・未抽選増援・seed 22・hornet | -33.00000000000001 / 7.846668809611776 / 3.1961524227066302 | 1.15 | 8.57107393788466 | 8.996668809611776 | 約0.426m |
| 洞窟ST10・hornet抽選済み増援・seed 17 | 43 / 7.93845899850223 / -42.80384757729337 | 1.15 | 8.436967088139836 | 9.08845899850223 | 約0.651m |

増援元は両方ともworm。観測JSONの子`form:"crown"`は通常雑魚spawnの既定引数を記録したもので、子がcrownボスという意味ではない。

### 原因と限界

`foundry-spawning.ts:49–76`の候補選択は高度`ENEMIES[kind].cruise`（hornetは6.5）で衝突を確認する。その後110–120行目で実`spawn`を呼び、最終x/zを候補へ戻し、最終yを`groundHeight + cruise`へ上書きする。通常`spawn`が洞窟hornetに適用する上限5も、この上書きで失われる。

両失敗は6体目の増援。記録した増援順からordinal 6と推定し、`enemy-size.ts`の1.05×1.5を用いると候補選択半径は1.81125、高度＋半径は8.31125となる。これは両地点の天井以下で、横方向の余裕も足りる。一方、最終位置へ地面高約1.347m/1.438mが加算されると、元試験の小さい基本半径1.15でも天井を超える。[計算根拠](evidence/adopted-map-spawns-20261007/failure-analysis.json)は**記録済み座標の数式解析**で、製品関数や試験の追加実行ではない。

採用済みの未抽選増援処理でも、生成後の最終高度が天井に収まらない不整合を再現した。先の全敵種強制HARROWとは別の問題であり、「合法編成だけなら全部通る」とは結論できない。

fixtureはプレイヤーなし・時間0のworldへwormとキューを初期化したもの。実任務の乱数履歴・戦闘・実際の頭撃破・次tickの移動・画面での見え方は未確認。ここでのseedはfixtureの初期乱数で、通常任務の同じseedで同じ位置になる保証ではない。モデル縮尺を含む全胴体、別の高台版、全作戦、未対応の直接生成/編集保存拒否も今回の保証外。

次の最小修正候補は、増援候補選定と最終配置で高度計算を揃え、通常洞窟hornetの上限5を維持し、実際の最終高度で天井を検査すること。影響は共通連結炉増援（通常ST10/16等）とその試験。今回は修正を実施せず、この記録を自動で修正・再実行する指示にしない。

### 型確認と証拠

型確認の初回は証拠出力用`node:fs`/`process`の型不足、Node型参照を明示した2回目も型定義自体がなく停止した。依存や既存設定は追加・変更せず、候補の観測JSONをVitestのconsole記録へ出し、実行補助のreporterが保存する方式へ変更。最終の限定型確認と実行補助の構文確認は成功した。この変更は**試験開始前**である。型確認2回の失敗も保存し、ゲーム試験の反復と混同しない。

型確認: `node node_modules/typescript/bin/tsc -p dist-validation/adopted-map-spawns-20261007/tsconfig.json`。
有限実行: `node docs/evidence/adopted-map-spawns-20261007/run-once.mjs`。

証拠: [実行記録](evidence/adopted-map-spawns-20261007/execution.json)、[集計](evidence/adopted-map-spawns-20261007/summary.json)、[生結果JSON](evidence/adopted-map-spawns-20261007/result.json)、[全観測](evidence/adopted-map-spawns-20261007/observations.json)、[ログ](evidence/adopted-map-spawns-20261007/run.txt)、[型確認](evidence/adopted-map-spawns-20261007/typecheck.txt)、[型の一時設定](evidence/adopted-map-spawns-20261007/typecheck-config.json)、[ハッシュ一覧](evidence/adopted-map-spawns-20261007/manifest.json)。全観測JSONは内容不変でcompact化し、ログ中の重複した全観測行だけを別ファイルへの案内に置換、改行/末尾空行を整理した。元ファイルのハッシュも保存し、原本はdist-validationへ保持する。

候補と元maps・設定の差分を自己レビューし、製品・既存テスト・依存・設定・CI・Hooksの不変を確認してbranchへ保存する。今回の有限確認は失敗2件を記録して完了。全体単体成功・製品修正・監査合格・main反映・公開完了とは扱わない。
