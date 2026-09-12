# ミニマップ範囲外の敵（2026-09-12）

範囲外の敵を方向を維持して外縁へ投影。回転表示は円周、固定表示は矩形の縁に配置する。飛行敵の輪の線幅とワーム各節の半径を含めて内側へ余白を取り、欠けを防ぐ。

今回の実装差分は `src/client/minimap.ts` の `enemyAt` 追加、敵本体と節の座標取得を `at` から `enemyAt` に変更した部分。既存のマップ・敵種・節表示など未コミット差分は保持。

検証: `npm run typecheck`、`npm run build:production`、`npm run server:build:production` 成功。`node scripts/check-minimap-rim.mjs` は実Chromeで固定/回転、4角度、DPR 1/2の16条件・256マーカーの方向と外縁一致を確認。画像も確認済み。証拠: `dist-validation/minimap-rim/checks.json` と `rim.png`。公開版は `node scripts/check-retreat-published.mjs` で配信JS一致、ST16/20の出撃・撤退・再出撃、JSエラーなし、API正常を確認。実スマホ操作は未確認。

公開: https://swarm-front.melosalife-24.workers.dev

Version: `ffd2bf52-64f7-4bb9-80a4-5117aec29d99`。JS: `index-CfuDYMP1.js`。

branch: `codex/home-armory`。開始/終了HEAD（変更なし）: `2be699f160c83d641fb68bb1304e4da8059920dc`。今回分は未コミット。追加ファイル: 検証用 `scripts/check-minimap-rim.mjs`、本記録。状態索引: `docs/STATE.md`。
