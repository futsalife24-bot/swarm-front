import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const url = process.env.BESTIARY_URL || 'http://127.0.0.1:5337';
const dir = `dist-validation/enemy-report/${url.includes('127.0.0.1') ? 'local' : 'live'}`;
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const results = [];
try {
 for (const [width,height] of [[1280,720],[740,360],[844,390],[667,300]]) {
  const page = await browser.newPage({ viewport: {width,height}, hasTouch: true });
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  const titleFit=await page.locator('#ui').evaluate(e=>({h:e.clientHeight,sh:e.scrollHeight,w:e.clientWidth,sw:e.scrollWidth}));
  assert.ok(titleFit.sh<=titleFit.h+1 && titleFit.sw<=titleFit.w+1,JSON.stringify(titleFit));
  await page.screenshot({path:`${dir}/title-${width}.png`});
  await page.locator('#open-bestiary').click();
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('heading',{name:'エネミーレポート',exact:true}).waitFor();
  assert.equal(await dialog.locator('[data-enemy]').count(),6);
  await dialog.locator('canvas').waitFor();
  await page.waitForTimeout(200);
  for(const key of ['ant','spider','crawler','spitter','hornet','boss']) {
   await dialog.locator(`[data-enemy="${key}"]`).click();
   assert.equal(await dialog.locator(`[data-enemy="${key}"]`).getAttribute('aria-pressed'),'true');
   assert.equal(await dialog.locator('dl').count(),0);
   assert.match(await dialog.locator('article').innerText(),/攻撃方法/);
   assert.match(await dialog.locator('article').innerText(),/移動方法/);
   assert.doesNotMatch(await dialog.locator('article').innerText(),/[0-9０-９]|ステージ|基本HP|基本攻撃力|通常速度/);
   if(width===1280) await page.screenshot({path:`${dir}/${key}.png`});
  }
  await dialog.locator('[data-worm="true"]').click();
  await page.screenshot({path:`${dir}/worm-${width}.png`});
  const canvas=dialog.locator('canvas');
  const before=await canvas.screenshot();
  const box=await canvas.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down(); await page.mouse.move(box.x+box.width/2+50,box.y+box.height/2+15,{steps:8}); await page.mouse.up();
  assert.notDeepEqual(await canvas.screenshot(),before);
  if(width===740) {
   const cdp=await page.context().newCDPSession(page);
   const shot=await canvas.screenshot();
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width/2+45,y:box.y+box.height/2+10}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   assert.notDeepEqual(await canvas.screenshot(),shot);
   await cdp.detach();
  }
  await dialog.getByRole('button',{name:'視点リセット',exact:true}).click();
  const fit=await dialog.evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,w:e.clientWidth,sw:e.scrollWidth};});
  assert.ok(fit.top>=0&&fit.bottom<=height&&fit.sw<=fit.w+1,JSON.stringify(fit));
  await dialog.getByRole('button',{name:'タイトルへ戻る',exact:true}).click();
  assert.equal(await page.getByRole('dialog').count(),0);
  assert.equal(await page.locator('#open-bestiary').evaluate(e=>e===document.activeElement),true);
  await page.locator('#open-bestiary').click(); await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(),0);
  // Optional PWA install action must fit too.
  await page.locator('.title-actions').evaluate(e=>{const b=document.createElement('button'); b.id='install';b.textContent='ホーム画面に追加';e.append(b);});
  assert.equal(await page.locator('#ui').evaluate(e=>e.scrollHeight<=e.clientHeight+1),true);
  await page.locator('#solo').click();
  await page.getByRole('heading',{name:'出撃準備',exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  results.push({width,height,titleFit,fit,dragChangedPixels:true,errors});
  await page.close();
 }
 const page=await browser.newPage();
 for(const [,asset] of readFileSync('dist/index.html','utf8').matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)) {
  const response=await page.request.get(url+asset); assert.equal(response.status(),200);
  const hash=b=>createHash('sha256').update(b).digest('hex');
  assert.equal(hash(await response.body()),hash(readFileSync('dist'+asset)));
 }
 writeFileSync(`${dir}/result.json`,JSON.stringify({url,results,assetsMatch:true},null,2));
 console.log(JSON.stringify(results));
} finally {await browser.close();}
