// Isolated terminal-state fixtures exercise real result renderers, not admission or WS transport.
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
const origin = process.env.ORIGIN ?? 'http://127.0.0.1:5199';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw Error('Local fixture only');
const out = 'dist-validation/extra-reward-entries';
fs.mkdirSync(out, {recursive:true});
const browser = await chromium.launch({channel:'chrome', args:['--use-angle=d3d11']});
const records=[];
let page;
try {
  for (const mode of ['daily','legacy-coop']) {
    page = await browser.newPage({viewport:{width:568,height:320},hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});
    page.setDefaultTimeout(60000);
    await page.addInitScript(()=>localStorage.setItem('swarm-front-player-name-v1','結果入口検証'));
    await page.route('**/api/cloud/**',r=>r.abort());
    const source=mode==='daily'?'playtest-app':'main';
    await page.route(new RegExp(`/src/${mode==='daily'?'client/':''}${source}\\.ts(?:\\?.*)?$`),async route=>{
      const response=await route.fetch();
      const fixture=mode==='daily'?`
window.extraRewardFixture = async () => {
  const { freshProgress, loadProgress } = await import('/src/client/progression-save.ts');
  const { beginDefense } = await import('/src/shared/daily-rewards.ts');
  const run = 'local-daily-ui-fixture-20261107';
  mode='normal'; save=loadProgress('normal')??freshProgress('normal');
  save=beginDefense(save,'2026-11-07',run,()=>0.4);
  persistProgress(save);
  world=createWorld(run,1,1); world.phase='defeat'; world.reason='ローカル終了状態fixture';
  world.pending.solo=[]; world.defense={day:'2026-11-07',armory:{hp:0},maxHp:2000,duration:180,nextSpawn:0};
  setScreen('battle'); finishDaily(true);
};`:`
window.extraRewardFixture = async () => {
  const { initializeProgress } = await import('/src/client/progression-save.ts');
  initializeProgress('normal'); save=loadSharedCoopSave();
  myId='solo'; mode='coop';
  world=createWorld('local-coop-ui-fixture-20261107',1,1);
  world.phase='victory'; world.time=100; world.totalKills=10;
  world.rewards[myId]=[{id:'local-coop-ui-shotgun',kind:'shotgun',rarity:0,power:1,effect:'none'}];
  result();
};`;
      await route.fulfill({response,body:(await response.text())+fixture});
    });
    await page.goto(origin+(mode==='daily'?'/?solo=1':'/?coop=1'),{waitUntil:'commit',timeout:120000});
    await page.waitForFunction(()=>typeof window.extraRewardFixture==='function',null,{timeout:120000});
    await page.evaluate(()=>window.extraRewardFixture());
    console.log(mode, await page.locator('#ui').innerText());
    const name=page.locator('[data-detail]').first();
    await expect(name).toBeVisible();
    const id=await name.getAttribute('data-detail');
    await name.tap();
    await expect(page.locator('.weapon-detail-dialog[open]')).toBeVisible();
    await expect(page.locator('#pt-detail-lock')).toBeEnabled();
    await page.locator('#pt-weapon-preview canvas').waitFor();
    await page.screenshot({path:`${out}/${mode}-detail.png`});
    await page.locator('#pt-detail-lock').click();
    await expect(page.locator('.weapon-detail-dialog')).toHaveCount(0);
    await expect(page.locator(`[data-lock="${id}"]`)).toHaveAttribute('aria-pressed','true');
    const persisted=await page.evaluate(id=>JSON.parse(localStorage.getItem('swarm-front-shared-progress-v3')).locks.includes(id),id);
    expect(persisted).toBe(true);
    await page.screenshot({path:`${out}/${mode}-result.png`});
    await page.locator(mode==='daily'?'#pt-daily-home':'#regear').click();
    await expect(page.locator('[data-detail]')).toHaveCount(0);
    records.push({mode, terminalFixture:true, detailTap:true, lockPersisted:persisted, homeReturn:true, networkAdmissionVerified:false});
    await page.close();
    console.log(`${mode}: pass`);
  }
} catch(error) {
  if(page&&!page.isClosed()) await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});
  throw error;
} finally {
  fs.writeFileSync(`${out}/results.json`,JSON.stringify(records,null,2));
  await browser.close();
}
