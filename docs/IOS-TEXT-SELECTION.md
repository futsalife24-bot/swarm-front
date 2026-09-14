# iOSの文字選択対策（2026-09-12）

## 変更と原因
一時停止ボタンは #controls の外にあり、従来の user-select: none の対象外だった。
Safari用の -webkit-user-select と -webkit-touch-callout も未設定だった。
src/style.css にボタン・戦闘表示・一時停止メニューの文字選択/長押しメニュー抑止を追加。
一時停止メニュー内の input/textarea/select は選択を許可し、編集用の操作を維持する。
根拠: [Apple Safari CSS Reference](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariCSSRef/Articles/StandardCSSProperties.html)。

ボタンだけを修正した初回ブラウザ検証では、ダブルクリックの2回目が開いたメニューへ入り、「表示」の文字が選択された。メニューも対象に追加して再検証成功。

## 検証
- npm run typecheck 成功。
- npm run build 成功。既存の500kB超警告あり。
- npm run server:build:production 成功。初回はsandboxのログ/親ディレクトリ制限で失敗、権限付きdry-runで成功。以降はCSSのみ追加。
- node scripts/check-touch-selection.mjs 成功。Chromeのタッチエミュレーションで667×375 / 915×375。
- 一時停止ダブルクリック後の選択文字列が空、停止/再開/感度変更/再度停止/離脱、JSエラーなし、配信JS/CSSとdistのSHA-256一致を確認。
- 667×375の画像を目視確認。戻る/離脱ボタンが画面内に表示。
- git diff --check と src/style.css のPrettier確認成功。

iOS実機の長押し/コピー用囲い、Safari実機での操作感は未確認。WebKit実行環境は未導入。今回の修正は文字選択に限り、他の不安定さの解消は未確認。

## 公開・監査証拠
URL: https://swarm-front.melosalife-24.workers.dev

Version: 14b91af6-393a-42d8-b6dc-07d9cfd3db69。
既存Worker公開の指示（game/AGENTS.md）に基づき公開。

branch: codex/home-armory。base/HEAD: 4186f25f7c9695f95ea897ad182db5f85fac3091。
未コミット変更あり。既存の射撃/ジャイロ等の作業を保持。commit/mergeなし。
今回の編集: src/style.css、scripts/check-touch-selection.mjs、本記録、docs/STATE.md。
CSS差分: ボタン・#controls・#hud・#damage・#pause-menu（各子要素を含む）・#world・#portrait に -webkit-user-select: none / user-select: none / -webkit-touch-callout: none を追加。#pause-menu の input/textarea/select には text / text / default を指定。

ローカル証拠: dist-validation/touch-selection-local.json、touch-selection-local-667.png、touch-selection-local-915.png。
公開後検証: node scripts/check-touch-selection.mjs https://swarm-front.melosalife-24.workers.dev 完走成功。同じ2サイズで操作/文字選択抑止/JSエラーなしと公開JS/CSSのSHA-256一致を確認。dist-validation/touch-selection-published.json と同名の667/915画像に保存。
