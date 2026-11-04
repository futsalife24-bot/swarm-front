# トバリ試作06：前二枚を平らな平行四辺形へ

2026-11-04。本人の「前2枚の外套は平行四辺形かも、平面にして作り直してみて」に対応。

[前後比較](review/cape-comparison.png) ／ [元絵比較](review/comparison.png) ／ [12秒動画](review/tobari-motion.mp4) ／ [確認資料](review.html) ／ [blend](tobari.blend) ／ [GLB](tobari.glb)

## 変更

前側の長い外套2枚を、それぞれ一つの平面上にある平行四辺形へ変更。両対辺が平行で、途中の膨らみ・横方向の折れを除いた。上辺と下辺を同じベクトルとし、各列を同じ移動ベクトルで裾まで伸ばしている。表裏はY方向4mm間隔。面全体の傾きだけで胴体の前を覆う。
前襟・後方の襞・顔・配色・3動作は前版を継承。白線を変更後の面へ合わせた。面上の色差は頂点色であり、凹凸ではない。

## 実測・確認

1,428三角形・1材質・1メッシュ・7骨・テクスチャ0枚。不透明・頂点色。
GLB 253,624 bytes、blend 213,760 bytes。幅0.43m、高さ0.6924m。基本形の最下端0.22m。

GLB別途読込みで境界差0m、色・材質・骨・3動作を確認。3フレーム間隔の最低点は地上0.1921m以上。[再読込み](review/roundtrip.json)
正面・側面・背面・斜め、兵士比較、844×390／640×360、0／1／4体を独立Chromeプレビューで確認。[描画検証](review/validation.json)
追加描画は1体あたり影なし1回、影あり2回。4体は協力4人各1体の仮定。形状数・骨数・材質数は増加なし。
12秒・30fps・960×640の動画を更新し、実再生と小画面の動作選択・停止・再開を確認。[操作検証](review/ui-validation.json)

実スマホ・実戦・密集・属性エフェクト込みの負荷と識別は未確認。CPU描画送信時間はGPU完了時間ではない。本人の外観採否は未確認。属性・能力は未決定。

再現は[初版の手順](../tobari-lowpoly-v1/README.md)のフォルダ名を tobari-lowpoly-v6 に置換。比較には試作05の画像も必要。

## 担当記録・共有ノートへの追記案

トバリ前二枚の外套を平面の平行四辺形へ再制作。画像・動画・GLB照合・描画・操作確認済み。共有STATEとMainVaultは直接変更せず、本節を追記案とする。
試作05は本人の追加修正到着前に専用ブランチへ保存済み。今回の納品対象は試作06。

GitHub: https://github.com/futsalife24-bot/swarm-front
専用ブランチ: codex/buddy-tatara-lowpoly-20261104
開始HEAD: c738819ba6b2f2b6f4494ce54f7dfcfc820338fa
対象: assets/buddy/tobari-lowpoly-v6/ のみ。
作業場所: C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-buddy-lowpoly
前版・他個体・ゲーム・main・公開環境は変更なし。
実モデルID・推論設定は取得不可／未確認。子エージェント・独立監査なし。
