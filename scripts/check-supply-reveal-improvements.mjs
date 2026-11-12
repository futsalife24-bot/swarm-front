// 隔離Viteと実ブラウザーで、補給演出の操作を検証する。実際の券・報酬は使わない。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
const out='dist-validation/supply-reveal-improvements';
await fs.mkdir(out,{recursive:true});
await fs.writeFile('dist-validation/supply-reveal-fixture.html','<!doctype html><html lang="ja"><head><meta charset="utf-8"><link rel="stylesheet" href="/supply-reveal/gacha.css"></head><body></body></html>');
console.log('START ローカルサーバー');
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
const base=`http://127.0.0.1:${server.httpServer.address().port}`;
console.log('PASS ローカルサーバー',base);
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11','--mute-audio']});
const cases=[];
try {
  const context=await browser.newContext({viewport:{width:844,height:390},serviceWorkers:'block'}), page=await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message)); page.setDefaultTimeout(30000);
  await page.goto(base+'/dist-validation/supply-reveal-fixture.html',{waitUntil:'domcontentloaded',timeout:60000});
  console.log('START 初期色と発動順');
  const check=await page.evaluate(async()=>{
    const {createSupplyReveal}=await import('/supply-reveal/runtime.js');
    const make=(rarity='SSR')=>({type:'weapon',rarity,name:'検証'});
    const colours=[];
    for(const rarity of ['N','R','SR','SSR']) for(const random of [0,.999]) {
      const rng=Math.random; Math.random=()=>random; const r=createSupplyReveal(document.body,{sound:false,warm:false,reduced:false});
      try { await r.play([make(rarity)],{manual:true,effects:0}); const before=r.model().pods[0].initial; r.setReduced(true); colours.push({rarity,random,before,after:r.model().pods[0].initial}); }
      finally { r.destroy(); Math.random=rng; }
    }
    const timings=[];
    for(const n of [5,8,10]) {
      const arr=Array.from({length:10},()=>make('N'));arr[3]=n===10?{type:'buddy',name:'タタラ',art:'b-tatara'}:make();
      const r=createSupplyReveal(document.body,{sound:false,warm:false,reduced:false});
      await r.play(arr,{manual:true,effects:n}); const timeline=r.timeline(), model=r.model(), target=model.pods[3];
      const idx=timeline.findIndex(x=>x.fx===({5:'skip',8:'freeze',10:'jack'})[n]);
      timings.push({n,idx,prev:timeline.slice(0,idx).filter(x=>x.wait).at(-1),first:target.beats[0].t0,fx:timeline[idx]});r.destroy();
    }
    for(const n of [5,8,10]) {
      const r=createSupplyReveal(document.body,{sound:false,warm:false,reduced:false});const one=n===10?{type:'buddy',name:'タタラ',art:'b-tatara'}:make();
      await r.play([one],{manual:true,effects:n});const timeline=r.timeline(),target=r.model().pods[0],idx=timeline.findIndex(x=>x.fx===({5:'skip',8:'freeze',10:'jack'})[n]);
      timings.push({n,single:true,idx,prev:timeline.slice(0,idx).filter(x=>x.wait).at(-1),first:target.beats[0].t0,fx:timeline[idx]});r.destroy();
    }
    return {colours,timings};
  });
  for(const row of check.colours){const max={N:1,R:2,SR:3,SSR:4}[row.rarity];assert.equal(row.before,row.random===0?1:max);assert.equal(row.after,row.before);}
  for(const x of check.timings){assert.ok(x.idx>=0,JSON.stringify(x));assert.equal(x.prev.wait,x.single?'launch':'pod');if(!x.single)assert.ok(Math.abs(x.prev.a-x.first)<1e-5,JSON.stringify(x));}
  const glass=await page.evaluate(async()=>{const {render,SR}=await import('/supply-reveal/sfx.js');const [left]=render('glass');let peak=0;for(const x of left){if(!Number.isFinite(x))throw Error('不正な音波形');peak=Math.max(peak,Math.abs(x));}return {seconds:left.length/SR,peak};});assert.ok(glass.seconds<.2&&glass.peak>0);
  cases.push({name:'初期色と最初のタップの演出',...check,glass});console.log('PASS 初期色と発動順');

  console.log('START 金の射出と地割れの画像');
  await page.evaluate(async()=>{const {createSupplyReveal}=await import('/supply-reveal/runtime.js');window.visual=createSupplyReveal(document.body,{sound:false,warm:false});await window.visual.play([{type:'weapon',rarity:'SSR',name:'検証'}],{manual:true,effects:1});window.visual.seek(window.visual.model().tLaunch,0,true,{id:'gold',p:{k:1,shock:-1},gold:true});});
  await page.screenshot({path:out+'/gold-844.png'});
  await page.evaluate(async()=>{const rows=Array.from({length:10},()=>({type:'weapon',rarity:'N',name:'検証'}));rows[2]={type:'weapon',rarity:'SSR',name:'対象'};await window.visual.play(rows,{manual:true,effects:3});const p=window.visual.model().pods[2],t=p.tLand+0.16;window.visual.seek(t,0,false,{id:'crack',p:{a:0.16,x:422+p.x,gy:p.gy}});});
  await page.screenshot({path:out+'/ground-844.png'});await page.evaluate(()=>window.visual.destroy());console.log('PASS 金の射出と地割れの画像');

  console.log('START 画面割れの入力');
  await page.evaluate(async()=>{
    const {createSupplyReveal}=await import('/supply-reveal/runtime.js'); window.crackEvents=[];
    window.reveal=createSupplyReveal(document.body,{sound:false,warm:false,fast:true,onEvent:e=>window.crackEvents.push(e)});
    const rows=Array.from({length:10},()=>({type:'weapon',rarity:'N',name:'検証'})); rows[0]={type:'weapon',rarity:'SSR',name:'対象'};
    await window.reveal.play(rows,{effects:9});
  });
  for(let i=0;i<18;i++) {const state=await page.evaluate(()=>window.reveal.state());if(state.waiting==='fracture')break;if(state.waiting)await page.locator('.gx-root').click({position:state.waiting==='pod'?{x:115,y:105}:{x:400,y:195}});await page.waitForTimeout(500);}
  await page.waitForFunction(()=>window.reveal.state().waiting==='fracture');
  assert.equal(await page.evaluate(()=>window.reveal.state().cracks),1);
  await page.mouse.move(600,115);await page.mouse.down();await page.waitForTimeout(500);await page.mouse.up();assert.equal(await page.evaluate(()=>window.reveal.state().cracks),2);
  await page.screenshot({path:out+'/cracks-844.png'});
  await page.mouse.click(300,295);
  await page.waitForFunction(()=>window.reveal.state().waiting==='cut');
  const cracked=await page.evaluate(()=>({events:window.crackEvents.filter(e=>e.type==='fracture'),state:window.reveal.state()}));
  assert.equal(cracked.events.length,3);assert.ok(Math.abs(cracked.events[0].point.x-115/844)<.01);assert.ok(Math.abs(cracked.events[1].point.x-600/844)<.01);
  await page.waitForTimeout(550);await page.locator('.gx-root').click({position:{x:400,y:195}});await page.waitForFunction(()=>window.reveal.state().waiting==='pod');
  cases.push({name:'タップ位置・長押し・破砕後の獲得と残り箱',...cracked});console.log('PASS 画面割れの入力');
  await page.evaluate(()=>window.reveal.destroy());

  console.log('START 1連と動き減・スキップ');
  await page.evaluate(async()=>{const {createSupplyReveal}=await import('/supply-reveal/runtime.js');window.reveal=createSupplyReveal(document.body,{sound:false,warm:false,fast:true,reduced:true});await window.reveal.play([{type:'weapon',rarity:'SSR',name:'検証'}],{effects:9});});
  await page.waitForFunction(()=>window.reveal.state().waiting==='launch');await page.waitForTimeout(300);await page.locator('.gx-root').click({position:{x:120,y:100}});
  await page.waitForFunction(()=>window.reveal.state().waiting==='fracture');assert.equal(await page.evaluate(()=>window.reveal.state().cracks),1);
  await page.evaluate(()=>window.reveal.setReduced(false));assert.equal(await page.evaluate(()=>window.reveal.state().cracks),1);
  await page.locator('.gx-skip').click();await page.waitForFunction(()=>window.reveal.state().waiting==='cut');
  await page.waitForTimeout(550);await page.locator('.gx-root').click({position:{x:400,y:195}});await page.waitForFunction(()=>window.reveal.state().waiting==='final');
  cases.push({name:'1連と動き減・スキップ'});await page.evaluate(()=>window.reveal.destroy());console.log('PASS 1連と動き減・スキップ');

  for(const viewport of [{width:844,height:390},{width:640,height:360}]) {
    console.log('START 結果詳細とX',viewport.width);
    await page.setViewportSize(viewport);await page.reload();
    await page.evaluate(async()=>{document.body.innerHTML='<main id="host"></main>';const m=await import('/src/client/supply-preview.ts');window.preview=m.mountSupplyPreview(document.querySelector('#host'),()=>0);window.opened=[];window.open=(url)=>{window.opened.push(url);return null;};});
    const before=await page.evaluate(()=>JSON.stringify({...localStorage}));
    await page.selectOption('#supply-preview-effect','10');await page.click('[data-supply-preview-play]');
    await page.locator('.gx-root:not([hidden])').waitFor();await page.click('.gx-skip');
    for(let i=0;i<15&&!await page.locator('.gx-actions [data-id="close"]').isVisible();i++){await page.waitForTimeout(600);await page.locator('.gx-root').click({position:{x:320,y:180}});}
    await page.locator('.gx-actions [data-id="close"]').waitFor({state:'visible'});
    const beforeRows=await page.locator('.gx-tile').allTextContents();assert.equal(beforeRows.length,10);
    await page.locator('.gx-tile[data-type="weapon"]').first().click();await page.locator('dialog.weapon-detail-dialog[open]').waitFor();await page.locator('dialog.weapon-detail-dialog .dialog-close').click();
    await page.locator('.gx-tile[data-type="buddy"]').first().click();await page.locator('dialog.supply-buddy-dialog[open] .bd-detail').waitFor();
    const buddy=await page.locator('dialog.supply-buddy-dialog .bd-detail').innerText();assert.ok(buddy.includes('タタラ'),buddy);
    assert.equal(await page.locator('dialog.supply-buddy-dialog .bd-detail button:visible').count(),0);
    await page.screenshot({path:`${out}/buddy-${viewport.width}.png`});await page.locator('dialog.supply-buddy-dialog .dialog-close').click();
    assert.deepEqual(await page.locator('.gx-tile').allTextContents(),beforeRows);
    await page.locator('.gx-actions [data-id="share"]').click();
    const shared=await page.evaluate(()=>window.opened[0]),u=new URL(shared),text=u.searchParams.get('text');assert.equal(u.hostname,'twitter.com');assert.ok(text.includes('試しガチャ（取得なし）'));assert.ok(text.length<140,text);
    await page.screenshot({path:`${out}/result-${viewport.width}.png`});await page.locator('.gx-actions [data-id="close"]').click();
    assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),before);
    cases.push({name:'試しガチャの詳細と投稿画面',viewport,buddy,shareLength:text.length,rows:beforeRows.length});console.log('PASS 結果詳細とX',viewport.width);
  }
  assert.deepEqual(errors,[]);await fs.writeFile(out+'/report.json',JSON.stringify({cases,errors},null,2));console.log('PASS',cases.length,'cases');
  await context.close();
} finally {await browser.close();await server.close();}
