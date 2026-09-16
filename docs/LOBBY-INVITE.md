# ロビーIDコピー・PWA招待（2026-09-16）

branch `codex/lobby-id-pwa-invite`、base/main `cbb4b10aa435397fca996a044a0cceacd8310a40`。

## 差分

- コピーアイコンを部屋ID横へ移し、8文字IDだけをコピーする。クリップボード不可時は手動コピー用prompt。招待リンク共有ボタンは右へ16px（700px以下8px）の余白を追加。
- 招待共有はWeb Share APIを維持。未対応・共有失敗時は招待URLコピー、共有取消は何もしない。共有本文には部屋IDとホーム画面アプリ内での参加方法を追記。
- 協力の参加欄はIDまたは招待URLを受け付ける。同一origin・同一pathname・32桁hex fragmentだけを採用し、貼付URLの接続先・query設定は取り込まない。Pagesサブパスを維持。
- manifestの `launch_handler.client_mode=focus-existing` と起動URL受領を追加。対応OS/ブラウザがPWAへ渡した招待は既存ウィンドウで受領し、確認後に参加画面へ移動。取消は現在のゲームを保持。hashだけが変わる招待も再起動して処理する。
- 外部リンクをPWAへ振り分ける可否はOS/ブラウザ設定に依存する。この変更だけでiOSを含む全端末の自動切替が直ったとは扱わない。非対応環境ではホーム画面アプリ→協力プレイ→招待リンクまたはID貼付→参加を利用できる。
- 招待URL取得に旧コピーアイコンを使っていたE2Eを共有ボタンのclipboard fallbackへ追従。

## 検証

- `npm run typecheck` 成功。
- `npx vitest run tests/room-invite.test.ts` 2件成功（ID/URL、別origin/パス/資格情報/不正fragmentの拒否）。
- `npm run build`、`npm run build:pages` 成功。既存bundleサイズ警告あり。
- `node scripts/check-lobby-invite.mjs` 成功。実Chrome＋ローカルDurable Object/WebSocketでIDコピー、招待共有のURLコピー、招待リンク貼付入室、ID入室、667/844/1280×390の非重複を確認。pageerror 0。
- 起動キューの受領/取消/承諾はChromeへ模擬イベントを注入して検証。OSの実リンク捕捉、インストール済みPWA、実スマホは未検証。実機OSについてユーザーへ確認中。
- [667px](evidence/lobby-invite/lobby-667.png)、[844px](evidence/lobby-invite/lobby-844.png)、[1280px](evidence/lobby-invite/lobby-1280.png)、[計測結果](evidence/lobby-invite/results.json)。667pxは画像目視も確認。

参考: [Chrome navigation management](https://developer.chrome.com/docs/capabilities/pwa-navigation-management)、[Launch Handler API](https://developer.chrome.com/docs/web-platform/launch-handler/)。launch_handlerは外部リンク捕捉を強制する設定ではない。

## 残作業

Chat独立監査・必要な承認後にmain反映と既存Worker公開。実機の自動切替は未確認。

保存先: [PR #18](https://github.com/futsalife24-bot/swarm-front/pull/18)、実装HEAD `bfe537005f5811a3757369c491e3ddb385412f1a`。作成済みZIP `dist-validation/lobby-invite-audit.zip` は対象commitのsrc、manifest、関連E2E、テスト、検証スクリプト、画面証拠、差分を含む。Chat添付は自動承認レビューが非公開データの具体的送信承認不足として拒否したため未送信。明示承認待ち。後続commitはこの記録のみ。

2026-09-16 ユーザー「はい」でZIPの通常Chat送信を明示承認。添付・監査依頼の送信を確認済み。[独立監査Chat](https://chatgpt.com/c/6aaa2662-7970-83ee-a606-0e752aaf19d5)。公開Worker dry-runも成功（実公開なし）。

## 独立監査1件の修正

初回監査は「要修正・必須1件」。招待B承諾時に旧ルームAのsessionStorageが残る問題を独立再現。IDコピー、共有、URL検証、3幅UIは合格。コピー完了表示のヘッダー下端への近さは軽微・任意として残す。

`clearNetworkSession()`を通常退出と招待承諾で共用。承諾後のイベントで現在のNetwork.close()を呼び、復帰情報を削除してからreloadする。取消時はどちらも行わない。vitestの明示includeに新規テストを追加（追加前の標準コマンドでは対象外だったため是正）。

再検証: typecheck・招待単体2件・通常/Pages build成功。実Chrome/WorkerでA入室→B招待取消（旧接続情報維持）→B招待承諾（B参加前に旧session=null、Aの接続人数減少）→「タイトルへ」→「協力プレイ」で旧部屋の復帰表示が出ず部屋一覧へ進むことを確認。従来のID/URL入室・3幅チェックも同スクリプトで成功、pageerror 0。結果JSONは今回の再実行へ更新。OS実PWAリンク捕捉は未確認のまま。

修正HEAD: `f81e143f6df27f24ff9dbb77c80c7ac9984fefde`。修正ZIP `dist-validation/lobby-invite-reaudit.zip` を作成（修正対象ソースと関係するshared、追試スクリプト・結果、8e802c5→修正HEADの全差分）。同じ監査Chatへ添付を試みたが、自動承認レビューが初回ZIPと異なるファイルの具体的送信承認不足として拒否。修正資料は未送信・明示承認待ち。元の要修正判定を合格扱いせず、main反映・公開は保留。
