import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const server=await createServer({server:{host:'127.0.0.1',port:5194,strictPort:true}});
await server.listen();
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const dir='dist-validation/aim-scope';mkdirSync(dir,{recursive:true});
const errors=[],ui=[];
try {
  for(const [width,height,weapons,mobile] of [[667,375,[0,1],true],[915,412,[2,0],true],[1280,720,[0,2],false]].filter(row=>!process.env.AIM_SCOPE_WIDTH || row[0]===Number(process.env.AIM_SCOPE_WIDTH))) {
    const context=await browser.newContext({viewport:{width,height},hasTouch:mobile,isMobile:mobile});
    const page=await context.newPage();page.setDefaultTimeout(20000);
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:5194/');
    await page.evaluate(async weapons=>{
      const {fresh,SAVE_KEY}=await import('/src/client/save.ts');const save=fresh();
      save.equipped=weapons.map(index=>save.inventory[index].id);localStorage.setItem(SAVE_KEY,JSON.stringify(save));
    },weapons);
    await page.reload();await page.locator('#solo').click();await page.locator('#launch').click();
    await page.waitForFunction(()=>window.__swarm?.screen==='battle'&&!document.querySelector('#scope').disabled);
    const toggle=()=>mobile?page.locator('#scope').tap():page.keyboard.press('KeyZ');
    for(let slot=0;slot<2;slot++) {
      if(slot){await page.keyboard.press('KeyQ');await page.waitForFunction(()=>window.__swarm.world.players.find(p=>p.id===window.__swarm.id).slot===1&&!document.querySelector('#scope').disabled);}
      assert.equal(await page.locator('#scope').isVisible(),true);
      await toggle();await page.waitForFunction(()=>window.__swarm.scoped && window.__swarm.cameraFov<40);
      const before=await page.evaluate(()=>window.__swarm);
      assert.ok(Math.abs(before.cameraFov-35.3366)<.02);
      await page.waitForTimeout(180);
      await page.screenshot({path:`${dir}/scope-${width}-${weapons[slot]}.png`});
      // Shooting from the ordinary fire control remains possible while scoped.
      const fire=page.locator('#fire');
      if(mobile){
        const box=await fire.boundingBox();const x=box.x+box.width/2,y=box.y+box.height/2;
        const cdp=await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:17}]});
        await page.waitForFunction(ammo=>window.__swarm.world.players.find(p=>p.id===window.__swarm.id).ammo[window.__swarm.world.players.find(p=>p.id===window.__swarm.id).slot]<ammo,before.world.players.find(p=>p.id===before.id).ammo[slot]);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+8,y:y-4,id:17}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
      }
      ui.push({width,height,kind:before.world.players.find(p=>p.id===before.id).weapons[slot].kind,scopedFov:before.cameraFov});
      await page.locator('#pause').click();await page.waitForFunction(()=>!window.__swarm.scoped && window.__swarm.cameraFov===65);
      assert.equal(await page.locator('#scope-overlay').isVisible(),false);
      assert.equal(await page.evaluate(()=>window.__swarm.cameraFov),65);
      await page.locator('#pause-resume').click();
      await toggle();await page.waitForFunction(()=>window.__swarm.scoped);
      await toggle();await page.waitForFunction(()=>!window.__swarm.scoped);
    }
    // Changing weapons actively exits zoom, even when both weapons support it.
    await toggle();await page.waitForFunction(()=>window.__swarm.scoped);
    await page.keyboard.press('KeyQ');await page.waitForFunction(()=>!window.__swarm.scoped);
    await page.locator('#pause').click();await page.locator('#pause-leave').click();await page.locator('#pause-quit').click();
    assert.equal(await page.locator('#scope-overlay').isVisible(),false);
    await page.goto('about:blank');await context.close();
    console.log('UI PASS',width,height,weapons);
  }
  const page=await browser.newPage({viewport:{width:915,height:412}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5194/e2e/structure-fixture.html');
  const geometry=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js');
    const g=await import('/src/shared/game.ts'),{STARTERS}=await import('/src/shared/defs.ts');
    const {Renderer}=await import('/src/client/render.ts'),{loadStandardTrooper}=await import('/src/client/standard-trooper.ts');
    const {mapFor}=await import('/src/shared/stages.ts');
    await loadStandardTrooper();
    const canvas=document.createElement('canvas'),damage=document.createElement('div');damage.id='damage';document.body.append(canvas,damage);
    const view=new Renderer(canvas),w=g.createWorld('aim-scope',42),p=g.addPlayer(w,'p',[STARTERS[2],STARTERS[0]]);
    p.x=p.z=0;w.phase='battle';view.render(w,'p',.016,0,0);await new Promise(r=>setTimeout(r,100));
    const rows=[];
    for(const pitch of [0,.5,80*Math.PI/180])for(const distance of [8,15,35,60])for(const scoped of [false,true]) {
      w.enemies=[];w.projectiles=[];w.events=[];p.cool=0;p.ammo[0]=2;
      const input={...g.neutral(),cameraAim:true,pitch};
      const {camera,direction:d}=g.aimCamera(p,input,mapFor(w).blocks);
      g.spawn(w,'crawler',camera.x+d.x*distance,camera.z+d.z*distance);const e=w.enemies[0];e.y=camera.y+d.y*distance-(g.eye(e)-e.y);
      const shot=g.cameraShot(w,p,input);g.fire(w,p,input);
      view.render(w,'p',0,0,pitch,undefined,false,scoped);view.camera.updateMatrixWorld(true);
      const q=w.projectiles[0],len=Math.hypot(shot.target.x-p.x,shot.target.y-1.5,shot.target.z-p.z);
      const projected=new T.Vector3(p.x+q.dx/28*len,1.5+q.dy/28*len,p.z+q.dz/28*len).project(view.camera);
      rows.push({pitch,distance,scoped,errorPx:Math.hypot(projected.x*innerWidth/2,projected.y*innerHeight/2),fov:view.camera.fov});
    }
    w.enemies=[];const poses=[];
    for(const pitch of [.8,80*Math.PI/180]) {view.render(w,'p',0,0,pitch);poses.push(view.players.get('p').userData.trooper.model.getObjectByName('Spine').getWorldQuaternion(new T.Quaternion()).toArray());}
    const poseDelta=new T.Quaternion(...poses[0]).angleTo(new T.Quaternion(...poses[1]));
    return {rows,poseDelta};
  });
  assert.ok(geometry.rows.every(r=>r.errorPx<.01));assert.ok(geometry.poseDelta>.2);assert.deepEqual(errors,[]);
  writeFileSync(`${dir}/local.json`,JSON.stringify({ui,geometry,errors,pass:true},null,2));
  console.log('GEOMETRY PASS',geometry.rows.length,'max error',Math.max(...geometry.rows.map(r=>r.errorPx)),'upper body delta',geometry.poseDelta);
  await page.goto('about:blank');
} finally {await browser.close();await server.close();}
