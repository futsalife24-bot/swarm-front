# 生存属性3種の公開記録（2026-11-04）

- 実装: [PR #273](https://github.com/futsalife24-bot/swarm-front/pull/273)、commit `289e7a054b0cace2489107db34033d0ffef6ebed`。
- 公開ソース: merge後main `3a8617abb471649bf15cd9f895becc9c6de929e3`。このHEADからproduction buildと既存Worker設定でのdry-runを再実行し成功。
- 公開先: https://swarm-front.melosalife-24.workers.dev 。Worker Version `a18ed173-8c1a-427b-9325-7deef87d2c59`、配信100%。
- 配信照合: 全HTML/JS/CSS/JSON/Webmanifestと追加カードSVG3枚、計 **54ファイルすべてSHA-256一致**。healthは200、ok=true。[照合結果](delivery.json)。未変更の画像・音声・3Dモデルは今回の配信照合対象外。
- 公開UI: 隔離した新規Chromeの844×390（通常）・640×360（動き軽減）で確認。新規保存の進撃3突破相当だけを端末内fixtureで用意し、3属性の獲得済み表示、通常武器強化、画像読込、右詳細での除外→保存→再読込、Spaceで解除→保存→再読込を通常操作で確認。左一覧のチェック/補足なしと鎖も維持。ページ例外0。[結果](production.json)、[844](production-844.png)、[640](production-640.png)。画像読込完了後に撮影し目視確認した。
- 公開前の本番用プレビュー: 所持3属性と高耐久標的の準備だけローカルのテストWorker。その後は画面の通常射撃→共有戦闘→実WS→本番用描画で、炎・氷結・電撃のイベントと画面表示を2サイズで確認。最終検査は描画処理の観測ラップなし。[結果](preview-battle.json)。公開Workerでfixtureを使ったものではなく、公開環境の協力プレイを確認済みとはしない。
- 型、関連116件、保存147件、協力WS8件、カード表示6条件などの範囲は[実装記録](README.md)。今回使ったVite・preview・テストWorkerを停止し、5186/8807の待受が残っていないことを確認。

main保護・ruleset・Actions workflowは未設定を読み取り確認した。管理者バイパスやforceを使わず通常merge。既存の継続承認と通常作業の方針に従い、独立Chat監査は自動追加していない。

残件: 実スマホ、公開版の複数人プレイ、人間の通し攻略・長時間負荷・ビルド間の優劣。属性融合、呪い/風/分身、進撃専用バディは次の範囲で、今回完成扱いにしない。

正本: https://github.com/futsalife24-bot/swarm-front 。作業場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-survival-build`。記録branch: `codex/survival-elements-release-record-20261104`。記録は文書と証拠だけのため、main反映後に追加公開は不要。
