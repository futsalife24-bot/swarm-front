# Fenrir「ちっ、やるな！」声質修正

2026-09-27。ユーザーからこの1本だけ中性的/女性的に聞こえると指摘。Gemini 3.8 Flash TTSの同じFenrirで、若い成人男性の低めの胸声・太い地声・軽いざらつき・語尾を上げない演技を明示して再生成。台詞は変更なし。生成条件と原本はassets-src/voice-fenrir-hurt-v2。

旧hurt-alt.wavと原本は比較用に保持し、カタログと被弾抽選のIDだけhurt-alt-v2へ変更。既存キャッシュを使わない別URL。サウンドテスト表示名/全11台詞、発声条件/確率/間隔、他10台詞、保存/通信は変更なし。

PCM16 mono24kHz、1.84秒、88,364 bytes、飽和0。byteRateのみ原本96000から48000へ整合化、PCM不変。出荷SHA256 5d866e994770c63290b21eae98353d7a675b07df4857db8df9e0451f6e313bfe。音色一致の最終的な主観評価はユーザー試聴待ち。Codex実行モデルID/effortは未確認。Judge入口は既存worktree未導入。

base a929c42261df0ffc4f82b6141aea6fc643dd1cfe、branch codex/fenrir-hurt-timbre、既存balance-t7。GitHub https://github.com/futsalife24-bot/swarm-front 。元gameの別作業差分は保護。独立監査/公開はこれから。
PR107、対象48fcbd51048440d48cba113106e1992fdc5b9622。型・関連30件・確定commit後build/dry-run成功。IABの実サウンドテストで新ID選択/1.84秒完走/errorなし。前回と同じ監査Chat https://chatgpt.com/c/6ab90e59-3c40-83ee-8ba2-2c60ad5f19f3 へ限定ZIP送信済み。
`n限定再監査PASS（対象48fcbd51048440d48cba113106e1992fdc5b9622）、必須P0/P1/P2各0。独立被弾4ケースと新WAVのメモリ内通常速度再生成功。標準30件/全体型/UI追試・聴感判定とは区別。証拠docs/evidence/fenrir-hurt-v2/audit-final.txt。監査後は記録文書のみ。
