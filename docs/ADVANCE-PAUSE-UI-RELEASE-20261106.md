# 進撃UIの公開

今回の3点について既存GitHubへの送信・通常main反映・既存Worker公開は本人承認済み。新規費用・契約・権限・公開先の変更なし。

対象は停止の実同行情報、ダウン表示、停止ボタンのみ。base/main `1c0b77c2e95a6e9859a8c4003d0adc018338cc91`、実装 `423274ade88520d78ada944211a8da77c5fd6fae`、設計証拠 `00eba79add20ecfd4df7ba89d9f5b3f82df08006`。fetch後もmainは同じで競合なし。他のopen PRを混ぜない。Claudeの追加再検査画像 `design/advance-pause-ui/codex-check-rerun/` は未追跡のまま保持し、公開差分に含めない。

公開準備でclient/Worker型・関連11テストを再実行して成功。build成功済み、production設定Worker dry-run成功。自己レビューは実データ参照・欠損・HTML escape・down/結果分離・既存コールバック維持・レスポンシブ表示を確認。main protected=false、rulesets=[]、Actions workflows=0。必須CIがないこととCI成功は区別し、保護回避はしない。

公開後は `scripts/check-advance-pause-production.mjs` で隔離新規保存を使用し、配信JSやHP/時間/敵を改変せず、同行なし/あり・停止再開・設定復帰・リタイア取消・自然ダウン→結果を確認した。本人の既存セーブには触れない。実スマートフォンは未確認。ローカルfixture・Claude疑似安全領域検査・周辺協力QAの制約は [検証記録](ADVANCE-PAUSE-UI-VALIDATION-20261106.md) に維持する。

## 公開結果

[PR290](https://github.com/futsalife24-bot/swarm-front/pull/290) を通常merge。PR head `99dfc811aa65dd922036592d97b16ab3a1b70768`、公開ソースmain `ea939ef28bda6559dc1850f13f103040b941eb29`。remote/ローカルmainの一致、製品コードがPR headと同じことを確認し、merge後mainからbuildとproduction Worker dry-runを実行して成功。

既存Worker `swarm-front` Version `f58f57f5-0188-4c7a-8ab4-bcdb623fc420` を2026-11-06T11:36:51Zに公開。公開後の一覧で同Versionの100%配信を確認。URL: https://swarm-front.melosalife-24.workers.dev 。配布60ファイルのSHA一致、health200/ok、設計用ファイルが配布物に含まれないことを確認。公開記録の後続変更は製品コードを変えず、再公開しない。

## 公開版の操作確認

568×320（同行なし）と844×390（ヨスガLv1を実UIで選択）の両方で、停止/再開、設定復帰、リタイア取消、反復操作、自然ダウンから敗北確定・結果画面まで成功。ブラウザ例外0。実スクリーンショットで文字・主要操作の収まりを確認。隔離ブラウザの新規保存だけを使用し、本人の既存セーブは変更していない。公開版はfixtureによるHP/時間/敵の変更なし。640×360と欠損表示はローカル検証のみ。

初回の公開QAは遅れて表示される初遭遇演出で停止ボタンが隠れ、待機タイムアウト。検査器に既存の「スキップして戦闘へ」を処理するハンドラを追加して再実行した。初回を合格とは扱わない。製品コードの修正は不要だった。

証拠: [配信確認](evidence/advance-pause-release-20261106/delivery.json)、[公開操作結果](evidence/advance-pause-release-20261106/results.json)、同フォルダの568/844の停止・ダウン・結果画像。初回失敗は同フォルダ `first-attempt.json`。実スマートフォン、長時間操作、今回の周辺協力回帰は未確認。ローカル協力QA未完の理由とfixture条件は検証記録を維持。
