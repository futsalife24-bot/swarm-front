# HARROW新版モデルの実装契約

2026-10-11。現行実装と採用済みv10 GLBの読み取り調査。新版の制作・実装・採用検証は未実施。調査補助は `gpt-6-sol` / `medium` 指定。

## 採用中の実物

- 実行時URLは `public/assets/enemies/harrow_motion_v10.glb`。`assets/blender/candidates/harrow/v10/harrow.glb` と同一で、SHA256 `460b71eb6840b25e2565fbcc23d4cdcfac5710643965fdd11fe83dd4c5ba7cf5`、9,007,852 bytes。
- GLBはglTF 2.0、Y上、モデル原点は地面付近。中立形状のGLB座標（x, y, z）の頂点範囲は `[-5.5157, 8.4843] × [0, 9.4560] × [-9.2092, 9.2092]`。幅18.4183、前後14.0000、高さ9.4560の作者単位。実戦では `HARROW_SCALE = 1.95` を掛ける。これは静止形状の範囲で、全クリップの最大可動範囲ではない。
- 作者側の前方は `-X`。`loadEnemyMotion("harrow")` がGLBルートをY軸 `-π/2` 回転し、描画モデルの前方をローカル `-Z` にする。戦闘座標ではheading/yaw 0の前方を世界`+Z`として扱う。Blender原本のZ上座標とGLBのY上座標を混同しない。
- glTFメッシュ184個、プリミティブ186個（`Unified neck torso skin` が3プリミティブ）、単一skin・39骨。Three.jsの読み込み後は186 `SkinnedMesh`。全メッシュで同一のbind行列とworld行列が要求される。素材20種は金属、黄外皮、骨色、黒翼、赤弾頭などを含む。ローダーは素材ごとにジオメトリを結合して描画する。GLB原本の集計は84,508頂点・153,856三角形。新モデルの素材名やメッシュ数を固定する必要はないが、後述のローダー判定は更新が要る。
- 骨は `Root`、`Torso`、四肢各4本、首6本、`Head`、`Jaw`、尾7本、左右翼各3本で計39本。12アニメーションは `Idle` 7秒、`Locomotion` 4.2秒、`Attack` 5.25秒、`Threat` / `AirThreat` 各7秒、`Spin` 3秒、`Takeoff` 3.5秒、`Flight` 16.8秒、`Glide` 2.1秒、`Dive` 0.9秒、`StaggerFall` 2.625秒、`Land` 1.75秒。ローダー内で `Attack` を `Lunge` に改名する。

## 発射と動作の接続

- 権威側の `src/shared/harrow.ts` はThreat開始時に10発を予約し、攻撃開始後3.5秒に発射、さらに1.8秒後に着弾させる。地上・空中の弾頭先端は `harrowMissileOrigins()` の左右各5点に固定。値は現在のv10の `Threat` / `AirThreat` の3.5秒姿勢で測定したもの。`harrowPoint()` が作者座標を `HARROW.scale` 倍してheadingと世界座標に変換する。新モデルの発射器の弾頭先端が動けば、この固定点を**地上・空中それぞれ再測定**し、権威側定数とレポート/テストを揃える必要がある。モデルを見た目だけ差し替えると弾が器官から離れて出る。
- 地上のSpinは1.15秒予兆、1.05秒で1回転、3秒で終了。全身の世界yawは権威側 `harrowSpinRotation()` によるため、クリップでRoot自体を1回転させない。既存テストは翼の接地と、接地した翼の半径が21.2m以上であることを確認する。判定半径28m、近接発動21.2mを維持するには、新翼が判定演出と大きく乖離しないか実測する。
- 飛行高度は34.5m、地上/空中の交替は12/14秒。離陸3.5秒、Glide 2.1秒、Dive 0.9秒、Land 1.75秒、蓄積ダメージ後の落下2.625秒。世界位置の移動は共有戦闘ロジックが担当し、GLBのRootに世界移動を焼き込まない。`StructureMotionController` は権威側の開始時刻を基準に攻撃クリップをサンプリングし、通常移動は実移動距離/0.64で4.2秒クリップを進める。
- 当たり判定や移動幅はメッシュから自動生成されない。現行 `ENEMIES.harrow.radius = 3.4`、aim高さ4.2、`HARROW_SCALE = 1.95`。画像どおりにシルエットを刷新しても、ユーザー指定の戦闘性能・当たり判定を維持するなら共有数値を安易に変更しない。見た目と判定の乖離は実機画面で確認する。

## 新版への最小接続案

1. Tripo由来の外観をそのまま旧v10の表面で覆わない。非人型の専用メッシュを、既存Blender原本の39骨を参照した新しいスキンへ変換し、首・尾・翼・四肢の骨に新メッシュのウェイトを付ける。旧クリップは同じ骨名・階層・静止姿勢・向きを保持できる場合に移植できる。形状差が大きい箇所はウェイトと関節位置、接地・翼姿勢を補正する。単に古いアニメーショントラック名をコピーするだけでは変形品質を保証できない。
2. 12クリップの名前、尺、Root非移動、地上接地、左右翼の動き、3.5秒の弾頭位置を保ち、編集可能な `.blend` と標準GLBを出力する。骨構成を変える場合は39骨前提のローダー・アトラス・テストも変更対象となるため、まず既存骨の保持を優先する。
3. `src/client/hound-motion.ts` のHARROW専用186スキンメッシュ判定を新GLBの**Three.js読込後**の実数に合わせる。素材配列は受け付けず、全メッシュのbind/world行列一致とジオメトリ結合を要求するため、エクスポート構造を実測する。GLBを新しい版名のURLで配置し、同ファイルの参照を切り替える。Service Workerの旧キャッシュと `tests/harrow-model.test.ts` のv10固定パスを考慮する。現行原本・公開v10は残す。
4. GLBに収めたスキン・アニメーションを60fpsでGPU行列アトラスへ焼く構成。新メッシュの頂点は `skinIndex` と `skinWeight` が必要。描画は素材単位の結合であり、多数メッシュ/素材のままでは負荷が増える。新GLBの読み込み時間、GPU再生、描画負荷を現行v10と比較する。

## 採用時の検証

- GLB/Blendを再読込し、軸・サイズ・骨名/階層・skin binding・有限頂点/ウェイト・12クリップの尺/ループを照合。地上/空中Threatの3.5秒に赤い先端10点を測定し、`harrowMissileOrigins()` と各点で一致させる。Spinの0秒、1.15秒、途中、2.20秒、3秒の接地・到達半径、飛行/落下/着地も実再生で確認する。
- 関連自動検証は `npm run typecheck`、`npx vitest run tests/harrow-model.test.ts tests/harrow.test.ts tests/harrow-effects.test.ts tests/enemy-report-motion.test.ts tests/structure-motion.test.ts tests/enemy-size.test.ts`、`npm run build`。名称が違うテストファイルは実在確認して指定する。公開前の独立監査・Worker公開の手順は `docs/WORKFLOW.md` と専用監査skillに従う。これらのコマンドは本調査では**未実行**で、新版の合格結果を意味しない。

根拠: `src/shared/harrow.ts`、`src/shared/harrow-motion.ts`、`src/shared/defs.ts`、`src/client/hound-motion.ts`、`src/client/structure-motion.ts`、`tests/harrow-model.test.ts`、v10 GLBのglTF JSONと `build-report.json`。候補v10と公開GLBのSHA256一致を確認した。
