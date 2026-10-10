# Windows再検証（2026-10-10）

実装SHA: b35b912043c387adf95343f348cb58f2ab383c5c。base main: ad779114fe2219ae97c393a3cb41ef8ec8bb6812。

- npm ci 成功。既存lock由来のaudit high 5件は依存変更せず記録。
- npm run typecheck 成功（client/Worker）。
- npx vitest run tests/soldier-voice.test.ts tests/soldier-playback.test.ts 成功、30テスト。
- npm run build 成功（178 modules）。npm run server:build 成功（Worker dry-run）。
- 全11WAV: 24kHz/mono/16bit、原本区間PCM一致、クリッピング0。manifest参照。
- scripts/check-young-soldier-voice.mjs: Windows Chrome/d3d11、844×390、従来版のサウンドテストで11本の再生完走/デコードエラーなし、HTTP取得ハッシュとmanifest一致。
- /frontでは実Sound/WebAudioと実worldイベントの有限fixtureで全11デコード、接近警告1.08秒再生、AudioContext running、stop後speechなし。
- ローカル分析送信の既存CORS失敗2件をbrowser-verification.jsonへ保持。console error 0とは扱わない。音声変更に関係するエラーなし。

人の聴感、全台詞の発音/演技、実スマホ性能、通常戦闘全場面は未確認。本人の声の方向性採用を全11聴感確認と混同しない。Codex音声入力は利用不可、実モデルID/推論設定未確認。
