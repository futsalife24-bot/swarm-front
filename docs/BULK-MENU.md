# 一括操作パネル保持（2026-09-16）

base: d5fbc9f1f1da5f70b9919a3cdd5072b9c64861ba
branch: codex/keep-bulk-menu-open

bindListの再描画前後でdetails.open、レア度、当たり補正チェックを保持。出撃準備と武器庫の共通処理。手動開閉・整理終了・画面移動は既存のまま。

検証: npm run typecheck、npm run build、scripts/check-gear-ui-baseline.mjs（1280/915/844/640幅、通常/整理、pageerrorなし）成功。iabでSR以下・当たり補正あり→一括選択2回後 open=true/grade=2/include=true/selected=1。装備中2丁は未選択。解体確認のキャンセル後も保持、手動閉じるopen=falseを確認し画面目視。iabでの解体確定は保存データ削除に対する自動承認レビュー拒否により未実施。既存baselineは専用合成fixtureの解体検証を含み成功。実スマホ未確認。

変更はsrc/client/playtest-app.tsのredrawのみ。保存形式・選択条件・解体ロジック・CSS変更なし。

## 監査・公開

[PR #22](https://github.com/futsalife24-bot/swarm-front/pull/22)、[独立監査](https://chatgpt.com/c/6aaa452e-3750-83ee-9c90-80b010325494): 対象 `7e2e5a72a0a20d39ef9df48987aaefa3f6946a4c` 合格・必須指摘0件。GitHub/添付blob一致、復元と保護条件を確認。任意提案は専用の再発検知assert追加。監査側はPages build再実行・実スマホ未確認。

武器庫iabでも一括選択後open/include=trueを確認。commit後Pages build、production Worker dry-run成功（初回sandbox権限制限後に通常権限で成功）。

通常merge後の公開ソース `4c7ecf9429d6ce72225677f9a2cf8ff6ec171aea`、監査対象とのtree差分なし。mainからproduction buildして既存Workerへ公開。Version `d2d84eaa-7445-4f73-8f15-bd083134bce9`。

公開14ファイルSHA256一致・health成功。公開iabで一括選択2回後open/include=true・selected=1、手動closeでopen=false、取得errorログ0件。公開先 https://swarm-front.melosalife-24.workers.dev 。[配信証拠](evidence/bulk-menu/published.json)。追加の解体確定検証は自動承認レビュー拒否に従い未実施。ユーザーの武器削除を伴う検証は再開しない。実スマホ未確認。
