# HOUND / VOLLEY・HOUND / LEAPER 成長殻リデザイン候補 grown-v1

2026-09-26。ユーザー指示「HOUNDとLEAPERの作り直し」「素材感は気に入ってるので他のANOMALYに流用できるように」。

## 採用判断（2026-09-26 ユーザー決定）

- **VOLLEY（ant）は旧デザインを続投**。`volley/` の成長殻候補は不採用のまま参考として残す。
- **LEAPER（spider）は成長殻候補を採用**し、`public/assets/enemies/leaper_motion_v3.glb` として読み込み先を切り替えた（v2は履歴として残置）。
- 2体の差別化は、形に加えて**動き（見た目のみ）**で行う。ゲームの判定・速度・跳躍・攻撃時刻は変えない。

## 動きの差別化（LEAPERのみ。VOLLEYは現行のまま）

|状態|VOLLEY（現行）|LEAPER（今回）|実装|
|---|---|---|---|
|移動|5脚をずらした小走り|前2脚・後3脚がそろって地面を蹴る跳ねる走り。胴が大きく上下・前後に揺れ、棘は後ろへ寝る|GLBの `Locomotion` を差し替え（周期0.8秒・1周期0.72mの契約は維持し、足滑りなし）|
|跳躍|（跳ばない）|蹴り出し→脚を畳む（前脚が上へ折れる不自然な畳み方）→前脚を伸ばして着地|GLBに `Leap`（0.9秒）を追加。`render.ts` が権威側の `jump` 進行度を渡し、`structure-motion.ts` が再生|
|待機|背骨板がゆっくり揺れる|低く構えて体を左右に振り周囲を探る。棘が周期的に逆立って扇状に開く|`enemy-idle-clip.ts` にLEAPER分岐|
|攻撃予備動作|しゃがみ＋輪の収縮|後ろを沈め胸を持ち上げる溜め＋棘を全開に扇状に広げる|`enemy-windup-clip.ts` にLEAPER分岐|

協力プレイでは `jump` が通信に含まれないため、参加者側の画面では跳躍中も従来どおり移動アニメーションになる（既存の制約。通信は変更していない）。

## 状態

|項目|内容|
|---|---|
|状態|LEAPER：採用決定・ゲームへ接続済み（未公開）。VOLLEY：不採用（旧デザイン続投）|
|対象|`ant`（HOUND / VOLLEY, `hound_motion_v1.glb` SHA-256 `ab0d39eb…3a88`）、`spider`（HOUND / LEAPER, `leaper_motion_v2.glb` SHA-256 `f277b504…3f01`）|
|branch・開始HEAD|`claude/hound-leaper-redesign`、origin/main `7825437`|
|採用ファイル|`public/assets/enemies/leaper_motion_v3.glb`（LEAPERのみ）。VOLLEYの `hound_motion_v1.glb` は変更なし|

## 問題と方針

現行の2体は、箱型パネル・発光ライン・浮いた板で構成された「工場製の戦闘ロボット」に見えた（造形正本 第1節で標準形にしないと定める形）。さらに2体は骨格・寸法・動きがほぼ同一で、色と装飾でしか区別できなかった（第2節の「別種は輪郭で識別」に反する）。

方針：**骨格・動き・材質はそのまま、形だけを作り直す。**
- 20骨・骨名・Idle / Locomotion / Lunge は `assets/blender/source/hound_motion_v1.blend`（読み取りのみ）から継承。ゲーム側の手続き的な待機・予備動作クリップ、GPUパレット、読み込み条件はそのまま動く。
- 材質4種（shell / spine / edge_metal / ring_emission）は現行LEAPERのテクスチャと完全に同じもの。共通ライブラリ `assets/blender/library/anomaly-hardshell-v1/` へ切り出し、他ANOMALYでも使えるようにした。
- 形は箱をやめ、先細り・湾曲・重なり合う「成長した外殻」にした。

## 個体設計

|項目|VOLLEY（ant）|LEAPER（spider）|
|---|---|---|
|仮称の考え方|現行表示名を維持（名称変更は提案しない）|同左|
|模倣対象|水鳥の脚と胸骨、四足獣の後肢|跳ぶ獣の後肢、壁をつかむ前肢、逆立った首の毛|
|不完全さ（主役の異常）|① 頭の位置が「封じられた胸」で、顔がない ② 背骨が体から離れて浮いている|① 首の毛にあたる部分が、体から浮いた棘の束になっている ② 跳ぶための後肢が太いのに、骨の長さは歩く獣のまま|
|体の構成|低く長い胴。背に重なり合う淡色の鱗板と側面の鱗板。細長い鳥脚（棘の足先・後ろ向きの蹴爪）と太い獣の後肢3本。肩に縦の発光輪（射出器官）と、それを支える2本の角|短く背の高い胴。大きく持ち上がった肩甲板。黒い胸に縦の発光器官。前肢は重く、3本の鉤爪。後肢の腿が大きく膨らみ、踵に蹴爪|
|素材|淡色の鱗板（spine）＋黒い下地・関節（shell）＋青灰の脚（edge_metal）＋シアンの線（ring_emission）|同左（胸を黒くして正面の見分けをつける）|
|攻撃との対応|輪が射出器官（3発の散射）。予備動作ではゲーム側の手続き的なクリップが輪と背骨を動かす|跳躍・壁待機はゲーム側の座標更新のまま。鉤爪と後肢の膨らみで「つかむ・跳ぶ」を読ませる|
|他種との差別化|正面：淡色の胸と頭上の輪。側面：低く長い、浮いた背骨板|正面：黒い胸の発光器官と持ち上がった肩。側面：背が高く、棘の束が後ろへ流れる|

## 変更しない仕様

HP・速度・当たり判定半径・高度・移動方式・攻撃判定・発射位置/時刻（ant 散射のwind 0.8秒、跳躍0.9秒・高さ3.5m）・標的選択・AI・通信・報酬・wave。`src/` と `server/` のコードは一切変更していない。

## 検証（自動）

`evidence/loader-checks.txt`：ゲームの `hound-motion.ts` と同じ条件（SkinnedMesh 4、骨20、bindMatrix/matrixWorld一致、クリップ3種）を満たし、骨名は現行と完全一致。全クリップを25時点サンプリングし、スキニング後の最下点は0.000m（地面へのめり込みなし）、非有限値0。

|モデル|三角形|GLB容量|SHA-256|
|---|---:|---:|---|
|現行 VOLLEY|5,128|0.6 MB|ab0d39eb…3a88|
|現行 LEAPER|12,312|4.3 MB|f277b504…3f01|
|候補 VOLLEY|12,560|3.6 MB|f34cf783…5cd6|
|候補 LEAPER|12,716|3.6 MB|c1931f86…40ac|

VOLLEYは現行が無テクスチャのため、テクスチャ9枚ぶん容量が増える（約+3.0MB）。描画回数は現行と同じ材質4回。スマホ実機のFPS・発熱は未測定。

## 検証（画像を見て確認）

- `evidence/cmp_*_old.png` / `cmp_*_new.png`：同じカメラ・同じ縮尺・同じ時刻の現行/候補4方向比較。
- `evidence/*_walk.png` / `*_lunge.png`：移動・攻撃中のポーズ。部位の貫通・破綻なし。
- `evidence/ingame-{old,new}-{game,near,pack}.png`：実際の `Renderer` と敵ローダーでの表示（灰明の街区、通常カメラ／近距離／12体の群れ）。採用GLBは撮影中だけ一時的に差し替え、撮影後に `git checkout` で戻した。

## 未確認・残り

- 独立監査・main反映・公開は未実施。
- 既存の失敗テスト4件（aim / maps / stages / weapon-stat-marks）は、手を加えていないorigin/mainでも同じく失敗することを確認済み。今回の変更とは無関係。
- 動画での動作確認（静止画の複数時刻のみ確認）。
- LEAPERの胸の発光器官が「目」に見えないかは、ユーザー判断が必要。

## 再生成

```powershell
& "$env:LOCALAPPDATA\Programs\Blender Foundation\Blender 5.2\blender.exe" --background --factory-startup --python-exit-code 1 --python assets/blender/candidates/hound/grown-v1/build_candidate.py -- volley
& "$env:LOCALAPPDATA\Programs\Blender Foundation\Blender 5.2\blender.exe" --background --factory-startup --python-exit-code 1 --python assets/blender/candidates/hound/grown-v1/build_candidate.py -- leaper
```

Blender 5.2.1 LTS。乱数不使用（形状は全て決定的）。出力は `volley/` `leaper/` 内の `.blend`・`.glb`・`validation.json` のみ。
