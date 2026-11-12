// 実ローカルWorkerの通常補給と認証済み演出確認。公開先では使わない。
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const origin='http://127.0.0.1:8796',out='dist-validation/supply-weapon-art-ui';
await fs.mkdir(out,{recursive:true});
await build({stdin:{contents:"export {WEAPONS} from './src/shared/defs.ts';",resolveDir:process.cwd(),sourcefile:'supply-art-defs.js'},bundle:true,platform:'node',format:'esm',outfile:out+'/defs.mjs'});
const {WEAPONS}=await import('../'+out+'/defs.mjs');
const byName=Object.fromEntries(Object.entries(WEAPONS).map(([id,v])=>[v.name,id]));
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11','--mute-audio']});
const all=[];
async function settle(page){await page.waitForFunction(()=>!document.querySelector('.split-shutter,.menu-route-shutter'));}
async function tap(page,selector){await settle(page);await page.locator(selector).click();}
async function title(page){if(await page.locator('.title-entry-start').isVisible()){await page.locator('.title-entry-start').click();await page.locator('dialog.title-entry').waitFor({state:'detached'});}if(await page.locator('#landscape-start').isVisible())await page.locator('#landscape-start').click();}
async function results(page){
 await page.locator('.gx-root:not([hidden])').waitFor();await tap(page,'.gx-skip');
 for(let i=0;i<16&&!await page.locator('.gx-actions [data-id="close"]').isVisible();i++){await page.waitForTimeout(550);await page.locator('.gx-root').click({position:{x:320,y:180}});}
 await page.locator('.gx-actions [data-id="close"]').waitFor({state:'visible'});
 const rows=await page.locator('.gx-tile').evaluateAll(async tiles=>Promise.all(tiles.map(async tile=>{
  const img=tile.querySelector('img');await img.decode();return {type:tile.dataset.type,name:tile.querySelector('span')?.textContent,grade:tile.querySelector('b')?.textContent,src:img.currentSrc,width:img.naturalWidth,height:img.naturalHeight};
 })));
 assert.equal(rows.length,10);
 for(const row of rows.filter(r=>r.type==='weapon')){
  const kind=byName[row.name],tier=['N','R','SR','SSR','LR'].indexOf(row.grade);assert.ok(kind&&tier>=0,JSON.stringify(row));
  assert.equal(new URL(row.src).pathname,`/supply-reveal/assets/w-v2-${kind}-${tier}.webp`);
  assert.equal(row.width,1024);assert.equal(row.height,512);
 }
 return rows;
}
try{
 for(const viewport of [{width:844,height:390},{width:640,height:360}]){
  const context=await browser.newContext({viewport,serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
  const login=await context.request.post(origin+'/api/developer/login',{headers:{Origin:origin},data:{password:'test-only-random-developer-password'}});assert.equal(login.ok(),true);
  await page.goto(origin+'/?developer=1&base=1',{waitUntil:'domcontentloaded'});await title(page);await page.locator('#pt-base-supply').waitFor();await tap(page,'#pt-base-supply');
  await page.locator('[data-supply-preview-random]').waitFor();
  const before=await page.evaluate(()=>JSON.stringify({...localStorage}));
  // 乱数の種を固定した端末内試行。実際のサーバー抽選や保存には影響しない。
  await page.evaluate(()=>{window.savedRandom=Math.random;let s=5;Math.random=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);});
  await tap(page,'[data-supply-preview-random]');await page.evaluate(()=>{Math.random=window.savedRandom;});
  const rows=await results(page);const names=rows.filter(r=>r.type==='weapon').map(r=>byName[r.name]);
  for(const k of ['heavy','sticky','medic'])assert.ok(names.includes(k),`${k}が表示されません: ${names}`);
  await page.screenshot({path:`${out}/preview-${viewport.width}.png`});
  await tap(page,'.gx-actions [data-id="close"]');await page.locator('.gx-root').waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),before);assert.deepEqual(errors,[]);
  all.push({mode:'developer-preview',viewport,rows,errors,saveUnchanged:true,seed:5});await context.close();
 }
 for(const viewport of [{width:844,height:390},{width:640,height:360}]){
  const context=await browser.newContext({viewport,serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('swarm-front-player-name-v1','補給検証'));
  await page.goto(origin+'/?base=1',{waitUntil:'domcontentloaded'});await title(page);await page.locator('#pt-confirm').waitFor({state:'visible'});await tap(page,'#pt-confirm');
  if(!await page.locator('#pt-base-buddy').count())await tap(page,'#pt-base');await page.locator('#pt-base-buddy').waitFor();await tap(page,'#pt-base-buddy');
  await tap(page,'[data-bd="starter-pick"][data-id="tatara"]');await tap(page,'[data-bd="starter-confirm"]');await tap(page,'#pt-base');await tap(page,'#pt-base-supply');
  await page.locator('[data-supply-count]').filter({hasText:'10枚'}).waitFor();await tap(page,'[data-supply-draw="10"]');
  const rows=await results(page);await page.screenshot({path:`${out}/normal-${viewport.width}.png`});
  await tap(page,'.gx-actions [data-id="close"]');await page.locator('[data-supply-feedback]').filter({hasText:'補給を受領しました。'}).waitFor();assert.deepEqual(errors,[]);
  all.push({mode:'normal-local-worker',viewport,rows,errors});await context.close();
 }
 await fs.writeFile(out+'/report.json',JSON.stringify({scope:'Actual local isolated Worker and game UI; developer RNG fixed to cover three named kinds, normal draws use server RNG. No real phone or production player data.',all},null,2));
 console.log(JSON.stringify({scenarios:all.length,counts:all.map(x=>x.rows.filter(r=>r.type==='weapon').length),errors:all.flatMap(x=>x.errors).length}));
}catch(e){await fs.writeFile(out+'/failure.json',JSON.stringify({error:String(e),completed:all.map(x=>({mode:x.mode,viewport:x.viewport}))},null,2));throw e;}
finally{await browser.close();}
