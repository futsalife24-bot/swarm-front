# 2026-11-07 採用候補（隔離検証、未公開）

`*-textured-20261107.glb` は本人採用済みのbalanced候補。既存4GLBを保持し、参照表だけを候補へ切り替えた。正式制作ZIP SHA256 `102b294628ceb6d547e83a317611f24f729ec28c62e5859be3ff6746ed66e1c5` と一致する成果物から取り出した。骨・動作・逆バインド一致を確認。モデルの能力・保存・通信は変更しない。

[今回の組込み検証](../../../docs/evidence/buddy-brushup-adoption-20261107/README.md)。以下は旧版の来歴として保持。

# バディの採用GLB

2026-11-05の本人指定による採用版だけを配置する。素材の色・形・骨・動作は変更していない。ゲーム内は等倍で、素材の前方+Zを進撃の前方へ回す。浮遊高はGLBの動作に含まれるため追加の上下揺れを重ねない。

| 個体 | 素材フォルダ | 配信用 | 外観動作 |
| --- | --- | --- | --- |
| タタラ | tatara-lowpoly-v3 | tatara-v3.glb | Idle / Follow / Palm |
| ヨスガ | yosuga-lowpoly-v5 | yosuga-v5.glb | Idle / Follow / Display |
| トバリ | tobari-lowpoly-v7 | tobari-v7.glb | Idle / Follow / Display |
| オリハ | oriha-lowpoly-v3 | oriha-v3.glb | Idle / Follow / Display / Coil |

原本・README・再生成スクリプト・比較・素材検証は [素材担当commit](https://github.com/futsalife24-bot/swarm-front/tree/b5260244f246133a8e920deb7c4057f92a675f62/assets/buddy) を参照。既存素材ブランチを保持し、旧版・編集用blend・動画・独立プレビューを配信フォルダへ複製しない。ツギホは未制作。

同行上限は2026-11-05の本人相談で1人1体に確定。属性・能力・入手方法・選択方法は未決。色や外観動作から推測しない。モデルと属性エフェクトは別管理とし、今回のGLBにはゲーム上の属性処理を接続していない。

コピー元と同一であること、容量とSHAは [統合の照合記録](../../../docs/evidence/buddy-integration-20261105/assets.json) を参照。実ゲームの状態・制約は [統合記録](../../../docs/evidence/buddy-integration-20261105/README.md) が正本。
