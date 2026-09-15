# 攻撃エフェクト（2026-09-09・ローカル実装）

- 酸: 蟻・酸吐きの酸に重力12m/s²を追加。発射時の狙い位置へ放物線で降下し、地面・壁・プレイヤーへの衝突で消滅。濡れた粒の陰影、小滴の尾、着弾時の飛沫と短い地面の輪を描画。残留ダメージは追加していない。蜂の直進弾は維持。
- ライフル・散弾: 全射程を結ぶ線を廃止し、短い弾を150m/sで描画。銃口の閃光を追加。ダメージ計算は既存の即時判定のまま。
- ロケット: 細長い弾体、排気の炎と煙、濃淡のある炎・上昇する煙を追加。衝撃波の輪は通常6.5m、誘爆3.5m、ボス7mまで拡大して消える。輪は最大半径の目安で、壁による遮蔽や誘爆の高さによる範囲縮小は輪形状へ反映しない。
- 描画素材はコード生成。追加の画像ダウンロードなし。エフェクトは最大180個、期限後と作戦切替で破棄。停止中は進行しない。

変更対象: src/client/combat-effects.ts（新規）、src/client/render.ts、src/shared/game.ts、tests/enemies.test.ts、tests/render.test.ts、tests/bot.ts、scripts/check-combat-effects.mjs（新規）。既存の未コミット作業を保持。

検証: 型チェック成功、単体83件成功（全10ステージの攻略を含む）。最終の炎・煙素材調整後に描画テスト5件と型チェックを再確認。画面ビルド成功（既存500KB超警告あり）。Worker dry-run成功。初回dry-runはサンドボックスのログ書込み・親ディレクトリ読取制限で失敗し、承認された再実行で成功。

Chrome 1280×720 / 844×390で通常ソロ開始・射撃、および分離した描画fixtureの弾・酸飛沫・爆発を確認。対象画面のpageerrorなし。fixtureは見た目の確認用で実通信検証の代替ではない。初回の同一ページの遷移では既存Controls.resetのDOM消滅時エラーを検出したため、通常プレイとfixtureを別ページに分離した。ページ破棄時の入力リセット不具合は今回修正していない。

最初の全ステージテストはST8で敗北。テスト操縦が弾の高さを無視して頭上の酸にも回避を消費していたため、接近予測に鉛直位置を追加。敵HP・武器威力を変更せず全10ステージ成功。酸の軌道が変わるため、旧版と全く同じ回避タイミングにはならない。

証拠: dist-validation/combat-effects/browser.json、同フォルダのPC・小画面PNG、task.diff（作業開始時からのゲーム処理・描画・操縦差分と新規描画モジュール）。

branch: codex/home-armory。base / HEAD: 2be699f160c83d641fb68bb1304e4da8059920dc。未コミット変更あり。commit / push / merge / 公開なし。

未確認: Android実機の見た目・負荷、今回変更後の協力通信、公開環境。ローカル実装と自己検証まで完了。

## 公開完了（2026-09-09）
ユーザーの「公開して」により既存Workerへ反映。
- URL: https://swarm-front.melosalife-24.workers.dev
- Version: 76ef8967-a948-469f-b545-18324cf6509a
- 直前Version: 40c7b99e-4fd1-4149-a438-669defe2f08e
- JS: index-Dqnfvuhs.js。公開配信とローカル成果物のSHA256一致: 42fd83c168954a7d7646c9af10fd614b0fc8e35a6d49bf2bbced7e92e46c454f。
- 本番設定dry-run成功後に公開成功。新規・変更静的ファイルはindex.htmlとJSの2点。
- 公開Chrome 1280×720 / 844×390でソロ開始、ライフル・ロケット射撃、武器切替、API health 200 / ok:true、pageerrorなしを確認。一時ブラウザー保存だけで検証し、既存ユーザー保存は変更していない。
- 証拠: dist-validation/combat-effects/live/result.json、同フォルダPNG。再確認用: scripts/check-combat-effects-live.mjs。
- Android実機・公開環境の協力実プレイは未確認。commit / push / mergeなし、branch / HEADは前記のまま。

## 静止プレイヤーへの酸直撃修正・公開（2026-09-09）
原因: 放物線が狙い位置の地面（y=0）に着く設定だったため、5m・10m・17mでは胴体の当たり判定より下を通っていた。発射速度の鉛直成分を `(1.2 - height) / flight + 0.5 * gravity * flight` に変更し、狙い位置で胴体高さ1.2mを通るようにした。外れた酸はその先で地面へ落下。地面の飛沫にダメージ判定は追加していない。

変更: src/shared/game.tsの発射速度1式とコメント、tests/enemies.test.tsの7ケース、公開検証用scripts/check-acid-hit-live.mjs。既存の未コミット差分を保持。branch codex/home-armory / base・HEAD 2be699f160c83d641fb68bb1304e4da8059920dc。commit / push / mergeなし。

検証: 修正前に静止直撃テストの3距離が失敗することを確認。修正後は3・5・10・17・24・30mの全6距離で飛翔中の酸によるHP減少を確認。地面の飛沫上に立ってもHP減少なし。全90テスト成功（全10ステージ攻略、放物線の上昇・下降・着地を含む）、型チェック・画面ビルド・本番Worker dry-run・差分チェック成功。既存の500KB超バンドル警告あり。

ユーザーの「公開までやって」により公開済み。Version f9ed82ef-f29b-4d8f-90dd-fdf41bc69ec5（直前76ef8967-a948-469f-b545-18324cf6509a）。配信JS index-b4apphGW.js。公開Chrome 1280×720 / 844×390でソロ開始・射撃・武器切替・API health 200 / ok:true・pageerrorなし。配信JSと検証済み成果物のSHA256一致: fb909dd176e0cc1051ff26ceca4ec9149fe72079cbdcaf0b31b4d934b2e5df26。

証拠: dist-validation/acid-hit/before.log、tests.log、task.diff、live/result.json、live/*.png。公開ブラウザー確認は配信と通常ソロの確認で、距離別の酸直撃は共通ゲーム処理の自動テストで確認。Android実機・修正後の公開協力実プレイは未確認。
