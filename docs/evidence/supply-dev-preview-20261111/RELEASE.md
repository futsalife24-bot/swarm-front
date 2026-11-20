# 管理者モード・補給演出確認の公開（2026-11-11 JST）

- 実装 [PR306](https://github.com/futsalife24-bot/swarm-front/pull/306)、head `99f6ac1e29ae740a947c27e64d47d988aa969622`。通常merge後の公開source `c0a75e61e620224a4ce39e158de43b6cd6bb2f70`。status/workflow0件・mergeableを確認、保護の迂回なし。
- 既存 [Swarm Front](https://swarm-front.melosalife-24.workers.dev/)、Worker Version `2bc75dc0-9d49-4082-af29-43f1fd87a664`、2026-11-11 08:11 UTC、100%配信。
- 使い方：設定・操作→管理者モードへログイン→基地→補給ポッド。「選択した演出で10連」と「ランダムで10連」。結果一覧で演出確認へ戻れる。確認では券・報酬・保存を更新しない。

## 公開確認

1. 専用worktreeをmerge済みorigin/mainへdetached同期して本体Vite build→既存 `wrangler.production.jsonc` でdry-run→deployがすべてexit0。Worker/serverに実装差分なし、新サービス・契約・認証設定の変更なし。既存大chunk警告は維持。
2. `wrangler deployments status` で上記Version 100%を確認。本体36ファイルSHA一致とhealth HTTP200/okを既存公開検証器で確認。[build-manifest.json](release/build-manifest.json)、[delivery.json](release/delivery.json)。build revision `0e070a64f8c7e0f43e88828bc5f0a80e25a1400ebd7975112653e47d153b513d`。
3. `supply-reveal` 全21ファイルのbytes/SHA/HTTP200一致。[supply-delivery.json](release/supply-delivery.json)。既存 `check-supply-delivery.mjs` の出力先だけを今回の `release/` へ替えたコピーで実行。記録commitでは同じ用途の `SUPPLY_OUTPUT` オプションを検証器に追加した。
4. 公開Chrome844×390/640×360の隔離した未認証contextで、`/api/developer/session` のauthenticated falseと、`?developer=1&base=1` のログイン必須を確認。演出確認UI/overlay非表示、補給API0件、pageerror0。[public-gate.json](release/public-gate.json)、[640画面](release/640-public-auth-gate.png)。認証を迂回しない。再現器 `scripts/check-supply-dev-gate.mjs`。
5. 公開側の認証済みセッション/パスワードは今回使っていないため、公開側の認証済み24回操作は未実施。ローカルの実Workerで正式ログイン後に、両サイズそれぞれ選択10案＋ランダム2回・全localStorage不変・補給API0件・例外0を確認した実結果は [VALIDATION.md](VALIDATION.md)。通常10連/回復/受領も同じビルドで2サイズ成功。配信SHA一致と、認証済み公開操作の確認範囲を区別する。

```powershell
$env:SWARM_RELEASE_OUTPUT='docs/evidence/supply-dev-preview-20261111/release'
node docs/evidence/coop-comfort-20261030/verify-release-delivery.mjs --public 2bc75dc0-9d49-4082-af29-43f1fd87a664
$env:SUPPLY_OUTPUT='docs/evidence/supply-dev-preview-20261111/release'
node scripts/check-supply-delivery.mjs
node scripts/check-supply-dev-gate.mjs
```

公開後のbranch `codex/supply-dev-release-record-20261111` は記録と検証器のみ、製品再公開は不要。専用worktreeのHEADをorigin/mainと一致・cleanへ戻し、別作業中のmainとrootの既存差分を保持する。

実スマホ・実聴・今回の全ゲーム全件/協力実戦は未実施。元10案の描画・素材に変更なし。主担当gpt-6.1-sol（推論未確認）、入口/検証器補助の指定gpt-6-sol/medium（実行設定未確認）。独立Chat監査ではない。
