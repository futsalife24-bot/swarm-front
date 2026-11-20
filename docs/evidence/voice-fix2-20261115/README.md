# 第2弾：字幕・ボイス設定の実画面監査

検証環境: Windows / 実Chrome、横844×390、設定は568×320も確認。新worktreeの完成buildを127.0.0.1:5200で配信。補給APIは実リクエストを専用のローカルWorkerへ転送し、協力はそのWorkerへ実WebSocketで接続した。通信をモック化した確認ではない。協力は1人部隊であり、インターネット上の複数人同時プレイの確認ではない。

## シーン別の結果

「音声あり」はヒロミパック保存済み・字幕always。「未DL」は新しい一時ブラウザでパックなし・字幕always。「ボイスなし」はパック保存済み・再生無効。字幕missingの組合せは設定試験でも別に確認した。各場面の代表イベントであり、全台詞/全分岐を網羅した結果ではない。

|シーン|修正前のコードでの表示|音声あり|未DL|ボイスなし|最終位置|
|---|---|---|---|---|---|
|タイトル|台詞字幕の描画なし。TAP START前に音声要求|[音声・字幕](title-audio.png) 1.44秒の音声開始も確認|[字幕](title-missing.png)|[字幕](title-muted.png)|下中央16px|
|進撃の戦闘|作戦キュー/HUD案内のみ、台詞全文なし|[字幕](battle-audio.png) 3.68秒の音声開始|[字幕](battle-missing.png)|[字幕](battle-muted.png)|下中央86px|
|協力ロビー|接続状態と別文面の初回案内のみ|[字幕](coop-audio.png) 接続2.32秒/初回ガイド9.84秒を観測|[字幕](coop-missing.png)|[字幕](coop-muted.png)|下中央86px|
|協力の実戦|作戦キュー/別文面の初回案内のみ|[字幕](coop-battle-audio.png) 実Workerの出撃案内3.68秒|[字幕](coop-battle-missing.png)|[字幕](coop-battle-muted.png)|下中央86px|
|生存の戦闘|作戦キュー/通知のみ、台詞全文なし|[字幕](survival-audio.png) 初回カード選択後4.64秒|[字幕](survival-missing.png)|[字幕](survival-muted.png)|下中央86px|
|補給|投下要請等の見出しのみ、台詞全文なし|[字幕](supply-audio.png) 投下要請2秒|[字幕](supply-missing.png)|[字幕](supply-muted.png)|下中央16px|
|基礎訓練|操作バナーが短い操作案内を兼ねる|[字幕](training-audio.png) 実移動で次手順へ進み相づち1.36秒を観測|[字幕](training-missing.png)|[字幕](training-muted.png)|iframe内の下中央86px|
|初回ガイド|台詞とは異なる短い操作案内|音声あり協力ロビーの初回案内9.84秒と字幕を確認|音声未用意でも同じキューから字幕表示|[訓練の誘い](guide-muted.png)・[出撃準備](gear-guide-muted.png)・[補給](supply-guide-muted.png)|所属シーンの位置|

基礎訓練の最初の台詞は、音声context解放直後のデコードが終わらず字幕にフォールバックする場合がある。音声ありの観測は実移動後の次手順で行った。操作案内自体は字幕設定にかかわらず残る。

音声の長さは実AudioBufferSourceNodeのstartとbuffer.durationの観測。人間による実聴品質確認とは別。タイトル/訓練の短い観測値は検証中のツール集計出力から記録したもの。ケース途中の再確認で初期の全シーンJSONを上書きしたため、全6シーンを1つの未加工JSONに保持しているという主張はしない。スクリーンショットと各回の確定観測を組み合わせた報告である。後半は出力名をケース別に分けた。

## 設定・保存・試聴

[設定試験結果](settings-result.json)、[844×390](settings-844.png)、[568×320](settings-568.png)、[試聴字幕](preview-caption.png)。ボイスなし＋字幕off、音声あり＋missing、音声なし＋missing、always、再読込保持、遅いTAP START、試聴で選択が変わらないこと、未DLの試聴無効、ヨウコの選択/試聴不可、削除ボタン撤去を確認。横はみ出しなし。設定は新キーで保存され、最後に選んだ声の既存キーはhiromiのまま保持する。

## 検証の経緯と再現

- 最初のVite開発配信は応答が停滞し、最適化を外してもブラウザでtimeoutしたため、完成buildのpreviewへ切り替えた。本番用Vite設定は変えていない。
- ローカルWorkerに静的ファイルも担当させた初回はWrangler内部ProxyControllerエラーで終了したため、静的配信と専用WorkerのAPI/WSを分離した。既存の他タスクや本番の通信を置き換えていない。
- 既存画面遷移のshadow DOM内に複製されたID/ダイアログを試験が拾ったため、css:lightで実DOMへ限定した。遷移中の入力保護、初回の新規進行/訓練案内、読み込み完了ボタン、初回カード選択、初回バディ選択、過去のローカル検証セッションの自動復帰も通常UI/テストfixtureへ反映している。
- 接続台詞は短時間で合流台詞へ更新される。試験はロビー到達後の実字幕を対象とし、遷移完了後に画像を撮る。試験の待ち条件失敗と製品の字幕欠落を混同しない。
- 協力部屋はローカルの正規作成キーで専用Workerに作成し、実UIで参加した。人間確認や本番認証を無効化していない。補給は隔離Workerの既存10券と通常の抽選/再開を利用し、確率/券/天井等を変更していない。

再現はnpm run build、npm run preview -- --port 5200と、新worktree内のnpm run setup:local後にwrangler dev（8796、ALLOWED_ORIGINSはhttp://127.0.0.1:5200）を使う。scripts/check-voice-fix2.mjsは新しい一時ブラウザで設定と初回進行を準備し、ignoredのdist-validation/voice-browser-state.jsonを作る。scripts/check-voice-matrix.mjs missing/audio/mutedで各条件、--menusでメニューのみ、--coop-only --coop-battleで協力の実戦のみ確認する。設定の単独確認はscripts/check-voice-settings.mjs <URL> <出力先>。保存fixture/.dev.varsをGitHubへ登録しない。

## 未確認

実スマホ/iOS・人間の実聴・全台詞・全画面サイズ・多人数実インターネット・長時間実戦は未確認。仮称「ボイスなし（字幕のみ）」、トップとボイス画面の導線、将来の吹き出し/フロー表示は本人判断待ちの候補であり、本実装の完了を止める承認条件ではない。


## 公開確認

公開ソースe67964e6、Worker Version 4298818a-0185-40e8-b2f7-2ec35991d93c。[公開記録](release-result.json)・[30ファイルの配信照合](published-files.json)・[公開設定の実Chrome結果](published/settings-result.json)。公開トップ/音声パック/生成JS・CSSはbuildと一致し、health正常。公開先ではタイトル/設定/試聴を確認し、各実戦の代表イベントは上記の隔離ローカルWorkerで検証した。これらの範囲を区別する。
