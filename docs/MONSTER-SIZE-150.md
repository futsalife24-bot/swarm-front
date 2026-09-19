# 全モンスターのサイズ1.5倍（2026-09-19）

branch: codex/monster-size-150 / base: 4d92ce4956bb768c7154727cda5036a1630541ce。

通常敵・ボス・連結型・増援・訓練標的の体と当たり判定を一律1.5倍。個体差の並びと比率は維持。サイズ変更の依頼としてHP・攻撃力・移動速度・攻撃間隔は従来値を保つ。保存/通信のsizeは従来の個体係数のままとし、enemySizeは空間用、enemyStatSizeは能力用に分離。目線/発射位置/胴体間隔/増援配置も空間倍率に追従。図鑑は原寸標本を自動フィットする既存表示のまま。

自己検証: 型チェック成功。関連7ファイル140単体、structure-v2の戦闘等22単体成功。structure-v2の更新履歴テスト1件は既存の__AUTO_CHANGELOG__未定義で失敗（vitest.config.tsにdefineなし、当該テストとchangelogは今回未変更）。その1件のみ除外して関連戦闘検証を実行。全20ステージの6種描画倍率・連結型倍率3・頭部位置・素材ロードを実Chromeで確認しpageerror0。stage4/6画像を取得、stage6画像を目視確認。実Worker/2WebSocketで頭破壊→増援3体・残胴体6・両端snapshot一致成功。npm run build成功、server:buildはsandboxで親ディレクトリ/ログ権限エラー後、許可された実行で成功。

証拠: dist-validation/enemy-size/{browser.json,network.json,stage-4.png,stage-6.png}（2026-09-19再生成）。実スマホ・全ステージ通しクリアは未確認。独立監査・main反映・公開は後続。
