> 2026-09-12更新（公開済み）: 全6マップに登れる高低差と段差・小物を追加。以下の平面床という説明は制作当時の記録です。現行仕様は [地形刷新](TERRAIN-REFRESH.md) を参照。

# 全6マップのBlender制作・拡張（2026-09-10）

Blender 5.2.1 LTSで全6マップを制作し、ゲームへGLBとして組み込んだ。既存のステージID・編成・武器性能・キャラクター寸法と移動速度は維持。

## 寸法

屋外は縦横を各2倍：94×104m → **188×208m**（面積4倍）。建物・岩の水平配置と設置面を各2倍、建物の高さは維持。

洞窟は接続地点の間隔を2倍にし、中心線15本の合計 **315.776959m → 631.553919m**。全区間の倍率は2。通路半径6.8m（幅13.6m）、最大天井高10.5m、主要広間半径9mは維持。環状ルート2つ・分岐・袋小路も維持。

移動境界・ミニマップ・プレイヤー開始位置・通常増援とボスの出現位置も拡張範囲に対応。洞窟の移動・射撃・カメラ・敵の経路探索は従来の共通距離場を拡張して使用。

## 見た目と編集用ファイル

| マップ | 制作内容 | Blender元データ |
| --- | --- | --- |
| 灰明の街区 | 外壁、窓枠・窓台、屋上空調、配管、道路、街灯 | assets/blender/source/maps/map_0_v1.blend |
| 薄暮の倉庫地区 | 倉庫外壁、金属シャッター、錆、屋上、搬入道路 | assets/blender/source/maps/map_1_v1.blend |
| 蒼鉄の工業区 | 工業棟、煙突、警戒帯、配管、設備 | assets/blender/source/maps/map_2_v1.blend |
| 風渡る草原 | 草地、踏み道、草葉、広葉樹、起伏のある外周の丘 | assets/blender/source/maps/map_3_v1.blend |
| 白嶺の雪峡 | 雪面、岩壁、雪山の稜線、針葉樹 | assets/blender/source/maps/map_4_v1.blend |
| 晶脈の地底巣 | 丸い岩層、岩肌の凹凸、土床、鉱石 | assets/blender/source/maps/map_5_v1.blend |

色・法線・粗さの画像テクスチャを使用。画像も `.blend` へ同梱し、GLBへ埋め込む。BlenderのGLB対応に沿ってPrincipled BSDFへ画像を直接接続する。[Blender公式glTF資料](https://docs.blender.org/manual/en/5.1/addons/import_export/scene_gltf2.html)

`assets/blender/maps-layout-v1.json` が書き出し用地形。`scripts/export-map-source.mjs` でゲーム定義から更新し、`assets/blender/scripts/build_maps_v1.py` で全マップを再生成できる。GLBは `public/assets/maps/map_{0..5}_v1.glb`。

ゲームでは出撃先だけ読込み、屋外は静的な影を使用。ロード失敗時には衝突配置に沿った簡易表示を残す。模型を拡大してキャラクターや洞窟の太さまで変える処理はない。

## 検証・証拠

- Blenderで6つの `.blend` とGLBを再読み込み。三角形数・境界寸法・UV・正の単位スケール・有限座標を照合して成功。`dist-validation/maps-blender/reimport.json`。
- モデルは3〜8描画バッチ、約2.3〜15.2MB/マップ。GLBは各ファイル25MiB未満。テクスチャを含む詳細寸法・頂点データは `map-0.json`〜`map-5.json`。
- Chrome 1280×720で全6マップのGLB読込み成功とゲーム出撃、JSエラーなし。`dist-validation/maps-blender/browser/checks.json` と `map-0.png`〜`map-5.png`。
- 拡張後の全20ステージを通常入力の自動操縦で制限時間内に攻略。遠い敵が見えるだけで射程外から撃ち続けないよう、テスト操縦の探索条件も更新。HP・時間・敵数の書き換えなし。
- 初回の固定座標テストは旧建物位置を使っていたため、拡張後の壁を参照するように修正。建物越しの射撃・飛行敵の屋根越え・蘇生射線・ボスの射線条件の検出内容は維持。
- Android実機のFPS・メモリ・熱、実機4台の操作感、人間の攻略バランスは未確認。草葉・街灯・遠景は装飾で、登れる地形や建物破壊は今回の対象に含まない。岩上部は描画上の起伏、移動用の床は水平。

## 差分と公開範囲

branch `codex/home-armory`、base / HEAD `2be699f160c83d641fb68bb1304e4da8059920dc`。作業開始時から多数の未コミット差分・未追跡ファイルあり、既存作業を保護。commit / mergeなし。

新規 `src/shared/arena.ts` に範囲と倍率、`src/shared/stages.ts` と `cave.ts` に水平拡張。`game.ts` は境界・開始位置・出現座標を更新。`src/client/map-assets.ts` がGLBの読込みと簡易表示、`render.ts` は旧環境生成を置き換え、静的な影・遠景距離を更新。`minimap.ts` と簡易洞窟表示は新範囲に追従。`main.ts` は開発診断へマップ読込み状態を追加。

テスト変更はmaps/game/hornet/rescue/structure-v2/stages/botと協力E2E。制作・検証スクリプト、Blender元データ、テクスチャ、GLBと本書を追加。

別作業のメニュー外観は、本作業中に明示承認・公開済みへ更新された（MENU-DESIGN.md）。最新のメニュー外観を今回のビルドにも含める。

最終検証と公開結果は以下のとおり。

### 最終検証

- 単体テスト14ファイル・176件成功（最終実行19.06秒）。厳格な型検査とVite公開用ビルド成功。
- 実Workerで2画面のST20同期成功。4画面でも全員参加・ST10同期・全員の洞窟GLB読込みを確認。
- 4画面同時SwiftShader描画下の連続移動E2Eは失敗。診断でゲーム時刻19.1秒に対し入力seq50・HP7.78を観測し、入力更新の遅延を確認。これを4台実機の合格とは扱わない。
- 描画負荷を分離した4本の実WebSocketで、通常入力だけによる入口→左右分岐→隊員間60m超の移動と全員への同期を11.7秒で確認。通信モック・敵停止・HP/位置/時間の上書きなし。
- 4人通信テストと表示テストを分離して再現可能にした。playwright.stages.config.tsは専用ポート5317/8917へ変更。
- 最終配布版1280×720・844×390の全6マップ（計12画面）でGLB読込み、HUD、横はみ出しなし、JS/コンソールエラーなしを確認。配布JS/CSS/全GLBのSHA-256一致。`production-preview/checks.json` と各PNG。
- 最終Worker dry-run成功。39配布ファイル、Worker本体81KiB。配布物・Blender元ファイルのSHA-256は `release-manifest.json`。変更前スナップショットからのテキスト差分は `task.patch`。

## 公開

2026-09-10、既存Workerへ公開済み。
- URL: https://swarm-front.melosalife-24.workers.dev
- Version: `ed291edb-6189-47bf-be26-5d9c9d9dd355`
- 新規・変更8ファイル（HTML、JS、6つのGLB）を配布。既存メニューCSSは同一。
- `/api/health` は `ok: true`。公開URLでもPC・横持ちの全6マップ（計12画面）で表示成功、JS/コンソールエラーと横はみ出しなし。全GLB・配信JS/CSSが検証済みローカル配布物とSHA-256一致。`dist-validation/maps-blender/published/checks.json` と各PNG。
