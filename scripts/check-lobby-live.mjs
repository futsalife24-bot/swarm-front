import { chromium } from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const url='https://swarm-front.melosalife-24.workers.dev',dir='dist-validation/lobby-grid/live';
mkdirSync(dir,{recursive:true});
const html=readFileSync('dist/index.html','utf8');
const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m=>m[1]);
const hash=b=>createHash('sha256').update(b).digest('hex');
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try {
 for(const [width,height] of [[1280,720],[844,390]]) {
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  assert.equal((await page.goto(url)).status(),200);
  const hashes={};
  for(const asset of assets){const res=await page.request.get(url+asset);assert.equal(res.status(),200);const digest=hash(await res.body());assert.equal(digest,hash(readFileSync('dist'+asset)));hashes[asset]=digest;}
  await page.getByRole('button',{name:'協力プレイ'}).click();
  await page.getByRole('heading',{name:'出撃準備',exact:true}).waitFor();
  await page.screenshot({path:`${dir}/${width}.png`});
  const health=await page.request.get(url+'/api/health');assert.equal(health.status(),200);assert.equal((await health.json()).ok,true);
  assert.deepEqual(errors,[]);results.push({width,height,assets:hashes,coopEntryVisible:true,health:200,errors});await context.close();
 }
 writeFileSync(dir+'/result.json',JSON.stringify({url,time:new Date().toISOString(),results},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
