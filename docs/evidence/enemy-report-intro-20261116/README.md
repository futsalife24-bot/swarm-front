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

実装PRと公開記録PRの通常merge、merge後mainからのbuild/production dry-run、既存Worker swarm-frontへのdeploy、配信SHA/healthと公開実Chromeの再検証を行う。確定結果をこの節へ追記する。
公開記録の取り込み後、専用HEAD/origin/main/remote mainの一致・clean・両PR取り込みを確認して今回worktreeだけを削除する。未コミット差分があれば削除しない。依存は実ディレクトリでJunctionなし。local mainは他worktree使用中のため動かさない。
最終main・Worker Version・削除の確定結果は本人指定 C:/Users/futsa/bibi-bridge/outbox/20261116-enemy-report-intro-status.md に記録する。
