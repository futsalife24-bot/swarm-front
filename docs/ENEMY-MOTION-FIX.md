# 敵の接地・移動修正（2026-09-09）

実装・自己検証済み。ユーザーの「公開して反映して」の明示承認後、既存Workerへ公開済み。

- 共通: 地上・壁静止時の上下揺れを除去。接地高度を即時反映。
- 蟻: 移動中だけ6脚を交互に前後・持ち上げる描画を追加。待機・攻撃予告中は静止。
- 蜘蛛: 通常歩行を停止。0.9秒のジャンプと0.65秒の着地待機で移動。攻撃タイマーとジャンプ待機を分離。回り込み角度は他の敵より大きく、近距離にも適用。
- 蜘蛛・蜂: 壁面の四方向を考慮した回転順序で脚側を壁へ向ける。描画の脚元を壁面へ合わせ、建物角・屋根端から2.5mの余白を確保できない位置への張り付きを禁止。
- 蜂: 距離7m以内で必ず降下する処理を廃止。3.5秒ごとに個体別の高度を選ぶ（85%は4.5〜11.5m、15%は1.8m）。障害物回避を優先。高所では近距離でも針を発射。

## 検証
- 型チェック成功、単体97件成功。旧「近づくと必ず降下」テストは新仕様へ更新。
- 地上での蜘蛛静止、回り込み量、壁四面・角の拒否、蜂の接近時高度維持・高度変化・高所近距離針攻撃を検証。
- 実ローカルWorker＋独立Chrome2画面の受信・描画が成功。
- ブラウザ描画fixture: 接地高度不変・蟻の脚用属性と移動フラグ・壁姿勢を確認。画像も目視確認。
- 本番画面ビルド成功。Worker dry-run成功（高度乱数の最終分散調整前）。最終調整後は型・全単体・画面ビルド成功。
- 最初のWorker dry-runはsandboxのログ・親ディレクトリアクセス制限で失敗。検証用権限で成功。
- 最初の姿勢fixtureはブラウザ内のbare importが解決できず失敗。既存行列のcloneを使い、当該ケースの再実行成功。
- 既存の500KB超バンドル警告あり。Android実機・人間による体感調整は未実施。

## 差分・証拠
branch: codex/home-armory。base / HEAD: 2be699f160c83d641fb68bb1304e4da8059920dc。既存を含む未コミット・未追跡変更あり。commit / mergeなし。
今回の主変更: src/shared/enemy-motion.ts、src/shared/game.ts、src/client/render.ts、src/client/changelog.ts、tests/enemies.test.ts、tests/hornet.test.ts、e2e/enemies.spec.ts、playwright.enemies.config.ts（検証保存先）、docs/STATE.md、本書。
開始時からの主差分: dist-validation/enemy-motion-fix/task.diff。開始時ファイルも同フォルダに保存。
画像: dist-validation/enemies/poses.png、silhouettes.png、coop-0.png、coop-1.png。
配布候補: dist/assets/index-BWJPNqDC.js。

## 公開
最初の公開は自動承認レビューが明示承認を確認できず拒否。その後、ユーザーの「公開して反映して」の明示承認を受けて公開成功。
Version: d5685d83-402b-4cf9-b459-68103f964ab1。
URL: https://swarm-front.melosalife-24.workers.dev
公開JS: /assets/index-BWJPNqDC.js。
PC 1280×720 / スマホ幅844×390のChromeでHTTP200、ソロ開始、ライフル・ロケット射撃、API health 200 / ok:true、pageerrorなし。
配信JSと検証済みローカル成果物のSHA256一致: a18a12af3d3093315d2025ea6fe11380b2331083e929517cf35f71d0809c6f2f。
公開確認スクリプト: scripts/check-enemy-motion-live.mjs。
証拠: dist-validation/enemy-motion-fix/live/result.json と同フォルダのPNG。Android実機・人間の体感評価は未実施。
