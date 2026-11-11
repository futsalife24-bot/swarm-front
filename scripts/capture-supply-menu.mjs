import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
const origin=process.env.SUPPLY_SITE||'http://127.0.0.1:8796';
const out='docs/evidence/supply-kakutei-20261111/game';
const privateState='dist-validation/supply-menu-browser.json';
fs.mkdirSync('dist-validation',{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11','--mute-audio']});
try {
  const context=await browser.newContext({viewport:{width:844,height:390},serviceWorkers:'block',
    ...(fs.existsSync(privateState)?{storageState:privateState}:{})});
  const page=await context.newPage(); page.setDefaultTimeout(60000);
  const tap=async selector=>{
    await page.waitForFunction(()=>!document.querySelector('.split-shutter,.menu-route-shutter'));
    await page.locator(selector).click();
  };
  await page.addInitScript(()=>localStorage.setItem('swarm-front-player-name-v1','補給画面確認'));
  await page.goto(origin+'/?base=1');
  if(!fs.existsSync(privateState)) {
    await tap('#pt-confirm');
    if(!await page.locator('#pt-base-buddy').count()) await tap('#pt-base');
    await tap('#pt-base-buddy');
    await page.waitForTimeout(1200);
    await tap('[data-bd="starter-pick"][data-id="tatara"]');
    await expect(page.locator('[data-bd="starter-confirm"]')).toBeEnabled();
    await tap('[data-bd="starter-confirm"]');
    await tap('#pt-base');
  }
  await tap('#pt-base-supply');
  await expect(page.locator('[data-supply-count]')).not.toHaveText('確認中…');
  for(const [width,height] of [[844,390],[640,360]]) {
    await page.setViewportSize({width,height});
    await page.waitForTimeout(1600);
    await expect(page.locator('.supply-menu')).toBeVisible();
    await page.screenshot({path:`${out}/${width}-menu-stable.png`});
  }
  await context.storageState({path:privateState});
  console.log(JSON.stringify({screens:2,credentials:'ローカル検証用保管・証拠へ出力せず'}));
} finally {await browser.close();}
