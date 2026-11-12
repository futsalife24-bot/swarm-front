# RL-9 実形状に基づくPBRベイクの隔離試作

製品・設計・検査基準は変更していない。画像テクスチャ禁止という現行条件を満たさないため、採用済みや検査合格とは扱わない。追加料金・画像送信・他作品の素材・画像生成AI・依存インストールは使用していない。

## 方法

現行 `heavy.py` と `weapon_kit.py` で同じ部品形状を組み、元の重なるUVを実メッシュ全体で非重複のUVへ整理。塗装の局所的な剥離、金属面の粗さ、形状から得るAOをBlenderの手続きノードで計算し、色とORM（R=遮蔽、G=粗さ、B=金属度）の2枚へ焼く。露出金属は色だけでなく金属度・粗さも変わる。縁はBevelノードの法線と元法線の差から得る。識別インレイと発光材質は画像を割り当てず、元の値を保持する。

過去の平面Noise画像を全材質へ一律に掛ける方式とは異なる。今回は新しい法線地図は作っておらず、地図に焼いた変化は色・遮蔽・粗さ・金属度だけである。

最初の1024px画像2枚の候補は1,188,092 bytesで上限超過したため不採用。ORMを512pxにしJPEG圧縮を調整して上限内にした後、汚れが強く橙が暗すぎる点を修正。Pointinessが広い面へ補間する方式をBevel法線差へ変更した。最終の高解像度版は752,388 bytes。画像付き4材質のglTF乗数は省略値1であり、元の色・粗さ・金属度を二重に掛けてはいない。

追加のベイクをせず、色を線形光で512pxへ、ORMを非色データのまま256pxへ縮小したものが現在の `heavy_0.glb`。元の高解像度版と地図は別名で保持した。

## 確認結果

- 軽量版: 8,020三角形、6材質、最大618,856 bytes。全5等級を隔離フォルダで用意した。
- 元のGLBとの全三角形頂点座標集合、材質別の三角形対応、boundsは完全一致。UV整理に伴う頂点の分裂・順序変更はある。
- 5等級すべてで識別インレイと発光の材質JSONは元と完全一致。製品GLBのSHA-256は前後一致。詳細は `integrity.json`。
- Pythonで再現したweaponBoreは、UVによる頂点重複数の変化により銃口高さが0.172891mm変化した。軸・前端・boundsは一致。製品コードの銃口計算を直接実行した結果ではない。
- コピーした未変更の `check_weapon.py` は終了1。40項目中、画像禁止の失敗1件、500KB目標の警告5件。800KB・三角形・材質・寸法・銃口等のその他条件は通過。コピーと正本のSHA一致も記録した。
- RGBA8と全ミップを仮定した画像格納量は軽量版約1.67MiB/ロード、高解像度版約6.67MiB/ロード。実GPUメモリ測定ではない。5等級の独立ロード時の画像共有、全9丁の合算、スマホは未確認。

主担当作成の `compare.mjs` が、同じ形・照明・カメラの大型表示、製品の詳細プレビュー関数、局所兵士表示を比較する。視覚上の採否、実ゲーム、共有画像、連続動作、性能、実機はこの生成・検査だけでは保証しない。大きな画像で質感差があってもAAA品質の達成とは断定しない。

## 主なファイル

- `heavy_0.glb`: 軽量候補。`heavy_0-high.glb`: 高解像度版。
- `base-512.jpg`, `orm-256.jpg`: 軽量版の地図。`base-1024.jpg`, `orm-512.jpg`: 保持した元地図。
- `bake.py`: 実部品生成、UV整理、PBRベイクとGLB書出し。`make-light.py`: 線形色を守った縮小とGLB再格納。
- `prepare-check.py`: 5等級の隔離検査準備、形状・材質の同一性測定。
- `summary.json`, `integrity.json`: 数値と制約。`check.json`: 未変更の現行検査の保存結果。再実行時は `check-design/out/heavy/check.json` に出る。
- `comparison.png`: 主担当の最終比較。`comparison-high.png`: 軽量化前の比較。

## 再現

作業worktreeをカレントディレクトリにする。Gitに保存したこの資料には最終軽量GLBと比較・検査、再現ソースを含む。高解像度版や中間地図はローカル試作フォルダのみで保持しており、再現時に生成される。未使用の作業コピーでは、この資料の bake.py / make-light.py / prepare-check.py / compare.mjs を dist-validation/astra-pbr-proof/ へコピーしてから下記を実行する。既存Blender 5.2.1、Pythonのnumpy/Pillow、既存Node依存を使う。新たなインストールは不要。`make-light.py` は先行する `bake.py` のモデル・2地図・summaryを必須入力とする。まだ作られていないintegrityと比較画像には依存せず、存在する場合だけ控えを作る。既存の高解像度控えを保護し再利用するため、別候補を試す時は別フォルダを用意する。

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python-exit-code 1 --python dist-validation/astra-pbr-proof/bake.py
python dist-validation/astra-pbr-proof/make-light.py
python dist-validation/astra-pbr-proof/prepare-check.py
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python-exit-code 1 --python dist-validation/astra-pbr-proof/check-design/blender/check_weapon.py -- heavy
node dist-validation/astra-pbr-proof/compare.mjs
```

検査の終了1は現行条件に未適合であることを示し、成功として無視しない。実行権限やローカル配信の許可は環境の正式なゲートに従う。
