# 回避ローリング（2026-09-09）

実装・公開済み。

- 自キャラと味方の既存回避状態に合わせ、胸元を中心に一回転。脚を引き寄せ、武器を抱える。
- 開始時のサーバー上の移動方向を回転軸へ変換。停止時・壁で動けない時は向いている方向を使う。途中の視点変更では回転軸を変えない。
- 20Hz更新間も描画フレームで補間。ソロ一時停止時は止まる。終了・ダウン・次の出撃で姿勢をリセット。
- 回避時間0.32秒を定数化。速度・無敵時間・クールダウン・入力・通信形式は維持。移動入力なしの場合は、その場で回転する。
- カメラは位置のみ追従し、体の回転には追従しない。

検証: `npm run typecheck` 成功、`npx vitest run tests/render.test.ts tests/game.test.ts` 39件成功、`npm run build` 成功（既存の500KBチャンク警告あり）。Chrome実画面で通常のD＋Space入力による回避開始・回転中・復帰を1280×720と844×390で確認。ブラウザ例外なし。Android実機・実通信での味方の見え方は未検証。

再実行: `npm run dev -- --port 5302 --strictPort` 起動後、`node scripts/check-rolling.mjs`。
画像と結果は `dist-validation/rolling/`。`task.patch` は着手前の既存差分と分離した今回分の差分。

Git: branch `codex/home-armory`、base/head `2be699f160c83d641fb68bb1304e4da8059920dc`。コミットせず、既存の未コミット変更を保持。

## 公開確認

- ユーザーの「公開して」に基づき既存Workerへ公開。
- Version: `a7fc7dff-b0d2-4981-a19a-074caf4d7655`。直前Version: `5fba86f1-6dc6-4431-bf53-76f533e67032`。
- URL: https://swarm-front.melosalife-24.workers.dev
- 配信JS: `index-QpO14rm5.js`、CSS: `index-IPAhzuqm.css`。
- 変更前ソースの隔離ビルドは公開前の静的6ファイルすべてとバイト・SHA256一致。Worker差分は回避時間0.32秒の定数化だけ。公開用dry-run成功。
- 公開Chromeで1280×720、844×390のソロ出撃・回避入力・回転・姿勢復帰を確認。ページ200、配信JS一致、API health 200/ok:true、pageerrorなし、開発診断変数なし。スクリーンショット目視確認。
- 初回ブラウザ検証はクリック後のナビゲーション待機でタイムアウト。待機条件修正後に両画面の検証が正常終了。
- 証拠: `dist-validation/rolling/{baseline-live-comparison.json,worker-live-comparison.json,live-worker-before.js,check-live.mjs,live-browser.json,live-*.png}`。Worker比較JSONの不一致は上記の定数化によるもの。
- Android実機・公開協力プレイは今回未検証。commit/push/mergeなし。
