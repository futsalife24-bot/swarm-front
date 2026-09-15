import { chromium } from '@playwright/test';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const url='https://swarm-front.melosalife-24.workers.dev', dir='dist-validation/mecha-design/live';mkdirSync(dir,{recursive:true});
const expected=readFileSync('dist/index.html','utf8').match(/src="([^"]+\.js)"/)[1];
const hash=data=>createHash('sha256').update(data).digest('hex');
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const results=[];
try{for(const [width,height] of [[1280,720],[844,390]]){
const context=await browser.newContext({viewport:{width,height}});
await context.addInitScript(()=>{const inventory=['rifle','rocket'].map(kind=>({id:'check-'+kind,kind,effect:'none',rarity:0,power:1}));localStorage.setItem('swarm-front-save-v1',JSON.stringify({version:1,inventory,equipped:inventory.map(w=>w.id),volume:0,sensitivity:1,quality:1,receipts:[]}));});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
assert.equal((await page.goto(url)).status(),200);assert.equal(await page.locator('script[type="module"]').getAttribute('src'),expected);
const asset=await page.request.get(url+expected);assert.equal(asset.status(),200);assert.equal(hash(await asset.body()),hash(readFileSync('dist'+expected)));
await page.getByRole('button',{name:/ソロで出撃準備/}).click();await page.locator('#launch').click();await page.locator('.hud-rail').waitFor();
await page.mouse.move(width/2,height/2);await page.mouse.down();await page.waitForTimeout(800);await page.screenshot({path:`${dir}/${width}-rifle.png`});await page.mouse.up();
await page.keyboard.press('KeyQ');await page.waitForTimeout(300);assert((await page.locator('.weapon-hud > span').innerText()).includes('2/2'));
await page.mouse.down();await page.waitForTimeout(1400);await page.screenshot({path:`${dir}/${width}-rocket.png`});await page.mouse.up();
const health=await page.request.get(url+'/api/health');assert.equal(health.status(),200);assert.equal((await health.json()).ok,true);assert.deepEqual(errors,[]);
results.push({width,height,script:expected,assetSha256:hash(await asset.body()),soloStarted:true,rifleAndRocketFired:true,health:200,errors});await context.close();
}writeFileSync(dir+'/result.json',JSON.stringify({url,time:new Date().toISOString(),results},null,2));console.log(results);
}finally{await browser.close()}


