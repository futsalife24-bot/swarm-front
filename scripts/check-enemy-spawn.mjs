import { chromium } from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out='dist-validation/enemy-spawn';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
const rows=[];
try {
 for(const width of [844,1280]) {
  const page=await browser.newPage({viewport:{width,height:width===844?390:720},serviceWorkers:'block'}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/src/client/playtest-app.ts*',async route=>{
   const response=await route.fetch();
   const body=await response.text()+`\nwindow.__spawnQA={prepare:async(kind)=>{paused=true;save.encounters=Object.fromEntries(Object.keys(names).map(k=>[k,'solo']));for(const d of document.querySelectorAll('dialog'))d.close();encounterActive=false;world.enemies=[];view.spawnEffects.clear();const {spawn}=await import('/src/shared/game.ts');const e=spawn(world,kind==='worm'?'boss':kind,0,kind==='boss'||kind==='worm'?-12:4,kind==='worm'?'worm':'crown',0);controls.input.yaw=0;controls.input.pitch=0;view.render(world,'solo',0,0,0,undefined,false,false);if(kind==='worm')await view.foundryWorms.get(e.id).loading;else await view.structures.get(kind).loading;view.render(world,'solo',0,0,0,undefined,false,false);view.camera.position.set(e.x+9,e.y+7,e.z+13);view.camera.lookAt(e.x,e.y+1,e.z);},sample:steps=>{const before=JSON.stringify(world),poses=JSON.stringify([...view.structures].map(([k,v])=>[k,Array.from(v.batch?.poseB.array??[])]));for(let i=0;i<steps;i++)view.spawnEffects.update(world,.05,true,view.camera);view.renderer.render(view.scene,view.camera);return {unchanged:before===JSON.stringify(world),posesUnchanged:poses===JSON.stringify([...view.structures].map(([k,v])=>[k,Array.from(v.batch?.poseB.array??[])])),active:view.spawnEffects.items.size,items:[...view.spawnEffects.items.values()].map(e=>({age:e.age,teleport:e.teleport,origin:e.origin.toArray(),radius:e.radius})),calls:view.renderer.info.render.calls};}};`;
   await route.fulfill({response,body});
  });
  await page.goto('http://127.0.0.1:5352/?playtest=1');
  await page.locator('#solo').click();await page.locator('#pt-confirm').click();await page.locator('#pt-start').click();await page.locator('#pt-enter').waitFor({timeout:90000});await page.locator('#pt-enter').click();
  for(const kind of ['crawler','ant','spider','spitter','hornet','boss','worm']) {
   await page.evaluate(k=>window.__spawnQA.prepare(k),kind);await page.waitForTimeout(650);
   const start=await page.evaluate(()=>window.__spawnQA.sample(0));assert.equal(start.active,1);
   await page.screenshot({path:`${out}/${kind}-${width}-start.png`});
   const mid=await page.evaluate(()=>window.__spawnQA.sample(7));
   await page.screenshot({path:`${out}/${kind}-${width}-mid.png`});
   const end=await page.evaluate(()=>window.__spawnQA.sample(24));assert.equal(end.active,0);
   for(const s of [start,mid,end])assert.ok(s.unchanged&&s.posesUnchanged);
   assert.equal((await page.evaluate(()=>window.__spawnQA.sample(1))).active,0);
   rows.push({kind,width,start,mid,end});
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 // Lifecycle and burst limits with the real presentation module, independent of gameplay animation.
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5352/');
 const lifecycle=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {EnemySpawnEffects}=await import('/src/client/enemy-spawn-effects.ts');
  const {createWorld,spawn}=await import('/src/shared/game.ts');
  const scene=new T.Scene(),fx=new EnemySpawnEffects(scene),camera=new T.PerspectiveCamera(),w=createWorld('qa');w.phase='battle';
  for(let i=0;i<40;i++)spawn(w,i%2?'hornet':'crawler',i,0);
  const original=JSON.stringify(w);fx.update(w,0,true,camera);const burst=fx.items.size;
  fx.update(w,.1,false,camera);const paused=[...fx.items.values()].every(e=>e.age===0);
  for(let i=0;i<12;i++)fx.update(w,.1,true,camera);
  const cleaned=scene.children.length===0&&fx.items.size===0;
  fx.update(w,.1,true,camera);const once=fx.items.size===0;
  w.run='restart';fx.update(w,0,true,camera);const restart=fx.items.size===burst;
  fx.update(null,0,true,camera);const reset=scene.children.length===0;
  w.run='qa';return {burst,paused,cleaned,once,restart,reset,unchanged:JSON.stringify(w)===original};
 });
 assert.equal(lifecycle.burst,24);for(const [k,v] of Object.entries(lifecycle))if(k!=='burst')assert.equal(v,true,k);
 fs.writeFileSync(`${out}/checks.json`,JSON.stringify({rows,lifecycle},null,2));console.log('PASS',rows.length,'views',lifecycle);
}finally{await browser.close()}
