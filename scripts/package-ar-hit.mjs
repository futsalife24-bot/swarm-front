import fs from 'node:fs';import {createHash} from 'node:crypto';
const root='public/assets/audio/ar-hit-v1',source=JSON.parse(fs.readFileSync('../references/ar-hit-se-20260915/delivery/manifest.json','utf8'));
const assets=[['HIT-05','impactShell',['crawler','ant','spider']],['HIT-07','impactHard',['spitter','boss']],['HIT-10','impactSoft',['hornet']]].map(([code,key,enemies])=>{
 const original=source.find(x=>x.code===code),bytes=fs.readFileSync(`${root}/${key}.wav`),sha256=createHash('sha256').update(bytes).digest('hex');
 if(sha256!==original.sha256)throw Error('Candidate changed: '+code);
 return {...original,key,enemies,sha256,bytes:bytes.length};
});
fs.writeFileSync(root+'/manifest.json',JSON.stringify({status:'provisional',weapon:'rifle',rate:48000,source:'https://kenney.nl/assets/impact-sounds',license:'CC0',assets},null,2));
fs.writeFileSync(root+'/CREDITS.txt','AR enemy hit sounds: HIT-05 / HIT-07 / HIT-10.\nRecorded layers: Kenney Impact Sounds (CC0). https://kenney.nl/assets/impact-sounds\nModified and layered for Swarm Front. Exact source files, hashes and processing are in manifest.json.\n');
for(const dist of ['dist','dist-pages'])for(const file of ['manifest.json','CREDITS.txt'])fs.copyFileSync(root+'/'+file,dist+'/assets/audio/ar-hit-v1/'+file);
let release=fs.readFileSync('scripts/check-rocket-final.mjs','utf8').replace("out='dist-validation/rocket-final'","out='dist-validation/ar-hit'");
release=release.replace("const browser=await chromium.launch", "manifest.assets.push(...JSON.parse(fs.readFileSync('public/assets/audio/ar-hit-v1/manifest.json','utf8')).assets);\nconst browser=await chromium.launch");
release=release.replace('window.seLog=[];', 'window.seLog=[];window.seDecoded=[];').replace('seBuffers.set(b,assets.find', 'seDecoded.push(assets.find(a=>a.sha256===hash)?.key);seBuffers.set(b,assets.find');
release=release.replace('const log=await page.evaluate(()=>seLog);', "const decoded=await page.evaluate(()=>seDecoded);for(const key of ['impactShell','impactHard','impactSoft'])assert.ok(decoded.includes(key),'Missing decode '+key);results.decodedHits=decoded.filter(k=>k?.startsWith('impact'));const log=await page.evaluate(()=>seLog);");
fs.writeFileSync('scripts/check-ar-hit-release.mjs',release);
console.log('Verified identical selected WAVs, wrote provenance and release check.');
