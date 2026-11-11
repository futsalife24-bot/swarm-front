// Actual local gear/detail/share UI with a disposable save, no share is sent.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import fs from 'node:fs/promises';

const out = 'dist-validation/weapon-detail-ui-matrix';
const kinds = ['rifle','smg','shotgun','slug','rocket','heavy','sniper','laser','grenade','sticky','kick','medic'];
const missing = [];
for (const [i, kind] of kinds.entries()) {
  const dir = ['rifle','shotgun','rocket'].includes(kind) ? 'realism-v2' : 'unique-v1';
  try { await fs.access(`public/assets/weapons/${dir}/${kind}_${i % 5}.glb`); }
  catch { missing.push(kind); }
}
await fs.mkdir(out, {recursive:true});
const source = `import {freshProgress,validateProgress,newSaveKey} from './src/client/progression-save.ts';
import {makeWeapon} from './src/shared/progression.ts';
const save=freshProgress('normal');
for (const [i,kind] of ${JSON.stringify(kinds.filter(k=>!missing.includes(k)))}.entries()) {
  const grade=${JSON.stringify(kinds)}.indexOf(kind)%5;
  save.inventory.push(makeWeapon('fixture-'+kind,kind,grade,{power:0,reload:0,range:0,rate:0},false,save.serial++));
}
save.tutorials=['gear','armory','base','battle','combat']; save.armoryMigration=1;
export const key=newSaveKey('normal'),raw=JSON.stringify(validateProgress(save));`;
await build({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'detail-fixture.js'},bundle:true,format:'esm',platform:'node',packages:'external',outfile:out+'/fixture-save.mjs',define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'}});
const fixture=await import('../'+out+'/fixture-save.mjs');
const server=await createServer({configFile:false,define:{__SWARM_BUILD__:JSON.stringify('local-review'),__AUTO_CHANGELOG__:JSON.stringify([])},server:{host:'127.0.0.1',port:0,hmr:false,watch:{ignored:['**/dist-validation/**','**/design/**','**/public/**']}},optimizeDeps:{noDiscovery:true,include:[]}});
let browser,page,stage='起動';
const rows=[],errors=[],failedRequests=[];
try {
  await server.listen();
  browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
  page=await browser.newPage({viewport:{width:844,height:390},serviceWorkers:'block'});
  page.on('pageerror', e=>errors.push(e.message));
  page.on('response', r=>{if(r.url().includes('/assets/weapons/')&&!r.ok()) failedRequests.push({url:r.url(),status:r.status()});});
  await page.addInitScript(({key,raw})=>{localStorage.setItem(key,raw);localStorage.setItem('swarm-front-player-name-v1','ローカル検証');},{key:fixture.key,raw:fixture.raw});
  await page.goto('http://127.0.0.1:'+server.httpServer.address().port+'/?solo=1',{waitUntil:'domcontentloaded',timeout:50000});
  await page.locator('#pt-start').waitFor({state:'visible',timeout:90000});
  for (const kind of kinds.filter(k=>!missing.includes(k))) {
    stage=kind+' 詳細';
    // Screen-transition snapshots contain cloned UI in shadow roots; target the live document only.
    const row=page.locator(`css:light=[data-row="fixture-${kind}"] [data-detail]`);
    await row.click(); // Equip from the gear list.
    await page.waitForFunction(()=>!document.querySelector('.split-shutter'));
    await page.locator(`css:light=[data-row="fixture-${kind}"] [data-detail]`).click(); // Open equipped weapon.
    const detail=page.locator('css:light=dialog.weapon-detail-dialog[open]');
    await detail.waitFor({state:'visible',timeout:30000});
    await detail.locator('#pt-weapon-preview canvas').waitFor({state:'visible',timeout:30000});
    await page.waitForFunction(()=>!document.querySelector('.split-shutter'));
    const title=await detail.locator('h2').innerText();
    await page.screenshot({path:`${out}/${kind}-detail.png`});
    stage=kind+' 共有画像';
    await detail.locator('#pt-share').click();
    const share=page.locator('css:light=dialog[open]').filter({has:page.locator('css:light=#share-close')});
    await share.waitFor({state:'visible',timeout:30000});
    await share.locator('img').evaluate(img=>img.decode());
    await page.waitForFunction(()=>!document.querySelector('.split-shutter'));
    const image=await share.locator('img').evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight,complete:img.complete}));
    if(image.width!==1200||image.height!==720||!image.complete) throw Error('共有画像が不正: '+JSON.stringify(image));
    await page.screenshot({path:`${out}/${kind}-share.png`});
    await share.locator('#share-close').click();
    await page.waitForFunction(()=>!document.querySelector('dialog[open] #share-close'),null,{timeout:5000});
    await page.waitForFunction(()=>!document.querySelector('.split-shutter'));
    await detail.locator('.dialog-close').click();
    await page.waitForFunction(()=>!document.querySelector('dialog.weapon-detail-dialog[open]'),null,{timeout:5000});
    await page.waitForFunction(()=>!document.querySelector('.split-shutter'));
    rows.push({kind,title,image});
    console.log('PASS',kind,title);
  }
  const report={scope:'Actual local gear, detail dialog and share-image dialog with isolated disposable save; no external sharing or real phone',viewport:[844,390],missing,rows,errors,failedRequests};
  await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));
  if(errors.length||failedRequests.length||(missing.length&&!process.argv.includes('--available')))process.exitCode=1;
} catch(error) {
  await fs.writeFile(out+'/failure.json',JSON.stringify({stage,error:String(error),rows,errors,failedRequests},null,2));
  if(page&&!page.isClosed())await page.screenshot({path:out+'/failure.png',timeout:5000}).catch(()=>{});
  throw error;
} finally { await browser?.close(); await server.close(); }
