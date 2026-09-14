# 一時停止メニュー・ジャイロ修正（2026-09-12）

状態: ユーザーの「はい」による今回の公開承認後、既存Workerへ公開・公開後検証まで完了。

## 変更
- 一時停止とホーム設定を、左に項目、右に操作の2列へ統一。スライダー開始位置・幅・数値欄を揃えた。
- ジャイロは94×40pxのオン／オフ切替、状態表示とアクセシビリティ属性を追加。説明は別行。
- ジャイロ感度0.1〜6倍（初期1倍）を両画面に追加。通常・射撃感度から独立し、端末保存。旧保存は1倍として読み込み、不正値は拒否。
- 一時停止は設定欄だけスクロールし、戻る・離脱ボタンを常時表示。
- devicemotionのrotationRateをalpha=X、beta=Yとして扱う。従来はbeta=X、gamma=Yとしていた。横持ち時の画面軸変換を維持し、gamma（画面のひねり）を照準から除外。

根拠: 現行W3C DeviceMotionEventRotationRate §6.3.2とChromium実装で確認。
https://www.w3.org/TR/orientation-event/#devicemotioneventrotationrate
https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/modules/device_orientation/device_motion_event_pump.cc
https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/modules/device_orientation/device_motion_event_rotation_rate.cc
DeviceOrientationの角度とDeviceMotionの回転速度の属性対応を混同しない。

## 検証
- npm run typecheck 成功。
- npx vitest run tests/aim.test.ts: 4件成功。旧保存互換・不正感度・8方向×4画面角・感度倍率・入力限界。
- node scripts/check-gyro-layout.mjs: 完走成功。915×412、812×375、1280×720で操作列整列と横溢れなし。保存・感度独立・許可拒否/許可・実Controlsへの模擬センサー32方向・roll無反応・pause/off無反応。
- 915×412のスクリーンショット目視確認。設定をスクロールしても操作ボタンは見える。
- npm run build:production 成功（従来の500kB超警告あり）。最終JS index-D4JESU0n.js / CSS index-CpWSCC35.css。
- npm run server:build:production 成功。初回sandboxのログ/親ディレクトリ制限で失敗、権限付きdry-runで成功。以降の変更はclientのレイアウトのみ。
- git diff --check 成功。

実スマホのセンサー・実機操作感は未確認。ブラウザ検証は模擬センサーであり実機確認の代替ではない。全E2E・協力通信の再試験は今回のclient設定変更の範囲外。

## 監査証拠
branch: codex/home-armory。base/HEAD: 4186f25f7c9695f95ea897ad182db5f85fac3091。全変更未コミット、commit/mergeなし。
開始時の未コミット変更（射撃ドラッグ・既存ジャイロ導入・描画等）を保持。
今回編集: src/main.ts、src/menu-ui.css、src/client/input.ts、src/client/save.ts、src/shared/aim.ts、src/client/changelog.ts、tests/aim.test.ts、e2e/smoke.spec.ts（切替ボタン文言assertion）、scripts/check-gyro-layout.mjs、docs/STATE.md、本記録。
差分: dist-validation/gyro-layout.patch（HEAD比、既存差分も含む）。新規ファイルは同patch末尾のno-index差分へ収録。
ブラウザ計測: dist-validation/gyro-layout-check.json。
画像: dist-validation/gyro-layout-915.png、gyro-layout-812.png、gyro-layout-1280.png、gyro-layout-home.png。

## 公開の残作業
npx wrangler deploy --config wrangler.production.jsonc は自動承認レビューに拒否されたため実行されていない。今回の修正版公開の明示承認後に既存Workerへ反映し、公開JS/CSS一致・設定・出撃/一時停止を確認する。


## 承認後の公開完了
2026-09-12、ユーザーが今回の修正版公開を「はい」と明示承認。
URL: https://swarm-front.melosalife-24.workers.dev
Version: fb3fdda5-fe91-4101-9bbd-1e2d88703fb6。
公開JS index-D4JESU0n.js / CSS index-CpWSCC35.css はローカル検証済みdistとSHA-256一致。
node scripts/check-gyro-published.mjs 完走成功。ジャイロ感度2.5の再読込・一時停止への引継ぎ、通常/射撃感度の独立保存、設定列整列、戻るボタン可視、出撃・離脱、API health 200/ok、pageerrorなしを確認。
初回はsandboxの外部通信制限で接続できず、権限付き実行で成功。
証拠: dist-validation/gyro-layout-published.json、gyro-layout-published-home.png、gyro-layout-published-pause.png。
公開の残作業は解消。実スマホのセンサー操作感は引き続き未確認。branch/HEADと未コミット状態は上記のまま、commit/mergeなし。
