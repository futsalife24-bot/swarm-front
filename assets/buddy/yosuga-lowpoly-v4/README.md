# ヨスガ試作04：眼球の突出を解消

2026-11-04。本人の「眼球がはみ出てるのやめて」に対応。頭に実際の眼窩を切り込み、虹彩・瞳孔・反射を顔面より内側へ配置。前版の外側へ盛り上げたまぶたを取り除き、開口の上縁で虹彩上部を隠す。鳥類を意識した眼差しを維持した。

[目元の比較](review/eye-comparison.png) ／ [確認資料](review.html) ／ [12秒動画](review/yosuga-motion.mp4) ／ [編集用blend](yosuga.blend) ／ [GLB](yosuga.glb)

## 実測と検証

- 1,464三角形、1材質、1メッシュ、13骨、テクスチャ0枚。不透明・頂点色。GLB 310,756 bytes、blend 240,227 bytes。
- 目関連132頂点について元の顔面との位置差を測定。すべて内側9〜28mm。[位置検証](eye-inset-check.json)
- GLB別途読込みで境界差0m、材質・色・骨・Idle／Follow／Displayを照合。[再読込み](review/roundtrip.json)
- 正面・側面・背面・斜め、兵士比較、844×390と640×360、0／1／4体を独立Chromeプレビューで確認。[描画検証](review/validation.json)
- 追加描画は1体あたり影なし1回、影あり2回。今回の全シーンは0／1／4体で影なし4／5／8回、影あり6／8／14回。4体は協力4人各1体の仮定。
- 12秒・30fpsの動画を作成。資料ページでの実再生と640×360での動作選択・停止・再開を確認。[操作検証](review/ui-validation.json)
- 台形頭の外形、胴、尾、脚、配色、3動作を継承。タタラの承認済み配色は変更していない。

実スマホ・実戦・密集時・通信・属性エフェクト込みの性能は未確認。CPU送信時間はGPU完了時間ではない。通常距離で目の詳細は小さく、頭・尾・体型が主な識別要素。見た目の本人採否は未確認。属性・能力は未割当。

再現手順は[初版の記録](../yosuga-lowpoly-v1/README.md)のフォルダ名を yosuga-lowpoly-v4 に置換。build.py → roundtrip.py → check.mjs → video.mjs → ffmpeg → sheets.py → check-ui.mjs。前版を保存して本フォルダへ新規納品。

## 担当記録と共有ノートへの追記案

本人修正：目が顔面からはみ出る表現を解消する。
実施：眼窩を頭に切り込み、すべての眼部を顔面より内側へ収めた試作04を制作。画像・動画・GLB再読込み・描画・操作確認済み。
共有STATEとMainVaultには直接記入せず、この節を追記案とする。ゲーム処理・main・公開環境は変更なし。

GitHub: https://github.com/futsalife24-bot/swarm-front
ブランチ: codex/buddy-tatara-lowpoly-20261104
開始HEAD: 455059d97b2f388667eb20d155e09457407f0313
対象: assets/buddy/yosuga-lowpoly-v4/ のみ。
作業場所: C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-buddy-lowpoly
実モデルID・推論設定は取得不可／未確認。子エージェント・独立監査なし。

素材・検証commit a0248b5 を2026-11-04に専用ブランチへpush済み。後続は納品記録と末尾空行の整理。
