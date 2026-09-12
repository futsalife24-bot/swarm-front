# PLEAT — ANOMALY基準モデル候補

既存近接型HOUND（crawler）の役割・戦闘仕様を維持した、別種の外見候補。名称・造形は提案であり、ユーザーの見た目承認前。本採用・公開・他種への展開は行っていない。

## 見る

- `index.html`：回転・拡大、待機／追跡／溜め衝撃、シーク、0.5倍速、四方向、ゲーム距離、現行との同縮尺比較、単色輪郭、1/10/40体。
- `review/front.png`、`side.png`、`rear.png`、`oblique.png`：書出しGLBの四方向。
- `review/comparison.png`：現行HOUNDと同じ照明・カメラ・縮尺で比較。
- `review/attack-*.png`：溜めから衝撃・復帰まで。
- `review/pleat_motion_oblique.mp4`、`pleat_motion_side.mp4`：待機・追跡・溜め衝撃の保存動画。オフライン30fpsであり、スマホ性能の測定ではない。
- `review/game-size.png`：844×390、ゲーム距離の読みやすさ。
- `review/pleat_gameplay.mp4`：現行速度での実追跡・加速・衝撃（8秒、検証配置・固定観察カメラ）。
- `review.html`：保存した画像と動画のレビュー一覧。展開したZIPからも閲覧可能。

gameフォルダで `npm run dev -- --port 5199 --strictPort` を起動して、`http://127.0.0.1:5199/assets/blender/candidates/crawler/pleat-v3/index.html` を開く。すでにこのポートで今回のサーバーが動いていれば再起動不要。ローカルURLは他の端末から直接開けないため、動画・画像も同梱する。

## 編集・再生成

`DESIGN.md` に設計票、`parameters.json` にパラメータ・seed、`build_candidate.py` に形状と動作の確定的な生成手順。補助コードは `phase1_common.py` の保存コピー。外部画像、毛パーティクル、購入素材は使わず、すべて候補内のメッシュと4つの材質で構成する。

制作版：Blender **5.2.1 LTS**、build hash `9e2066aef7ef`。実行ディレクトリはgame。

```powershell
$blenderExe = 'C:/Users/futsa/AppData/Local/Programs/Blender Foundation/Blender 5.2/blender.exe'
& $blenderExe --background --factory-startup --python-exit-code 1 --python assets/blender/candidates/crawler/pleat-v3/build_candidate.py
```

このコマンドは**この候補版の生成物**を再作成する。既存HOUNDには書き込まない。別の修正版を残す場合は候補フォルダを新しい版へコピーし、候補専用loader・preview・検査/録画スクリプト中のURLと保存先も新しい版へ更新してから実行する。指定外の形・seedを再抽選しない。`-- --blockout` で簡易形状も出力できる。

`pleat_motion_v3.blend` に20骨のリグとNLAトラック3本を保存している。Blenderで再生する際は対象トラックだけmuteを解除する。`pleat_motion_v3.glb` は標準glTF skeletal animationであり、ゲーム専用シェーダーがなくても読込・再生可能。座標はBlender +Y前方 / Z上、GLB -Z前方 / Y上、メートル、原点は接地面。

## 検証の再現

上記Viteを起動後、gameで実行する。

```powershell
node assets/blender/candidates/crawler/pleat-v3/check_candidate.mjs
node assets/blender/candidates/crawler/pleat-v3/check_contacts.mjs
node assets/blender/candidates/crawler/pleat-v3/record_candidate.mjs
node assets/blender/candidates/crawler/pleat-v3/record_gameplay.mjs
```

`check_candidate.mjs` は候補専用loaderと標準Three.jsスキニングを比較し、実Rendererの検証ではPlaywrightの応答差し替えを**その検証ブラウザだけ**に適用する。ディスク上の採用GLB・loader・ゲーム仕様は変更しない。

`candidate-motion.ts` は現行 `src/client/hound-motion.ts` の候補用コピーで、URLだけを変更。プレビューのバッチ描画は実際の `HoundMotionBatch` を使用。今後のloader更新時はこのコピーの追従が必要。

数値検証と見た目の確認範囲は `VALIDATION.md` を参照。性能・形・名称のユーザー承認を自己検証で代替しない。
