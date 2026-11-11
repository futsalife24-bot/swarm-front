import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
const site='https://swarm-front.melosalife-24.workers.dev';
const out='docs/evidence/supply-dev-preview-20261111/release';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11','--mute-audio']});
const rows=[];
try {
  for (const [width,height] of [[844,390],[640,360]]) {
    const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'});
    const page=await context.newPage(); const errors=[],supply=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/supply/'))supply.push(r.method());});
    const session=await context.request.get(site+'/api/developer/session');
    expect(session.ok()).toBe(true); expect((await session.json()).authenticated).toBe(false);
    await page.goto(site+'/?developer=1&base=1',{waitUntil:'domcontentloaded',timeout:120000});
    await expect(page.locator('#developer-login')).toBeVisible({timeout:30000});
    await expect(page.locator('[data-supply-preview-select]')).toHaveCount(0);
    await expect(page.locator('.gx-root')).toHaveCount(0);
    expect(supply).toHaveLength(0); expect(errors).toHaveLength(0);
    await page.screenshot({path:`${out}/${width}-public-auth-gate.png`});
    rows.push({width,height,loginRequired:true,previewAbsent:true,supplyRequests:0,errors});
    await context.close();
  }
  fs.writeFileSync(`${out}/public-gate.json`,JSON.stringify({site,checkedAt:new Date().toISOString(),passed:true,rows},null,2));
  console.log(JSON.stringify({passed:true,viewports:rows.length}));
} finally { await browser.close(); }
