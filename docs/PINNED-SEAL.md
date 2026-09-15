# 2026-09-14 固定装備行の枠・隙間修正

同じ一時試遊URLに反映済み。固定Workerは未変更。

実装変更はsrc/client/gear-weapon-list.cssのみ。性能見出しの下余白4pxを0、固定行のtopを24→20pxとし、隣接させた。見出しの透明な境界も不透明化。固定行の下余白を0とし、上に重ねて描く金色2pxの四辺枠で、名前や装備番号の背景に枠線が隠れないようにした。行高30pxと列幅は維持。

検証: 製品ビルド成功（既存チャンク容量警告あり）。必須check-gear-ui-baseline.mjsで4寸法×通常/整理8条件成功。check-pinned-seal.mjsで1280/844/640px×5スクロール位置の見出しと固定行の隙間0px・接続箇所が固定要素に覆われること・2px枠・行高30px・装備枠切替を確認。画面PNGを目視確認。公開10ファイルと最終distのSHA256一致。実スマホ受入未確認。

branch codex/home-armory、base/head 4186f25f7c9695f95ea897ad182db5f85fac3091、未コミット。既存差分を保持。証拠: dist-validation/pinned-seal/のbefore、changes.patch、seal.json、layout.json、delivery.json、scroll-*.png。
