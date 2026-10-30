# 実機確認用公開の結果（2026-10-30）

本人の「承認します、実機確認するので。」で通常main反映・既存Worker公開を追加承認。新規費用・契約・権限変更は行わない。高負荷の入力の途切れを完全解消したという承認には読み替えない。

## 公開完了

本人が現在の契約を「無料」と回答したため、既存Workerへ公開を実行。sourceは`3f5a3f0f68c315836e1af036a61071997c04920f`、Versionは`130fc18b-e2d5-4aed-9d2e-fa34a4d58d69`。先行公開準備記録のmain `78fc776`との差分はdocsのみ。実行前にcleanなsourceへ戻し、buildの35ファイルhash不変を確認した。build/dry-runの成功済み結果を使用し、ゲーム変更なしで繰り返さない。[公開ログ](release-deploy.txt)。

2026-10-30 18:20 JSTに本体35ファイルの配信SHA一致・health200/okを確認。[配信照合](release-delivery.json)。公開先は https://swarm-front.melosalife-24.workers.dev/ 。

配信コードをGET専用のローカル中継と空Chromeで起動。390×844でroot/frontの縦向き案内、844×390へ回転後の事前保存11パックと容量表示、生存ソロ出撃→初期強化選択→兵士/敵/地形描画、60 FPS・画面例外0を確認した。画像も目視確認。[結果](release-public-ui.json)、[縦向き](release-portrait.png)、[事前保存](release-download-menu.png)、[生存](release-survival.png)、[再現script](check-release-public.mjs)。これは配信コードの起動検査で、本人の実セーブ・本番協力部屋・iOS Safariは使用していない。Service Workerはこのスモーク検査ではblockし、事前保存完遂/オフラインは先行の統合検査結果と区別する。

初回の検査scriptは存在しない`front-settings-close`を指定して失敗。ID修正後も画面遷移用の影DOMコピーへ7件一致したため、既存手順と同じlight DOM限定と遷移完了待ちへ修正。製品コードは変更せず、最終実行exit0/全条件成功。途中の失敗原本は`dist-validation/coop-comfort-20261030/release/public-ui/first-attempt.json`と`second-attempt.json`に保持。

以下の阻害要因と再開手順は公開前の履歴で、今回の本人回答によって解消済み。実機の快適さ・Safari音量・高負荷の残件まで解消済みとは扱わない。

## 完了した操作

- PR231をdraftから通常PRへ変更し、head `2e95f73eef1a04dcb65558c80861566ca160c25c`を通常merge。merge/source mainは`3f5a3f0f68c315836e1af036a61071997c04920f`。baseは`3e1dc640e15d747cc2a06ac72c59833db2072f74`。merge前後のファイル差分0、ゲーム実装は検証済み94b7346と同じ。
- GitHub branch APIはprotected=false、rulesets=[]。対象headのchecks/statusesは0で、CI成功とは記さない。管理者バイパス・保護変更なし。
- 元rootの未保存成果は保持。mainを所有するdist-hもmain・未保存/未追跡0・fast-forward可能を実行直前に検査し同期。最初の同期申請は自動承認レビューが別作業への影響を懸念して拒否したが、読み取りで条件を示してから通常同期した。
- merge後HEADからbuild成功（233 modules、6.35秒、既存500kB超警告）。production dry-run成功（443.39KiB、gzip113.35KiB）。[build](release-build.txt)、[dry-run](release-dry-run.txt)。ゲーム変更なしのため成功済みの関連単体・実通信・実画面検査は重複実行しない。
- 事前保存manifest revisionは`b993e4ba1e353142e11b1a1b55e0e3ab3c5ea2135d0f9a377347486c9fa10501`。[本体35ファイルの照合用hash](release-build-manifest.json)。本番配信との一致はまだ確認していない。

## 公開の阻害要因

`docs/FREE-TIER.md`は公開時に契約とアカウント全体の使用量確認を要求する。既存Wrangler OAuthによる公式APIで、当日UTC 00:00〜08:45の全Workersは173 requests・0 errors・186 subrequests。契約subscriptionsは403、workers/account-settingsのstandardはFreeの証明にはならない。[読取結果](release-account.json)。直近の過去確認は10/28のFree・$0だが、現在の確認に置き換えない。

ブラウザ接続がWork設定で無効。WindowsのComputer Useは「現在のブラウザURLを安全に判別できない」として操作前に停止した。以降UI操作を実行せず、既存APIで読み取れる使用量だけ確認した。認証値は記録・出力しない。再ログインによる権限拡大・契約変更は行っていない。

本人へ現在もFree／無料・$0か確認を依頼。返答未取得の時点でdeployは未実施。Wrangler deployments listで旧Version `1750b255-3318-4c05-831f-5e772fe2d9c9`の100%配信を確認。新コードの公開、配信ファイルSHA/health、公開版画面・実機の成功を報告しない。

## 再開手順

1. 現在のFree契約を本人回答または復旧した管理画面で確認する。公開の追加承認は取得済みなので取り直さない。
2. 最新mainと公開対象のゲーム差分を確認し、必要ならmerge後HEADからbuildとdry-runをやり直す。文書だけの追記を理由に成功済み全件検査を繰り返さない。
3. `wrangler.production.jsonc`で既存swarm-front Workerへ公開し、source SHA・Versionを記録。
4. `node docs/evidence/coop-comfort-20261030/verify-release-delivery.mjs --public <Version>`で本体35ファイル・事前保存manifest・SWのhashとhealthを確認。実行時HEADがbuild元と同じであることを先に確かめる。画面確認は実セーブと本番の他人の部屋を使わない隔離環境で行う。
5. 公開記録をmainへ保存し、本人へ公開完了と実機確認項目を渡す。

## 公開後の実機確認

オンラインで全参加者がゲームを再読み込みして新しい版へ揃える。タイトルの「設定・操作」→「データを事前ダウンロード」で必要な戦場を選び保存する。アプリ削除やサイトデータ全削除は不要。

確認するのは、縦向き起動の案内、Safariの音量小/大/0と復帰、マルチの人数・戦場・戦闘時間・左下FPS・位置ずれ/着弾抜け/敵消失、事前保存後の起動。結果には端末/OS/ブラウザとWi-Fi/携帯回線も添える。実機と長時間/発熱の確認が済むまでgoalを完全達成とせず、バディ実装は保留する。

主担当の実モデルID/effortは未確認。今回の公開再開は単独で実行し、独立監査は追加していない。
