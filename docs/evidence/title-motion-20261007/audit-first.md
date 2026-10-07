結論：要修正

対象HEAD: 6571b261d67761cc1713acf15aca7abf614168f4
BASE: c67628040c747ab22c7dbfa45021c7a2cdb9ca52

変更5ファイルの新blobは changes.patch のindexと一致しました。P0なし、必須P1×1、P2×1です。公開前にここは直した方がええ判定です。

P1｜二重決定・連打の抑止が不完全

箇所: src/client/title-motion.ts:128-143、playtest-app.ts:508-545, 1539-1543

現在の抑止は「同じボタンで event.detail > 1」と「キー長押しrepeat」が中心です。そのため、例えば日替わり防衛は openDailyDefense() が最初に await syncCloud() するので、画面が変わらない間に、

Enterを押して離す
もう一度Enter、または別タイトルボタンを押す
2本の処理が並行する

という経路が残ります。

さらに buttonFor() は dialog[open] しか拒否しません。タッチ端末でFullscreen遷移待ち中の「DOMには追加済みだがまだopenでないdialog」がある間も、別ボタンを決定できます。

独立Chromium検証でも、1回目でclosed dialogを追加した状態から別タイトルボタンを押すと、両方のハンドラが実行され、後から1個目のdialogが開くことを確認しました。自己fixtureの detail:1 → detail:2 だけでは拾えません。実入力はそこまで行儀よく揃ってくれへんわけです。

影響: 二重通信、複数dialog、別画面へ進んだ後に古い非同期処理のdialogが出る可能性。
最小修正方針: 最初の決定自体は待たせず、遷移・非同期処理中の後続タイトル決定だけを抑止する pending guardを入れる。

P2｜別ボタンへマウス移動すると押し込み表示が即解除される

箇所: title-motion.ts:80-87

ボタンAにフォーカスがある状態でボタンBをクリックすると、

pointerdown B → Bにtitle-pressed付与 → focusout A → release()

となり、pointerup前にBの押し込みが消えます。実Chromiumでもこの順序と B pressed=false を再現しました。

focusout で無条件に現在の pressed を解除しているのが原因です。event.target === pressed の場合だけ解除する等、フォーカスを失った要素と押下中要素を区別する必要があります。今回PRの主目的そのものが押し込み演出なので、P2でも必須扱いです。

問題なしと確認した範囲

タッチ pointercancel、window blur/非表示時の解除、キー長押しrepeat抑止、keyup後の再入力、prefers-reduced-motion のWAAPI停止、MutationObserverの遷移後/最大900ms解除、同一rootへの重複mount防止はコード上妥当です。最初の決定処理を190/210ms演出終了まで待つ実装にもなっていません。

844×390の2枚も確認し、既存配置を崩す明確な回帰は見当たりませんでした。title-motion.ts 単体は独立TypeScriptコンパイルも通過しています。

検証限界

ZIPには behavior.json と844×390画像はありますが、型チェック・本番build等の生ログ自体は収録されていません。また、大型不変素材と依存環境が省略されているため、こちらではゲーム全体のproduction buildは再実行していません。実機タッチ/GPU、別viewport、協力一覧の実通信も未確認のままです。

最終判定：要修正。P1の二重決定競合とP2のfocusout押下解除を閉じれば、今回の変更範囲では再監査対象をかなり限定できます。

ChatGPT は間違えることがあります。重要な情報は確認してください。
最新の応答




High
回答が完了しまし