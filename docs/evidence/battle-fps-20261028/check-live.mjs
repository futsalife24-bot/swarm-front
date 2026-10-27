import {createServer} from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base='https://swarm-front.melosalife-24.workers.dev';
const out='dist-fps';
const server=createServer(async(req,res)=>{
 if(req.method!=='GET'){res.writeHead(405).end();return;}
 try{const r=await fetch(base+req.url);res.writeHead(r.status,{'content-type':r.headers.get('content-type')??'application/octet-stream','cache-control':'no-store'});res.end(Buffer.from(await r.arrayBuffer()));}catch{res.writeHead(502).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
const result={base,checkedAt:new Date().toISOString(),errors:[],passed:false};
try{
 const context=await browser.newContext({viewport:{width:844,height:390},serviceWorkers:'block',hasTouch:true});
 await context.addInitScript(()=>{
  window.paletteTextures=[];
  const proto=WebGL2RenderingContext.prototype, original=proto.texStorage2D;
  proto.texStorage2D=function(...args){if(args[3]===1280)window.paletteTextures.push({width:args[3],height:args[4]});return original.apply(this,args);};
 });
 const page=await context.newPage();page.setDefaultTimeout(90000);
 page.on('pageerror',e=>result.errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/front?solo=1');
 await page.locator(':light(#front-launch)').waitFor();
 await page.waitForFunction(()=>!document.querySelector('.split-shutter,.menu-route-shutter'));
 await page.locator(':light(#front-launch)').click();
 await page.locator(':light([data-card])').first().waitFor();
 await page.waitForFunction(()=>!document.querySelector('.split-shutter,.menu-route-shutter'));
 await page.locator(':light([data-card])').first().click();
 await page.waitForFunction(()=>document.querySelector('.hud-rail') && window.paletteTextures.length>0);
 await page.waitForFunction(()=>/^\d+ FPS$/.test(document.querySelector('.battle-fps')?.textContent??''));
 await page.waitForTimeout(2000);
 result.fps=await page.locator('.battle-fps').innerText();
 assert(parseInt(result.fps)>0);
 result.palettes=await page.evaluate(()=>window.paletteTextures);
 result.hud=await page.locator('#hud').innerText();
 result.canvas=await page.locator('canvas').first().boundingBox();
 await page.screenshot({path:out+'/live-battle.png'});
 assert(result.palettes.some(p=>p.width===1280));assert.deepEqual(result.errors,[]);
 result.passed=true;
}catch(e){result.failure=String(e);throw e;}
finally{fs.writeFileSync(out+'/live-battle.json',JSON.stringify(result,null,2));await browser.close();await new Promise(r=>server.close(r));}
console.log(JSON.stringify(result));
