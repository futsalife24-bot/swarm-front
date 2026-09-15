import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.WEAPON_SITE || 'http://127.0.0.1:5219';
const browser = await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
mkdirSync('dist-validation/effect-none',{recursive:true});
try {
 for (const [width,height] of [[1280,582],[915,412]]) {
  const page=await browser.newPage({viewport:{width,height},hasTouch:true});
  await page.goto(base);
  await page.evaluate(()=>{
   const inventory=[['rifle','none'],['shotgun','quick'],['rocket','quick'],['shotgun','pierce'],['rifle','pierce'],['rocket','chain'],['rifle','reserve'],['shotgun','repel']].map(([kind,effect],i)=>({id:`case-${i}`,kind,effect,rarity:1,power:1,rolls:{reload:1,mag:1,range:1,rate:1}}));
   localStorage.setItem('swarm-front-save-v1',JSON.stringify({version:1,inventory,equipped:['case-0','case-4'],sensitivity:1,volume:0,quality:1,receipts:[]}));
  });
  await page.reload(); await page.locator('#solo').click();
  for(let i=0;i<4;i++) {
   const cell=page.locator(`[data-equip="case-${i}"] [data-stat="effect"]`);
   assert.equal(await cell.locator('b').innerText(),'ー');
   assert.equal(await cell.locator('button,[tabindex]').count(),0);
   const before=await page.locator('.loadout').count() ? await page.locator('.loadout').innerText() : await page.evaluate(()=>localStorage.getItem('swarm-front-save-v1'));
   await cell.tap();
   assert.equal(await page.locator('dialog').count(),0);
   const after=await page.locator('.loadout').count() ? await page.locator('.loadout').innerText() : await page.evaluate(()=>localStorage.getItem('swarm-front-save-v1'));
   assert.equal(after,before);
  }
  const reload=await page.locator('[data-equip="case-1"] [data-stat="load"]').last().innerText();
  assert.ok(reload.includes('1.68s'),reload);
  for(const effect of ['pierce','chain','reserve','repel']) {
   await page.locator(`[data-effect-help="${effect}"]`).tap();
   assert.equal(await page.locator('dialog[open]').count(),1);
   await page.getByRole('button',{name:'閉じる',exact:true}).tap();
  }
  await page.screenshot({path:`dist-validation/effect-none/${base.startsWith('https')?'published':'local'}-${width}.png`});
  await page.locator('[data-equip="case-2"] .weapon-identity').tap();
  assert.equal(await page.locator('[data-equip="case-2"] .equipped-flag').count(),1);
  await page.locator('#gear-armory').click();
  for(let i=0;i<4;i++) {
   await page.locator(`[data-armory-select="case-${i}"]`).click();
   assert.equal(await page.locator('.armory-effect [data-no-effect]').innerText(),'ー');
  }
  results.push({width,height,pass:true,reload}); await page.close();
 }
 writeFileSync(`dist-validation/effect-none/${base.startsWith('https')?'published':'local'}.json`,JSON.stringify(results,null,2));
 console.log('PASS',base,results);
} finally {await browser.close();}


