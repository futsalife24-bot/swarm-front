import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const dir='dist-validation/trooper-v4',hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const pairs=[['standard-trooper.ts','src/client/standard-trooper.ts'],['preview.html','assets/blender/preview-trooper/index.html'],['changelog.ts','src/client/changelog.ts'],['STATE.md','docs/STATE.md']];
const added=['assets/blender/scripts/build_standard_trooper_v4.py','assets/blender/scripts/trooper_v4_geometry.py','assets/blender/scripts/validate_standard_trooper_v4.py','scripts/check-trooper-v4.mjs','scripts/check-trooper-v4-game.mjs','scripts/check-trooper-v4-published.mjs','scripts/record-trooper-v4.mjs','docs/TROOPER-V4.md'];
const files=[...pairs.map(([before,after])=>({path:after,before:hash(`${dir}/before/${before}`),after:hash(after)})),...added.map(path=>({path,before:null,after:hash(path)}))];
const artifacts=['assets/blender/source/standard_trooper_v4.blend','public/assets/characters/standard_trooper_v4.json',...['trooper','rifle','shotgun','rocket'].map(n=>`public/assets/characters/standard_${n}_v4.glb`)];
let patch='';
for(const [before,after] of pairs){try{patch+=execFileSync('git',['diff','--no-index','--',`${dir}/before/${before}`,after],{encoding:'utf8',stdio:['ignore','pipe','pipe']})}catch(e){if(e.status!==1)throw e;patch+=e.stdout}}
for(const path of added){const lines=readFileSync(path,'utf8').trimEnd().split('\n');patch+=`diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${lines.length} @@\n${lines.map(l=>'+'+l).join('\n')}\n`}
writeFileSync(`${dir}/task.patch`,patch);
const reports=Object.fromEntries(['blender-validation','source-rig-validation','runtime-validation','game-validation','distribution-validation','published-validation'].filter(n=>existsSync(`${dir}/${n}.json`)).map(n=>[n,JSON.parse(readFileSync(`${dir}/${n}.json`,'utf8'))]));
writeFileSync(`${dir}/checks.json`,JSON.stringify({date:new Date().toISOString(),branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),base:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),committed:false,existingDirtyTreePreserved:true,files,artifacts:artifacts.map(path=>({path,sha256:hash(path),bytes:readFileSync(path).length})),reports},null,2));
console.log('Recorded task-only patch, source/artifact hashes and available validation reports.');
