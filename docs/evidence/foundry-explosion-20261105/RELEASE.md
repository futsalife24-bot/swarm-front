# FOUNDRY ZEROの爆発ダメージ修正：公開記録

2026-11-05。[PR #284](https://github.com/futsalife24-bot/swarm-front/pull/284) を通常merge。実装commit `567bbeae13ea63b43b45729e5eb3fd09b4a81f07`、公開ソースmain `49cc8459181deeeb6611d4971f5535bc9a6f91f2`。PR headとmerge後mainにファイル内容の差分なし。merge本文の日本語Player-Noteを維持。

## 公開と配信確認

- 実装commit後/merge後mainの本番buildと、既存production Worker dry-run成功。500KB超chunkの既存警告あり。mainからのdistで通常deployした。
- 既存公開先 https://swarm-front.melosalife-24.workers.dev 。Version `7e99ceb9-4ea2-43b0-af65-b7ebd67d5809`、`wrangler deployments status` で100%配信を確認（2026-11-05 13:36:58 UTC）。新規サービス・費用・契約/権限変更なし。
- `scripts/check-buddy-delivery.mjs` を既存の読取照合器として再利用。HTML/JS/CSS/JSON/Webmanifestと既存バディ素材等60ファイルが最終buildのSHA-256と一致、health200/ok、DEVレビュー/Design配布なし。[全照合](production-delivery.json)。その他の未変更画像/音声/3Dモデルは今回のSHA照合対象外。
- 本番Worker bundleにテストfixture固有文字列、配布client JSに今回の観測/照準hookが含まれないことを実ファイルで確認。[非混入確認](fixture-exclusion.json)。productionのmain/公開APIは変更せず、test専用adapterを公開していない。
- `scripts/check-foundry-public.mjs` で公開版を隔離Chromeの844×390/640×360へ開き、通常の協力入口の起動/表示/操作部品を確認、ページ例外0。公開部屋の作成/参加や実ユーザーの保存変更はなし。[公開起動結果](production-startup.json)。

## 修正確認の範囲

FOUNDRY ZEROの実射ダメージは、[実装検証](README.md)の実ローカルWorker/実WS/製品Rendererで確認。2サイズ×4武器の8条件でHP10500から、ロケット170/重ロケット430/GL-6 90/粘着弾135の減少。修正前に失敗した回帰13件と既存関連を含む117件、型・整形・差分確認も成功。

配置/装備/照準は隔離fixtureを使い、その後の射撃・弾道・爆風・ダメージ・HP配信は実コード。公開版では通常入口の起動と配信一致を確認したもので、公開実戦でST11の2waveを通し攻略して各ダメージを測ったとはしていない。実スマホ/PWA、実回線協力、人の通し攻略は未確認。

初回検証器の準備不備・名前登録待ち・PCモードの非表示ボタン参照による停止は、最後の成功8条件と区別している。型/テスト/壁遮蔽を弱めず、Hook・CI・保護設定・watchを変更していない。通常の独立Chat監査は2026-10-15の最新方針に従い追加しなかった。main保護の設定なし・PR status報告0件を確認し、管理者バイパス/forceは使っていない。

## 契約と終了状態

この会話で確認済みの「無料プランのまま」という本人回答を今回も継承。同じ質問や契約API403の反復はしない。当日UTC00:00〜13:34:13の全Workersは258 requests/0 errors/279 subrequestsを既存OAuthの正規GraphQLで読み取り確認。[使用量](cloudflare-usage.json)。

今回のVite5186/隔離Worker8807と隔離Chromeは終了し、待受0を確認。他セッションの作業やプロセスは保持。公開記録は `codex/foundry-explosion-published-20261105` の文書・証拠・起動検証器だけで、ゲームコードを変更しないため再デプロイ不要。

正本 https://github.com/futsalife24-bot/swarm-front 。作業場所 `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-survival-build`。主担当の実モデルID/推論設定は未確認、子なし。
