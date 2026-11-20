# 旧サーバー投影の表示範囲

2026-11-12、基点 `d7d1399` の融合処理をNode内で実行し、表示項目のない戦闘投影を新クライアントの表示処理へ渡した。新LRは変更前の表示関数で等級5となり、実GLTFLoaderが `unique-v1/slug_5.glb` を要求して404、ネオンクラスの色は白になった。

表示値だけを0〜4に収める候補をメモリー内で試したところ、新LRは等級4・金色となり、実在する `slug_4.glb` を隔離ローカルHTTPから読み込めた。投影の新旧9等級で戦闘 `stats` は変更前と候補の間で一致した。正規新5・旧4等級と明示された表示等級0〜4も、表示値は変更前と同じだった。基点の旧コードは元の武器形式を投影に残さないため、新N〜SSRと旧形式の曖昧さはこの補正では解消しない。[記録](fusion-old-server-fallback-report.json)。

旧サーバープロセス、実ブラウザー、実通信、スマホ、公開Workerは使っていない。GLBは実ファイルをローカルHTTPで読み込んだ。比較用の変更前・候補コードは下記スクリプトがメモリー内で作り、製品ソースを変更しない。

```powershell
New-Item -ItemType Directory -Force dist-validation/oldclient-d7 | Out-Null
git archive d7d1399 src/shared | tar -x -C dist-validation/oldclient-d7
Copy-Item docs/evidence/weapon-models-20261111/fusion-old-server-entry.ts dist-validation/oldclient-d7/server-entry.ts
Copy-Item docs/evidence/weapon-models-20261111/fusion-old-server-current-entry.ts dist-validation/old-server-current-entry.ts
Copy-Item docs/evidence/weapon-models-20261111/fusion-old-server-build.cjs dist-validation/fusion-old-server-build.cjs
Copy-Item docs/evidence/weapon-models-20261111/fusion-old-server-fallback.cjs dist-validation/old-server-fallback.cjs
node dist-validation/fusion-old-server-build.cjs
node dist-validation/old-server-fallback.cjs
```
