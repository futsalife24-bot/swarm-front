# 第2段階・局所再提出

監査指定の3項目だけを修正/確認。対象は `trooper_stage2_refined.blend`。初回提出版 `submission1/` と第1段階合格版を保持。

## 膝

ウェイトのみの修正では縦の引きつれが残ったため、膝を含む中腿より下（z<0.69m）の面を輪状に組み直した。元の実メッシュ断面にレイを当てて形状を保持し、膝付近には15mmごとにループを配置。前側は大腿へ厚みを残し、後側に曲げを配分。骨のレスト姿勢は変更なし。膝当てをUpperLegへ剛体追従させ、脛と一緒に下へ倒れる状態を修正。60/120度、服のみ/装甲あり、前斜め/側面を保存blend再読込から撮影。

## 腰

当初の黒い箇所は、単なる影と断定できず、布とベルトのずれがあった。ベルト位置をまたぐ大きな面に固定域の頂点がなく、頂点ウェイトだけを変えても補間がずれたため、腰にも高さごとの面の輪を追加。ベルト下の布はPelvis、上はSpine/SpineMid/Chestへ滑らかに配分し、ベルトは胴体だけを測って表面に合わせた。通常照明と同じポーズの低影クレイを提出。

`waist-measurement.json`：ベルト頂点から最近傍布表面まで、立位平均6.42mm/最大10.01mm、丸まり平均6.09mm/最大10.01mm。体メッシュの非manifold辺0。これは距離/位相の検証であり、全身の自己交差を機械的に否定する結果ではない。

## 握り

手袋の拡縮・骨レスト変更はせず、手首/掌の向きと各指の局所ポーズを調整。4指をグリップの長さ方向へ並べ、親指を後ろ側へ対向。指の長さを伸ばさず、グリップの寸法を基準に関節角度を合わせた。可動域の候補から指先接触と深い食い込みを避ける角度を選ぶ。反対側・親指側の補助近接では身体/他の武器/前腕防具を隠し、同じポーズの通常全身表示を併記。

右手の射撃構えとランチャー左手も調整対象となったため、追加画像を提出。ライフル左手の支持ポーズは前回から同じ。

親指を隠していた掌内側の局所的な張り出しも `refine_thumb_web.py` で整理し、`embed_thumb_root.py` で閉じた親指の根元2輪を掌内部へ納めた。全手袋のXYZ外形寸法・関節以降の指形状・骨/ウェイトは保持（`thumb-web-refinement.json` と `thumb-root-refinement.json`）。開手の左右画像を添付。再現時は `refine_knees_waist.py` の直後に `refine_thumb_web.py` → `embed_thumb_root.py` を実行する。

## 保護・再現

`validate_stage2.py -- --source trooper_stage2_refined.blend` 合格。元のメッシュ/15Action全キー保持、変更bindは既承認の32本だけ、表示20スキンメッシュの有限座標/最大4影響/正規化、左右10指の単独影響を確認。

初回候補から `test_knee_attachment.py` → `refine_knees_waist.py` を実行。画像は `render_knee_checks.py`、`render_waist_checks.py`、`render_grasp_checks.py` に `-- --source trooper_stage2_refined.blend` を渡す。数値確認は `measure_waist.py` と `measure_grasp.py`。Pillow入りPythonで `make_revision_boards.py` を実行。

第3段階の連続動作・GLB/runtimeは未着手。全体監査は再提出待ち。
