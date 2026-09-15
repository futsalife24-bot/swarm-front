# HOUND — Blender Phase 3 / 高精細試作

2026-09-10。正式採用前のローカル試作。HOUND v3の制作・debug比較・自己検証まで完了。正式置換、commit、push、merge、公開、production反映は未実施。

## 参考と造形方針

主参考はユーザー添付 `1-Photo-1.jpg`（HOUNDコンセプトシート）。頭部なし、長い前脚2本＋短い後脚3本、肩の発光リング、3枚の浮遊板、非対称シャーシを採用。明暗の層を分けた装甲、機械関節・基部・カバー、青白いスリット、下面の構造、軽いエッジ摩耗を追加した。写真の細密さを直接再現するのでなく、v2のサイズと静止五脚を土台にテクスチャなしのゲーム用形状へ翻訳した。顔・目・口・牙、犬の頭や昆虫の腹部は追加していない。

- 胴体: v2の傾斜した非対称芯材を残し、6区画の装甲、斜めの前面装甲、下面トレー、サービス部、ベント、継ぎ目を追加。
- 前脚: v2の連続した荷重支持形状を残し、肩ハブ、基部カバー、上・下装甲、関節ハブ、細いアクチュエータ、黒い溝と発光を追加。虫の多節脚へは変更しない。
- 後脚: 接地点XをA −0.70→−0.65、B +0.69→+0.72、C +0.23→+0.06mへ。3本の正面投影間隔を確保。短い支脚へ装甲とハブを追加。
- リング: v2の偏心・傾斜を維持し、暗い外装トラック、前側発光帯、3個のクランプと2本の支持部を追加。正面の円形の印象は残るが、独立した機構として構成。
- 浮遊板: 3枚の幅/奥行/厚みを .72/.28/.13、.59/.25/.16、.49/.31/.12mへ。高さ1.88/2.14/1.60m、X −.20/+.13/−.10m、各3軸角度を変えた。下面部・分割線・片寄った発光スリットも別部材で作成。
- 表面: ベベル、面の切替、重なり、スリット、少数の金属色チップ。高密度の傷やテクスチャは使わない。

## 成果物と今回の変更ファイル

|ファイル|内容|
|---|---|
|assets/blender/scripts/build_hound_v3.py|Blender Pythonによる決定的な形状生成・保存・GLB再読込検証|
|assets/blender/source/hound_blockout_v3.blend|v3ソース、4材料バッチの静止モデル|
|public/assets/enemies/hound_blockout_v3.glb|ゲームdebug用v3|
|assets/blender/preview-v3/index.html|Current / v2 / v3とv2対v3比較、正面・斜め・側面・シルエット|
|src/client/hound-glb-debug.ts|v2/v3ファイル選択と10/4メッシュの検証|
|src/client/render.ts|開発queryによるv3選択と選択版のボタン表示のみ|
|assets/blender/scripts/check_hound_v3.mjs|GLB/通常/debug/切替/1・10・40体/向き/接地/描画数/画像|
|assets/blender/scripts/check_hound_v3_boundaries.mjs|実Rendererの失敗fallback、flag=0、本番JS除外|
|assets/blender/scripts/check_hound_v3_solo.mjs|通常/debugの実ソロ出撃確認|
|docs/HOUND-BLENDER-PHASE3.md|本記録|

v1/v2成果物は上書きしていない。論理的な部材は生成スクリプトに保持し、静止試作の最終出力のみ材料別に結合する。4メッシュへの結合は低draw callsのため。リグ・個別関節アニメーションを含まず、将来の可動化では結合前の部材から別途設計が必要。

## 最終数値

|項目|v2（既存polish）|v3|
|---|---:|---:|
|Triangles|1,532|4,960|
|Materials|3|4|
|Meshes|10|4|
|GLB bytes|91,016|241,136（235.484375 KiB）|
|Texture / animation|0 / 0|0 / 0|
|幅 × 高さ × 奥行 m|2.357 × 2.290 × 3.328|2.432 × 2.277 × 3.328|

v2から幅が約3.2%増加。scaleで補正せず実寸で制作。GLB bounds: min=(-1.2161008, 0, -1.7901044)、max=(1.2161007, 2.2766979, 1.5378206)。

- forward: Blender +Y → glTF −Z。ゲームで既存instance行列に追従し、標的方向とのdot=0.9999999999999999。
- ground: 全5脚の実頂点最下点を結合前にZ=0とassert。出力後・再読込・Three.jsで全体Y=0。40体変換時の地面への潜りなし。
- root/全node scale=(1,1,1)、負スケールなし。1unit=1m。AI・HP・hitbox・wave・pursuit / pressureの役割は維持。

## debugと再生成

既存のローカルViteサーバー（5198）で検証した。サーバーが停止している場合は `npm run dev -- --port 5198`。

- 通常: `http://127.0.0.1:5198/`。既存HOUND、GLB要求0。
- v3: `http://127.0.0.1:5198/?debugHoundGlb=v3`。通常どおりソロ出撃、右上のボタンでv3 / Currentを切替。
- v2: `http://127.0.0.1:5198/?debugHoundGlb=v2`（従来の `=1` も維持）。v2 / Currentを切替。
- 3種比較: `http://127.0.0.1:5198/assets/blender/preview-v3/index.html`。比較は左v2、右v3。Currentも選択可。

ゲーム内は開発環境とqueryの両方が必要。読込完了までは既存表示、失敗時も既存表示でエラー状態を示す。本番JSにdebugローダー/失敗文言/モデル識別子は含まれない。public配下の試作GLB自体は通常buildのdistにコピーされる従来仕様だが、今回の公開はしていない。

```powershell
& 'C:\Users\futsa\AppData\Local\Programs\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python assets/blender/scripts/build_hound_v3.py
node assets/blender/scripts/check_hound_v3.mjs http://127.0.0.1:5198
node assets/blender/scripts/check_hound_v3_boundaries.mjs
node assets/blender/scripts/check_hound_v3_solo.mjs
```

再生成はv3専用.blend/GLB/検証JSONを上書きする。Blender GUIや環境設定の永続変更は行っていない。実行時のsandbox制約を受け、既存Blenderのバックグラウンド実行を権限審査経由で成功させた。

## 検証

- Blender 5.2.1 LTS: 生成、.blend保存、GLB export、GLB再読込すべて成功。非退化三角形、正のunit scale、接地、再読込boundsとtriangle数一致。
- GLB: Three.js実ロード成功、4 materials、4 meshes、テクスチャ0、animation0、全node unit scale、ファイル長ヘッダ一致。
- 通常URL: 既存モデル維持、GLB要求0。debug時: v3表示、Current往復切替成功。World JSONの変更なし。
- 実Renderer読込失敗: 既存モデルを保持、v3非表示、エラーボタン無効化、World不変。
- world消去: v3非表示、全instance count=0。JS例外0。
- 実ゲームタイトル→ソロ出撃: 通常/debugとも成功、GLB要求0/1、JS例外0。
- `npm run typecheck`: 成功。
- `npm run build`: 最終GLB更新後も成功。従来と同種の500kB超チャンク警告あり（JS 681.18kB）。公開操作はしていない。
- `npm test -- tests/render.test.ts tests/structure-v2.test.ts`: 28/28成功。

|表示体数|表示・instance数|モデルdraw calls|シーン全体draw calls|モデルtriangles合計|
|---:|---|---:|---:|---:|
|1|成功 / 各バッチ1|4|47|4,960|
|10|成功 / 各バッチ10|4|47|49,600|
|40|成功 / 各バッチ40|4|47|198,400|

計測は844×390 / DPR1 / Chrome headless ANGLE SwiftShader。既存の実Rendererへ検証用静止Worldを渡したもの。シーン全体draw callsはカメラやオブジェクト配置で変わる（中央の初期1体は43）。40体のCPU描画送信は30回平均約0.87msだが、GPU時間/FPS/スマホ性能ではない。実機の負荷・発熱・長時間FPSは未検証。

## 比較画像・証拠

保存先: `game/dist-validation/hound-v3/`（Git除外）。

- `hound_v2_vs_v3_front.png`: 同倍率の正面、左v2/右v3。
- `hound_v2_vs_v3_oblique.png`: 同倍率の斜め、左v2/右v3。
- `hound_v3_gameview.png`: 実Renderer・1200×720。
- `hound_v3_mobileview.png`: 実Renderer・844×390、プレイヤーによる遮蔽も含む。
- `hound_v3_mobileview_unoccluded.png`: 敵を横へ移し遮蔽を減らした補足。
- `hound_v3_silhouette.png`: 正面単色。五脚の接地点と三つの浮遊部材の輪郭。
- `hound_v2_vs_v3_mobile.png`: 比較用の遠景。
- `hound_v3_1_mobile.png` / `hound_v3_10_mobile.png` / `hound_v3_40_mobile.png`: 各体数表示。
- `solo-normal.png` / `solo-debug.png`: 実ソロ出撃。
- `blender-validation.json` / `three-validation.json` / `boundaries.json` / `solo-validation.json` / `checks.json`: 数値と検証結果。
- `render.patch` / `adapter.patch`: 開始時の既存未コミット内容に対する今回だけの実差分。変更前コピーも保存。
- `baseline.json` / `preservation.json`: 描画2ファイル以外、記録した13ファイル（v2成果物・shared・server）をハッシュ照合して一致。
- `git-status-before.txt` / `git-status-after.txt`: 既存差分を含む作業ツリーの状態。
- `artifact-hashes.json`: 最終成果物のSHA256とbytes。

正面・斜め・シルエット・スマホ幅画像を目視確認。初回のリング発光帯が背面へ隠れる問題を修正し再出力した。比較画像の小さな「Blender」ボタン表記は撮影後に「v3」へ変更、造形・カメラは同じ。

## ゲームへの影響・監査用情報

Branch: `codex/home-armory`。base / 開始HEAD / 終了HEAD: `2be699f160c83d641fb68bb1304e4da8059920dc`。

開始から多数のtracked変更と未追跡ファイルがあり、作業終了時も未コミットのまま。今回の既存編集は `src/client/render.ts` と、開始時から未追跡だった `src/client/hound-glb-debug.ts` の2ファイル。上表のv3ファイルを新規追加。既存差分をreset/stash/checkoutしていない。

描画差分の要点（会話外からも判断できる要約）:

```diff
- debugHoundGlb === '1'
+ ['1', 'v2', 'v3'].includes(debugHoundGlb) // DEV条件を維持
- new HoundGlbDebug(scene, capacity)
+ new HoundGlbDebug(scene, capacity, version) // v3指定時だけv3
- hound_blockout_v2.glb / expected meshes=10
+ hound_blockout_${version}.glb / expected meshes=(v3 ? 4 : 10)
```

アダプターは既存描画のinstance行列・色をコピーするだけ。AI・HP・hitbox・wave・アニメーション本実装、共有ロジック、サーバーに今回の変更なし。モデルは静止のため通常の動きに合わせて滑走する。自己検証は外部Chat監査の代替や正式採用承認ではない。

## 残課題・ユーザー確認点

1. 正面近景の五脚の分離は改善。スマホ遠景やプレイヤーの遮蔽下で短い後脚3本を常時数えられる保証はない。
2. 浮遊板は3枚とも形状・厚み・高さ・角度が異なる。正面の単色ではリングと一部重なるため、全角度で浮遊隙間が読めるとはしていない。
3. リングの独立装置感、明るい装甲と暗いフレームの比率、前脚の圧力感が意図に合うか確認してほしい。異形感の採否はユーザー判断。
4. 4,960tri/4draw callsは目安内だが、40体は198,400tri。実スマホGPUでの性能と読みやすさは採用前に別途評価が必要。
5. 正式置換・可動リグ・アニメーション・当たり判定調整は未実施。今回の試作範囲で停止。

Astra Mediumの指定は受領したが、この作業中にモデル/effortの実設定を変更・確認したとは記録していない。
