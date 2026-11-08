# 終了確認（非公開実装）

基点: `303b7745ab6db05ac9d02c6985e35249eaada4cd`。2026-11-08の「端末でのバック操作など、ゲームを終了することになる操作には確認」の限定実装。メニュー遷移の全面改修ではない。以前の独立監査は変更せず保持し、これは実装者自身による検証記録。独立レビュー合格を意味しない。

## 動作

- ページを破棄するBack/Forward、更新、タブ閉じ、外部移動に `beforeunload` のブラウザー標準確認を要求する。
- 取消では終了処理、保存、接続解除、履歴操作を実行しない。現在の文書、未確定フォーム、モーダルをそのまま保持する。協力のサーバー時間や既存の自動保存まで停止させる機能ではない。
- 通常の画面内の戻る、モーダル閉じ、タブ切替には追加確認なし。既存の未保存編集の破棄確認・戦果なし退出確認は維持する。
- 明示的な `navigateMenu` による同一originの正規ゲーム入口間移動は一度だけ確認を省く。外部URLや管理画面等にはこの省略を適用しない。失敗/同一文書移動時には次タスクで省略を解除する。
- ブラウザーの履歴を直接たどって別のゲーム文書へ移る場合も、編成/編集/接続を破棄する可能性があるため確認対象。アプリ内の一段戻るとは区別する。内部画面の履歴化は今回実装しない。
- BFCache復帰時に保存権限を再取得するための既存自動reloadだけは確認を省く。ユーザーによる通常の更新は確認する。
- 招待アプリリンクは既存の招待確認を維持し、取消時は接続・履歴を触らない。承認後の接続解除・URL置換・reloadに二重の終了確認を出さない。
- 協力ロビーの「退出」は既存の明示的退出で接続を閉じる。今回の端末Back取消とは別操作であり、ロビー退出の仕様は変更しない。管理者認証ページ等の特殊な直接遷移は追加の省略対象にしない。

## 履歴と取消

pushStateによる番兵、履歴の増殖、popstateからの強制forward/back、window.close、独自の履歴トラップは使わない。続行を選んだブラウザーの元の遷移をそのまま実行する。取消時に履歴や装備を復元するコードは不要であり、実装していない。

## 捕捉限界

- 標準確認にはページへのユーザー操作（sticky activation）が必要。初回表示直後に一度も操作せず離れるケースではブラウザーが確認を抑止する。
- 標準ダイアログの本文・ボタン・表示回数はブラウザーが管理し、ゲーム側で日本語文言を指定できない。
- Androidの端末Backが文書のunloadを起こし、ブラウザーがbeforeunloadを許す場合は対象。OSの強制終了、タスクスワイプ、クラッシュ、プロセス破棄、モバイルの一部離脱、PWAウィンドウ終了は確認を保証できない。
- 同一文書内のhash/履歴移動、モーダルのネイティブclose要求にはbeforeunloadは起きない。今回追加確認しない。
- Firefox等のBFCache性能への影響や、実Android/PWAの動作は別途実端末確認が必要。

資料: [MDN beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)、[MDN Navigation navigate event](https://developer.mozilla.org/en-US/docs/Web/API/Navigation/navigate_event)。調査日2026-11-08。Navigation APIで履歴を作り直す方式は採用していない。

## 検証手順

専用checkout、新規Playwright context、localhostのみ。`node scripts/setup-local.mjs` はこのcheckoutだけにテスト用作成キーを生成し、既存の実セーブや鍵をコピーしない。外部通信をテストルート/CSPで遮断する。実サービスの部屋は作成しない。

```powershell
node node_modules/typescript/bin/tsc -p tsconfig.json
node node_modules/typescript/bin/tsc -p tsconfig.worker.json
node node_modules/vitest/vitest.mjs run tests/front-exit-confirmation.test.ts tests/front-menu-transition-input.test.ts tests/room-invite.test.ts tests/shared-armory.test.ts
node node_modules/vitest/vitest.mjs run --config vitest.save.config.ts tests/save-regression.test.ts tests/playtest-checkpoint.test.ts
node node_modules/vitest/vitest.mjs run tests/front-title-entry.test.ts tests/front-title-input.test.ts
node node_modules/vite/bin/vite.js build
node scripts/setup-local.mjs
node node_modules/@playwright/test/cli.js test --config playwright.exit-confirmation.config.ts
```

Windows環境ではTEMP/TMPを許可された専用一時ディレクトリに置く。試験用Viteは試験成果物/Chromeプロファイルを監視対象から除外する。試験用Vite定義では更新履歴を空配列とし、公開用の更新履歴生成は通常の `vite.config.ts` で別にビルド検証する。製品設定を緩めない。

ブラウザー試験は、Back取消反復/連打、続行/Forward、更新/閉じるの取消・続行、通常メニュー移動、モード横断、未確定編集、ローカルWorkerの実WebSocketを対象にする。実Android・実回線・公開協力ロビー・協力戦闘中は別途確認する。

## 対象と結果

- 専用checkout: `C:\Users\futsa\Documents\Codex\2026-11-08\task\exit-confirm-implementation`、branch `codex/exit-confirm-20261108`。Gitオブジェクトだけ既存保管庫を読み取り参照し、作業ファイル・Git管理領域・依存・テスト用保存・Worker状態は分離した。
- GitHub mainを開始時と終了前に接続アプリで照合し、基点SHAのまま。記録上の公開sourceは `9d625396c465fbb0f80253a4c5f0a7f59eb6e194`、Worker Version `42fb8817-67cc-4d0f-b478-73a12aeedc00`。
- 2026-11-08 14:19 UTCに公開トップHTMLを再取得。SHA256 `317e98277e62cc5f11bac0fc5716625ee5a13b37fb21750234f0d3c86cf467ee` は既存公開証拠と一致。今回全64アセットの再照合やWorker Version APIの再取得はしていない。今回の `/health` はHTMLを返したので正常JSONとは判定しない。製品変更はしない。
- 型: クライアント・Workerとも成功。関連単体67件（新規19件を含む）、保存・チェックポイント回帰53件成功。
- 最終Chrome試験6件成功。取消4回＋3回連打、続行後の外部到着とForward、履歴件数不変、更新とタブ終了、両モードと協力入口、設定モーダル、カードタブ、未保存カード名、既存編集破棄確認、ローカルWorkerの実WebSocket接続と編成保持を確認した。
- 非公開ブラウザーは844×390、新規プロフィール、localhostのみ。実協力相手との複数人プレイ・戦闘中・Android実機・PWA OS終了・Firefox/Safariは未検証。標準ダイアログはPlaywrightの `dialog.type() === beforeunload` で検証し、添付画像は取消後の画面証拠。
- 初期試験の失敗は、取消された遷移の待機、外部fixtureのorigin/文字コード、未登録プロフィール、HOST表示の非同期追加とinnerText/textContent差だった。試験前提を修正し最終全6件成功。製品で履歴を追加して回避していない。
- 証拠: `docs/evidence/exit-confirmation-20261108/`。ビルド最終結果は同フォルダーの記録を参照。push・merge・deployは実施しない。

## 変更の範囲と自己レビュー

共通guard追加、2入口での登録、既存menu routeの明示移動、BFCache reload、承認済み招待reloadだけを製品コードの変更対象にした。ゲーム性、メニュー階層、保存形式、サーバー、実セーブは変更していない。ブラウザー自体の戻るに独自の画面履歴は追加しないため、現在の文書を破棄する場合にはゲーム内URL間でも確認される。これを階層移動へ変える案は独立監査の構造改修であり今回の対象外。
