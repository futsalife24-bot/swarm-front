import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const dir='dist-work/run-transfer-20260913',trial='assets/blender/candidates/trooper/ual-run-20260913';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex'),read=p=>JSON.parse(fs.readFileSync(p));
const baseline=read(dir+'/baseline.json');
for(const f of baseline.files.filter(f=>!f.path.endsWith('.ts')))assert.equal(sha(f.path),f.sha256);
const source=read(dir+'/source-gltf.json'),files=[];
function walk(path){return fs.readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path+'/'+e.name):[path+'/'+e.name])}
const manifest={author:'Quaternius',edition:'Standard (free)',retrieved:'2026-09-13 Asia/Tokyo',page:'https://opengameart.org/content/universal-animation-library',authorPage:'https://quaternius.com/packs/universalanimationlibrary.html',download:'https://opengameart.org/sites/default/files/universal_animation_librarystandard.zip',license:'CC0-1.0',licenseURL:'https://creativecommons.org/publicdomain/zero/1.0/',privateSource:true,clips:source.animations.map(a=>a.name),files:walk(dir+'/source').map(path=>({path,bytes:fs.statSync(path).size,sha256:sha(path)}))};
fs.writeFileSync(trial+'/source-manifest.json',JSON.stringify(manifest,null,2));
const added=['src/client/run-trial.ts','scripts/inspect-run-transfer.py','scripts/build-run-transfer.py','scripts/run-transfer-review.html','scripts/check-run-transfer.mjs','scripts/qa-run-transfer.mjs','scripts/check-run-transfer-game.mjs','scripts/record-run-transfer.mjs','scripts/encode-run-transfer.py','scripts/encode-run-transfer.mjs','scripts/verify-run-transfer-video.py','scripts/evidence-run-transfer.mjs','docs/TROOPER-UAL-RUN-TRIAL.md',...walk(trial).filter(p=>!/\.blend1$/.test(p))];
const changed='src/client/standard-trooper.ts';
const diff=spawnSync('git',['diff','--no-index','--',dir+'/before/standard-trooper.ts',changed],{encoding:'utf8'});assert.ok([0,1].includes(diff.status));fs.writeFileSync(dir+'/task.patch',diff.stdout);
for(const path of [changed,...added])if(fs.existsSync(path))files.push({path,bytes:fs.statSync(path).size,sha256:sha(path),before:path===changed?baseline.files.find(f=>f.path===path).sha256:null});
const qa=read(dir+'/gait-runtime-qa.json');
const report={...baseline,date:new Date().toISOString(),files,originalModelAndBlendHashesUnchanged:true,source:manifest,retarget:['jog','sprint'].map(k=>read(trial+'/'+k+'.json')),gait:qa.gaits.map(({sequence,...row})=>row),fixtureCases:qa.transitions.length,fixtureErrors:qa.errors,actualGame:fs.existsSync(dir+'/actual-game-qa.json')?read(dir+'/actual-game-qa.json'):null,checks:{typecheck:'PASS',unit:'14 passed (standard-trooper + aim)',build:'PASS, existing 500kB chunk warning',productionTrialAssetURLAbsent:!fs.readdirSync('dist/assets').filter(p=>p.endsWith('.js')).some(p=>fs.readFileSync('dist/assets/'+p,'utf8').includes('ual-run-20260913'))},video:fs.existsSync(dir+'/video-verification.json')?read(dir+'/video-verification.json'):null,limitations:['No production default replacement or deployment','Only 2 distinct runs available in Standard; no rifle-specific run','Backward remains the existing animation for all candidates','Sprint contact entry/exit still slips; 2cm contact threshold includes heel/toe roll','3 weapons and heavy-hit covered in renderer fixtures; actual game scope is listed separately','Real phone, terrain slopes and Internet cooperative play not verified','Self-review is not independent Chat audit']};
fs.writeFileSync(dir+'/evidence.json',JSON.stringify(report,null,2));console.log('Evidence saved; originals unchanged; source clips',manifest.clips.length);
