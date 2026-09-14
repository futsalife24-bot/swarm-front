# 全6マップの素材・陰影ブラッシュアップ（2026-09-13）

ユーザー条件: ポリゴン数を増やさず、各マップに合う実景写真を調べてリアルに寄せる。
開始時点の地形・建物・移動範囲を保持し、既存メッシュの材質と自然面の法線を改善する。
Blender原本/GLBを再生成せず、実ゲームの読込処理で適用。既存の標準4分割LODは維持し、今回の追加分割・オブジェクト・描画パスはゼロ。

## 参考写真と反映内容

写真は観察用。画像そのものをゲームへ転載せず、形態・素材の特徴からオリジナルの手続き表現を実装。

| マップ | 写真資料 | 反映した特徴 |
| --- | --- | --- |
| 灰明の街区 | [Ilūkstes iela集合住宅の外観](https://www.viszinis.lv/Ilukstes-iela-107-k1) | コンクリート板の目地、縦の雨だれ、基礎付近の湿り、舗装の骨材と部分的なひび |
| 薄暮の倉庫地区 | [三陽建設・工場倉庫の外壁写真](https://sanyoukensetsu.co.jp/column/765/) | 金属の縦筋、錆の不均一な広がり、健全部と酸化部の反射差 |
| 蒼鉄の工業区 | [Charleroi旧製鉄施設の写真](https://www.rtbf.be/article/charleroi-le-master-plan-porte-ouest-etat-des-lieux-d-un-projet-qui-compte-bien-faire-rimer-economique-avec-ecologique-11534935) | 鋼材と酸化皮膜の色・金属性の差、街区より強い建物汚染筋、既存配管の経年変化 |
| 風渡る草原 | [LBV・Allgäu Alpsの草原写真](https://www.lbv.de/naturschutz/lebensraeume-schuetzen/alpen/) | 生草と枯草の混在、植生の大小のまとまり、岩の灰色と樹皮の縦溝、丘の柔らかな陰影 |
| 白嶺の雪峡 | [南アルプス・シュカブラ](https://minamialps-shizuokaken.jp/contents/390)、[Ackerlspitzeの雪渓と岩壁](https://www.gipfelbuch.online/wanderung-ackerlspitze-von-wanderparkplatz-wochenbrunneralm-ellmau/) | 風向きに沿う不均等な風紋、雪殻と粉雪の反射差、冷たい雪と暖灰色の岩、積雪面の法線連続性 |
| 晶脈の地底巣 | [BLM・Fort Stanton Caveのフローストーン](https://www.blm.gov/visit/fort-stanton-snowy-river-cave-nca) | 岩層のうねり、明るい鉱物の筋、乾いた岩と湿った鉱物面の反射差 |

## 実装差分

- `src/client/map-surfaces.ts` 新規: 素材別の色・表面粗さ・金属酸化・微細凹凸。ワールド座標で面をまたいで連続させ、遠方の微細模様を減衰。雪と草の浅い面は既存法線を平均化し、鋭い面を保持。
- `src/client/map-detail.ts`: 従来の全素材共通の粒状汚しを新モジュールのexportへ置換。LOD生成は変更なし。
- `src/client/map-assets.ts`: 全6マップで素材処理を実行。軽量も配色/粗さを共有し、微細凹凸は標準のみ。自然法線補正は草原/雪峡のみ。
- `scripts/check-map-realism.mjs` 新規: 同じ6マップ×2画質×2方向で実Rendererを撮影。開始時の三角形数・LOD上限・描画回数・頂点上限と照合し、ブラウザ/シェーダーエラーを検査。

```diff
- if (this.detailed) weatherMapMaterials(scene);
+ if (index === 3 || index === 4) softenNaturalNormals(scene); // batching前
+ weatherMapMaterials(scene, index, this.detailed);
- 全材質に共通の粒状汚し
+ 建材目地/雨筋、鋼材酸化、植生ムラ、風紋、岩層を材質ごとに描画
```

## 検証・監査

branch: `codex/home-armory`、base/head: `4186f25f7c9695f95ea897ad182db5f85fac3091`。未コミット。開始時から存在する多数の変更を保全。
開始時の変更対象全文: `dist-validation/map-realism/baseline/`。比較画像と数値: `dist-validation/map-realism/before/`・`after/`。

検証の最終結果は作業完了時に追記する。初回24画面は三角形・頂点・描画回数一致、エラー0。後続調整で生じた一時的なTypeScript挿入位置の構文エラーは修正し、最終版の再検証対象に含めた。

制約: 実スマホのGPU性能は未計測。ポリゴン据置でもピクセル単位の素材計算コストは変わる。今回は輪郭や通路を作り直さず、元モデルの低ポリゴンのシルエットは残る。公開状態は最終結果に記録する。

## 最終検証結果・公開待ち

- 型チェック成功。既存のマップ・地形・背景境界テスト20件成功。
- 最終版の全6マップ×2画質×2方向、24画面のページ/シェーダーエラー0。全条件でマップのlow/high三角形数・タイル数一致、頂点数増加なし。草原/雪峡では法線共有により頂点数が減少。
- 三角形数（low / 標準の最大LOD、変更前後同一）: 街区246,032 / 984,128、倉庫73,712 / 294,848、工業171,400 / 685,600、草原213,930 / 855,720、雪峡59,557 / 238,228、洞窟57,260 / 229,040。
- 最終画像24枚の一覧を目視確認。比較ページのマップ/画質/方向切替と画像読込を実Chromeで確認。`review.html`・`contact.png`・`review-check.png`。
- 最初のカウンター比較は画面全体の三角形数で失敗（街区271,039対324,483）。マップのlow/high/tilesは同値で、画面には非同期に読み込まれる兵士・遠景も含まれる。検査をマップ単体のポリゴン予算へ修正し、保存済みの最終24件を再照合して成功。`report-map-realism.mjs`・`budget.json`。画像/本体ソースの再変更なし。
- client/Pagesビルド、本番Worker dry-run成功。dry-runの初回はサンドボックスのログ書込/親フォルダ参照制限で失敗し、許可された通常権限で成功。既存の500KB超チャンク警告あり。
- 配布版6マップ×PC1280×720/横持ち844×390の12出撃・HUD・横はみ出し0・GLB/JS/CSSハッシュ一致。`release/checks.json`。スクリプト全体は外部CAPTCHAのGETに対するサンドボックス通信遮断だけで失敗（24ログ）。追加の通常権限でのホーム画面確認では対象応答を捕捉できず30秒タイムアウト。外部CAPTCHAの読込は未確認として残す。ゲーム描画エラーは記録なし。
- 実Android/iPhoneのGPU性能は未確認。今回の色・凹凸は完全なフォトリアル化やモデル輪郭の再制作ではない。
- 検証済みソース/配布JS/CSSのSHA256: `verified-hashes.json`。開始時点との差分: `change.patch`。今回の実装対象3ファイルと新規検証2本、本書、STATE冒頭のみ。

2026-09-13、本番Workerへの `npx wrangler deploy --config wrangler.production.jsonc` は自動承認レビューに拒否され、実行されていない。理由: 「本番Workerへの実デプロイでサービス内容を変更する不可逆・共有環境への副作用があり、ユーザーの明示的な公開承認がありません」。game/AGENTS.mdの公開既定を根拠にしたが、今回の明示承認を求められたため迂回・再試行はしない。

停止理由: 検証済みの全6マップ素材・陰影修正版を既存本番Workerへ公開する明示承認待ち。
再開条件: ユーザーが今回の修正版の公開を承認。保存済みソース/配布ハッシュを確認後、公開・公開版確認を行う。

## 公開完了（2026-09-13）

ユーザーの「公開して」で今回の明示承認を取得。検証済みソース3ファイルと配布JS/CSSのSHA256一致を確認し、既存Workerへ公開。
- Version: `58192466-522f-483d-9827-0dd17c57832d`
- URL: https://swarm-front.melosalife-24.workers.dev
- 公開版の全6マップ×PC1280×720/横持ち844×390の12出撃・HUD・横はみ出し0・GLB/JS/CSSハッシュ一致を確認。ページ/コンソール/通信エラー0。公開版では既存CAPTCHA読込の遮断もなし。
- health正常（ok:true、websocket / durable-object）。実スマホのGPU性能は未計測。
- 証拠: `dist-validation/map-realism/published/checks.json`、同フォルダ12画像、`published-health.json`。
- branch/base/headは前節と同一、未コミット変更を維持。公開承認待ちは解消済み。
