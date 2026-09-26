# ANOMALY 硬質外殻ライブラリ v1

HOUND / VOLLEY と HOUND / LEAPER の素材感（淡色の硬い板・黒い下地と関節・青灰の脚・シアンの発光線）を、他のANOMALYでも使えるように切り出したもの。2026-09-26、ユーザー指示「素材感は気に入ってるので他のANOMALYに流用できるように」。

造形の規約は [造形正本 第1・2節](../../../../docs/STRUCTURE-ANOMALY-v2.md) が優先する。このライブラリは材質と部品の道具であり、全種に同じ骨格や装飾を強制するものではない。

## 中身

|ファイル|内容|
|---|---|
|`textures/*.png`|512×512の色・粗さ・法線マップ（shell / spine / edge_metal）。出荷済み `leaper_motion_v2.glb` に埋め込まれている画像とバイト単位で同一|
|`materials.json`|4材質の値。テクスチャ版（LEAPER）と無テクスチャ版（VOLLEY v1）の両方|
|`anomaly_materials.py`|Blender内で材質を作る・既存材質を置き換える・UVを付ける|
|`organic_parts.py`|先細りの肢、湾曲した板、鉤爪、輪、発光線などの部品生成。全て決定的なメッシュで、GLBとゲームで同じ見た目になる|

## 材質の役割

|役割|見た目|glTF名（HOUND系）|
|---|---|---|
|`spine`|淡い灰色の成長した板・骨。**面積の大半をこれにすると、HOUND/LEAPERの明るい印象になる**|HOUND_spine|
|`shell`|ほぼ黒の下地・関節・隙間|HOUND_shell|
|`edge_metal`|青灰の硬化した縁・脚|HOUND_edge_metal|
|`ring_emission`|シアンの発光器官・線|HOUND_ring_emission|

照明に環境マップがないため、金属度の高い `shell` と `edge_metal` は暗く沈む。明るく見せたい面積は `spine` にする（grown-v1 の試作で確認）。

## 使い方（Blender生成スクリプト内）

```python
import sys
sys.path.insert(0, str(REPO / 'assets/blender/library/anomaly-hardshell-v1'))
import anomaly_materials as am
import organic_parts as op

mats = am.create('CALYX')                 # CALYX_shell, CALYX_spine, ... を新規作成
am.apply(existing_mat, 'spine')           # 既存の材質スロットをこの素材に置き換え
leg = op.limb('leg', hip, knee, (.1, .1), (.05, .05), bow=(0, 0, .05), belly=.4)
op.bind(leg, 'leg_upper')                 # 1本の骨に剛体で追従
op.join(skin_object, [leg])               # 材質ごとのメッシュへ結合
am.planar_uv(skin_object)                 # LEAPERと同じテクセル密度のUV
```

書き出しでは `export_texcoords=True` にする（既存の無テクスチャ用設定 `False` のままだと模様が消える）。

## 使用例

- `assets/blender/candidates/hound/grown-v1/build_candidate.py`（VOLLEY / LEAPER 成長殻候補）
