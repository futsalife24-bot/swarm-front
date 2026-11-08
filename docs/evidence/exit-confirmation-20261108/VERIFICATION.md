# 非公開候補の検証結果

実装commit: `b8130181ce83152fbf8a9de3cdf1a1c59d257aab`。基点: `303b7745ab6db05ac9d02c6985e35249eaada4cd`。以後のcommitは検証記録のみで製品コードを変えていない。

| 対象 | 結果 | 証拠 |
|---|---|---|
| クライアント・Worker型検査 | 両方exit 0、最終コードで再実施 | 仕様書の再現コマンド |
| guard・招待・遷移入力・部屋招待・共有武器・タイトル | 67/67成功（新規19件） | unit-final.txt |
| 保存・チェックポイント回帰 | 53/53成功、最終コードで再実施 | save-regression.txt |
| Chromeの実ブラウザー | 6/6成功、約2.2分 | results.json、4枚のPNG |
| 通常Vite build | exit 0、287 modules、標準設定で生成成功 | build-final.txt |
| 差分 | git diff --check成功 | ローカルGit |

ビルドの500KB超chunk警告は既存の大きなゲームbundleに関する警告で、ビルド失敗ではない。試験用Viteの空更新履歴とは別に、通常のGit更新履歴生成を含むビルドを実施した。

ブラウザー証拠は新規ローカル保存・ローカルWorkerの1人ホスト。実公開協力・複数人・協力戦闘・Android実機・PWA OS終了・Firefox/Safariは未検証。Chromeでの成功をAndroid保証と扱わない。招待launchQueueの取消/続行は単体試験であり、OSからの実招待起動は未検証。BFCache復帰時の保護状態は単体試験、ブラウザーのForwardはE2Eで確認したが、全BFCache条件を網羅していない。

最初のE2E失敗はテストfixture/待機条件を修正し、最終6件を同一実行で通した。公開トップHTMLの照合結果はpublic-check.json。今回の/healthはHTML応答だったため、公開ヘルス正常とは記載しない。

このフォルダーは実装者の自己検証であり、以前の独立メニュー監査を置き換えない。実セーブ、秘密鍵、.dev.vars、ブラウザープロファイル、依存ディレクトリは含まない。push・merge・deployなし。
