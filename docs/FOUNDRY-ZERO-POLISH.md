# FOUNDRY ZERO — size and leg polish

ユーザー追加依頼「もう一段大きく、脚のデザインを書き込む」に対応。正式採用や公開は行っていない。

## 変更
- 全体の寸法を1.25倍、頂点へ焼き込み。高さ5.5733→6.9666m、幅7.68→9.60m。脚先追加も含む奥行6.88→8.9625m。
- 6脚に上下分割の装甲、太い膝軸と固定ハブ、露出した油圧シリンダーとロッド、装甲固定ボルト、ルーバー、上部梁カバー、3分割の足先・滑り止めを追加。
- triangles 13,856→18,680、materials/meshes 5/5維持、GLB 757,892→1,035,912 bytes（約1,011.63KiB）。テクスチャ・アニメーション0。
- 実装変更は生成スクリプトのみ。render.ts、debug adapter、AI/HP/hitbox/wave、HOUND/PRISM/RAYは変更していない。

## 検証
Blender生成/.blend保存/export/reimport、非退化三角形、unit scale、bounds一致、6脚底Z=0成功。Three.js bounds={"min":[-5.018749713897705,0,-4.481249809265137],"max":[4.581250190734863,6.966609001159668,4.481249809265137]}。
1/5/10体の各batch count一致、モデル5 draw calls・シーン48 draw calls。通常GLB要求0、debug表示、Current往復、実Renderer読込失敗fallback、World不変、非表示cleanup成功。forward dot=1。
10体のCPU送信30回平均1.430ms（Chrome SwiftShader、スマホGPU測定ではない）。typecheck/client+workerとbuild成功。既存の500kB超チャンク警告あり。
画像の新旧比較・脚近景を目視確認。hitboxは据え置きのため外形が衝突範囲を越える。正式導入前に照準・接近時の見え方を判断する。静止モデルでモーション未実装。

## ファイル・証拠
更新: assets/blender/scripts/build_foundry_zero_v1.py、assets/blender/source/foundry_zero_v1.blend、public/assets/enemies/foundry_zero_v1.glb、docs/FOUNDRY-ZERO-BLENDER-PHASE1.md。
追加: assets/blender/scripts/check_foundry_polish_images.mjs、本書。
既存版はdist-validation/foundry-polish/before/へ保存。新旧比較before-after.pngは左が今回/右が前回、leg-detail.pngが脚近景。実ゲーム画像・validation.json・blender-validation.jsonはdist-validation/foundry_zero-v1/。
再生成とdebug URLは従来通り（?debugFoundryGlb=v1）。

branch=codex/home-armory、base/HEAD=2be699f160c83d641fb68bb1304e4da8059920dc。未コミットを維持。commit/push/merge/公開/production反映/reset/stash/checkoutなし。保存照合と差分はdist-validation/foundry-polish/preservation.json / model-script.patch。
