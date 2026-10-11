# 材質返却の座標正規化

未変更のきゃらくる `production.py` の許容差を満たすため、材質返却FBXの微小な座標変動だけをinventory正本の座標へ戻した派生FBXを生成した。KITのチェック・許容差・正本・返却設定・ゲームは変更していない。

出力:
- `models/normalized-returns/head.fbx`
- `models/normalized-returns/body.fbx`

## 対応の証明

共通基準のsegmentation-input GLB位置へ、元inventoryと材質返却の全頂点を対応付けた。最近傍距離0.0001未満、第二近傍との差0.0000001超、各面3頂点が相異なること、面キーの重複なし、全faceキー集合の完全一致をassert。頭51,637面・154,911コーナー、胴49,073面・147,219コーナーが一意対応する。

inventoryの頂点・面・向きはそのまま保持し、対応する返却面の各コーナーUVと材質をコピーした。座標修正は全幅約1に対し0.0001以内という上限を設け、実測最大変位は頭0.00001665193、胴0.00002544277。元4K画像パス/ハッシュ、全入力ハッシュ不変、出力SHAは `normalization-results.json`。書出し後に元返却FBXと全コーナーUVを再比較し、**頭・胴とも最大UV差0**を確認。追加検証もexit 0。

## 未変更チェックの実行

派生FBXを再読込し、元の `production.inventory` で読み込んだ正本に対して、実際の未変更 `production.restore_uv` をrotation=(0,0,0)で実行した。

|対象|最大誤差|元チェックの許容差|面数|結果|
|---|---:|---:|---:|---|
|頭|6.143906e-8|1.615561e-5|51,637|合格|
|胴|8.429370e-8|1.549645e-5|49,073|合格|

`normalization-returns.py` が再現用スクリプト。通常実行は既存出力の上書きを拒否する。生成済み検証は末尾 `-- --verify-existing`。全Blender実行はfactory-startup、disable-autoexec、python-exit-code 1を使用。これは形状・UV受け渡しの検証であり、完成モデルの見た目・リグ・公開合格ではない。
