import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base=process.env.ACCESS_SITE||'http://127.0.0.1:5354',published=base.startsWith('https'),label=published?'published':'local',out='dist-validation/developer-access';
const password=published ? fs.readFileSync(process.env.ACCESS_PASSWORD_FILE,'utf8').trim() : 'test-only-random-developer-password';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']}),rows=[];
const snapshot=page=>page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>/swarm-front.*(progression|save)/.test(k)).sort().map(k=>[k,localStorage.getItem(k)])));
try {
 for(const [source,width,height] of [['playtest',844,390],['main',1280,720]]) {
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+(source==='playtest'?'/?playtest=1':'/'));
  await page.locator('#home-developer').waitFor();await page.locator('h1').click();await page.waitForTimeout(400);
  if(source==='playtest') {
   await page.locator('#solo').click();await page.locator('#pt-confirm').click();await page.locator('#pt-home').click();
  } else {
   await page.locator('#home-settings').click();await page.locator('#volume').press('ArrowLeft');await page.locator('.dialog-close').click();
  }
  await page.evaluate(()=>localStorage.setItem('swarm-front-progression-v2-test','protected-test-sentinel'));
  const before=await snapshot(page);
  await page.screenshot({path:`${out}/${label}-${source}-home.png`});
  await page.locator('#home-developer').click();await page.locator('#developer-password').fill('wrong-password');await page.locator('#developer-login-submit').click();
  await page.locator('#developer-login-note').filter({hasText:'パスワードが違います'}).waitFor();
  assert.ok(!page.url().includes('developer=1'));
  await page.locator('#developer-password').fill(password);await page.locator('#developer-login-submit').click();
  await page.locator('#pt-developer-exit').waitFor({timeout:90000});
  assert.deepEqual(await snapshot(page),before);
  const cookies=await context.cookies();const auth=cookies.find(c=>c.name==='swarm_developer');assert.ok(auth?.httpOnly);if(published)assert.ok(auth.secure);
  await page.locator('#open-bestiary').click();await page.waitForFunction(()=>document.querySelector('.enemy-viewport')?.dataset.asset==='ready',null,{timeout:90000});
  assert.equal(await page.locator('[data-enemy] strong').filter({hasText:'？？？'}).count(),0);await page.locator('#report-close').click();
  await page.locator('#solo').click();await page.locator('[data-lock="developer-rifle-0"]').click();assert.equal(await page.locator('[data-lock="developer-rifle-0"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-row="developer-rifle-0"] [data-detail]').click();await page.locator('[data-pinned="developer-rifle-0"]').waitFor();
  assert.deepEqual(await snapshot(page),before);
  await page.reload();await page.locator('#solo').click();assert.equal(await page.locator('[data-lock="developer-rifle-0"]').getAttribute('aria-pressed'),'false');
  await page.locator('#pt-home').click();await page.screenshot({path:`${out}/${label}-${source}-developer.png`});await page.locator('#pt-developer-exit').click();
  await page.locator('#home-developer').waitFor();assert.ok(!page.url().includes('developer=1'));assert.equal(page.url().includes('playtest=1'),source==='playtest');
  assert.deepEqual(await snapshot(page),before);
  assert.equal((await (await context.request.get(base+'/api/developer/session')).json()).authenticated,false);
  await page.goto(base+'/?developer=1');await page.locator('#developer-login').waitFor();assert.equal(await page.locator('#pt-developer-exit').count(),0);
  await page.locator('#developer-login .dialog-close').click();assert.deepEqual(await snapshot(page),before);
  // Settings must expose the same password gate on the progression screen.
  await page.locator('#home-settings').click();await page.locator('[role="tab"]').filter({hasText:'保存データ'}).click();await page.locator('#pt-developer-entry').click();await page.locator('#developer-login').waitFor();await page.locator('#developer-login .dialog-close').click();
  assert.deepEqual(errors,[]);rows.push({source,width,height,wrongDenied:true,authenticated:true,cookieHttpOnly:true,unlocked:true,normalAndTestPreserved:true,devReloadReset:true,logoutRevoked:true,directUrlDenied:true,settingsEntry:true});await context.close();console.log('PASS',source,width);
 }
 const sha=b=>createHash('sha256').update(b).digest('hex'),assets=[];
 for(const p of ['index.html','sw.js',...fs.readdirSync('dist/assets').filter(p=>/\.(js|css)$/.test(p)).map(p=>'assets/'+p)]) {
  const r=await fetch(base+'/'+p);assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(sha(bytes),sha(fs.readFileSync('dist/'+p)));assert.ok(!bytes.includes(Buffer.from(password)));assets.push(p);
 }
 assert.equal((await (await fetch(base+'/api/health')).json()).ok,true);
 fs.writeFileSync(`${out}/${label}.json`,JSON.stringify({rows,assets,passwordAbsentFromAssets:true},null,2));console.log('PASS',label,assets.length,'hashes and password not shipped');
}finally{await browser.close()}
