# 参照画像から制作した兵士のモーション修正

## 現在地（2026-10-09）

制作途中。ローカルのStandardTrooper描画に4人・32動作・4色を接続済み。歩行距離と足の位相、装填時の支持手、回避時の両手保持を修正した。公開ゲームは未変更。旧モーションはユーザー不承認であり、構造検査や静止画だけで自然さの合格とは扱わない。

現行ローカルGLB: `746e35fd16126f5c09140ef6e193eea7e48d0be23eb9dda17cac50c64a67ae23`。持ち替えの左右腕を追加修正し、他30動作の不変を照合。背負い武器と体の干渉が残り、取付位置を調整中。転倒時は背負い装備の厚みに合わせて胴体を支え、かかとを地面へ落ち着かせる。回避は銃を胸元に保持し、背面接続点を固定したまま武器の向きを変えて床を避ける。回避の全身持ち上げ案は見た目が不自然なため不採用。体と武器の接地・32動作の秒数・構造検査を通過した。実ゲームでの自然さの最終確認は未完了。

公開GitHubへのpushと、実ゲームの「新しい進行を開始」確定は、自動承認レビューの拒否により各ユーザー承認待ち。再試行・迂回はしていない。独立した動作制作と検証は継続可能。

- リポジトリ: https://github.com/futsalife24-bot/swarm-front
- 作業ブランチ: `codex/soldier-motion-reference-20261009`
- 基準: `de67860cfae978f3ee0bbd6784fc33a38ce68686`
- Git作業場所: `C:/Users/futsa/Documents/Codex/2026-10-09/swarm-soldier-motion`
- 制作場所: `C:/Users/futsa/Documents/Codex/2026-10-07/https-x-com-dstudio-ai-status/soldier-motion-20261009`
- モデルID・推論設定: 未確認

## 変更と根拠

QuaterniusのCC0データを歩行・走行・跳躍・回避・転倒などへ転送した。武器動作は既存ゲームのクリップを元に調整し、MixamoとReallusionの公開映像を銃の支持・移動姿勢の目視参考とした。有料モーションは取得していない。参照元・用途・限界は制作パッケージの `reference-plan.json`。

小指の骨位置と重みを修正し、右手のグリップ・左手の支持・武器別装填の軌道を調整した。歩行と走行は足の支持区間から求めた1周期の距離を使い、新兵士の旧転倒用20cm持ち上げを外した。回避では銃を胸元に両手で保持する候補へ変更。肩・胸の既存塗装をシアン・オレンジ・パープル・ライムに切り替える。

旧GLBがService Workerのキャッシュから再表示される問題を確認したため、モデルURLに内容SHAを付けた。モデル更新時はURLのSHAも更新する。キャッシュ修正前の画像は、その時点のディスク上のモデルと同一だとは保証しない。Service Workerやユーザーの保存データは削除していない。

検証画面 `/soldier-review.html` は通常ゲームと同じStandardTrooperを使用し、4人・武器別・正面/側面/背面・低速・1コマ送りを比較できる。これは描画用の独立した検証画面で、通信や実プレイ検証の代替ではない。

## 素材と再生成

保存場所は `assets/blender/source/swarm_soldier_20261009/`。対応とSHAは `manifest.json`。入力 `soldier-rig-input.blend` には本人の頭・体・骨格だけを保存し、キットの隠し素体やサンプルは含めない。

制作フォルダーでBlenderのバックグラウンド実行により、`retarget-ual.py` → `retarget-combat.py` → `polish-motion.py` → `refine-ground.py` → `arm-roll.py` → `ground-equipped.py -- --down-only` → `animate-sling.py` → `refine-rocket-reload.py` → `refine-switch-handoff.py` → `refine-switch-support.py` の順に実行する。現行版は次の入力を明示して書き出す。

```text
Blender --background --disable-autoexec --python export-game.py -- --source=soldier-switch-support-candidate.blend
```

`ground-equipped.py` の採用工程は `--down-only`。引数なしの全身持ち上げは回避の比較実験で、不採用。`animate-sling.py` は転倒修正済み入力から背面武器の回避中の向きを作る。採否は `candidate-decisions.json`。`repair-hand-rig.py` はローカルの古い中間データの修正記録で、再生成は保存済みの修正済み入力を使う。

制作側 `review.html` と `soldier-motion-candidate.glb` は元の骨名を使う比較表示。ゲーム側GLBとは名称・前方基準が異なる。旧動画・接触一覧画像は制作段階ごとの比較資料。現行の実表示はゲーム側 `/soldier-review.html`、モデルは `public/assets/characters/swarm-soldier.glb` を正とする。QuaterniusとThree.jsのライセンスは素材へ同梱。

## 検証の範囲と残件

- `game-contract-check.json`: 必須57骨、32動作、2メッシュ、必要チャンネル・有限数・単調時刻。現行版errors空。
- `export-timing-check.json`: 32動作の秒数が補正前と一致。自然さを検証するものではない。
- `exported-ground-check.json`: 体・頭の実メッシュについて、歩行・走行・回避・転倒・跳躍開始・着地を240Hz相当で検査。8ec17d版は許容2mmを超える床貫通なし。
- `scripts/check-soldier-weapon-ground.mjs`: 実際の3武器系統のレア度0と全3接続点を、転倒・回避について240Hzで検査。レア度1〜4の静的形状が0と同一であることも照合。8ec17d版は全18組で床貫通なし、最小高さ約4.87mm。地形・ゲーム中の補間は対象外。結果は `weapon-ground-current.json`。
- `runtime-sling-roll-010.png` / `runtime-sling-roll-015.png` / `runtime-sling-recovered.png`: 8ec17d版の回避0.10秒・0.15秒・0.35秒。旧 `runtime-armed-roll-inverted.png` は修正前の床貫通、`runtime-equipped-roll.png` は持ち上げ案を不採用とした証拠。
- 型チェック成功。関連単体4件の成功記録あり。最新の検証日時・対象は制作記録へ残す。

残件は背負い装備と身体の干渉・補間を含む全動作の自然さと切替、実ゲームでの4色識別・移動速度・武器接続、新モデルのビルド、独立Chat監査、承認後のGitHub同期・main反映・既存Worker公開・配信確認。開発画面でVite接続エラーを観測しており、console error 0とは報告しない。

## ロケット装填の追加修正

25e20a版は左腕が胸を横切って背中側へ伸びる装填を修正した。左手の経路と肘の曲がる向きを調整し、1秒・2秒の姿勢を実描画確認した。`reload-export-difference.json` は31動作、形状・逆バインド・骨基準の同一性を証明する。意図した左上腕・前腕・手の変更以外は、装填中の子指等に最大1e-5以内の書き出し丸め差分だけ。以前の接地検査の対象動作は不変で、新版を再検査したという意味ではない。

検証画面の装填は固定4秒から武器の実際の装填時間へ変更し、完了後の構えへ戻る区間も確認できる。`runtime-reload-refined-*` は修正モデルの旧4秒比較、`runtime-reload-actual-*` は実時間での1秒・3秒。実ゲームの証拠とは区別する。5196の旧検証ソースキャッシュを避けるため、描画検証だけを5197で行った。進行開始の承認待ちを迂回せず、実ゲームは5196に維持。
## 2026-10-09 持ち替え候補の右側経路（未採用）

現行ゲーム用GLBは25e20aのまま。候補7eadc9cbf6df323029280591a88d6eaae9198448d8d3618430e35b27b9a90980をswitch-previewへ別保存。旧経路は取り出し途中に手が胸基準(0.047,-0.001,-0.002)m付近を通っていた。右側への経路を追加し、同区間の位置を(0.259,-0.001,-0.068)mへ移した。これは関節位置の診断であり、表面の非干渉を証明するものではない。

書き出し後の4受け渡し点は位置差0.006mm未満・回転差0度。左右の持ち替え以外の30動作、形状、逆バインド、骨基準の不変をcompare-switch-export.pyで照合した。元の直接経路の検査はdirect付きファイルに保持。inspect-switch-handoff.pyの角度は最小角へ正規化し、修正前報告も再生成した。

Chrome独立検証画面で候補の0.150秒・0.383秒を描画確認し画像保存。右手の中央通過は改善したが、左手首の不自然な曲がりが見えるため採用しない。次は左腕の待機と支持復帰、背面の干渉、通常速度での連続動作を確認する。静止画2枚で自然さ全体を合格扱いしない。参照したMocap Online公式Rifle Pro viewerは装備/収納クリップの始終姿勢を確認、途中軌道の確認は不足。有料素材の取得なし。

検証画面の最初の持ち替えがスロット変更なしで走っていたため、最初から別スロットへ切り替えるよう修正。型チェック成功。実ゲームの進行開始と公開GitHubへのpushは引き続き自動承認レビュー拒否後の承認待ちで、再実行していない。モデルID・推論設定は未確認。

## 2026-10-09 左支持手の修正と背面干渉の診断

現行ローカル制作版を746e35fd16126f5c09140ef6e193eea7e48d0be23eb9dda17cac50c64a67ae23へ更新。右側を通る持ち替えに加え、左腕を少し下げて戻し、手首は前腕に対して構え時の角度を保つ。Chromeで0.383秒の折れて見えた形の改善、0.483秒の支持復帰直前、0.600秒の構え復帰、背面0.233秒を確認。2動作各121サンプルの手の目標残差0.013mm未満。書き出し後4受け渡し点0.006mm未満・回転差0度、他30動作・形状・骨基準の不変、57骨/32動作/2メッシュと秒数照合に成功。自然さ全体の合格ではない。

背面の腰付近に武器の食い込みが見えたため、Three.jsから実GLBの変形済み体と、ゲームと同じ武器取付回転の座標を取り出して表面交差を検査。待機と持ち替えの2時点、2接続点×3武器の18組で体との交差を検出。後方へ20cm追加する数値試行では同18組の交差0だが、移動案は未適用。全動作・接地・腕到達・浮いて見えないことを確認して取付位置を修正する必要がある。三角形交差0は完全な立体内包検査でも実ゲーム確認でもない。

再生成: refine-rocket-reload.py → refine-switch-handoff.py → refine-switch-support.py → export-game.py -- --source=soldier-switch-support-candidate.blend。持ち替え差分比較の基準は25e20a（reload-preview、なければGitの27127c6保存GLB）に固定。旧候補7eadc9cとその画像は比較用に保持。背面診断はrepoのscripts/probe-soldier-switch-geometry.mjsへ --asset と --output=制作場所/switch-runtime-geometry.json を指定し、Blenderでcheck-back-body-runtime.pyを実行する。中間の大きな座標JSONは再生成物で保存対象外。Blender直接読込の試行では補助球が混ざったため、最終報告はThree.jsの実メッシュ2個だけを測るback-body-runtime-check.jsonを正とする。

全動作の通し自然さ、実プレイ、独立監査・公開は残件。公開pushと実ゲームの進行開始は以前の承認待ちを維持。再実行・迂回なし。モデルID・推論設定未確認。
