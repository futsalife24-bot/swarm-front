import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir='assets/blender/candidates/crawler/pleat-v4/adoption';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try {
 for(const mode of ['loaded','delayed','failed']) {
  const page=await browser.newPage({viewport:{width:844,height:390}});let release;
  const gate=new Promise(r=>release=r);
  await page.route('**/assets/enemies/pleat_motion_v4.glb',async r=>{
   if(mode==='failed')return r.abort();
   if(mode==='delayed')await gate;
   return r.continue();
  });
  await page.goto('http://127.0.0.1:5199/e2e/structure-fixture.html');
  const report=await page.evaluate(async mode=>{
   const {Renderer}=await import('/src/client/render.ts'),g=await import('/src/shared/game.ts'),T=await import('/node_modules/three/build/three.module.js');
   const canvas=document.createElement('canvas'),damage=document.createElement('div');damage.id='damage';document.body.replaceChildren(canvas,damage);const view=new Renderer(canvas),all=[];
   for(const skip of [false,true])for(const side of [0,-1,1]) {
    view.render(null,'p',0,0,0);const w=g.createWorld('proposal-v2',44,1);g.addPlayer(w,'p');g.start(w);w.enemies=[];w.nextSpawn=999;
    const player=w.players[0];Object.assign(player,{x:2,z:-2,hp:160});g.spawn(w,'crawler',0,-2,'crown');const e=w.enemies[0];Object.assign(e,{active:true,cool:1.2,wind:0,targetId:'p',tx:0,tz:0});
    view.render(w,'p',.05,0,0);if(mode!=='delayed')await view.structures.get('crawler').loading;
    const read=()=>{const motion=view.structures.get('crawler'),matrix=new T.Matrix4();(motion.batch?.parts[0]??view.enemies.get('crawler')).getMatrixAt(0,matrix);return new T.Vector3(0,0,-1).transformDirection(matrix);};
    view.render(w,'p',.05,0,0);const initialAngle=read().angleTo(new T.Vector3(1,0,0));
    Object.assign(player,{x:0,z:0});Object.assign(e,{cool:0,wind:0});view.render(w,'p',.05,0,0);
    let start=null,burst=null;const samples=[],burstIds=new Set();
    for(let tick=0;tick<70;tick++) {
     if(burst&&w.time-burst.time>.8){player.x=0;player.z=12;}
     else if(start!==null&&side){player.x=side*2;player.z=e.z;}
     g.step(w,{},.05);if(start===null&&e.wind>0)start=w.time;
     for(const ev of w.events.filter(x=>x.type==='burst'))burstIds.add(ev.id);
     if(skip&&e.wind>0)continue;
     const before=JSON.stringify(w);view.render(w,'p',.05,0,0);if(before!==JSON.stringify(w))throw Error('world mutation');
     const forward=read(),aim=new T.Vector3(e.tx-e.x,0,e.tz-e.z).normalize(),target=new T.Vector3(player.x-e.x,0,player.z-e.z).normalize();
     const clip=view.structures.get('crawler').controller.states.get(e.id)?.clip;
     const sample={tick,time:w.time,wind:e.wind,cool:e.cool,clip,aimAngle:forward.angleTo(aim),targetAngle:forward.angleTo(target),hp:player.hp};samples.push(sample);
     if(!burst&&w.events.some(x=>x.type==='burst'))burst={...sample,elapsed:w.time-start};
    }
    // Explicit interruption must release held aim, independently of the GLB.
    Object.assign(e,{active:false,wind:0});view.render(w,'p',.05,0,0);const interruptedAngle=read().angleTo(new T.Vector3(player.x-e.x,0,player.z-e.z).normalize());
    all.push({mode,skip,side,initialAngle,interruptedAngle,burst,burstCount:burstIds.size,recovery:samples.filter(s=>s.time>burst.time+1.2),samples});
   }
   return all;
  },mode);
  results.push(...report);release();await page.close();
 }
 fs.writeFileSync(dir+'/results.json',JSON.stringify({scope:'actual source and public GLB; network timing/failure controlled only',results},null,2));
 for(const r of results){assert.ok(r.initialAngle<1e-5,JSON.stringify(r));assert.ok(r.interruptedAngle<1e-5);assert.ok(Math.abs(r.burst.elapsed-.45)<1e-8);assert.ok(r.burst.aimAngle<1e-5,JSON.stringify(r));assert.equal(r.burstCount,1);assert.ok(r.recovery.every(s=>s.targetAngle<1e-5));if(r.mode==='loaded')assert.ok(r.recovery.some(s=>s.clip==='Locomotion'));}
 console.log('PASS: 18 cases; initial cooldown, impact once at .45, aim, recovery, interruption; loaded/delayed/failed × wind skipped/continuous × static/left/right');
} finally {await browser.close();}

