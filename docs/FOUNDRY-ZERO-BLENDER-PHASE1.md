# FOUNDRY ZERO — Blender Phase 1 / local prototype

> 最新: ユーザー追加依頼により25%拡大・脚詳細化済み。高さ6.9666m、18,680tri、5材質、1,035,912bytes。以下は初回記録として保持。最新の検証・変更は docs/FOUNDRY-ZERO-POLISH.md を参照。

## 範囲・参考
中央の炉心、環状搬送路、6本の支持脚、トラス・煙突・非対称クレーンと搬送荷を採用。工業白・暗い鋼材・警戒黄・アンバーの熱源で歩く工場を表現。
主参考: このチャットのPhoto 3コンセプトシート。HOUND v3の再生成・材質バッチ・開発query・失敗fallback・検証方式を継承。HOUND成果物は変更なし。通常モデルの正式置換、commit/push/merge/公開/production反映なし。

## 成果物
- `assets/blender/scripts/build_foundry_zero_v1.py`
- `assets/blender/source/foundry_zero_v1.blend`
- `public/assets/enemies/foundry_zero_v1.glb`
- `docs/FOUNDRY-ZERO-BLENDER-PHASE1.md`
共通: phase1_common.py / check_enemy_phase1.mjs / record_enemy_phase1.mjs / preview-enemies/index.html / src/client/enemy-glb-debug.ts。render.tsへ開発queryと同期処理だけを追加。

## 数値
- triangles: 13856
- materials / meshes: 5 / 5
- GLB: 757892 bytes (740.13 KiB)
- glTF bounds min: [-4.014999866485596,0,-3.440000057220459], max: [3.6649999618530273,5.573287010192871,3.440000057220459]
- current bounds: {"min":[-2.640751361846924,0.04814419522881508,-2.25],"max":[2.640751361846924,4.800000190734863,2.25]}
- ground/hover clearance: 0m。Blender Z-up / forward +Y → glTF Y-up / forward −Z。unit scale=1、追加runtime補正なし。
- 脚底をY=0へ接地。 既存インスタンス行列を使い、敵AI/HP/hitbox/waveは変更なし。

## ローカルで確認
- npm run dev -- --port 5198
- http://127.0.0.1:5198/?debugFoundryGlb=v1 （=1も有効）→通常操作で出撃。FOUNDRY ZERO v1 / Currentボタンで往復。
- http://127.0.0.1:5198/assets/blender/preview-enemies/index.html?enemy=foundry_zero
- 比較は画面左GLB・右Current。正面・側面・斜め・シルエットを切替可能。
- Blender再生成: blender.exe --background --factory-startup --python-exit-code 1 --python assets/blender/scripts/build_foundry_zero_v1.py
- 検証: node assets/blender/scripts/check_enemy_phase1.mjs foundry_zero

## 検証結果
Blender生成 / .blend保存 / GLB export / 再読込 / bounds・tri一致 / 非退化三角形 / 正のunit scale 合格。テクスチャ0・animation0。typecheck（client+worker）/ build 合格。buildには既存の500kB超チャンク警告。
通常URLはGLB要求0で既存表示。debugでGLB表示、Current往復、実Rendererで読込失敗fallback、World JSON不変、world消去でinstance 0を確認。表示成功経路のJS・console error 0。失敗試験の意図したnet::ERR_FAILEDは別記録。生産buildのJSからdebug専用処理が除外されることを確認。publicのGLBはdistへコピーされるが公開していない。

|体数|各batch count|モデルdraw calls|シーンdraw calls|
|---:|---|---:|---:|
|1|1/1/1/1/1|5|48|
|5|5/5/5/5/5|5|48|
|10|10/10/10/10/10|5|48|
ボスは通常雑魚より少数・大型のため1/5/10体を採用。10体をストレス条件とし、waveへ投入する仕様ではない。 全instance countと描画を確認。全体が画面内に入る保証ではなく、各配置スクリーンショットを保存。
forward dot=1、全モデルがinstance原点より下へ潜らないことを確認。最大体数のCPU描画送信30回平均=0.713ms。Chrome headless ANGLE SwiftShader / 844×390 / DPR1。GPU処理時間・FPS・スマホ実機性能の代用ではない。

## 証拠
dist-validation/foundry_zero-v1/: compare_front/side/oblique.png, prototype_silhouette.png, prototype_gameview.png, prototype_mobileview.png, prototype_mobileview_unoccluded.png, current_gameview.png, prototype_1/10/40_mobile.png（ボスの系列は1/5/10）。blender-validation.json、validation.json、checks.json、artifact-hashes.json、typecheck/buildログ。共通差分と開始ハッシュはdist-validation/enemies-phase1/。

## 残課題・次工程
既存ボスの当たり判定・高さ仕様を維持した縮尺。コンセプトシートの12mをそのまま導入していない。クレーン・炉・脚は静止。
静止材質バッチへ結合済み。論理パーツ名は生成スクリプトとGLB extrasに保存したが、rig・pivot契約・モーションcontrollerは未実装。採用確認後に結合前の論理パーツからモーション試作へ進める。スマホ実機の負荷・発熱・長時間FPSは未検証。造形の正式採否はユーザー判断。

## Git / 保護
branch: codex/home-armory。base/HEAD: 2be699f160c83d641fb68bb1304e4da8059920dc。開始時から多数の未コミット差分あり。今回も未コミット。既存差分はreset/stash/checkoutせず、render.tsは開始時コピーとの追加差分を保存。最終保存照合は共通preservation.jsonを参照。外部Chat監査や正式採用の承認を意味しない。

軽調整回数: 1。初回20,576triの上限超過を検出し、小部品の面取りを省略して13,856triへ。
共通の実ソロ出撃（通常・flag=0・3体debug同時有効）と3体混在Renderer確認に合格。tests/render.test.ts・tests/structure-v2.test.tsは28/28成功。
