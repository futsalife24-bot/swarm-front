# 管理者モード・補給10連の演出確認（2026-11-11）

本人依頼は「演出を選んで確認」と「プレイ同様のランダム、実取得なし」。認証済み管理者モードの基地→補給ポッドに追加。選択時はその確定下限を満たす表示用10枠、ランダム時は本番サーバーと同じ `drawSupply(10, ...)` の通常確率/保証を端末内で実行し、同じruntimeへ渡す。結果一覧の「演出確認へ戻る」で繰り返せる。

確認モジュールは補給サービス・券・報酬適用・保存をimportも実行もしない。既存の管理者セッション確認、通常/管理者の保存隔離、ログアウトを維持。URLだけで管理者として扱わない。新サービス/認証変更なし。

## 実装と確認結果

- `supply-presentation.ts` に従来の表示変換と読込を移し、通常と確認で共有。通常の受領/保存/ACKは従来の `supply-menu.ts` のみ。
- 通常runtimeの表示選択は元々順番送りだったため、適格候補からのランダム選択を共用する `effect-selection.js` へ変更。バディ通信優先、下限検査、指定再生の条件は維持。結果・排出確率・券は変更しない。
- `core.js`、FX描画式、reference-scenes、音、画像/CSS原本に変更なし。新UIは既存メニューを継承。
- 関連62件（既存59＋新3）成功。10案の下限一致、ランダム10連保証、乱数への追従、結果非変更、保存/API呼出し禁止を検査。両型・本体Vite build・対象Prettier・`git diff --check` 成功。既存大chunk警告は維持。
- 実ローカルWorkerを既存設定で起動し、ローカル限定のテスト用パスワードhashを `wrangler dev --var` で渡した。正式 `/api/developer/login` とセッション確認を使用し、認証のモック/迂回なし。本番パスワードや設定は変えていない。
- Chrome844×390・640×360それぞれで選択10案＋ランダム2回をUIから再生、10枠の結果/スキップ/戻る/overlay除去/再実行を確認。各サイズで補給API0件、全localStorageの前後一致、pageerror0。配置の横はみ出しなし。`local/results.json`、`local/*-entry.png` と各再生/結果画像。画像は再生開始・スキップ後の証拠であり、今回の全演出全編を通し視聴したとは主張しない。元10案の比較証拠は前段の supply-kakutei-20261111 を参照。
- 通常側も2サイズで実HTTP10連→受領保存→途中再読込み→同結果回復→スキップ→ACK→基地に成功。pageerror0・重複なし。`normal/results.json`。メニュー画像は画面切替中の撮影を含む。
- 検証器の初回2回はTAP STARTの再表示を操作せず停止、次は切替シャッター内の旧画面複製を配置判定して停止。`title-entry.ts` のdocumentごとの仕様と実画面を確認し、正式操作と切替完了待ちへ修正。製品の失敗や合格に混ぜない。概要は `setup-failures.json`、最後の実UI実行は成功。

## 再現と範囲

```powershell
node ../node_modules/vitest/vitest.mjs run --config vitest.supply.config.ts
node scripts/check-supply-dev.mjs
$env:SUPPLY_OUTPUT='docs/evidence/supply-dev-preview-20261111/normal'
node scripts/check-supply-game.mjs
```

管理者確認器の既定はローカル8796。公開環境で再検証する時は `SUPPLY_SITE` と、既存の認証済み `SUPPLY_STORAGE_STATE` または正式ログイン用 `SUPPLY_PASSWORD_FILE` を使用する。接続情報はignoreされたローカル領域に置き、値/状態ファイルを出力・commitしない。

実スマホ・実聴・今回の全ゲーム全件/協力実戦は未実施。公開結果は [RELEASE.md](RELEASE.md) に記録する。主担当gpt-6.1-sol（推論未確認）、補助の指定gpt-6-sol/medium（実行設定未確認、入口調査と実UI検証器を担当）。主担当がコードと画像を確認して検証を実行。独立Chat監査ではない。

## 画像の更新（末尾確定・獲得停止の変更後）

local/の画像と結果は後続の補給末尾確定・スキップ獲得停止の実UI検証で再生成したものへ更新。元の試験時点の画像は実装commit 99f6ac1の同パスに保持する。今回の結果は ../supply-last-skip-20261111/RELEASE.md を参照。
