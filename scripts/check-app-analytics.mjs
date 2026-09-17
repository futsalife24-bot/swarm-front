import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const base = process.env.ANALYTICS_TEST_BASE ?? 'http://127.0.0.1:8794';
const out = 'docs/evidence/app-analytics';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results=[];
try {
  const context = await browser.newContext({ viewport: {width:390,height:844}, isMobile:true, hasTouch:true, serviceWorkers:'block' });
  const request=context.request;
  assert.equal((await request.get(base+'/api/developer/apps')).status(),401);
  assert.equal((await request.get(base+'/api/developer/apps',{headers:{Origin:'https://futsalife24-bot.github.io'}})).status(),403);
  for (const app of ['lmfdb','katamon']) {
    assert.equal((await request.post(base+'/api/analytics/collect/'+app,{headers:{Origin:'https://evil.example'},data:{visitor:null}})).status(),403);
    assert.equal((await request.post(base+'/api/analytics/collect/'+app,{headers:{Origin:'https://futsalife24-bot.github.io'},data:'x'.repeat(513)})).status(),400);
  }
  assert.equal((await request.get(base+'/api/analytics/collect/lmfdb',{headers:{Origin:'https://futsalife24-bot.github.io'}})).status(),405);
  results.push('Unauthenticated read, foreign-origin admin access, foreign collector origin, oversized body and wrong method rejected');
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/admin/');await page.locator('#login').waitFor({state:'visible'});
  await page.locator('#pw').fill('local-analytics-test-only');await page.locator('#go').click();await page.locator('#app').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelectorAll('.card').length===4);
  await page.screenshot({path:out+'/390-empty.png',fullPage:true});
  const before=await (await request.get(base+'/api/developer/apps?days=1')).json();
  const beforeApp=id=>before.apps.find(a=>a.id===id);
  const visitor=crypto.randomUUID().replaceAll('-','');
  for(let i=0;i<2;i++)assert.equal((await request.post(base+'/api/analytics/collect/lmfdb',{headers:{Origin:'https://futsalife24-bot.github.io'},data:{visitor}})).status(),200);
  assert.equal((await request.post(base+'/api/analytics/collect/katamon',{headers:{Origin:'https://futsalife24-bot.github.io'},data:{visitor:null}})).status(),200);
  assert.equal((await request.post(base+'/api/analytics/collect/mayoi',{headers:{Origin:'https://mossline-bastion.melosalife-24.chatgpt.site'},data:{visitor}})).status(),200);
  assert.equal((await request.post(base+'/api/analytics/collect/mayoi',{headers:{Origin:'https://futsalife24-bot.github.io'},data:{visitor}})).status(),403);
  assert.equal((await request.post(base+'/api/analytics/event',{data:{kind:'view',visitor}})).status(),200);
  assert.equal((await request.post(base+'/api/analytics/event',{data:{kind:'sortie',visitor}})).status(),200);
  const afterResponse=await request.get(base+'/api/developer/apps?days=1');assert.equal(afterResponse.headers()['cache-control'],'no-store');
  const after=await afterResponse.json();const afterApp=id=>after.apps.find(a=>a.id===id);
  assert.equal(afterApp('lmfdb').totals.views,(beforeApp('lmfdb').totals?.views??0)+2);
  assert.equal(afterApp('lmfdb').totals.visitors,(beforeApp('lmfdb').totals?.visitors??0)+1);
  assert.equal(afterApp('katamon').totals.views,(beforeApp('katamon').totals?.views??0)+1);
  assert.equal(afterApp('katamon').totals.visitors,beforeApp('katamon').totals?.visitors??0);
  assert.equal(afterApp('mayoi').totals.views,(beforeApp('mayoi').totals?.views??0)+1);
  assert.equal(afterApp('swarm-front').totals.sorties,(beforeApp('swarm-front').totals?.sorties??0)+1);
  assert.ok(!JSON.stringify(after).includes(visitor));
  assert.equal((await request.get(base+'/api/developer/apps?days=999')).status(),400);
  results.push('Real local Worker/SQLite persistence, daily browser dedup, anonymous views, app isolation, legacy Swarm data and no identity disclosure');
  for (const width of [320,390,768]) {
    await page.setViewportSize({width,height:844});await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#cards').getAttribute('aria-busy')==='false');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.equal(await page.locator('.card').count(),4);
    await page.screenshot({path:out+'/'+width+'-dashboard.png',fullPage:true});
  }
  for (const days of ['1','30','7']) {await page.locator('#period').selectOption(days);await page.waitForFunction(()=>document.querySelector('#cards').getAttribute('aria-busy')==='false');assert.equal(await page.locator('.card').first().locator('.detail-row').count(),Number(days));}
  await page.locator('.card').first().locator('summary').click();assert.ok(await page.locator('.card').first().locator('details').getAttribute('open')!==null);
  results.push('320/390/768 widths without horizontal overflow; 1/7/30 day selection and details');
  await page.route('**/api/developer/apps?*',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#msg').textContent.includes('取得に失敗'));assert.equal(await page.locator('.card').count(),0);await page.unroute('**/api/developer/apps?*');await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelectorAll('.card').length===4);
  await page.locator('#out').click();await page.locator('#login').waitFor({state:'visible'});assert.equal((await request.get(base+'/api/developer/apps')).status(),401);assert.deepEqual(errors,[]);
  results.push('Failed refresh clears stale data; retry succeeds; logout revokes access; no browser JS errors');
  // Execute the exact added client snippets at their public origin, routing collection ONLY to localhost.
  for (const [id, file, url] of [['lmfdb','../lmfdb/ux/index.html','https://futsalife24-bot.github.io/lMfDB/ux/'],['katamon','../katamon/index.html','https://futsalife24-bot.github.io/katamon/'],['mayoi','../mayoi/dist/index.html','https://mossline-bastion.melosalife-24.chatgpt.site/']]) {
    const html=await readFile(file,'utf8');const snippet=html.match(/<!-- Anonymous daily access counts[\s\S]*?<script>([\s\S]*?)<\/script>/)[1];
    const c=await browser.newContext({serviceWorkers:'block'});const p=await c.newPage();let calls=0;let storedId;const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.route(url+'**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body>Test<script>'+snippet+'</script></body></html>'}));
    await p.route('https://swarm-front.melosalife-24.workers.dev/api/analytics/collect/'+id,async r=>{calls++;assert.equal(r.request().headers().cookie,undefined);assert.equal(r.request().headers().referer,undefined);const body=r.request().postDataJSON();if(storedId)assert.equal(body.visitor,storedId);storedId=body.visitor;const res=await r.fetch({url:base+'/api/analytics/collect/'+id});await r.fulfill({response:res});});
    await p.goto(url);await p.waitForFunction(()=>document.visibilityState==='visible');await p.waitForTimeout(250);assert.equal(calls,1);await p.reload();await p.waitForTimeout(250);assert.equal(calls,2);
    await p.goto(url+'?developer=1');await p.waitForTimeout(100);assert.equal(calls,2);
    await p.goto(url+'?analytics=off');await p.waitForTimeout(100);assert.equal(calls,2);
    await p.unroute('https://swarm-front.melosalife-24.workers.dev/api/analytics/collect/'+id);await p.route('https://swarm-front.melosalife-24.workers.dev/**',r=>r.abort());await p.goto(url);await p.waitForTimeout(100);assert.deepEqual(errs,[]);
    await c.close();
  }
  results.push('Exact LMF/katamon/mayoi client scripts: page counting, stable browser ID, developer/opt-out exclusion, no cookies/referrer, failed collection nonfatal (all traffic intercepted locally)');
  await context.close();
  await writeFile(out+'/results.json',JSON.stringify({passed:results,physicalDevice:false,production:false},null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
