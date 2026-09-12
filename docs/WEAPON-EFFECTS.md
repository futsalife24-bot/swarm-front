# 武器特殊効果・ヘルプ（2026-09-09）

各武器の特殊効果は1枠。SR以上の効果付与率60%は維持し、付与時は次の2候補を各50%で抽選する。
- ライフル: 残弾装填 / 貫通（最大3体）
- ショットガン: 残弾装填 / 撃退散弾
- ロケット: 残弾装填 / 誘爆弾頭
残弾装填は残弾割合×50%短縮。撃退散弾は8m以内の通常敵を最大3m押し戻す（各敵1射撃1回、壁を越えない、ボス無効）。誘爆弾頭は直撃で倒した通常敵の位置で半径3.5m・中心威力50%の追加爆発（距離減衰・遮蔽判定あり、再誘爆なし）。空振り・壁着弾・爆風だけの撃破・ボス撃破では誘爆しない。

ショットガンは散弾ごと最大3体貫通が基本性能。武器種ヘルプに記載し、特殊効果との併用可。旧貫通付きショットガンは保存形式を維持して読込可能、貫通の重複なし、特殊効果欄は「—」。旧高速装填は既存性能を維持、新規抽選なし。基礎性能の説明ボタンは設けない。

変更: src/shared/defs.ts（効果定義・検証・等確率候補）、src/shared/game.ts（抽選・貫通・装填・押し出し・誘爆）、src/client/hud.ts（装填ゲージ）、src/client/weapon-help.ts（ポップアップ）、src/main.ts / src/client/reward-choice.ts / src/mobile-ui.css（表示）、src/client/changelog.ts（更新履歴）、tests/game.test.ts / e2e/armory-ui.spec.ts / scripts/check-effects-*.mjs（検証）。
branch codex/home-armory / base・HEAD 2be699f160c83d641fb68bb1304e4da8059920dc。既存の未コミット作業を保持。今回もcommit/push/mergeなし。

検証: 型チェック成功、全69テスト成功、ヘルプE2E1件成功、実Workers2ソケットで不正専用効果拒否・新効果の装備・残弾装填と再充填・誘爆属性付き飛翔弾の配信を確認。本番画面ビルド成功（既存サイズ警告）、本番Worker dry-run成功。抽選変更で乱数消費が変わりST9攻略テストが一度失敗したため、条件付き一様分布を利用して従来の乱数使用回数を維持し、全ステージ攻略成功を再確認。
証拠: dist-validation/effects-final-tests.log、unique-help.log、unique-network.json。実機Android・公開環境での複数人戦闘は未検証。

ユーザーの「提案の撃退散弾と誘爆弾頭も実装して。公開したらここは終わるよ。」により既存Workerへの公開承認済み。独立監査はSTATE.mdの現行指示により休止中。

## 公開完了
2026-09-09（JST）、既存Workerへ公開。Version c88f74e9-aeb7-4789-932c-883b73fb9417。公開前Version 84395a90-a2a0-4434-a9cb-b06a7cd1014c。配信JS index-C_XrHoc8.js。
公開URL: https://swarm-front.melosalife-24.workers.dev
公開Chrome 1280×720 / 640×280で配信バンドル一致・全3新効果のポップアップ・ショットガン基本貫通ヘルプ・装填ヘルプなし・ソロ出撃・武器切替・API health 200を確認。pageerrorなし。テスト武器は専用の一時ブラウザー内だけに保存し、既存ユーザーの保存には触れていない。
証拠: dist-validation/effects-live/result.json と同フォルダのPNG。

### 表示仕上げ後の最終公開
Version fc839b77-f275-4790-a615-03251903c49b / JS index-C19X5Lqd.js / CSS index-DnuZRlxy.css。
小画面のポップアップは見出し・閉じるを固定して本文のみスクロール。武器名とレア度の重なりも修正。表示E2E再成功（effects-final-layout.log）、本番ビルド成功、同じ公開確認スクリプトで2画面サイズを再確認。前項のVersionは初回公開の履歴。
