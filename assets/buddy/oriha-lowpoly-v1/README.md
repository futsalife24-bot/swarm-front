# オリハ｜ローポリ試作01

2026-11-04。本人の「作って」に基づきオリハを制作。元repositoryの concepts/04-oriha.png を実際に確認し、設計詳細.txt のオリハ節を参照。細長いS字の浮遊体、扁平な節、特徴的な頭と一枚尾の3点を軸にした。旧能力・仮数値・由来は提案扱いで、属性・ゲーム能力を決定していない。

[元絵比較](review/comparison.png) ／ [四方向](review/directions.png) ／ [12秒動画](review/oriha-motion.mp4) ／ [確認資料](review.html) ／ [編集用blend](oriha.blend) ／ [ゲーム用GLB](oriha.glb)

## 造形と動作

骨灰色の5つの扁平な節、青緑の節帯、暗い継ぎ目を少数の大きな面で表現。尖った扁平な頭、短い襟ひれ2枚、一枚の葉形の尾を配置。襟ひれに白い二本線を残した。ひび割れ、小穴、細かな装甲重なりや内部機構は省略。角・髭・脚・宝玉は追加していない。

- Idle：S字の姿勢で静かに浮遊し、節から尾へ波が伝わる。
- Follow：振幅を増やして体を波打たせる。その場動作で、経路処理は未実装。
- Display：節の長さを保ちながら、S字からまっすぐな姿勢へ伸びて戻る。ゲーム効果は未実装。

## 納品仕様

|項目|実測|
|---|---|
|三角形|2,008|
|材質・メッシュ|1材質・1 skinned mesh・1 primitive|
|骨|10|
|テクスチャ|0枚|
|GLB|353,164 bytes|
|blend|298,035 bytes|
|基本形の前後長／幅／高さ|約1.260m／0.292m／0.3886m|
|下端／上端|地上0.3529m／0.7415m|
|透明・発光・粒子|なし|

設計資料の全長0.85mは仮値。今回は節・頭・尾の見分けやすさを優先し、基本形の前後長を約1.26mとして試作した。兵士との比較画像を用意。製品のサイズ確定ではなく、必要なら後続で全体縮尺を調整できる。

## 検証

Blender 5.2.1 LTSからGLBを書出し別途読込み。境界差0m、頂点色・材質・10骨・3動作を確認。3フレーム間隔の最低点は地上0.3296m以上。[roundtrip.json](review/roundtrip.json)

独立Chrome／Three.jsプレビューで正面・側面・背面・斜め、動作時、兵士との比較、844×390／640×360の0／1／4体を確認。例外なし。[validation.json](review/validation.json)
描画は0／1／4体で影なし4／5／8回、影あり6／8／14回。追加は1体あたり影なし1回、影あり2回。影1024²、DPR1。4体は協力4人各1体の仮定。
PC headless ChromeのCPUアニメーション＋描画送信中央値は今回0.2〜0.7ms。GPU完了時間や実スマホのフレーム時間を示さない。

12秒・30fps・960×640の動画を作成。実再生、小画面での選択・停止・再開、横はみ出しなしを確認。[ui-validation.json](review/ui-validation.json)

実スマホ・実戦・敵密集・暗所・通信・属性エフェクト込みの性能と識別は未確認。通常カメラでは進行方向と重なるため細く見える。スリットや白線だけで識別できるとは保証せず、色と分節した浮遊体を主な手がかりとする。本人の外観採否は未確認。

## 再現

既存のBlender・Python/Pillow・Node/Playwright・Chrome・ffmpegを使用。追加インストールなし。

1. Blender --background --factory-startup --python assets/buddy/oriha-lowpoly-v1/build.py
2. Blender --background --factory-startup --python assets/buddy/oriha-lowpoly-v1/roundtrip.py
3. node assets/buddy/oriha-lowpoly-v1/check.mjs
4. node assets/buddy/oriha-lowpoly-v1/video.mjs
5. ffmpeg -y -framerate 30 -i assets/buddy/oriha-lowpoly-v1/review/frames/%04d.png -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart assets/buddy/oriha-lowpoly-v1/review/oriha-motion.mp4
6. python assets/buddy/oriha-lowpoly-v1/sheets.py
7. node assets/buddy/oriha-lowpoly-v1/check-ui.mjs

Blender実体: C:/Program Files/Blender Foundation/Blender 5.2/blender.exe
対話プレビュー: node assets/buddy/oriha-lowpoly-v1/server.mjs → http://127.0.0.1:4317
既存node_modules と public/assets/characters/swarm-soldier.glb が必要。ログ・中間フレームは除外、再現ソース・最終成果物を管理。

## 担当記録・共有ノートへの追記案

本人がトバリ07を了承し、次のオリハ制作を指示。オリハ試作01のモデル・3動作・画像・動画・GLB照合・描画比較を納品。本人の外観レビュー待ち。共有STATEとMainVaultには直接書かず、この節を追記案とする。

GitHub: https://github.com/futsalife24-bot/swarm-front
専用ブランチ: codex/buddy-tatara-lowpoly-20261104
開始HEAD: 3a4888a43a792806f5caf70be886a578af9da2fa
対象: assets/buddy/oriha-lowpoly-v1/ のみ。
作業場所: C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-buddy-lowpoly
既存個体・ゲーム・main・公開環境は無変更。
実モデルID・推論設定は取得不可／未確認。子エージェント・独立監査なし。
