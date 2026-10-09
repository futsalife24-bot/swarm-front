# 参照画像から制作した兵士のモーション修正

## 現在地（2026-10-09）

制作途中。ローカルのStandardTrooper描画に4人・32動作・4色を接続済み。歩行距離と足の位相、装填時の支持手、回避時の両手保持を修正した。公開ゲームは未変更。旧モーションはユーザー不承認であり、構造検査や静止画だけで自然さの合格とは扱わない。

確認済みのローカルGLB: `25e20aa113cec9e16879014cc8003f5f58e98054110e179de41419837163b66d`。転倒時は背負い装備の厚みに合わせて胴体を支え、かかとを地面へ落ち着かせる。回避は銃を胸元に保持し、背面接続点を固定したまま武器の向きを変えて床を避ける。回避の全身持ち上げ案は見た目が不自然なため不採用。体と武器の接地・32動作の秒数・構造検査を通過した。実ゲームでの自然さの最終確認は未完了。

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

制作フォルダーでBlenderのバックグラウンド実行により、`retarget-ual.py` → `retarget-combat.py` → `polish-motion.py` → `refine-ground.py` → `arm-roll.py` → `ground-equipped.py -- --down-only` → `animate-sling.py` → `refine-rocket-reload.py` の順に実行する。現行版は次の入力を明示して書き出す。

```text
Blender --background --disable-autoexec --python export-game.py -- --source=soldier-reload-candidate.blend
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