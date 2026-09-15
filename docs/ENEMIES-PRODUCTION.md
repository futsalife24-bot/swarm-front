> 追記 2026-09-10: HOUND派生VOLLEY/LEAPERも採用モデルへ更新・公開済み。連結炉は旧専用モデル。最新状態は [RETREAT-FREEZE-FIX.md](RETREAT-FREEZE-FIX.md) を参照。以下は初回4体導入時の記録。

# 4体の正式導入と公開

2026-09-10。ユーザー「4体まとめて正式版に入れて公開まで」の明示承認により、HOUND・PRISM・RAY・FOUNDRY ZEROを通常ゲームとエネミーレポートへ導入。

## 正式動作

- `hound_motion_v1.glb` / `prism_motion_v1.glb` / `ray_motion_v1.glb` / `foundry_zero_motion_v1.glb`を通常URLで読み込む。RAY・FOUNDRY ZEROは攻撃強化v2を採用。
- 1種類につき4材質バッチ（FOUNDRY ZEROのみ5）。骨行列をGPUテクスチャへ焼き込み、個体別のID・移動距離・予兆・クールダウンから待機・移動・攻撃を選ぶ。複数個体を一斉の同じ動きにしない。
- HOUNDの衝撃は0.45秒、PRISMの発射は0.8秒。RAYは大きく振りかぶり2.05秒で発射し、最後の0.4秒は照準固定。FOUNDRY ZEROは3.1秒かけて立ち上がり・踏み下ろしを行い、同時に予告した地点を攻撃する。攻撃力・攻撃範囲は維持。
- 連結炉（worm）は専用の既存モデル・移動・攻撃を維持。通常FOUNDRY ZEROと同時に存在しても、連結炉の頭部や節を隠さない。HOUNDの派生種VOLLEY / LEAPERは今回の4体以外として維持。
- GLBの読込失敗時は既存モデルでゲームを継続。敵消去・画面離脱時に個体状態と描画数をクリア。
- 図鑑の4体も正式GLBに更新。`.assetsignore`により静止試作6GLBをCloudflareの公開対象から除外。ローカル原本は保存。

## 検証

- typecheck・production build・Worker production dry-run成功。既存の500kB超チャンク警告あり。
- 単体170件成功。全20ステージの通常入力によるクリアを含む。
- 攻撃時間変更後にST16の旧自動操作が敗北。変更前のゲームでは221秒でクリアすることを別実行で確認。自動操作は到達0.6秒前に回避して無敵終了後に被弾しうるため、回避を実衝突直前0.25秒へ修正。敵の見える予兆・飛翔体だけを参照し、プレイヤーHP・装備・敵ダメージはテストのために書き換えていない。修正後に全20面合格。
- 実Workerの4独立接続における標的・予兆・飛翔体一致とスマホ幅WebGLのE2E2件成功。
- 実Renderer: 各種類1/5/10体（4種類混在で計4/20/40体）の材質バッチ数・個体別時刻、World JSON不変、命中時刻、連結炉との共存、cleanup、GLB失敗fallback成功。
- GPUパレットと独立して読み込んだThree.js標準スキニングの頂点差は最大0.00000019m未満。
- productionビルドでST20の通常ソロ出撃、4GLBのSHA-256一致、JS/console error 0を確認。公開後も同じ手順で確認する。

Chrome / SwiftShader / 844×390による検証であり、Android/iPhone実機の性能・発熱測定ではない。見た目の大型化に対し、当たり判定の大きさは従来のゲーム仕様を維持している。

## 証拠 / Git

証拠は `dist-validation/enemies-release/`。`tests.log`、`render-validation.json`、`local-smoke.json`、`published-smoke.json`、`deploy.log`、今回の差分 `changes.patch`、`artifact-hashes.json`。既存の4接続検証結果は `dist-validation/structure-audit-fix/`。

branch=`codex/home-armory`、base/HEAD=`2be699f160c83d641fb68bb1304e4da8059920dc`。開始から多数の未コミット・未追跡差分があり、今回も未コミット。reset/stash/checkout/merge/commit/pushは未実行。今回の主要差分は `structure-motion.ts`、`structure-timing.ts`、`hound-motion.ts`、`render.ts`、`enemy-viewer.ts`、`game.ts`、`bestiary.ts`、`changelog.ts`、`public/.assetsignore`、関連テスト・検証スクリプト。独立Chat監査を受けたという意味ではない。

## 公開完了

2026-09-10、既存Workerへ公開成功。URL: https://swarm-front.melosalife-24.workers.dev

Version: `6e102708-a10c-49ff-b0d0-107f22c7134c`。公開後の4GLBのSHA-256一致、配信JS `/assets/index-CwoZ56YY.js`、ST20ソロ開始、`/api/health`正常、JS/console error 0を確認。実4人通信はローカルの実Workerで検証し、本番4人マッチングは今回未実施。

Cloudflare画面でFree / $0 / Current planを確認。Workers一覧は本作1件、9月1〜10日の表示は109 requests / CPU 100ms。契約・課金設定変更なし。

更新動画のDrive保存は自動承認レビューにより「旧成果物の承認は新規動画payloadに適用されない」として拒否され、未保存。ゲーム公開には影響なし。
