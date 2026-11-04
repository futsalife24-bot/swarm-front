# トバリ｜ローポリ試作01

2026-11-04。「次のバディに行って」に対応。未制作のトバリを選定。タタラの低く幅広い体、ヨスガの台形頭と二足に対し、浮遊する外套・縦長・細い顔スリットで識別しやすいため。

元repositoryの concepts/01-tobari.png を実際に確認し、設計詳細.txt と仕様根拠と共通設計.txt を参照。資料の旧能力・数値・由来は提案扱い。今回の青灰・琥珀色は外観であり属性を決定しない。

[元絵との比較](review/comparison.png) ／ [四方向](review/directions.png) ／ [12秒動画](review/tobari-motion.mp4) ／ [確認資料](review.html) ／ [編集用blend](tobari.blend) ／ [ゲーム用GLB](tobari.glb)

## 造形と動き

浮遊する青灰の外套、縦長の輪郭、炭色の顔板と細い琥珀スリットを残した。前襟・左右の長い襞・後方の襞を大きな面へ整理。ひび割れ、小穴、細かな積層、内部機構は省略。前後に白い二本線を配置。発光・透過・粒子は使わず頂点色で表現。

- Idle：上下に浮遊し、顔の向きと襞がゆっくり変わる。
- Follow：体を前傾させ、襞が遅れて揺れる。移動経路処理は未実装。
- Display：少し浮き上がり、左右の襞を開いて戻す。能力ゲーム処理は未実装。

## 納品仕様

|項目|実測|
|---|---|
|三角形|1,428|
|材質・メッシュ|1材質・1 skinned mesh・1 primitive|
|骨|7|
|テクスチャ|0枚|
|GLB|287,420 bytes|
|blend|213,189 bytes|
|体高・幅|0.7324m・0.54m|
|基本姿勢の下端／上端|地上0.18m／0.9124m|
|透明・発光・エフェクト|なし|

## 検証結果と未確認

Blender 5.2.1 LTSからGLBを書出して別途読込み。境界差0m、頂点色・1材質・7骨・3動作を確認。各動作を3フレーム間隔で検査し最下端は地上0.1636m以上。[roundtrip.json](review/roundtrip.json)

Chrome／Three.jsの独立プレビューで正面・側面・背面・斜め、兵士との比較、844×390／640×360、0／1／4体を確認。四方向と動作時にモデル全体が入るカメラへ調整した。[validation.json](review/validation.json)

同条件の描画回数は影なし0／1／4体で4／5／8回、影あり6／8／14回。追加は1体あたり影なし1回、影あり2回。影マップ1024²、DPR1。4体は4人各1体を仮定し、製品上限を確定していない。
CPUアニメーション＋描画送信時間の中央値は今回0.2〜0.8ms、P95は0.5〜1.2ms。PC headless Chromeの測定でありGPU完了時間・スマホのフレーム時間ではない。

12秒・30fps・960×640の動画を作成。資料ページで実再生し、小画面で動作選択・停止・再開を確認。[ui-validation.json](review/ui-validation.json)

実スマホ、実戦の敵密集、暗所、灰色表示、通信、属性エフェクト込みの性能・識別は未確認。通常距離の顔スリットと白線は小さいため、輪郭・浮遊を主に識別する。本人による見た目の採否は未確認。兵士は製品GLBを無変更・無拡縮で使用。ゲームへ未統合。

## 再現手順

専用worktreeで既存のBlender・Python/Pillow・Node/Playwright・Chrome・ffmpegを使用。追加インストールなし。

1. Blender CLIで build.py を実行し、blend／GLBを生成。
2. Blender CLIで roundtrip.py を実行。
3. node assets/buddy/tobari-lowpoly-v1/check.mjs
4. node assets/buddy/tobari-lowpoly-v1/video.mjs
5. ffmpeg -y -framerate 30 -i assets/buddy/tobari-lowpoly-v1/review/frames/%04d.png -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart assets/buddy/tobari-lowpoly-v1/review/tobari-motion.mp4
6. python assets/buddy/tobari-lowpoly-v1/sheets.py
7. node assets/buddy/tobari-lowpoly-v1/check-ui.mjs

Blender実行例：& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python assets/buddy/tobari-lowpoly-v1/build.py

対話プレビュー：node assets/buddy/tobari-lowpoly-v1/server.mjs → http://127.0.0.1:4317
node_modules と public/assets/characters/swarm-soldier.glb が必要。ログ・動画の中間フレームは.gitignoreで除外し、再現ソースと最終成果物を管理する。

## 担当記録と共有ノートへの追記案

本人の次個体制作指示を受け、トバリ試作01を制作。モデル・3動作・画像・動画・GLB再読込み・描画比較まで完了。本人の外観レビュー待ち。属性・能力は未決定。タタラ・ヨスガは無変更。共有STATE／MainVaultには直接書き込まず、本節を追記案とする。

GitHub: https://github.com/futsalife24-bot/swarm-front
専用ブランチ: codex/buddy-tatara-lowpoly-20261104
開始HEAD: f42bff5989f6e0489a5238e912dd9a937a4e7b41
対象: assets/buddy/tobari-lowpoly-v1/ のみ。
作業場所: C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-buddy-lowpoly
ゲーム処理・main・本番・Worker公開は変更なし。
実モデルID・推論設定は取得不可／未確認。子エージェント・独立監査なし。
