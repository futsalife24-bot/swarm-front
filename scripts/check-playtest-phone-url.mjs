import {chromium} from '@playwright/test';
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const out='dist-validation/playtest-ui-restore',published='dist-validation/playtest-v1/published',base=fs.readFileSync(published+'/tunnel.err.log','utf8').match(/https:\/\/[-a-z0-9]+\.trycloudflare\.com/)[0],url=base+'/?playtest=1';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
 const r=await page.goto(url);assert.equal(r.status(),200);
 await page.locator('#solo').tap();await page.locator('#pt-confirm').tap();await page.locator('#pt-start').tap();
 await page.locator('#pt-enter').waitFor({state:'visible',timeout:90000});await page.screenshot({path:out+'/phone-load.png'});await page.locator('#pt-enter').tap();await page.locator('#pt-tutorial-skip').tap();
 await page.waitForTimeout(700);if(await page.locator('#pt-intro-skip').count())await page.locator('#pt-intro-skip').tap();await page.waitForTimeout(600);
 assert.equal(await page.locator('.vital-number b').innerText(),'160 / 160');assert.equal(await page.evaluate(()=>typeof window.__playtest),'undefined');
 await page.screenshot({path:out+'/phone-battle.png'});
 await page.locator('#pause').tap();await page.locator('#pt-resume').waitFor();
 const hash=b=>createHash('sha256').update(b).digest('hex'),paths=['/index.html',...fs.readdirSync('dist/assets').filter(p=>/\.(js|css)$/.test(p)).map(p=>'/assets/'+p),'/assets/weapons/progression-v1/rifle_0.glb'];const assets=[];
 for(const p of paths){const response=await fetch(base+p);assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(hash(bytes),hash(fs.readFileSync('dist'+p)));assets.push({path:p,bytes:bytes.length,sha256:hash(bytes)});}
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/phone-url.json',JSON.stringify({date:new Date().toISOString(),url,ready:true,battle:true,touchMenu:true,paused:true,errors,assets,temporary:true,serverPid:Number(fs.readFileSync(published+'/preview.pid','utf8').trim()),tunnelPid:Number(fs.readFileSync(published+'/tunnel.pid','utf8').trim())},null,2));console.log('PASS mobile-sized touch launch, battle, pause, assets: '+url);
}finally{await browser.close();}
