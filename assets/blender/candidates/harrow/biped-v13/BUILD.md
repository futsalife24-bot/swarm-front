# HARROW 二脚モーション候補 v13

v12を保持し、v11由来の形状・材質・UV・ウェイトを変えずに18動作を再焼付した候補。地上Idleはv12 Spin 1.675秒の胴・首・尾・翼の角度を使い、胴体だけ立脚高へ戻す。Spin中央はv12の床接触姿勢を維持し、0秒と3秒は新Idleへつなぐ。飛行中も低い上体と横へ寝た翼を保つ。山なり弾のThreat/AirThreatは発射ピークの上体角をv12へ戻し、翼爪の左右幅を広げた。戦闘性能・発射時刻・7攻撃の契約はこの候補では変更しない。

## 依存と再生成

- Blender 5.2.1 LTS: `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`
- 形状原本: `../charakuru-20261011/harrow.blend` と `rig-metadata.json`
- Spin実姿勢の参照: `../biped-v12/animation_contract.py`。v13の`animation_contract.py`が読み込むため、再生成時にも必要。

リポジトリルートで実行する。

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python assets/blender/candidates/harrow/biped-v13/build_motion.py
node assets/blender/candidates/harrow/biped-v13/verify_asset.mjs
node assets/blender/candidates/harrow/biped-v13/review/check-gait-boundaries.mjs
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python assets/blender/candidates/harrow/biped-v13/review/check_source_boundaries.py
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --disable-autoexec assets/blender/candidates/harrow/biped-v13/harrow.blend --python-exit-code 1 --python assets/blender/candidates/harrow/biped-v13/review/inspect_blend.py -- assets/blender/candidates/harrow/biped-v13/review/blend-inspection.json
```

## 最終実物と検証

- GLB SHA-256: `772541a2735b465e2d04f8830f556f11e47ca29dee7335f8b17446a1857e0431`
- blend SHA-256: `8b79a4deadf69ff1e5b29b6927b2c6069e81b408001337ed9d1c4a9c50197890`
- `verify_asset.mjs`: 39骨・18クリップ・長さ・有限値・Root固定・選定姿勢の床条件が成功。元形状の頂点/法線/UV/ウェイト/索引は完全一致。結果は`review/asset-verification.json`。
- 保存blendの再読込: 39骨、22書出しプリミティブ、全メッシュスキン、18動作、画像内包の5項目すべて成功。結果は`review/blend-inspection.json`。
- 焼付前の全39骨matrixを9境界で照合し、最大要素差は`1.907e-6`（閾値`1e-5`）。Dive/StaggerFall終端→Land0を含む。`review/source-boundaries.json`。
- 実GLBを60Hzで評価した歩行の接地足ドリフト最大`0.10833m`。Idle↔Locomotion境界の足先差は`0.323m`、Spin/離着陸/落下の記録済み境界の最大位置差は約`0.000006m`。`review/gait-boundaries.json`。
- 発射3.5秒の実GLB翼爪10本の左右幅: Threatはv12 `13.359m`→v13 `19.175m`、AirThreatはv12 `18.979m`→v13 `23.004m`。座標は`review/asset-verification.json`。

数値検査の成功は、ゲーム画面での見た目承認や独立監査・公開の完了を意味しない。主担当が実ゲーム描画・発射原点・攻撃接続を確認する。制作担当モデル: `gpt-6-sol`、推論設定: `medium`。
