# 下向き移動中のカメラ振動修正（2026-09-12）

原因: render.ts のカメラ位置は描画プレイヤーへ補間される一方、lookAt は20Hzのシミュレーション位置から求めたlocalAim.targetを使っていた。地面を向くと近い注視点の位置差で角度が周期的に変動する。

変更: cameraShotへ描画位置を渡してvisualAimを計算し、カメラ位置と注視点の基準を統一。権威側の射撃計算は変更しない。

ブラウザ回帰: scripts/check-camera-jitter.mjs。実Rendererに20Hzの移動と60Hzの描画を入力。上下限/水平、X/Z移動、予測有無、スコープ有無の24条件。修正前の最大フレーム角度差1.005307度、修正後0.000001708度（浮動小数点誤差相当）。pageerrorなし。証拠: dist-validation/camera-jitter/before.json、after.json。

検証範囲: Chromeの描画fixture。実機タッチとインターネット越しの遅延は未検証。

監査: branch codex/home-armory、base/HEAD 4186f25f7c9695f95ea897ad182db5f85fac3091。既存未コミット差分を保持、commit/mergeなし。今回の実装差分はsrc/client/render.tsのlookAt付近のみ。追加は回帰スクリプトと本記録、STATEへの追記。

追加検証: typecheck成功、単体188件成功、クライアントbuild成功、Worker production dry-run成功、git diff --check成功。照準回帰は915×412のスコープUIと24通りの弾道投影が成功（最大誤差1.32e-13px）。fixtureの敵モデルfallback/Three重複警告あり、pageerrorなし。既存の500KBチャンク警告あり。

公開済み: https://swarm-front.melosalife-24.workers.dev
Version: 91002ead-e6af-44a0-9556-88cd9d627cb0
配信JS: /assets/index-Cg786siF.js。check-aim-published.mjsでローカル/公開アセットのSHA256一致、出撃/帰還、設定保持、health、pageerrorなしを確認。証拠: dist-validation/aim-settings-published.json。

Worker dry-run初回と公開確認初回はサンドボックスのファイル/通信制約で失敗。承認済みの権限拡張実行で成功。

実装差分（既存変更に対する今回分）:
```diff
- this.camera.lookAt(localAim!.target.x, localAim!.target.y, localAim!.target.z);
+ const visualAim = cameraShot(w, { ...p, ...pos }, { yaw, pitch });
+ this.camera.lookAt(visualAim.target.x, visualAim.target.y, visualAim.target.z);
```
