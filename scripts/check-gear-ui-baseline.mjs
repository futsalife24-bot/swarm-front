import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out='dist-validation/gear-pinned';
fs.mkdirSync(out,{recursive:true});
const origin=process.env.GEAR_ORIGIN||'http://127.0.0.1:5347';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw Error('Synthetic save fixtures are restricted to localhost.');
const label=origin.includes('5347')?'local':'built';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
const results=[];
try {
 let fixture;
 if(origin.includes('5347')){
  const p=await browser.newPage();await p.goto(origin+'/?playtest=1');await p.locator('#solo').click();await p.locator('#pt-confirm').click();
  fixture=await p.evaluate(async()=>{const m=await import('/src/client/progression-save.ts'),g=await import('/src/shared/progression.ts');const s=m.loadProgress('normal');const kinds=['rifle','shotgun','rocket'];for(let i=0;i<24;i++){const k=kinds[i%3],r=i%5;s.inventory.push(g.makeWeapon('ui-'+i,k,r,{power:20,reload:-10,range:20,rate:20},false,s.serial++,r?({rifle:'pierce',shotgun:'repel',rocket:'chain'})[k]:'none'));}return JSON.stringify(s);});
  fs.writeFileSync(out+'/fixture.json',fixture);await p.close();
 }else fixture=fs.readFileSync(out+'/fixture.json','utf8');
 for(const [width,height] of [[1280,582],[915,412],[844,390],[640,360]]){
  const p=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,serviceWorkers:'block'}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(raw=>{if(!localStorage.getItem('swarm-front-progression-v2-normal'))localStorage.setItem('swarm-front-progression-v2-normal',raw);},fixture);
  await p.goto(origin+'/?playtest=1');await p.locator('#solo').click();
  for(const organizing of [false,true]){
   if(organizing)await p.locator('#pt-organize').click();
   const state=await p.evaluate(()=>{
    const list=document.querySelector('.gear-weapon-list'),lr=list.getBoundingClientRect(),rows=[...list.querySelectorAll('[data-row]')];
    const head=list.querySelector('.pt-weapon-head').getBoundingClientRect();
    const data=rows.map(row=>{const r=row.getBoundingClientRect(),strip=row.querySelector('.pt-stat-scroll'),lock=row.querySelector('[data-lock]').getBoundingClientRect(),name=row.querySelector('b'),cells=[...row.querySelectorAll('.pt-stat-inner > span')];
      return {row:r.height,visible:r.y>=list.querySelector('[data-pinned]').getBoundingClientRect().bottom&&r.bottom<=lr.bottom,nameFits:name.scrollWidth<=name.clientWidth+1,scroll:list.scrollWidth-list.clientWidth,lockWidth:lock.width,lockRight:lock.right,listRight:lr.right,cellOverlap:cells.some((c,i)=>{const range=document.createRange();range.selectNodeContents(c);return i<cells.length-1&&range.getBoundingClientRect().right>cells[i+1].getBoundingClientRect().left+1;})};});
    return {titleTop:document.querySelector('h1').getBoundingClientRect().top,frameTop:document.querySelector('.panel').getBoundingClientRect().top,heading:head.height,header:document.querySelector('.menu-header').getBoundingClientRect().height,rows:data,visible:data.filter(r=>r.visible).length,footerClear:document.querySelector('.loadout-slots button:last-child').getBoundingClientRect().bottom<=document.querySelector('.gear-footer').getBoundingClientRect().top,checks:list.querySelectorAll('[data-check]').length,overflow:document.documentElement.scrollWidth>innerWidth};
   });
   await p.screenshot({path:`${out}/${label}-${width}-${organizing?'organize':'normal'}.png`});
   results.push({width,height,organizing,...state});
   assert.ok(state.titleTop>=state.frameTop+6);assert.ok(state.heading<=20);assert.ok(state.header<=52);assert.ok(state.footerClear);assert.ok(!state.overflow);
   assert.equal(state.checks,organizing?27:0);
   assert.ok(state.rows.every(r=>r.row===30&&r.nameFits&&!r.cellOverlap&&r.lockWidth===28&&r.lockRight<=r.listRight),JSON.stringify({width,organizing,...state}));
   if(width>=844)assert.ok(state.rows.every(r=>r.scroll<=1),`${width}: unnecessary horizontal scrolling`);
   const before=await p.locator('[data-lock]').first().boundingBox();
   await p.locator('.gear-weapon-list').evaluate(e=>e.scrollLeft=500);
   await p.waitForTimeout(120);
   const after=await p.locator('[data-lock]').first().boundingBox();assert.equal(before.x,after.x);
   const offsets=await p.locator('.pt-stat-inner').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().x));assert.ok(offsets.every(x=>Math.abs(x-offsets[0])<=1));
   await p.locator('.gear-weapon-list').evaluate(e=>e.scrollLeft=0);
  }
  const targetId=await p.locator('[data-row]').filter({has:p.locator('[data-check]:not(:disabled)')}).first().getAttribute('data-row');
  const target=p.locator(`[data-row="${targetId}"]`);
  await target.locator('[data-check]').check();await target.locator('[data-lock]').click();
  assert.ok(await target.locator('[data-check]').isDisabled());assert.ok(!(await target.locator('[data-check]').isChecked()));
  await p.locator('[data-check]:not(:disabled)').first().check();
  await p.locator('.pt-bulk-menu summary').click();await p.locator('#pt-dismantle').click();await p.locator('#pt-confirm').click();
  assert.equal(await p.locator('[data-row]').count(),26);
  await p.locator('#pt-organize').click();assert.equal(await p.locator('[data-check]').count(),0);
  await p.locator('[data-lock]').first().click();assert.equal(await p.locator('[data-lock]').first().getAttribute('aria-pressed'),'true');
  await p.locator('[data-pinned] [data-detail]').click();await p.locator('.dialog-close').click();
  await p.locator('#pt-filter').selectOption('shotgun');assert.ok((await p.locator('[data-row]').allTextContents()).every(t=>t.includes('SG-4')));
  assert.deepEqual(errors,[]);await p.close();
 }
 fs.writeFileSync(out+'/'+label+'.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results.map(({width,organizing,heading,header,visible,rows})=>({width,organizing,heading,header,visible,horizontal:rows[0].scroll}))));
}finally{await browser.close();}

