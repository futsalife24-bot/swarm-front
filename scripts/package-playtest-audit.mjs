import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {createServer} from 'vite';
const root=process.cwd(),evidence='dist-validation/playtest-v1',bundle=`${evidence}/audit-package`;
const own=['src/bootstrap.ts','src/shared/progression.ts','src/shared/solo-progression.ts','src/client/playtest-app.ts','src/client/playtest.css','src/client/progression-save.ts','src/client/progression-coop.ts','src/client/progression-weapons.ts','src/client/weapon-sharing.ts','vitest.playtest.config.ts',...fs.readdirSync('tests').filter(p=>/^playtest.*\.test\.ts$/.test(p)).map(p=>'tests/'+p),...fs.readdirSync('scripts').filter(p=>/^(check-playtest-|build-playtest-|package-playtest-)/.test(p)).map(p=>'scripts/'+p),'docs/PLAYTEST-V1.md','docs/PLAYTEST-V1-STAGES.md','docs/SwarmFront_Codex_handoff_prompt.txt','docs/SwarmFront_grilling_playtest_spec_v1.md','public/assets/weapons/progression-v1/manifest.json'];
const vite=await createServer({server:{middlewareMode:true}});
try {
 const g=await vite.ssrLoadModule('/src/shared/progression.ts'),{STAGES,troopCount}=await vite.ssrLoadModule('/src/shared/stages.ts'),sweep=JSON.parse(fs.readFileSync(`${evidence}/clear-sweep.json`,'utf8'));
 const lines=['# 初期試遊 v1 — 面別設定・検証','', '面別時間/増援/中補正は実装者の仮設定。確率表/コインは仕様の採用済み暫定値。記録された装備で通常入力の共通シミュレーションを実行し、全42条件で勝利。時間は作戦秒数。','', '| 面 | 難易度 | ②目標 秒 | 増援待ち 秒 | 予定敵 | コイン | N/R/SR/SSR/LR % | 攻略 秒 | 最大敵数 | ③条件 | コイン/分 |','| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- | ---: |'];
 for(const r of sweep){const cfg=g.settings(r.stage,r.difficulty),plan=STAGES[(r.stage===21?3:r.stage)-1],n=plan.waves.reduce((n,w)=>n+troopCount(w)+w.bosses.length,0),coins=g.victoryCoins(r.stage,r.difficulty);lines.push(`| ${g.stageLabel(r.stage)} | ${r.difficulty==='normal'?'通常':'中'} | ${cfg.timeLimit} | ${cfg.waveWait[0]} | ${n} | ${coins} | ${g.rarityWeights(r.stage,r.difficulty).map(p=>+(p*100).toFixed(3)).join('/')} | ${r.time.toFixed(2)} | ${r.peak} | ${r.medkitUsed?'未確認（救急箱使用）':'達成'} | ${(coins/r.time*60).toFixed(1)} |`);}
 fs.writeFileSync('docs/PLAYTEST-V1-STAGES.md',lines.join('\n')+'\n');
} finally {await vite.close();}
const before=JSON.parse(fs.readFileSync(`${evidence}/before-hashes.json`,'utf8').replace(/^\uFEFF/,'')),changed=[];let patch='';
for(const entry of before){const relative=path.relative(root,entry.Path).replaceAll('\\','/'),now=crypto.createHash('sha256').update(fs.readFileSync(entry.Path)).digest('hex').toUpperCase();if(now!==entry.Hash){changed.push(relative);const old=`${evidence}/before/${relative}`;const r=spawnSync('git',['diff','--no-index','--',old,relative],{encoding:'utf8'});if(![0,1].includes(r.status))throw Error(r.stderr);patch+=r.stdout;}}
const index=spawnSync('git',['diff','--','index.html'],{encoding:'utf8'});if(index.status!==0)throw Error(index.stderr);patch+=index.stdout;fs.writeFileSync(`${evidence}/implementation.patch`,patch);
fs.mkdirSync(bundle,{recursive:true});
function copy(from,to=from){const target=path.join(bundle,to);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(from,target);}
for(const file of [...own,...changed,'index.html'])copy(file);
for(const file of changed)copy(`${evidence}/before/${file}`,`before/${file}`);
for(const file of fs.readdirSync(evidence).filter(p=>/\.(json|png|patch)$/.test(p)&&!['before.patch','death.json'].includes(p)))copy(`${evidence}/${file}`);
copy('dist-validation/aim-scope/network.json');
const report={branch:spawnSync('git',['branch','--show-current'],{encoding:'utf8'}).stdout.trim(),head:spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim(),uncommitted:true,baselineFiles:before.length,changedExisting:changed,preservedExisting:before.length-changed.length,newFiles:own,notes:'Only this task source, baseline context, incremental patch, specifications and evidence. Binary models/blends stay in the repository; manifest and rendered proofs are included.'};
fs.writeFileSync(`${evidence}/handoff.json`,JSON.stringify(report,null,2));copy(`${evidence}/handoff.json`);
fs.writeFileSync(`${bundle}/README.txt`,'初期試遊v1 監査用資料\n先に docs/PLAYTEST-V1.md と docs/PLAYTEST-V1-STAGES.md を参照。\n着手時の未コミット変更を基点にした接続差分は dist-validation/playtest-v1/implementation.patch。新規ファイル本文は各src/tests/scripts。beforeは変更した既存ファイルの着手時控え。\nこれはChat独立監査の合格や公開承認ではありません。未公開・未コミット。\n');
console.log(JSON.stringify(report));
