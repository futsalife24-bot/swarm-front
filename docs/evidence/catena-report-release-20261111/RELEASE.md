# CATENAエネミーレポート公開確認（2026-11-11 JST）

- 実装: [PR302](https://github.com/futsalife24-bot/swarm-front/pull/302)、a27d728dfaa869c983f74d1cd5732817a1231ba1。通常merge・公開source: 233f2f5860997e6c0206700aa27abc1fff80fa5d。
- 既存Worker: https://swarm-front.melosalife-24.workers.dev 、Version `5d778296-0c44-43b1-aef1-539cc67461d9`、100%配信（2026-11-10 16:05 UTC）。
- 専用作業場所: `task-resume-catena-20261110` / `codex/catena-report-release-20261111`。ルート他担当12差分と別worktreeを保持。公開後は文書・証拠のみ変更。

## 実施結果

1. 通常merge後のHEADで `npm run build:production`、`wrangler deploy --dry-run --config wrangler.production.jsonc`、`wrangler deploy --config wrangler.production.jsonc` がすべてexit 0。
2. `wrangler deployments status --config wrangler.production.jsonc` で上記Version 100%を確認。
3. `SWARM_RELEASE_OUTPUT=dist-validation/catena-report-release-20261111 node docs/evidence/coop-comfort-20261030/verify-release-delivery.mjs --public <Version>`: 本体36ファイルSHA一致、health 200 / ok。build-manifest.jsonとdelivery.jsonに照合結果。
4. 新動画 `assets/encounters/report-v3/worm-20261111.mp4?v=c712e47513cc` は公開HTTP200、2,066,624 bytes、SHA256 `c712e47513cc41aa5a7b0a207a28b389fbf933ff35d0b221ad2ae84323839721` 一致。movie-delivery.json。
5. `REPORT_SITE=https://swarm-front.melosalife-24.workers.dev node scripts/check-catena-report.mjs`: exit 0。隔離Chromeの遭遇fixtureを使い、通常タイトル→レポートで1280×720 / 844×390の説明・モデル読み込み・攻撃再生、1280幅で会敵動画11秒・再生進行を確認。pageerror両方0。公開側の画像で全身、赤い着地予告と消失、動画を自己確認。連番は壁時計の採取時刻であり、正確なシミュレーション時刻ではない。跳躍の全位相は実装側の共有運動テスト・ローカル検証と併せて判断する。
6. `git diff --check` 成功。公開前点検の非公開運用資料や認証ログは公開記録に含めない。

## 検証の範囲

説明・14胴の専用表示・自然跳躍/着地予告・全身カメラ・会敵動画を連動更新。戦闘側の数値・判定変更なし。実装テストの結果は [前段の検証記録](../catena-report-20261111/VALIDATION.md)。既存HARROWレポート1不一致、全体の既存失敗、format14警告を合格扱いしない。今回は全件テストの再実行ではなく公開元ビルド・配信・変更UIを確認。

実スマホ、本番での自然遭遇、協力実通信は今回未実施。リファクタ候補2の開始ゲート停止、候補3未着手は別件として維持。ANOMALY変更時のレポート連動必須ルールはPR301でmain反映済み。

主担当の実モデルID/推論設定は取得不可・未確認。委任先の指定値はgpt-6-sol/high、実行時IDは未確認。
