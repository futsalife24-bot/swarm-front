# 自然跳躍と保留機能の統合確認（2026-11-10）

対象は `task-resume-catena-20261110` / `codex/resume-catena-20261110`。基点mainは `3f2c429c442c44d54bf4a8132cc791f30534ae9d`。PR297候補 `aca371023cbb1db5dbf68ee0364b688f45bfb676` と自然跳躍 `5f0a4d750c17477e9139b09dbf355e9611903ff8` を `4ef29043f151dde537845046a670771e3e1edd33` で通常mergeした。衝突はSTATEの履歴とfixture名だけで、双方を保持した。容量試験 `7ef8b71`、step対照・期待値更新 `8943f5681089ed9ba820ebc8728a69ddf35593df` はテスト・証拠の変更で、製品コードの追加変更なし。

- [PR297](https://github.com/futsalife24-bot/swarm-front/pull/297): HARROW・武器調整・支援報酬・表示専用補給演出。
- [PR298](https://github.com/futsalife24-bot/swarm-front/pull/298): CATENAの14胴・自然跳躍・接地修正・通信互換性。
- 通常main反映済み: PR297 `f72672f2cb5cbe3eda670a10d859490ed75a18cd`、PR298 `4dfc8228e99309464f1436b0853228a0fd4aa0f5`。Worker公開は未実施。実mainを明示fetchして専用worktreeへfast-forwardし、候補f35a7e6との全tree一致・検証c4f2c27との製品コード/素材一致を確認した。別worktreeで使用中のローカルmainは保護した。この後続更新は記録だけで製品不変。独立Chat監査は通常タスクに必須ではなく、別Codexの技術レビューで単体候補の旧HOLDは解除可能と判定済み。

| 確認 | 実結果 |
| --- | --- |
| 統合後 `npm run typecheck` | 4ef2904の製品コードでクライアント/Workerとも成功 |
| 密集容量単体 | 旧7胴/v1と支援報酬14胴/Ω/v2の2条件成功、cache有無・分割有無・全数復元 |
| 密集の実Worker/WebSocket | 4人400弾は最大65,465B、4人1000弾は各6frameで最大17,162B。96敵/160orb/全弾、省略0、decode0、close4009なし |
| 支援報酬の実Worker/WebSocket | `vitest.support-integration.config.ts` 7/7成功、4.34秒 |
| CATENA旧版更新/再接続 | 更新案内、14胴state前の旧版切断、旧版再接続案内、新版同ID復帰、非WORM旧版互換、旧版同室のWORM出撃阻止が成功 |
| CATENA新版同期 | 実WebSocket2本で同時刻36状態一致、着地HP992/1000、エラーなし |
| step特性22条件 | 18成功/既存前線4不一致。新規4条件だけ対照後に期待更新。前線4は基点/統合版で毎tickと受信SHA一致 |
| client build / Worker dry-run | HEAD c4f2c27で両方成功。client 290 modules、Worker 526.00 KiB / gzip 135.20 KiB。公開なし |
| 全体 `npm test` | HEAD c4f2c27で170ファイル/1752件を完走。1729成功・23失敗、547.92秒、exit 1。既存22件＋旧版を新版形式で比較した試験1件 |
| 旧版形式の試験指定修正 | 歴史的v1との比較にversion=1を明示し、当該ファイル9/9成功。旧生成器・期待byte・assert・製品コードは不変。修正後の全件再走は未実施 |
| format / 差分 | formatは基点と同じ14ファイルの警告で失敗。ファイル名の機械照合で増加0。基点からの `git diff --check` は成功 |

通信は起動済みの隔離Worker `http://127.0.0.1:8789` を再利用。CATENAの検証スクリプトは接続先を `SWARM_TEST_SERVER_URL` で選べるようにしただけで、既定の8797・入力・assert・上限は維持した。鍵/tokenを出力しない。生ログはGit除外、要点と測定JSONを同じフォルダーへ保存。実通信の密集fixtureは7胴、14胴/Ωと支援メタデータの合成は単体、実CATENA同期は14胴であり、検証範囲を混同しない。

step対照では、WORM波の初差はtick529の胴HP半減、全種平地/高低差はtick0の14節化に伴う配置、洞窟全種はtick0の支持面修正だった。基点の4条件が更新前snapshotの全項目に一致することを先に確認した。微小座標差の条件も胴数・胴HP・総HPを別途照合した。詳細は [step-causality.json](step-causality.json) と [CATENA記録](../../CATENA-RESUME-20261110.md)。

PR297単体の全体試験は、CPU負荷対処後に1349条件（1326成功/既存23失敗）まで進んだ。ST25は189.5秒で成功し、観測失敗名の追加は0。14:48:44 JSTに前後するツール再接続後、セッションIDとVitestプロセスがなくなり終了集計を取得できなかった。途中結果を `integration-precheck-interrupted.txt` / `integration-precheck-comparison.json` に保全し、完走や合格には数えない。最終統合版は終了コードもファイルへ残す個別の隠し検証プロセスで実行する。Node親子だけAboveNormal、既定の時間上限・assert・入力は変えない。

最終全体結果は [integrated-full-comparison.json](integrated-full-comparison.json) と [生結果](integrated-full-test.txt)。基点24失敗と名前を機械照合し、既存22件を再観測、ST25と更新履歴の2件は明示的な成功行を確認した。新規1件は旧受信者を確かめる試験が `packet()` の既定v2を選んでいたためで、Workerの実接続は既に旧版へv1を明示していた。v1選択だけを試験へ追加し、同じ旧生成器との厳密なbyte一致を含む9件が成功した。失敗した全体ログは残し、この限定再検査と全件完走を混同しない。[指定修正と証拠](integrated-v1-compat-fix.md)。

基点mainには全体24失敗とformat14警告がある。現在も既存22件とformat14警告は未修正であり、全体合格とは報告しない。候補2リファクタは本人指定の開始ゲート不合格で停止しており、この機能統合へ混ぜない。候補1の再実装・候補3・依存のインストール・既存Worker公開は行っていない。実Android/iOS・実回線・公開版の通し操作・旧製品全体E2Eは未確認。

元rootの他担当12差分と別worktreeは保護。主担当の実モデルID/推論値は未確認、子2体の割当はgpt-6-sol/high（実行値は未確認）。ClaudeのUI表示はOpus 5.5/高。記憶の概要はMainVaultの既存swarm-frontノートで管理する。
