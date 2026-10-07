# ST25 seed814の敗北を限定観測（2026-10-07）

## 実行前に固定した範囲

対象mainは`1c2f4ba44348ab95558ca0362f4f50a561e900d0`。調査branchは`codex/stage25-observation-20261007`。[直前の5ファイル分類](https://github.com/futsalife24-bot/swarm-front/blob/6b1ceac5d636168162f643d4e151b6a7de8d4664/docs/UNIT-BASELINE-INVESTIGATION.md)で残ったST25だけを扱う。正本は`https://github.com/futsalife24-bot/swarm-front`、作業場所は`C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。

- 最大3走行。既存`tests/stages.test.ts`と同じworld名`clear-25`、seed814、ST25、STARTERS先頭2丁の合法装備、既存pilot、50ms刻みで、通常1回と観測付き1回。それぞれ上限12001tick、通常の勝敗で終了。
- 両走行の入力と毎tickのworld全体のJSONハッシュを比較する。観測による差が出た場合は原因を未確定に戻し、追加の入力比較を実行しない。
- 原因が絞れた場合だけ最大40tick（2秒）の分岐1回を許容。観測で得た直前の実worldを複製し、同じ記録入力を基本として、通常入力の回避タイミングまたは移動方向の**1案**だけを変える。HP・敵・装備・乱数・難度・時間・勝敗条件は変えない。成功までの探索はしない。
- 記録は入力、兵士の位置/HP/回避状態、敵の位置/HP/攻撃、弾の生成元、被弾処理の呼出元/処理前後。通常版と観測版は既存esbuildで隔離bundleを作り、観測版だけメモリー上の呼出に読み取り用ラッパーを挿す。src/testsのファイルは変更しない。差分アンカー数と元ソースSHAを残す。
- 全件試験・他の既知失敗・ブラウザ・Worker・公開・main反映は対象外。モデルID・推論設定は取得根拠がなく未確認。

## 結論

**この敗北の直接原因はHARROWの回転2回の被弾で、pilotが回避を約1.15秒早く使うことが関係していた。** 通常走行と観測走行は全2563tickの入力・world JSONハッシュが一致し、既知の128.15秒/78撃破/敗北を再現した。通常入力の`dodge`時刻だけを遅らせた末尾40tickでは、同じ128.10秒の回転を無被弾で通り、128.15秒時点でHP113.68、生存・戦闘継続となった。

回避の製品処理が効かない不具合はこの限定比較では再現していない。ST25全体が勝てる、難度やUIが適切、人が同様に避けられるという結論ではない。

## 実施結果

Windows / Node v24.19.0。20:13 JSTに通常＋観測、20:15 JSTに40tickの入力比較を実行。計画通り**全走行2回＋短区間1回**で終了した。依存追加、src/tests/設定変更、全件試験、UI操作、独立監査、main反映、Worker公開は行っていない。

| 観測 | 結果 |
| --- | --- |
| 条件維持 | `clear-25`、seed814、ST25、既存STARTERS先頭2丁の合法装備、既存pilot、dt0.05 |
| 通常/観測の一致 | 各2563tick、全tickのworldと入力ハッシュ一致。集約SHA256は[comparison.json](evidence/stage25-observation-20261007/comparison.json) |
| 敗北 | 128.10秒にHP0、次のtickの128.15秒に「部隊が全員ダウンしました」。第3波、78撃破。タイムアウトではない |
| 被弾 | 花粉4回（各5.92）とHARROW id77の回転2回。弾・近接・ミサイルによる被弾はこの走行で0回 |
| 最初の回転 | 95.95秒に予告開始→96.00秒に回避→97.15秒に被弾。HP160→35.68、124.32減少 |
| 致死の回転 | 126.90秒に予告開始→126.95秒に回避→128.10秒に被弾。攻撃値84×ST25倍率1.48＝124.32、残HP113.53を失った |
| 被弾時の回避状態 | 回避時間0、再使用待ち1.05秒。両回ともdodge入力はtrueだが、再使用待ちで受け付けられない |
| 短区間の比較 | 126.15秒の実worldを複製、40tick/2秒だけ同じ記録入力を再生。Spin中のdodgeだけを127.95秒の1回へ変更。128.10秒の回転呼出時に回避0.17秒が残り、減少HP0。hitIdsにpを記録。終点128.15秒でHP113.68/戦闘継続 |

花粉は23.0/24.0/24.5/25.0秒の同じcloud id29によるもの。その後に通常の安全時回復が働き、最初の回転時点ではHP160。生成元の個体IDまでは観測メタデータで結べていない。2回目の回転までにも通常回復があり、残HPは113.53になっていた。回復・HP・敵への直接変更はしていない。

## pilotの挙動と製品処理の切り分け

`tests/bot.ts`は、予告円からの脱出距離が残り時間内の歩行距離を超えると`imminent=true`にして、即座に`i.dodge=true`を出す。HARROWの大きな回転範囲では予告直後からこの条件を満たす。製品の回避は0.32秒、再使用待ちは2.2秒なので、今回の攻撃接触まで持続しない。

現行`HARROW_SPIN_TIMING.wind`は1.15秒。`harrow.ts`は予告後の接触時に`hurtPlayer`を呼び、`game.ts`は`p.evade > 0`なら減少を抑止する。今回の短区間ではその抑止と、回避中でも当該Spinの`hitIds`へ登録されるところまで実測した。登録後に同じ回転を再処理しない条件はコードで確認したが、回転終了までの実行はしていない。

比較案は記録済みの移動/照準/射撃入力を再生したもので、変更後の位置に応じてpilotを再評価していない。回避時刻を変えると移動速度も変わるため、座標まで固定した比較ではない。1つの致死攻撃を通常入力で回避できた証拠に限り、試験操縦の修正が完成した証拠や通し勝利にはしない。攻撃判定の1.15秒に対して実測接触が1.20秒になったのは50ms刻みと浮動小数点境界によるものとコードから説明できるが、他の時間刻みの検証はしていない。

### 同時に分かった入力制約の不一致

通常/観測ともtick1822（適用後91.15秒）のpitchが`1.4011352373649821rad`＝80.2791度で、`MAX_PITCH`の80度を超え、実`validInput`がfalseになった。その他2562tickはtrue。既存stages試験は入力検証を挟まず`step`へ渡していた。装備は合法だが、**この既存pilot走行を「全入力が製品の受付範囲内」とは扱えない**。短区間比較の40入力は全て`validInput`でtrueを確認した。

この1フレームが敗北経路全体へ与える影響は未比較。回転の直接的な被弾源・回避終了は実測できている一方、入力を全て受付範囲へ収めた場合のST25結果は未確認。

## 観測の安全性と証拠

[observe-stage25.mjs](../scripts/observe-stage25.mjs)は元ファイルを変更せず、esbuildのメモリー上のソースだけに被弾9箇所・弾生成元2箇所の計11箇所を観測するラッパーを挿す。元の被弾関数は必ず1回だけ呼ぶ。条件/値は変更しない。[instrumentation.json](evidence/stage25-observation-20261007/instrumentation.json)にアンカーと変更前後のハッシュを保存。通常版と観測版の依存29ファイルは一致し、毎tickのworldと入力も一致した。

[replay-stage25-dodge.mjs](../scripts/replay-stage25-dodge.mjs)は比較成功を前提に、保存した実worldから40tickだけ分岐する。journalの回数確認、ソースハッシュ照合、入力検証があり、同じ出力先を自動再試行しない。再現する場合は対象main SHAの隔離した作業場所にこの2スクリプトを取得して使う。新しい対象SHAでの実行を同じ証拠と混同しない。

- [実行前の上限](evidence/stage25-observation-20261007/plan.json) / [実行回数](evidence/stage25-observation-20261007/execution-journal.json)
- [通常走行](evidence/stage25-observation-20261007/baseline.json) / [被弾観測](evidence/stage25-observation-20261007/observation.json) / [入力・状態の一致](evidence/stage25-observation-20261007/comparison.json)
- [全tickの有限ログ（gzip JSONL）](evidence/stage25-observation-20261007/trace.jsonl.gz) / [直前worldと入力（gzip JSON）](evidence/stage25-observation-20261007/final-window.json.gz)
- [短区間の事前1案](evidence/stage25-observation-20261007/replay-plan.json) / [40tickの比較結果](evidence/stage25-observation-20261007/replay.json)
- [通常実行出力](evidence/stage25-observation-20261007/run.txt) / [短区間の出力](evidence/stage25-observation-20261007/replay-run.txt) / [対象・証拠ハッシュ](evidence/stage25-observation-20261007/manifest.json)

## 次の具体案（1件・未実施）

**既存pilotの入力生成を製品の制約に合わせて修正する。** HARROW回転は予告直後の移動と衝突直前の回避を分け、pitchも既存の`clampPitch`を使う。対象は試験操縦に限定し、製品のHP・火力・攻撃時間・勝利期待値は維持。入力受付範囲と回避時刻を局所検証してから、ST25 seed814だけを1回確認する。今回この修正・再試験には着手していない。
