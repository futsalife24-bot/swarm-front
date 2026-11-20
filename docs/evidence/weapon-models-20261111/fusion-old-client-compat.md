# 基点の旧受信コードと融合武器の照合

2026-11-12、基点 `d7d1399` の `state-tuples.ts`、`state-wire.ts`、`progression-weapons.ts`、`weapon-rarity-glow.ts` とその依存を隔離コピーし、ローカルWorkerの実WebSocketから受信した状態をNode上で処理した。新N・新LR・旧Rの3人がそれぞれ融合強化し、通常JSON・tuple v1・tuple v2の各接続で旧デコーダと旧装備キャッシュが受理、追加の表示等級0・4・1を受け取った。実際に装備が省略された後続パケットでも旧キャッシュから同じ値を復元した。旧GLTFLoaderによる実GLB読込は隔離ローカルHTTPの `realism-v2/shotgun_0.glb` と `shotgun_4.glb` で成功。2ファイルとも基点のGit blobと現在の実体が一致した。[結果](fusion-old-client-compat-report.json)。

ただし旧 `progressionWeaponModel` は、融合投影に `format: 2` がない場合、読込済みの個別モデルを返さなかった。基点の `standard-trooper.ts` はその場合に従来形状を使う構造で、実装上フォールバックすると判断できるが、その画面表示自体は実行していない。旧ネオンクラスの色は新NがR色、新LRは範囲外の等級5になり白だった。旧Rは旧R色だった。追加項目を読み飛ばせることと、旧版で正しい外観になることは別であり、後者は確認できなかった。旧画面全体・旧実ブラウザー・公開Worker・スマホ・すべての強化は未確認。

再現時は既存のテスト用Workerを `127.0.0.1:8789` で起動し、以下をworktreeルートで実行する。鍵ファイルの値は出力しない。隔離先は既存ファイルを削除せずに作成する。

```powershell
New-Item -ItemType Directory -Force dist-validation/oldclient-d7 | Out-Null
git archive d7d1399 src/shared src/client/progression-weapons.ts src/client/weapon-rarity-glow.ts | tar -x -C dist-validation/oldclient-d7
Copy-Item docs/evidence/weapon-models-20261111/fusion-old-client-entry.ts dist-validation/oldclient-d7/entry.ts
Copy-Item docs/evidence/weapon-models-20261111/fusion-old-client-compat.cjs dist-validation/oldclient-d7/run.cjs
@'
require('esbuild').buildSync({entryPoints:['dist-validation/oldclient-d7/entry.ts'],bundle:true,platform:'node',format:'cjs',outfile:'dist-validation/oldclient-d7/old.cjs',define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'}})
'@ | node -
$env:SWARM_TEST_VARS_PATH='dist-validation/front-wire-fixture.vars'
node dist-validation/oldclient-d7/run.cjs
```
