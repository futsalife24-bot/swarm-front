# 進撃の停止・ダウンUI検証

作業: `task-advance-pause-ui` / `codex/advance-pause-ui-20261106`。基点は正規main `1c0b77c2e95a6e9859a8c4003d0adc018338cc91`。公開状況は [公開記録](ADVANCE-PAUSE-UI-RELEASE-20261106.md) を参照。

指定のデザイン担当と連携し、`advance-pause-ui.ts/css` を統合した。今回の変更と公開は本人承認済み。

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

元添付の直接転送は環境のファイル属性処理エラーで未完。実装者は現行製品UIの再現画面を実際に確認し、それを基準に変更後を検査した。

## 最終UI検査

`dist-validation/advance-pause-ui/final-ui/results.json` は3サイズ全件成功・errors=[]。停止/再開、設定内から再開、配置画面をキャンセルして停止へ戻る、リタイア取消、繰り返し停止、3操作の44px以上と画面内配置、同行なし/不明ID/数値欠損の表示、ダウン→敗北結果を検査。欠損表示だけは複製Worldによるfixture。途中の演出を含む画像があったため、静止画は `screenshots/` へ別取得する。

修正後の関連11テストとクライアント型を再実行して成功。Worker型成功。最終buildは成功（278モジュール、既存の大チャンク警告）。差分チェック成功。

`screenshots/` の844×390・640×360・568×320は切替演出完了後に再取得。実装者が640/568の停止・ダウンを実ピクセル確認し、568でも3操作・スキル説明・戦況が画面内に収まることを確認。太いpauseアイコン＋停止ラベルの戦闘画面も確認。実機の安全領域は未検証で既存配置計算を維持。

撮影用の `screenshots/results.json` も3サイズ成功・errors=[]。撮影時はREVISED=0なのでsettingsReturnAndRetireCancel=falseは「再実行していない」を表す（失敗ではない）。操作結果の正本はREVISED=1で実行した `final-ui/results.json`。

## Claude納品回収完了

`design/advance-pause-ui/` に検査器・変更前9枚・変更後22枚・結果JSONを保存。デザイン担当側は284項目成功・ページ例外0、844 PC/640タッチ/568タッチ/844タッチの疑似安全領域L44/R34/B21で確認。実値の押下と表示差替えfixtureを区別して記録している。主担当の3サイズ実操作結果は別の `final-ui/results.json`。

担当の確認事項にあるplannedKillsは作業中の旧接続を読んだ記述。最終実装はworld.totalKillsを使用しており、FOUNDRY生成分も含む総撃破を表示する。報酬側のplannedKillsは変更していない。
