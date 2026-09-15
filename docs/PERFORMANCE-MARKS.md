# 2026-09-14 性能補正マークの統一

同じ一時試遊URLに反映済み、固定Workerは未変更。

- −10〜−1%: 青▼1個。既存の補正下限−10%は維持。
- 0%: マークなし。
- +1〜10%: 黄▲1個。
- +11〜19%: 橙▲を縦2段。
- +20%: 朱色★1個。

白い数値と色付きマークに統一し、性能の下線は全て廃止。一覧/先頭固定/詳細/共有画像/凡例に適用。サンプルに+15%も追加し、橙の表示も試せる。数値・抽選・保存仕様は変えず、表示分類の+10%を橙から黄へ変更。

検証: 型/build成功（既存チャンク容量警告あり）。check-performance-marks.mjsで−10/−1/0/+1/+10/+11/+19/+20の境界、白字/下線なし/4色とマーク数/縦配置を確認。必須check-gear-ui-baseline.mjsの4寸法×通常整理8条件成功。詳細/共有PNG生成・目視確認。公開10ファイルと最終dist一致。実スマホ受入未確認。

branch codex/home-armory、base/head 4186f25f7c9695f95ea897ad182db5f85fac3091、未コミット。既存差分を保持。変更: src/shared/progression.ts（表示分類と記号）、src/client/playtest.css（白字/マーク色配置）、playtest-app.ts（凡例）、menu-samples.ts（+15追加）、weapon-sharing.ts（共有マーク）、検証1本。証拠はdist-validation/performance-marks/のbefore、changes.patch、marks.json、layout.json、delivery.json、各PNG。
