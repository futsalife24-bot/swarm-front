import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const dir='dist-validation/visual-block-v2';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/Shader|WebGLProgram|GLSL/.test(m.text()))errors.push(m.text())});
 await page.goto('http://127.0.0.1:5341/prototypes/visual-block/');
 await page.waitForFunction(()=>window.visualBlock?.ready,null,{timeout:90000});
 await page.waitForFunction(()=>visualBlock.r.mapAssets.distantStatus[0].state==='ready');
 await page.waitForTimeout(2000);
 const results=[];
 for(const [width,height] of [[1280,720],[844,390]]){
  await page.setViewportSize({width,height});
  for(const mode of [false,true]){
   await page.evaluate(v=>visualBlock.mode(v),mode);await page.waitForTimeout(400);
   await page.evaluate(()=>visualBlock.clearMetrics());await page.waitForTimeout(2000);
   await page.screenshot({path:`${dir}/${width}-${mode?'after':'before'}.png`});
   results.push({width,mode,metrics:await page.evaluate(()=>visualBlock.metrics())});
  }
 }
 await page.setViewportSize({width:1280,height:720});
 // A -> B -> A must restore the original render, including the cached shadow.
 await page.evaluate(()=>visualBlock.mode(false));await page.waitForTimeout(200);
 await page.screenshot({path:`${dir}/1280-restored.png`});
 await page.evaluate(()=>visualBlock.mode(true));
 const before=await page.evaluate(()=>structuredClone(visualBlock.world.players[0]));
 await page.evaluate(()=>visualBlock.paused=false);await page.keyboard.down('KeyW');await page.waitForTimeout(650);await page.keyboard.up('KeyW');
 await page.screenshot({path:`${dir}/moving.png`});
 await page.keyboard.down('Space');await page.waitForTimeout(450);await page.keyboard.up('Space');
 await page.screenshot({path:`${dir}/firing.png`});await page.evaluate(()=>visualBlock.paused=true);
 const after=await page.evaluate(()=>structuredClone(visualBlock.world.players[0]));
 assert.ok(after.z<before.z-.1,'W moves forward along negative world Z');assert.ok(after.ammo[0]<before.ammo[0]);assert.deepEqual(errors,[]);
 await page.evaluate(()=>visualBlock.paused=false);
 await page.keyboard.down('KeyR');await page.waitForTimeout(100);await page.keyboard.up('KeyR');
 const reloading=await page.evaluate(()=>visualBlock.world.players[0].reload);assert.ok(reloading>0);
 await page.screenshot({path:`${dir}/reloading.png`});await page.waitForTimeout(3000);
 const reloaded=await page.evaluate(()=>visualBlock.world.players[0].ammo[0]);assert.equal(reloaded,before.ammo[0]);
 await page.keyboard.down('KeyQ');await page.waitForTimeout(100);await page.keyboard.up('KeyQ');await page.waitForTimeout(600);
 const switched=await page.evaluate(()=>visualBlock.world.players[0].slot);assert.equal(switched,1);
 await page.keyboard.down('KeyE');await page.waitForTimeout(100);await page.keyboard.up('KeyE');
 const evading=await page.evaluate(()=>visualBlock.world.players[0].evade);assert.ok(evading>0);await page.screenshot({path:`${dir}/rolling.png`});await page.waitForTimeout(600);
 await page.evaluate(()=>visualBlock.paused=true);
 const detail=await page.evaluate(()=>{const t=visualBlock.r.players.get('local').userData.trooper;return {bones:t.bones.length,clips:t.assets.character.animations.length,meshes:t.model.children.map(o=>({name:o.name})),renderer:visualBlock.r.renderer.getContext().getParameter(visualBlock.r.renderer.getContext().RENDERER)};});
 const motion=[];
 for(const mode of [false,true]){
  await page.evaluate(v=>{visualBlock.reset();visualBlock.mode(v);visualBlock.paused=false;visualBlock.clearMetrics()},mode);
  await page.keyboard.down('KeyW');await page.waitForTimeout(2000);await page.keyboard.up('KeyW');
  motion.push({mode,metrics:await page.evaluate(()=>visualBlock.metrics())});await page.evaluate(()=>visualBlock.paused=true);
 }
 assert.deepEqual(errors,[]);
 writeFileSync(`${dir}/checks.json`,JSON.stringify({results,motion,before,after,reloading,reloaded,switched,evading,errors,detail},null,2));console.log(JSON.stringify({results,motion,detail,move:after.z-before.z,ammo:after.ammo[0]},null,2));
} finally {await browser.close();}
