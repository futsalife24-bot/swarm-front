// Explicit old-Worker projection fixture, not old-Worker network verification.
// node scripts/check-weapon-tier-fallback-browser.mjs [old-ref]
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createHash } from 'node:crypto';

const oldRef = process.argv[2] ?? 'c4fce32fa7ff00d3e0d6186f10c568a69bd7b25a';
const out = 'dist-validation/weapon-tier-fallback';
const evidence = 'docs/evidence/weapon-models-20261111';
const sourcePath = 'src/client/progression-weapons.ts';
const kinds = ['smg','slug','heavy','sniper','laser','grenade','sticky','kick','medic'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const oldSource = execFileSync('git',['show',`${oldRef}:${sourcePath}`],{encoding:'utf8'});
const beforeSource = await fs.readFile(sourcePath);
await fs.mkdir(out,{recursive:true});

const browserSource = mode => `
import * as T from 'three';
import {StandardTrooper,loadStandardTrooper} from '../../src/client/standard-trooper.ts';
import {loadProgressionWeapons,progressionWeaponModel} from '../../src/client/progression-weapons.ts';
import {makeWeapon,weaponVisualTier} from '../../src/shared/progression.ts';
import {poseOf} from '../../src/shared/defs.ts';
import {createWorld,addPlayer} from '../../src/shared/game.ts';
const mode=${JSON.stringify(mode)}, kinds=${JSON.stringify(kinds)};
const check=(value,message)=>{if(!value)throw Error(message)};
const geometry=root=>{const result=[];root?.traverse(o=>{if(o.isMesh&&!/WeaponNeon/.test(o.name))result.push(o.geometry.uuid)});return result.sort().join('|')};
const names=root=>{const result=[];root?.traverse(o=>{if(o.isMesh&&!/WeaponNeon/.test(o.name))result.push(o.name)});return result};
window.review=(async()=>{
 const assets=await loadStandardTrooper(), scene=new T.Scene();
 scene.add(new T.HemisphereLight(0xffffff,0x526070,3));
 const light=new T.DirectionalLight(0xffffff,3);light.position.set(3,4,3);scene.add(light);
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
 renderer.setSize(230,180);renderer.setClearColor(0x12232d);
 const camera=new T.PerspectiveCamera(35,230/180,.01,100);
 const rows=[], pictures=[];
 for(const kind of kinds){
  const actor=new StandardTrooper(assets),p=addPlayer(createWorld('tier-fixture-'+kind),'review');
  scene.add(actor.model);p.slot=0;p.reload=0;p.swapCd=0;
  const original=id=>makeWeapon(id,kind,0,{power:0,reload:0,range:0,rate:0},true,0);
  // Only these fields model the old fusion projection. No format or appearanceTier.
  const projected=(id,rarity)=>({id,kind,rarity,power:1,effect:'none'});
  const originals=[original('held-'+kind),original('back-'+kind)];
  await loadProgressionWeapons(originals);
  const source0=progressionWeaponModel(originals[0]);check(source0,kind+' initial source missing');
  const same0=geometry(source0), legacy=geometry(assets.weapons[poseOf(kind)]);
  check(same0!==legacy,kind+' controls have identical geometry');
  const settle=ws=>{p.weapons=ws;for(let i=0;i<4;i++)actor.update(p,0,2+i*.1,'tier-fixture-'+kind,.1)};
  const inspect=(stage,ws,expected)=>{
   settle(ws);const actual=actor.weapons.map(geometry);
   check(actual.length===2&&actual.every(g=>g===expected),mode+' '+kind+' '+stage+' geometry mismatch');
   check(actor.weapons[0].parent?.name==='RightHandWeaponSocket',kind+' hand socket');
   check(actor.weapons[1].parent?.name==='BackWeaponSocket_2',kind+' back socket');
   return {stage,visualTier:weaponVisualTier(ws[0]),hasFormat:Object.hasOwn(ws[0],'format'),
    hasAppearanceTier:Object.hasOwn(ws[0],'appearanceTier'),sourceId:progressionWeaponModel(ws[0])?.uuid??null,
    sourceIsInitial:progressionWeaponModel(ws[0])===source0,heldGeometry:actual[0],backGeometry:actual[1],
    meshNames:actor.weapons.map(names),parents:actor.weapons.map(w=>w.parent?.name)};
  };
  const snapshot=()=>{
   const images=[];actor.model.updateMatrixWorld(true);
   for(const view of ['held','back']){
    const gun=actor.weapons[view==='held'?0:1],center=new T.Box3().setFromObject(gun).getCenter(new T.Vector3());
    camera.position.copy(center).add(view==='held'?new T.Vector3(1.6,.35,-1.65):new T.Vector3(-1.6,.25,1.65));
    camera.lookAt(center);renderer.render(scene,camera);images.push(renderer.domElement.toDataURL());
   }
   return images;
  };
  const samples=[inspect('initial tier 0',originals,same0)];
  let last;
  for(const rarity of [0,2,4]){
   last=[projected('held-'+kind,rarity),projected('back-'+kind,rarity)];
   check(!Object.hasOwn(last[0],'format')&&!Object.hasOwn(last[0],'appearanceTier'),'invalid fixture');
   samples.push(inspect('missing projected tier '+weaponVisualTier(last[0]),last,mode==='before'?legacy:same0));
  }
  const missingPictures=snapshot(), previousClone=actor.weapons[0].uuid;
  await loadProgressionWeapons(last);
  const exact=progressionWeaponModel(last[0]);check(exact&&exact!==source0,kind+' exact tier not selected');
  const exactGeometry=geometry(exact);check(exactGeometry!==same0,kind+' exact source not a different loaded GLB');
  samples.push(inspect('exact tier 4 loaded',last,exactGeometry));
  check(actor.weapons[0].uuid!==previousClone,kind+' cached equipment did not refresh after exact load');
  const exactPictures=snapshot();
  rows.push({kind,pose:poseOf(kind),initialSource:source0.uuid,exactSource:exact.uuid,
   legacyGeometry:legacy,initialGeometry:same0,exactGeometry,samples,exactRefresh:true});
  pictures.push({kind,missing:missingPictures,exact:exactPictures});
  actor.dispose();scene.remove(actor.model);
 }
 const glError=renderer.getContext().getError();check(glError===0,'WebGL error '+glError);
 renderer.dispose();renderer.forceContextLoss();return {rows,pictures,glError};
})();`;

for(const mode of ['before','after']){
 await build({stdin:{contents:browserSource(mode),sourcefile:'fixture.ts',resolveDir:path.resolve(out)},
  bundle:true,format:'esm',platform:'browser',outfile:`${out}/${mode}.js`,
  define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'},
  plugins:mode==='before'?[{name:'old-progression-only',setup(b){b.onLoad({filter:/[\\/]progression-weapons\.ts$/},()=>({contents:oldSource,loader:'ts',resolveDir:path.resolve('src/client')}))}}]:[]});
}
const server=http.createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://127.0.0.1').pathname;
 const root=path.resolve(pathname.startsWith('/assets/')?'public':out);
 const file=path.resolve(root,pathname.startsWith('/assets/')?pathname.slice(1):path.basename(pathname));
 if(!file.startsWith(root+path.sep))return void res.writeHead(403).end();
 try{res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':'application/octet-stream'}).end(await fs.readFile(file))}
 catch{res.writeHead(404).end()}
});
let browser;
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
 const results={},loaded=new Set();
 for(const mode of ['before','after']){
  const page=await browser.newPage({viewport:{width:1400,height:900},serviceWorkers:'block'}),errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
  page.on('response',r=>{if(r.url().includes('/assets/'))loaded.add(new URL(r.url()).pathname);if(r.status()>=400)failed.push({url:r.url(),status:r.status()})});
  await page.route('**/fixture',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><script type="module" src="/${mode}.js"></script>`}));
  await page.goto(base+'/fixture',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.review,null,{timeout:30000});
  results[mode]=await page.evaluate(()=>Promise.race([window.review,new Promise((_,r)=>setTimeout(()=>r(Error('fixture timeout')),120000))]));
  assert.equal(results[mode].rows.length,9);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  results[mode].errors=errors;results[mode].failed=failed;
  await page.close();
 }
 assert.equal(hash(await fs.readFile(sourcePath)),hash(beforeSource),'product source changed during verification');
 const page=await browser.newPage({viewport:{width:1410,height:900},serviceWorkers:'block'});
 const columns=['旧処理：手持ち','旧処理：背負い','修正後：手持ち','修正後：背負い','exact読込後：手持ち','exact読込後：背負い'];
 let body='<h2>旧Worker相当の投影fixture：9種の形状保持</h2><p>format / appearanceTier なし。旧処理は未読込等級で旧3形状へ戻る。修正後は読込済みの同kindを維持し、exact読込後に更新。実旧Worker通信ではありません。</p>';
 body+='<main>'+columns.map(c=>'<b>'+c+'</b>').join('');
 for(let i=0;i<kinds.length;i++){
  body+='<strong style="grid-column:1/-1">'+kinds[i]+' / 投影tier 4（画像）・tier 1/3も数値確認</strong>';
  const imgs=[...results.before.pictures[i].missing,...results.after.pictures[i].missing,...results.after.pictures[i].exact];
  body+=imgs.map(src=>'<img width="230" height="180" src="'+src+'">').join('');
 }
 body+='</main>';
 await page.setContent('<!doctype html><meta charset="utf-8"><style>body{margin:8px;background:#12232d;color:#fff;font:12px sans-serif}h2{font-size:19px}main{display:grid;grid-template-columns:repeat(6,230px);gap:3px}strong{margin-top:5px}</style>'+body);
 await page.screenshot({path:out+'/comparison.png',fullPage:true});await page.close();
 const assets=[];
 for(const url of [...loaded].sort()){
  const data=await fs.readFile('public'+url);assets.push({path:'public'+url,bytes:data.length,sha256:hash(data)});
 }
 for(const r of Object.values(results))delete r.pictures;
 const report={scope:'Explicit legacy fusion projection fixture with actual GLBs, StandardTrooper and WebGL; not old-Worker network, live UI, continuous animation, phone or full rarity-colour compatibility.',
  oldRef,sourcePath,oldSourceSha256:hash(oldSource),currentSourceSha256:hash(beforeSource),
  phases:['load modern tier0 only','legacy projection rarity0 -> visual tier1','rarity2 -> tier3','rarity4 -> tier4','load exact tier4 and refresh same projection'],
  results,assets,limitations:['旧Workerの色制限は残る','手・体への接触や動作全般はこの検査の判定対象外','実旧Worker通信・公開環境・スマホ実機は未確認']};
 await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');
 await fs.mkdir(evidence,{recursive:true});
 await fs.copyFile(out+'/comparison.png',evidence+'/tier-fallback-browser.png');
 await fs.copyFile(out+'/report.json',evidence+'/tier-fallback-browser-report.json');
 console.log(JSON.stringify({kinds:9,oldFallbackConditions:27,currentSameKindConditions:27,exactRefreshPerVersion:9,
  handAndBack:true,errors:0,glErrors:0,image:evidence+'/tier-fallback-browser.png'}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
