# 補給ポッド10演出・無料補給の公開記録（2026-11-11 JST）

- 実装 [PR304](https://github.com/futsalife24-bot/swarm-front/pull/304) を通常merge。公開source `aaecc2ac7898866364ac85fe65f9101b53032f0e`。PR head `f1685f792b4405ec7f9c5b06024d91812a011a73` から製品差分なし。GitHubのstatus/workflowは0件、mergeableを確認し、保護の迂回なし。
- 公開先 [Swarm Front](https://swarm-front.melosalife-24.workers.dev/?base=1)、基地→補給ポッド。既存Worker Version `72f68324-431a-4d3a-8908-a495aac62433`、2026-11-11 07:26 UTC、100%配信。
- 専用worktree `task-gacha-kakutei-10-20261111`。別作業中のmainを動かさず、専用worktreeをmerge済みorigin/mainへdetached同期してビルド。公開後の記録branchは `codex/supply-release-record-20261111`。元root/別worktreeの差分を保持。

## 実際の確認

1. merge済みHEADから `node ../node_modules/vite/bin/vite.js build` 成功。既存大chunk警告のみ。`wrangler deploy --dry-run --config wrangler.production.jsonc`、同設定のdeployがexit0。既存GATE/ROOMS/project-hubのみ、新規サービス・契約・移行なし。最初の最終dry-runはビルド完了前に走らせたため未コピー素材で失敗した。ビルド完了とファイルの存在を確認して再実行し、成功。最初の失敗を成功に含めない。
2. `wrangler deployments status --config wrangler.production.jsonc` で上記Version 100%を確認。
3. 本体36ファイル・healthを既存公開検証器で確認。SHA全一致、health HTTP200/ok。[build-manifest.json](release/build-manifest.json)、[delivery.json](release/delivery.json)。build revision `f2c413b80ce9e685cd35303b35834ac9fbb1ea3495a8c85d737f59f9ba31cb5d`。
4. `dist/supply-reveal` 全20ファイルのbytes/SHA/HTTP200一致。[supply-delivery.json](release/supply-delivery.json)。再現用 `node scripts/check-supply-delivery.mjs`。描画式・資産・元動画比較の実装前後の証拠は [VALIDATION.md](VALIDATION.md) と57枚ずつの比較画像を参照。
5. 公開Workerの隔離した匿名検証IDで初回券、再初期化、認証/Origin/結果持込み拒否、並行10連の1回だけ消費、SR以上保証、結果再送、ACK/使用済みIDの再消費拒否が成功。[http.json](release/http.json)。
6. 公開Chrome844×390/640×360の隔離した新規保存で、初回バディ選択→基地→補給10連→受領保存→演出途中の再読込み→同じ結果の回復→スキップ→受領ACK→基地まで成功。受領ID/武器ID/武装片は再読込み前後で同一、pageerror0。[game/results.json](release/game/results.json)、[844結果](release/game/844-results.png)、[640結果](release/game/640-results.png)。検証用IDのみで既存利用者の保存・券は変更しない。メニュー画像は遷移中の撮影であり、配置評価は前段のstable画像と併せて判断する。

公開HTTP/本体検証はmain上の検証器から出力先だけを `release/` へ替えた一時コピーで実行した。記録commitでは同じ用途の `SUPPLY_OUTPUT` オプションを検証器へ追加した。再実行時のPowerShellは以下。新規検証口座の受付制限を維持するため、確認済みの試験を無目的に繰り返さない。

```powershell
$env:SUPPLY_SITE='https://swarm-front.melosalife-24.workers.dev'
$env:SUPPLY_OUTPUT='docs/evidence/supply-kakutei-20261111/release'
node scripts/check-supply-http.mjs
$env:SUPPLY_OUTPUT='docs/evidence/supply-kakutei-20261111/release/game'
node scripts/check-supply-game.mjs
```

## 範囲と残る確認

改善5案は含めない。承認済みの無料補給券/対象/通常確率/10連SR以上保証と、元10演出を本体へ接続した。実装の関連59件・両型・ローカル操作/HTTPの検証結果は前段記録を参照。公開後は記録・検証器だけを変更し、製品コード/素材の追加変更なし。

実スマホ、音の実聴、光刺激の専門評価、今回の全ゲーム全件/協力実戦は未実施。既存の未解決事項を今回の成功で合格扱いにしない。

主担当gpt-6.1-sol（推論設定未確認）、委任時指定gpt-6-sol medium/high。公開素材照合器は表示担当が作成し、主担当が内容を確認して実行。独立Chat監査ではない。
