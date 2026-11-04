# ヨスガ試作05：胴体前傾・顔の向きを維持

2026-11-04。本人の承認「やって」に基づき、胴体を15度前傾させた。頭は回転させず約4.95cm前方・1.59cm下方へ移動。腰を1.2cm下げ、脚の支点と踏み替えを調整した。尾と外套は胴体の傾きに追従するため、尾先は前版より高くなる。アニメーションがない基本形にも姿勢を反映した。

[前後比較](review/posture-comparison.png) ／ [12秒動画](review/yosuga-motion.mp4) ／ [確認資料](review.html) ／ [編集用blend](yosuga.blend) ／ [ゲーム用GLB](yosuga.glb)

## 実測・確認

- 1,464三角形・1材質・1メッシュ・13骨・テクスチャ0枚。形状追加なし、不透明・頂点色。
- GLB 315,108 bytes、blend 252,015 bytes。尾込み高さ0.7749m、幅0.6m。
- 前版との頂点照合で胴体15度前傾、頭は平行移動のみを確認。3動作213フレームの頭の回転差0度。[姿勢照合](review/posture-check.json)
- GLB別途読込みで境界差0m、色・材質・骨・3動作を確認。全動作を3フレーム間隔で検査し地面への貫通なし。[再読込み](review/roundtrip.json)
- 正面・側面・背面・斜め、兵士比較、844×390／640×360の0／1／4体をChrome独立プレビューで確認。[描画検証](review/validation.json)
- 追加描画は1体あたり影なし1回、影あり2回。4体は協力4人各1体の仮定。形状数・骨数・材質数は前版と同じ。
- 待機・歩行・尾を開く動作と側面を12秒・30fpsで撮影。動画実再生、640×360の選択・停止・再開、横はみ出しなし、ページ例外なしを確認。[操作検証](review/ui-validation.json)
- 顔の向きは従来の首かしげ等を含めて維持。目のくぼみ・配色は前版を継承。タタラは変更なし。

実スマホ・実戦・密集時・通信・属性エフェクト込みの性能は未確認。CPU送信時間はGPU完了時間ではない。属性・能力は未割当。見た目の本人採否は未確認。

## 再現・引継ぎ

[初版の手順](../yosuga-lowpoly-v1/README.md)のフォルダ名を yosuga-lowpoly-v5 に変更。build.py → roundtrip.py → posture-check.py（Blender CLI）→ check.mjs → video.mjs → ffmpeg → sheets.py → check-ui.mjs。posture-check.py は比較元の試作04も必要。

共有STATE／MainVaultへの追記案：本人承認を受けヨスガの胴体を15度前傾、頭の向きを維持した試作05を制作。画像・動画・GLB再読込み・姿勢照合・描画と操作検証済み。本人の見た目判断待ち。共有文書は直接変更していない。

GitHub: https://github.com/futsalife24-bot/swarm-front
専用ブランチ: codex/buddy-tatara-lowpoly-20261104
開始HEAD: cf3260c30a3644a179eb6a4b85acacee217a44e4
変更範囲: assets/buddy/yosuga-lowpoly-v5/ のみ。
作業場所: C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-buddy-lowpoly
ゲーム本体・main・公開環境は変更なし。前版は保存。
実モデルID・推論設定は取得不可／未確認。子エージェント・独立監査なし。
