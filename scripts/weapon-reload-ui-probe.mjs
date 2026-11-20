// Actual local game loop. Disposable save; renderer observation only.
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {build} from 'esbuild';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const known=['rifle','smg','shotgun','slug','rocket','heavy','sniper','laser','grenade','sticky','kick','medic'];
const requested=process.argv.find(x=>x.startsWith('--kinds='))?.slice(8).split(',')??known;
assert.ok(requested.length&&new Set(requested).size===requested.length&&requested.every(k=>known.includes(k)));
const missing=[];
for(const kind of requested){const dir=['rifle','shotgun','rocket'].includes(kind)?'realism-v2':'unique-v1';try{await fs.access(`public/assets/weapons/${dir}/${kind}_0.glb`);}catch(e){if(e.code==='ENOENT')missing.push(kind);else throw e;}}
if(missing.length&&!process.argv.includes('--available'))throw Error('未生成: '+missing.join(','));
const selected=requested.filter(k=>!missing.includes(k));assert.ok(selected.length);
const out='dist-validation/weapon-reload-ui-probe';await fs.mkdir(out,{recursive:true});
const fixtureSource=`import {freshProgress,validateProgress,newSaveKey} from './src/client/progression-save.ts';
import {makeWeapon} from './src/shared/progression.ts';import {familyOf} from './src/shared/defs.ts';
export const key=newSaveKey('normal');export const fixtures={};
for(const kind of ${JSON.stringify(selected)}){const s=freshProgress('normal'),w=makeWeapon('fixture-'+kind,kind,0,{power:0,reload:0,range:0,rate:0},false,s.serial++);s.inventory.push(w);s.soldiers[0].equipped[0]=w.id;s.tutorials=['gear','armory','base','battle','combat'];s.armoryMigration=1;fixtures[kind]={raw:JSON.stringify(validateProgress(s)),family:familyOf(kind)};}`;
await build({stdin:{contents:fixtureSource,resolveDir:process.cwd(),sourcefile:'reload-fixture.js'},bundle:true,format:'esm',platform:'node',packages:'external',outfile:out+'/fixture.mjs',define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'}});
const fixture=await import('../'+out+'/fixture.mjs');
const server=await createServer({configFile:false,define:{__SWARM_BUILD__:JSON.stringify('local-review'),__AUTO_CHANGELOG__:JSON.stringify([])},server:{host:'127.0.0.1',port:0,hmr:false,watch:{ignored:['**/dist-validation/**','**/design/**','**/public/**']}},optimizeDeps:{noDiscovery:true,include:[]}});
let browser,context,page,stage='起動';const records=[];
try{
 await server.listen();const base='http://127.0.0.1:'+server.httpServer.address().port;
 browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
 for(const kind of selected){
  stage=kind+' 準備';context=await browser.newContext({viewport:{width:844,height:390},serviceWorkers:'block'});page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));const config=fixture.fixtures[kind];
  await page.addInitScript(({key,raw})=>{localStorage.setItem(key,raw);localStorage.setItem('swarm-front-player-name-v1','ローカル検証');},{key:fixture.key,raw:config.raw});
  await page.route(/\/src\/client\/playtest-app\.ts(?:\?.*)?$/,async route=>{
   const response=await route.fetch(),body=await response.text();
   await route.fulfill({response,body:body+`
import {reloadDuration as probeDuration,stats as probeStats} from '/src/shared/defs.ts';
window.reloadProbe={shot:null,started:null,completed:null,samples:[]};
const oldReloadDraw=view.render.bind(view);view.render=(...args)=>{
 const result=oldReloadDraw(...args),p=world?.players?.find(x=>x.id==='solo'),trooper=view.players.get('solo')?.userData.trooper;
 if(!result||!p||!trooper||screen!=='battle'||p.weapons[p.slot]?.kind!==${JSON.stringify(kind)})return result;
 const probe=window.reloadProbe,shot=world.events.find(e=>e.type==='shot'&&e.owner==='solo'&&e.weapon===${JSON.stringify(config.family)});
 if(!probe.shot&&shot)probe.shot={time:world.time,ammo:p.ammo[p.slot],capacity:probeStats(p.weapons[p.slot]).mag};
 if(!probe.shot)return result;
 if(p.reload>0){
  const duration=probeDuration(p.weapons[p.slot],p.ammo[p.slot]),fraction=Math.max(0,Math.min(1,1-p.reload/duration));
  if(!probe.started)probe.started={time:world.time,reload:p.reload,duration,ammo:p.ammo[p.slot],mode:trooper.mode};
  const targets=[0,.25,.5,.75,.95];const target=targets[probe.samples.length];
  if(target!==undefined&&fraction>=target){trooper.model.updateMatrixWorld(true);const left=trooper.model.getObjectByName('Hand_L'),right=trooper.model.getObjectByName('Hand_R');
   probe.samples.push({target,fraction,time:world.time,reload:p.reload,ammo:p.ammo[p.slot],mode:trooper.mode,left:left?.matrixWorld.elements.slice(12,15),right:right?.matrixWorld.elements.slice(12,15),image:view.renderer.domElement.toDataURL()});}
 }else if(probe.started&&!probe.completed){probe.completed={time:world.time,ammo:p.ammo[p.slot],capacity:probeStats(p.weapons[p.slot]).mag,mode:trooper.mode};}
 return result;};`});
  });
  await page.goto(base+'/?solo=1',{waitUntil:'domcontentloaded',timeout:50000});
  const start=page.locator('#pt-start');await start.waitFor({state:'visible',timeout:90000});await start.click();
  const enter=page.locator('#pt-enter');await enter.waitFor({state:'visible',timeout:90000});await enter.click();
  await page.waitForFunction(()=>window.__playtest?.screen==='battle'&&window.__playtest?.trooper?.loaded,null,{timeout:90000});
  if(await page.locator('#pt-tutorial-skip').count())await page.locator('#pt-tutorial-skip').click();
  if(await page.locator('#pt-intro-skip').count())await page.locator('#pt-intro-skip').click();
  await page.waitForFunction(k=>window.__playtest?.world?.players?.[0]?.weapons?.[0]?.kind===k,kind,{timeout:30000});
  stage=kind+' 射撃';const point=await page.evaluate(()=>{for(let y=110;y<innerHeight-40;y+=20)for(let x=100;x<innerWidth-100;x+=20){const el=document.elementFromPoint(x,y);if(el?.id==='world'||el?.id==='look')return{x,y};}return null;});
  if(!point)throw Error('射撃入力先なし');await page.mouse.move(point.x,point.y);await page.mouse.down();await page.waitForFunction(()=>!!window.reloadProbe.shot,null,{timeout:20000});await page.mouse.up();
  stage=kind+' 装填';await page.keyboard.press('r');
  // A natural encounter may pause the game for its introduction; close it through the real UI.
  let skippedEncounters=0;const deadline=Date.now()+60000;
  while(Date.now()<deadline&&!await page.evaluate(()=>!!window.reloadProbe.completed)){
   const skip=page.getByRole('button',{name:'スキップして戦闘へ'});
   if(await skip.isVisible()){await skip.click();skippedEncounters++;}
   else await page.waitForTimeout(200);
  }
  if(!await page.evaluate(()=>!!window.reloadProbe.completed))throw Error('装填が60秒以内に完了しません');
  const probe=await page.evaluate(()=>window.reloadProbe);
  assert.ok(probe.started&&probe.completed&&probe.samples.length>=4,JSON.stringify({kind,probe:{...probe,samples:probe.samples.map(({image,...s})=>s)}}));
  assert.equal(probe.completed.ammo,probe.completed.capacity);assert.ok(probe.samples.every(x=>x.mode.includes('_reload_')));assert.deepEqual(errors,[]);
  for(const sample of probe.samples){sample.imageFile=`${kind}-${Math.round(sample.target*100)}.png`;await fs.writeFile(`${out}/${sample.imageFile}`,Buffer.from(sample.image.split(',')[1],'base64'));delete sample.image;}
  await page.screenshot({path:`${out}/${kind}-after.png`});
  records.push({kind,family:config.family,...probe,skippedEncounters,errors});await fs.writeFile(`${out}/${kind}-report.json`,JSON.stringify(records.at(-1),null,2));console.log('PASS',kind,'ammo',probe.shot.ammo,'capacity',probe.completed.capacity,'samples',probe.samples.length,'reload',probe.started.duration.toFixed(3),'encounterSkipped',skippedEncounters);
  await context.close();context=undefined;
 }
 await fs.writeFile(out+'/report.json',JSON.stringify({scope:'Actual local solo UI and game loop, disposable saves, mouse firing and R input, renderer observation; no physical device, real network, hidden hand-surface contact or continuous image video.',viewport:[844,390],requested,missing,records},null,2));
}catch(e){const probe=page&&!page.isClosed()?await page.evaluate(()=>{const p=window.reloadProbe;return p?{...p,samples:p.samples.map(({image,...x})=>x)}:null;}).catch(()=>null):null;await fs.writeFile(out+'/failure.json',JSON.stringify({stage,error:String(e),completed:records.map(r=>r.kind),probe},null,2));if(page&&!page.isClosed())await page.screenshot({path:out+'/failure.png',timeout:5000}).catch(()=>{});throw e;}
finally{await context?.close();await browser?.close();await server.close();}
