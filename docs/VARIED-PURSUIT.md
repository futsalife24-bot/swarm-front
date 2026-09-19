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

## 独立監査を依頼

[PR48](https://github.com/futsalife24-bot/swarm-front/pull/48)、対象d343f85fb5cd9a9809c3b14de2fdc8ef25b397ba。通常Chat https://chatgpt.com/c/6aae461d-dfe0-83e8-a2a8-387d9826b46f にZIP添付・監査依頼送信済み。pursuit-audit-d343f85.zip: 311480 bytes、SHA256 F3B75837E29D41F2088DF715322D025D052EE0092C472E020746361982659807。commit後build/production dry-runも成功。PR MERGEABLE、チェック一覧空。合格判定/main反映/公開は待機中。

## 監査指摘への修正

初回対象d343f85について監査がstage1建物越しの停滞を再現。crawler id6/size1の(80,-60)→(0,0)/(0,40)、(-80,-90/-60/-30/0)→(20,0)では、固定側の回り込みが壁へ押し続ける。

src/shared/enemy-motion.tsで視線が遮られる場合、または移動半径+1.5mの余裕で障害物に近い場合は既存の時変操舵/距離減衰へ戻す。洞窟の経路探索を優先したまま、開けた場所だけ新軌道を適用。テストは上記6配置で実stepを進め、距離だけでなく実際のプレイヤー被弾を120秒以内に要求し成功。

修正版自己検証: enemies/hornet/maps/gameの82件成功、追加の6配置回帰1件成功。型/build/production dry-run/実Worker2接続成功。iab再確認で6秒と12秒の軌跡/位置は初回と同一、全4体が距離2m未満へ到達、error0。証拠dist-validation/pursuit/fixed-*。Free Current plan、Workers当日73/100000、DO78req/0.205GB-sec/200.7kB/353read/31write/error0確認済み。

再監査対象100114263447801464e1269ffb5fbe7de6286e83。同じ通常Chatへpursuit-reaudit-1001142.zip（SHA256 1BFD8B9C40D331E80F9AD55FD69623F57738361361BA734958DA2672FC721FBF）を添付・送信済み。初回は指摘の途中報告後に最終判定本文が表示されず、他の必須残件を含めた新対象の最終判定を求めた。後続は記録のみ。

初回監査は再読込後に「要修正・必須1件」と確定。最終再現配置stage1 seed11、player(-62,-86)/enemy(-62,-54)、crawler id7・ant id7/8（size1）の3条件も実攻撃到達テストへ追加し、修正版で120秒以内の被弾成功。旧headは監査側600秒攻撃なし。初回追加依頼時のInternal Server Errorにより修正版メッセージは再読込後に消えていたため、確定後に修正版ZIPを再添付して再監査する。ランタイムは1001142から変更なし。

確定版再監査: 552da472644ff65c4fa65fe03b0783c40ca65ee5、pursuit-reaudit-final.zip SHA256 57CCE395C92D51BBE7DFBFC17C345774904DBC5BCA8FFF3A32206A6A5B950133を初回判定確定後に同じChatへ添付・送信成功。後続は記録のみ。
