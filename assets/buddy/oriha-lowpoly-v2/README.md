# オリハ試作02：とぐろ動作の追加

2026-11-04。本人の「トグロを巻く様な動きもほしい。一応ライモンのシンリュウ種をモチーフ」に対応。本人のモチーフ指定を動きの方向性として反映し、既存コンセプトアートの造形は維持。

[とぐろの連続画像](review/coil-sheet.png) ／ [上から見た巻き姿](review/coil-top.png) ／ [16秒動画](review/oriha-motion.mp4) ／ [確認資料](review.html) ／ [blend](oriha.blend) ／ [GLB](oriha.glb)

## 追加

Coilクリップを追加。頭を起こし、頭側から順に後ろの節を巻き込み、輪を作ってからほどけて戻る約4秒の動作。節長は一定に保ち、骨の回転と位置で表現。待機Idle・追従Follow・伸長Displayの3動作も残した。
プレビューへ「とぐろを巻く」と「上から」を追加。動画は4動作各4秒、最後のとぐろは上視点で撮影。

## 実測・検証

形状は初版を継承：2,008三角形・1材質・1メッシュ・10骨・テクスチャ0枚。不透明・頂点色。
GLB 377,112 bytes、blend 378,473 bytes。クリップ数3→4。

GLB別途読込みで境界差0m、色・階層・骨・4動作を確認。3フレーム間隔の最低点は地上0.3181m以上。[再読込み](review/roundtrip.json)
正面・側面・背面・斜め、Coilの上視点・側面、兵士比較、844×390／640×360の0／1／4体を独立Chromeプレビューで確認。[描画検証](review/validation.json)
追加描画は1体あたり影なし1回、影あり2回。4体は協力4人各1体の仮定。描画性能測定は従来と同じFollow条件。
16秒・30fps・960×640の動画を作成。動画実再生、Coil選択、小画面の停止・再開を確認。[操作検証](review/ui-validation.json)

実スマホ・実戦・密集・通信・エフェクト込みの性能は未確認。自己接触を物理計算する布・軟体シミュレーションは使っていない。本人の動作採否は未確認。属性・能力は未決定。

再現は[初版の手順](../oriha-lowpoly-v1/README.md)のフォルダ名を oriha-lowpoly-v2 に置換。video.mjsは480フレーム／16秒を出力。

## 担当記録・共有ノートへの追記案

本人のシンリュウ種モチーフととぐろ動作の指定を受け、Coilを追加した試作02を納品。既存3動作と形状は維持。画像・動画・GLB照合・描画・操作確認済み。共有STATEとMainVaultは直接変更せず本節を追記案とする。

GitHub: https://github.com/futsalife24-bot/swarm-front
専用ブランチ: codex/buddy-tatara-lowpoly-20261104
開始HEAD: 97ccbc2b2995a6b7cb2b3a736ccc7bfd844baf5e
対象: assets/buddy/oriha-lowpoly-v2/ のみ。
作業場所: C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-buddy-lowpoly
既存個体・ゲーム・main・公開環境は無変更。
実モデルID・推論設定は取得不可／未確認。子エージェント・独立監査なし。
