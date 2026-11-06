# 進撃UIの公開

本人が今回の3点について既存GitHubへの送信・通常main反映・既存Worker公開を承認（親会話の「ええよ」）。公開保留を解除。新規費用・契約・権限・公開先の変更なし。

対象は停止の実同行情報、ダウン表示、停止ボタンのみ。base/main `1c0b77c2e95a6e9859a8c4003d0adc018338cc91`、実装 `423274ade88520d78ada944211a8da77c5fd6fae`、設計証拠 `00eba79add20ecfd4df7ba89d9f5b3f82df08006`。fetch後もmainは同じで競合なし。他のopen PRを混ぜない。Claudeの追加再検査画像 `design/advance-pause-ui/codex-check-rerun/` は未追跡のまま保持し、公開差分に含めない。

公開準備でclient/Worker型・関連11テストを再実行して成功。build成功済み、production設定Worker dry-run成功。自己レビューは実データ参照・欠損・HTML escape・down/結果分離・既存コールバック維持・レスポンシブ表示を確認。main protected=false、rulesets=[]、Actions workflows=0。必須CIがないこととCI成功は区別し、保護回避はしない。

公開後は `scripts/check-advance-pause-production.mjs` で隔離新規保存を使用し、配信JSやHP/時間/敵を改変せず、同行なし/あり・停止再開・設定復帰・リタイア取消・自然ダウン→結果を確認する。本人の既存セーブには触れない。実スマートフォンは未確認。ローカルfixture・Claude疑似安全領域検査・周辺協力QAの制約は [検証記録](ADVANCE-PAUSE-UI-VALIDATION-20261106.md) に維持する。
