import {chromium} from '@playwright/test';import fs from 'node:fs';import assert from 'node:assert/strict';
const origin='http://127.0.0.1:5348',out='dist-validation/gear-pinned';
const b=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});const results=[];
try{for(const [width,height] of [[1280,582],[915,412],[844,390],[640,360]]){
 const p=await b.newPage({viewport:{width,height},hasTouch:true,isMobile:true,serviceWorkers:'block'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(origin+'/?playtest=1&menuSample=1');await p.locator('[data-pinned]').waitFor();
 const pinned=p.locator('[data-pinned]'),list=p.locator('.gear-weapon-list');
 assert.equal(await p.locator('[data-gear-slot="0"]').getAttribute('aria-pressed'),'true');
 assert.equal(await pinned.getAttribute('data-pinned'),'v2-starter-rifle');
 const first=await pinned.boundingBox();assert.equal(first.height,30);
 await list.evaluate(e=>e.scrollTop=e.scrollHeight);
 assert.ok(Math.abs((await pinned.boundingBox()).y-first.y)<1);
 const aligned=await p.locator('.pt-stat-inner').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().x));assert.ok(aligned.every(x=>Math.abs(x-aligned[0])<1));
 await p.screenshot({path:`${out}/pinned-bottom-${width}.png`});
 await p.locator('[data-gear-slot="1"]').click();assert.equal(await pinned.getAttribute('data-pinned'),'v2-starter-shotgun');assert.equal(await p.locator('[data-gear-slot="1"]').getAttribute('aria-pressed'),'true');
 const candidate='menu-sample-rocket-14';
 await p.locator(`[data-row="${candidate}"] [data-detail]`).tap();
 assert.equal(await p.locator('dialog[open]').count(),0);assert.equal(await pinned.getAttribute('data-pinned'),candidate);
 assert.match(await p.locator('[data-gear-slot="0"]').innerText(),/AR-9/);
 await p.locator('#pt-sort').selectOption('power');await p.locator('#pt-filter').selectOption('rifle');assert.equal(await pinned.getAttribute('data-pinned'),candidate);
 // Tapping the other equipped item swaps the slots without duplicating an item.
 await p.locator('[data-row="v2-starter-rifle"] [data-detail]').tap();assert.equal(await pinned.getAttribute('data-pinned'),'v2-starter-rifle');assert.match(await p.locator('[data-gear-slot="0"]').innerText(),/RL-2/);
 await pinned.locator('[data-detail]').click();await p.locator('dialog[open]').waitFor();assert.equal(await p.locator('#pt-compare').inputValue(),'v2-starter-rifle');await p.locator('.dialog-close').click();
 await p.locator('#pt-organize').click();const before=await pinned.getAttribute('data-pinned');await p.locator('[data-row="menu-sample-rifle-2"] [data-detail]').click();await p.locator('dialog[open]').waitFor();await p.locator('.dialog-close').click();assert.equal(await pinned.getAttribute('data-pinned'),before);
 assert.equal(await pinned.locator('[data-check]').count(),0);
 await p.locator('#pt-organize').click();await p.locator('#pt-filter').selectOption('all');
 if(width===640){
  await list.evaluate(e=>e.scrollTop=0);const r=await pinned.boundingBox(),x=r.x+250,y=r.y+15,client=await p.context().newCDPSession(p);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=6;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*16,y}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(200);
  assert.equal(await p.locator('dialog[open]').count(),0);assert.ok(await list.evaluate(e=>e.scrollLeft)>0);
  const xs=await p.locator('.pt-stat-inner').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().x));assert.ok(xs.every(x=>Math.abs(x-xs[0])<1));
 }
 await list.evaluate(e=>{e.scrollLeft=0;e.scrollTop=0});await p.screenshot({path:`${out}/equipped-${width}.png`});
 await p.locator('#pt-armory').click();await p.locator('[data-genre="rocket"]').click();assert.equal(await p.locator('[data-pinned]').count(),0);assert.equal((await p.locator('[data-row]').first().boundingBox()).height,30);await p.screenshot({path:`${out}/armory-${width}.png`});
 await p.locator('#pt-gear').click();assert.equal(await p.locator('[data-gear-slot="0"]').getAttribute('aria-pressed'),'true');
 assert.deepEqual(errors,[]);results.push({width,height,row:30,sticky:true,oneTapEquip:true,swap:true,filterRetainsComparison:true,organizeProtected:true,errors});await p.close();
}
// A normal (non-sample) save persists the selected replacement.
const p=await b.newPage({serviceWorkers:'block'});await p.addInitScript(raw=>{if(!localStorage.getItem('swarm-front-progression-v2-normal'))localStorage.setItem('swarm-front-progression-v2-normal',raw)},fs.readFileSync(out+'/fixture.json','utf8'));
await p.goto(origin+'/?playtest=1');await p.locator('#solo').click();await p.locator('[data-row="ui-2"] [data-detail]').click();assert.equal(await p.locator('[data-pinned]').getAttribute('data-pinned'),'ui-2');await p.reload();await p.locator('#solo').click();assert.equal(await p.locator('[data-pinned]').getAttribute('data-pinned'),'ui-2');await p.close();
fs.writeFileSync(out+'/interaction.json',JSON.stringify({results,persists:true},null,2));console.log('PASS 4 sizes: 30px rows, sticky comparison, slot defaults/switching, one tap equip, swap, details, organizing, touch scroll, normal save persistence');
}finally{await b.close();}
