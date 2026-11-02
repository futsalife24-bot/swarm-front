# ドット調着弾の公開（2026-11-02）

本人の「公開」に続く「無料」という回答を現在の無料プラン確認として、通常命中の着弾演出を既存 `swarm-front` Workerへ公開した。ゲームコードは [PR #256](https://github.com/futsalife24-bot/swarm-front/pull/256) でmainに反映済み。既存の公開先、契約と権限は変更していない。

- 製品ソース: `9e11e8c84fd4f406ce1fa47ebcf590fc87a4d6a4`
- 公開直前のmain: `c42b65af312b0ebdea9cac31e3221598cf9b1172`（製品ソースとの差分は `docs/STATE.md` と本件の公開前記録のみ）
- Worker Version: `02233456-2641-463a-80d1-983c80c669ad`（100%配信を確認）
- 公開先: https://swarm-front.melosalife-24.workers.dev/
- 使用量: 2026-11-02 UTC 00:00〜10:43の全Workers 127 requests・errors 0・subrequests 128。APIの集計遅延はあり得る。無料プランは本人確認であり、APIでの契約確認ではない。

製品ソースからproduction buildとWorker dry-run成功。既存Workerへdeployし、[delivery.json](delivery.json) の27ファイル（入口・JS・CSS・サービスワーカー等）は検証済みbuildとSHA一致、health 200/ok。ローカルのChrome生存戦では通常入力の命中4件と着弾オブジェクト存在2回、画面例外0（[記録](live-hit.json)）。実画素の視認性を保証する測定ではない。

公開後の実ブラウザーUIはcua_replがブラウザー一覧0件・`Local browser use is disabled in Work settings` のため未確認。実際の設定・根因は未確定で、別経路によるアクセス拒否の回避はしていない。本人スマホ・実機負荷・全距離/遮蔽物での見え方、本番協力・長時間は未確認。GitHubのチェック0件をCI合格とは扱わない。

公開前の契約API再試行は自動承認レビューが直前の401と同じ原因の反復を理由に拒否。今回の公開は本人による無料プラン確認を受けた通常手順であり、契約APIの再試行・権限変更・拒否の迂回はしていない。詳細は[公開前記録](publication-pending.md)。
