# 生存カードの除外表示・公開記録（2026-11-04）

- 実装: [PR #271](https://github.com/futsalife24-bot/swarm-front/pull/271)、commit `aad2257bf67086ee88f0d5cbc5403821897bd243`。
- 公開ソース: merge後main `bf81e0866250b00726a7f2ae9aebd4d3cfe5e59a`。このHEADからproduction buildと既存Worker設定のdry-runが成功。
- 公開先: https://swarm-front.melosalife-24.workers.dev 。Version `afb484df-f22f-49c6-b401-068a4401a3f1`、配信率100%。
- 配信: dist内のHTML/JS/CSS/JSON/Webmanifest全51ファイルがSHA-256一致。health 200、ok=true。今回未変更の画像・音声・3D素材は照合対象外。[配信照合](delivery.json)。
- 公開UI: 隔離した新規Chrome、844×390（通常）・640×360（動き軽減）。新規保存の進撃2突破相当を端末内fixtureで用意し、実攻略や既存ユーザー保存とは区別。左一覧にチェックと補足行がない、右詳細で除外指定、鎖の×、閲覧タップで状態が変わらない、明示保存→再読込で復元、Spaceで解除→保存→再読込で解除維持、未獲得の操作不可、融合にチェックなし、ページ例外0を確認。[結果](production.json)。
- 最初の撮影は画像読込途中だったため、画面内の画像読込完了を待って再実行。最終画像を目視確認: [844×390](production-844.png)、[640×360](production-640.png)。輪のつながりとカード端の収まり、カード名の可読性を確認。実スマホは未確認。

mainの保護設定・ruleset・Actions workflowはいずれも未設定を読み取り確認した。管理者バイパスは使わず、通常merge。既存の継続承認と公開手順に従い、独立Chat監査は未実施。作業用開発サーバーは停止、製品保存形式・戦闘・通信・防衛デッキ編集は変更していない。

GitHub正本: https://github.com/futsalife24-bot/swarm-front 。ローカル: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-survival-build`。記録branch `codex/survival-exclusion-release-record-20261104`。本記録は文書と証拠のみのため、記録反映後の追加公開は不要。
