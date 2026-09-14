import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.MENU_SITE||'http://127.0.0.1:5354',out='dist-validation/menu-entry';
const browser=await chromium.launch({channel:'chrome'}),results=[];
try{
for(const path of ['/','/?playtest=1']) for(const [width,height] of [[640,360],[844,390],[1280,582]]){
const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto(base+path);await page.locator('#home-settings').waitFor();
assert.equal(await page.locator('#home-developer,#pt-menu-sample').count(),0);
const footer=await page.locator('#changelog').boundingBox();assert.ok(footer.x<width/4&&footer.y>height*.75);
await page.screenshot({path:`${out}/${base.startsWith('https')?'published':'built'}-${path==='/'?'main':'playtest'}-${width}-home.png`});
await page.locator('#changelog').click();await page.locator('.dialog-close').click();
await page.locator('#home-settings').click();const entry=page.locator('.settings-developer-entry');await entry.waitFor();
const box=await entry.boundingBox(),dialog=await page.locator('dialog[open]').boundingBox();assert.ok(box.x>dialog.x+dialog.width/2&&box.y+box.height<=dialog.y+dialog.height&&box.height<=36);
await page.screenshot({path:`${out}/${base.startsWith('https')?'published':'built'}-${path==='/'?'main':'playtest'}-${width}-settings.png`});
await entry.click();await page.locator('#developer-password').waitFor();
if(!base.startsWith('https')&&width===844){
const before=await page.evaluate(()=>JSON.stringify(localStorage));
await page.locator('#developer-password').fill('local-menu-check');await page.locator('#developer-login-submit').click();await page.locator('#pt-menu-sample').click();await page.locator('.gear-weapon-list').waitFor();assert.ok(page.url().includes('developer=1'));
await page.locator('#pt-armory').click();await page.locator('[data-genre]').first().click();await page.locator('.pt-armory-summary').waitFor();assert.match(await page.locator('.pt-armory-summary').innerText(),/通常 48丁/);
assert.equal(await page.evaluate(()=>JSON.stringify(localStorage)),before);
await page.locator('#pt-home').click();await page.locator('#pt-developer-exit').click();await page.locator('#home-settings').waitFor();
assert.equal(await page.evaluate(()=>JSON.stringify(localStorage)),before);
await page.goto(base+'/?playtest=1&menuSample=1');await page.locator('#home-settings').waitFor();assert.equal(await page.locator('.gear-weapon-list').count(),0);
}
assert.deepEqual(errors,[]);results.push({path,width,height,footer,entry:box,errors});await context.close();console.log('PASS',path,width);
}
fs.writeFileSync(`${out}/${base.startsWith('https')?'published':'built'}.json`,JSON.stringify(results,null,2));
}catch(e){for(const c of browser.contexts())for(const p of c.pages()){console.log('FAILED PAGE',p.url(),(await p.locator('body').innerText()).slice(0,2200));await p.screenshot({path:out+'/failure.png'});}throw e;}finally{await browser.close()}
