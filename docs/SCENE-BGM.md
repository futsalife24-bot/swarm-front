# 7曲のシーンBGM（2026-09-16）

ユーザー指定Driveの7曲を原本のまま `public/assets/audio/bgm-v1/` へ保存。曲名と配置は同フォルダーREADME。音楽制御は `src/client/bgm.ts`、ソロ/協力の画面切替とSoundの既存音量に接続。エネミーレポートは開閉時に切替、同じ基地曲の画面間やロビー再描画では再開しない。戦闘・訓練・敗北は未提供のため無音。設定・チュートリアル等のダイアログは元の曲を維持。

ストリーミング用audioは1個のみ。初回操作後に再生、既存音量×0.55、0で停止/ミュート、非表示時停止。再生拒否は次の操作で再試行。ソロの旧オシレータ勝利音は撤去し、7.6秒の提供クリア音を1回再生して勝利曲へ。協力の3.2秒クリア表示から結果へ遷移しても音は途中で切らず、終了後に勝利曲。結果から離れた時は新画面を優先する。戦闘ルール・保存形式・画面レイアウトは変更なし。

## 検証

- 型チェック、既存戦闘音単体15件成功。
- `scripts/check-bgm.mjs`: 実Chromeでタイトル/レポート実UI、基地、場面切替fixture、同曲継続、音量0/復帰、勝敗分岐、7.6秒クリア終了後勝利曲、7ファイル実デコード/非無音確認。visibilityはheadless上のイベントfixtureで確認し、実OSの非表示確認とは区別。
- `scripts/check-bgm-coop.mjs`: 実ローカルWorker/WebSocketで出撃準備→協力ロビー再生→戦闘停止、pageerror 0。検証用WorkerだけALLOWED_ORIGINSに5367を指定。
- 証拠: `dist-validation/bgm/checks.json`, `coop.json`, `coop-lobby.png`。
- 音源は原本維持。ループ境界の完全シームレス化・実機スピーカーでの主観的音量/音質・iOS/Android実機は未確認。ブラウザの自動再生制限により最初の操作前は無音。

監査・main反映・公開は後続記録を参照。

## 追加検証とPWAキャッシュ

ストリーミングMP3のHTTP 206をCache APIへ保存しないよう `public/sw.js` を最小修正。200応答のキャッシュ容量超過でも取得済み音源の再生を阻害しない。`scripts/check-bgm-cache.mjs` で206/200/容量エラー3条件成功。`scripts/check-bgm-built.mjs` で実配布ビルドのタイトル→レポート→基地→育成→準備、再読込後の音楽、実Service Worker制御下でRange 206/1024 bytes成功（pageerror 0）。初回育成説明を閉じる等、テスト導線修正後に成功。外部Turnstileのローカルnetwork deniedは既存環境制約でBGMには無関係。

独立監査: https://chatgpt.com/c/6aaa8b4d-7f00-83ee-ab1a-c60f7cc85172 、PR #28。初回対象e1ff743、追加キャッシュ修正160ce20。最終合格待ち。
