# PRISM / RAY — alien design polish

ユーザーの追加依頼「コンセプト画像へさらに寄せ、異形生命体感を強める」に対応。前回の対象PRISMとRAYを順に更新。HOUND追加の任意質問に回答がなかったため、事前に伝えた2体の範囲で実施。FOUNDRY ZEROとHOUNDは変更なし。外部公開・正式置換なし。

## PRISM
均等な薄板の印象を弱め、8枚の大小・厚み・奥行き・角度が異なる浮遊構造に変更。多面体コアの頂点を歪ませ、いくつかの装甲面を浮かせた。独立した石の面、真鍮の下地、暗い断層、青緑の亀裂を形状で表現。背面の磁気支持部と層状の下面も追加。生物の脚・顔を足さず、鉱物建造物の異常な構成として解釈した。
全体高3.006→3.202m、幅2.349→2.661m。細かな丸い留め具を減らし、輪郭と層に予算を移したため4,316→3,528triへ減少。造形の単純化を数値増で埋めない。

## RAY
平坦な翼と直線の菱形枠を変更。前後・上下に曲がる膜、実際に貫通する3領域の裂け目（各側）、曲がった支持稜線、層状の付け根外皮を追加。中央空洞を歪んだ楕円状の骨組みにし、上端の外皮と接続。3本の尾は太さ・曲がり・長さ・発光節を変えた。顔・眼・魚の頭部なし。
初回8,922triを検出し、分割数の整理で7,718triへ。画像レビューで中央輪の独立部品感が強かったため外皮との接続を1回調整、最終7,838tri。最下点はローカル0.32m、飛行高さは既存hornet変換のまま。

## 最終数値
|対象|triangles|材質 / mesh|GLB bytes|1/10/40体のモデルdraw calls|
|---|---:|---:|---:|---:|
|PRISM|3528|4 / 4|231876|4|
|RAY|7838|4 / 4|192232|4|

## 検証
各体のBlender生成・保存・GLB export/reimport、非退化三角形、正のunit scale、bounds一致、浮遊クリアランス成功。画像テクスチャ・animation clip 0。実Rendererで通常GLB要求0、debug切替、Current往復、読込失敗fallback、World JSON不変、1/10/40体、消去時instance 0確認。シーン全体47 draw calls。forward dot=1。client/worker typecheck・buildは各体とも成功。既存の500kBチャンク警告あり。
PRISM: bounds={"min":[-1.29099702835083,0.1599999964237213,-0.6179999709129333],"max":[1.3702367544174194,3.202002763748169,0.7754244804382324]}; 40体CPU送信30回平均0.960ms。
RAY: bounds={"min":[-2.1760056018829346,0.3199999928474426,-0.9733927249908447],"max":[2.175833225250244,1.8462607860565186,2.6068265438079834]}; 40体CPU送信30回平均1.057ms。
Chrome headless SwiftShader / 844×390。GPU FPS・スマホ実機性能ではない。通常描画・AI/HP/hitbox/wave・renderer/adapterコードは今回一切変更なし。アニメーションに依存する浮遊や遊泳の生命感は次工程。

## 比較・限界
前回版の生成スクリプト/.blend/.glbをdist-validation/alien-polish/before/へ保存。prism-before-after.png、ray-before-after.pngは左が今回、右が前回。各detail.png、既存のdist-validation/prism-v1/とray-v1/に正面・側面・斜め・シルエット・ゲーム・mobile・各体数画像とvalidation.json。
静止シルエットと部材配置の改善であり、異形感の正式採否はユーザー判断。PRISMは非生物的なSTRUCTUREを維持。RAYの膜の穴や層は正面遠景で潰れやすく、全角度で細部の識別を保証しない。リグ・可動pivot契約・モーションcontrollerは未実装。

## 変更ファイル・Git
- assets/blender/scripts/build_prism_v1.py
- assets/blender/source/prism_v1.blend
- public/assets/enemies/prism_v1.glb
- docs/PRISM-BLENDER-PHASE1.md
- assets/blender/scripts/build_ray_v1.py
- assets/blender/source/ray_v1.blend
- public/assets/enemies/ray_v1.glb
- docs/RAY-BLENDER-PHASE1.md
追加: assets/blender/scripts/check_alien_polish_images.mjs、本書。
branch=codex/home-armory、base/HEAD=2be699f160c83d641fb68bb1304e4da8059920dc。今回も未コミット。commit/push/merge/公開/production反映/reset/stash/checkoutなし。baseline/preservation/artifact-hashesと今回だけのscript.patchをdist-validation/alien-polish/に保存。
