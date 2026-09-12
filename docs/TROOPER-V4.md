# Standard Trooper v4 — 参照画像とスキン共通骨格

2026-09-11。添付「SWARM FRONT 3D MODEL REFERENCE」を参考に、標準兵士の造形と骨格を改修。

## 制作内容

- 白い密閉ヘルメット、暗いバイザー、分割された顎ガード、通信イヤーカップ、首の可動シール。
- 暗い装甲と白い胸部インレイ。背面には白いフレーム・円形放熱部・固定具を配置。
- 服の手足を関節軸に沿ったリング構造へ作り直し、胴体にも連続した変形用ループを配置。隣接ボーンへ正規化ウェイトを設定。
- ユーザーの追加指示に合わせ、通常立ちの脚を逆V字へ調整。レスト姿勢の左右中心間を股関節25cm→膝35cm→足首47cmへ広げ、つま先を左右6度ずつ外向きにする。骨格・服・装甲・靴を一緒に調整し、15モーションを再ベイク。
- 装甲・背面装備は剛体ウェイトを維持。指は左右5本×3関節、靴の前部はつま先ボーンへ配分。
- 標準・砂漠・雪山・特殊部隊の4配色を描画APIと検査ビューに用意。隊員ごとに材質だけを複製し、画像と形状は共有する。

## 共通骨格 SF_Humanoid_2

24→57 bones。左右は同じ寸法・軸定義から対称生成する。単位はメートル、足元原点。BlenderではZ-up / +Y前方、GLB/ゲームではY-up / −Z前方。

```text
Root → Pelvis → Spine → SpineMid → Chest → Neck → Head
Pelvis → UpperLeg_L/R → LowerLeg_L/R → Foot_L/R → Toe_L/R
Chest → Clavicle_L/R → UpperArm_L/R → LowerArm_L/R → Hand_L/R
Hand_L/R → Thumb1…3, Index1…3, Middle1…3, Ring1…3, Little1…3
Hand_R → RightHandWeaponSocket
Hand_L → LeftHandSupportSocket
Chest → BackWeaponSocket, BackWeaponSocket_2
```

Rootと4ソケットは非変形、残る52本は実際の頂点ウェイトを持つ。BlenderのボーンコレクションをCore / Arms / Hands / Legs / Socketsに分割。スキン制作では同梱 `.blend` のレスト姿勢とボーン行列を使用する。既存v3のChestの親はSpineだったため、v3のローカル回転トラックをそのまま新骨格へコピーしない。v4へ再ベイクした15クリップを共用する。

現行のソケット名と位置を維持。持ち替えクリップの原本は1秒、実ゲームは0.5秒で再生し、正規化時刻0.45 / 0.60で受け渡す。移動・射撃・回避・ダメージ・通信の戦闘ルールは変更しない。

## スキン制作・差し替え契約

1. 原本のリグを複製し、ボーンの名前・レスト行列・親子関係・スケールを保つ。GLB内のinverseBindMatricesを各スキンの基準とする。リグの再生成や自動ウェイトだけで互換と判定しない。
2. 編集単位はBody / Helmet / ChestArmor / ShoulderArmor / ArmArmor / Hands / LegArmor / Boots / Backpack / UtilityGear。論理部品は原本とGLBに残し、ランタイムでは同じ材質・bindの形状だけを統合する。統合後にも部品名とindex範囲を記録する。
3. Armor、Ceramic、Cloth、Rubber、Metal、Visor、Orangeの7材質を役割として保つ。`setSkin()` は配色のみを変更し、繰り返しても色が暗くならない。形状が異なる衣装は別GLBとして共通リグへバインドして制作する必要がある。
4. 装甲は単一ボーンで硬さを保つ。服は関節前後のループにウェイトを分け、合計1・最大4影響を守る。新しい指やToeを単なる未使用マーカーへ戻さない。
5. 57本の必須ボーンを読み込み時に検証する。制作時には下記の原本検証・15モーション・接地・両方向の武器受け渡し・4隊員分離を通す。

ゲーム内のスキン選択画面、保存、協力相手へのスキンID同期は今回の範囲外。服・装甲用の共通骨格と配色APIを整備した段階であり、任意の外部Humanoidを自動リターゲットする機能ではない。指の握りは現行武器向けの簡易ベイク。つま先は変形可能な骨格・ウェイトを備えるが、既存走行では靴底全体から接地を計算する。上体・武器ソケットの既存軌跡を維持し、下半身は広げた立ち姿に合わせて再計算する。

## ファイルと再生成

- 原本: `assets/blender/source/standard_trooper_v4.blend`（参照画像をパック）。
- 再生成: `assets/blender/scripts/build_standard_trooper_v4.py` と `trooper_v4_geometry.py`。既存v3細部・AOモジュールも再利用。
- 配信用: `public/assets/characters/standard_{trooper,rifle,shotgun,rocket}_v4.glb`。
- 名前・階層・ソケット・材質契約: `public/assets/characters/standard_trooper_v4.json`。
- 描画: `src/client/standard-trooper.ts`。検査ビュー: `assets/blender/preview-trooper/index.html`（Bind_Pose、骨格/ボディ表示、4配色）。

```powershell
& 'C:/Users/futsa/AppData/Local/Programs/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python-exit-code 1 --python assets/blender/scripts/build_standard_trooper_v4.py
& 'C:/Users/futsa/AppData/Local/Programs/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python-exit-code 1 --python assets/blender/scripts/validate_standard_trooper_v4.py
npm run dev -- --port 5314 --strictPort
node scripts/check-trooper-v4.mjs
node scripts/check-trooper-v4-game.mjs
```

## 検証・公開状態

ローカル実装・自己検証・配布版確認・公開後確認完了。証拠は `dist-validation/trooper-v4/`。

|検査|最終ローカル結果|
|---|---|
|Blender保存・GLB再読込|1 armature、57 bones、15 clips、7材質。参照画像パック済み|
|原本ウェイト|全30,298頂点で正規化、最大2影響。装甲20,116頂点は剛体。左右対称。新しい33関節すべてで実変形を確認|
|逆V字の通常立ち|実描画で股関節25.0cm→膝35.9cm→足首47.0cm（レスト膝35cmとの差は立ちクリップのIKによる）|
|15モーション×25時点|全変形頂点が有限、全クリップで床下への沈みなし。最小+0.499mm|
|武器受け渡し|往復×2箇所で位置誤差0.000281mm以下|
|既存上半身軌跡|15クリップ×9時点、v3との位置差0.000227mm以下。下半身はユーザー指定の新しい立ち幅へ変更|
|4人表示|独立スケルトン・独立材質。色移りなし、標準配色への復帰一致。兵士＋2武器×4人＋床で58 draws、249,474三角形|
|実ゲーム入力|PC1280×720／横持ち844×390。移動・両スロット射撃・0.5秒切替・回避・復帰、JSエラーなし|
|コード|型チェック、関連9単体テスト、production client build、production Worker dry-run成功|
|配布版|Vite previewのPC/横持ちで操作成功、開発用診断の混入なし。配信JSと4GLBがdistのSHA-256と一致|

本体は66,968→58,724三角形（約12.3%減）。GLBは6,816,100→7,786,932 bytesで、骨格・アニメーション・材質追加によりファイル容量は増加。4人描画は隔離シーンの計測であり、実端末のFPS保証ではない。実スマホ、インターネット越しの協力、長時間の温度・消費電力は未確認。既存の500KB超bundle警告は継続。

修正中に検出した問題: Toeウェイト追加後の接地計算漏れを修正し、靴底の全頂点を対象化。BlenderのConnected設定による反動移動の拘束を解除。ブラウザ検査の時刻基準をページ内へ統一し、横持ち検査の過去時刻エラーを解消。上表は修正後の結果。

ローカルWorkerでの画面検査は、同時アセット配信中にWranglerが `Network connection lost` で終了したため未完了。各ファイルの単独取得・ハッシュ照合は成功。配布版画面は同じdistをVite previewで確認し、Workerのdry-runと分けて記録。公開後の実Workerでは同時配信・両画面の操作・API確認に成功した。

## 公開結果

- URL: https://swarm-front.melosalife-24.workers.dev
- Version: `434603ce-9e09-4410-a023-1a4b23b55578`。
- JS: `index-BGy5l6Ox.js`。公開JSと兵士・3武器のv4 GLBは、検証済みdistのSHA-256と一致。
- 公開PC1280×720／横持ち844×390で4モデル読込、両武器射撃、切替中の射撃制限、回避・復帰を確認。JSエラーなし、開発診断なし、`/api/health` 200 / ok=true。
- 公開結果: `dist-validation/trooper-v4/published-validation.json`。全証拠・変更前後ハッシュ: `checks.json`、今回だけのテキスト差分: `task.patch`。

着手時: branch `codex/home-armory`、base/head `2be699f160c83d641fb68bb1304e4da8059920dc`。既存の多数の未コミット・未追跡差分を保持。今回の変更前コピーは `dist-validation/trooper-v4/before/`。commit / mergeなし。
