# 屋外5マップの遠景（2026-09-10）

屋外の360度にBlender制作の遠景を追加。街区は周辺ビル・窓帯・屋上設備、倉庫は倉庫群・クレーン、工業区は煙突・タンク、草原は森林・二重の山並み、雪峡は針葉樹・雪の稜線。既存地面の外側を低い地面で延長し、地面の切れ目を覆う。

独立した描画専用GLBを出撃先だけ読み込む。共通戦闘・移動境界・弾・敵経路の定義は変更せず、遠景メッシュのraycastも無効化。影を投げず受けず、3〜7バッチ、8,434〜45,874三角形、0.51〜2.75MB/マップ。遠方を見せるため屋外の霧の終端300→950m、カメラfar420→1200m。地下の霧12〜48mと地下モデルは維持。

現在の20ステージに天候・昼夜の派生データはない。既存の屋外全ステージで表示し、既存空色に霧でなじませる。`MapAssets.select` の第三引数 `distantVisible=false` で、将来の濃霧・荒天・夜派生から非表示にできる。今回、新しい天候や昼夜システムは作成していない。

## 制作・差分

- `assets/blender/scripts/build_distant_scenery.py`：固定乱数で5マップ生成、GLB再読込み、非地面の全頂点が中心から180m超にあることを検証。
- `assets/blender/source/maps/distant_{0..4}_v1.blend`：編集用Blenderデータ。
- `public/assets/maps/distant_{0..4}_v1.glb`：配信用データ。
- `src/client/map-assets.ts`：独立ロード・表示切替・判定除外。
- `src/client/render.ts`：遠景距離と屋外霧。
- `scripts/check-distant-scenery.mjs` / `check-distant-lifecycle.mjs`：配布版と切替の検証。

branch `codex/home-armory`、base / HEAD `2be699f160c83d641fb68bb1304e4da8059920dc`。開始時から多数の未コミット・未追跡差分があり保持。今回も未コミット、mergeなし。既存2ファイルの開始時点からの差分は `dist-validation/distant-scenery/task.patch`。

## 検証

- 型チェック成功、単体176件成功。配布用ビルドとWorker dry-run成功。既存の500KB超チャンク警告あり。
- Blender 5.2.1で5つのGLB再読込み、有限頂点・配置・4MB未満を検証成功。`dist-validation/distant-scenery/blender.json`。
- 実ブラウザで読込み中の地下切替、遅れて完了した遠景が地下に出ないこと、非表示→再表示、raycast無効・影無効を確認。`lifecycle.json`。
- 最初の制限環境下の配布版検証は全12画面の表示とハッシュ一致を確認したが、各ページでネットワークアクセス拒否があり不合格。通常通信権限で再検証する。
- 実機のFPS・メモリ・発熱は未確認。今回の描画変更に通信プロトコル変更はない。

通常通信権限での再検証は全6マップ×PC/横画面の12画面で成功。JS/コンソールエラー・横はみ出しなし。5遠景GLBと配布JS/CSSのSHA-256一致。`dist-validation/distant-scenery/preview/checks.json` と各PNG。全5種類のPC画像・草原の横画面・地下を目視確認。

制作データ・配布データ・変更コードのハッシュは `dist-validation/distant-scenery/manifest.json`。

## 公開

2026-09-10、AGENTS.mdの既存公開指示に従い https://swarm-front.melosalife-24.workers.dev へ公開。
Version `ab1048be-967e-4fc2-968f-296b8e290544`。新規5遠景GLBとHTML/JSの計7ファイルを更新。既存のマップGLB・CSS・Worker本体は維持。

公開URLも全6マップ×2サイズの12画面成功。JS/コンソールエラー・横はみ出しなし。新規5遠景GLB・JS/CSSのSHA-256一致、`/api/health` は `ok: true`。最終証拠は `dist-validation/distant-scenery/published/checks.json` と各PNG。
