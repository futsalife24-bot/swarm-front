import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base='https://swarm-front.melosalife-24.workers.dev';
const vite=await createServer({server:{middlewareMode:true}});
const {fresh,SAVE_KEY}=await vite.ssrLoadModule('/src/client/save.ts');
const original=fresh();await vite.close();
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const checks=[],errors=[];
try {
  for(const [width,height,equipped] of [[667,375,[0,1]],[915,412,[2,0]]]) {
    const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,serviceWorkers:'block'});
    const save=structuredClone(original);save.equipped=equipped.map(i=>save.inventory[i].id);
    await context.addInitScript(({key,save,base})=>{if(location.origin!==base)return;if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(save));},{key:SAVE_KEY,save,base});
    const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);
    const html=readFileSync('dist/index.html','utf8'),hashes={};
    for(const path of [html.match(/src="([^"]+\.js)"/)[1],html.match(/href="([^"]+\.css)"/)[1]]) {
      const response=await page.request.get(base+path);assert.equal(response.status(),200);
      const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
      hashes[path]=sha(await response.body());assert.equal(hashes[path],sha(readFileSync('dist'+path)));
    }
    await page.locator('#solo').tap();await page.locator('#launch').tap();
    for(let slot=0;slot<2;slot++) {
      if(slot) {await page.locator('#swap').tap();await page.waitForTimeout(750);}
      await page.waitForFunction(()=>!document.querySelector('#scope').disabled);
      await page.locator('#scope').tap();await page.waitForFunction(()=>document.querySelector('#scope').getAttribute('aria-pressed')==='true');
      assert.equal(await page.locator('#scope-overlay').isVisible(),true);
      assert.equal(await page.locator('#scope').evaluate(el=>getComputedStyle(el).webkitUserSelect),'none');
      await page.waitForTimeout(180);
      await page.screenshot({path:`dist-validation/aim-scope/published-${width}-${equipped[slot]}.png`});
      await page.locator('#pause').tap();await page.waitForFunction(()=>document.querySelector('#scope-overlay').hidden);
      await page.locator('#pause-resume').tap();
      await page.locator('#scope').tap();await page.waitForFunction(()=>document.querySelector('#scope').getAttribute('aria-pressed')==='true');
      // Native focus loss must release zoom and held touch input.
      await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
      await page.waitForFunction(()=>document.querySelector('#scope-overlay').hidden);
    }
    await page.locator('#pause').tap();await page.locator('#pause-leave').tap();await page.locator('#pause-quit').tap();
    assert.equal(await page.locator('#scope').isVisible(),false);
    const health=await page.request.get(base+'/api/health');assert.equal(health.status(),200);assert.equal((await health.json()).ok,true);
    checks.push({width,height,weapons:equipped.map(i=>save.inventory[i].kind),hashes,pass:true});
    await page.goto('about:blank');await context.close();console.log('PUBLISHED PASS',width,equipped);
  }
  assert.deepEqual(errors,[]);
  writeFileSync('dist-validation/aim-scope/published.json',JSON.stringify({base,checks,errors,pass:true},null,2));
}finally{await browser.close();}
