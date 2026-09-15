import fs from 'node:fs';import cp from 'node:child_process';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const enemy=process.argv[2],out=`dist-validation/${enemy}-v1`,hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const checks={};for(const [name,args]of [['typecheck',['node_modules/typescript/bin/tsc','-p','tsconfig.json']],['workerTypecheck',['node_modules/typescript/bin/tsc','-p','tsconfig.worker.json']],['build',['node_modules/vite/bin/vite.js','build']]]){try{const output=cp.execFileSync(process.execPath,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});fs.writeFileSync(out+'/'+name+'.log',output);checks[name]='PASS'}catch(e){fs.writeFileSync(out+'/'+name+'.log',String(e.stdout)+String(e.stderr));throw e}}
const productionJS=fs.readdirSync('dist/assets').filter(p=>p.endsWith('.js')).map(p=>fs.readFileSync('dist/assets/'+p,'utf8')).join('');assert.ok(!productionJS.includes('Unexpected prototype material batch count'));assert.ok(!productionJS.includes('GLB failed · Current'));checks.productionDebugCodeExcluded=true;
const b=JSON.parse(fs.readFileSync(out+'/blender-validation.json')),v=JSON.parse(fs.readFileSync(out+'/validation.json'));checks.blender='PASS';checks.browser='PASS';checks.visualQA='Reviewed comparison oblique and actual Renderer mobile image';checks.performanceScope='Desktop Chrome SwiftShader CPU submission only; mobile GPU untested';fs.writeFileSync(out+'/checks.json',JSON.stringify(checks,null,2));
const [title,query,design,limitations]=({prism:['PRISM','Prism','非対称の7枚の独立浮遊プレート、多面体コア、石色の面・真鍮の縁・エメラルド発光、前方の精密射撃口を採用。既存のspitter実寸を基準に翻訳。頂点面と材質で構成しテクスチャなし。','上部までの高さは既存2.45mから3.01mへ増加。圧力役の縦シルエットを優先した試作で、採用時は大きさを確認。遠景では留め具や細い溝は判別しにくい。'],ray:['RAY','Ray','中央空洞、海洋生物を誤模倣した左右の湾曲面、3本の独立した尾、藍色の外皮・暗い機械骨組み・冷たい青緑発光を採用。既存hornetの飛行高さへ既存行列で追従。','静止試作のため空中遊泳はシルエットによる表現。尾の可動化と実機遠景視認性は次工程。'],foundry_zero:['FOUNDRY ZERO','Foundry','中央の炉心、環状搬送路、6本の支持脚、トラス・煙突・非対称クレーンと搬送荷を採用。工業白・暗い鋼材・警戒黄・アンバーの熱源で歩く工場を表現。','既存ボスの当たり判定・高さ仕様を維持した縮尺。コンセプトシートの12mをそのまま導入していない。クレーン・炉・脚は静止。']}[enemy]);
const paths=[`assets/blender/scripts/build_${enemy}_v1.py`,`assets/blender/source/${enemy}_v1.blend`,`public/assets/enemies/${enemy}_v1.glb`,`docs/${title.replaceAll(' ','-')}-BLENDER-PHASE1.md`];
const text=`# ${title} — Blender Phase 1 / local prototype

## 範囲・参考
${design}
主参考: このチャットの${enemy==='prism'?'Photo 1':enemy==='ray'?'Photo 2':'Photo 3'}コンセプトシート。HOUND v3の再生成・材質バッチ・開発query・失敗fallback・検証方式を継承。HOUND成果物は変更なし。通常モデルの正式置換、commit/push/merge/公開/production反映なし。

## 成果物
${paths.map(p=>'- `'+p+'`').join('\n')}
共通: phase1_common.py / check_enemy_phase1.mjs / record_enemy_phase1.mjs / preview-enemies/index.html / src/client/enemy-glb-debug.ts。render.tsへ開発queryと同期処理だけを追加。

## 数値
- triangles: ${b.source.triangles}
- materials / meshes: ${b.source.materials.length} / ${b.source.meshes.length}
- GLB: ${b.glb_bytes} bytes (${(b.glb_bytes/1024).toFixed(2)} KiB)
- glTF bounds min: ${JSON.stringify(v.geometry.bounds.min)}, max: ${JSON.stringify(v.geometry.bounds.max)}
- current bounds: ${JSON.stringify(v.geometry.current)}
- ground/hover clearance: ${b.ground}m。Blender Z-up / forward +Y → glTF Y-up / forward −Z。unit scale=1、追加runtime補正なし。
- ${enemy==='foundry_zero'?'脚底をY=0へ接地。':'浮遊モデルのため接地ではなく原点からの正のクリアランスを確認。'} 既存インスタンス行列を使い、敵AI/HP/hitbox/waveは変更なし。

## ローカルで確認
- npm run dev -- --port 5198
- http://127.0.0.1:5198/?debug${query}Glb=v1 （=1も有効）→通常操作で出撃。${title} v1 / Currentボタンで往復。
- http://127.0.0.1:5198/assets/blender/preview-enemies/index.html?enemy=${enemy}
- 比較は画面左GLB・右Current。正面・側面・斜め・シルエットを切替可能。
- Blender再生成: blender.exe --background --factory-startup --python-exit-code 1 --python assets/blender/scripts/build_${enemy}_v1.py
- 検証: node assets/blender/scripts/check_enemy_phase1.mjs ${enemy}

## 検証結果
Blender生成 / .blend保存 / GLB export / 再読込 / bounds・tri一致 / 非退化三角形 / 正のunit scale 合格。テクスチャ0・animation0。typecheck（client+worker）/ build 合格。buildには既存の500kB超チャンク警告。
通常URLはGLB要求0で既存表示。debugでGLB表示、Current往復、実Rendererで読込失敗fallback、World JSON不変、world消去でinstance 0を確認。表示成功経路のJS・console error 0。失敗試験の意図したnet::ERR_FAILEDは別記録。生産buildのJSからdebug専用処理が除外されることを確認。publicのGLBはdistへコピーされるが公開していない。

|体数|各batch count|モデルdraw calls|シーンdraw calls|
|---:|---|---:|---:|
${v.counts.map(r=>`|${r.count}|${r.counts.join('/')}|${r.modelDrawCalls}|${r.sceneDrawCalls}|`).join('\n')}
${enemy==='foundry_zero'?'ボスは通常雑魚より少数・大型のため1/5/10体を採用。10体をストレス条件とし、waveへ投入する仕様ではない。':'1/10/40体は既存HOUNDと同条件の静止World負荷比較。'} 全instance countと描画を確認。全体が画面内に入る保証ではなく、各配置スクリーンショットを保存。
forward dot=${v.instancing.forwardDot}、全モデルがinstance原点より下へ潜らないことを確認。最大体数のCPU描画送信30回平均=${v.instancing.cpuSubmitMsPerFrame.toFixed(3)}ms。Chrome headless ANGLE SwiftShader / 844×390 / DPR1。GPU処理時間・FPS・スマホ実機性能の代用ではない。

## 証拠
dist-validation/${enemy}-v1/: compare_front/side/oblique.png, prototype_silhouette.png, prototype_gameview.png, prototype_mobileview.png, prototype_mobileview_unoccluded.png, current_gameview.png, prototype_1/10/40_mobile.png（ボスの系列は1/5/10）。Blender-validation.json、validation.json、checks.json、artifact-hashes.json、typecheck/buildログ。共通差分と開始ハッシュはdist-validation/enemies-phase1/。

## 残課題・次工程
${limitations}
静止材質バッチへ結合済み。論理パーツ名は生成スクリプトとGLB extrasに保存したが、rig・pivot契約・モーションcontrollerは未実装。採用確認後に結合前の論理パーツからモーション試作へ進める。スマホ実機の負荷・発熱・長時間FPSは未検証。造形の正式採否はユーザー判断。

## Git / 保護
branch: codex/home-armory。base/HEAD: 2be699f160c83d641fb68bb1304e4da8059920dc。開始時から多数の未コミット差分あり。今回も未コミット。既存差分はreset/stash/checkoutせず、render.tsは開始時コピーとの追加差分を保存。最終保存照合は共通preservation.jsonを参照。外部Chat監査や正式採用の承認を意味しない。
`;
fs.writeFileSync(paths[3],text);fs.writeFileSync(out+'/artifact-hashes.json',JSON.stringify(Object.fromEntries(paths.map(p=>[p,{sha256:hash(p),bytes:fs.statSync(p).size}])),null,2));console.log(title+' recorded',checks);

