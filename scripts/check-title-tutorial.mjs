import { chromium } from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const origin = process.env.BASE_ORIGIN || 'http://127.0.0.1:5362';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw Error('Local checks only');
const out = 'dist-validation/title-tutorial';
fs.mkdirSync(out, {recursive:true});
const browser = await chromium.launch({channel:'chrome'});
const results = [];
try {
  for (const [width,height] of [[1280,582],[844,390],[667,375]]) {
    const page = await browser.newPage({viewport:{width,height},serviceWorkers:'block'});
    const errors = []; page.on('pageerror', e=>errors.push(e.message));
    await page.goto(origin); await page.locator('#home-tutorial').waitFor({state:'visible'});
    const before = await page.evaluate(()=>localStorage.getItem('swarm-front-progression-v2-normal'));
    await page.screenshot({path:`${out}/${width}-title.png`});
    await page.locator('#home-tutorial').click();
    for (const [index,label] of ['各ページ','システム','進め方'].entries()) {
      await page.getByRole('tab',{name:label,exact:true}).click();
      assert.equal(await page.locator('[role=tabpanel]:visible').count(),1);
      assert.equal(await page.locator(`#tutorial-panel-${index}`).isVisible(),true);
      const layout = await page.locator('.tutorial-guide').evaluate(d=>{
        const r=d.getBoundingClientRect(),body=d.querySelector('.menu-dialog-body');
        return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,overflow:body.scrollWidth>body.clientWidth+1,
          tabs:[...d.querySelectorAll('[role=tab]')].map(t=>{const b=t.getBoundingClientRect();return {x:b.x,right:b.right,y:b.y,bottom:b.bottom};})};
      });
      assert.ok(layout.x>=0&&layout.y>=0&&layout.right<=width&&layout.bottom<=height);
      assert.ok(!layout.overflow);
      assert.ok(layout.tabs.every(t=>t.x>=0&&t.y>=0&&t.right<=width&&t.bottom<=height));
      await page.screenshot({path:`${out}/${width}-tab-${index}.png`});
      results.push({width,height,label,...layout});
    }
    await page.getByRole('tab',{name:'進め方',exact:true}).press('ArrowRight');
    assert.equal(await page.locator('#tutorial-tab-0').getAttribute('aria-selected'),'true');
    await page.locator('#tutorial-tab-0').press('End');
    assert.equal(await page.locator('#tutorial-tab-2').getAttribute('aria-selected'),'true');
    await page.keyboard.press('Escape'); await page.locator('.tutorial-guide').waitFor({state:'detached'});
    assert.equal(await page.locator('.tutorial-guide').count(),0);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'home-tutorial');
    assert.equal(await page.evaluate(()=>localStorage.getItem('swarm-front-progression-v2-normal')),before);
    await page.locator('#home-tutorial').click();
    assert.equal(await page.locator('#tutorial-tab-0').getAttribute('aria-selected'),'true');
    await page.getByRole('button',{name:'閉じる',exact:true}).click();
    await page.locator('#open-armory').click(); await page.locator('#pt-confirm').click();
    assert.equal(await page.locator('#home-tutorial').count(),0);
    await page.locator('#pt-home').click();
    const initialized = await page.evaluate(()=>localStorage.getItem('swarm-front-progression-v2-normal'));
    await page.locator('#home-tutorial').click(); await page.keyboard.press('Escape'); await page.locator('.tutorial-guide').waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>localStorage.getItem('swarm-front-progression-v2-normal')),initialized);
    assert.deepEqual(errors,[]); await page.close();
  }
  fs.writeFileSync(`${out}/checks.json`,JSON.stringify({results,keyboard:true,saveUnchanged:true,titleOnly:true,pageErrors:[]},null,2));
  console.log('PASS: 3 widths, 3 tabs, keyboard, focus return, title-only entry, new/existing save unchanged');
} finally { await browser.close(); }
