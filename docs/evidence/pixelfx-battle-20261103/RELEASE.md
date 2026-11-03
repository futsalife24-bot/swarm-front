# PixelFX戦闘演出の公開（2026-11-03）

本人指定のPixelFX素材を使った発砲・着弾・爆風・酸・ANOMALY出現の演出を既存Workerへ公開。[実装と検証](README.md)。

- 公開ソースmain `e94b6909624c6fa9dc1dcfa190a15f94fc1b54f4`、[PR #263](https://github.com/futsalife24-bot/swarm-front/pull/263)。merge後の `npm run build:production` と `npx wrangler deploy --dry-run --config wrangler.production.jsonc` に成功。
- 既存WorkerのVersion `c1aab6c2-0b8a-40b1-9a71-3b5e562b4616` が100%配信。新しい画像とライセンスを含む30ファイルのSHA-256一致、health HTTP 200 / ok。[配信照合](delivery.json)。
- 当日UTC 00:00〜03:29のWorkers使用量は43 requests・errors 0・subrequests 45。無料プランは2026-11-02の本人確認であり、この数値だけでは契約の証明にならない。契約・プランの変更や新規費用契約は行っていない。
- 公開後の実画面はcua_replのブラウザー一覧0件・`Local browser use is disabled in Work settings` で未確認。実設定・根因は未確認。本人スマホ・実機負荷・実戦中すべての視認性は未確認。

主担当モデルID/推論設定未確認。子エージェントなし。
