import { execFileSync } from 'node:child_process';
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
const base=process.env.SUPPLY_SITE||'http://127.0.0.1:8796';
const expected=process.env.SUPPLY_EXPECT||'new';
if(new URL(base).hostname!=='127.0.0.1')throw Error('隔離ローカルのみ');
const out='docs/evidence/supply-audio-cache-20261111';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
try{
 const context=await browser.newContext({viewport:{width:844,height:390}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.sounds=[];const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...a){window.sounds.push({frames:this.buffer?.length,rate:this.playbackRate.value});return start.apply(this,a);};});
 const response=await context.request.post(base+'/api/developer/login',{headers:{Origin:base},data:{password:'test-only-random-developer-password'}});expect(response.ok()).toBe(true);
 await page.goto(base+'/?developer=1&base=1');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const old=Object.fromEntries(['sfx','core','runtime'].map(k=>[k,execFileSync('git',['show',`4b538dd:public/supply-reveal/${k}.js`],{encoding:'utf8'})]));
 await page.evaluate(async ({old,base})=>{const c=await caches.open('swarm-front-preload-v1');for(const [k,body]of Object.entries(old))await c.put(base+'/supply-reveal/'+k+'.js',new Response(body,{headers:{'Content-Type':'text/javascript'}}));}, {old,base});
 await page.reload();
 await page.locator('#pt-base-supply').waitFor();
 await page.waitForFunction(()=>!document.querySelector('.split-shutter,.menu-route-shutter'));
 await page.locator('#pt-base-supply').click();await page.locator('[data-supply-preview-play]').waitFor();
 await page.waitForFunction(()=>!document.querySelector('.split-shutter,.menu-route-shutter'));
 const before=await page.evaluate(()=>JSON.stringify({...localStorage}));
 await page.locator('[data-supply-preview-play]').click();await page.locator('.gx-root').waitFor();
 await page.locator('[data-act="fast"]').click();
 const deadline=Date.now()+60000;
 while(!await page.locator('.gx-actions [data-id="close"]').isVisible()){
   if(Date.now()>deadline)throw Error('10連の進行停止');
   await page.locator('.gx-root').click({position:{x:420,y:225}});await page.waitForTimeout(180);
 }
 const sources=await page.evaluate(()=>window.sounds);
 const oldSounds=sources.filter(s=>[17640,26460].includes(s.frames));
 const newSounds=sources.filter(s=>[18964,18082].includes(s.frames));
 if(expected==='old')expect(oldSounds.length).toBeGreaterThan(0);
 else{expect(newSounds).toHaveLength(8);expect(newSounds.every(s=>s.rate===1)).toBe(true);expect(oldSounds).toHaveLength(0);}
 expect(errors).toHaveLength(0);expect(await page.evaluate(()=>JSON.stringify({...localStorage}))).toBe(before);
 const report={expected,oldSounds,newSounds,errors,saveUnchanged:true,serviceWorkerControlled:true,passed:true};
 fs.writeFileSync(`${out}/${expected}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 await context.close();
}finally{await browser.close();}
