// Actual local solo game with isolated saves and renderer observation only.
// --available is for the incomplete batch; omit after all twelve are present.
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {build} from 'esbuild';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const kinds=['rifle','smg','shotgun','slug','rocket','heavy','sniper','laser','grenade','sticky','kick','medic'];
const kindArgs=process.argv.slice(2).filter(arg=>arg.startsWith('--kinds='));
if(kindArgs.length>1||process.argv.includes('--kinds'))throw Error('--kinds は --kinds=grenade,sticky の形式で1回だけ指定してください');
const requested=kindArgs.length?kindArgs[0].slice(8).split(','):kinds;
const invalid=requested.filter(kind=>!kinds.includes(kind));
if(invalid.length)throw Error('無効な武器ID: '+invalid.map(k=>k||'(空)').join(','));
if(new Set(requested).size!==requested.length)throw Error('武器IDが重複しています: '+requested.join(','));
const missing=[];
for(const kind of requested){
  const dir=['rifle','shotgun','rocket'].includes(kind)?'realism-v2':'unique-v1';
  try{await fs.access(`public/assets/weapons/${dir}/${kind}_0.glb`);}catch(e){if(e.code==='ENOENT')missing.push(kind);else throw e;}
}
if(missing.length&&!process.argv.includes('--available'))throw Error('未生成: '+missing.join(','));
const selected=requested.filter(k=>!missing.includes(k));
if(!selected.length)throw Error('検査できる武器がありません');
const out='dist-validation/weapon-shot-live';await fs.mkdir(out,{recursive:true});
const fixtureSource=`import {freshProgress,validateProgress,newSaveKey} from './src/client/progression-save.ts';
import {makeWeapon} from './src/shared/progression.ts';import {familyOf} from './src/shared/defs.ts';
export const key=newSaveKey('normal'); export const fixtures={};
for(const kind of ${JSON.stringify(selected)}) {const save=freshProgress('normal'),w=makeWeapon('fixture-'+kind,kind,0,{power:0,reload:0,range:0,rate:0},false,save.serial++);save.inventory.push(w);save.soldiers[0].equipped[0]=w.id;save.tutorials=['gear','armory','base','battle','combat'];save.armoryMigration=1;fixtures[kind]={raw:JSON.stringify(validateProgress(save)),family:familyOf(kind)};}`;
await build({stdin:{contents:fixtureSource,resolveDir:process.cwd(),sourcefile:'weapon-ui-fixture.js'},bundle:true,format:'esm',platform:'node',packages:'external',outfile:out+'/fixture.mjs',define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'}});
const fixture=await import('../'+out+'/fixture.mjs');
const server=await createServer({configFile:false,define:{__SWARM_BUILD__:JSON.stringify('local-review'),__AUTO_CHANGELOG__:JSON.stringify([])},server:{host:'127.0.0.1',port:0,hmr:false,watch:{ignored:['**/dist-validation/**','**/design/**','**/public/**']}},optimizeDeps:{noDiscovery:true,include:[]}});
let browser,context,page,stage='起動';const records=[],errors=[];
try{
 await server.listen();const base='http://127.0.0.1:'+server.httpServer.address().port;
 browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
 for(const kind of selected){
  stage=kind+' 準備';context=await browser.newContext({viewport:{width:844,height:390},serviceWorkers:'block'});page=await context.newPage();
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  const config=fixture.fixtures[kind];
  await page.addInitScript(({key,raw})=>{localStorage.setItem(key,raw);localStorage.setItem('swarm-front-player-name-v1','ローカル検証');},{key:fixture.key,raw:config.raw});
  await page.route(/\/src\/client\/playtest-app\.ts(?:\?.*)?$/,async route=>{
   const response=await route.fetch(),body=await response.text();
   await route.fulfill({response,body:body+`
const originalEvent=view.combat.event.bind(view.combat), originalAdd=view.combat.add.bind(view.combat);
let tracing=null;
view.combat.add=(kind,x,y,z,size,duration,color,velocity,anchor)=>{
 const before=view.combat.items.length;
 const result=originalAdd(kind,x,y,z,size,duration,color,velocity,anchor);
 if(tracing&&(kind==='muzzle'||kind==='bullet')){
  const made=view.combat.items.length>before?view.combat.items.at(-1):null;
  tracing.effects.push({kind,created:!!made,position:made?.mesh.position.toArray(),age:made?.age,velocity:made?.velocity.toArray(),color,argumentPosition:[x,y,z]});
 }
 return result;
};
view.combat.event=(e,body,follow)=>{
 if(e.type!=='shot'||e.owner!=='solo'||e.weapon!==${JSON.stringify(config.family)}||window.weaponUIFirstShot)return originalEvent(e,body,follow);
 const trooper=view.players.get('solo')?.userData.trooper;
 tracing={shot:structuredClone(e),muzzle:trooper?.muzzle()?.toArray(),barrel:trooper?.barrel()?.toArray(),body:body?.toArray(),hadFollow:!!follow,effects:[]};
 const result=originalEvent(e,body,follow);
 window.weaponUIFirstShot=tracing; tracing=null;
 return result;
};
const captureDraw=view.render.bind(view);
view.render=(...args)=>{const result=captureDraw(...args);
 if(result&&window.weaponUIFirstShot&&!window.weaponUIFirstShot.image){const trooper=view.players.get('solo')?.userData.trooper;
  Object.assign(window.weaponUIFirstShot,{image:view.renderer.domElement.toDataURL(),worldTime:world.time,muzzleAfter:trooper?.muzzle()?.toArray(),effectKindsAfter:view.combat.items.map(e=>e.kind),screen});}
 return result;};`});
  });
  await page.goto(base+'/?solo=1',{waitUntil:'domcontentloaded',timeout:50000});
  const start=page.locator('#pt-start');await start.waitFor({state:'visible',timeout:90000});await start.click();
  const enter=page.locator('#pt-enter');await enter.waitFor({state:'visible',timeout:90000});await enter.click();
  await page.waitForFunction(()=>window.__playtest?.screen==='battle'&&window.__playtest?.trooper?.loaded,null,{timeout:90000});
  if(await page.locator('#pt-tutorial-skip').count())await page.locator('#pt-tutorial-skip').click();
  if(await page.locator('#pt-intro-skip').count())await page.locator('#pt-intro-skip').click();
  await page.waitForFunction(k=>window.__playtest?.world?.players?.[0]?.weapons?.[0]?.kind===k,kind,{timeout:30000});
  stage=kind+' 射撃';
  const point=await page.evaluate(()=>{for(let y=110;y<innerHeight-40;y+=20)for(let x=100;x<innerWidth-100;x+=20){const el=document.elementFromPoint(x,y);if(el?.id==='world'||el?.id==='look')return{x,y};}return null;});
  if(!point)throw Error('射撃入力位置なし');
  await page.mouse.move(point.x,point.y);await page.mouse.down();
  await page.waitForFunction(()=>!!window.weaponUIFirstShot?.image,null,{timeout:20000});await page.mouse.up();
  const data=await page.evaluate(()=>window.weaponUIFirstShot);
  await fs.writeFile(`${out}/${kind}-first.png`,Buffer.from(data.image.split(',')[1],'base64'));
  await page.screenshot({path:`${out}/${kind}-ui.png`});delete data.image;
  assert.equal(data.screen,'battle');assert.ok(data.muzzle?.every(Number.isFinite));assert.ok(data.barrel?.every(Number.isFinite));
  assert.equal(data.shot.weapon,config.family);assert.ok(data.hadFollow);assert.ok(data.effects.some(e=>e.kind==='muzzle'&&e.created));assert.deepEqual(pageErrors,[]);
  if(config.family!=='rocket')assert.ok(data.effects.some(e=>e.kind==='bullet'&&e.created),kind+' has no tracer at creation');
  for(const e of data.effects.filter(e=>e.created)) { e.distanceFromMuzzle=Math.hypot(...e.position.map((v,i)=>v-data.muzzle[i])); assert.ok(e.distanceFromMuzzle<.001,kind+' '+e.kind+' start is not muzzle'); }
  records.push({kind,family:config.family,...data,errors:pageErrors});
  console.log('PASS',kind,config.family,'created',data.effects.map(e=>e.kind+':'+e.distanceFromMuzzle).join(','));
  await context.close();context=undefined;
 }
 const report={scope:'Actual local solo UI and renderer; passive wrappers observe the real CombatEffects.event/add at effect creation before per-frame movement, first event only. Injected isolated save, no network or phone; no proof of continued flight, exact screen position or continuous action.',viewport:[844,390],requested,missing,records,errors};
 await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));
}catch(e){
 await fs.writeFile(out+'/failure.json',JSON.stringify({stage,error:String(e),completed:records.map(r=>r.kind),errors},null,2));
 if(page&&!page.isClosed())await page.screenshot({path:out+'/failure.png',timeout:5000}).catch(()=>{});
 throw e;
}finally{await context?.close();await browser?.close();await server.close();}
