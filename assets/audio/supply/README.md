# 現行：鍵とボルトのロック解除SE（2026-11-11）

本人が前回の開蓋音を見送り、「もっとガチャって鍵を開けた感じ」と指定。
[Lock #0191 / Joseph SARDIN](https://bigsoundbank.com/lock-s0191.html) のCC0実録を使用。正規ページで無料・商用・加工・再配布可を再確認。音声リンク https://bigsoundbank.com/UPLOAD/ogg/0191.ogg?v=d 、原音SHA256 `9d2b6abb1ae23c157f34a5abd810b84092b8df2dbf2866660c544dcf477162a3`。
鍵を回してボルトが解除される前半1.28秒/1.30秒から約0.43秒/0.41秒を使用。150Hz以下/6.5kHz以上を抑え、軽い圧縮、頭2ms/末尾40msフェードで二段の機械的な打撃を前へ出した。現行の再生成scriptは0191を使用。以下0053は見送りとなった前回の履歴。

# 補給箱の開封SE原音

- 音源：[Metal box lid #0053](https://bigsoundbank.com/metal-box-lid-s0053.html)
- 作者：Joseph SARDIN / BigSoundBank
- 取得：2026-11-11、正規ページの音声リンク `https://bigsoundbank.com/UPLOAD/ogg/0053.ogg?v=d`
- ライセンス：[CC0](https://creativecommons.org/publicdomain/zero/1.0/)。元ページに無料・商用ゲームへの利用・加工・再配布可、表記不要の明記を確認。任意の出典表示としてここへ記録。
- 原本SHA256：`09668061bfda24f064bce7b48ff8d870e5993ab45e6ab8a9d6fc2b757b383e16`。

金属箱の蓋を3回開閉した実録。先頭の開蓋部分0.245秒から0.405秒間、後半3.775秒から0.44秒間を使用。90Hz以下/4.8kHz以上を抑え、頭2ms・末尾40msのフェードと音量調整、mono PCM16/22.05kHzへ変換した。ピアノ・音階・楽器の合成は加えない。

`node scripts/build-supply-crate-sample.mjs` で `public/supply-reveal/crate-open-pcm.js` を再生成（既存ffmpegが必要）。ブラウザー/Worker/動画の波形レンダーが同じPCMを同期で使う。実再生は既存44.1kHzへ補間し、音量は従来の仕上げ処理で統一。
