# 生存の獲得報酬画面：公開・配信確認

2026-11-05。実装は [PR #281](https://github.com/futsalife24-bot/swarm-front/pull/281) で通常merge済み。実装commit `e0aa6b1a95e94a904be37292ff22cf6def161d8a`、merge後main `79f40795f84a33b94cc32fce697fd4b33dcf6407`。merge本文に日本語のPlayer-Noteを保持。実装commitとmerge後mainのファイル内容に差分なし。

保護/ruleset/Actions workflowは0件、PRのstatus報告も0件と読み取り確認。CI成功とは呼ばず、管理者バイパスやforceを使わない通常mergeで反映した。専用task-survival-buildだけをmain/origin/mainへfast-forwardし、HEAD一致・cleanを確認。他worktreeとrootの既存差分は保持。

## 配布物と通常操作の確認

- 実装commit後とmerge後mainの `npm run build -- --configLoader native` が成功。500KB超chunkの既存警告あり。更新履歴の生成を維持し、履歴や検証条件を省いていない。
- merge後mainのdistで `npm run server:build:production` 成功。既存のproduction設定を使うdry-runだけで、公開は行っていない。
- 同じmainの配布物をローカルpreview5197で配信し、`scripts/check-survival-result-published.mjs` を隔離Chromeの844×390/640×360へ実行。通常ソロの出撃→初回カード選択→敵の攻撃で全滅→獲得報酬→タイトルまで2サイズ合格。ページ例外0。[結果](preview-results.json)、[844](preview-defeat-844.png)、[640](preview-defeat-640.png)。
- この確認では時間・HP・敵・報酬・配信JSを変更していない。新規の隔離保存で、約20秒の終了時に武器0丁/コイン0/功績20と取得条件が出ることを確認。武器3丁や30丁、保存失敗、保留等は[実装検証](README.md)の時間短縮/表示fixtureによる条件と区別する。
- 自分が起動した5186/8807/5197は停止、待受0を確認。Claudeの確認用5193は納品書に停止済みと記録されている。他セッションのプロセスには触れていない。

## 公開・配信確認

- 記録PR282まで反映した最新main `77db839a5ac32499c6f87025690d313d7991446c` から、本番buildと既存Worker dry-runを再実行して成功。実装のmain反映後に増えた差分は記録のみ。
- 既存 `wrangler.production.jsonc` の `swarm-front` Workerへ通常deploy。公開先 https://swarm-front.melosalife-24.workers.dev 。Version `f1b67522-f910-4ea4-b528-83e4fe474b2b`、`wrangler deployments status` で100%配信を確認（公開時刻2026-11-05 12:47:39 UTC）。新規サービス・費用・契約/権限変更なし。
- 既存の `scripts/check-buddy-delivery.mjs` を読み取り検証器として再利用。HTML/JS/CSS/JSON/Webmanifestと既存バディ素材等60ファイルが最終buildのSHA-256と一致、health200/ok、DEVレビュー/Design配布なし。[照合結果](production-delivery.json)。未変更のその他画像/音声/3Dモデルは今回のSHA照合対象外。
- `ORIGIN=https://swarm-front.melosalife-24.workers.dev` で同じ `check-survival-result-published.mjs` を公開版へ実行。844×390/640×360の通常ソロで、敵の攻撃による全滅→獲得報酬→タイトルまで成功、ページ例外0。[結果](production-results.json)、[844](production-defeat-844.png)、[640](production-defeat-640.png)。19秒/22秒の終了でコイン0・功績20・武器0丁と取得条件を確認。時間/HP/報酬/配信JSを改変していない。実ユーザーの保存にも触れていない。
- 武器3/30丁・保存再試行・再接続等は既存のローカル製品/実WS検証を維持し、公開版での全条件再実行とは呼ばない。実スマホ/PWA、公開版の実回線複数人戦闘は未確認。

## 無料プランの本人回答と確認の重複

[無料運用ルール](../../FREE-TIER.md) の契約根拠は、本人の今回の「無料プランのまま」という回答。管理画面/APIで契約を取得したとはしていない。既存OAuthでの契約読取は401→標準更新後403だったが、API取得不能を本人回答や既存公開承認の取消しとして扱わず、追加質問なしで公開した。本人の重複確認の指摘を記録し、同じ確認を取り直していない。権限拡大や新規キー作成もない。

使用量は既存OAuthの正規GraphQL読取で、当日UTC00:00〜12:03:59の全Workers224 requests/0 errors/239 subrequestsを確認済み。[実取得](cloudflare-usage.json)。契約や公開操作の承認とは分けて扱う。

公開前の停止条件は解消済み。今回の依頼に残る必須作業はない。公開記録の変更は文書・証拠だけで、再デプロイは不要。

正本 https://github.com/futsalife24-bot/swarm-front 。作業場所 `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-survival-build`。公開記録branch `codex/survival-result-published-20261105`。主担当の実モデルID/推論設定未確認、Codex子なし、Claude UIの画面表示Opus 5.5/高。
