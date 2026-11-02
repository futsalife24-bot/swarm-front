# ドット調着弾：main反映と公開前確認

本人が比較動画を確認し「まぁありかな。とりあえず何もないよりは実装してみて」と仮採用。通常命中の着弾1種類を[PR #256](https://github.com/futsalife24-bot/swarm-front/pull/256) で通常mergeした。mainの製品ソース `9e11e8c84fd4f406ce1fa47ebcf590fc87a4d6a4` と検証したPR head `420411a624e1f9995d0db8a2ec5931ecc97872dc` はツリー差分なし。

着弾・既存演出の単体4件、型、通常build、HOUNDの比較、壁での遮蔽1条件、ソロ生存戦で通常入力の命中4件と着弾オブジェクト存在2回を確認。実機・全距離・全遮蔽物・GPU負荷は未確認。詳しくは[比較記録](README.md)。

merge後の独立worktree `task-pixel-impact-release` で `npm run build:production` と `npm run server:build:production` が成功。existing Workerのproduction設定を使用し、deployはしていない。関連PRのGitHubチェック0件はCI合格ではない。

2026-11-02 18:10 JST、cua_replはブラウザー一覧0件、`Local browser use is disabled in Work settings` と返した。実際の設定・根因は未確認。既存OAuthでアカウントを照合し、読み取り専用APIで当日UTC 00:00〜09:17の全Workers 111 requests・errors 0・subrequests 112を確認。集計遅延があり得る。契約プランを示す情報ではない。以前subscriptions APIが403だったため別経路で権限拒否を回避しない。本人へ現在も無料か確認を依頼中。

停止理由: 公開前に必要な現在の無料プランが確認できず、Workerの公開・配信確認は未実施。再開条件: 本人の現在も無料という確認、または対象ブラウザーの復旧後に同じアカウントの管理画面で無料プランを確認する。再開時にmainと使用量を再照合してから、既存Workerの公開と配信・health確認を行う。新規費用、契約・権限・ブラウザー設定の変更はしない。
