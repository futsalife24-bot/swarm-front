# HARROW 二脚モーション候補 v14

公開済みv13の低い基本姿勢・形状・材質・UV・ウェイト・性能を保持し、離陸4種とFlightの羽ばたきを上下ストロークへ変更した候補。v13の翼はSpin由来の基準回転の後でrest局所Xを回していたため、実際の翼外端が前後にも大きく動いた。v14はポーズ済み肩骨の向きから胴の前後軸（Blender armature X）を肩の局所軸へ変換し、左翼と右翼を逆符号で回す。胴体の寝た姿勢、左右の異なる周期と離陸4種の遅れ、各クリップの始終点を維持する。

## 依存と再生成

- Blender 5.2.1 LTS: `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`
- 形状原本: `../charakuru-20261011/harrow.blend` と `rig-metadata.json`
- Spin実姿勢の参照: `../biped-v12/animation_contract.py`。v14の`animation_contract.py`が読み込むため、再生成時にも必要。
- 比較原本: `../biped-v13/harrow.glb`。

リポジトリルートで実行する。

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python assets/blender/candidates/harrow/biped-v14/review/probe_flap_axes.py
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python assets/blender/candidates/harrow/biped-v14/review/check_source_flap.py
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python assets/blender/candidates/harrow/biped-v14/review/check_source_boundaries.py
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python assets/blender/candidates/harrow/biped-v14/review/check_source_gait.py
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python assets/blender/candidates/harrow/biped-v14/build_motion.py
node assets/blender/candidates/harrow/biped-v14/verify_asset.mjs
node assets/blender/candidates/harrow/biped-v14/review/check-flap-trajectory.mjs
node assets/blender/candidates/harrow/biped-v14/review/check-unchanged-clips.mjs
node assets/blender/candidates/harrow/biped-v14/review/check-gait-boundaries.mjs
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --disable-autoexec assets/blender/candidates/harrow/biped-v14/harrow.blend --python-exit-code 1 --python assets/blender/candidates/harrow/biped-v14/review/inspect_blend.py -- assets/blender/candidates/harrow/biped-v14/review/blend-inspection.json
```

## 実物と検証

- GLB SHA-256: `0385b7c0198d47125a0779544726787c6076bc7213bd61382221eb0c6592d5ae`
- blend SHA-256: `3099f2024dcae0cb2154fef6a6771e75a52eb4040974f78f7ba82d05b1ff362b`
- `verify_asset.mjs`: 39骨・18クリップ・長さ・有限値・Root固定・選定姿勢の床条件に合格。元形状の頂点/法線/UV/ウェイト/索引は完全一致。`review/asset-verification.json`。
- 保存blendの再読込: 39骨、22書出しプリミティブ、全メッシュスキン、18動作、画像内包の5項目に合格。`review/blend-inspection.json`。
- v13/v14の実GLBクリップ軌道を比較すると、変更はTakeoff、TakeoffB、TakeoffC、TakeoffD、Flightの5本のみ。他13本は全トラックの時刻・値がバイト単位で同一。AirThreatの3.5秒発射姿勢も不変。`review/clip-comparison.json`。
- 焼付前の全39骨matrixを12境界で照合し、最大要素差`1.907e-6`（閾値`1e-5`）。実GLBの離陸4種→Flight境界は最大約`0.000001m`。歩行接地ドリフト最大`0.10833m`でv13と同水準。焼付前の剛体爪検査も`0.000169m`で維持。`review/source-boundaries.json`、`review/source-gait.json`、`review/gait-boundaries.json`。
- 実GLBの翼外端と最外翼爪を、地面に垂直なY軸と水平X/Z軸に分けて計測。離陸4種・Flightの左右、計20組の下向き0.25秒区間で、肩相対の鉛直/水平変位比はすべて`1.47`以上。Flightは`7.27`以上で、v13の同じ時間対はすべて鉛直下降/水平変位比が`1`未満または翼が上昇した。例: Takeoff左翼外端0.90→1.15秒は鉛直下降`5.30m`/水平`1.30m`、Flight左翼外端0.45→0.70秒は`2.43m`/`0.15m`。地面座標でも全20組の同区間で翼外端・翼爪が下降する。`review/flap-trajectory.json`。離陸中は胴体上昇もあるため、上下ストロークの方向判定は肩相対を正とする。

数値合格は実ゲーム画面の見た目承認や独立監査・公開の完了ではない。主担当が実ゲーム描画と攻撃器官の位置を確認する。制作担当モデル: `gpt-6-sol`、推論設定: `medium`。
