# RAY — Blender Phase 1 / local prototype

> 最新: 異形感を強める追加依頼に対応済み。7838tri / 4材質 / 192232bytes。以下の初回記録は履歴として保持。最新差分は docs/ALIEN-DESIGN-POLISH.md を参照。

## 範囲・参考
中央空洞、海洋生物を誤模倣した左右の湾曲面、3本の独立した尾、藍色の外皮・暗い機械骨組み・冷たい青緑発光を採用。既存hornetの飛行高さへ既存行列で追従。
主参考: このチャットのPhoto 2コンセプトシート。HOUND v3の再生成・材質バッチ・開発query・失敗fallback・検証方式を継承。HOUND成果物は変更なし。通常モデルの正式置換、commit/push/merge/公開/production反映なし。

## 成果物
- `assets/blender/scripts/build_ray_v1.py`
- `assets/blender/source/ray_v1.blend`
- `public/assets/enemies/ray_v1.glb`
- `docs/RAY-BLENDER-PHASE1.md`
共通: phase1_common.py / check_enemy_phase1.mjs / record_enemy_phase1.mjs / preview-enemies/index.html / src/client/enemy-glb-debug.ts。render.tsへ開発queryと同期処理だけを追加。

## 数値
- triangles: 6400
- materials / meshes: 4 / 4
- GLB: 301780 bytes (294.71 KiB)
- glTF bounds min: [-2.0299999713897705,0.41999998688697815,-0.6800000071525574], max: [2.0299999713897705,1.8354233503341675,2.7453105449676514]
- current bounds: {"min":[-1.9810632467269897,0.6800000071525574,-1.323089838027954],"max":[1.9810632467269897,1.1399999856948853,2.705595016479492]}
- ground/hover clearance: 0.42m。Blender Z-up / forward +Y → glTF Y-up / forward −Z。unit scale=1、追加runtime補正なし。
- 浮遊モデルのため接地ではなく原点からの正のクリアランスを確認。 既存インスタンス行列を使い、敵AI/HP/hitbox/waveは変更なし。

## ローカルで確認
- npm run dev -- --port 5198
- http://127.0.0.1:5198/?debugRayGlb=v1 （=1も有効）→通常操作で出撃。RAY v1 / Currentボタンで往復。
- http://127.0.0.1:5198/assets/blender/preview-enemies/index.html?enemy=ray
- 比較は画面左GLB・右Current。正面・側面・斜め・シルエットを切替可能。
- Blender再生成: blender.exe --background --factory-startup --python-exit-code 1 --python assets/blender/scripts/build_ray_v1.py
- 検証: node assets/blender/scripts/check_enemy_phase1.mjs ray

## 検証結果
Blender生成 / .blend保存 / GLB export / 再読込 / bounds・tri一致 / 非退化三角形 / 正のunit scale 合格。テクスチャ0・animation0。typecheck（client+worker）/ build 合格。buildには既存の500kB超チャンク警告。
通常URLはGLB要求0で既存表示。debugでGLB表示、Current往復、実Rendererで読込失敗fallback、World JSON不変、world消去でinstance 0を確認。表示成功経路のJS・console error 0。失敗試験の意図したnet::ERR_FAILEDは別記録。生産buildのJSからdebug専用処理が除外されることを確認。publicのGLBはdistへコピーされるが公開していない。

|体数|各batch count|モデルdraw calls|シーンdraw calls|
|---:|---|---:|---:|
|1|1/1/1/1|4|47|
|10|10/10/10/10|4|47|
|40|40/40/40/40|4|47|
1/10/40体は既存HOUNDと同条件の静止World負荷比較。 全instance countと描画を確認。全体が画面内に入る保証ではなく、各配置スクリーンショットを保存。
forward dot=1、全モデルがinstance原点より下へ潜らないことを確認。最大体数のCPU描画送信30回平均=1.060ms。Chrome headless ANGLE SwiftShader / 844×390 / DPR1。GPU処理時間・FPS・スマホ実機性能の代用ではない。

## 証拠
dist-validation/ray-v1/: compare_front/side/oblique.png, prototype_silhouette.png, prototype_gameview.png, prototype_mobileview.png, prototype_mobileview_unoccluded.png, current_gameview.png, prototype_1/10/40_mobile.png（ボスの系列は1/5/10）。blender-validation.json、validation.json、checks.json、artifact-hashes.json、typecheck/buildログ。共通差分と開始ハッシュはdist-validation/enemies-phase1/。

## 残課題・次工程
静止試作のため空中遊泳はシルエットによる表現。尾の可動化と実機遠景視認性は次工程。
静止材質バッチへ結合済み。論理パーツ名は生成スクリプトとGLB extrasに保存したが、rig・pivot契約・モーションcontrollerは未実装。採用確認後に結合前の論理パーツからモーション試作へ進める。スマホ実機の負荷・発熱・長時間FPSは未検証。造形の正式採否はユーザー判断。

## Git / 保護
branch: codex/home-armory。base/HEAD: 2be699f160c83d641fb68bb1304e4da8059920dc。開始時から多数の未コミット差分あり。今回も未コミット。既存差分はreset/stash/checkoutせず、render.tsは開始時コピーとの追加差分を保存。最終保存照合は共通preservation.jsonを参照。外部Chat監査や正式採用の承認を意味しない。

軽調整回数: 1。外皮先端を収束させた。
共通の実ソロ出撃（通常・flag=0・3体debug同時有効）と3体混在Renderer確認に合格。tests/render.test.ts・tests/structure-v2.test.tsは28/28成功。
