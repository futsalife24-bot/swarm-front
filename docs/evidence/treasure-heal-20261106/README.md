# 生存宝箱の回復量を整数表示（2026-11-06）

本人画像の長い小数表示を修正。`src/client/front-reward-ui.ts` の回復量表示だけ `Math.ceil` を適用し、HP欄と揃えた。例: 28.835476666666807 → `HP +29`。実際の回復量、戦闘・保存・報酬ルールは変更しない。

- `tests/front-reward-ui.test.ts` 2件成功。小数→29、整数20の維持、入力報酬値不変を既存テストへ追加。
- `npm run typecheck` 成功、`git diff --check` 成功。
- 既存Chromeの隔離ブラウザで実表示関数とCSSを使用し、844×390 / 640×360で `HP +29`、横幅内への収まり、入力値不変、画面例外0を確認。戦闘から回復発生までの実プレイとは区別。初回の検証器は30秒の読込待ち期限で停止し、待機条件修正後に両方成功。
- 再現器は `check.mjs`。repoルートで `npm run dev -- --configLoader native --port 5186 --strictPort` のReady後、`node docs/evidence/treasure-heal-20261106/check.mjs`。出力はignoredの `dist-validation/treasure-heal/`。
- 現在も無料という同じ本人回答を継承し再質問なし。既存OAuthの初回使用量取得401はWrangler正規更新後に解消。当日UTC00:00〜04:29:05の全Workers55 requests / 0 errors / 56 subrequests。新規費用・契約/権限変更なし。

base: `6e08f90badd2a444f1425d772ebbc694421e208e`。作業場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-survival-build`。正本: https://github.com/futsalife24-bot/swarm-front 。主担当モデルID/推論設定未確認、子なし。独立監査は通常方針で追加しない。

## main反映・公開

- 実装 `73422ceeb994b61ff03ed14df5683cb8260011e5`、[PR286](https://github.com/futsalife24-bot/swarm-front/pull/286) を通常merge。main・公開ソース `e7ca8a2201bfd92daf683915af8bf47da180befa`。実装commitとmerge後mainの製品build・既存Worker dry-run成功。既存の大きいchunk警告は残るがビルド失敗なし。
- main保護false・ruleset0・Actions workflow0・commit status0を実取得。CI成功とは呼ばず、保護の変更/バイパス/forceなし。
- 既存 `wrangler.production.jsonc` に従い、Worker `swarm-front` Version `91fc525c-dcdf-4042-96e8-049feab225c6` を2026-11-06T04:33:28Zに100%公開。公開先 https://swarm-front.melosalife-24.workers.dev 。契約・権限・費用変更なし。
- `node scripts/check-buddy-delivery.mjs` で公開60ファイルのSHA一致・health200/ok。`production-delivery.json` に記録。修正を含む配布物と公開物の一致を確認した。
- `node scripts/check-foundry-public.mjs dist-validation/treasure-heal/public` で公開入口を844×390/640×360で確認、例外0。部屋作成/参加はしていない。`production-startup.json`。宝箱の回復表記そのもののUI確認は上記ローカルの実表示関数/CSSであり、公開の通常プレイから宝箱回復までを通した証拠とは区別する。実スマホ/PWAは未確認。
- 今回の開発サーバー5186停止、隔離Chrome終了。公開記録のみの後続commitでは製品コードを変更せず、再デプロイ不要。
