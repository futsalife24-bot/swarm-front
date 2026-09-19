# モンスターの接近軌道を多様化（2026-09-19）

branch codex/varied-monster-pursuit / base fcf37f151858aa2fc7ebdee420f36b0ba43026eb。

通常地上敵は個体IDにより左右の継続的な弧状接近、周期的な蛇行、正面寄りの追跡を混在させる。蜘蛛は跳躍時に一定の側へ強めに回り込み、通常ボスは緩く回り込む。3m以内（蜘蛛1m）で横成分をゼロへ減衰し、接近を継続。飛行敵は既存の近距離旋回と追跡速度を保つため従来の操舵。洞窟の経路探索と連結ボス専用移動は維持。壁を探索して迂回する新しい経路探索ではなく、対象に対する接近軌道の多様化。能力値・休眠/索敵・攻撃/通信形式/乱数系列は変更しない。

変更: src/shared/enemy-motion.ts、tests/enemies.test.ts、e2e/pursuit-fixture.html。fixtureは開発用で本番ビルド入口ではない。

自己検証:
- npm run typecheck 成功。
- enemies/game/structure-motion/structure-v2: 97成功、更新履歴1失敗。既存__AUTO_CHANGELOG__未定義（前タスクから記録済み）。当該1件だけ除外したstructure-v2は22成功。
- enemies/hornet/maps/state-wire: 飛行敵を新軌道に含めた初期案で追跡1件失敗。飛行敵を従来操舵へ戻しenemies/hornet41件再検証成功。maps/state-wireの9件成功。重複を除いた関連114件成功。
- 単体で左右の継続、蛇行の左右切替、前進成分、方向の正規化、攻撃距離到達、snapshot再現を確認。蜘蛛の比較は未使用の操舵キャッシュ値から実際に返す角度へ変更。
- iabでfixture実step/実Rendererを確認。6秒で左右に回り込み、12秒で4個体とも距離2m未満へ到達、active維持、browser error0。証拠 dist-validation/pursuit/{six-seconds.png,twelve-seconds.png,browser.txt}。
- node scripts/check-enemy-size-network.mjs: ローカル実Worker/2WebSocket、通常inputによる頭破壊・増援3体・両端snapshot一致成功。既存fixture利用の通信回帰確認であり、全移動様式の通信での個別検証ではない。証拠 dist-validation/enemy-size/network.json。
- npm run build / npm run server:build 成功。Workerはsandboxのログ/親フォルダー読取制限後、許可された通常実行で成功。

未確認: 実スマホ、全ステージ通しプレイ、動く標的に対する全個体の追い切り。横移動により直進より到達時間は長くなる。独立監査/main反映/公開は後続。
