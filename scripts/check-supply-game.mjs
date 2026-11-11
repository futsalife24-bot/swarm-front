import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
const origin=process.env.SUPPLY_SITE||'http://127.0.0.1:8796';
const out=process.env.SUPPLY_OUTPUT||'docs/evidence/supply-kakutei-20261111/game';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11','--mute-audio']});
const report=[],errors=[];
let page;
try {
  for(const [width,height] of [[844,390],[640,360]]) {
    const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'});
    page=await context.newPage();page.setDefaultTimeout(60000);
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>localStorage.setItem('swarm-front-player-name-v1','補給検証'));
    const tap=async selector=>{
      await page.waitForFunction(()=>!document.querySelector('.split-shutter,.menu-route-shutter'));
      await page.locator(selector).click();
    };
    await page.goto(origin+'/?base=1',{waitUntil:'domcontentloaded',timeout:120000});
    await page.locator('#pt-confirm').waitFor({state:'visible',timeout:30000});
    await tap('#pt-confirm');
    if(!await page.locator('#pt-base-buddy').count()) await tap('#pt-base');
    await page.locator('#pt-base-buddy').waitFor();await tap('#pt-base-buddy');
    await tap('[data-bd="starter-pick"][data-id="tatara"]');
    await tap('[data-bd="starter-confirm"]');
    await tap('#pt-base');await tap('#pt-base-supply');
    await expect(page.locator('[data-supply-count]')).toHaveText('10枚');
    await page.screenshot({path:`${out}/${width}-menu.png`});
    await tap('[data-supply-draw="10"]');
    await expect(page.locator('.gx-root')).toBeVisible();
    const first=await page.evaluate(()=>{
      const s=JSON.parse(localStorage.getItem('swarm-front-shared-progress-v3'));
      return {receipts:s.receipts.filter(id=>id.startsWith('supply:')),weapons:[...s.inventory,...s.pending].map(w=>w.id),powder:s.powder};
    });
    expect(first.receipts).toHaveLength(1);
    await page.screenshot({path:`${out}/${width}-reveal.png`});
    // 演出の途中で再読込み。サーバーの同じ結果と保存済み受領書から再開する。
    await page.goto(origin+'/?base=1',{waitUntil:'domcontentloaded',timeout:120000});
    await tap('#pt-base-supply');
    await expect(page.locator('[data-supply-count]')).toHaveText('0枚');
    await expect(page.locator('[data-supply-recover]')).toBeVisible();
    await tap('[data-supply-recover]');
    await expect(page.locator('.gx-root')).toBeVisible();
    await tap('.gx-skip');
    await expect(page.locator('.gx-actions button[data-id="close"]')).toBeVisible();
    await page.screenshot({path:`${out}/${width}-results.png`});
    await tap('.gx-actions button[data-id="close"]');
    await expect(page.locator('[data-supply-feedback]')).toHaveText('補給を受領しました。');
    await expect(page.locator('[data-supply-recover]')).toBeHidden();
    const end=await page.evaluate(()=>{
      const s=JSON.parse(localStorage.getItem('swarm-front-shared-progress-v3'));
      return {receipts:s.receipts.filter(id=>id.startsWith('supply:')),weapons:[...s.inventory,...s.pending].map(w=>w.id),powder:s.powder};
    });
    expect(end).toEqual(first);
    await tap('#pt-base');
    await expect(page.locator('.gx-root')).toHaveCount(0);
    report.push({width,height,ten:true,reloadRecover:true,skip:true,ack:true,noDuplicate:true});
    await context.close();
  }
  if(errors.length) throw Error(JSON.stringify(errors));
  fs.writeFileSync(`${out}/results.json`,JSON.stringify({origin,report,errors},null,2));
  console.log(JSON.stringify({checks:report,errors}));
} catch(error) {
  if(page&&!page.isClosed()) await page.screenshot({path:`${out}/failure.png`});
  throw error;
} finally { await browser.close(); }
