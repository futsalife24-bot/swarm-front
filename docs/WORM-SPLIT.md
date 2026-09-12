# 巨大ミミズの分裂戦闘（2026-09-09）

ユーザー依頼: 空中を含めてマップを大回りに蛇行し、各節から酸を発射。通常速度を旧1.4m/sの3倍にし、節の破壊で前後に分裂して各塊がさらに倍速で独立移動する。

## 実装

- 頭＋胴体7節に独立HPと当たり判定。総耐久は従来と同じで各部位に8等分し、人数・ステージ・同時ボス数の補正を維持。
- 通常4.2m/s、部位破壊後8.4m/s。再分裂で速度を無制限に倍増させない。頭だけ・尾だけ・1節だけ残った場合も移動と攻撃を継続。
- 地上／空中を昇降し、屋外では8地点を大回り、地底では既存の環状通路を周回。建物上へ登り、洞窟の天井を考慮。連結した節は3Dで前節へ追従し、破壊箇所を越えて連結し直さない。
- 各生存部位が最寄りの生存プレイヤーへ酸を発射。初撃を0.23秒ずつずらし、その後3.2秒間隔。酸の基礎威力10、既存のステージ補正・回避無敵・遮蔽物判定を適用。移動しながら射撃する。
- 射撃は命中した節へダメージ。ロケットは3D爆風内の節それぞれへダメージを与え、空中から地面の節まで無条件に巻き込まない。
- 破壊箇所を消し、新しい先頭は小型の頭として描画。各節の座標を描画補間し、破壊済み部位をミニマップから除く。
- 各塊は同じボスの状態内で管理し、撃破・ドロップを重複加算しない。全節破壊でボス1体撃破。最後の破壊位置で撃破表示・ドロップ。
- 通常型クラウンの移動・攻撃を維持。敵レポートと更新履歴に新しい巨大型の説明を反映。

## 検証

- `npm test`: 138件合格。全20面の通常入力自動攻略と、導入6面の初期装備攻略を含む。部位破壊、再分裂速度上限、最後の1節、報酬重複防止、全節の狙撃酸、空中爆風、地形衝突、洞窟周回、スナップショット再生を検証。
- `npm run typecheck`: 合格。`npm run build` / `build:pages`: 合格。
- `npm run test:e2e -- --config=playwright.enemies.config.ts`: 3件合格。2台の独立Chromeと実ローカルWorkersで破壊節HP・残存節・両塊の移動を共有。PC 1280×720、タッチ844×390。画面例 `dist-validation/worm/coop-split-1.png`。
- 旧E2Eが廃止済み招待入力欄を探して失敗したため、現行の招待リンクコピー操作へ更新。テスト専用Workerの分裂初期状態は本番に含めない。
- 自動操縦は生存部位を照準対象とし、洞窟で動く目標の経路を毎フレーム選び直して往復するケースを短時間の経由地点保持で解消。HP・時間・報酬の改変なし。
- 証拠: `dist-validation/worm/` のテスト・型・ビルド・E2Eログ、flight.png / split.png / coop-split-0.png / coop-split-1.png。
- 人間による難易度調整とAndroid実機での操作感は未評価。

## 監査用情報

branch `codex/home-armory`。base / HEAD `2be699f160c83d641fb68bb1304e4da8059920dc`。開始時から多数の未コミット差分・未追跡物があり保護。今回commit / push / mergeなし。

主な変更: `src/shared/worm.ts`（新規の部位状態・周回・追従・酸）、`game.ts`（命中部位・個別HP・爆風・全節撃破）、`enemy-motion.ts`（旧胴体追従を移管）、`render.ts` / `minimap.ts`（分裂表示）。説明: bestiary.ts / changelog.ts。検証: tests/enemies.test.ts / tests/bot.ts / e2e/enemies.spec.ts / server/testing.ts。

開始時点からの実差分は `dist-validation/worm/game.diff`、`render.diff`、`motion.diff`。既存の未コミット変更を含むHEAD差分とは区別する。

## 公開状態

2026-09-09 ユーザーの「承認する、公開反映して」に基づき既存Workerへ反映済み。

- URL: https://swarm-front.melosalife-24.workers.dev
- Version: 50380a01-ab16-486a-8c40-460e2b7a24d8
- 配信JS: /assets/index--Dw67SR0.js
- 検証済みファイルはmanifestのハッシュと全件一致。追加のゲーム実装変更なし。
- 公開ChromeでST10・16・20の出撃・描画、20ステージの選択肢、配信JS一致を確認。ページ200、API health 200 / ok:true、JSエラーなし。
- 証拠: dist-validation/worm/deploy.log、live/live.json、live/map-10.png、live/map-16.png、live/live-map20.png。再確認スクリプト: scripts/check-worm-live.mjs。

前回は自動承認レビューで公開前に停止。今回の明示承認後にデプロイ成功し、承認待ちは解消。
