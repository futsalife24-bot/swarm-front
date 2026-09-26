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

最終方針（LEAPER v3）：
- 20骨・骨名・4 skinned mesh・材質4種は `assets/blender/source/hound_motion_v1.blend`（読み取りのみ）から継承し、形状を成長殻に作り直した。
- **動きは変えた。** GLBの `Locomotion` をLEAPER専用の跳ねる走り方に差し替え、`Leap` を追加（計4クリップ）。待機・予備動作はゲーム側の手続き生成にLEAPER分岐を追加。
- **`src/client` の5ファイルを変更**（`hound-motion.ts`・`structure-motion.ts`・`render.ts`・`enemy-idle-clip.ts`・`enemy-windup-clip.ts`）。`src/shared`・`server` は変更なし。
- 材質4種は出荷済みLEAPER v2の画像と同じバイト列。共通ライブラリ `assets/blender/library/anomaly-hardshell-v1/` へ切り出した。

## 個体設計

|項目|VOLLEY（ant、不採用案）|LEAPER（spider、採用）|
|---|---|---|
|仮称の考え方|現行表示名を維持（名称変更は提案しない）|同左|
|模倣対象|水鳥の脚と胸骨、四足獣の後肢|跳ぶ獣の後肢、壁をつかむ前肢、逆立った首の毛|
|不完全さ（主役の異常）|① 頭の位置が「封じられた胸」で、顔がない ② 背骨が体から離れて浮いている|① 首の毛にあたる部分が、体から浮いた棘の束になっている ② 跳ぶための後肢が太いのに、骨の長さは歩く獣のまま。跳躍中は前脚が上へ折れる、獣とは違う畳み方をする|
|体の構成|低く長い胴。背に重なり合う淡色の鱗板と側面の鱗板。細長い鳥脚（棘の足先・後ろ向きの蹴爪）と太い獣の後肢3本。肩に縦の発光輪（射出器官）と、それを支える2本の角|短く背の高い胴。大きく持ち上がった肩甲板。黒い胸に縦の発光器官。前肢は重く、3本の鉤爪。後肢の腿が大きく膨らみ、踵に蹴爪|
|素材|淡色の鱗板（spine）＋黒い下地・関節（shell）＋青灰の脚（edge_metal）＋シアンの線（ring_emission）|同左（胸を黒くして正面の見分けをつける）|
|攻撃との対応|輪が射出器官（3発の散射）|跳躍・壁待機はゲーム側の座標更新のまま。鉤爪と後肢の膨らみで「つかむ・跳ぶ」を読ませる|
|他種との差別化|正面：淡色の胸と頭上の輪。側面：低く長い、浮いた背骨板|正面：黒い胸の発光器官と持ち上がった肩。側面：背が高く、棘の束が後ろへ流れる。動き：上表の4状態|

## 変更しない仕様

HP・速度・当たり判定半径・高度・移動方式・攻撃判定・発射位置/時刻（ant 散射のwind 0.8秒、spiderの跳躍0.9秒・高さ3.5m）・標的選択・AI・通信・報酬・wave。`src/shared`・`server` は変更なし。

## 現行の検証（最終LEAPER v3、PR91 監査F1への対応）

再現手順：`node scripts/check-leaper-grown.mjs`（ブラウザ側は `scripts/leaper-evidence-page.ts`）。結果は `docs/evidence/leaper-grown-v1/`（`checks.json`・段階ごとの静止画7枚・`renderer-sequence.mp4`）。スクリプトは出荷ファイルと候補のハッシュ不一致、`validation.json` の陳腐化、下記のどれかの不合格で失敗する。

対応付け（checks.json `provenance`）：

|ファイル|bytes|SHA-256|
|---|---:|---|
|`public/assets/enemies/leaper_motion_v3.glb`|3,802,608|`7a57499b4e7ab82c9fe23155f6731d95213a4fb29835eaecf905e9cd939c38e3`|
|`leaper/leaper_grown_v1.glb`（候補・同一）|3,802,608|`7a57499b4e7ab82c9fe23155f6731d95213a4fb29835eaecf905e9cd939c38e3`|
|`leaper/leaper_grown_v1.blend`|3,771,509|`3aa3768bc7eb6eb1349641c05577ff13981ea26f607f4a5d91c46d90cc83235b`|
|`build_candidate.py`|23,073|`eabfc3175a6140f27ce0ee0759a71ac70d241190671e5a7375fdd781ac7e10cc`|
|`assets/blender/source/hound_motion_v1.blend`（入力・不変）|867,126|`765b8731f1582d2f42364a748cfe37f958073c63c7d332192269fa2ac1a919f3`|

ライブラリのテクスチャ9枚は、v2・v3それぞれのGLB埋め込み画像と実バイトで照合し全一致。

ゲーム本体のローダー `loadEnemyMotion("leaper")`（検証と手続き的Idle/予備動作の生成を含む）で読み、全クリップを30Hzでスキニング後の全頂点（11,131）をサンプリング：

|クリップ|長さ|最下点|開始/終了の最下点|ループ継ぎ目|非有限値|
|---|---:|---:|---|---:|---:|
|Idle（手続き生成）|6.0秒|0.000m|0.000 / 0.000|0.000|0|
|Locomotion|0.8秒|0.000m|0.023 / 0.023|0.000|0|
|Lunge（手続き生成）|1.2秒|0.000m|0.000 / 0.000|—|0|
|Leap|0.9秒|-0.051m（空中）|0.000 / 0.049|—（非ループ）|0|

Leapの途中の最下点はその場再生の値で、ゲームでは同じ時刻に胴体が権威側の跳躍高度（最大3.5m）まで持ち上がる。離陸・着地の瞬間は地面より下に出ない（初版Leapは離陸時に0.225m沈んでいたため、生成器で足先を地面以上に保つよう修正した）。骨名はv2と完全一致、4 mesh・20骨・bind一致、4クリップ。

実 `Renderer` でVOLLEY（旧デザイン）と並べ、待機→予備動作→攻撃→待機→跳躍→着地→移動を186フレーム駆動。LEAPERのコントローラ状態は `Idle > Lunge > Idle > Leap > Idle > Locomotion` の順に遷移し、跳躍中の再生時刻は進行度×0.9秒と一致。ページエラー0。動画（6.2秒・186フレーム）は保存後に4時点を取り出して再生内容を確認した。

単体テスト：`tests/structure-motion.test.ts` に跳躍の入力（進行度→時刻、一時停止、着地後の移動/予備動作への切替、複数個体と除去、VOLLEYでの無視と攻撃時刻）を追加。

## 履歴：初期候補の記録（現行の検証ではない）

`evidence/loader-checks.txt` と下表は、Leap追加前・3クリップ時点の初期候補（2026-09-26午前）の記録。最終v3の検証には使わない。

|モデル|三角形|GLB容量|SHA-256|
|---|---:|---:|---|
|現行 VOLLEY（採用中・不変）|5,128|0.6 MB|ab0d39eb…3a88|
|旧 LEAPER v2|12,312|4.3 MB|f277b504…3f01|
|候補 VOLLEY（不採用）|12,560|3.6 MB|f34cf783…5cd6|
|初期候補 LEAPER（3クリップ）|12,716|3.6 MB|c1931f86…40ac|

初期の比較画像（`evidence/*.png`）はリポジトリの規則でcandidates配下のPNGを管理対象外にしているため未コミット。現行の画像は上記 `docs/evidence/leaper-grown-v1/`。

## 未確認・残り

- 独立監査の再監査・main反映・公開。
- 協力プレイの参加者側（`jump` 非同期）の実通信・2クライアント表示。
- スマホ実機のFPS・発熱。
- LEAPERの胸の発光器官が「目」に見えないかは、ユーザー判断。
- 既存の失敗テスト4件（aim / maps / stages / weapon-stat-marks）は、手を加えていないorigin/mainでも同じく失敗する（今回の変更と無関係）。

## 再生成

```powershell
& "$env:LOCALAPPDATA\Programs\Blender Foundation\Blender 5.2\blender.exe" --background --factory-startup --python-exit-code 1 --python assets/blender/candidates/hound/grown-v1/build_candidate.py -- volley
& "$env:LOCALAPPDATA\Programs\Blender Foundation\Blender 5.2\blender.exe" --background --factory-startup --python-exit-code 1 --python assets/blender/candidates/hound/grown-v1/build_candidate.py -- leaper
```

Blender 5.2.1 LTS。乱数不使用（形状は全て決定的）。出力は `volley/` `leaper/` 内の `.blend`・`.glb`・`validation.json` のみ。
