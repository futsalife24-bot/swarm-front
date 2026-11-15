# 第5弾の検証証拠

- 基点: origin/main 353582993c4a33fe8de23b4c468ea9f23f659718。実装・判断の正本は ../../impl-status-20261114.md の第5弾。
- `pack-inputs.json`: 受信68 WAVのSHA・保存先一致、旧/新パックのクリップ単位比較。各声16件差替、2件追加、削除0。対象外クリップはバイト同一。
- 音声再現: `node node_modules/vite/bin/vite.js --config scripts/vite.voice-probe.config.mjs --port 5206`、`node scripts/measure-voice-fix5.mjs`。Playwrightのchannel=chrome（インストール済み実Google Chrome/headless）を使う。空検証ページで実Sound・実パック・AudioContextを読み、MediaElementAudioSourceNodeの出力をScriptProcessorで48kHz録音。wavは実出力で、オフライン生成した結果ではない。
- `pitch.json` / `tone-*.wav` / `preview-*.wav` / `retire-ack-*.wav` / `tut-intro-*.wav`: 通常と1.3倍で同じ検証音/同じMP3を実再生。40ms窓・20ms間隔、80〜450Hzの正規化自己相関（相関0.75以上、最初の強い局所最大）から有声音の基本周波数中央値を算出。声の抑揚/窓位置差があるため単純波と実声を併用。比較用tone-unpreservedだけ検証器がplay直前にpreservesPitch=falseへ変え、30%上昇を検出できることも確認する。製品には無効化コードを入れない。
- 再生時間の根拠は同じ48kHz録音のframes比（録音ブロック境界と前後100ms程度の余白を含む）。elapsedMsはplaying〜endedのイベント時刻で、イベントループ遅延を含む参考値。特に初回toneはイベント通知が遅れ得るため、その値だけで速度を判定しない。ブラウザー出力信号のピッチ/時間の測定であり、人間の聴感品質を確認したという意味ではない。
- UI再現: `node scripts/check-voice-fix5.mjs <URL> <出力先> --training`。既存の設定、DL、試聴、速度切替、再読込、字幕なし/旧always、ボイスなし、ヨウコ不可、844×390/568×320、最新発話1本制限、進撃リタイア/キャンセル、生存途中退出/キャンセル、訓練開始を実操作する。retireHashは実際にAudioへ渡されたBlobと新版パックのretire-ackを照合。BGMもHTMLAudioElementを使うため、音声監視は管制AIのBlob URLのみ。
- 旧試験器の失敗: 初回Vite読み込みのタイムアウト、BGMのplayを管制AIへ誤計上、初回訓練の誘いが描画される前の分岐は成功として数えない。信号測定の初回はイベント経過時間だけの判定で失敗、録音フレーム比も見るよう訂正。負例の初回は製品のtrue設定より前のfalse上書きで無効だったため、play直前の比較用変更へ修正した。
- `checks/`: 型・テスト・書式・build・dry-run・deployの実結果。最初のtests.txtは旧モックと旧「保留音源は収録もしない」前提の2失敗、完成後のログとは区別する。
- 公開照合: `node scripts/check-voice-fix5-delivery.mjs`。公開ソースSHA埋込、health、JS/CSS/HTML/voice packのSHAを完成distと比較。公開のUI結果はpublished/へ分離。

## 確定した実Chrome信号測定

Chrome 157.0.8103.51、passed=True。

|対象|通常Hz|1.3倍Hz|基本周波数の比|録音時間の比|
|---|---:|---:|---:|---:|
|tone|220.18|220.18|1.0000|1.2857|
|tone-unpreserved|220.18|285.71|1.2976|1.2632|
|preview|275.86|274.29|0.9943|1.3065|
|retire-ack|271.19|271.19|1.0000|1.2817|
|tut-intro|260.87|262.30|1.0055|1.3034|
