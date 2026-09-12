import { chromium } from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const url='https://swarm-front.melosalife-24.workers.dev',dir=process.env.ENTRY_CHECK_LOCAL ? 'dist-validation/entry-fit/local' : 'dist-validation/entry-fit/live';
mkdirSync(dir,{recursive:true});
const html=readFileSync('dist/index.html','utf8');
const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m=>m[1]);
const hash=b=>createHash('sha256').update(b).digest('hex');
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try {
 for(const [width,height] of [[1280,720],[740,360],[844,390],[667,300]]) {
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  assert.equal((await page.goto(url)).status(),200);
  if(process.env.ENTRY_CHECK_LOCAL) await page.addStyleTag({content:readFileSync('src/mobile-ui.css','utf8')});
  const hashes={};
  for(const asset of process.env.ENTRY_CHECK_LOCAL ? [] : assets){const res=await page.request.get(url+asset);assert.equal(res.status(),200);const digest=hash(await res.body());assert.equal(digest,hash(readFileSync('dist'+asset)));hashes[asset]=digest;}
  await page.getByRole('button',{name:'協力プレイ'}).click();
  await page.getByRole('heading',{name:'協力プレイ',exact:true}).waitFor();
  assert.equal(await page.locator('[data-equip], #stage-select').count(),0);
  await page.waitForTimeout(1500);
  const fit=await page.locator('.room-entry').evaluate(e=>{const r=e.getBoundingClientRect(); const b=e.querySelector('#launch').getBoundingClientRect(); return {top:r.top,bottom:r.bottom,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,buttonBottom:b.bottom,height:innerHeight};});
  assert.ok(fit.top>=0 && fit.bottom<=height && fit.buttonBottom<=height && fit.scrollHeight<=fit.clientHeight+1,JSON.stringify(fit));
  assert.equal(await page.locator('.room-entry').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
  await page.screenshot({path:`${dir}/${width}.png`});
  const health=await page.request.get(url+'/api/health');assert.equal(health.status(),200);assert.equal((await health.json()).ok,true);
  assert.deepEqual(errors,[]);results.push({width,height,assets:hashes,fit,coopEntryVisible:true,health:200,errors});await context.close();
 }
 writeFileSync(dir+'/result.json',JSON.stringify({url,time:new Date().toISOString(),results},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}


