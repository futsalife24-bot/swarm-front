import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const dir='dist-validation/trooper-stop',hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const read=p=>{const b=readFileSync(p),n=b.readUInt32LE(12);return {doc:JSON.parse(b.subarray(20,20+n)),binary:b.subarray(28+n)}};
const old=read('public/assets/characters/standard_trooper_v6.glb'),now=read('public/assets/characters/standard_trooper_v7.glb');
for(const k of ['nodes','meshes','skins','materials','textures','images'])assert.deepEqual(old.doc[k],now.doc[k]);
assert.ok(now.binary.subarray(0,old.binary.length).equals(old.binary));
const changedClips=['Trial_Idle','Trial_Weapon_Idle_Rifle','Trial_Weapon_Idle_Shotgun','Trial_Weapon_Idle_Rocket'];let preserved=0;
old.doc.animations.forEach((a,i)=>{if(!changedClips.includes(a.name)){assert.deepEqual(a,now.doc.animations[i]);preserved++}});assert.equal(preserved,14);
let patch='';const files=[];
for(const path of ['src/client/standard-trooper.ts','src/client/changelog.ts','docs/STATE.md']){
 const before=`${dir}/before/${path.split('/').at(-1)}`,r=spawnSync('git',['diff','--no-index','--',before,path],{encoding:'utf8'});assert.ok([0,1].includes(r.status));patch+=r.stdout;files.push({path,before:hash(before),after:hash(path)});
}
for(const path of ['assets/blender/scripts/build_trooper_stance_v7.py','assets/blender/candidates/trooper/stance-v7/review.html','scripts/check-trooper-stop.mjs','scripts/check-trooper-stop-game.mjs','scripts/check-trooper-stop-distribution.mjs','scripts/verify-trooper-stop-published.mjs','scripts/record-trooper-stop-evidence.mjs','docs/TROOPER-STOP.md']){
 const lines=readFileSync(path,'utf8').trimEnd().split('\n');patch+=`diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${lines.length} @@\n${lines.map(l=>'+'+l).join('\n')}\n`;files.push({path,before:null,after:hash(path)});
}
for(const path of ['public/assets/characters/standard_trooper_v7.glb','assets/blender/candidates/trooper/stance-v7/trooper_stance_v7.blend'])files.push({path,before:null,after:hash(path),bytes:readFileSync(path).length});
const browser=JSON.parse(readFileSync(`${dir}/browser-checks.json`));
const report={branch:'codex/home-armory',base:'2be699f160c83d641fb68bb1304e4da8059920dc',head:'2be699f160c83d641fb68bb1304e4da8059920dc',uncommitted:true,files,preservation:{geometrySkeletonMaterials:true,otherClips:preserved},checks:{typecheck:'PASS',unit:'9 PASS',clientBuild:'PASS; existing chunk warning',workerDryRun:'PASS',browser:{cases:browser.cases.length,minSole:Math.min(...browser.cases.map(c=>c.minSole)),maxLandingStep:Math.max(...browser.cases.map(c=>c.landingStep)),errors:browser.errors},distribution:existsSync(`${dir}/distribution-validation.json`)?JSON.parse(readFileSync(`${dir}/distribution-validation.json`)):null,game:existsSync(`${dir}/game/game-validation.json`)?JSON.parse(readFileSync(`${dir}/game/game-validation.json`)):null,publishedUI:existsSync(`${dir}/published-validation.json`)?JSON.parse(readFileSync(`${dir}/published-validation.json`)):null,published:existsSync(`${dir}/published-assets.json`)?JSON.parse(readFileSync(`${dir}/published-assets.json`)):null},limitations:['Real mobile hardware and Internet co-op untested','Ground contact assumes the current flat player ground at Y=0','Time-step coverage is not a hardware FPS benchmark','No independent Chat audit this turn']};
writeFileSync(`${dir}/task.patch`,patch);writeFileSync(`${dir}/checks.json`,JSON.stringify(report,null,2));console.log('Saved scoped patch, hashes and verification evidence');
