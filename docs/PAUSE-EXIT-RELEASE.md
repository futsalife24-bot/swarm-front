# 設定・退出確認の公開記録

- 公開先: https://swarm-front.melosalife-24.workers.dev/front
- PR133: https://github.com/futsalife24-bot/swarm-front/pull/133 （通常統合済み）
- 基点: 77ce25ae7cfae040ae144450ff17fc48e9ed74cf
- 監査対象: 83e86932a668992e1250e2731dd83f1701043293
- 公開ソース: df7e620b07846833b56ba9000fee6893f1ca3370
- Worker: c06663f2-6afc-4e2b-9667-e60a4f1d8b6e

「保存して戻る」表記と一時停止中の退出確認を追加。キャンセル/Escapeでは停止維持、確定のみ出撃終了。旧攻略・自動保存の仕様は維持。

型・横640/844・実2人協力・保存147・保存ブラウザ4系統・build/dry-run成功。独立監査合格、必須指摘なし。監査後の実装差分なし。
公開health200・配信42件SHA256一致。アプリ内ブラウザの実公開先で出撃→停止→設定の保存して戻る→退出確認→キャンセルで停止維持→再表示と確定でタイトルへ戻ることを確認。error0。確認用出撃を終了しタイトルへ戻した。

実機タッチ未確認。協力中にdialog表示のままphaseが変化するE2E追加は監査の任意提案で未実装。実装は再描画時も退出/停止解除を起こさない。
モデルID・推論設定: 未確認。
ローカル: C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a
監査・検証証拠: [記録](evidence/pause-exit-20261006/README.md)、[監査](evidence/pause-exit-20261006/audit-final.md)、[配信](evidence/pause-exit-20261006/live-delivery.json)
