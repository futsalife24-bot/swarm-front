# ヨスガ・ローポリ試作01

2026-11-04。タタラ試作02の造形と動きへの本人賛同、および「紫を調整したら次へ」の依頼を受けた次の1体。
タタラとは異なる二足・台形頭・二枚尾で、同じローポリ方針での識別と動きを確認できるためヨスガを選択した。残り3体は制作していない。

[確認資料](review.html) ／ [12秒動画](review/yosuga-motion.mp4) ／ [元絵比較](review/comparison.png) ／ [四方向](review/directions.png) ／ [兵士比較](review/scale.png)

## 元絵と簡略化

指定の `output/buddy-five-20261030-v1/concepts/02-yosuga-v2.png` を実見し、無変更コピーを [concept.png](concept.png) に保存。設計詳細の外見記述も確認した。旧能力・仮数値・由来を今回の決定にしていない。

横長の台形頭、幅広い二枚の板尾、小さな二足を主要な3特徴とした。頭に耳や毛を加えず、外套の細かい層を大きな板へ整理。小穴・傷・細かな内部構造を省略し、目は小さい暗色の形で表現した。胸の白い二本線と片尾の琥珀色スリットを維持。
元絵の茶・琥珀を基調に明るい色面とした。これは外観試作で、属性割当は未確定。琥珀部分に発光・粒子・能力判定を付けていない。

## 納品仕様

|項目|値|
|---|---|
|編集原本|[yosuga.blend](yosuga.blend)、238,025 bytes|
|ゲーム用素材|[yosuga.glb](yosuga.glb)、300,652 bytes|
|三角形|1,380|
|材質・メッシュ|1材質・1 skinned mesh・1 primitive|
|骨|13（root・胴・頭・外套2・尾2・両脚各3）|
|テクスチャ|0枚、サイズ該当なし|
|描画設定|頂点色・不透明・閉じた板、裏面カリング有効|
|大きさ|幅0.60m・原形高0.693m。静止の上端約0.70m|
|動画|12秒・30fps・960×640・H.264、520,389 bytes|

元資料の全高0.60mは仮定。本試作は横長頭と二枚尾を保ちつつ約0.70mで確認した。製品の兵士GLBは縮尺1で並べている。

## 動作

- Idle（約3.03秒）：首をかしげて見回す、胴の呼吸、左右の尾が少し遅れて反応する。
- Follow（約1.23秒）：小刻みな左右の踏み替え。歩幅9cm、遊脚の持上げ6.5cm、胴の揺れを付けた。その場の歩行で、追従経路・root移動は含まない。
- Display（約2.83秒）：軽く沈み、首を向けて、二枚尾と外套を開いて構え、戻る。発動を想定した演技であり、囮・攻撃等のゲーム能力を確定しない。

## 検証と負荷

- Blender 5.2.1 LTSで保存し、GLBを別途再読込み。形状境界差0m、1,380三角形・13骨・1材質・頂点色・3動作を照合。検査フレーム間の頂点最大変位はIdle約5.7cm／Follow約10.1cm／Display約26.1cm。[roundtrip.json](review/roundtrip.json)
- 3フレーム刻みで全動作を検査し、最低点約7mm、床下への沈みなし。平面の足運びは試作段階で、斜面・段差・速度変更・地形への接地は未確認。
- Three.js 0.185.1／Chrome 156.0.8078.80で正面・側面・背面・斜め・兵士比較と3動作を画像確認。最初は尾が棒のように見えたため面の向きを修正し、幅広い板へ変更。胸の識別線は側面で浮かないよう板に寄せた。最終証拠は修正後のGLBで取得。
- 844×390／640×360、devicePixelRatio=1、通常画角65度の独立シーンで0／1／4体を比較。4体は4人各1体の仮定で、ゲームの確定上限ではない。兵士1体・床・グリッドを固定し、バディ数だけ変更。[validation.json](review/validation.json)
- 全描画回数は影なし4→5→8、影あり6→8→14。1体の追加は影なし1回／1,380三角形、今回の影あり2回／2,760三角形。影はDirectionalLightの1024²マップ1枚。13骨をAnimationMixerで更新。透明素材・エフェクトなし。
- CPUのアニメ更新＋render送信時間は同JSONに記録。各条件30フレーム準備後120サンプル。GPU完了・画面提示・実スマホの実戦時間ではなく、微小な差を性能改善の証明にしない。
- 12秒動画は待機3秒→歩行3秒→尾を開く3秒→側面3秒。ffprobeで360フレーム・30fpsを照合。640×360の選択／停止／再開と資料ページの動画再生を確認。[ui-validation.json](review/ui-validation.json)

通常距離の主な識別は台形頭・尾・茶色の輪郭。目や白線だけの識別は保証していない。実スマホ、実戦・敵密集・多人数通信、長時間、属性エフェクト込みの負荷は未確認。モデルの軽さを実戦性能として報告しない。

## 再現と統合

GLBはY-up／正面+Z。製品の向きへ合わせる場合は親のY軸180度回転を使う。動作間ブレンド、Displayの一回再生、歩行速度同期、地形接地、属性の処理は統合担当へ引き渡す。
既存Blender・Node・three/playwright・Python/Pillow・ffmpegを使用。新規インストールなし。専用worktreeのルートから実行する。

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python assets/buddy/yosuga-lowpoly-v1/build.py
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python assets/buddy/yosuga-lowpoly-v1/roundtrip.py
node assets/buddy/yosuga-lowpoly-v1/check.mjs
node assets/buddy/yosuga-lowpoly-v1/video.mjs
ffmpeg -y -framerate 30 -i assets/buddy/yosuga-lowpoly-v1/review/frames/%04d.png -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart assets/buddy/yosuga-lowpoly-v1/review/yosuga-motion.mp4
python assets/buddy/yosuga-lowpoly-v1/sheets.py
node assets/buddy/yosuga-lowpoly-v1/check-ui.mjs
# 対話プレビュー：http://127.0.0.1:4317
node assets/buddy/yosuga-lowpoly-v1/server.mjs
```

Chromeと専用サーバーはローカル通信を許可された同じ実行環境で起動する。複数個体の手動プレビューは同時に4317番を使わず、片方を終了して切り替える。BlenderのOSサムネイル権限警告は本体保存・再読込みへ影響していない。

## 担当記録・共有ノートへの追記案

GitHub: https://github.com/futsalife24-bot/swarm-front 。ブランチ `codex/buddy-tatara-lowpoly-20261104`、開始HEAD `0d7f4831039708a78892ebb0d8908a320c8e492c`。
worktree: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-buddy-lowpoly`。対象は本フォルダとタタラ色調整版 `../tatara-lowpoly-v3/` のみ。元repository・dist-h・他担当の差分を編集していない。
共有STATE／MainVaultは直接編集せず、本節を追記案とする：「タタラの造形・動きの本人賛同を受け紫の彩度を調整。次のヨスガ1体を台形頭・二枚尾・小さな二足で試作し、3動作・素材・画像・動画を作成。ヨスガの外観採用は本人未確認。属性未割当・ゲーム統合・main反映・公開なし。実機性能未確認。」
実モデルID・推論設定は取得不可／未確認。子エージェント・独立監査なし。
