# 進撃の停止・ダウンUI検証

作業: `task-advance-pause-ui` / `codex/advance-pause-ui-20261106`。基点は正規main `1c0b77c2e95a6e9859a8c4003d0adc018338cc91`。公開操作は親の指示により保留。

既存Claude Code「リモート指示用」へ本人指定に従って設計を依頼し、`advance-pause-ui.ts/css` を統合。原指示はthread `01a1a8aa-dfa5-74f3-bf91-d3b2434849ce`、user message `01a1aaa5-6943-75e2-b06f-ff7797b55a06`（2026-11-05 07:38:49 UTC）の「ガチャページの追加やUIレイアウトなどの領域は今後も含めてClaudeCodeのClaudeデザインへ依頼して」。正規read_threadで確認。公開継続承認の原文は未確認。

## データの根拠・変更境界

- 停止画面の同行情報は `world.buddies.run === world.run` と `entries.solo` を読む。保存中のselectedから同行を推定しない。名前・属性・効果は既存catalogItem/BUDDY_COMBATを使用。ヨスガは持ち主だけ回復。
- 効果時間はhealUntil/guardUntil/boostUntil。見た目のdisplayUntilを効果時間と扱わない。タタラの瞬間攻撃は持続効果なし。数値欠損は仮レベルや0秒で埋めない。
- ダウンの戦況はstageFor(world).name / world.time / world.totalKills。plannedKillsは生成敵を除外するため総撃破表示には使用しない。敗北確定前にgrantResultや保存処理を呼ばない。
- 停止・再開・設定・リタイアの既存コールバック、SHOW_AD_UI=falseと広告分岐、敗北結果処理は維持。戦闘・能力・保存形式・通信に変更なし。

## 実行した検査と証拠

- 関連単体テスト2ファイル11件成功。4バディ、実レベル、効果/再使用時間、同行なし、不明ID、run不一致、欠損、HTMLエスケープ、非変更性。
- クライアントとWorkerのTypeScript検査成功。Vite製品build成功（既存の大チャンク警告あり）。
- `dist-validation/advance-pause-ui/before/`: 844×390、640×360、568×320の製品renderer実画面。停止/再開、ダウン→敗北結果が全サイズ成功。古いfailure.pngは最初のVite接続失敗であり成功画像ではない。
- `after/`: 初回統合。844/640の操作成功。568でリタイアが隠れる問題を検出、Claudeへ共有して修正。
- `after-final/`: 欠損fixtureがdialogのcloseイベント完了前に再停止を押して失敗。検査側に終了待ちを追加。合格扱いしない。
- `dist-validation/buddy-product-coop/results.json`: 実製品Workerをlocalhost:8821で起動し、部屋作成200・WS101とpongを確認。編集中Viteの再読込後に復帰画面へ遷移し、出撃待ちで失敗。協力回帰の合格扱いはしない。自身の検査/Workerプロセスは終了。

ソロUI検査は隔離セーブでヨスガ所持を準備し、製品rendererを観測。画面操作までsafe=999、ダウンはHP=0にするfixture。欠損ケースは複製WorldからgetAdvanceBuddyView/advanceBuddyMarkupへ渡し、開いている製品ダイアログの表示部分だけ差し替える。通常の自然死亡・実際の破損セーブ・実スマートフォンの検査とは区別する。

途中の `verified/` と `verified-final/` は画面切替の6分割shadow DOMを通常の表示として拾い、検査が失敗。`final/` は不正データを実Worldへ投入するfixtureがチェックポイント検証に拒まれ、通知ダイアログが残って失敗。いずれも合格ではない。最終検査では演出終了待ち・通常DOM参照と複製Worldによる欠損表示へ変更した。保存検証を弱める製品変更はしていない。

## 画像の制約

元添付は親だけが実ピクセル確認済み。実装者の正規Library helperはWindowsの `os.setxattr` 非対応で失敗し、consumer-localへの転送は未完了。迂回していない。実装者は現行製品UIを再現した変更前画像を実際に確認し、それを基準に変更後を検査した。

## 最終UI検査

`dist-validation/advance-pause-ui/final-ui/results.json` は3サイズ全件成功・errors=[]。停止/再開、設定内から再開、配置画面をキャンセルして停止へ戻る、リタイア取消、繰り返し停止、3操作の44px以上と画面内配置、同行なし/不明ID/数値欠損の表示、ダウン→敗北結果を検査。欠損表示だけは複製Worldによるfixture。途中の演出を含む画像があったため、静止画は `screenshots/` へ別取得する。

修正後の関連11テストとクライアント型を再実行して成功。Worker型成功。最終buildは成功（278モジュール、既存の大チャンク警告）。差分チェック成功。

Claude Codeの指定TS/CSSは回収・統合済み。Claude画面のget_window_stateが2回タイムアウトしたが、その後読取復旧。担当は568×320の余白調整後の独自再検査中で、最終納品コメント/独立検証記録はまだ未回収。送信自体は実UIの「あなたの入力」と実行中を確認済み。追加2件の連携情報はキュー投入を確認済み。再送はしていない。本人指定外の外部AI通信はない。

`screenshots/` の844×390・640×360・568×320は切替演出完了後に再取得。実装者が640/568の停止・ダウンを実ピクセル確認し、568でも3操作・スキル説明・戦況が画面内に収まることを確認。太いpauseアイコン＋停止ラベルの戦闘画面も確認。実機の安全領域は未検証で既存配置計算を維持。

撮影用の `screenshots/results.json` も3サイズ成功・errors=[]。撮影時はREVISED=0なのでsettingsReturnAndRetireCancel=falseは「再実行していない」を表す（失敗ではない）。操作結果の正本はREVISED=1で実行した `final-ui/results.json`。
