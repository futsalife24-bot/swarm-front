# 基地の共通入口の公開（2026-11-04、Claude Code）

生存タイトルの「基地」から育成・武器・アクセサリへ進めない問題の修正を公開した。生存カードは基地の1項目になった。[実装と検証](README.md)。

## main反映

- [PR #267](https://github.com/futsalife24-bot/swarm-front/pull/267) を通常mergeした。
  - merge commit：`1711cb360ca14b9471b244801e9ce094a66800cc`
  - head：`64af881b4191ee6efd9ddcb545a420a123a1430b`
  - merge時刻：2026-11-04 00:13 UTC
- merge前の確認：mainにはブランチ保護・ルールセット・CIワークフローがなく、必須チェックはない（`statusCheckRollup` は空）。前回のPR #265も同じ条件。保護のバイパスはしていない。
- merge後のmainで `npm run build:production` と `npx wrangler deploy --dry-run --config wrangler.production.jsonc` が成功した。

## 公開

- 既存の `wrangler.production.jsonc` で既存Worker `swarm-front` へ公開した。
  - 新しく送ったファイル：11（既存384）
  - 公開URL：https://swarm-front.melosalife-24.workers.dev
- Version `2e078d97-d9c4-4506-b697-4ffd9c201674` が100%配信（`wrangler deployments status`）。
- `/api/health`：HTTP 200、`{"ok":true,"transport":"websocket","authority":"durable-object"}`。
- 公開用build（dist）のHTML・JS・CSS・JSON、計51ファイルを配信URLから取得し、SHA-256がすべて一致した。
- 新規費用・契約変更・新規公開先はない。今回、契約・使用量の画面は閲覧していない。

## 公開版の実画面

`scripts/check-shared-base.mjs` を公開URLに向けて実行した（`ORIGIN=https://swarm-front.melosalife-24.workers.dev`）。

- 実行環境：Playwrightで毎回新しい隔離ブラウザー状態を作り、Service Workerは止めた。利用者の保存データは使っていない。
- 結果：844×390・640×360で34項目すべてOK、ページ例外0（`production/report.txt` と画面）。
- 確認した内容：
  - 生存タイトル→基地（新規保存の確認を経由）
  - 育成・武器・アクセサリの往復と、工房が無効のままであること
  - 生存カードの往復
  - 進撃タイトルの基地
  - 生存準備→生存カード→準備
  - 協力接続情報が保存されていても `?base=1` で基地が開くこと
  - はみ出し・重なりがないこと
- 実スマホ、利用者本人の保存データでの表示は未確認。

## 残課題

- 実スマホでの確認。
- 生存モード本体の改修（専用武器1種類とカードによるビルド）は、この修正とは別の後続作業。数値・カード構成・難易度・解放条件・報酬は未確定。
- Codex側のブラウザーツールが `Local browser use is disabled in Work settings` を返す問題は未解決。[切り分け](README.md#codex側のブラウザー無効の切り分け2026-11-04claude-code)。

担当：Claude Code（Claude Opus 5.5）。推論設定は未確認。子エージェントは使っていない。
