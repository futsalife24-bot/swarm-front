# 大改装版の自己検証（2026-10-02）

[仕様と旧版保護](REBUILD-PLAYABLE.md)。開始HEAD `32af37c4d025def599ec5d85158ee285c5dfe697`、旧版基準main `4520c57ede444d44b8699753645f36ce479b72bf`。対象の完全SHAは監査ZIPの `MANIFEST.json` とPR115へ固定する。実行モデルID・effortは取得できず未確認、切替なし。主担当1体。

## 結果

|対象|結果・限界|
|---|---|
|新強化・権威進行・独立保存|16件成功。全構成の候補列挙、最大2進化、再抽選・古い/二重要求、共有停止・再開、最終補給、武器標準化、日替わり、誘爆・貫通返却・地雷・迎撃、破損保存・512履歴境界を含む|
|実Worker/WebSocket|3件成功。旧/新部屋の分離、2〜4接続、標準化、個別候補と非公開乱数、配信64KiB上限、15秒の共通停止、切断中の既定選択、再接続、保持入力の破棄|
|新入口の実ブラウザ|3件成功。844×390と640×360で出撃準備・画像3枚・順次アニメーション/動きを減らす設定・再開・旧版セーブ不変。別2画面で共同準備/個別選択/再開/結果保存/再読込|
|共通準備修正後の旧試作画面|844×390の初期3択1件成功、例外・コンソールエラーなし|
|旧P1aロジック|120件成功|
|既存保存回帰|147件成功|
|旧版関連ゲーム回帰|81件成功・既存1件失敗。Stage25のdefeatは基準mainでも再現済み。未修正を全件成功とは扱わない|
|入口のSWキャッシュ保護|2件成功。別HTMLと拡張子省略経路が旧版のオフライン入口を書き換えない|
|型検査|クライアント/Worker成功。自動試遊スクリプト単独も成功|
|配信用ビルド|Vite成功、既存Worker production dry-run成功。本番デプロイではない|
|旧版保護|主要10ファイルのGit blob一致、旧版専用ブランチpush済み、実ブラウザで旧セーブ不変|
|生成画像|追加6点は256×256・透明背景、各角のalphaとSHA256を記録、一覧を目視確認|
|自動試遊|3モード×3系統9回。全回7取得・進化、7成功/2敗北、成功397.65〜421.60秒、初回進化75秒、処理予算超過0。人間の楽しさ・勝率・実機性能ではない|

実ブラウザの結果保存試験は `server/testing.ts` の検証Worker専用 `front-result` を使う。通常のproduction Workerへこのfixture経路は含まれない。実戦完走は別の自動試遊で計測し、両者を混同しない。

## 修正と再確認

協力の2画面試験で背面のホストが兵士1/2で準備期限に達した。`Renderer.render` が背面で処理全体を停止し、後から参加した隊員のモデルを作れなかった。準備中だけ画面描画・通常フレーム間引きを省いてモデル更新を進める引数を追加。戦闘の背面描画停止は既定値を保持。準備世代の取消/直列化と出撃時の読み込み済みモデル再利用も行い、同じ実2画面試験で成功。

共通準備修正後の旧試作試験では、順次表示アニメーションの途中でカードの高さを測って1回失敗した。CSSは未変更。終了を `Animation.finished` で待って同じ横1列・画面内・全幅要件を測り、成功した。

全構成列挙の1回は型/実通信との同時実行で30秒上限を超過。制限と検査内容を変えず単独再実行し16件成功（24.83秒）。既存Stage25の失敗は[基準比較](REBUILD-P1A-VALIDATION.md)へ記録済み。無関係な旧不具合を今回のために隠したり変更していない。

## 再現

```powershell
npm ci
npm run setup:local
npm run typecheck
npm run test:front
npm run server:test
# 別の端末。server:testのローカル検証鍵は.dev.varsから読み、表示しない。
npm run test:front:integration
npm run test:front:e2e
npm run test:rebuild:e2e -- --grep 'initial cards fit one horizontal row at 844'
npm exec -- vitest run tests/briefing-cache.test.ts
npm run test:rebuild
npm run test:save
npm run build
npm run server:build:production
node_modules\.bin\tsc.cmd --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --strict --skipLibCheck scripts/front-pilot.ts
node_modules\.bin\esbuild.cmd ./scripts/front-pilot.ts --bundle --platform=node --format=esm --outfile=../.task-tools/front-pilot.mjs
node ../.task-tools/front-pilot.mjs > docs/evidence/rebuild-p1a/front-20261002/pilot.json
```

自動試遊は既存依存に含まれるesbuildを使用し、依存の追加・バージョン変更なし。ゲームを50ms刻みで進め、完全照準・距離維持・近距離回避・空弾倉時装填・希望系統優先という固定方針。HP・XP・勝利状態を直接変更しない。生入力の照準はサーバーが受け付ける既存座標規則に従う。高精度照準のため人間への難易度を保証しない。発動時刻のカウンターは純粋な貫通追加自体を数えない。

証拠: [一覧](evidence/rebuild-p1a/front-20261002/)、[自動試遊](evidence/rebuild-p1a/front-20261002/pilot.json)、[旧版ハッシュ](evidence/rebuild-p1a/front-20261002/legacy-protection.json)、[生成画像](evidence/rebuild-p1a/front-20261002/icons.json)。詳細ログは作業root親 `.task-tools/front-*.log` に保持。秘密値・依存キャッシュを監査ZIPへ含めない。

## 未確認

物理Androidの10分試遊/発熱、実参加者の楽しさ・人間の協力戦闘、全日付/全構成の難易度、旧SW更新タイミング、新進行の端末間同期（今回実装なし）。独立Chat監査・main反映・本番公開・配信照合はこれから。自己検証を独立監査合格と扱わない。
