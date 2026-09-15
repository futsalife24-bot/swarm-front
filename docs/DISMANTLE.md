# 武器庫の一括分解（2026-09-09、ローカル実装）

## 今回の仕様
- 選択詳細の外枠をR:灰青、SR:緑、SSR:橙金、LR:黄にする。一覧と同じ色を使用。
- 武器庫の見出し横に「整理モード」。各武器の左にチェック欄を表示し、選択数・獲得量付きのボタンで一括分解。
- 装備中・お気に入りは選択不可。処理側でも一括検証し、保護対象・存在しないIDがあれば全体を拒否。重複IDは一度だけ計上。
- 確認ダイアログで丁数・レア度別内訳・粉末獲得量を表示。取り消しで変更なし。
- 単品操作も分解へ統一。削除と粉末加算は同じ保存データを一度だけ書き込み、成功後にメモリーへ反映する。保存失敗では両方を保持。
- フィルター変更でチェックは維持し、全選択数を常時表示。整理終了・ホーム／出撃準備への移動でクリア。お気に入り化した対象は選択解除。
- 分解後は空いた枠に整理待ちを入手順で収納。

## 未確定事項
名称はユーザー選択により「武装片」に確定。共通通貨1種類でR:1 / SR:3 / SSR:10 / LR:30を仮設定。名前と獲得量はsrc/client/save.tsのPOWDER_NAME / POWDER_YIELDSに集約。名称変更は表示のみで保存キー・残高・獲得量に変更なし。
購入システムは未実装。公開・commit・push・mergeは未実施。実機・協力実プレイは未確認。

## 保存と監査用本文
Saveに任意のpowder:numberを追加。既存v1と保存キーを維持し、未保存は0扱い。非負の安全な整数だけ読み込み可能。

```ts
const selected = new Set(ids);
// 所持品と整理待ちから対象を取得し、全件の存在と保護を検証
const powder = (save.powder ?? 0) + weapons.reduce((n, w) => n + POWDER_YIELDS[w.rarity], 0);
// nextは複製。対象を除去してpowderをセットし、整理待ちを収納
// write(next): persist(next)成功後にだけsave = next
```

branch: codex/home-armory
base / head: 2be699f160c83d641fb68bb1304e4da8059920dc
未コミット変更あり。開始前から多くの差分・未追跡物があり、それらを保持。
今回の編集: src/main.ts（武器庫）、src/client/save.ts（分解と粉末保存）、src/mobile-ui.css（枠・整理UI）、tests/armory.test.ts、e2e/armory-ui.spec.ts、本書、docs/STATE.md。
既存ヘルプE2Eは出撃準備一覧から削除済みのヘルプを探していたため、武器庫で対象を選んで検証する手順に更新。

## 検証
- npm run typecheck: 成功。
- npm test: 8ファイル、75件成功。追加3件は全レア度加算・重複／再分解防止・所持品と整理待ち同時除去・保護対象混在・不正残高・旧セーブ互換。
- npm run build: 最終CSSで成功。既存500kB警告あり。
- npx playwright test --config playwright.armory-ui.config.ts --reporter=line: 最終3件成功（33.4秒）。通常操作、ヘルプ、一括分解の取消・保存失敗・成功・再読み込みを確認。
- 640×280 / 844×390 / 1280×720で一覧の横はみ出し・画面外への下端突出なし。横画面のヘッダー非重複を検証し、3画像を目視確認。初回はチェックlabelの既存余白が適用されたため詳細度を調整。
- 対象5ファイルのPrettier、git diff --check: 成功。
- 制限内ではPlaywright終了処理が停止したため、その実行を中断。許可された制限外ローカル実行で最終結果を取得。

証拠: dist-validation/dismantle-e2e.log、dist-validation/evidence/dismantle-{640,844,1280}.png。

## 公開完了（2026-09-09 JST）
- ユーザーの「公開までやって終わり」に基づき既存Workerへ公開。
- URL: https://swarm-front.melosalife-24.workers.dev
- Version: 857a8aa6-0477-4229-9732-cc327c746d69。直前Version（前回記録）: a7fc7dff-b0d2-4981-a19a-074caf4d7655。
- 配信JS: index-DLPvysL5.js / CSS: index-DMhXk8zC.css。名称は武装片。公開時の獲得量はR:1 / SR:3 / SSR:10 / LR:30。
- 最終本番ビルド・本番dry-run成功。サーバー本体は公開前WorkerとSHA256・バイト一致（fdfaf03c476d3061603fbedb24db7ee06971b66638ede230ef8e7ded7536ac1b）。静的3ファイルを更新。
- 公開Chromeの640×280・1280×720で4レア度の枠色、装備中とお気に入りのチェック不可、2丁一括分解の取消・実行、武装片13の再読み込み後保持を確認。検証は専用ブラウザの一時データのみ。
- ページ200、配信JS一致、API health 200/ok:true、ブラウザ例外なし。2画像を目視確認。検証スクリプト終了コード0。
- 証拠: dist-validation/dismantle/{worker-live-comparison.json,live-browser.json,check-live.mjs,live-640.png,live-1280.png}。
- branch/headは上記から変更なし。未コミット差分保持、commit/push/mergeなし。実機・公開協力実プレイは今回未検証。
