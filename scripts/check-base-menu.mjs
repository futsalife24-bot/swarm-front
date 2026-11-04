import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const origin=process.env.BASE_ORIGIN||'http://127.0.0.1:5362';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))throw Error('Local fixtures only');
const out='dist-validation/base-menu';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});const results=[];
try{
for(const [width,height] of [[1280,582],[844,390],[667,375]]){
 const p=await browser.newPage({viewport:{width,height},serviceWorkers:'block'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 // 画面切替は旧画面の残像（Shadow DOM）を0.55秒重ねる。本物の画面の見出しが期待値になり、残像が消えるまで待つ。
 const settle=()=>p.locator('.split-shutter').waitFor({state:'detached'});
 // 初回案内は保存単位で一度だけ。表示された場合だけ閉じる。
 const skipTutorial=async()=>{await settle();const s=p.locator('#pt-tutorial-skip');try{await s.waitFor({timeout:3000});}catch{return;}await s.click();await settle();};
 const tap=async(sel)=>{await settle();await p.locator(sel).click();};
 const h1=async(text)=>{await p.waitForFunction(t=>document.querySelector('#ui h1')?.textContent.trim()===t,text,{timeout:15000});await settle();};
 await p.goto(origin);
 // 初回の入場画面（TAP START）を閉じてからメニューを操作する。
 await p.locator('.title-entry-start').click();await p.locator('.title-entry').waitFor({state:'detached'});
 await p.getByRole('button',{name:'基地',exact:true}).click();await settle();await tap('#pt-confirm');
 await h1('基地');assert.equal(await p.locator('.pt-base-menu > button').count(),5);assert.match(await p.locator('#pt-base-survival').innerText(),/生存カード/);assert.ok(await p.locator('#pt-base-workshop').isDisabled());
 assert.match(await p.locator('#pt-base-workshop').innerText(),/工事中/);
 const layout=await p.locator('.pt-base-menu').evaluate(e=>({scroll:e.scrollHeight-e.clientHeight,cards:[...e.children].map(c=>{const r=c.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}),overflow:document.documentElement.scrollWidth>innerWidth}));
 assert.ok(!layout.overflow);assert.ok(layout.cards.every(r=>r.x>=0&&r.y>=0&&r.right<=width&&r.bottom<=height));assert.ok(layout.scroll<=1);
 await p.screenshot({path:`${out}/${width}-base.png`});
 await tap('#pt-base-weapons');await h1('武器');await tap('[data-genre=rifle]');await h1('ライフル');await tap('#pt-base');
 await tap('#pt-base-accessories');await skipTutorial();await h1('アクセサリ');await tap('#pt-base');
 await tap('#pt-base-growth');await skipTutorial();await h1('兵士の育成');await tap('#pt-base');
 await tap('#pt-gear');await h1('出撃準備');await tap('#pt-base');await h1('基地');
 await tap('#pt-home');assert.equal(await p.locator('#pt-growth').count(),0);await settle();await p.screenshot({path:`${out}/${width}-title.png`});await p.getByRole('button',{name:'基地',exact:true}).click();await h1('基地');assert.equal(await p.locator('#pt-confirm').count(),0);
 assert.deepEqual(errors,[]);results.push({width,height,...layout,errors,allRoutes:true,workshopDisabled:true});await p.close();
}
fs.writeFileSync(out+'/checks.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
