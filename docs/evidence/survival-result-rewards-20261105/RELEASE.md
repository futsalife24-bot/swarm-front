# 生存の獲得報酬画面：main反映と公開前の確認

2026-11-05。実装は [PR #281](https://github.com/futsalife24-bot/swarm-front/pull/281) で通常merge済み。実装commit `e0aa6b1a95e94a904be37292ff22cf6def161d8a`、merge後main `79f40795f84a33b94cc32fce697fd4b33dcf6407`。merge本文に日本語のPlayer-Noteを保持。実装commitとmerge後mainのファイル内容に差分なし。

保護/ruleset/Actions workflowは0件、PRのstatus報告も0件と読み取り確認。CI成功とは呼ばず、管理者バイパスやforceを使わない通常mergeで反映した。専用task-survival-buildだけをmain/origin/mainへfast-forwardし、HEAD一致・cleanを確認。他worktreeとrootの既存差分は保持。

## 配布物と通常操作の確認

- 実装commit後とmerge後mainの `npm run build -- --configLoader native` が成功。500KB超chunkの既存警告あり。更新履歴の生成を維持し、履歴や検証条件を省いていない。
- merge後mainのdistで `npm run server:build:production` 成功。既存のproduction設定を使うdry-runだけで、公開は行っていない。
- 同じmainの配布物をローカルpreview5197で配信し、`scripts/check-survival-result-published.mjs` を隔離Chromeの844×390/640×360へ実行。通常ソロの出撃→初回カード選択→敵の攻撃で全滅→獲得報酬→タイトルまで2サイズ合格。ページ例外0。[結果](preview-results.json)、[844](preview-defeat-844.png)、[640](preview-defeat-640.png)。
- この確認では時間・HP・敵・報酬・配信JSを変更していない。新規の隔離保存で、約20秒の終了時に武器0丁/コイン0/功績20と取得条件が出ることを確認。武器3丁や30丁、保存失敗、保留等は[実装検証](README.md)の時間短縮/表示fixtureによる条件と区別する。
- 自分が起動した5186/8807/5197は停止、待受0を確認。Claudeの確認用5193は納品書に停止済みと記録されている。他セッションのプロセスには触れていない。

## 公開は未実施

本作業では既存Workerへdeployしておらず、公開配信のSHA・health・変更後の公開UI確認は未実施。新しいWorker Versionも発行していない。main反映と公開完了を混同しない。

[無料運用ルール](../../FREE-TIER.md) の「公開時に契約とアカウント全体の既存利用を確認する必要がある」という既存条件を維持する。使用量は既存OAuthの正規GraphQL読取で、当日UTC00:00〜12:03:59の全Workers224 requests/0 errors/239 subrequestsを確認済み。[実取得](cloudflare-usage.json)。

契約読取は最初401、Wrangler標準の既存OAuth更新後は403。権限拡大や新規キー作成はしていない。ブラウザー一覧も当該実行元から取得できず、現在の契約を画面で確認したとはしていない。過去の2026-10-30の本人Free回答は今回の現在確認へ置き換えない。現在も無料プランかを本人へ質問済み、回答待ち。

停止理由: 現在の無料契約をAPI/画面で確認できず、本人の現在確認もまだないため、既存ルールの公開前条件を満たせていない。

再開条件: 本人が現在もFreeと回答する、または既存の許可済み読取経路で現在の契約確認が可能になること。新たな公開承認の取り直しは不要。

再開後は最新mainと公開対象の実差分を照合し、必要に応じてbuild/dry-runを作り直す。既存 `wrangler.production.jsonc` の `swarm-front` Workerへ通常deployし、Version/配信割合/配信ファイルSHA/healthを記録する。`ORIGIN=https://swarm-front.melosalife-24.workers.dev` で同じ通常ソロの検証器を公開版へ実行し、記録をmainへ反映する。新規費用・契約/権限変更・新しい公開先は追加しない。

正本 https://github.com/futsalife24-bot/swarm-front 。作業場所 `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-survival-build`。本記録は `codex/survival-result-release-record-20261105` の文書/証拠だけの変更で、ゲームコードを含まない。実スマホ/PWA、公開版の変更確認は未完了。主担当の実モデルID/推論設定未確認、Codex子なし、Claude UIの画面表示Opus 5.5/高。
