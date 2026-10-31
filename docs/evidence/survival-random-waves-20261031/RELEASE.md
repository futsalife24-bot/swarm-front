# 生存戦のランダム出現・大量出現の公開

- 本人の明示承認後、[PR #241](https://github.com/futsalife24-bot/swarm-front/pull/241)を通常merge。実装 `a8a44187a09359e729f6eae2612b7e1d72700275`、公開ソースmain `6d6c1557a9e2fedc3570bff4ccd35d676dcacdc7`、既存Worker Version `6e380bf9-d909-4a9c-b8d9-cf528ca263b0`。公開先 https://swarm-front.melosalife-24.workers.dev/ 。
- merge後production build・Worker dry-run成功。[配信照合](delivery.json)は35ファイルSHA一致・health 200/ok。[画面確認](public-ui.json)は公開コードのGET専用中継・空Chromeで生存戦へ出撃、画面例外0。本人のセーブ・本番部屋は不使用。2分/4分の出現を本番で確認したわけではない。
- 変更の包囲・集中各24体、予告、2人通信、上限、実画面の根拠と再現条件は[実装時の証拠](README.md)。実スマホ・実回線複数端末・長時間・実戦難易度は未確認。ソフトウェア描画のFPSは実機性能を示さない。
- 本人確認済み無料契約。当日UTC 00:00〜08:29のアカウント全Workersは137 requests・errors 0・subrequests 160、DO個別使用量未取得。保存済OAuthの期限切れ401後、既存Wranglerによる通常更新で読み取り成功。新規費用・契約・権限変更なし。
- GitHubのchecks/statusesは0件、CI合格とは扱わない。ブランチ保護の変更や迂回なし。
