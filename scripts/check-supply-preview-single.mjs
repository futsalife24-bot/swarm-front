// 選択した10種類すべてとランダムを単発で再生し、取得・保存をしないことを確認。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
const out='dist-validation/supply-reveal-improvements';await fs.mkdir(out,{recursive:true});
await fs.writeFile('dist-validation/supply-reveal-fixture.html','<!doctype html><html lang="ja"><head><meta charset="utf-8"><link rel="stylesheet" href="/supply-reveal/gacha.css"></head><body></body></html>');
console.log('START 単発検査サーバー');const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11','--mute-audio']});
try {
 const page=await browser.newPage({viewport:{width:844,height:390},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
 await page.goto(base+'/dist-validation/supply-reveal-fixture.html',{waitUntil:'domcontentloaded'});
 console.log('START 単発10種類の再生時間軸');
 const selected=await page.evaluate(async()=>{const {selectedSupplyPreview}=await import('/src/client/supply-preview-data.ts'),{createSupplyReveal}=await import('/supply-reveal/runtime.js'),ids=['gold','meteor','crack','presage','skip','relight','hold','freeze','fracture','jack'],rows=[];
  for(let n=1;n<=10;n++){const r=createSupplyReveal(document.body,{sound:false,warm:false});try{await r.play(selectedSupplyPreview(n,1),{manual:true,effects:n,previewSingleEffects:true});const timeline=r.timeline(),p=r.model().pods[0];rows.push({n,count:r.model().n,tier:p.tier,actual:r.state().effect,initial:p.initial,fx:timeline.some(x=>x.fx===ids[n-1]),stops:timeline.filter(x=>x.wait).map(x=>x.wait)});}finally{r.destroy();}}return rows;});
 for(const row of selected){assert.equal(row.count,1);assert.equal(row.actual,row.n);assert.equal(row.tier,row.n===10?5:4);assert.ok(row.initial<=row.tier);assert.ok(row.fx,JSON.stringify(row));assert.ok(row.stops.includes('final'));}console.log('PASS 単発10種類の再生時間軸');
 console.log('START 単発に追加した3演出の通し再生');
 const complete=await page.evaluate(async()=>{const {selectedSupplyPreview}=await import('/src/client/supply-preview-data.ts'),{createSupplyReveal}=await import('/supply-reveal/runtime.js'),rows=[];
  for(const n of [2,3,4]){const r=createSupplyReveal(document.body,{sound:false,warm:false,fast:true});try{await r.play(selectedSupplyPreview(n,1),{effects:n,previewSingleEffects:true});let steps=0;const until=performance.now()+30000;while(r.state().waiting!=='final'&&performance.now()<until){await new Promise(resolve=>setTimeout(resolve,300));if(r.state().waiting){r.tap();steps++;}}rows.push({n,final:r.state().waiting==='final',steps});}finally{r.destroy();}}return rows;});
 for(const row of complete)assert.ok(row.final,JSON.stringify(row));console.log('PASS 単発に追加した3演出の通し再生');
 console.log('START 獲得確認中のカード位置入力');
 await page.evaluate(async()=>{const {selectedSupplyPreview}=await import('/src/client/supply-preview-data.ts'),{createSupplyReveal}=await import('/supply-reveal/runtime.js');window.probe=createSupplyReveal(document.body,{sound:false,warm:false});await window.probe.play(selectedSupplyPreview(1,1),{effects:1});window.probe.skip();});
 await page.waitForFunction(()=>window.probe.state().waiting==='cut');await page.waitForTimeout(550);
 await page.evaluate(()=>document.querySelector('.gx-card').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:420,clientY:180})));
 await page.waitForFunction(()=>window.probe.state().waiting==='final');await page.evaluate(()=>window.probe.destroy());
 await page.evaluate(async()=>{const {selectedSupplyPreview}=await import('/src/client/supply-preview-data.ts'),{createSupplyReveal}=await import('/supply-reveal/runtime.js');window.probe=createSupplyReveal(document.body,{sound:false,warm:false});await window.probe.play(selectedSupplyPreview(1,1),{effects:1});window.probe.skip();});
 await page.waitForFunction(()=>window.probe.state().waiting==='cut');await page.waitForTimeout(550);await page.evaluate(()=>{const card=document.querySelector('.gx-card');card.focus();card.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));});
 await page.waitForFunction(()=>window.probe.state().waiting==='final');await page.evaluate(()=>window.probe.destroy());console.log('PASS 獲得確認中のカード位置・Enter入力');
 console.log('START 単発の実操作とランダム');
 await page.evaluate(async()=>{document.body.innerHTML='<main id="host"></main>';const m=await import('/src/client/supply-preview.ts');window.preview=m.mountSupplyPreview(document.querySelector('#host'),()=>0);window.posts=[];window.open=(url)=>{window.posts.push(url);return null;};});
 const before=await page.evaluate(()=>JSON.stringify({...localStorage}));await page.selectOption('[data-supply-preview-count]','1');await page.selectOption('[data-supply-preview-select]','4');await page.click('[data-supply-preview-play]');
 await page.locator('.gx-root:not([hidden])').waitFor();await page.locator('.gx-skip').click();for(let i=0;i<8&&!await page.locator('.gx-actions [data-id="close"]').isVisible();i++){await page.waitForTimeout(600);if(!await page.locator('.gx-actions [data-id="close"]').isVisible())await page.locator('.gx-root').click({position:{x:320,y:345}});}
 await page.locator('.gx-actions [data-id="close"]').waitFor({state:'visible'});assert.equal(await page.locator('.gx-root').getAttribute('data-mode'),'single');await page.screenshot({path:out+'/single-preview-844.png'});
 await page.locator('.gx-card[role="button"]').click();await page.locator('dialog.weapon-detail-dialog[open]').waitFor();await page.locator('dialog.weapon-detail-dialog .dialog-close').click();await page.waitForFunction(()=>!document.querySelector('dialog.weapon-detail-dialog'));
 await page.locator('.gx-actions [data-id="share"]').click();const share=await page.evaluate(()=>window.posts[0]);assert.ok(new URL(share).searchParams.get('text').includes('1件'));await page.locator('.gx-actions [data-id="close"]').click();
 await page.waitForFunction(()=>!document.querySelector('.gx-root'));await page.click('[data-supply-preview-random]');await page.locator('.gx-root:not([hidden])').waitFor();assert.equal(await page.locator('.gx-root').getAttribute('data-mode'),'single');await page.locator('.gx-skip').click();
 for(let i=0;i<8&&!await page.locator('.gx-actions [data-id="close"]').isVisible();i++){await page.waitForTimeout(600);if(!await page.locator('.gx-actions [data-id="close"]').isVisible())await page.locator('.gx-root').click({position:{x:320,y:345}});}
 await page.locator('.gx-actions [data-id="close"]').waitFor({state:'visible'});await page.locator('.gx-actions [data-id="close"]').click();assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),before);assert.deepEqual(errors,[]);
 await fs.writeFile(out+'/single-report.json',JSON.stringify({selected,complete,ui:{selected:4,random:true,detail:true,share:true,saveUnchanged:true,cutTap:true,cutEnter:true},errors},null,2));console.log('PASS 単発の実操作とランダム');
} finally {await browser.close();await server.close();}
