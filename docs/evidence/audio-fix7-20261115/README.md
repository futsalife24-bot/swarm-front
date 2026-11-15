# 第7弾：別アプリ復帰後の音声

## 再現と測定の範囲

開始元は第6弾公開記録後のmain `ee462c5d2155e19dcdc4560103164b09897d6704`。新規worktree `C:/Users/futsa/swarm-audio-fix7-20261115` / `codex/audio-fix7-20261115` で実施。元rootと他worktreeは無変更。

`scripts/check-audio-fix7.mjs <URL> <結果先> [--before]` は空プロファイルの実Chromeを起動し、設定から実音声パックを保存・試聴する。実AudioContext、HTMLAudioElement、追加AnalyserNodeの信号、focus/blur等を記録する。元の音声経路・自動再生ポリシーを無効化しない。検査専用Chromeと一時プロファイルは毎回終了・削除する。

1. TAP START→設定→管制AI→ヒロミを保存して試聴。
2. 別タブへ移動→復帰だけの対照条件を記録。
3. 別タブ側で、対象ページの実AudioContext両方に `suspend()` を実行してOS中断の状態を注入。対象タブへ復帰する。
4. 修正前は両方suspendedのまま・context時刻が停止。修正後はrunning・context時刻が進むことを確認。
5. 画面遷移のない説明文へのタップ、続く実試聴、進撃選択ボタンも検証。

**OSが自然に中断する実機再現とは区別する。** この環境では実タブのfocus/blurは取得できるが、Chromeのdocument.hiddenはfalseのまま。通常Playwright起動、focus模擬の解除、独立ChromeへのnoDefaults接続でも非表示化を実証できなかった。visibilitychange/pageshow、interrupted、再生拒否、復旧中の競合は単体テストで確認。Android Chrome/WebView/iOSの自然な中断・復帰と人間の実聴は未確認。

## 根拠

- `before-confirmed/result.json`: main版の中断注入後、BGM用contextは5.890666秒、Sound用は5.8秒で停止し、復帰後も同値・suspended。通常切替の対照ではrunning。文字タップ後はrunningへ復旧。
- `fixed/result.json`: 修正版は中断時5.76/5.610666秒→復帰後6.010666/5.901333秒、両方running。BGMの実信号RMS約0.174、次の試聴約0.107。RMS単独では停止直前の値が残るため、context時刻・状態・再生状態と合わせて判断。
- `checks/recovery-before.txt`: 復旧13テストの実装前結果。9失敗/4成功。
- `checks/recovery-final.txt`, `checks/recovery-race.txt`: 復旧・BGM・非同期競合の検証。最新要求優先、古い音声の非復活、URLの一回解放、NotAllowedErrorだけ再試行を確認。
- `checks/tests-final.txt`: 全183ファイル1884件成功。終了直後の再再生ガード追加後の `checks/tests-final-guard.txt` は全183ファイル1885件成功（581.17秒）。
- `before-observation/` と `fixed-final/`: 最終手順の修正前後の計測、進撃選択でも復旧した本人の観察を確認。最終版は画面例外0。
- `checks/`: 型・書式・build・dry-run・公開。`published-files.json` は公開物とソースの照合。公開の確定値はimpl-status/outboxへ記録する。
- `spec-regression/`: 既存第6弾の6速度・ピッチ保持指定・保存・タイトル無音・ヨウコロック・字幕なし・横2サイズの実Chrome確認。

初期のbefore/before-built/before-final/before-measuredは検査手順の失敗。設定の画面遷移が終わる前のクリックと、非表示化を当然とした検査側の前提を修正した。before-headless/before-tab/before-final-measured/before-real-tabも非表示化の制約を調べた記録で、製品の成功結果に数えない。

## 原因と修正

BGMはHTMLAudioElementのplayを再試行しても、MediaVolumeが別に持つAudioContextを復帰時にresumeしていなかった。Soundも非表示時stopのみで復帰時のresumeがなく、読み込み済み管制AIのready条件とSEのplay条件がrunningを要求する。よって同じSound contextの中断は管制AIとSE両方を止める。SEが本人の実機でも止まったかは未確認。

visible/pageshow/focusで既存contextを再開し、操作時はcaptureで再試行する。BGMは曲と位置・無音・プレビューによる停止を維持。管制AIのNotAllowedErrorだけ現在の1本を保持し、次操作で再試行。新要求・非表示・ボイスなし・音量0・通常終了は旧音声を解放し、復旧Promiseが後から完了しても古い台詞を戻さない。終了済み要素は再始動しない。

Chromeのユーザー操作制約の根拠: https://developer.chrome.com/blog/autoplay/ 。これはAndroidで今回の原因を実測した証拠ではない。

担当: 主担当の実モデルID/effortは取得不可で未確認。補助はgpt-6-sol/medium指定、調査と復帰テストのみ（実ランタイム表示は未確認）。独立Chat監査は通常タスクの現行方針に従い未実施。
