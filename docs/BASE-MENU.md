# 基地メニュー（2026-09-16）

base: 32b1d1985be51d963f89b069dca55db882652c74
branch: codex/base-menu

タイトルの「武器庫」を「基地」へ変更。既存テーマの2×2カードで「武器」「アクセサリ」「育成」「工房」の4導線を表示。武器は既存武器種選択と一覧、アクセサリと育成は既存機能に接続。工房はdisabled・グレー表示で「工事中」「武器のグレードアップ施設を準備中」を常時表示。タイトルの育成単独導線を基地へ統合し、共通ヘッダーは出撃準備/基地/タイトル/設定へ整理。保存形式・強化処理・戦闘処理は変更なし。

検証: typecheck、通常build成功。scripts/check-base-menu.mjsで配布版1280×582/844×390/667×375の初期進行作成→基地、4カード、工房disabled、武器種→一覧、アクセサリ/育成の初回案内→各画面→基地、出撃準備→基地、タイトル→再入場を確認。4カードは画面内、スクロール0、横溢れなし、pageerror 0。667基地・844タイトル画像を目視確認。scripts/check-gear-ui-baseline.mjsは配布版4幅の通常/整理/解体/お気に入り/フィルタ検証成功。証拠dist-validation/base-menu/とdist-validation/gear-pinned/built*。実スマホ未確認。

独立監査・main反映・公開は準備中。

## 独立監査

[PR #24](https://github.com/futsalife24-bot/swarm-front/pull/24)、[監査Chat](https://chatgpt.com/c/6aaa5646-3e10-83ee-8069-885a3822a7d8)。対象 `9b7f37bf5b324240a4ab8c5d3864743904d7ae3f` は合格・必須指摘0件。ソースblob/差分一致、3幅PNG、4導線、工房disabled/工事中、保存/戦闘差分なしを独立確認。任意: 内部ID open-armoryの将来名称整理（既存CSS接続維持のため今回変更なし）。限界: 実スマホ、監査環境のbuild一式再実行は未確認。PNGはcommit前（後続は整形/自動履歴生成）。型・commit後通常/Pages build・production dry-run成功は実装担当の検証結果。公開は合格後に実行。

## 公開完了

PR #24を通常merge。公開ソース `3a35d37831160fb5ca0de64025970436c9cd8d0f` は監査対象から記録文書のみの差分。merge後mainでbuild・production dry-run成功。既存Worker https://swarm-front.melosalife-24.workers.dev へ公開、Version `9d3e7eda-3bed-4edd-87ef-4c770f156a92`。

[配信照合](evidence/base-menu/published.json): HTML/sw/JS/CSS計13ファイルSHA256一致、health正常。公開iab844×390でタイトル基地、基地4カード、工房disabled/工事中、武器へ移動→基地へ復帰を確認。errorログ0。アクセサリ/育成を含む全導線は配布版ローカル3幅で検証済み。実スマホ未確認。後続は公開記録のみ。
