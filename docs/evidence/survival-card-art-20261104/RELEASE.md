# 生存カードの生成素材を公開（2026-11-04）

- 実装: [PR #275](https://github.com/futsalife24-bot/swarm-front/pull/275)。実装commit `9cd9ba589e1c32800e3f9ccdb65b7693182a4558`、検証記録を含むPR head `b9e2f311469d18dc77a6c0ebca24dcb860a4416b`。
- 公開ソース: 通常merge後のmain `ca6ef92264f28b26217130e8ddc536a4e97b521f`。このHEADから本番buildと既存Worker設定のdry-runを再実行し成功。検証済みPR headと内容差分なし。
- 公開: https://swarm-front.melosalife-24.workers.dev 。既存WorkerのVersion `acb2caab-6cc1-4ff8-bd06-b3030406ecfe` が **100%配信**。[配信割合](deployment.json)。新規サービス・依存・課金・設定変更なし。
- 照合: 全HTML/JS/CSS/JSON/Webmanifestと新カード素材10点、計 **61ファイルのSHA-256がすべて一致**。healthは200/ok。[結果](delivery.json)。未変更の画像・音声・3Dモデルは今回の配信照合対象外。
- 公開UI: 隔離した新規Chromeの844×390（通常）・640×360（動き軽減）で成功。進撃3突破/融合発見の準備だけ端末内fixtureを使い、カード画像、未発見の伏せ表示、発見済み融合、除外チェック位置、除外/解除/保存/再読込を通常UIで確認。初期一覧9/6枚、チェック位置は詳細スクロール前後で同じ。非選択融合の動き0、ページ例外0。[結果](production.json)、[基地](production-base.png)、[融合](production-fusion.png)。撮影画像も目視した。
- 型、関連単体33件、表示6条件、生存基地2サイズ、防衛基地6条件、書式・差分の確認は[実装記録](README.md)。検証用開発サーバーと隔離Chromeは終了済み。

通常の継続承認に従ってmain反映・既存Worker公開まで実施した。main保護・ruleset・Actions workflowは未設定を読み取り確認し、forceや管理者バイパスを使っていない。独立Chat監査は通常方針により自動追加していない。

今回の絵は4枚、残り30枚は既存絵。実スマホ、端末ごとの長時間負荷、公開環境の協力、変更後の実戦通しプレイは未確認。次の作業では[素材の制作手順](../../../design/survival-card-art/README.md)から追加できる。

正本: https://github.com/futsalife24-bot/swarm-front 。作業場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-survival-build`。公開記録branch: `codex/survival-card-art-release-record-20261104`。公開記録は文書/証拠のみで、追加デプロイは不要。
