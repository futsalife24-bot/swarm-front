import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const origin=process.env.AIM_PUBLIC_ORIGIN || 'https://swarm-front.melosalife-24.workers.dev';
const out=process.env.AIM_PUBLIC_OUTPUT || 'dist-validation/pr163/published';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
const results=[];
async function centers(page) {
  return page.evaluate(()=>{
    const canvas=document.querySelector('canvas'), c=canvas.getBoundingClientRect();
    const h=document.querySelector('.crosshair').getBoundingClientRect();
    const overlay=document.querySelector('#scope-overlay'), o=overlay.getBoundingClientRect(), s=getComputedStyle(overlay,'::before');
    return {canvas:[c.x+c.width/2,c.y+c.height/2],crosshair:[h.x+h.width/2,h.y+h.height/2],scope:[o.x+parseFloat(s.left),o.y+parseFloat(s.top)],inner:[innerWidth,innerHeight]};
  });
}
function verify(m) {for(const key of ['crosshair','scope']) for(let i=0;i<2;i++) assert.ok(Math.abs(m[key][i]-m.canvas[i])<1,JSON.stringify(m));}
try {
  for(const [width,height] of [[844,390],[640,360]]) {
    // 独立コンテキストでソロのみ。本人の保存・協力部屋には触れない。
    const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,serviceWorkers:'block'});
    const page=await context.newPage(), errors=[],consoleErrors=[];
    page.setDefaultTimeout(30000);
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
    await page.goto(origin+'/front',{waitUntil:'domcontentloaded'});
    await page.locator('#solo').click();await page.locator('#front-launch').click();
    await page.locator('.rebuild-card').first().waitFor({timeout:90000});
    await page.locator('.rebuild-card').first().click();
    await page.locator('#controls').waitFor();
    const normal=await centers(page);verify(normal);
    await page.screenshot({path:`${out}/${width}-normal.png`});
    await page.locator('#scope').tap();
    await page.waitForFunction(()=>!document.querySelector('#scope-overlay').hidden);
    const scoped=await centers(page);verify(scoped);
    await page.screenshot({path:`${out}/${width}-scope.png`});
    // 人工的なHUD高さ差。実Androidの全画面/バー操作とは区別する。
    await page.locator('#hud').evaluate(el=>el.style.height=`${innerHeight+65}px`);
    const tall=await centers(page);verify(tall);
    await page.screenshot({path:`${out}/${width}-tall.png`});
    await page.locator('#hud').evaluate(el=>el.style.removeProperty('height'));
    await page.setViewportSize({width:width-40,height:320});
    await page.waitForFunction(()=>document.querySelector('canvas').getBoundingClientRect().height===innerHeight);
    const resized=await centers(page);verify(resized);
    await page.locator('#pause').tap();
    await page.waitForFunction(()=>document.querySelector('#scope-overlay').hidden);
    assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
    results.push({width,height,normal,scoped,tall,resized,errors,consoleErrors});
    await context.close();
  }
  writeFileSync(`${out}/result.json`,JSON.stringify({origin,at:new Date().toISOString(),scope:'public solo with real scope interaction; tall HUD is synthetic; physical Android unverified',results},null,2));
  console.log(JSON.stringify({pass:true,sizes:results.length,pageErrors:0,consoleErrors:0}));
} finally {await browser.close();}
