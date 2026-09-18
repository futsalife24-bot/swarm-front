# 広告関連の表示を一時非表示（2026-09-18）

通常・開発モードとも `SHOW_AD_UI = false` で広告復活、追加報酬のボタンと説明を描画しない。requestAd入口も停止。SDK・報酬計算・保存形式は変更しない。読み込みヒント、初回案内、日替わり説明、ミッション説明から広告への言及を除去。通常受取は「受け取る」、不正な追加報酬要求のエラーは「追加報酬は現在利用できません」。将来の復活条件を誤表示しないためミッション③は「救急箱・復活なし」を維持。

検証: 型チェック成功、vitest.playtest.config.ts全57件成功。scripts/check-hidden-copy.mjsで実Chrome 844×390/640×360、初回案内・出撃準備・作戦詳細・報酬・戦果・ダウン・敗北の計14画面に広告/視聴文言なし、広告ボタンなし、通常受取で残高・武器数保持、再読込で残高と通常受取状態保持、敗北確定成功、pageerror 0。敗北はテストブラウザだけに追加した状態fixtureで表示し、配布コードへフックを追加していない。実機・実SDKは対象外。UI画像/JSONは dist-validation/hidden-copy/ に保持し監査ZIPへ添付。

公開更新履歴は「画面の案内と報酬受け取りの表示を整理しました。」とし、広告計画を記載しない。独立監査・main反映・公開は後続。

## 監査・公開

PR42を通常merge（74761f26cdb857f8641542295e9c3b67d832af7c）。[独立監査](https://chatgpt.com/c/6aacaa42-7084-83ee-8c32-eeb89999c960)はb551793およびmain統合後727f8f38aa6647c0ce18e7badf0dfc76b48cd633で合格・必須0。後続87b4a56は同時進行の管理公開記録2文書だけを保持した統合。監査側はGit blob/差分/14画像を確認し、型・57単体・build・配布JS走査の独立再実行は未実施。任意指摘の再読込後inventory個数未assertは検証限界として記録。

main74761f2のbuild/dry-run成功後、既存WorkerへVersion 1f43ceca-7b3a-4909-b18b-5ea7f799dfedを公開。同時進行の別タスクが直後に再公開したため、最新main c7e7669b58d8e27a6825a4d253cf080764805dd3（PR44アイコン変更を含む）へ同期してbuildし、稼働Version 60fbf8ad-400e-460e-bacc-1765e794be7cを確認。HTML/sw/全JS・CSSの13ファイルSHA一致、広告・視聴文字列0、health200/ok。使い捨てChromeで公開初回案内・出撃準備・作戦詳細の広告文言なし・pageerror0。既存iabは他タブの保存ロックを尊重し、占有を奪っていない。証拠はdist-validation/hidden-copy/published.json、published-ui.png、preflight.json。
