import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const server = await createServer({server:{host:'127.0.0.1',port:5197,strictPort:true}});
await server.listen();
const browser = await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5197/e2e/structure-fixture.html');
 const rows=await page.evaluate(async()=>{
  const {Renderer}=await import('/src/client/render.ts');
  const g=await import('/src/shared/game.ts'); const {STARTERS}=await import('/src/shared/defs.ts');
  const {MIN_PITCH,MAX_PITCH}=await import('/src/shared/aim.ts');
  const canvas=document.createElement('canvas'),damage=document.createElement('div');damage.id='damage';document.body.append(canvas,damage);
  const view=new Renderer(canvas);const rows=[];
  for(const pitch of [MIN_PITCH,0,MAX_PITCH])for(const axis of ['x','z'])for(const predicted of [false,true])for(const scoped of [false,true]){
   const w=g.createWorld('jitter',42),p=g.addPlayer(w,'p',[STARTERS[2],STARTERS[0]]);w.phase='battle';p.x=0;p.z=0;
   view.render(null,'p',0,0,pitch);view.render(w,'p',1/60,0,pitch);
   let previous=view.camera.quaternion.clone(),maxAngle=0;
   for(let frame=1;frame<=90;frame++){
    p[axis]=Math.floor(frame/3)*.15;
    const prediction=predicted?{x:p.x,z:p.z,[axis]:frame*.05}:undefined;
    view.render(w,'p',1/60,0,pitch,prediction,true,scoped);
    maxAngle=Math.max(maxAngle,previous.angleTo(view.camera.quaternion));previous.copy(view.camera.quaternion);
   }
   rows.push({pitch,axis,predicted,scoped,maxAngleDegrees:maxAngle*180/Math.PI});
  }
  return rows;
 });
 mkdirSync('dist-validation/camera-jitter',{recursive:true});
 writeFileSync(`dist-validation/camera-jitter/${process.env.JITTER_BASELINE?'before':'after'}.json`,JSON.stringify({rows,errors},null,2));
 console.log(JSON.stringify({cases:rows.length,maxAngleDegrees:Math.max(...rows.map(r=>r.maxAngleDegrees)),errors}));
 if(!process.env.JITTER_BASELINE){assert.ok(rows.every(r=>r.maxAngleDegrees<.00001));assert.deepEqual(errors,[]);}
}finally{await browser.close();await server.close();}
