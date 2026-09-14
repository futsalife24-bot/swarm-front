import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base=process.env.REPORT_SITE||'http://127.0.0.1:5208',published=base.startsWith('https:');
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
 for(const [width,height] of [[1280,800],[915,412]]){
  const page=await browser.newPage({viewport:{width,height},serviceWorkers:'block',hasTouch:width===915});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('#open-bestiary').click();await page.waitForFunction(()=>document.querySelector('.enemy-viewport').dataset.asset==='ready');
  assert.equal(await page.locator('#view-reset,#rotate-left,#rotate-right,.viewer-tools').count(),0);
  const canvasHeight=await page.locator('.enemy-viewport').evaluate(e=>e.getBoundingClientRect().height);
  const before=JSON.parse(readFileSync('dist-validation/enemy-redesign/ui-checks.json','utf8')).ui.find(x=>x.size.width===width&&x.kind==='crawler').canvasHeight;
  assert.ok(canvasHeight>=before+35,`${canvasHeight} <= ${before}`);
  for(const mode of ['move','attack','idle']){await page.locator(`button[data-motion="${mode}"]`).click();assert.equal(await page.locator('.enemy-viewport').getAttribute('data-motion'),mode)}
  const canvas=page.locator('.enemy-viewport canvas'),a=await canvas.screenshot(),box=await canvas.boundingBox();
  await page.mouse.move(box.x+box.width*.45,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.5,{steps:8});await page.mouse.up();
  assert.ok(!a.equals(await canvas.screenshot()));
  await page.screenshot({path:`dist-validation/report-space/${published?'published':'local'}-${width}.png`});
  const hashes={};if(published){const html=readFileSync('dist/index.html','utf8');for(const path of [html.match(/src="([^"]+\.js)"/)[1],html.match(/href="([^"]+\.css)"/)[1]]){const r=await page.request.get(base+path);assert.equal(r.status(),200);const sha=b=>createHash('sha256').update(b).digest('hex');hashes[path]=sha(await r.body());assert.equal(hashes[path],sha(readFileSync('dist'+path)))}}
  await page.locator('#report-close').click();assert.deepEqual(errors,[]);results.push({width,height,before,canvasHeight,gain:canvasHeight-before,errors,hashes});await page.close();
 }
 writeFileSync(`dist-validation/report-space/${published?'published':'local'}-checks.json`,JSON.stringify({pass:true,results},null,2));console.log(JSON.stringify({pass:true,results}));
}finally{await browser.close()}
