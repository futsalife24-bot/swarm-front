# 残響線

『SWARM FRONT』の世界を舞台にした40秒の短編MV。塩湖に立つ第七聴測所で、一本の記録針がRAYの群れを捉える。信号の三音はニ・イ・ホ。夜明けとともに金属の打音から弦と低音へ受け渡す。

聴測塔と記録計はこの映像用にThree.jsで制作した。RAYには本編の `public/assets/enemies/ray_motion_v1.glb` と遊泳クリップ `Locomotion` を使用する。音楽と効果音は `score.py` で波形から合成する。映像の設定は本編のゲーム仕様には含まれない。

## ローカルで再生

リポジトリのルートで実行する。制作環境はWindows、Three.js 0.185.1、Playwright、NumPy、FFmpeg、Chrome。日本語のタイトルは游明朝で描画する。

```powershell
python cinematics/echo-line/score.py output/echo-line/score.wav
node cinematics/echo-line/capture.mjs serve
```

表示されたローカルURLを開いて「再生」を押す。音声の再生位置に合わせて3Dシーンが進む。

## 映像を書き出す

```powershell
node cinematics/echo-line/capture.mjs preview 960
node cinematics/echo-line/capture.mjs render 1920
```

完成映像は `output/echo-line/SWARM FRONT - 残響線.mp4`。1920×816、24コマ毎秒、全960コマ、48 kHzステレオで書き出す。各コマの時刻を指定して描画するため、実行PCの再生速度に依存しない。Chromeの場所を指定する場合は環境変数 `CINEMA_CHROME` を使う。
