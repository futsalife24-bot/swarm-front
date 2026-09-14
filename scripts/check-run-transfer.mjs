import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out='dist-work/run-transfer-20260913';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:820}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5340/scripts/run-transfer-review.html');await page.waitForFunction(()=>window.ready,null,{timeout:120000});
 await page.evaluate(()=>{review.freeze();review.reset('jog');for(let i=0;i<30;i++)review.tick();review.draw()});
 await page.screenshot({path:out+'/jog-side.png'});
 const result=await page.evaluate(()=>({trials:Object.keys(review.trials),bones:review.models().map(t=>t.bones.length),clips:review.models().map(t=>[...t.clips.keys()]),finite:review.models().every(t=>t.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite)))}));
 assert.ok(result.finite);assert.deepEqual(errors,[]);writeFileSync(out+'/loader-check.json',JSON.stringify({...result,errors},null,2));console.log(result);
 const game=await browser.newPage({viewport:{width:1280,height:720}});game.on('pageerror',e=>errors.push(e.message));await game.goto('http://127.0.0.1:5340/?runTrial=jog');await game.getByRole('button',{name:/ソロで出撃準備/}).click();await game.locator('#launch').click();await game.waitForFunction(()=>window.__swarm?.trooper?.loaded,null,{timeout:120000});await game.keyboard.down('KeyW');await game.waitForTimeout(700);await game.keyboard.up('KeyW');await game.screenshot({path:out+'/jog-game.png'});console.log('REAL GAME',await game.evaluate(()=>__swarm.trooper));assert.deepEqual(errors,[]);
}finally{await browser.close()}
