# 自然マップ追加（2026-09-09）

既存3マップに草原・雪山・洞窟を追加し、全6種類を公開済み。20ステージのID・敵編成・報酬設定は維持。

| マップ | ステージ | 地形 |
| --- | --- | --- |
| 風渡る草原 | 2・4・7・17 | 広い草地、低い岩、外周の丘と木々 |
| 白嶺の雪峡 | 13・14・19 | 雪面、左右から張り出す岩壁、背景の雪山 |
| 晶脈の迷い洞 | 10・16 | 細長い主通路、交互に張り出す岩棚、横穴、天井・鍾乳石・結晶 |

自然マップには建物の窓・道路・都市背景を表示しない。移動・射線・ミニマップは共通の岩壁配置を参照。足元の岩形状は矩形の衝突範囲に合わせ、上部は内側へ絞った面で描画する。雪山は平らな峡谷の戦場で、登山や地面の高低差は今回未実装。洞窟は主通路を通じて各横穴へつながる構造で、手続き生成の迷路ではない。

## 検証

- 型検査成功。既存単体124件成功（全20面の通常入力による自動攻略を含む）。追加の通路接続・30シード×全敵種の安全な出現位置検証3件成功、合計127件。
- Chrome 844×390で全6マップの選択・出撃・描画、JSエラーなし。実ローカルWorkersと独立2クライアントの協力同期成功。岩描画の最終調整後に6マップ画面を再検証。
- 配布ビルド、本番Worker dry-run成功。既存の500KB超チャンク警告は残る。
- 公開Chromeで追加3マップへ出撃、ST20出撃、20選択肢、配信JS一致、API health 200 / ok:true、JSエラーなし。
- Android実機、公開環境の協力実プレイ、人間の体感難易度は未確認。

証拠: `dist-validation/stages/map-{2,10,13}.png`、`dist-validation/maps-live/live.json` と `map-{2,10,13}.png`。検証スクリプト: `scripts/check-maps-live.mjs`。

## 公開・監査情報

- URL: https://swarm-front.melosalife-24.workers.dev
- Version: `31d2d3f1-28da-4fe6-aee5-cd45c3908b48`
- 公開JS: `/assets/index-id5EpYmp.js`
- branch: `codex/home-armory`。base / HEAD: `2be699f160c83d641fb68bb1304e4da8059920dc`。commit / push / mergeなし。開始時の多数の未コミット差分・未追跡物を保護。
- 今回の変更: `src/shared/stages.ts` の環境属性・3マップ・9ステージの割当、`src/client/render.ts` の環境別地面と自然物・都市背景切替、`src/client/changelog.ts` の案内。検証変更: `tests/stages.test.ts` の種類数、`tests/maps.test.ts`、`vitest.config.ts`、`e2e/stages.spec.ts`、`playwright.stages.config.ts`、公開確認スクリプト。README・STATE・本書で現行状態を記録。
- 差分の要点: MAPS 3→6、自然環境で窓・道路の描画分岐をスキップ、都市遠景を都市グループ内へ移動。サーバーの戦闘計算変更なし。共有マップ定義のみWorkerにも反映。
