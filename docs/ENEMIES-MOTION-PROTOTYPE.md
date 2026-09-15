# PRISM / RAY / FOUNDRY ZERO — 採用造形のモーション試作

> 最新: RAYとFOUNDRY ZEROの攻撃を強化済み。現行の攻撃仕様・動画・検証は [ENEMIES-ATTACK-V2.md](ENEMIES-ATTACK-V2.md)。以下は初回試作の記録。

2026-09-10。ユーザーが採用した最新版PRISM・RAY、25%拡大・脚詳細化済みFOUNDRY ZEROを基準に、3体のモーション試作を完了。正式置換・公開は保留。

## 成果物と確認

`assets/blender/preview-enemy-motion/index.html` をViteで開く。
`http://127.0.0.1:5198/assets/blender/preview-enemy-motion/index.html`

3体切替、待機・移動・攻撃、斜め・正面・側面、Orbit操作、一時停止、シーク、0.5倍速、中立形状へ戻す操作を搭載。3体とも標準glTFのスキン・アニメーションとして出力し、BlenderのNLAにも保存。

| 体 | 動作 | 骨 / 材質バッチ | 三角形 | GLB bytes |
|---|---|---:|---:|---:|
| PRISM | 8枚の浮遊板の独立安定化、移動時の揺らぎ、外板展開とコア反動 | 9 / 4 | 3,528 | 443,412 |
| RAY | 左右ヒレの遊泳、3本の尾の波動、ヒレを絞る突進姿勢 | 15 / 4 | 7,838 | 398,448 |
| FOUNDRY ZERO | 接地した待機、6脚の交互支持、炉の沈み込みとクレーン展開 | 21 / 5 | 18,680 | 1,826,028 |

各体に `Idle` 4秒 / `Locomotion` 2秒 / `Attack` 1.6秒。移動はその場で再生するクリップで、ワールド移動は含まない。FOUNDRY ZEROの脚は二関節IKで曲げ、足先の水平を保持。待機・攻撃では全足を固定し、移動では3脚ずつを支持・振り出しへ交代する。

- `assets/blender/scripts/build_enemy_motion.py` — 採用版生成スクリプトをメモリー内で再利用し、結合前のパーツを可動化。採用版スクリプト自体は変更しない。
- `assets/blender/source/{prism,ray,foundry_zero}_motion_v1.blend`
- `public/assets/enemies/{prism,ray,foundry_zero}_motion_v1.glb`
- `assets/blender/scripts/check_enemy_motion.mjs` — 実GLBの頂点・中立形状・ループ検証と画面保存。
- `assets/blender/scripts/record_enemy_motion.mjs` / `motion_video_mux.mjs` — 30fpsの確認動画出力と復号検証。
- `dist-validation/enemies-motion/{prism,ray,foundry_zero}/motion.mp4` — 各11.2秒、960×540、待機4秒→移動4秒→攻撃2回。

再生成例: `blender.exe --background --factory-startup --python-exit-code 1 --python assets/blender/scripts/build_enemy_motion.py -- prism`。末尾をray / foundry_zeroへ変更する。

## 検証

- Blender 5.2.1で3体の生成、保存、GLB export/reimport成功。
- Three.jsで採用版GLBとモーション版の中立姿勢のbounds・三角形数を比較し一致。
- 全9クリップの実スキニング頂点を30fpsで計測。異常座標なし。地面下への潜り込みなし。最大継ぎ目誤差0.00000020m未満。
- 動作による頂点変位を確認し、静止しただけのクリップでないことを検証。
- PRISMの最小浮遊クリアランス約0.0148m、RAY約0.2633m。FOUNDRY ZEROは全クリップで最小Y=0。
- Chromeのプレビューで各モーション、PC・844×390画面を保存。JavaScript例外0。
- 各動画を実際に復号し、3時刻へシーク。フレーム画像が異なることを確認。
- `npm run typecheck` / `npm run build` 成功。従来の500kB超チャンク警告あり。
- 開始時のsrc / server / 既存Blenderスクリプト・元モデル・GLB計73ファイルはSHA-256一致。既存差分を維持。

検証JSON: `dist-validation/enemies-motion/geometry-validation.json`、`checks.json`、`preservation.json`、`video-validation.json`。生成ログ・Blender検証JSON・画面・動画は同ディレクトリ内。ハッシュ一覧は `artifact-hashes.json`。

## 範囲と残る工程

今回は造形採用後の独立したモーション試作。通常ゲーム・開発debugの再生器への接続、戦闘予兆や命中時刻への同期、インスタンスごとの再生・遷移、量産描画性能の確認は含めていない。攻撃1.6秒は動きの検討用で、現行戦闘タイミングへ接続済みという意味ではない。

FOUNDRY ZEROの油圧部品は脚側へ追従させた試作で、各シリンダーの独立した伸縮機構までは実装していない。移動距離と脚の送りの同期はゲーム接続時の工程。PRISMの最下部は移動時に地面へ近づくため、実地形上の見え方を接続時に確認する。

スマホ実機のGPU時間・FPS・発熱は未検証。動画はオフライン30fpsであり実機性能の証拠ではない。通常buildはpublic内の試作GLBをdistへコピーする既存仕様だが、今回は公開していない。

## Git / 独立監査の境界

branch `codex/home-armory`。開始base / 終了HEADとも `2be699f160c83d641fb68bb1304e4da8059920dc`。開始から多数の未コミット・未追跡差分あり。今回も未コミット。

今回の変更は上記の新規生成・検証スクリプト、専用プレビュー、モーション用3GLB・3blend、本書のみ。既存ファイルの変更は0（73ファイルを保存照合）。commit / push / merge / 正式置換 / 公開は実施していない。外部Chat監査合格やモーションの正式採用を意味しない。
