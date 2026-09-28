# ボス名称の分離（2026-09-28）

- 移動工場のボス（既存キー boss / crown）：**FOUNDRY ZERO**。
- 多脚・連節ボス（既存キー worm）：**CATENA（カテナ）**。鎖状につながる節構造を名前に反映。
- 両者は独立したANOMALYであり、関連個体・派生・形態違いではない。通常型／連結炉形態の切替を廃止し、既存エネミーレポートの一覧へ別々に登録する。
- 初遭遇演出・ムービー見出し・現行/旧作戦説明を統一。既存の遭遇キー、セーブ、通信、戦闘、モデル/動画パスは維持する。
- 過去の更新履歴・制作記録は当時の名称を保持し、現行仕様の入口3文書に名称分離の注記を追加。

## 対象

GitHub: https://github.com/futsalife24-bot/swarm-front
作業場所: C:/Users/futsa/orca/workspaces/game/lugworm
branch: codex/boss-distinct-names
base: a8d7b86ac5243f851795310627eb6c3546d5fc76

## 検証

- npm run typecheck：成功。
- stages / encounter-camera：40成功、ST25攻略1失敗。変更前baseの隔離コピーでST25を再実行し、同一の128.15秒/78撃破/defeatを確認。名称変更による回帰ではない。戦闘調整は今回の範囲外。
- vitest.save.config.tsのplaytest / playtest-boundaries：15成功。
- UI検証入口：node scripts/check-boss-names.mjs（Chrome、ローカルVite 5359）。検証用セーブのみ遭遇状態を注入し、実ホームボタンから開く。boss/worm双方solo、片方solo、片方coop、双方未遭遇の6条件を844×390 / 667×300で確認する。
- 実ホーム操作のUI24ケース成功。両モデルの読込・攻撃再生、独立した遭遇制限、各ムービー見出し/既存URL、横画面収まりを確認。スクリーンショットを目視確認。追跡証拠: [CATENA 844](evidence/boss-names/catena-844.png) / [FOUNDRY ZERO 667](evidence/boss-names/foundry-667.png) / [24ケース](evidence/boss-names/ui-results.json)。
- ローカル証拠: dist-validation/boss-names/。UI検証は実レンダラーと既存GLBを使用し、協力通信の検証ではない。
- 会敵演出の実再生、物理端末、本番配信は未検証。

## 外部依存

このセッションのツール一覧には指定されたiab/cuaブラウザがない。AGENTS.mdとdocs/skills/swarm-front-audit-release/SKILL.mdの「監査は Codexアプリ内ブラウザ（iab）→通常の新規Chat」に従い、独立監査・main反映・公開は未実施。別ブラウザ監査や自己レビューによる代替はしていない。
再開条件：iabで通常Chatへ監査資料を添付できる環境で、独立監査→必要修正→通常merge→既存Worker公開・配信確認を行う。

実行モデルID・reasoning effort：実設定を取得できないため未確認。切替は行っていない。

## 保存結果

- PR: https://github.com/futsalife24-bot/swarm-front/pull/109 （draft、監査未送信）
- 実装・検証対象HEAD: fdd7332e491ba46bfbb5e3e619a59cc74fe0bab4
- commit後 npm run build：成功（大きなchunk警告あり）。
- 監査資料: dist-validation/boss-names/audit-fdd7332.zip / 1508365 bytes / SHA-256 5b9f6860a7433b93ce7bd0f2e5c71dc61d5ba1128d5bf5654afb062ede564131
- ZIPは当該SHAのソース、差分、検証ログ、UI証拠、未送信の監査依頼本文を含む。変更なしのGLB/動画は未収録で、添付のみの3D再実行不可を明記。
- 以降はこの結果・再開場所の文書記録のみ。main反映・公開は未実施。
