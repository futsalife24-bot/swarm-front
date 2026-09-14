import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';import fs from 'node:fs';
const b=await chromium.launch({channel:'chrome'});const results=[];
try{
 for(const [width,height] of [[915,412],[640,360]]){
  const p=await b.newPage({viewport:{width,height},serviceWorkers:'block'});
  await p.goto('http://127.0.0.1:5348/?playtest=1&menuSample=1');await p.locator('[data-row]').first().waitFor();
  await p.addStyleTag({content:':root{--safe-top:12px;--safe-bottom:12px;--safe-left:24px;--safe-right:24px;}'});
  const state=await p.evaluate(()=>{const r=document.querySelector('h1').getBoundingClientRect(),f=document.querySelector('.gear-footer').getBoundingClientRect(),a=[...document.querySelectorAll('.status small span')].map(e=>e.getBoundingClientRect());return {titleTop:r.top,footerBottom:f.bottom,legendAligned:a.every((r,i)=>!i||r.left>=a[i-1].right),legendSingleLine:a.every(r=>Math.abs(r.top-a[0].top)<1)};});
  assert.ok(state.titleTop>=12&&state.footerBottom<=height-12&&state.legendAligned&&state.legendSingleLine,JSON.stringify(state));
  await p.screenshot({path:`dist-validation/menu-fit/final-safe-${width}.png`});
  await p.locator('#pt-home').click();await p.locator('#pt-menu-sample').waitFor();
  const bounds=await p.locator('#pt-menu-sample').boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=height);
  await p.screenshot({path:`dist-validation/menu-fit/final-home-${width}.png`});
  await p.locator('#pt-menu-sample').click();await p.locator('[data-row]').first().waitFor();assert.equal(await p.locator('[data-row]').count(),48);
  results.push({width,height,...state,homeEntry:true});await p.close();
 }
 fs.writeFileSync('dist-validation/menu-fit/final-safe.json',JSON.stringify(results,null,2));console.log('PASS safe areas, legend order, sample exit/home entry');
}finally{await b.close();}
