# HARROWの地上歩行

## 公開済みのv15

Blender 5.2.1で、保存済みの `biped-v14/harrow.blend` から歩行だけを作り直す。地上速度は0.64m/秒、歩行クリップは4.2秒。片脚が踏み出す回数を3回から1回にし、反対側の爪を支点に運ぶ。脚が伸び切る中間点では腰が少し沈む。

ルートから次を実行すると、指定した作業用フォルダーに編集用のBlenderファイルと未圧縮GLBができる。新しい出力先を指定する。

```powershell
$strideOutput = "dist-validation/harrow-stride-build"
& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 --python-exit-code 1 --python assets/blender/candidates/harrow/stride-v15/build_walk.py -- $strideOutput
node scripts/optimize-enemy-glb.mjs "$strideOutput/harrow-stride.glb" "$strideOutput/harrow_motion_v15.glb" --max-texture=2048 --jpeg-quality=92 --meshopt
```

配信用は `public/assets/enemies/harrow_motion_v15.glb`。ハッシュ先頭16桁を `src/client/enemy-motion-assets.ts` のURLと照合し、`node scripts/generate-harrow-report-profile.mjs` で図鑑カメラを更新する。`tests/harrow-model.test.ts` は実頂点で左右の爪の持ち上げ、着地間隔、接地点、図鑑の画角を検証する。

左右の爪先を配信用GLBから毎秒60コマ、ゲームの表示倍率1.95で測定した。

|観測項目|従来|改修後|
|---|---:|---:|
|同じ足が再着地するまでの前進距離|0.896m|2.688m|
|爪先の前後方向の可動幅|0.641m|1.934m|
|爪先の最低位置から最高位置まで|0.634m|1.997m|
|4.2秒間に片足を運ぶ回数|3回|1回|

全18クリップの時刻・値を比較し、差分は歩行だけ。39骨・描画3バッチを維持している。接地の前後を含め、爪先が地上6cm以下の間の水平位置のずれは最大約4.3cm。従来版の配信URLは既存クライアント向けに保持する。

## 現行のv16

地上で同じ足が着くまでに8.064m進む。左右それぞれが踏み出す周期は4.2秒で、地上の追跡速度は1.92m/秒。空中追跡は0.64m/秒。地上では膝を曲げて腰を沈め、爪を前へ運ぶ。離地・接地の前後は接地中と速度がつながる軌道を使う。

```powershell
$strideOutput = "dist-validation/harrow-v16-build"
& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 --python-exit-code 1 --python assets/blender/candidates/harrow/stride-v15/build_walk.py -- $strideOutput --v16
node scripts/optimize-enemy-glb.mjs "$strideOutput/harrow-stride.glb" "public/assets/enemies/harrow_motion_v16.glb" --max-texture=2048 --jpeg-quality=92 --meshopt
node scripts/generate-harrow-report-profile.mjs
```

配信用の実頂点を毎秒60コマで測ると、左右の爪先の前後幅は約6.12m、持ち上げ幅は約2.00m。爪先の高さが6cm以下の間、進行方向にずれた幅は最大約0.6cmだった。配信用の18クリップのうち歩行だけを更新し、骨39本と描画3バッチを維持する。v14・v15は旧版利用者のため同じ配信先に残す。
