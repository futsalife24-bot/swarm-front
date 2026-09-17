import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const out = 'dist-validation/weekly-title';
fs.mkdirSync(out,{recursive:true});
const browser = await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
const page = await browser.newPage({viewport:{width:844,height:390},serviceWorkers:'block'});
const errors = [], checks = [];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/cloud/**',async route=>{
  const req=route.request();
  const response=await route.fetch({url:'http://127.0.0.1:8793'+new URL(req.url()).pathname,headers:{...req.headers(),origin:'http://127.0.0.1:8793',host:'127.0.0.1:8793'}});
  await route.fulfill({response});
});
try {
  await page.goto('http://127.0.0.1:5197');
  if(await page.locator('#landscape-start').isVisible()) await page.locator('#landscape-start').click();
  const button = page.locator('#pt-weekly-missions'), badge=button.locator('.weekly-notification');
  await button.waitFor();
  assert.equal(await badge.isVisible(),false);
  await page.locator('#home-settings').click();
  assert.equal(await page.locator('dialog #pt-weekly-missions').count(),0);
  await page.getByRole('button',{name:'閉じる',exact:true}).click();
  // Seed earned progress, then exercise real cloud initialization and UI claims.
  await page.evaluate(async()=>{
    const p=await import('/src/client/progression-save.ts'), c=await import('/src/client/cloud-save.ts'), cal=await import('/src/shared/calendar.ts');
    const s=p.initializeProgress('normal');
    s.weekly={week:cal.japanWeek(Date.now()),campaign:Array.from({length:10},(_,i)=>'title-win-'+i),defense:['title-defense-1','title-defense-2','title-defense-3'],claimed:[]};
    p.persistProgress(s);
    await c.createCloudSave();
  });
  await page.waitForFunction(()=>document.querySelector('.weekly-notification')?.textContent==='3');
  for(const width of [1280,844,640]) {
    await page.setViewportSize({width,height:390});
    const geometry=await button.evaluate(b=>{
      const r=b.getBoundingClientRect(), n=b.querySelector('.weekly-notification').getBoundingClientRect(), hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      return {inside:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,badgeInside:n.x>=0&&n.y>=0&&n.right<=innerWidth&&n.bottom<=innerHeight,reachable:hit===b||b.contains(hit)};
    });
    assert.ok(Object.values(geometry).every(Boolean),JSON.stringify({width,geometry}));
    await page.screenshot({path:`${out}/title-${width}.png`});
    checks.push({width,...geometry});
  }
  await page.setViewportSize({width:844,height:390});
  for(const [id,remaining] of [['campaign-3',2],['campaign-10',1],['defense-3',0]]) {
    await button.click();
    await page.locator(`[data-weekly-id="${id}"]:enabled`).click();
    await page.waitForFunction(id=>document.querySelector(`[data-weekly-id="${id}"]`)?.textContent==='受取済み',id);
    assert.equal(await badge.textContent(),String(remaining));
    assert.equal(await badge.isVisible(),remaining>0);
    await page.getByRole('button',{name:'閉じる',exact:true}).click();
  }
  const coins=await page.evaluate(async()=> (await import('/src/client/progression-save.ts')).loadProgress('normal').coins);
  assert.equal(coins,800);
  await page.evaluate(async()=>{
    const p=await import('/src/client/progression-save.ts'), s=p.loadProgress('normal');
    s.weekly.claimed=[]; s.weekly.week='2026-01-05'; p.persistProgress(s);
  });
  assert.equal(await badge.isVisible(),false);
  await page.evaluate(async()=> (await import('/src/client/cloud-save.ts')).deleteCloudSave());
  assert.deepEqual(errors,[]);
  fs.writeFileSync(`${out}/checks.json`,JSON.stringify({pass:true,checks,claims:[3,2,1,0],coins,zeroHidden:true,previousWeekHidden:true,settingsEntryRemoved:true,errors},null,2));
  console.log('WEEKLY TITLE PASS');
} finally { await browser.close(); }
