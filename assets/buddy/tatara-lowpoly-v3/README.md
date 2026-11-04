# タタラ試作03：紫の彩度調整

2026-11-04。本人が試作02の造形と動きを「このくらいが良い」と評価し、紫だけもう少し落ち着かせるよう依頼。本版は紫の頂点色を落ち着いた薄紫へ変更した。黄色・掌の向き・動作は維持。

[色の比較](review/revision-comparison.png) ／ [確認資料](review.html) ／ [12秒動画](review/tatara-motion.mp4) ／ [blend](tatara.blend) ／ [GLB](tatara.glb)

- 紫の基準色（linear RGB）を `(0.25,0.018,0.57)` → `(0.14,0.075,0.255)` に変更。
- 1,924三角形・1材質・11骨・テクスチャ0。GLB 394,576 bytes、blend 291,030 bytes、動画727,848 bytes。
- [GLBの照合](review/color-only-check.json)：位置・法線・頂点順・ウェイト・骨・アニメーションは試作02と一致。色と、テクスチャに使用していないUVだけが再生成時に変化した。テクスチャ自体は0枚。
- [往復検証](review/roundtrip.json)：形状境界差0m、3動作保持、掌は下向き→正面→下向き。押出し約22cm。3フレーム刻みの最低点約1.5cm、床下へ沈まない。
- [描画検証](review/validation.json)：Chromeで四方向・兵士比較・844×390／640×360・0／1／4体を再確認。1体の追加描画は影なし1回、今回の影あり2回。GPU完了や実スマホの実戦性能は未確認。
- [UI・動画検証](review/ui-validation.json)：640×360の選択・停止・再開・横はみ出しなし、12秒動画の1秒以上の実再生が成功。

モデル契約・骨構成・動作・制約は [試作02の記録](../tatara-lowpoly-v2/README.md) を継承。再生成コマンドは同記録のフォルダ名を `tatara-lowpoly-v3` へ置き換える。色だけの照合は `python assets/buddy/tatara-lowpoly-v3/verify-color.py`。

本版と比較用の過去版は別フォルダで保持。属性は未割当。ゲーム本体・main・本番へ反映していない。

## 担当記録・共有ノートへの追記案

本人決定：試作02程度の造形と動きの方向性を採用。紫はもう少し落ち着かせる。調整後は次の個体へ進む。
2026-11-04の追加本人評価「タタラの色は大正解」により、試作03の配色を採用として記録。タタラの素材はこの追記で変更していない。
今回の実施：試作03へ色を調整し、次のヨスガは [yosuga-lowpoly-v1](../yosuga-lowpoly-v1/README.md) で制作した。ヨスガの外観採用はまだ未確認。

GitHub: https://github.com/futsalife24-bot/swarm-front 。ブランチ `codex/buddy-tatara-lowpoly-20261104`、開始HEAD `0d7f4831039708a78892ebb0d8908a320c8e492c`。
worktree: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-buddy-lowpoly`。共有STATEとMainVaultは直接編集せず、本節を追記案とする。
実モデルID・推論設定は取得不可／未確認。子エージェント・独立監査なし。

素材・検証commit `708801c` を2026-11-04に既存originの専用ブランチへpush済み。後続の追記は納品記録のみ。
