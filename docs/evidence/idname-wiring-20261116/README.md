# 識別名27クリップの追加と全10種の配線（2026-11-16）

本人の idname-wiring-brief-20261116 に従う局所変更。基点main: 0c4a19b957e3bef7513a73702709abff28303a98。
GitHub: https://github.com/futsalife24-bot/swarm-front 。作業場所: C:/Users/futsa/swarm-idname-wiring-20261116 、branch codex/idname-wiring-20261116。元rootと他worktreeの既存差分を保護。

## 音声パック

受領27 WAVをassets-srcの対応する3声へバイト同一で保存。WAV 44.1kHz/mono/16bit確認。生成・再収録・音量や速度・波形の編集なし。既存scripts/build-voice-packs.mjsのPACK_VERSIONだけ2→3へ変更し、同じffmpeg設定（mono/44.1kHz/libmp3lame/64kbps/metadata除外）、同じSFVP形式v1で再構築。

|声|パック|収録数|バイト数|
|---|---|---:|---:|
|ヒロミ|control-voice-hiromi-v3.bin|156|6296247|
|ヒヨリ|control-voice-hiyori-v3.bin|122|4487011|
|ヨウコ|control-voice-yoko-v3.bin|122|4781429|

旧v2から各9件追加、削除0、既存変更0。CALYXを含む旧373クリップは全件バイト一致。原本照合はreceived-inputs.json、受領条件はreceived-manifest.md、パック照合はpack-results.json。

**旧パック保存済みユーザーは、使う声のv3パックを設定画面で再ダウンロードする必要がある。** URL/カタログSHAが変わる既存の版管理を使用する。旧URLのキャッシュだけでは新版を再生しない。自動ダウンロード・保存データ移行なし。旧v1/v2の配信素材も保持。

## 配線と既存条件

report-identification.tsに保存キーcrawler/ant/spider/spitter/boss/hornet/bastion/worm/harrow→anomaly-pleat/volley/leaper/prism/foundry/ray/bastion/catena/harrowを追加。CALYX既存対応を維持。10種とも保留を解除しmenu場面へ分類。report-*20行は不採用を維持。新規の戦闘初遭遇トリガーは追加していない。

前回CALYXと同じ共通select→unlock→announce→ControlVoiceQueueを使用。保存normalのsolo判明済みだけ発話。coopのみ/未遭遇/欠落・不正・読取不可の保存は？？？のまま無音。パック未保存・ボイスなし・利用不可時は無音、字幕代替なし。同じ選択の連打/再描画/自然終了後の再クリックでは繰り返さない。別項目へ移って戻れば新しい表示として一回。選択変更/閉じる/敵の声試聴/非表示で再生と準備待ちを停止。声・音量・速度・ピッチ保持・250ms重複抑止・最新要求優先の既存仕様を維持。

## 検証

全185ファイル1,920テストすべて成功（失敗0）、型・書式・git diff --check・初回build成功。実Chrome9条件（3声solo＋coop/未遭遇/未保存/ボイスなし/旧v2のみ/不正保存）が成功。各声10種の実MP3一致・playing/自然終了・重複なし・停止・無音・保存不変・字幕0・例外0を確認。結果はbuilt/results.json、checks/と条件別JSONへ保存。scripts/check-report-identification.mjsを既存検証器から拡張し、全10種×3声の実pack MP3バイト一致、playing/ended、連打/自然終了後重複抑止、切替/閉じる停止、同時発話1以下、無音各条件、字幕0、進行保存不変、レポートから追加取得なし、画面例外0を検査する。fixtureは実freshProgressから検証器内で作成し、隔離Chromeの保存先だけへ設定する。製品の表示/開示条件や音声を変更しない。

初回開発ViteでのChrome検証はfront.htmlのdomcontentloaded待ち90秒でタイムアウト。成功と数えずchecks/chrome-solo.txtへ保存。本番形式ビルド＋previewで再検証し成功。未遭遇の初回はEnterだけの選択が不成立で60秒タイムアウト（chrome-unknown-built-selection-failed.txt）。前回の検証手順どおりクリック＋Enterを使い、選択aria-pressedの照合を維持して全10種で成功。製品変更なし。単独Enterが不成立となる根因は未特定。人間の実聴・実スマホは未確認。通常タスク方針で独立Chat監査なし。主担当の実モデルID/推論設定は未確認、委任なし。

## 公開と後片付け

実装PR https://github.com/futsalife24-bot/swarm-front/pull/362 を通常merge済み。実装commit df9bec2c2e1bdb4d89eeb920d9b78003e5062375、公開ソースmain f1c70e09fcbf8013719dac60e1f51f15a1c36e45。検証済み実装とのソース差分なし。merge後mainからnpm run buildとnpm run server:build:production成功後、既存Worker swarm-front / https://swarm-front.melosalife-24.workers.dev/ へ公開。Version 1e0d2ded-d50c-4837-8a5a-d5ce960d2260、100%配信。

公開36ファイルのHTTP200/SHA一致（v3全3パック含む）、JS埋込ソースSHA一致、api/health 200/okを確認。公開実Chrome9条件（3声solo＋6種の無音）が全件成功。全10種×3声の実MP3照合/playing/自然終了、連打/終了後の重複抑止、選択変更/閉じる停止、同時発話最大1、字幕0、例外0、保存不変、fixture以外のパック通信0。published/results.jsonと条件別JSON/画像、checks/chrome-*-published.txtに保存。ローカル確認と同じChrome 157.0.8103.51の隔離context、serviceWorkersを停止した検証fixtureを使用。実スマホ/人間の実聴は未確認。

GitHub commit status/workflow runは0件。CI合格とは読み替えず、mergeable=trueと対象headを確認して通常mergeした。Hook/保護/権限設定の変更・迂回なし。公開記録のmain取り込みとcleanな今回worktree削除の最終結果は、本人指定の C:/Users/futsa/bibi-bridge/outbox/20261116-idname-wiring-status.md に記録する。元root/他worktree/共有依存は保持。今回node_modulesは実ディレクトリ、Junction作成なし。local mainは別worktreeで使用中のため触らず、今回専用HEADとorigin/main・remote mainの一致を確認して後片付けする。
