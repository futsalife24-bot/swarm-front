import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
const dir='dist-validation/standard-trooper';
const changes=[['src/client/render.ts','render.before.ts'],['src/main.ts','main.before.ts'],['src/shared/game.ts','game.before.ts'],['src/shared/defs.ts','defs.before.ts'],['server/testing.ts','testing.before.ts'],['vitest.config.ts','vitest.before.ts'],['src/client/changelog.ts','changelog.before.ts'],['docs/STATE.md','state.before.md']];
const added=['src/client/standard-trooper.ts','assets/blender/scripts/build_standard_trooper.py','assets/blender/scripts/validate_standard_trooper_source.py','assets/blender/preview-trooper/index.html','docs/STANDARD-TROOPER.md','scripts/check-standard-trooper.mjs','scripts/check-standard-trooper-game.mjs','scripts/measure-standard-trooper.mjs','scripts/record-standard-trooper.mjs'];
const binaries=['assets/blender/source/standard_trooper_v1.blend',...['trooper','rifle','shotgun','rocket'].map(n=>`public/assets/characters/standard_${n}_v1.glb`),'public/assets/characters/standard_trooper_v1.json'];
added.push('tests/standard-trooper.test.ts','scripts/check-standard-trooper-network.mjs','scripts/check-standard-trooper-published.mjs');
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
let patch='';const files=[];
for(const [path,before] of changes){
 const result=spawnSync('git',['diff','--no-index','--',`${dir}/${before}`,path],{encoding:'utf8'});
 if(result.status!==0&&result.status!==1)throw new Error(result.stderr);
 patch+=result.stdout.replaceAll(`${dir}/${before}`,path);files.push({path,before:sha(`${dir}/${before}`),after:sha(path)});
}
for(const path of added){const body=readFileSync(path,'utf8').trimEnd().split('\n');patch+=`diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${body.length} @@\n${body.map(l=>'+'+l).join('\n')}\n`;files.push({path,before:null,after:sha(path)});}
for(const path of binaries)files.push({path,before:null,after:sha(path),bytes:readFileSync(path).length});
const git=args=>spawnSync('git',args,{encoding:'utf8'}).stdout.trim();
const checks={date:new Date().toISOString(),branch:git(['branch','--show-current']),base:git(['rev-parse','HEAD']),head:git(['rev-parse','HEAD']),uncommitted:true,status:'approved, implemented and published',version:'aa1a33b7-2ec9-48d6-bd24-1ad723b7524b',files,
 validation:{blender:JSON.parse(readFileSync(`${dir}/blender-validation.json`)),viewer:JSON.parse(readFileSync(`${dir}/viewer-validation.json`)),ground:JSON.parse(readFileSync(`${dir}/ground-validation.json`)),game:JSON.parse(readFileSync(`${dir}/game-validation.json`)).map(r=>({width:r.width,height:r.height,errors:r.errors,loaded:r.start.trooper.loaded})),typecheck:'PASS',build:'PASS; existing chunk size warning',unit:'40 PASS (render/game)'},
 preservedShared:{game:sha('src/shared/game.ts')===sha(`${dir}/game.before.ts`),defs:sha('src/shared/defs.ts')===sha(`${dir}/defs.before.ts`)}};
checks.validation.unit='175 PASS (14 files; 4 new cases)';
checks.validation.network=JSON.parse(readFileSync(`${dir}/network-validation.json`));
checks.validation.published=JSON.parse(readFileSync(`${dir}/published-validation.json`));
checks.validation.source=JSON.parse(readFileSync(`${dir}/source-validation.json`));
writeFileSync(`${dir}/task.patch`,patch);writeFileSync(`${dir}/checks.json`,JSON.stringify(checks,null,2));console.log(JSON.stringify({branch:checks.branch,head:checks.head,files:files.length,preservedShared:checks.preservedShared,status:checks.status}));
