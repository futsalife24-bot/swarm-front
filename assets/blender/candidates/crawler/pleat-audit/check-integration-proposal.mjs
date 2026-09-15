import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir='assets/blender/candidates/crawler/pleat-audit';
const gameFix=s=>s.replace('e.wind -= dt;','e.wind -= dt;\n      if (e.kind === "crawler" && e.wind < 1e-9) e.wind = 0;');
const renderFix=s=>s.replace(/const t =\s*e.wind > 0/,`const t = e.wind > 0 || (e.kind === "crawler" && this.structures.get("crawler")?.controller.states.get(e.id)?.clip === "Lunge")`);
for(const [file,fix] of [['src/shared/game.ts',gameFix],['src/client/render.ts',renderFix]]){const s=fs.readFileSync(file,'utf8'),out=fix(s);assert.notEqual(out,s);fs.writeFileSync(dir+'/'+file.split('/').at(-1)+'.proposed.txt',out);}
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const results=[];
try{
for(const patched of [false,true]){
 const p=await browser.newPage({viewport:{width:844,height:390},recordVideo:{dir:dir+'/integration-videos',size:{width:844,height:390}}});
 await p.route('**/assets/enemies/hound_motion_v1.glb',r=>r.fulfill({path:'assets/blender/candidates/crawler/pleat-v3/pleat_motion_v3.glb',contentType:'model/gltf-binary'}));
 if(patched){for(const [pattern,fix] of [['**/src/shared/game.ts',gameFix],['**/src/client/render.ts',renderFix]])await p.route(pattern,async r=>{const response=await r.fetch();const body=await response.text();const next=fix(body);assert.notEqual(next,body);await r.fulfill({response,body:next})})}
 await p.goto('http://127.0.0.1:5199/e2e/structure-fixture.html');
 const report=await p.evaluate(async()=>{
  const {Renderer}=await import('/src/client/render.ts'),g=await import('/src/shared/game.ts'),T=await import('/node_modules/three/build/three.module.js');
  const canvas=document.createElement('canvas'),d=document.createElement('div');d.id='damage';document.body.replaceChildren(canvas,d);const hud=document.createElement('div');hud.style.cssText='position:fixed;top:0;left:0;color:white;background:#122020;padding:8px;font:16px monospace;z-index:100';document.body.append(hud);const view=new Renderer(canvas);const all=[];
  for(const side of [0,-1,1]){
   view.render(null,'p',0,0,0);const w=g.createWorld('proposal',44,1);g.addPlayer(w,'p');g.start(w);w.enemies=[];w.nextSpawn=999;
   const player=w.players[0];Object.assign(player,{x:0,z:0,hp:160});g.spawn(w,'crawler',0,-2,'crown');const e=w.enemies[0];Object.assign(e,{active:true,cool:0,wind:0});view.render(w,'p',.05,0,0);await view.structures.get('crawler').loading;
   let windStart=null;const samples=[];let burst;
   for(let tick=0;tick<70;tick++){
    if(burst&&w.time-burst.time>.8){player.x=0;player.z=12;}
    else if(windStart!==null&&side!==0){player.x=side*2;player.z=e.z;}
    g.step(w,{},.05);if(windStart===null&&e.wind>0)windStart=w.time;
    const before=JSON.stringify(w);view.render(w,'p',.05,0,0);if(JSON.stringify(w)!==before)throw Error('Renderer mutation');
    const motion=view.structures.get('crawler'),state=motion.controller.states.get(e.id);const matrix=new T.Matrix4();motion.batch.parts[0].getMatrixAt(0,matrix);const direction=new T.Vector3(0,0,-1).transformDirection(matrix);const aim=new T.Vector3(e.tx-e.x,0,e.tz-e.z).normalize();
    const ev=w.events.find(x=>x.type==='burst');const sample={tick,time:w.time,wind:e.wind,cool:e.cool,hp:player.hp,clip:state?.clip,poseTime:state?.time,directionErrorRadians:direction.angleTo(aim)};samples.push(sample);
    if(ev&&!burst){burst={...sample,elapsed:w.time-windStart,event:ev};}
    view.camera.position.set(9,6,6);view.camera.lookAt(0,.5,3);view.renderer.render(view.scene,view.camera);
    hud.textContent=`side ${side} | simulation ${w.time.toFixed(2)}s | ${state?.clip} | wind ${e.wind.toPrecision(3)} | HP ${player.hp}`;
    await new Promise(resolve=>setTimeout(resolve,50));
   }
   all.push({side,windStart,burst,samples,locomotionAfterRecovery:samples.some(s=>s.time>burst.time+1.2&&s.clip==='Locomotion')});
  }
  return all;
 });results.push({patched,report});const video=p.video();await p.close();await video.saveAs(dir+'/integration-videos/'+(patched?'proposed':'current')+'.webm');
}
fs.writeFileSync(dir+'/integration-proposal-results.json',JSON.stringify({scope:'Vite response substitution in isolated test browser only. Production files unchanged.',results},null,2));
for(const x of results.find(x=>x.patched).report){assert.ok(Math.abs(x.burst.elapsed-.45)<1e-8);assert.ok(x.burst.directionErrorRadians<1e-5);assert.ok(Math.abs(x.burst.poseTime-.45)<1e-8);assert.ok(x.locomotionAfterRecovery)}
assert.ok(results.find(x=>!x.patched).report.some(x=>x.burst.elapsed>.49));
assert.ok(results.find(x=>!x.patched).report.some(x=>x.side!==0&&x.burst.directionErrorRadians>1));
assert.ok(results.find(x=>!x.patched).report.every(x=>!x.locomotionAfterRecovery));
console.log(JSON.stringify(results.map(x=>({patched:x.patched,cases:x.report.map(r=>({side:r.side,elapsed:r.burst.elapsed,angle:r.burst.directionErrorRadians,clipTime:r.burst.poseTime,hp:r.burst.hp}))})),null,2));
}finally{await browser.close()}
