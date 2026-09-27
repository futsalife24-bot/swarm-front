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

独立監査: PR105 / 対象9954105005eb097c9d67ef9452be0fac358df3e3。https://chatgpt.com/c/6ab90e59-3c40-83ee-8ba2-2c60ad5f19f3 へZIP送信・展開開始済み。ZIP 1,561,061 bytes / SHA256 D83FAFB064DCFCC2CFB0FBC497E50D862A5E7BF0FCC4F99512EA03F4EBD5C0E2。確定commit後production build/Worker dry-run成功。Judge入口は未導入のため未判定。

## 独立監査PASS

対象9954105005eb097c9d67ef9452be0fac358df3e3。必須P0/P1/P2各0、任意P3は1。独立ハーネス62件、native Web Audio停止/保護33件、全11WAVデコード、新規6本サウンドテスト完走、限定strict型成功。標準依存取得はDNS障害で、提出66件/全体型/buildの独立再実行ではない。Linux Chromiumの隔離ハーネスでHTTP取得を同一WAVバイトに置換し、DOM/HTMLAudio/Web Audioは実物。物理Android・聴感・新規実通信・PWA配信は監査対象外。全文はdocs/evidence/fenrir-battle/audit-final.txt。

任意O1/P3: 実stepの40tick=2秒ちょうどで浮動小数点差が1.999999999999995となり射撃抽選を見送る場合がある。連呼/遅延/ゲーム進行/保存への影響はなく公開阻害なし。許容誤差と39/40/41tickの回帰は後続候補、今回は合格した実装を維持。
## 公開完了

PR105通常merge、公開ソースmain acde32c19abd6f4630aa3fe16987781a77b244c1、Worker Version 035ab654-a50a-4a22-a254-74606ed97f72。merge後production build/dry-run成功。https://swarm-front.melosalife-24.workers.dev へ既存設定で公開。

[配信検証](evidence/fenrir-battle/release.json): index・JS/CSS・全11WAVの24ファイルHTTP200/SHA一致、health200/ok=true。[公開音声再生](evidence/fenrir-battle/public-playback.json): wave-altが2秒完走/errorなし。公開ゲームを再読込し既存ST1・13秒の中断作戦案内を確認、セーブの再開/破棄は未操作。公開サウンドテスト導線は未操作だが、ローカル実UIで追加6本を全件完走確認済み。以降の公開記録commitは文書/証拠のみで再deployしない。