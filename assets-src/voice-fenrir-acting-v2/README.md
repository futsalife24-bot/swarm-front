# Fenrir 演技ボイス・採用版6本

2026-09-30にユーザーが改訂2の全6本を試聴し採用。「まずいな……！」の冒頭の息を呑む演技も明示的に許容しているため保持。

- `*-source.wav`: Gemini 3.8 Flash TTS / Fenrirの生成原本。
- `generation.json`: 台詞と実際の演技指示。
- `manifest.json`: 出荷対象は各項目の`previewSha256`に一致する試聴版。
- 出荷先: `public/assets/audio/voice-fenrir-v1/{id}.wav`。既存11本と同じ既定声で、3声切替は保留。
- 加工: PCM16/mono/24kHzのbyteRateを補正、一定ゲインでピーク0.85、前後の低レベル部を短縮（先頭30ms/末尾60msを保持）。速度・ピッチ変更なし。

再現はこのフォルダーを一時ディレクトリへコピーし`node build-preview.cjs`を実行。生成された`*-preview.wav`のSHA256を採用manifestと照合して使用する。元フォルダーで実行するとmanifest/試聴HTMLが更新されるため、原本を保持して一時ディレクトリで行う。

以前の試聴素材は親フォルダー`references/soldier-voice-gemini/`に保持。ゲームは採用した改訂2だけを参照する。
