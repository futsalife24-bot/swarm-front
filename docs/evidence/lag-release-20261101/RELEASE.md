# 更新停止への耐性改善の公開記録

2026-11-01、本人の「公開までやって」により [PR #249](https://github.com/futsalife24-bot/swarm-front/pull/249) を通常mergeし、既存Workerへ公開した。管理者バイパス・保護変更・新規サービス・移行・課金追加なし。

- 公開前main: `27076b2cbdb48cdb4f0af707ffd3f96a9e73aee2`
- 検証済みPR head: `6762230428160505f03ee803454a2261a883bc6e`
- 公開ソースmain: `334c736b000c635e719f4b9d2b9b78d2c55eb697`
- Worker Version: `3f46e046-54d3-412c-9659-a5a498c6d07d`
- 公開先: https://swarm-front.melosalife-24.workers.dev/
- 記録branch: `codex/lag-release-20261101`
- 作業場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-lag-fix`

端末内4096件の有限時系列、遅延ACKの入力同梱待ち、対応端末向けプレイヤー差分v2、4008から最大2回の復帰を公開。敵数・難易度・入力失効・35件/秒の上限を維持。入力枠の300ms縮小は操作継続を損なうため採用していない。

## 検証と範囲

最新mainは調査基点から進んでおらず、競合なし。merge後mainと検証済みPR headのツリー差分0、製品6ファイルのSHA256は既存manifestと一致。関連単体116件・実Worker2項目・両型・PC実画面4条件の結果を引き継ぐ。詳細は [実装・検証記録](../lag-resilience-20261101/README.md)。今回は同一コードへの不要な試験反復をしていない。GitHub statusCheckRollupは0件で、CI合格とは扱わない。

merge後SHAからproduction buildと既存本番設定のWorker dry-run成功。Worker 457.65 KiB / gzip 117.04 KiB。500KB超chunk警告は残る。公開ログはGit除外の `dist-validation/lag-release-20261101/` に保存。

公開後 [delivery.json](delivery.json) でJS/CSS・入口・sw・download manifestの27ファイルすべてSHA一致、health 200/ok。空Chromeの844×390でソロ起動・1.5秒移動・画面例外0。[公開画面](published-844.png) を目視確認。本人セーブ・本番協力部屋は不使用。公開ブラウザ確認はPCソロであり、実スマホや本番協力の動作実証ではない。

## 実行コマンド

```powershell
git fetch origin refs/heads/main:refs/remotes/origin/main
gh pr view 249 --json headRefOid,baseRefOid,mergeStateStatus,mergeable,statusCheckRollup
gh pr merge 249 --merge --match-head-commit 6762230428160505f03ee803454a2261a883bc6e --subject '戦況更新の通信量削減と遅延時の接続復帰 (#249)' --body-file $env:TEMP/swarm-lag-pr-body.txt
# main取得後、専用worktreeのHEADを公開ソースへ移動
git switch --detach origin/main
node node_modules/vite/bin/vite.js build
node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config wrangler.production.jsonc --outdir dist-worker-production
node node_modules/wrangler/bin/wrangler.js deploy --config wrangler.production.jsonc
$env:SWARM_RELEASE_EVIDENCE='docs/evidence/lag-release-20261101'
$env:SWARM_WORKER_VERSION='3f46e046-54d3-412c-9659-a5a498c6d07d'
node scripts/check-coop-response-release.mjs
```

最初の通常fetchは対象branchだけだったためmainを明示fetchし、GitHub APIのmain SHAとも照合した。公開用コードの変更なし。記録文書・配信証拠のmain反映後に再デプロイはしない。

## 未確認事項

実スマホ・実Wi-Fi・長時間・本番協力・元動画の停止箇所は未確認。通信量7.49%減は同状態20stepの制御条件であり、実回線改善率ではない。回線の停止自体を解消する修正ではなく、下り停止の注入では表示の停止が残る。主担当の実モデルID/推論設定は未確認。公開工程の子エージェントなし。使用スキル: swarm-front-audit-release。
