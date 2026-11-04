# タタラ試作02：手首・生き物らしい動き・黄と紫

2026-11-04。本人からの「可動域が狭い」「掌を前へ、が手を上げただけ」「下向きの掌を手首から正面へ」「色を鮮やかに」の修正依頼と、配色の回答「黄・紫を主体に試作」に対応した改訂版。

[確認資料](review.html) ／ [12秒動画](review/tatara-motion.mp4) ／ [初版との比較](review/revision-comparison.png) ／ [正面の掌](review/palm-front.png)

## 修正内容

- 前腕と掌を別の骨に分離。肩・肘・手首を独立して動かす。普段は掌が地面へ向き、構え→手を離す→手首を約90度返す→掌を正面に向けたまま22cm押し出す→戻して接地、の順に変更した。
- 脇へ体重を移し、腰を落としてから押し出す。肘は外側へ曲げ、構え時の前腕の床への沈み込みを解消した。
- Idle：胸の呼吸、左右の重心移動、独立した首の見回し。Follow：左右の踏み替え、掌を10cm持ち上げる遊脚、前後17cmの歩幅、胴体の上下動と揺れ。Root移動は含まず、実際の追従位置と速度制御は統合担当へ引き渡す。
- 岩殻を鮮やかな紫、腹・顎と掌面を黄色、関節を濃紫に変更。掌面の色差で向きを確認できる。白い二本線は維持。黄・紫は今回の外観選択であり、電撃等の属性を正式に割り当てたものではない。
- 初版 `../tatara-lowpoly-v1/` は無変更で保存。ゲーム本体、共有STATE、MainVault、他担当の作業へ変更なし。main統合・公開は行わない。

## 納品物と軽量化

|項目|改訂版|初版|
|---|---:|---:|
|三角形|1,924|1,796|
|材質・描画用メッシュ|1・1|1・1|
|骨（root含む）|11|8|
|テクスチャ|0枚|0枚|
|透明・発光・粒子|なし|なし|
|GLB容量|394,576 bytes|332,424 bytes|
|編集用blend容量|290,944 bytes|164,564 bytes|

増分は独立手首・掌面の形と、左右の肘・首の骨。材質数とモデルの描画回数は増やしていない。
編集原本 [tatara.blend](tatara.blend)、ゲーム用 [tatara.glb](tatara.glb)。1 skinned mesh／1 primitive／頂点色・不透明。
幅1.35m、原形の高さ約0.659m。製品の兵士GLBは縮尺1で比較。Idle約3.03秒、Follow約1.43秒、Palm約2.83秒。

## 実際の確認

- Blender 5.2.1 LTSで生成・保存し、GLBを別途再読込み。形状の境界差0m、1,924三角形・11骨・1材質・頂点色・不透明・3動作を確認。[roundtrip.json](review/roundtrip.json)
- 再読込みしたPalmで、掌の表面法線が待機時 `(0,0,-1)`、押出し時 `(0,-1,0)`、終了時 `(0,0,-1)` に戻ることを検査。これはBlenderのZ-up／正面-Y。角度約90度。手首位置は構え時Y=-0.22mから押出し時Y=-0.44mへ前進し、押出し区間の高さZ=0.42mを維持。「上げるだけ」でないことを方向と位置の両方で確認した。
- 動作中の頂点変位：Idle最大約0.058m、Follow約0.186m、Palm約0.710m（検査したフレーム間）。初版の約0.016／0.066／0.283mから拡大。3フレーム刻みの全動作検査では最低点約0.015m、床下への沈みなし。斜面・段差・速度変化への接地は未検証。
- Three.js 0.185.1／Chrome 156.0.8078.80で、正面・左右のうち動作側の側面・背面・斜め・兵士比較、待機・歩行・掌返しを画像確認。通常画角65度の独立シーンで844×390／640×360、0・1・4体を比較。[validation.json](review/validation.json)
- 4体は「4人が各1体」の負荷仮定で、製品の確定上限や追従位置ではない。兵士1体・床・グリッドを固定。影なしの全描画回数4→5→8、影あり6→8→14。追加は1体あたり影なし1回／1,924三角形、今回の影あり2回／3,848三角形。影はDirectionalLightの1024²マップ1枚。11骨を各AnimationMixerで更新する。
- CPUのアニメーション更新＋render送信時間はvalidation.jsonに保存。30フレームの準備後120サンプル、devicePixelRatio=1。GPU完了・画面提示・実スマホのフレーム時間ではなく、細かな差は測定揺らぎを含む。実戦性能の保証にはしない。
- 確認動画は12秒／30fps／960×640／H.264、780,766 bytes。待機3秒→歩行3秒→掌返し3秒→動作側の側面3秒。ffprobeで360フレームを照合。640×360の操作確認と、資料ページでの1秒以上の実再生が成功。手順と結果は [check-ui.mjs](check-ui.mjs)・[ui-validation.json](review/ui-validation.json)。ページ例外・最終描画検査のコンソールエラー0。

## 制約と統合担当への引継ぎ

表現は引き続きローポリ。小穴・ひび・細かい岩層・内部構造を省略。指ごとの骨は持たず、掌全体が手首から動く。
通常距離では色と輪郭が主な識別手掛かり。小さい白線、背面の印、兵士や他個体との重なりは識別を保証しない。
属性割当、効果、追従経路、物理、保存処理、ゲーム組込みは実装していない。実スマホ・多人数実通信・敵密集・地形・長時間・属性エフェクト込みの負荷は未確認。

GLBはY-up／前方+Z。製品方向が逆なら親でY軸180度回す。Palmの一回再生・動作間ブレンド、歩行速度同期、地形接地は統合側で制御する。前腕追加により骨構成が初版と異なるので、古い骨名一覧を固定した処理をそのまま使わない。

## 再現手順

専用worktreeのルートから、既存Blender・Node・three/playwright・Python/Pillow・ffmpegを利用。新規インストールなし。

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python assets/buddy/tatara-lowpoly-v2/build.py
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python assets/buddy/tatara-lowpoly-v2/roundtrip.py
node assets/buddy/tatara-lowpoly-v2/check.mjs
node assets/buddy/tatara-lowpoly-v2/video.mjs
ffmpeg -y -framerate 30 -i assets/buddy/tatara-lowpoly-v2/review/frames/%04d.png -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart assets/buddy/tatara-lowpoly-v2/review/tatara-motion.mp4
python assets/buddy/tatara-lowpoly-v2/sheets.py
node assets/buddy/tatara-lowpoly-v2/check-ui.mjs
# 対話プレビュー：http://127.0.0.1:4317
node assets/buddy/tatara-lowpoly-v2/server.mjs
```

ブラウザー確認はローカル通信が許可された同一実行環境でサーバーと既存Chromeを起動する。BlenderはOSサムネイルの書込権限警告があるが、本体の保存・再読込みは成功。最初のリグ試行で腕の到達距離不足を検出し、肘位置を調整。続く接地検査で前腕が床へ最大約5cm沈むことを検出し、肘の曲がる方向を外側に直した。最終証拠は修正後のGLBで取得。

## 担当記録・共有ノートへの追記案

GitHub: https://github.com/futsalife24-bot/swarm-front 。ブランチ `codex/buddy-tatara-lowpoly-20261104`、改訂の開始HEAD `1cdc9bcabdfef82ef2ddf9807313458079177496`。
専用worktree: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-buddy-lowpoly`。
今回の変更対象は `assets/buddy/tatara-lowpoly-v2/` のみ。最終commitはこのフォルダの履歴と完了報告を参照。
素材・検証commit `81bfcf3` を2026-11-04に既存originの専用ブランチへpush済み。後続は本納品記録の追記のみ。
[主担当への納品先](https://github.com/futsalife24-bot/swarm-front/tree/codex/buddy-tatara-lowpoly-20261104/assets/buddy/tatara-lowpoly-v2)。共有ノート未編集、main・本番未反映。

共有STATE／MainVaultは直接編集しない。追記案：「本人修正を受け、タタラの手首を独立化。下向きの掌を90度返して正面へ22cm押出し、呼吸・首・踏み替え・体重移動を追加。本人指定の黄・紫へ配色。初版を保持し、試作02へ納品。属性未割当・ゲーム統合と公開なし。実機未確認。」

主担当の実モデルID・推論設定は取得不可／未確認。サブエージェント・独立監査は不使用。
