# トバリ試作07：菱形と前への回り込み

2026-11-04。本人の「裾の長さが一緒、平行四辺形より♢。外套の向きが真横」に対応。

[前後比較](review/cape-comparison.png) ／ [12秒動画](review/tobari-motion.mp4) ／ [確認資料](review.html) ／ [blend](tobari.blend) ／ [GLB](tobari.glb)

## 変更

前二枚をそれぞれ上下に尖った菱形の平面へ作り直した。下辺を水平にせず、側方の角（地上0.525m）から下の先端（0.22m）へ斜めに落ちる。
横軸を左右だけでなく前後へ約40.4度傾け、外側から前へ回り込ませた。上端Y=-0.07m、下端Y=-0.14mで、裾側が前に出る。厚さはY方向4mm。短い前襟と後方の襞は継承。
前二枚は各4頂点の輪郭へ整理し、平面を細分していた不要な面を削減した。

## 実測・検証

1,180三角形（前版1,428から248減）・1材質・1メッシュ・7骨・テクスチャ0枚。不透明・頂点色。
GLB 221,420 bytes、blend 208,572 bytes。幅0.47m、高さ0.6924m。

GLB別途読込みで境界差0m、色・材質・骨・3動作を確認。3フレーム間隔の最低点は地上0.1925m以上。[再読込み](review/roundtrip.json)
正面・側面・背面・斜め、兵士比較、844×390／640×360の0／1／4体を独立Chromeプレビューで確認。[描画検証](review/validation.json)
追加描画は1体あたり影なし1回、影あり2回。4体は協力4人各1体の仮定。
12秒・30fps・960×640の動画を更新。実再生と小画面の動作選択・停止・再開を確認。[操作検証](review/ui-validation.json)

実スマホ・実戦・敵密集・属性エフェクト込みの負荷と識別は未確認。CPU描画送信時間はGPU完了時間ではない。本人の外観採否は未確認。属性・能力は未決定。

再現は[初版の手順](../tobari-lowpoly-v1/README.md)のフォルダ名を tobari-lowpoly-v7 に置換。比較には試作06の画像も必要。

## 担当記録・共有ノートへの追記案

前二枚を菱形の平面へ変更し、胴体の前へ回り込む向きを修正。画像・動画・GLB照合・描画・操作確認済み。共有STATEとMainVaultは直接変更せず本節を追記案とする。

GitHub: https://github.com/futsalife24-bot/swarm-front
専用ブランチ: codex/buddy-tatara-lowpoly-20261104
開始HEAD: 66fa31cfb38800304fe947dee007937e4c54c69b
対象: assets/buddy/tobari-lowpoly-v7/ のみ。
作業場所: C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-buddy-lowpoly
前版・他個体・ゲーム・main・公開環境は変更なし。
実モデルID・推論設定は取得不可／未確認。子エージェント・独立監査なし。
