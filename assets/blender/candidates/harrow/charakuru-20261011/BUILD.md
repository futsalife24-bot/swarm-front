# HARROW新モデルの再生成と検証

造形資料は `references/user-design.jpg`。Charakuruで生成・選定・分割・Smart UV・4K材質化した原本を保持し、非人型の専用39骨と12動作をゲーム用候補に組み立てる。旧v10の表面への置換ではない。

## 入力と再生成

- `production-baseline.json` と `models/production-inventory.fbx` が制作時の部品一覧と形状。
- `models/normalized-returns/` は全三角形・UVコーナーの一意対応を検査した材質返却FBX。元の返却ファイルは `models/textured/` に保持。
- `build_candidate.py` はインストール済みCharakuru 1.0.2の未変更 `scripts/production.py` を読み込む。別PCでは冒頭の `KIT` をインストール先へ合わせる。
- Blender 5.2.1 LTSで `--background --factory-startup --disable-autoexec --python-exit-code 1 --python build_candidate.py -- --animate --no-render` を実行する。実行場所に依存せず、この文書のフォルダーへ `harrow.blend` / `harrow.glb` を生成する。
- `animation_contract.py` が新規リグへ40fpsで12動作を生成する。尺を正確に収めるため40fpsを使い、ゲーム側は既存の60fpsアトラスへ変換する。

公開用コピーは `public/assets/enemies/harrow_motion_v11.glb`。コピー前後のSHA256一致を確認する。旧公開v10と元生成物は保持する。

## 形状調整

肩のミサイルを左右各5本に整理し、不要なすね突起と首の後方突起を除去。小腕へ各3本の爪を追加。頭部位置を長い首に合わせ、地上姿勢では尾と翼先端の床抜けを防ぐ。左右で異なる翼と元の4K材質を保持する。

## 検証

`node verify_asset.mjs` で実GLBの22スキンメッシュ、39骨、同一バインド、ウェイト合計、12動作の尺、Root非移動、回転時の翼接地・到達距離、10本の発射原点を検査する。画像デコードはNode側で代替しており、実ブラウザで別途確認する。

Vite起動後、このフォルダーの `preview.html` で実GLBの材質・各動作・多方向を表示する。`画像を保存` と `動作動画を保存` はブラウザダウンロードを使う。保存イベントだけで失敗判定せず、実ファイルの形式・サイズ・ハッシュを検査して `review/` へコピーする。

実ゲームの描画確認は既存 `scripts/harrow-preview.html` を使用する。モデル単体の表示と、本番の材質結合・GPUアトラス・戦闘ロジックを経由した描画を区別する。

`review/animation-trial/` は動作担当の一時試験。正式な公開候補は上記 `harrow.glb` と、そのSHAを含む `review/asset-verification.json`。試験用Blend/GLBを正式版と混同しない。
