# エネミーレポート導入音声と無選択表示（2026-11-16）

本人の enemy-report-intro-brief-20261116 と今回の明示依頼を正本に実装。基点main: 636425a951ce6348f3fc733b576c182d993982a4。
GitHub: https://github.com/futsalife24-bot/swarm-front 。作業場所 C:/Users/futsa/swarm-enemy-report-intro-20261116、branch codex/enemy-report-intro-20261116。元rootの既存差分・他worktreeを保持。

## 音声の収録確認

受領3 WAVを対応するassets-srcへバイト同一で保存。44.1kHz/mono/16bitをヘッダーで確認。生成・波形編集なし。既存 scripts/build-voice-packs.mjs のPACK_VERSIONだけ3→4とし、既存ffmpeg設定（MP3/libmp3lame/64kbps/mono/44.1kHz/metadata除外）、SFVP形式v1で構築。

|声|追加前v3|追加後v4|実収録確認|
|---|---:|---:|---|
|ヒロミ|156|157|voice-control-hiromi-v1/enemy-report-intro|
|ヒヨリ|122|123|voice-control-hiyori-v1/enemy-report-intro|
|ヨウコ|122|123|voice-control-yoko-v1/enemy-report-intro|

3パックのバイナリ先頭SFVP/形式版1・目次JSON（version=4/codec=mp3/clips）を実際に解析し、上記キーが各パックに収録されていることを確認。各1本追加・削除0。旧v3計400クリップは全件バイト一致。原本・パック・追加MP3のSHAと全目次は pack-results.json、再現は scripts/check-enemy-report-intro-packs.mjs。

**旧v3のみ保存済みのユーザーは、使う声のv4パックを設定から再ダウンロードする必要がある。** 旧版だけでは導入音声は無音。既存URL/SHAによる版管理を維持し、自動取得・保存移行なし。旧パック素材を保持。旧report-*20行は不採用のまま。

## 画面と再生

先頭PLEATの自動選択を解除。全項目aria-pressed=false、モデルを生成せず、詳細領域へ確定セリフ全文を常設案内として表示。ボイスなし・未取得・旧版でも同じ案内を表示し、字幕には接続しない。選択すると既存の詳細画面へ戻す。solo判明済みだけ名前/説明/モデルと識別名、coopのみは？？？/黒シルエット/既存案内、未遭遇は？？？/モデルなしを維持。既存に選択解除操作なし。

reportIdentification.enterを画面生成時に一度だけ呼び、既存Sound.unlock/announce→ControlVoiceQueueを使用。再描画・同項目連打では導入を再要求せず、選択/閉じる/敵の声試聴/非表示は既存停止処理で準備待ちも停止する。ボイス設定・保存パック・声/速度/ピッチ保持/音量・最新要求優先の既存条件を維持。

## 検証と制約

npm test全185ファイル/1,925テスト成功、型・書式・diff・build成功。既存URL/chunk警告あり。初回テストの出力反映が遅く起動停滞と見誤り、終了付近に停止操作を行ったがtest-default.txtには全件成功を記録。確認用の同じ全件をthreads方式でも再実行し、終了コード0・全1,925件成功をJSONでも確認。

実Chromeのローカル本番形式build+previewで、3声soloとcoop/未遭遇/未取得/ボイスなし/旧v3のみ/不正保存の計9条件すべて成功。検証器 scripts/check-report-identification.mjs は、各遷移直後の無選択/案内全文、実MP3のパック内SHA一致/playing/自然終了、3遷移の1回ずつ再生、再描画/一覧スクロールで再発なし、選択/閉じる停止、全10種の識別名/開示、同時発話1以下、字幕0、保存不変、余分な取得0、画面例外0を検査。隔離contextのfixtureだけへ保存とパックを設定し、製品コード/実ユーザー保存は変更しない。

確認器の連続操作で再開閉が不成立となった失敗3件を保存。操作イベント診断で、画面切替間隔を置いたクリック/Enterでは開閉と再生停止が成立。確認器に100msクリックと1秒の切替待機を加え、失敗を合格と混同せず再検証。根因の完全特定や端末の入力改善は主張しない。diagnostic/ と checks/ に診断と失敗ログを保持。

実スマホ等の実デバイス確認・人間による実聴チェックは実施していない。音声信号/MP3/再生イベントの機械確認を人間の聴取と扱わない。通常方針に従い独立Chat監査なし。主担当の実モデルID/推論設定は未確認、委任なし。

## 公開と後片付け

実装PR https://github.com/futsalife24-bot/swarm-front/pull/364 を通常merge。実装4a5d07590e501d3c5c730c1ba2b32834513480c1、ログ空白整理後の対象48cdcabcd7b37de716fad8df79dfff3c85a8ee80、公開ソースmain cd0b7c3c23a4039e3ae93bad5212b73fd4b245d4。検証済み実装と製品ソース差分なし。merge後mainからbuild/production dry-runとも終了コード0。

既存Worker swarm-front / https://swarm-front.melosalife-24.workers.dev/ へ公開。Version 62713a92-8419-44f5-8fb9-2eaf93e33355、100%配信。公開30ファイル（v4全3パックを含む）HTTP200/ローカルbuildとSHA一致、JS埋込ソースSHA一致、api/health 200/okを確認。delivery.json と checks/deploy.txt・deployment-status.txt が証拠。

公開実Chrome9条件も全件成功。全10種×3声の実MP3/playing/自然終了、導入の1回再生/再描画抑止/選択と閉じる停止、常設全文案内/無選択、未保存/ボイスなし/旧v3のみの導入無音、6種の条件で識別名無音と既存開示、字幕0/例外0/保存不変/余分な取得0を確認。published/results.json と条件別JSON/画像を保存。ローカル/公開ともChrome 157.0.8103.51、serviceWorkersを停止した隔離contextのfixture。実PWAや実デバイス/人間の聴取を検証済みとはしない。

追加のローカル/公開実Chromeで、識別名の実playingイベント内に敵の声試聴を開始し、管制AI発話が同時発話1→0となり試聴へ切り替わることを確認。同じアプリへの遷移後にレポートDOM/旧管制音声が残らないことと例外0も確認。各 preview-navigation.json と checks/chrome-preview-*.txt に保存。追加検査の失敗は、短い識別名が自然終了した後の検査タイミング、about:blankでfixtureがlocalStorageへ触れたエラー、新画面の無関係なaudio/dialogまで数えた過大な検査が原因。実playingに合わせた操作・同一オリジン遷移・レポートだけの検査へ修正し、製品の失敗と混同せず旧ログも保持。

GitHubのcommit status/workflow runは0件で、CI合格とは読み替えない。mergeable=trueと対象headを確認して通常merge。Hook/保護/権限の変更・迂回なし。
公開記録の取り込み後、専用HEAD/origin/main/remote mainの一致・clean・両PR取り込みを確認して今回worktreeだけを削除する。未コミット差分があれば削除しない。依存は実ディレクトリでJunctionなし。local mainは他worktree使用中のため動かさない。
最終main・Worker Version・削除の確定結果は本人指定 C:/Users/futsa/bibi-bridge/outbox/20261116-enemy-report-intro-status.md に記録する。
