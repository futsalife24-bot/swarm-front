# FOUNDRY ZERO 支持脚修正（公開済み）

2026-09-12。ユーザー添付画像の「脚が人間のようで気持ち悪さが勝るから変えて」に対応。丸い太もも・ふくらはぎ状の曲線と靴状の足先を、一定断面の角型支柱、露出した関節軸、角型アクチュエータ、前後対称の小さな接地パッドへ変更した。

[同じ視点・照明・縮尺での新旧比較](../assets/blender/candidates/foundry-zero/mechanical-legs-v2/review/before-after.png)。[操作可能な屈曲プレビュー](../assets/blender/candidates/foundry-zero/mechanical-legs-v2/index.html)は開発サーバー経由で利用する。

## 変更範囲

- `assets/blender/candidates/foundry-zero/mechanical-legs-v2/`：隔離した生成器、補助コード、設計票、編集可能なBlenderモデル、配布用GLB、屈曲確認用GLB、比較/検査コードと証拠。元のsegmented-v1一式は保持。
- `public/assets/enemies/foundry_zero_mechanical_legs_v2.glb`：新しい支持脚モデル。旧GLBは保持。
- `src/client/foundry-worm.ts`：読込URLだけを `foundry_zero_segmented_v1.glb` → `foundry_zero_mechanical_legs_v2.glb` へ切替。ファイル名変更により旧キャッシュとの混同を避ける。
- `scripts/check-foundry-render.mjs` / `scripts/check-foundry-published.mjs`：検査対象GLBの更新と、証拠出力先の環境変数指定を追加。
- `docs/FOUNDRY-ZERO-CONCEPT.md` / `docs/STATE.md` / 本書：追加指示・検証・公開状態を記録。

頭・胴・接続部・砲口の29 meshと素材5種は旧GLBと一致（頂点/法線/indexの実バイト比較）。脚の136剛体パーツの位置・回転・縮尺も一致。34脚・頭1＋胴7・7接続部を維持し、歩行処理・shared戦闘仕様は変更していない。

三角形数36,628→36,152（約1.3%減）、頂点数20,102→20,000。flat面による書出し頂点属性の増加等でGLBファイルは1,580,536→1,787,652 bytes（約13.1%増）。外形幅は接地パッドの幅により5.50→5.64m、高さ4.29mは同じ。ゲームの当たり判定は従来どおり。

## 検証結果

- Blender 5.2.1 LTSの専用factory-startupプロセスで生成。保存した.blendを再読込し、GLBもfresh import。165 mesh、34脚、有限座標、非退化面、正の変換、元データとのbounds/triangles一致、地面下端0mを確認。
- 標準GLTFLoader/AnimationMixerで保存済み4秒屈曲クリップを60Hz検査。8 root、34脚、関節の接続、支持脚位置、砲口の原点固定と開口、clip長、ブラウザエラー0を確認。動画ファイルは新規作成せず、再生可能なプレビューを納品。
- 実FoundryWormView/Rendererで通常歩行・加速・停止・復帰、急旋回、節の分離、通常型との共存、レーザー、退出時の破棄、遅延ロード・失敗時fallbackを確認。支持足の滑りは浮動小数点誤差範囲（最大約4e-15m）、中立/歩行の地面潜りなし、停止時34脚接地。モデル描画5バッチ（床を含む計6 draw calls）。
- `npm run typecheck`、関連33テスト（foundry-generation / foundry-movement）、client build、本番Worker dry-run build成功。
- 配布済みdistをローカルpreviewで読み、1440×900と915×412 touchのエネミーレポート、形態切替、新GLBの読込、出撃/撤退を確認。ブラウザエラー0。
- 同条件の新旧・頭部詳細・ゲーム実Rendererの脚近景・屈曲画像を実際に開いて確認。

最初の候補は41,592triで旧予算を超えたため、小部品の面取りを整理し、最終36,152triへ削減。最初のWorker dry-runはサンドボックスの親フォルダ読取制限で失敗し、許可された通常権限で成功。これらは最終成功とは区別する。

実スマートフォンの性能・発熱は未測定。急旋回時の空中足の高速送り（既存実装、最大約0.502m/frame）も測定しており、本修正では歩行仕様を変えていない。全件E2E・全ステージ攻略・通信同期は今回の描画素材とURLだけの修正では再実行していない。

## 公開の状態

最初のデプロイ要求は自動承認レビューが「脚の見た目変更の依頼だけでは公開先・本番反映まで明示承認されていない」と実行前に拒否。その後、既存公開先への反映確認にユーザーが「はい」と明示承認したため再開した。検証済み14ファイルのSHA-256と配布JSの新GLB参照が変わっていないことを確認し、同じ配布物を公開。

公開先：`https://swarm-front.melosalife-24.workers.dev`。Version `12cda6ba-80f9-4cec-9aa5-8c535cc1687a`。更新された配布物はindex.html・client JS・新GLBの3ファイル。デプロイ成功記録は `dist-validation/foundry-mechanical-legs/deploy.log`。

`scripts/check-foundry-published.mjs` で公開版1440×900と915×412 touchを検査。GLB/JS/CSSがローカルdistのSHA-256と一致し、エネミーレポート・通常型/連結炉形態切替・新モデル読込・出撃/撤退が成功。両条件でブラウザエラー0、health HTTP200 / ok=true。公開版の横画面レポート画像を開いて脚の表示も確認した。証拠は `dist-validation/foundry-mechanical-legs/site/published-browser.json` と `published-report-*.png`。最初の公開ブラウザ検査はサンドボックスの外部通信制限で失敗したが、許可された通常権限で成功。公開承認待ちは解消済み。実スマートフォンの性能・発熱は引き続き未測定。

## 監査用の差分と証拠

branch `codex/home-armory`。開始base/HEAD `4186f25f7c9695f95ea897ad182db5f85fac3091`。commit/mergeは行わず、既存差分と今回差分を未コミットのまま保持。

開始時のコピー・SHA-256・Git状態と、今回開始時からの差分は `dist-validation/foundry-mechanical-legs/`。`runtime.patch` は実装の読込URL1行、`model.patch` は形状変更、`render-check.patch` / `site-check.patch` は検査対象変更。最終ハッシュと検証結果は同フォルダの `checks.json`。新旧アセットと非脚部の一致は候補内 `preservation.json`、Blender再読込は `reimport-validation.json`、GLTFLoader/AnimationMixerは `browser-validation.json`、実描画は `dist-validation/foundry-mechanical-legs/runtime/checks.json`、配布版は `site/local-browser.json`。

旧GLB SHA-256: `2df80e300c824c6665134bb9e0b0463da2eedf2e3acad9415830169cf7a9a7ea`。

新GLB SHA-256: `cefb976551d55167ba6b2ecf7ec9c7144105d890a85cb1c5335e24db90c275ab`（候補/public/distが一致）。
