# ドット調着弾：main反映と公開前確認

## 2026-11-02 19:21 JST 公開再開依頼

本人は「公開」と明示し、既存Workerへの操作を承認。無料プランであるという事実の回答ではないため、既存の無料プラン確認条件は維持する。GitHub mainは記録反映後 `9a517832aafdecc78cf5403e3fa480df4263febf`、製品ソース `9e11e8c` との差は文書2件だけ。事前build / dry-runは保存済み。

今回のcua_replはブラウザー一覧0件、`Local browser use is disabled in Work settings` を返した。実設定・原因は未確認。既存OAuthで同じアカウントを `wrangler whoami` により確認。既存契約確認スクリプトはHTTP 401で失敗し原因未特定。その後、同APIの再試行は自動承認レビューが直前の401と同じ原因の反復を理由に拒否し、再試行・迂回はしていない。`wrangler deployments list` は既存Version `54e4881b-82d0-4091-88af-47d3ab9a957f` の100%配信を表示。新しい着弾演出は未公開。

停止理由: 現在の無料プランを確認できない。再開条件: 本人が現在も無料と確認する、または対象ブラウザーの復旧後に管理画面で無料プランを確認する。その後、最新main・使用量・build成果物を確認し、既存Workerへ公開・配信照合する。

本人が比較動画を確認し「まぁありかな。とりあえず何もないよりは実装してみて」と仮採用。通常命中の着弾1種類を[PR #256](https://github.com/futsalife24-bot/swarm-front/pull/256) で通常mergeした。mainの製品ソース `9e11e8c84fd4f406ce1fa47ebcf590fc87a4d6a4` と検証したPR head `420411a624e1f9995d0db8a2ec5931ecc97872dc` はツリー差分なし。

着弾・既存演出の単体4件、型、通常build、HOUNDの比較、壁での遮蔽1条件、ソロ生存戦で通常入力の命中4件と着弾オブジェクト存在2回を確認。実機・全距離・全遮蔽物・GPU負荷は未確認。詳しくは[比較記録](README.md)。

merge後の独立worktree `task-pixel-impact-release` で `npm run build:production` と `npm run server:build:production` が成功。existing Workerのproduction設定を使用し、deployはしていない。関連PRのGitHubチェック0件はCI合格ではない。

2026-11-02 18:10 JST、cua_replはブラウザー一覧0件、`Local browser use is disabled in Work settings` と返した。実際の設定・根因は未確認。既存OAuthでアカウントを照合し、読み取り専用APIで当日UTC 00:00〜09:17の全Workers 111 requests・errors 0・subrequests 112を確認。集計遅延があり得る。契約プランを示す情報ではない。以前subscriptions APIが403だったため別経路で権限拒否を回避しない。本人へ現在も無料か確認を依頼中。

停止理由: 公開前に必要な現在の無料プランが確認できず、Workerの公開・配信確認は未実施。再開条件: 本人の現在も無料という確認、または対象ブラウザーの復旧後に同じアカウントの管理画面で無料プランを確認する。再開時にmainと使用量を再照合してから、既存Workerの公開と配信・health確認を行う。新規費用、契約・権限・ブラウザー設定の変更はしない。
