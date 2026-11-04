# トバリ試作05：付け根から裾を直線に

2026-11-04。本人の「根元から裾に向かっては膨らまず、シュッと真っ直ぐ。サイドから前面は少しなら曲がってよい」に対応。

[前後比較](review/cape-comparison.png) ／ [12秒動画](review/tobari-motion.mp4) ／ [確認資料](review.html) ／ [blend](tobari.blend) ／ [GLB](tobari.glb)

## 変更

外套の各縦列を付け根と裾の直線補間へ変更。中腹で幅・奥行きが膨らむ形をなくした。横断面の側面から前面への折れは残す。長い前面二枚の丈、側面ほど高い斜めの裾は維持。
後ろの襞も縦列を直線化。短い前襟も膨らみのない薄い三角面に変更した。前面と前襟は表裏のY間隔4mm。顔・配色・3動作・骨数を継承。

## 実測と確認

1,428三角形・1材質・1メッシュ・7骨・テクスチャ0枚。不透明・頂点色。
GLB 265,916 bytes、blend 213,786 bytes。幅0.37m、体高0.7024m。

GLB別途読込みで境界差0m、色・材質・骨・3動作を確認。3フレーム間隔の最低点は地上0.1840m以上。[再読込み](review/roundtrip.json)
正面・側面・背面・斜め、兵士比較、844×390／640×360、0／1／4体を独立Chromeプレビューで確認。[描画検証](review/validation.json)
追加描画は1体あたり影なし1回、影あり2回。4体は協力4人各1体の仮定。形状数・骨数・材質数は増加なし。
12秒・30fps・960×640の動画を更新。実再生、小画面の動作選択・停止・再開を確認。[操作検証](review/ui-validation.json)

実スマホ・実戦・密集・属性エフェクト込みの性能と識別は未確認。CPU送信時間はGPU完了時間ではない。見た目の本人採否は未確認。属性・能力は未決定。

再現は[初版の手順](../tobari-lowpoly-v1/README.md)のフォルダ名を tobari-lowpoly-v5 に置換。比較には試作04の画像も必要。

## 担当記録・共有ノートへの追記案

トバリの外套を付け根から裾へ直線的に落ちる形へ修正。横方向の回り込みと前長・側面短の裾を維持。画像・動画・GLB照合・描画・操作確認済み。共有STATEとMainVaultは直接編集せず本節を追記案とする。

GitHub: https://github.com/futsalife24-bot/swarm-front
専用ブランチ: codex/buddy-tatara-lowpoly-20261104
開始HEAD: 6581811bf13374e2f505db04ec70485ed56fad9a
対象: assets/buddy/tobari-lowpoly-v5/ のみ。
作業場所: C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-buddy-lowpoly
前版・他個体・ゲーム・main・公開環境は変更なし。
実モデルID・推論設定は取得不可／未確認。子エージェント・独立監査なし。
