# PRISM・ボス状態別ボイスの自己検証

実装 `9a63c30ab105d75347235c0bfa55eb366dfb382f`、base `7be80ad25f4d1d21d16a02f7eaa804f9be5426a6`、[PR179](https://github.com/futsalife24-bot/swarm-front/pull/179)。

- src/workerのTypeScript型チェック: exit0。
- 関連17テスト: 成功。実`hurtEnemy`で胴節破壊して`fractured=true`になり、次の攻撃予備から専用の声へ変わること、既存の間隔/ミュート抑止を確認。
- 23WAV: PCM16/mono/32kHz・端点0・非飽和・SHA一致。20声再生成PCM一致。変更対象外14声はv2とファイル全体一致。[wave-check.json](wave-check.json)。
- 保存済み実装からvite build: exit0。[build.txt](build.txt)。その後、既存本番Worker設定でdry-run: exit0。[worker.txt](worker.txt)。
- Chrome試聴一覧: 33プレイヤーすべてreadyState4、errorなし。PRISM 1.72秒/ボス比較9秒の終端到達。横幅1263pxでscrollWidth=clientWidth。
- ローカルVite上で実`openBestiary`を開く検証ページを使用。実3Dモデルと声ボタンを表示。通常型から連結形態へ選択を変え、連結中・分離後の別ボタンと説明を確認。実Audioのplayイベントはそれぞれ`boss-linked-0.wav`、`boss-separated-0.wav`、paused=false、error=null。連結中は2.15秒終端まで確認。検証用HTMLは音声イベントを画面へ表示するだけで、製品のAudio/モデルを置換しない。ゲーム全体の通信試験とは区別する。

ブラウザ操作の時間切れ後、接続復旧と標準AX操作でレポート確認を回復。画像はツール出力で目視し、PNG保存とは区別。主担当の実聴、今回追加6声の本人採否、実スマホ、BGM/戦闘SE混合の聴感は未確認。

監査経路は同じANOMALY修正の続きとして本人が今回限定で承認済みのChrome通常Chatを使用。URL https://chatgpt.com/c/6acdaec0-6ddc-83ee-98d5-8c96c0c6955e 。前版合格は今回へ流用しない。

## 提出後の本人評価

改訂試聴一覧を提示後、本人が「いいね、これで採用」と明示。今回追加6声を含むv3の採用確認済み。上記の提出時点の採否未確認を更新する。主担当/監査側の実聴と混同しない。

## 提出後の横画面修正

ブラウザ全体のviewport変更が接続不全の空タブで失敗するため、844×390のiframeへ実レポートを読み込んで確認。2つのボタンと説明を同じflexへ並べた初版では、説明が数文字幅まで縮んで縦長になる欠陥を発見。各ボタンと説明に既存`.report-voice`行を付け、2行へ修正した。音源・再生制御・CSSは不変。

修正後は実モデルと2行を画像目視。dialog clientWidth=scrollWidth=819、各行幅287、説明幅160.625px、行高さ49/56px。両方のボタンと説明がスクロールせず見える。src型チェック成功。これはPCブラウザ内844×390枠であり、実スマホではない。採用済み20WAVは変更していない。追加差分は独立監査へ渡す。
