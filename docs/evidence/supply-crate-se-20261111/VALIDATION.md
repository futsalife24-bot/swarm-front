# 補給箱の開封SE差替え（2026-11-11）

本人の「10連をポンポン開ける時のピアノ音が嫌。フリー素材を探すか作って鳴らして」に対応。採用版ADOPTの10連通常箱 `pop/pop_r` がHEAVYに存在せず、標準のpluck/malletへフォールバックし、さらに箱ごとに五音音階で再生速度を変えていた。

## 音の変更

- [BigSoundBank / Metal box lid #0053](https://bigsoundbank.com/metal-box-lid-s0053.html)、Joseph SARDINの実録を使用。元ページでCC0・ゲームへの商用利用/加工/再配布可・表記不要を確認（2026-11-11）。原音OGGとSHA/出典は [assets/audio/supply/README.md](../../../assets/audio/supply/README.md)。音楽やAI生成音ではない。
- 開蓋部分2か所を約0.4秒へ切出し、不要な低域/高域をカットし、頭/末尾をフェード。小さなmono PCM16/22.05kHzをES moduleへ格納し、既存44.1kHz波形へ同期展開する。初回/Worker/動画書出しでも別途音声fetchや非同期decode待ちを作らない。`scripts/build-supply-crate-sample.mjs` で再生成可能、ソフト追加なし（既存ffmpeg）。
- 既定ADOPTのpop/pop_rだけを実録へ置換。coreの該当開封cueはrate1へ固定。各箱の音階上昇を外し、開封タイミング・描画・揺れ・当たりopen3〜5・ほかの音は保持。
- 試聴用 `public/supply-reveal/assets/crate-open-preview.mp3` は新SEだけを10回連続で鳴らす5.2秒サンプル。ゲームの音源はMP3でなくPCMを使用。

## 実際の確認

- `node scripts/check-supply-crate-se.mjs`：波形の有限値・音量上限・末尾ゼロ・長さ、10枠のpop/pop_r cue全rate1を確認。短いPCMのため打鍵音の合成処理を通らない。
- 実Chrome844×390で、本物のruntimeとAudioContextを使った隔離表示fixtureの10箱をタップで完走（2倍速）。AudioBufferSourceNode.startを観測し、実際に鳴らされた10音の長さ/RMSが新波形と一致し、再生速度は全1、pageerror0。`audio-check.json` と `browser-finished.png`。音声APIや出力をモックしない。fixtureは通常箱10個の音検証専用で、本体の排出保証の検証とは別。券/報酬APIなし。
- 符号付きゼロ（-0）を末尾ゼロの不一致とした検証器の初回停止は、絶対値ゼロの判定へ修正して成功。製品波形の不具合とは扱わない。原音波形の分析では未導入matplotlibを使わず、既存Pillow/NumPyで確認し、インストールなし。
- 両TypeScript型成功。JS構文と `git diff --check` 成功。描画式/抽選/券/保存の変更なし。既存62件は前タスクの成功であり、音だけの今回に全件再実行していない。

音の実聴・実スマホは今回未実施。実音声の再生経路・数値確認と、人間による音色の主観評価を区別する。公開のbuild/dry-run/配信結果は [RELEASE.md](RELEASE.md) へ追記する。

主担当gpt-6.1-sol（推論未確認）、素材調査の補助指定gpt-6-sol/medium（実設定未確認）。主担当が正規ページ/ライセンス/ファイルを再確認し、加工・統合・実音声ノードを検証。独立Chat監査ではない。
