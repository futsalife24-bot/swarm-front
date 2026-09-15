# 敵バリエーション（2026-09-09、ローカル実装）

- 蟻: HP85、速度4.1、噛みつき8ダメージ。18m以内で予告後に酸を3方向へ射出。近距離は噛みつき。橙色の腹部・触角で区別。
- 蜘蛛: HP95、速度4.8、接触15ダメージ。跳躍は0.9秒・最高約3.5m。建物外側で1.2秒張り付き、離脱後7秒は再張り付きしない。8本脚・紫色・壁面で縦向きになる姿勢。
- 蜂: 従来の飛行・降下を維持し、24m以内から予告後に速度19の針を発射。高さを含めて狙う。壁の外側で2.2秒静止、再静止まで7秒。
- 巨大ミミズ: ST5/10の最終ボスを頭＋7節にする。胴体が前節を追従し、建物内への移動を防ぐ。頭と胴体でHPを共有し、射撃・ロケットが胴体にも当たる。1発が複数節に重なっても同一ボスへ重複加算しない。既存の予告付き範囲攻撃・撃破時勝利を使用。

通常波の抽選: WAVE1はspitter35%・蟻20%・蜘蛛20%・crawler25%。WAVE2/3は蜂20%・spitter15%・蟻20%・蜘蛛20%・crawler25%。総数・HPの人数倍率・ステージ倍率・報酬は維持。

敵弾は高さと遮蔽物を判定し、上空通過や壁への着弾ではプレイヤーを傷つけない。移動・張り付きタイマー・胴体座標は共有戦闘処理で更新し、Workersが配信する。既存Worldに新しい任意フィールドがない場合も動作する。モデルはThree.jsの既存形状から作成。外部モデルサービスなし。

## 検証

- `npm run typecheck`: 合格。
- `npm test`: 9ファイル80件合格。全10ステージを規定内の終盤装備と通常入力で攻略。蟻の散弾・噛みつき・回避、蜂の降下方向の針・高所弾の非接触、壁張り付きと離脱、蜘蛛のジャンプと着地、ボスの胴体への射撃を追加検証。
- 攻略用の自動操縦は新しい飛び道具への回避を追加。初回はST8のボス戦で敗北し、操縦側の対応後に全ステージ合格。人間の初見難易度の保証ではない。
- `npm run build`: 合格。既存の500KB超チャンク警告あり。
- `npm run server:build`: ローカルdry-run合格。最初はサンドボックスの親ディレクトリ読取・ログ書込制限で失敗し、権限付きで成功。
- `npm run test:e2e -- --config=playwright.enemies.config.ts`: 2件合格。実ローカルWorkers＋独立したPC/スマホ幅Chromeで全敵種・ST5・7節・HUDを受信して描画。隔離fixtureで準備を短縮しており、通信越しの通し攻略を意味しない。
- 画像: `dist-validation/enemies/coop-0.png`, `coop-1.png`, `silhouettes.png`, `poses.png`。描画用fixtureを含む。Android実機・人間による体感調整は未確認。
- 壁姿勢の修正後、`npm run test:e2e -- --config=playwright.enemies.config.ts --grep 'visual fixture'` 1件合格。画像を開き、蜘蛛の縦向き・蜂の壁際静止・PC/スマホ幅の表示を目視確認。
- `git diff --check`: 合格。

## 監査用の変更範囲

- branch: `codex/home-armory`
- base / HEAD: `2be699f160c83d641fb68bb1304e4da8059920dc`。コミットなし。
- 開始時から武器庫・ステージなどの未コミット／未追跡変更あり。既存作業の上に追加しているため、HEADとの差分全体には今回以外の変更も含まれる。
- `src/shared/enemy-motion.ts` 新規、`defs.ts` / `game.ts`: 敵定義・行動・出現・胴体の当たり判定。
- `src/client/render.ts` / `minimap.ts` / `hud.ts` / `changelog.ts`: 形状・姿勢・胴体表示・ボス名・更新履歴。
- `tests/enemies.test.ts` 新規、`tests/bot.ts` / `vitest.config.ts`: 戦闘検証と自動操縦。
- `server/testing.ts` / `e2e/enemies.spec.ts` / `playwright.enemies.config.ts`: 本番入口から参照されない専用fixtureと協力・描画検証。
- 本番公開、commit / push / merge、独立監査は未実施。

## 公開完了（2026-09-09）

ユーザーの「公開して」で既存本番Workerへ反映。上記の「本番公開は未実施」はローカル実装完了時点の記録。

- 本番ビルド・本番設定dry-run合格後、`wrangler deploy --config wrangler.production.jsonc` 成功。
- Version: `40c7b99e-4fd1-4149-a438-669defe2f08e`。直前の記録: `6f975988-be05-47e0-abab-4fb717e53b89`。
- URL: https://swarm-front.melosalife-24.workers.dev
- 本番Chrome: HTTP200、新JS `index-BrgXD9un.js`、10ステージの選択肢、ST10のソロ出撃を確認。`/api/health` は200 / ok:true、JSエラーなし。
- 証拠: `dist-validation/enemies/live.json`, `live-select.png`, `live-map10.png`。確認スクリプト: `scripts/check-enemies-live.mjs`。
- 本番環境での協力通しプレイ・Android実機・体感調整は未確認。協力通信の検証は前述のローカルWorkersで実施。
- branch / HEADは上記のまま。commit / push / mergeなし。
