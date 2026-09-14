import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// Read-only investigation: run the real Renderer/fire in an isolated fixture.
const server = await createServer({server:{host:'127.0.0.1',port:5194,strictPort:true}});
await server.listen();
const browser = await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const dir = 'dist-validation/aim-alignment';
mkdirSync(dir,{recursive:true});
try {
  const page = await browser.newPage({viewport:{width:915,height:412},hasTouch:true,isMobile:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5194/e2e/structure-fixture.html');
  const result = await page.evaluate(async()=>{
    const viewport=document.createElement('meta');viewport.name='viewport';viewport.content='width=device-width,initial-scale=1';document.head.append(viewport);
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const T = await import('/node_modules/three/build/three.module.js');
    const {Renderer} = await import('/src/client/render.ts');
    const g = await import('/src/shared/game.ts');
    const {STARTERS} = await import('/src/shared/defs.ts');
    const {loadStandardTrooper} = await import('/src/client/standard-trooper.ts');
    await loadStandardTrooper();
    const canvas=document.createElement('canvas'),damage=document.createElement('div');
    damage.id='damage';document.body.append(canvas,damage);
    const v=new Renderer(canvas),w=g.createWorld('aim-audit',42),p=g.addPlayer(w,'p',[STARTERS[2],STARTERS[0]]);
    w.phase='battle';w.enemies=[];p.x=0;p.z=0;
    v.render(w,'p',.016,0,0);
    await new Promise(resolve=>setTimeout(resolve,100));
    const rows=[];
    let levelDirection;
    for(const pitch of [0,.5,80*Math.PI/180]){
      p.pitch=pitch;p.cool=0;p.ammo[0]=2;
      g.fire(w,p,{...g.neutral(),pitch});
      const shot=w.events.filter(e=>e.type==='shot').at(-1);
      const origin=new T.Vector3(shot.x,shot.y,shot.z);
      const direction=new T.Vector3(shot.tx-shot.x,shot.ty-shot.y,shot.tz-shot.z).normalize();
      v.render(w,'p',0,0,pitch);v.camera.updateMatrixWorld(true);
      const center=v.camera.getWorldDirection(new T.Vector3());
      const hits=[5,10,30,65].map(distance=>{
        const point=origin.clone().addScaledVector(direction,distance),ndc=point.clone().project(v.camera);
        return {distance,world:point.toArray(),offsetX:ndc.x*innerWidth/2,offsetY:-ndc.y*innerHeight/2};
      });
      rows.push({pitchDegrees:pitch*180/Math.PI,camera:v.camera.position.toArray(),shotDirection:direction.toArray(),cameraDirection:center.toArray(),angleDegrees:direction.angleTo(center)*180/Math.PI,hits});
      if(pitch===0)levelDirection=direction;
    }
    // Compare the actual animated upper-body pose at the old cap vs 80 degrees.
    const trooper=v.players.get('p').userData.trooper;
    const poses=[];
    for(const pitch of [.8,80*Math.PI/180]){
      p.pitch=pitch;v.render(w,'p',0,0,pitch);
      poses.push({pitch,spine:trooper.model.getObjectByName('Spine').getWorldQuaternion(new T.Quaternion()).toArray()});
    }
    // The existing assist intentionally bends a level shot up to a nearby body.
    const assistWorld=g.createWorld('assist',42),assistPlayer=g.addPlayer(assistWorld,'p',[STARTERS[2],STARTERS[0]]);
    assistPlayer.x=0;assistPlayer.z=0;
    g.spawn(assistWorld,'crawler',Math.sin(.05)*10,-Math.cos(.05)*10);
    g.fire(assistWorld,assistPlayer,g.neutral());
    const assistShot=assistWorld.events.filter(e=>e.type==='shot').at(-1);
    const assistDirection=new T.Vector3(assistShot.tx-assistShot.x,assistShot.ty-assistShot.y,assistShot.tz-assistShot.z).normalize();
    const assist={inputYaw:0,outputYaw:Math.atan2(assistDirection.x,-assistDirection.z),angleDegrees:assistDirection.angleTo(levelDirection)*180/Math.PI};
    // Annotate the actual rendered level camera with points on the true bullet ray.
    p.pitch=0;w.events=[];w.projectiles=[];v.combat.clear();v.render(w,'p',0,0,0);v.camera.updateMatrixWorld(true);
    const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;pointer-events:none;color:white;font:14px sans-serif';
    const mark=(x,y,label,color)=>{const el=document.createElement('div');el.style.cssText=`position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%);color:${color};white-space:nowrap;text-shadow:0 1px 3px black`;el.textContent=label;overlay.append(el)};
    mark(innerWidth/2,25,'白：画面中央（30mで一致）／ 橙：実際の弾道上の点','#ffffff');
    mark(innerWidth/2,innerHeight/2,'+','#ffffff');
    for(const hit of rows[0].hits.filter(hit=>hit.distance!==30))mark(innerWidth/2+hit.offsetX,innerHeight/2+hit.offsetY,`● ${hit.distance}m`,'#ff9770');
    document.body.append(overlay);
    return {viewport:{width:innerWidth,height:innerHeight},rows,poses,assist,trooperLoaded:!!trooper};
  });
  assert.ok(result.rows[0].hits[0].offsetY>20,'5m shot ray should reproduce the reported offset');
  assert.ok(Math.abs(result.rows[0].hits[2].offsetY)<.001,'30m convergence point should be centered');
  assert.deepEqual(result.poses[0].spine,result.poses[1].spine,'upper-body pose caps before 80 degrees');
  assert.deepEqual(errors,[]);
  await page.screenshot({path:`${dir}/level-ray.png`});
  writeFileSync(`${dir}/result.json`,JSON.stringify({...result,errors,scope:'isolated actual Renderer and authoritative fire; no production mutation; Chrome touch emulation'},null,2));
  console.log(JSON.stringify(result,null,2));
  await page.goto('about:blank');
} finally {await browser.close();await server.close();}
