# 全モンスターのサイズ1.5倍（2026-09-19）

branch: codex/monster-size-150 / base: 4d92ce4956bb768c7154727cda5036a1630541ce。

通常敵・ボス・連結型・増援・訓練標的の体と当たり判定を一律1.5倍。個体差の並びと比率は維持。サイズ変更の依頼としてHP・攻撃力・移動速度・攻撃間隔は従来値を保つ。保存/通信のsizeは従来の個体係数のままとし、enemySizeは空間用、enemyStatSizeは能力用に分離。目線/発射位置/胴体間隔/増援配置も空間倍率に追従。図鑑は原寸標本を自動フィットする既存表示のまま。

自己検証: 型チェック成功。関連7ファイル140単体、structure-v2の戦闘等22単体成功。structure-v2の更新履歴テスト1件は既存の__AUTO_CHANGELOG__未定義で失敗（vitest.config.tsにdefineなし、当該テストとchangelogは今回未変更）。その1件のみ除外して関連戦闘検証を実行。全20ステージの6種描画倍率・連結型倍率3・頭部位置・素材ロードを実Chromeで確認しpageerror0。stage4/6画像を取得、stage6画像を目視確認。実Worker/2WebSocketで頭破壊→増援3体・残胴体6・両端snapshot一致成功。npm run build成功、server:buildはsandboxで親ディレクトリ/ログ権限エラー後、許可された実行で成功。

証拠: dist-validation/enemy-size/{browser.json,network.json,stage-4.png,stage-6.png}（2026-09-19再生成）。実スマホ・全ステージ通しクリアは未確認。独立監査・main反映・公開は後続。

## 保存・独立監査

実装/監査対象 ce32074d00a691cea9aa389b0f3e2f6d71f43eb8、[PR47](https://github.com/futsalife24-bot/swarm-front/pull/47)。ZIP monster-size-audit-ce32074.zip（1,714,677 bytes、SHA256 03EF4D287CDC27BBDA30C7CF080A0186676E037C004A75EB3CADB1F0D089551B）を[通常Chat](https://chatgpt.com/c/6aadde07-faa0-83ee-aa64-f32cf605ae01)へ添付・送信済み。production dry-runも成功。Free Current plan、Workers当日2/100,000確認。判定待ち。
Durable Objects当日: Requests2、0.041GB-sec、SQL204.8kB、読取9/書込3、エラー0。既存無料枠内。

## 独立監査合格

通常Chatの対象ce32074は合格・必須0。後続ca63d13は記録のみで実装同一と監査側も確認。共有TSの独立コンパイル/能力値/スポーン/20ステージ移動検証。Vitest一式は監査環境の依存導入タイムアウトで未再実行。任意注意: 地形移動用半径は従来の固定値を維持しており、stage6 spiderの壁張り付きで拡大後の射撃hit sphereが壁へ重なる（従来から個体差を移動半径に反映しない設計）。物理クリアランス変更は別範囲。実機/全通し/旧client混在は未確認。
