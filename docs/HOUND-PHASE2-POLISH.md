# HOUND v2 — Phase 2 外部回答への微修正

2026-09-10。許可された造形3点と必要な検証を完了。正式採用は保留。外部回答は報告ベースであり、実コード・画像の独立監査合格ではない。本タスクから外部へコードを送信していない。commit / push / merge / 公開 / production反映なし。

## 変更

Blender座標（+Yが前、Zが上）で、次のパラメーターだけ変更した。

|対象|修正前 → 修正後|目的|
|---|---|---|
|中央後脚C|接地点X −0.04 → +0.23m、Y −1.27 → −1.39m、幅係数0.115 → 0.135|支持位置を横・後ろへずらし、不均等な後脚を強める|
|肩リング|中心X +0.08 → +0.24m、Y −0.05 → −0.19m、Z軸回転 −8° → −28°|中心線から外し、正面の対称な輪郭を弱める。半径・太さ・発光材料は維持|
|第三プレート|高さ1.85 → 1.66m、幅0.43 → 0.51m|高さと幅の2要素だけ変え、正面で前の板に隠れる量を減らす|

胴体、前脚、後脚A/B、第一・第二プレートは変更なし。ゲームの描画・AI・攻撃・HP・hitbox・wave・サーバー・通信コードは開始時から変更なし。アニメーション本実装なし。

変更ファイル:

- `assets/blender/scripts/build_hound_v2.py`: 上記パラメーター。
- `assets/blender/source/hound_blockout_v2.blend` / `public/assets/enemies/hound_blockout_v2.glb`: 再生成。
- `assets/blender/scripts/check_hound_v2.mjs`: 証拠出力先を第3引数で指定可能にしただけ。
- `assets/blender/scripts/check_hound_v2_polish.mjs`（新規）: 前後画像、1/10/40体のフレーム間隔、debug非永続化。
- `assets/blender/scripts/check_hound_v2_boundaries.mjs`（新規）: 実Rendererの読込失敗、flag=0、本番JSへの非混入。
- `docs/HOUND-BLENDER-PHASE2.md`: 本追補への案内。
- `docs/HOUND-PHASE2-POLISH.md`（本書）。

## 出力と自己検証

|項目|修正後|
|---|---|
|Triangles|1,532（据え置き）|
|Meshes / materials|10 / 3、テクスチャ0、アニメーション0|
|GLB|91,016 bytes（91,020から4 bytes減）|
|幅 × 高さ × 奥行|2.357 × 2.290 × 3.328m（奥行のみ+0.12m）|
|GLB SHA256|`cacbbb213b4f86360e2b86ea1dc1d85f30690bcbc0a56875182b40a7cbf551a9`|

Blender 5.2.1 LTSで生成し、GLBを再読込して三角形数・bounds一致、閉じた面・正体積・非退化面、全5脚接地、unit scale・負スケールなし、forward −Zを確認。Three.jsでも実ファイルを検証した。

- 通常URL: 既存HOUND、GLB要求0。`debugHoundGlb=0`も無効。
- `?debugHoundGlb=1`: GLB有効、ボタンで既存/GLB両方向の切替成功。
- 同一ブラウザcontextでdebugから通常URLへ移動: 状態の持越しなし、GLB要求0。
- GLB要求を失敗させた実Renderer: 既存表示維持、GLB非表示、失敗ボタン無効化。
- 描画・切替・各体数計測前後のWorld JSON不変。ワールド消去時のGLB非表示も成功。
- production buildのJS: GLB URL・debugボタン・debug groupの識別文字列なし。GLB資産自体はpublicからbuildにコピーされる従来仕様。
- `npm run typecheck` / `npm run build`: 成功。buildに従来同種の500kB超チャンク警告あり。
- `npm test -- tests/render.test.ts tests/structure-v2.test.ts`: 28/28成功。
- 実タイトルから通常/debugソロ出撃は前工程で成功済み。今回ゲームコードを変えていないため再実行せず、保存済み証拠を継承。Android実機・全E2E・協力通信は今回未実施。

## 性能記録

844×390、deviceScaleFactor 1、Chrome headless / ANGLE SwiftShader（ソフトウェア描画）。実ゲームRendererに固定Worldを渡し、30フレーム準備後、requestAnimationFrame時刻の120区間を計測。FPS = 120 ÷ 経過秒。シミュレーション・通信は回していない。CPU描画送信時間の逆数ではないが、画面提示完了やGPU完了の実測でもない。PC実GPU・Androidの性能判断には使わない。

|HOUND数|モデル draw calls|シーン全体 draw calls|ブラウザ計測FPS|平均フレームms|p95 ms|
|---:|---:|---:|---:|---:|---:|
|1|10|53|37.46|26.69|33.50|
|10|10|53|29.72|33.64|33.50|
|40|10|53|19.76|50.61|66.80|

各条件10 mesh / 3材料、全パーツのinstance count一致。40体は61,280 triangles。単回の短時間計測で、OS負荷やheadlessスケジューリングを含む。CPU送信時間の旧記録は`three-validation.json`内で別指標として残し、FPSの根拠には用いていない。

## 比較画像と証拠

新しい証拠: `dist-validation/hound-v2-polish/`。

- `v2-before-front.png` / `v2-after-front.png`: 1200×720、正面、同一正投影カメラ。
- `v2-before-mobile.png` / `v2-after-mobile.png`: 844×390、同一透視カメラ、約10m。
- `v2-after-oblique.png` / `v2-after-silhouette.png`: 斜め・単色輪郭。beforeも追加保存。
- `v2-after-game-1-mobile.png` / `v2-after-game-10-mobile.png` / `v2-after-game-40-mobile.png`: 実ゲームRendererの固定配置。
- `blender-validation.json` / `three-validation.json` / `boundaries.json`: 形状・描画・debug境界の結果。
- `performance.json`: 全フレーム間隔、実レンダラー名、計測条件。
- `typecheck.log` / `build.log` / `tests.log`: 今回の成功ログ。
- `baseline.json` / `preservation.json` / `shape.patch` / `git-status-before.txt` / `git-status-after.txt`: 保護照合と今回差分。
- `previous-evidence/`: 作業開始前の`dist-validation/hound-v2/`全体のコピー。修正前GLB・blend・生成スクリプトも別名で保護。

前後とも同じブラウザ・viewport・カメラ・距離・照明・通常発光設定で撮影し、画像を目視確認。モデルは単独で原点表示。previewのGame cameraは距離評価用で、実ゲームRenderer画像とは区別する。

再確認コマンド（game内、比較サーバー起動中）:

```powershell
node assets/blender/scripts/check_hound_v2_polish.mjs http://127.0.0.1:5198 after
node assets/blender/scripts/check_hound_v2.mjs http://127.0.0.1:5198 dist-validation/hound-v2-polish
node assets/blender/scripts/check_hound_v2_boundaries.mjs http://127.0.0.1:5198
```

`before`撮影は再生成前に完了済み。現在のモデルでbeforeを再実行すると証拠を誤って上書きするため実行しない。生成スクリプトの既定QA出力は従来の`hound-v2/`。今回生成した検証JSONは新証拠側にもコピーした。

## Gitと保持確認

開始・終了 branch: `codex/home-armory`。base / HEADは同じ`2be699f160c83d641fb68bb1304e4da8059920dc`。開始時から多数の未コミット・未追跡ファイルあり、今回成果物も未コミット。reset / stash / checkout / clean未使用。

開始時のGit対象182ファイルをSHA256照合。変更は生成スクリプト・旧検証スクリプト・v2 blend・v2 GLB・Phase 2文書の5件のみ。それ以外177件保持、欠落0。新規は検証スクリプト2件と本書。無関係な既存差分、v1、`src/`、`server/`、`tests/`は保持。最終status全文は証拠フォルダーへ保存。

## 残課題とユーザー実機確認

自己目視では正面の第三プレートが分離し、リングの左右対称性が弱まった。中央後脚は正面で偏った支持として読める。ただし約10mでは差が小さく、斜めでは脚同士やリング・板の投影重なりが残る。単色の斜め輪郭では板がつながって見える。リングが顔に見えないこと、犬・虫に見えないこと、遠景で5脚の異様さが十分伝わることは合格断定しない。大きな造形変更には進まず実機判断へ回す。

同じWi-FiのAndroid向け: `http://192.168.11.58:5198/?debugHoundGlb=1`。PC: `http://127.0.0.1:5198/?debugHoundGlb=1`。起動したViteはポート5198をstrictPort指定し、LAN待受あり。右上のボタンで既存/v2を比較。Androidからの接続・端末描画・OSファイアウォール通過は未確認。サーバー稼働中のみ利用可能、外部公開はしていない。

確認項目: ①普通の虫・犬に見えないか ②5脚の異様さ ③リングの顔っぽさ ④浮遊脊椎の読みやすさ ⑤小画面でのHOUNDらしさ ⑥複数体での視認性 ⑦体感の重さ。採否とAndroid性能の判断はユーザー実機確認に残す。
