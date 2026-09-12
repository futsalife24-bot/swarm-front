import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/Shader|WebGLProgram|GLSL/.test(m.text()))errors.push(m.text())});
 await page.goto('http://127.0.0.1:5342/prototypes/visual-block/');await page.waitForFunction(()=>window.visualBlock?.ready,null,{timeout:90000});await page.waitForTimeout(600);
 const before=await page.evaluate(()=>structuredClone(visualBlock.world.players[0]));await page.locator('#pause').click();
 const points=[];for(const [id,key] of [[1,'KeyW'],[2,'Space']]){const box=await page.locator(`[data-key="${key}"]`).boundingBox();points.push({id,x:box.x+box.width/2,y:box.y+box.height/2,radiusX:3,radiusY:3});}
 const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});await page.waitForTimeout(650);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.evaluate(()=>visualBlock.paused=true);const after=await page.evaluate(()=>structuredClone(visualBlock.world.players[0]));
 assert.ok(after.z<before.z-.1);assert.ok(after.ammo[0]<before.ammo[0]);assert.deepEqual(errors,[]);
 await page.screenshot({path:'dist-validation/visual-block-v2/distribution-touch.png'});
 writeFileSync('dist-validation/visual-block-v2/distribution.json',JSON.stringify({viewport:[844,390],before,after,errors},null,2));console.log('PASS: production build, simultaneous move + fire touch input, no JS/shader errors');
}finally{await browser.close()}
