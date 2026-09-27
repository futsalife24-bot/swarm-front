# Fenrir戦闘台詞6本の追加

2026-09-27。ユーザー採用済み台詞を同じFenrirで生成・実装。base deab32886de99501d9ff6b02c5727df1afbe8dbd、branch codex/fenrir-battle-lines、既存balance-t7 worktree。GitHub https://github.com/futsalife24-bot/swarm-front 。

| 場面 | 台詞 | 発声条件 |
|---|---|---|
| 次WAVE | 次が来るぞ！ / よし、迎え撃つ！ | battle中のwave増加時25%。初回/復帰は対象外。前回の発声と交互 |
| 被弾 | ぐっ！ / ちっ、やるな！ | 自分の生存中HP減少時30%。抽選間隔4秒、内訳75%/25%。回復・死亡・他人の被弾は対象外 |
| 射撃 | くらえっ！ / 押し返すぞ！ | 2秒以上自分のshotがない後の実shotで15%。抽選間隔12秒、前回の発声と交互 |

既存の共通間隔6秒（大型警告後10秒）、音量・休止/切断/非表示処理を維持。新しい被弾/射撃の抽選機会は共通間隔中でも消費し、後から発声しない。同時イベントの優先順は大型警告→次WAVE→被弾→リロード→援護→通常射撃。上位イベントが無発声を選んだ場合、下位で抽選し直さない。通常射撃/次WAVE/被弾は自分だけ。ゲームルール、セーブ、通信プロトコル、別声設定は変更なし。

サウンドテストは合計11台詞。6本追加で432,264 bytes。PCM16/mono/24kHz、長さ1.08〜2.00秒、飽和サンプル0。原本はassets-src/voice-fenrir-battle、再生成条件・SHA256はgeneration.json/files.json。出荷版は既存同様byteRateだけを48000へ整合化し、PCMは変更しない。生成モデルはUIでgemini-3.8-flash-tts、声Fenrir。APIキー作成・契約変更なし。実請求額・Codex実行モデルID/effortは未確認。

自己検証: client/worker型成功、関連7ファイル66件成功（追加9件、実シミュレーションのwave進行/shot、確率境界、連射抑制、復帰、新run、大型優先を含む）。音声の主観的聴感・物理Androidは未確認。独立監査・公開はこれから。
実IAB: 設定→サウンドテストに11台詞表示、追加6本が全てended=true/error=nullで完走。docs/evidence/fenrir-battle/playback.json とsound-test.png参照。ローカル5199は旧キャッシュ表示が残ったため、別検証origin5273で最新UIを確認。
