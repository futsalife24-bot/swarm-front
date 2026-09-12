# HOUND — Blender Phase 2 / v2 polish + development debug

> 2026-09-10 追補: 外部Chat回答に基づく3点の微修正を実施。現在のv2数値・追加証拠・残課題は [HOUND-PHASE2-POLISH.md](HOUND-PHASE2-POLISH.md) を正とする。以下は微修正前のPhase 2記録。正式採用は引き続き保留。

2026-09-10。v2生成・比較・ゲームRendererへの開発専用表示まで。正式採用、commit、push、merge、公開、本番反映なし。

## 開始条件

- Repository: `C:/Users/futsa/OneDrive/ドキュメント/ChatGPT/スワフロ/game`
- Branch / base / HEAD: `codex/home-armory` / `2be699f160c83d641fb68bb1304e4da8059920dc`（開始・終了同じ）。
- 適用: ユーザー提供グローバルAGENTS.md、`game/AGENTS.md`。今回の公開禁止が通常公開方針に優先。
- 親フォルダのGitはHEAD未作成。gameが実リポジトリ。
- 開始から多数の未コミット・未追跡変更あり。173既存ファイルのSHA256を記録。今回更新した既存ファイルは `src/client/render.ts` のみ。それ以外172件はハッシュ一致、欠落0。v1も変更なし。reset/stash/checkout未使用。
- v1: `assets/blender/scripts/build_hound_v1.py`、`assets/blender/source/hound_blockout_v1.blend`、`public/assets/enemies/hound_blockout_v1.glb`。背景は `HOUND-BLENDER-PHASE1.md`。
- 既存GLB処理は `assets/blender/preview/index.html` のGLTFLoader。ゲーム本体は `enemyGeometry('crawler')` のInstancedMesh。既存Three.js同梱GLTFLoaderを再利用、新依存なし。

## 造形意図・v1との差

頭・顔・首は作らず、非対称の支持機構と浮遊部品でANOMALY感を強める。節の多い昆虫脚や普通の犬の骨格に戻さず、連続した板状の長い前脚2本＋短い後脚3本を維持。

- 後脚の接地点X: v1の約−0.589/+0.589/+0.164から−0.70/+0.69/−0.04mへ。中央脚を後ろに送り、取り付け高さを0.91/0.84/0.73m、太さも別々にした。
- 比較で外側の後脚と前脚の重なりが残ったため、前脚接地点を±0.90から±1.10mへ調整。現行ゲームHOUNDの幅内に収まる。
- 浮遊脊椎3枚の前後間隔を約0.4→0.57〜0.58m、高さを1.91/2.15/1.85mへ。幅0.70/0.57/0.43m、厚さ0.15mとし、傾きも変えた。
- 肩リング中心をBlender Y=+0.46から−0.05mへ0.51m後退、Xを+0.08mへ。18°/12°/−8°の傾きを加え、肩の独立機構として配置。
- 胴体の前後長1.34→1.46m、傾き13→17°。後部を最大26%絞り、横へ最大0.10mずらした非対称の楔。
- 論理分離10 mesh + root。3材料、テクスチャなし。歩行・攻撃アニメーション、リグなし。GUI操作なし。

## 出力

|ファイル|用途|
|---|---|
|`assets/blender/scripts/build_hound_v2.py`|v1から独立した再生成・保存・GLB再読込検証|
|`assets/blender/source/hound_blockout_v2.blend`|122,565 bytesのBlenderソース|
|`public/assets/enemies/hound_blockout_v2.glb`|91,020 bytesのGLB|
|`assets/blender/preview-v2/index.html`|v1/v2/現行の比較、視点切替|
|`src/client/hound-glb-debug.ts`|10パーツのInstancedMeshによる描画アダプター|
|`src/client/render.ts`|開発flagによる遅延読込・比較ボタン・描画同期のみ追加|
|`assets/blender/scripts/check_hound_v2.mjs`|GLB・ゲームRenderer・切替・40体・fallback・画像検証|
|`assets/blender/scripts/check_hound_v2_solo.mjs`|通常/debugの実タイトル→ソロ出撃確認|
|`docs/HOUND-BLENDER-PHASE2.md`|この報告|

Blender **5.2.1 LTS** / build `9e2066aef7ef`。既存インストールを使用。

```powershell
# gameディレクトリから
& 'C:\Users\futsa\AppData\Local\Programs\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python assets/blender/scripts/build_hound_v2.py
npm run dev -- --port 5198
# 別ターミナル
node assets/blender/scripts/check_hound_v2.mjs http://127.0.0.1:5198
node assets/blender/scripts/check_hound_v2_solo.mjs http://127.0.0.1:5198
```

再生成はv2専用出力を上書きする。手動変更を保持する場合は別名へ保存。v1は読み取り参照のみ。今回は初回生成後に前脚の幅を1回調整し再生成。最終形状の二重生成によるバイト一致検証は実施していない。

## 数値・座標

|項目|v1|v2|
|---|---:|---:|
|Triangles|1,532|1,532|
|Materials|3|3|
|GLB bytes|90,592|91,020 (+428 / 約0.47%)|
|幅×高さ×奥行 m|1.977×2.054×3.038|2.357×2.290×3.208|

v2 GLB SHA256: `d47958c97dcde41db3a73d246ac7ea2426b65e4952325f068750f959acc2b71d`。

- GLB bounds: min=(-1.178530, 0, -1.790104)、max=(1.178530, 2.289996, 1.417821)。
- 現行ゲームモデルは2.379×1.840×3.363m。幅・奥行はほぼ同程度。浮遊板を上げたため高さは現行より約0.45m高い。scaleで縮小せず実寸比較している。
- 1 unit = 1m、root接地原点、全五脚Y=0。前方はBlender +Y→GLB −Z。root/全node scale=(1,1,1)、負スケールなし、ソースmesh rotation適用済み。
- GLB再読込後も三角形数・bounds一致。manifold・正体積・非退化面を検証。画像テクスチャ/カメラ/ライト/animationなし。

## debug表示

開発サーバーの `http://127.0.0.1:5198/?debugHoundGlb=1` を開き、通常どおりソロで出撃。右上の `HOUND v2 → Current` / `Current → HOUND v2` ボタンで比較する。flagなしは既存HOUNDのまま、GLBリクエスト0件。

比較専用ビュー: `http://127.0.0.1:5198/assets/blender/preview-v2/index.html`。v1/v2比較は左v1・右v2。

- `import.meta.env.DEV` とqueryの両方が必要。production buildのJSにdebug GLBローダー/モデルURL/ボタン文言が含まれないことを確認。public内のGLBファイル自体は通常buildへコピーされるが、読込経路は無効。
- GLB準備が成功するまでは既存モデルを表示。読込失敗時も既存表示を維持。画面に失敗状態を表示する。
- 既存InstancedMeshが生成した位置/回転/scale/個体色をコピーし、10パーツのローカル行列を乗算する。上限は既存80体分に合わせる。40体でもモデル分は10 draw calls。
- Worldへの参照や書込はアダプターに渡さない。AI/HP/当たり判定/wave/サーバー/通信は今回一切編集していない。ゲームコード変更は描画側のみ。
- 既存の地面予兆は維持。GLBは静止ポーズなので滑走し、既存の脚変形やリング収縮アニメーションは再現しない。本実装前の造形確認用。
- ワールド消去時はGLB表示・インスタンス数も0。動的bounding sphereを更新し、元モデルを表示したままGLBが重複することはない。

## 検証と保存画像

証拠は `dist-validation/hound-v2/`（既存のGit除外対象）。

- `blender-run.log` / `blender-validation.json`: Python・.blend保存・GLB export/import・三角形/材料・全五脚接地・正のunit scale・法線/面検証成功。
- `three-validation.json` / `browser-run.log`: 実GLBロード、全脚Y=0、全node scale1、40体時も地面と向き一致（forward dot≈1）、通常表示、toggle、失敗fallback、null world後の非表示をassert。描画前後でWorld JSON不変。
- `solo-validation.json`: 通常/debugの実ゲームタイトルからソロ出撃成功、JS例外0、GLBリクエスト0/1件。
- `typecheck.log`: `npm run typecheck` 成功。
- `build.log`: `npm run build` 成功。既存と同種の500kB超チャンク警告あり。
- `tests.log`: `tests/render.test.ts` / `tests/structure-v2.test.ts` の28件成功。全E2E/協力通信の再検証は今回行っていない。
- `baseline.json` / `preservation.json`: 173ファイル照合、意図したrender.ts以外172件保持、欠落0。
- `git-status-before.txt` / `git-status-after.txt`: 全既存差分を含む開始/終了状態。
- `phase2-render.patch`: 開始時の未コミット状態に対する今回だけのrender.ts差分。`render-before.ts`は比較元。

|画像|内容|
|---|---|
|`hound_v1_vs_v2_front.png`|正面・同倍率、左v1/右v2|
|`hound_v1_vs_v2_oblique.png`|斜め・同倍率、左v1/右v2|
|`hound_v1_vs_v2_mobile.png`|844×390・約10mの比較|
|`hound_v2_gameview.png`|実ゲームRenderer・実マップ・1200×720|
|`hound_current_gameview.png`|同じ配置から既存モデルへ切替|
|`hound_v2_mobileview.png`|実Renderer・844×390、プレイヤーの遮蔽あり|
|`hound_v2_mobileview_unoccluded.png`|敵を横へずらし脚の遮蔽を減らした844×390|
|`hound_v2_40_mobile.png`|40体・844×390|
|`solo-normal.png` / `solo-debug.png`|本物のゲーム画面でのソロ出撃|

実Renderer画像は検証用Worldの静止配置を描いたもの。ソロ出撃画像は実際のゲームループ。スクリーンショットは目視確認済み。初回の白抜けはWebGLの描画バッファ破棄による撮影側の問題で、撮影中再描画して解消。404は既存fixtureのfaviconで、検証用リクエストだけ204にしてゲーム資産エラーと区別した。

Chrome SwiftShaderの40体CPU描画送信は30フレーム平均約1ms。これはGPU完了時間/FPS/スマホ性能の測定ではない。40体=61,280 triangles、10 draw calls。実機GPU、発熱、長時間動作は未確認。

## 自己レビュー・次工程

|観点|判断|
|---|---|
|虫感|非対称胴体・不均等な後脚・浮遊板で機構感は増した。長い脚のアーチは残るため、虫感が消えたとは判定しない。|
|5脚|正面近景の五つの接地点は分離が改善。遠景では側脚同士や胴体、プレイヤーで重なり、瞬時に数えられる保証はない。|
|肩リング|後退と傾斜は斜めで肩機構らしく見える。真正面は依然として強い円形輪郭が顔の代替に見える余地あり。|
|浮遊脊椎|斜めは3枚の隙間が明確。正面は2枚が目立ち、3枚目が重なる。|
|スマホ遠景|輪と上側プレートはv1より分離。後脚3本の完全な数え分けは未達で、実機のユーザー評価が必要。|
|WebGL/軽量性|法線・材料の目視破綻なし。1532tri/3材料を維持。40体インスタンシング合格、実機負荷は未評価。|

次はユーザーによるv2の採否・実機見え方確認。採用許可後に必要なら第三プレート/後脚の投影重なりを微調整し、簡易歩行・リング予兆、論理hitboxとの見た目、実機同時表示負荷を検討する。今回これらの正式統合へは進まない。
