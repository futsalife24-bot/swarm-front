# 協力プレイの敵補間と描画範囲の復元（2026-11-17）

対象: https://github.com/futsalife24-bot/swarm-front 、ブランチ `codex/coop-smooth-20261117`。
開始点はfetchした `origin/main` の `bce1d032c6e759fa7ff72e1dde413ab55d7d53f1`。作業場所は `C:/Users/futsa/swarm-coop-smooth-20261117`。本人指定により草稿PRまで。merge・デプロイは禁止、未実施。

## 敵の動き

`server/room-clock.ts` の50msステップ、`server/worker.ts` の2tickごとのbroadcastにより通常配信は100ms間隔。状態フロー制御・混雑・処理負荷で実際の間隔は伸びる。`FrontNetwork` はチャンク/差分/省略復元後に最新Worldを渡し、`front-app.ts` が即置換していた。`render.ts` は各フレームで最新位置へ指数平滑化（係数12）するだけで履歴がなく、受信の揺れを速度の揺れとして描く。往復遅延表示は描画補間用の時刻ではない。`clockOffset` はUI等のサーバー時刻用途として維持。

協力戦闘中だけ `FrontEnemyMotion` に位置履歴を受信し、シミュレーション時刻と `performance.now()` で150ms遅らせた位置を補間する。受信停止中の外挿は100ms上限、その後は停止。履歴12件上限、run/時刻巻戻り/1秒超の受信途絶/選択画面/退出/再接続で初期化。姿勢角は最短回転、節も補間。新規/消滅/切断/大きな移動/形態変更は最新状態を優先。HP・被弾・攻撃状態・イベント・当たり判定・自キャラ入力/予測・カメラは権威状態のまま。敵種類・造形・モーション資産・レポート仕様は変更なし。レポートはこの協力受信経路を使わず、専用プレビューの動作変更なし。

150msの表示遅延を追加する選択。無制限の先読みはせず、長い回線停止や低FPS自体の解消は保証しない。爆発時のRTT上昇原因がサーバー/回線/端末のどれかは今回の本人報告だけでは特定できない。

## 画面の拡縮

`Renderer.resize()` はCSS画面寸法でcanvasサイズ・カメラaspect・照準中心を計算し、内部解像度だけに `min(DPR,1.5) × quality × adaptiveQuality.scale` を適用する。ここにDPR二重乗算の根拠はなく、計算式は変更しない。

`prepareBattle()` はGPU準備の全工程前にviewport/scissorを保存し、awaitを挟んだ複数の準備描画ごとに古い値を復元していた。GPU待機中のresize後、次の準備描画で古いviewportへ戻す競合を確認。canvasとカメラは新サイズなのに描画範囲が旧サイズになり、拡縮/位置ずれを生む。保存を各同期描画の直前へ移し、最新の範囲を復元する。例外時のfinallyによる復元とscissor状態保護は維持。

この競合は旧コードの隔離実行で失敗、修正版で合格することを確認した不具合で、友達の端末で同じイベント順が起きた記録はない。友達のOS・ブラウザ・DPR・ズーム倍率・画面寸法・読み込み中のresize履歴は未取得。

## 検証

- `tests/front-enemy-motion.test.ts`: 100ms配信/70〜286ms相当RTT揺れ/受信途絶/重複時刻/新規個体/形態・節/権威状態非破壊を確認。一定速度5m/sの合成移動では新処理の速度幅0.001m/s未満、旧指数平滑化は5m/s超の幅となる条件を再現。合成試験を実回線の体感と同一視しない。
- `tests/front-local-motion.test.ts` の既存20件を含め、関連3ファイル27件成功。自キャラ予測コード変更なし。
- `tests/front-viewport.test.ts`: GPU準備の中間へresizeを挿入し、1280×720のviewport/scissor復元・一時状態解除を確認。
- `scripts/check-coop-smooth-live.mjs`: ローカルの実Wrangler Worker/FrontNetwork/AIを2人接続。片道143msのWebSocket shaper、ゲストは実Chrome D3D11描画、ホストは通信のみ。15秒で各85状態受信、ゲスト899フレーム、うち敵表示778フレーム、画面例外/GLエラー0、敵の表示位置と権威位置の差を確認。`live.json` は結果（部屋ID・トークン・キーを含まない）。人間の操作感/公衆回線/実スマホは未検証。
- 初回のlive検査器は支給武器2個の必須条件を満たさず失敗し修正。2画面SwiftShaderでは状態11回/15秒・最大受信間隔約4.66秒となり検査不合格（`failed-software-dual.json`）。描画負荷を分離してD3D11ゲストのみへ変更。検査器の必須damage DOM不足も修正し、最終検査は上記のとおり成功。失敗を製品側の修正成功と扱わない。

全件・型・build・9画面条件の確定結果は下へ追記する。

## 担当

主担当の実モデルID/推論設定は取得不可、未確認。補助担当は `gpt-6-sol` / `medium` を指定し、画面拡縮の調査・局所修正・関連検査を委任（実ランタイムID未確認）。独立Chat監査は追加していない。

- 実Chromeの844×390/1280×720/1920×1080 × DPR1/2/3、9条件を各品質1/0.65で測定して全件合格。CSS矩形/内部解像度/viewport/aspect/照準中心一致、pageerror 0。`scripts/check-viewport-resize.mjs` と `viewport.json`、代表2画像に保存。DPR2/3とも既存の1.5倍上限を確認。ブラウザのズーム操作/物理モニタ間移動/実スマホは未検証。
- `npx vitest run --config scripts/vitest.viewport-baseline.config.ts` は、作業木を変えずbase版のbattle-loading.tsだけを読み込む負の対照。1280×720へ変更後も844×390が復元される期待どおりの失敗を確認。通常の `npm test` にこの負の対照設定は含まれない。
- `npm test`: 全197ファイル・2,025件合格（464.53秒）。`npm run typecheck` 成功。`npm run build` 成功（335 modules、18.50秒）。`git diff --check` 成功。旧UI前提の既存全件E2Eは本人指定で対象外、未実施。
- 途中のlive検査器は必須damage DOM不足でも失敗し、既存Rendererの前提に合わせて修正してから合格。Viewport検査のVite起動待ちはタイムアウトしたためesbuild直接bundleへ変更して合格。これら検査器の失敗は製品不具合修正の成功扱いにしていない。

## 再実行

既存依存を使い、ローカル専用 `.dev.vars` は秘密値を表示せず `node scripts/setup-local.mjs` で準備。`npx wrangler dev --local --config wrangler.test.jsonc --ip 127.0.0.1 --port 8796 --persist-to .wrangler/coop-smooth` を別プロセスで起動後、`node scripts/check-coop-smooth-live.mjs`。5186/8796/5198が他作業で使用中なら占有者を止めず、検証側のポートを調整する。画面測定は `node scripts/check-viewport-resize.mjs`。生成出力はGit除外のdist-validation以下。

主担当の実モデルID/effortは未確認。画面担当へ `gpt-6-sol` / `medium` を指定（実行側設定の独立確認は未実施）、主担当が差分・測定JSON・画像・負の対照を確認。独立Chat監査ではない。

草稿PR: https://github.com/futsalife24-bot/swarm-front/pull/369 。製品変更7c6389c7、記録整理720fa329でcommit後build成功。最終の文書PR参照追記は製品変更なし。
