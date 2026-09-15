# 残弾装填（2026-09-09）

全3武器種の新規ドロップに特殊効果 reserve（残弾装填）を追加。効果は既存の単一effect枠を使うため他の特殊効果と重複しない。新規のquick抽選をreserveに置換、既存quickの性能・保存互換は維持する。

リロード開始時の残弾割合×50%を短縮。半分なら25%短縮、空なら短縮なし。満タンではリロード不可。個体差の装弾数・装填時間を使い、武器切替で中断、装填中に連打しても開始時間を更新しない。共通戦闘計算とHUDの円形ゲージで同じreloadDurationを使う。性能欄は空からの時間を表示し、説明は特殊効果名からだけ開く。

変更ファイル: src/shared/defs.ts（定義・時間計算）、src/shared/game.ts（抽選・装填開始）、src/client/hud.ts（ゲージ）、src/client/weapon-help.ts（説明）、tests/game.test.ts（戦闘・保存・抽選）、e2e/armory-ui.spec.ts（説明操作）。
branch codex/home-armory、base/HEAD 2be699f160c83d641fb68bb1304e4da8059920dc。既存差分を保持、未コミット、未公開。

検証: typecheck成功、npm test 62件成功（8ファイル）、build成功（既存サイズ警告）、server:build dry-run成功、ヘルプE2E 1件成功。server:build初回はサンドボックスアクセス制限で失敗し、許可された昇格実行で成功。実通信を使った残弾装填の協力E2Eは未実施。
証拠: dist-validation/reserve-tests.log、dist-validation/reserve-help.log。実装差分要点: 新規抽選quick→reserve、開始時間stats.reload→reloadDuration(weapon, ammo)、effectは単一値のまま。

今後の方針案: 共通効果と武器種専用効果のいずれか1つ。残弾装填以外の新規効果・分類抽選は未実装。
