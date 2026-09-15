import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir='assets/blender/candidates/crawler/pleat-v4/adoption';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const results=[];
try {
 for(const version of ['adopted']){
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:5199/e2e/structure-fixture.html');
  const cases=await page.evaluate(async()=>{
   const {Renderer}=await import('/src/client/render.ts'),g=await import('/src/shared/game.ts'),T=await import('/node_modules/three/build/three.module.js');
   const canvas=document.createElement('canvas'),d=document.createElement('div');d.id='damage';document.body.replaceChildren(canvas,d);const view=new Renderer(canvas),out=[];
   for(const reset of ['new-run','new-run-cool-jump','null-world','enemy-removed','time-rewind','inactive']){
    view.render(null,'p',0,0,0);const w=g.createWorld('reset',44,1);g.addPlayer(w,'p');g.start(w);w.enemies=[];w.nextSpawn=999;w.time=10;
    const player=w.players[0];Object.assign(player,{x:0,z:0});g.spawn(w,'crawler',0,-2,'crown');const e=w.enemies[0];Object.assign(e,{active:true,cool:0,wind:0,tx:0,tz:0,targetId:'p'});
    view.render(w,'p',.05,0,0);await view.structures.get('crawler').loading;
    // Observed authoritative snapshots around one impact; no source or GLB mutation.
    w.time=10.05;e.wind=.05;view.render(w,'p',.05,0,0);
    w.time=10.1;e.wind=0;e.cool=1.2;view.render(w,'p',.05,0,0);
    const heldBefore=view.crawlerAim.get(e.id)?.until;if(!(w.time<heldBefore))throw Error('interruption fixture was not holding');
    if(reset==='new-run-cool-jump'){e.cool=.2;w.time=10.11;view.render(w,'p',.05,0,0);}
    if(reset==='null-world')view.render(null,'p',0,0,0);
    if(reset==='enemy-removed'){w.enemies=[];view.render(w,'p',.05,0,0);w.enemies=[e];}
    w.time=reset==='time-rewind'?0:10.15;
    if(reset.startsWith('new-run'))w.run+='-new';
    Object.assign(e,{active:reset!=='inactive',cool:reset==='new-run-cool-jump'?1.9:1.2,wind:0});Object.assign(player,{x:2,z:-2});
    const before=JSON.stringify(w);view.render(w,'p',.05,0,0);assertWorld(before,w);
    const matrix=new T.Matrix4();view.structures.get('crawler').batch.parts[0].getMatrixAt(0,matrix);const angle=new T.Vector3(0,0,-1).transformDirection(matrix).angleTo(new T.Vector3(1,0,0));out.push({reset,angle,clip:view.structures.get('crawler').controller.states.get(e.id)?.clip,held:view.crawlerAim.get(e.id)?.until});
   }
   function assertWorld(before,w){if(before!==JSON.stringify(w))throw Error('Renderer mutation')}
   return out;
  });results.push({version,cases});await page.close();
 }
 fs.writeFileSync(dir+'/reset-results.json',JSON.stringify({scope:'real Renderer with lifecycle snapshots; fixed GLB; actual adopted source',results},null,2));
 assert.ok(results[0].cases.every(c=>c.angle<1e-5));assert.notEqual(results[0].cases.find(c=>c.reset==='new-run').clip,'Lunge');
 console.log(JSON.stringify(results));
}finally{await browser.close();}


