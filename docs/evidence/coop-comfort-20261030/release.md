# 実機確認用公開の準備（2026-10-30）

本人の「承認します、実機確認するので。」で通常main反映・既存Worker公開を追加承認。新規費用・契約・権限変更は行わない。高負荷の入力の途切れを完全解消したという承認には読み替えない。

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
