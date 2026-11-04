# 使い勝手5件の公開記録（2026-11-05）

- 実装: [PR #277](https://github.com/futsalife24-bot/swarm-front/pull/277) を通常merge。実装commit `b3915bf1fb114888929488b33bfc295b20003ff5`、検証記録を含むPR head `32b4a2e82bb64ae6a5e97097359886f602be7715`。
- 公開ソース: main `5050c07828a3c1c92c74ede56378bfb924e5cfe3`。PR headとの内容差分なし。このmainから本番buildと既存設定のWorker dry-runを再実行して成功。
- 公開先: https://swarm-front.melosalife-24.workers.dev 。Version `404e56be-2ce1-45fe-8c23-09e02c3fc880` は100%配信。[配信割合](deployment.json)。新規サービス・依存・課金・認証設定変更なし。
- 配信照合: HTML/JS/CSS/JSON/Webmanifest計51ファイルがbuildのSHA-256と一致。health 200/ok。[照合結果](delivery.json)。未変更の画像・音声・3DモデルはSHA照合対象外。
- 公開画面: 隔離した新規Chrome、844×390・640×360で[参加・設定・起動表示8項目](production-feedback.json)と[生存/防衛2サイズ](production-survival.json)に合格。防衛の3丁3行・装備切替、生存の専用武器/カード/実戦開始/一時停止/リタイア、保存保持まで確認。ページ例外0。
- 公開版では正常な部屋作成・正常協力入室は試していない。存在しない部屋の照会だけを実施。正常参加はローカルWorkerでの実WebSocket検証。ユーザーの実保存には触れていない。
- 本番では既存CSSがJSより先に届き、初期背景色がテーマ色へ変わる。検査の色を2つの正規暗色に合わせ、読み込み表示が画面全体を覆う条件を追加した。製品の追加変更ではなく、記録と検証器の変更だけなので再デプロイ不要。
- 検証用Vite/ローカルWorkerと隔離ブラウザーは終了済み。5186/8807の待受0を確認。root・バディ等の別作業は未編集。

[公開版の参加失敗](production-missing-room.png)、[初期表示](production-boot.png)も目視した。実装時の型・単体46件・武器一覧8条件・遅延/失敗3条件などは[変更と検証](README.md)に記録。既存の通信検査1件の失敗を全件成功に含めていない。

実スマホ、報告された約90秒の再現、読み込み速度の短縮、公開版の人間確認・正常協力プレイは未確認。実施した短い操作確認を長時間プレイや実機評価の完了とは扱わない。

通常の継続承認に従い、main保護・ruleset・Actions workflowが未設定であることを読み取り確認した。管理者バイパスやforceは使っていない。独立Chat監査は通常方針に従い自動追加しなかった。

正本は https://github.com/futsalife24-bot/swarm-front 。作業場所 `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-survival-build`。公開記録branchは `codex/usability-five-release-record-20261105`。
