# RAY / FOUNDRY ZERO — 攻撃モーション強化 v2

2026-09-10。ユーザー依頼「RAYとFOUNDRY ZEROの攻撃を激しく。特にFOUNDRY ZEROは馬のように前脚を上げてから降ろして攻撃、速度はゆっくりでよい」に対応。

## 変更

- **FOUNDRY ZERO**: Attackを1.6→4.8秒へ延長。0〜1.9秒で上体を約31.5度起こし、前側3脚を高く上げる。1.9〜2.4秒で溜め、2.4〜3.1秒で叩き下ろし、4.8秒まで重く沈み込んで復帰。後ろ3脚で支持。前脚3本の最小持ち上げ量はピーク約2.34m。着地3.1秒を基準に、炉の橙色の衝撃波を地面へ広げる。
- **RAY**: Attackを1.6→3.6秒へ延長。ヒレを約49度振り上げ、浮上して溜め、強く打ち下ろしながら前方へ押し出す。尾3本も大きくしなり、最後に中立へ復帰。
- 待機・移動クリップとPRISMは維持。元の採用造形・ゲームの戦闘処理は変更していない。

衝撃波は専用Three.jsプレビューの視覚効果。骨格の攻撃モーションはGLB/Blenderに保存しているが、衝撃波メッシュはGLBへ含めていない。実ゲームのダメージ判定・戦闘予兆への接続や正式公開は引き続き別工程。

## 確認

既存の3Dプレビュー `http://127.0.0.1:5198/assets/blender/preview-enemy-motion/index.html` でRAY / FOUNDRY ZEROの「攻撃」を選択。シーク・0.5倍速・正面・側面・斜めに対応。

今回の動画は `dist-validation/attack-v2/ray/attack-v2.mp4`（7.2秒）、`foundry_zero/attack-v2.mp4`（9.6秒）。斜め1回→側面1回、実時間1倍、960×540 / 30fps。動画の30fpsは実スマホ性能の証拠ではない。

## 検証と証拠

- Blender 5.2.1で生成・GLB保存・再読込成功。三角形数はRAY 7,838 / FOUNDRY ZERO 18,680で採用版と一致。中立姿勢boundsも一致。
- `check_enemy_motion.mjs`: 全モーションの実スキニング頂点を30fpsで計測し、有限座標・地面潜り・ループ継ぎ目・変位を確認。RAY攻撃の最低Y=0.32m、FOUNDRY ZERO=-0.00000012m（浮動小数点誤差）。継ぎ目誤差0.00000020m未満。
- 攻撃時の最大頂点変位: RAY約2.27m、FOUNDRY ZERO約3.54m。
- `check_attack_v2.mjs`: 旧GLBのIdle/Locomotionの全トラック値と一致、差0。PRISMのblend/GLBはSHA-256一致。FOUNDRY ZEROの後脚3本の足先移動0、前脚ピーク最小持ち上げ2.3365m、3.1秒の足先接地誤差0.00000001m未満。
- 側面の持ち上げ・着地を目視確認。2動画を復号し複数時刻へシークして画が異なることを確認。
- `npm run typecheck` / `npm run build` 成功。既存の500kB超チャンク警告あり。

今回の証拠: `dist-validation/attack-v2/attack-validation.json`、`video-validation.json`、`geometry-validation.json`、`artifact-hashes.json`、各生成ログ、動画、抽出画像。旧モデルと編集前ファイルは `before/` へ保存。

## 変更ファイル / Git

更新: `assets/blender/scripts/build_enemy_motion.py`（2体のAttackとIK）、`assets/blender/preview-enemy-motion/index.html`（衝撃波・説明）、2体の`*_motion_v1.glb` / `*_motion_v1.blend`。ファイル名v1は互換維持で、攻撃内容は本書のv2。

追加: `check_attack_v2.mjs` / `record_attack_v2.mjs`、本書。生成器・プレビューの実差分は `dist-validation/attack-v2/changes.patch`。

branch=`codex/home-armory`、base/HEAD=`2be699f160c83d641fb68bb1304e4da8059920dc`。既存の多数の未コミット・未追跡差分を維持。今回も未コミット、merge・正式置換・ゲーム公開なし。Driveは既存レビュー内のAttack v2フォルダへ保存。
