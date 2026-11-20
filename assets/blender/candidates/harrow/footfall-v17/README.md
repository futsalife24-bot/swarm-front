# HARROWの足裏と荷重

左右それぞれの足には、既存の鉤形の爪が四本ある。地面に触れる前に指を扇状に広げ、接地側の足首と腰を下げる。体重を受けたあいだは各爪の下面を同じ平面に保ち、脚が浮いてから指を戻す。立ち止まったときも同じ四点で支える。

リグは既存の足の形状に専用の骨を八本追加した47骨。歩行周期4.2秒、地上速度1.92m/秒、同じ足の着地間隔8.064m。両足で異なる歩行位相を使い、爪は着地のおよそ0.14秒前に開ききる。

Blender 5.2.1でリポジトリのルートから実行する。v14の保存済み原本を読み、指定先に編集できるv17原本と未圧縮GLBを生成する。

```powershell
$footOutput = "dist-validation/harrow-footfall-v17"
& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 --python-exit-code 1 --python assets/blender/candidates/harrow/stride-v15/build_walk.py -- $footOutput --v17
node scripts/optimize-enemy-glb.mjs "$footOutput/harrow-stride.glb" "public/assets/enemies/harrow_motion_v17.glb" --max-texture=2048 --jpeg-quality=92 --meshopt
node scripts/generate-harrow-report-profile.mjs
```

編集原本を開くと `Locomotion` が選択され、0〜168フレームをそのまま再生・編集できる。配信用GLBの足裏・足滑り・歩幅・待機との連続性・図鑑の画角は `tests/harrow-model.test.ts`、発射口は `scripts/check-harrow-launchers.mjs` で照合する。
