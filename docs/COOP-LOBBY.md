# 協力ロビー改修（2026-09-09）

実装・自己検証完了。ユーザーの「公開して」の明示承認後、2026-09-09に既存Workerへ公開済み。下記の公開待ち記述は経緯。

## 変更
- 左にホスト選択ステージ、右に4人の隊員・装備2丁・準備状態。下部に招待リンクと操作。
- 各自で出撃準備へ移動すると準備中となり、装備変更を全員に共有。準備完了ボタンでロビーへ戻る。
- 準備中の参加者がいる場合、UIと権威サーバー双方で出撃を禁止。
- ステージ選択をサーバーで保存し全員へ配信。ホスト以外の変更を拒否し、出撃は保存済みステージを使用。
- 装備送信で個体性能rollsも保持。装備選択時と協力戦闘時の個体性能が一致。
- 氏名は未実装のため「あなた／隊員番号」。4人を2×2に配置し、各カードの武器2丁を縦並び。右下に「チャット（仮）」を表示し、入力は無効（送信機能未実装）。縦画面は1列に戻す。
- 既存クライアントとの互換性のため、equipにready指定がなければ従来どおり装備提出時に準備完了。新クライアントは準備中の変更時にfalseを送信。

## 検証
- 型チェック成功、単体97件成功。
- 実ローカルWorker＋独立Chrome4画面: ステージ共有、参加者側の選択無効、準備中表示、装備反映、出撃無効、完了復帰、4人出撃成功。
- 844×390 / 915×412 / 1280×720でロビー・ステージ欄・隊員欄の縦横オーバーフローなし。画像目視確認済み。
- 別の実WebSocketテスト: 準備中のstart拒否、非ホストのステージ変更拒否、startの任意stageより保存済みstage優先、準備完了後の出撃成功。
- 画面ビルド成功、Pagesビルド成功（最終の受信処理・余白修正前）、通常Workerおよび本番Worker dry-run成功。最終配布候補は dist/assets/index-DFXYg2-I.js。
- 既存の500KBバンドル警告あり。Android実機未検証。本番での新ロビー検証は公開待ち。
- 初回はsandboxでWorker起動失敗、続いて残存ポート競合。権限付き別ポートで検証。初回E2Eでステージ受信の抜け、次に4pxオーバーフローを検出し修正後成功。追加通信テストは3丁のfixture送信で失敗し、2丁へ修正後成功。

## 差分・証拠
branch: codex/home-armory
base / HEAD: 2be699f160c83d641fb68bb1304e4da8059920dc
開始時から多数の未コミット・未追跡変更あり。今回も未コミット。commit / mergeなし。
今回の対象: src/main.ts、src/client/network.ts、server/worker.ts、src/mobile-ui.css、src/client/changelog.ts、e2e/lobby.spec.ts、playwright.lobby.config.ts、docs/STATE.md、本書。
開始時からの差分: dist-validation/lobby/task.diff
開始時ファイル: dist-validation/lobby/before/
画像: dist-validation/lobby/844.png、915.png、1280.png
再現: npx playwright test --config playwright.lobby.config.ts --reporter=line

## 公開待ち
npx wrangler deploy --config wrangler.production.jsonc は自動承認レビューが「ユーザー本人による公開承認の証拠がありません」と拒否。公開操作は実行されていない。
既存本番 https://swarm-front.melosalife-24.workers.dev への反映はユーザーの明示承認後に実行する。

## 2×2表示への追加改修（2026-09-09）
- 1列×4から2×2へ変更。各隊員の名前・ホスト表示・状態・装備をカード内にまとめ、従来左側にあったチャット予定枠を右下へ移動。
- 4人実Worker＋ChromeのE2E成功。740×360 / 844×390 / 915×412 / 1280×720で2×2の位置、チャット表示、各カードを含む縦横オーバーフローなしを確認。740・1280画像を目視確認。装備変更・準備状況・ステージ共有・全員出撃の回帰も成功。
- 型チェック・最終ビルド成功。配布候補: dist/assets/index-CWf8ZkDs.js。既存500KB警告あり。今回サーバー・通信仕様は変更なし。
- 初回に360px高で7pxのはみ出し、見出し調整後2pxを検出。上下余白を調整して成功。途中の再実行は更新履歴編集に伴う開発画面再読込の影響で失敗し、ソース固定後に成功。
- 小さい横画面では見出しを1行にして高さを確保。740×360は余白が少ない。Android実機・将来の自由入力名の表示は未検証。
- 今回の変更ファイル: src/main.ts、src/mobile-ui.css、src/client/changelog.ts、e2e/lobby.spec.ts、docs/STATE.md、本書。
- branch/base/HEADは上記と同じ。未コミット差分あり。今回開始時からの差分: dist-validation/lobby-grid/task.diff。開始時ファイルは同before/。画像は同740.png・844.png・915.png・1280.png。
- 公開は前回の自動承認レビュー拒否から引き続き明示承認待ち。今回は公開再試行なし。

## 公開完了（2026-09-09）
ユーザーの「公開して」に従い、既存Workerへ公開成功。
Version: f0df7e06-c697-4d14-8cf5-272907922160
URL: https://swarm-front.melosalife-24.workers.dev
PC 1280×720 / スマホ横幅844×390のChromeでHTTP200・協力入口・API health 200/ok:true・pageerrorなし。配信JSとCSSが検証済みdistのSHA256と一致。公開環境の4人ルームは未再検証（ローカル実Workerの4人検証済み）。
JS: /assets/index-CWf8ZkDs.js / SHA256 80b1ca4ba4f48af6e63b92b2be0082173f92c6349eadcb341a6eca95108d8764
CSS: /assets/index-T1uGrk6O.css / SHA256 3e613113a7c71bc248a68ce7b27bfc96eeb935d71af148c5f48509e1c38277ad
証拠: dist-validation/lobby-grid/live/result.json、同1280.png・844.png。確認スクリプト: scripts/check-lobby-live.mjs。
branch / base / HEADは上記と同じ。未コミット・未追跡差分あり。commit / mergeなし。今回のローカル追加変更は公開確認スクリプトと状態記録のみ。

## 下部スペース再配置・公開完了（2026-09-09）
- 招待URL欄を撤去し、見出し右へ共有ボタンとコピーアイコンを配置。コピー完了通知、共有キャンセル、コピー不可時の手動コピー導線を実装。
- 左OPERATION枠を最下部まで拡張し、準備状況・装備変更・全員出撃を内包。出撃ボタンは大型ミント色。右下チャット予定枠を残りの高さへ拡張。
- 型チェック・最終ビルド成功。実ローカルWorker＋Chrome4人でコピー・ステージ同期・装備変更・準備中の出撃禁止・全員出撃成功。サーバー保護テスト成功。740×360 / 844×390 / 915×412 / 1280×720でオーバーフローなし、740・1280画像目視確認。
- 初回はsandboxのWorker起動制約、再試行は残存ポート競合。検証だけ5313/8913へ移して実行し、完了後は設定を元の5312/8912へ復元。740px幅で左枠18pxはみ出しを検出、余白修正後4人E2E成功。
- 既定公開指示に従い既存Workerへ公開。Version: b179ab95-3d9e-464e-97a7-171d807d60bd。公開PC・スマホ幅の協力入口とAPI health 200、pageerrorなし、配信JS/CSSのSHA256が最終distと一致。
- Android実機・ネイティブ共有ダイアログ・縦画面・本番4人ルームは未検証。チャット送信は従来どおり未実装。既存500KBビルド警告あり。
- branch: codex/home-armory、base/HEAD: 2be699f160c83d641fb68bb1304e4da8059920dc。開始時から多数の未コミット差分あり、commit/mergeなし。
- 今回の変更: src/main.ts（構造・招待操作）、src/mobile-ui.css（配置）、e2e/lobby.spec.ts（コピーから招待取得）、scripts/check-lobby-layout-live.mjs（公開確認）、docs/STATE.md、本書。
- 今回開始時との差分: dist-validation/lobby-layout/task.diff。開始時ソース: 同before/。画面画像: 同740.png・844.png・915.png・1280.png。公開検証: 同live/result.json。
