# 爆風と ANOMALY 出現演出の公開（2026-11-02）

本人が公開の再開と再ログインを依頼。Wrangler の通常の認証確認後に既存資格情報が使用可能となり、Cloudflare の当日使用量を取得できた。別アカウント作成、契約変更、追加課金契約は行っていない。無料プランは本人が同日確認済み。

- 当日 UTC 00:00〜12:13 の Workers 集計: requests 153、errors 0、subrequests 158。これは無料プランの証明ではない。
- 公開ソース main `4ccb0fdcb2003e92636bb79d3eb878f6513b1825`。製品変更の merge `f5c79d107e4b8543c8bed94c030b915cae31c7d1` との差は `docs/STATE.md` だけ。
- `npm run build:production`、`npx wrangler deploy --dry-run --config wrangler.production.jsonc` 成功。既存Worker `swarm-front` へ公開、Version `ac5cf878-0c3a-40ff-8610-37c5266e28e2` が100%配信。
- 公開27ファイルとビルドの SHA-256 が一致、`/api/health` は HTTP 200 / `ok: true`。[配信照合](delivery.json)。
- 変更のローカルテストと旧版比較は [README](README.md)。公開後の実ブラウザー画面はcua_replでブラウザー一覧0件・`Local browser use is disabled in Work settings` のため未確認。実設定・根因不明。本人のスマホ・実機負荷と実戦中の全条件も未確認。

主担当のモデルID/推論設定は取得できず未確認。子エージェントなし。
