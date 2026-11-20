# 補給武器画像の公開記録

- [PR #321](https://github.com/futsalife24-bot/swarm-front/pull/321) を通常merge。公開ソース `2dca748c85502038c05a387af05dc79ff170c6c1`。
- merge後の `npm run build:production` と `npm run server:build:production` は成功。既存 `wrangler.production.jsonc` で公開し、Worker Version `3a41afa8-33ff-4d99-8aa3-20c6c92d23e5`。
- [公開照合結果](published.json): 12武器×5等級の画像60点、およびHTML・SW・manifest・補給表示スクリプトなど6ファイルがHTTP 200かつ公開ビルドとSHA一致。画像はContent-Typeも確認。`/api/health` はHTTP 200・ok=true。[照合コード](published-check.mjs)。
- [ローカル実画面とテスト](README.md)を実施。公開Workerでの認証済み抽選・演出、実スマホ・音は未確認。
