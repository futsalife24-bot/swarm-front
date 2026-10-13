# 自己検証

実装対象 `4f3c6634765fff08d00833e4dfa7df7829cadd51`。base `0ec79b0b702aba6be4a4d0b3d7a35321834ad5b1`。PR https://github.com/futsalife24-bot/swarm-front/pull/178

- `tsc -p tsconfig.json` / `tsc -p tsconfig.worker.json`: 成功。後続の音量変更はPython生成元とWAVだけ。
- `vitest run tests/anomaly-voice.test.ts tests/anomaly-audio-lifecycle.test.ts --maxWorkers=1`: 最終16件成功。WAV検査をゲームで使うパスから読むよう変更。
- `wave-check.json`: 18WAVのPCM・端点・ピーク・ハッシュ一致、16声は保存音声と再生成PCMが完全一致。
- 最終実装commit後の `vite build`: 成功。
- そのビルド後に `wrangler deploy --dry-run --config wrangler.production.jsonc --outdir dist-worker-production`: 成功。環境変数表示は公開用証拠から除外。
- `git diff --check`: 成功。

## 実ブラウザ

Chrome、PC内の一覧 `http://127.0.0.1:5203/anomaly-voices.html`。最終音量調整後に新規タブで再取得。

- 26音声（改訂16・旧版8・混合2）すべてreadyState=4、読込エラーなし。
- 2声比較の再生時刻11.145118秒への進行を確認。その途中で4声比較へ切り替え、前の音声はpaused=true/currentTime=0。4声比較は7秒終端へ到達。
- 844×390の横画面で、見出し・説明・2つの比較プレイヤーに横はみ出しや重なりなし。比較は折りたためる。旧版も各カードで折りたためる。検証後viewportを解除。
- 原稿の初回タブは再読込で操作時間切れになったが、新しいタブで回復した。ブラウザ画像はツール出力で目視し、PNGファイル保存とは区別。

## 限界

主担当は音の質を実聴で採用判定していない。数値差・正常再生は「群れで確実に聞き分けられる」の証明ではない。本人の聴感採用、実スマホ、戦闘SEを混ぜた聴感は未確認。4声同時は実ゲームの最大2声とは異なる厳しい試聴用の条件で、左右の定位差は使わない。

攻撃・モデル・発声制御は変更しておらず、その全件テストを反復していない。既存の通常弾renderテスト失敗も本変更には含めない。

## 監査経路

同じANOMALYボイス依頼への本人フィードバックに対応する追加修正。通常経路のiab新規ChatはCloudflareの「私はロボットではありません」で停止し、確認操作は行っていない。今回の同じANOMALY改修に対して本人承認済みのChrome通常Chat監査へ追加提出する。監査URL https://chatgpt.com/c/6acdaec0-6ddc-83ee-98d5-8c96c0c6955e 。旧版PASSは新版へ流用しない。
