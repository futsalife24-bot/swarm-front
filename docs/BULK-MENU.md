# 一括操作パネル保持（2026-09-16）

base: d5fbc9f1f1da5f70b9919a3cdd5072b9c64861ba
branch: codex/keep-bulk-menu-open

bindListの再描画前後でdetails.open、レア度、当たり補正チェックを保持。出撃準備と武器庫の共通処理。手動開閉・整理終了・画面移動は既存のまま。

検証: npm run typecheck、npm run build、scripts/check-gear-ui-baseline.mjs（1280/915/844/640幅、通常/整理、pageerrorなし）成功。iabでSR以下・当たり補正あり→一括選択2回後 open=true/grade=2/include=true/selected=1。装備中2丁は未選択。解体確認のキャンセル後も保持、手動閉じるopen=falseを確認し画面目視。iabでの解体確定は保存データ削除に対する自動承認レビュー拒否により未実施。既存baselineは専用合成fixtureの解体検証を含み成功。実スマホ未確認。

変更はsrc/client/playtest-app.tsのredrawのみ。保存形式・選択条件・解体ロジック・CSS変更なし。
