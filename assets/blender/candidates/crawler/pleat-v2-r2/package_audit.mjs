import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
const dir='assets/blender/candidates/crawler/pleat-v2-r2',old='assets/blender/candidates/crawler/pleat-v1';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const original=fs.readFileSync('src/client/hound-motion.ts','utf8'),candidate=fs.readFileSync(dir+'/candidate-motion.ts','utf8');
const normalize=s=>s.replace(/^\/\/ Candidate-only copy[^\n]*\n/,'').replaceAll('\r\n','\n').trimEnd().replace(/new GLTFLoader\(\)\.loadAsync\(`[^`]+`\)/,'new GLTFLoader().loadAsync(CANDIDATE_URL)');
if(normalize(original)!==normalize(candidate))throw Error('Loader differs beyond URL');
fs.writeFileSync(dir+'/validation/loader-provenance.json',JSON.stringify({head:'2be699f160c83d641fb68bb1304e4da8059920dc',source:'src/client/hound-motion.ts',sourceSHA256:hash('src/client/hound-motion.ts'),candidateSHA256:hash(dir+'/candidate-motion.ts'),allowedDifference:'GLTFLoader loadAsync URL, first-line candidate comment, line-ending normalization. No behavioral difference beyond URL.',identicalAfterDeclaredNormalization:true},null,2));
const before=read(old+'/validation/protected-before.json');
const protection=before.map(x=>({path:path.relative(process.cwd(),x.Path).replaceAll('\\','/'),before:x.Hash.toLowerCase(),after:hash(x.Path)}));
fs.writeFileSync(dir+'/validation/preservation.json',JSON.stringify({checked:protection.length,changed:protection.filter(x=>x.before!==x.after),files:protection},null,2));
if(protection.some(x=>x.before!==x.after))throw Error('Protected file changed; investigate before submission');
for(const view of ['side','oblique','game-size']){
 const a=await sharp(old+'/review/'+view+'.png').metadata();
 const b=await sharp(dir+'/review/'+view+'.png').metadata();
 if(a.width!==b.width||a.height!==b.height)throw Error('comparison dimensions');
 const label=Buffer.from(`<svg width="${a.width*2}" height="52"><rect width="100%" height="100%" fill="#12201c"/><text x="24" y="34" fill="white" font-size="24">v1 / before</text><text x="${a.width+24}" y="34" fill="white" font-size="24">v2 / revised - same camera, lighting and scale</text></svg>`);
 await sharp({create:{width:a.width*2,height:a.height+52,channels:4,background:'#12201c'}}).composite([{input:label,left:0,top:0},{input:old+'/review/'+view+'.png',left:0,top:52},{input:dir+'/review/'+view+'.png',left:a.width,top:52}]).png().toFile(dir+'/review/v1-v2-'+view+'.png');
}
fs.mkdirSync(dir+'/audit-source',{recursive:true});
for(const p of ['src/shared/structure-timing.ts','src/shared/structure-ai.ts','src/shared/enemy-motion.ts','src/client/hound-motion.ts','src/client/structure-motion.ts','src/shared/defs.ts','src/shared/game.ts','src/client/render.ts'])fs.copyFileSync(p,dir+'/audit-source/'+p.replaceAll('/','__'));
fs.copyFileSync(old+'/build_candidate.py',dir+'/audit-source/build_candidate_v1.py');
fs.copyFileSync(old+'/parameters.json',dir+'/audit-source/parameters_v1.json');
fs.copyFileSync(old+'/validation/pleat_motion_v1.json',dir+'/audit-source/pleat_motion_v1.json');
const files=[];
function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const full=p+'/'+e.name;if(e.isDirectory()){if(!['__pycache__','node_modules'].includes(e.name))walk(full)}else if(!e.name.endsWith('.blend1')&&!e.name.includes('manifest'))files.push({path:full.slice(dir.length+1),sha256:hash(full),bytes:fs.statSync(full).size});}}
walk(dir);
fs.writeFileSync(dir+'/audit-manifest.json',JSON.stringify({revision:'pleat-v2',base:'pleat-v1',baseGLB:hash(old+'/pleat_motion_v1.glb'),candidateGLB:hash(dir+'/pleat_motion_v2.glb'),evidence:'review images/video regenerated using this candidate. v1-v2 comparisons combine same-view screenshots without model rescaling.',files},null,2));
console.log('Audit evidence package manifest ready',files.length);
