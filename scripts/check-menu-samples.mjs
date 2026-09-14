import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin = process.env.GEAR_ORIGIN || 'http://127.0.0.1:5348';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw Error('Localhost only.');
const out = 'dist-validation/menu-fit';
const browser = await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
const results=[];
try {
 for (const [width,height] of [[1280,582],[915,412],[844,390],[640,360]]) {
  const p=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,serviceWorkers:'block'});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{
    localStorage.setItem('swarm-front-progression-v2-normal','normal-save-sentinel');
    localStorage.setItem('swarm-front-progression-v2-test','test-save-sentinel');
    localStorage.setItem('swarm-front-save-v1','legacy-save-sentinel');
    sessionStorage.setItem('swarm-front-playtest-mode','test');
    sessionStorage.setItem('swarm-front-playtest-retry','retry-sentinel');
  });
  await p.goto(origin+'/?playtest=1&menuSample=1');
  await p.locator('[data-row]').first().waitFor();
  assert.equal(await p.locator('[data-row]').count(),48);
  assert.ok(await p.locator('#pt-start').isDisabled());
  for(const level of ['low','base','good','great','max']) assert.ok(await p.locator('.pt-stat-inner .pt-var-'+level).count()>0);
  const layout=async()=>p.evaluate(()=>{
    const list=document.querySelector('.gear-weapon-list'),box=list.getBoundingClientRect();
    const head=document.querySelector('.menu-header').getBoundingClientRect();
    const title=document.querySelector('h1').getBoundingClientRect();
    const rows=[...document.querySelectorAll('[data-row]')];
    return {horizontal:list.scrollWidth-list.clientWidth,vertical:list.scrollHeight-list.clientHeight,
      titleVisible:title.top>=0&&title.bottom<=head.bottom,
      headerOverlap:[...document.querySelectorAll('.menu-header > *')].some((e,i,a)=>i&&e.getBoundingClientRect().left<a[i-1].getBoundingClientRect().right-1&&Math.abs(e.getBoundingClientRect().top-a[i-1].getBoundingClientRect().top)<5),
      visible:rows.filter(r=>r.getBoundingClientRect().bottom<=box.bottom&&r.getBoundingClientRect().top>=box.top+20).length,
      locksVisible:rows.every(r=>r.querySelector('[data-lock]').getBoundingClientRect().right<=box.right+1),
      overlap:rows.some(r=>{const cells=[...r.querySelectorAll('.pt-stat-inner > span')];return cells.some((c,i)=>{const range=document.createRange();range.selectNodeContents(c);return i<cells.length-1&&range.getBoundingClientRect().right>cells[i+1].getBoundingClientRect().left+1;});})};
  });
  const gear=await layout();assert.ok(gear.titleVisible&&!gear.headerOverlap&&!gear.overlap&&gear.locksVisible);assert.ok(gear.vertical>0);
  await p.screenshot({path:`${out}/samples-${width}-gear.png`});
  // Native touch gesture: one list owns movement; all stat cells stay aligned.
  if(width===640){
    const box=await p.locator('[data-row]').first().locator('.pt-stat-scroll').boundingBox();
    const client=await p.context().newCDPSession(p);
    const x=box.x+80,y=box.y+20;
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let i=1;i<=6;i++) await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*18,y}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await p.waitForTimeout(200);
    assert.ok(await p.locator('.gear-weapon-list').evaluate(e=>e.scrollLeft)>0);
    const positions=await p.locator('.pt-stat-inner').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().x));
    assert.ok(positions.every(x=>Math.abs(x-positions[0])<1));
    assert.equal(await p.locator('dialog[open]').count(),0);
    await p.locator('.gear-weapon-list').evaluate(e=>e.scrollLeft=0);
  }
  await p.locator('.gear-weapon-list').evaluate(e=>e.scrollTop=e.scrollHeight);
  await p.screenshot({path:`${out}/samples-${width}-bottom.png`});
  await p.locator('#pt-armory').click();
  assert.equal(await p.locator('[data-row]').count(),0);assert.equal(await p.locator('[data-genre]').count(),3);
  await p.screenshot({path:`${out}/samples-${width}-genres.png`});
  const genres=[];
  for(const kind of ['rifle','shotgun','rocket']){
    await p.locator(`[data-genre="${kind}"]`).click();
    assert.equal(await p.locator('[data-row]').count(),16);
    const state=await layout();assert.ok(state.titleVisible&&!state.headerOverlap&&!state.overlap&&state.locksVisible,JSON.stringify({width,kind,state}));assert.equal(state.horizontal,0);
    for(const sort of ['rarity','power','mag','reload','range','rate','acquired']){
      await p.locator('#pt-sort').selectOption(sort);
      const ids=await p.locator('[data-row]').evaluateAll(es=>es.map(e=>e.dataset.row));
      assert.equal(new Set(ids).size,16);
      if(sort==='rarity'){
        const grades=await p.locator('[data-row] .gear-rarity').allTextContents();
        const nums=grades.map(g=>['N','R','SR','SSR','LR'].indexOf(g));
        assert.ok(nums.every((n,i)=>!i||n<=nums[i-1]));
      }else if(!['acquired'].includes(sort)){
        const col={power:2,mag:3,reload:4,range:5,rate:6}[sort];
        const values=await p.locator(`[data-row] .pt-stat-inner > span:nth-child(${col})`).allTextContents();
        const nums=values.map(parseFloat);
        assert.ok(nums.every((n,i)=>!i||(sort==='reload'?n>=nums[i-1]:n<=nums[i-1])),`${sort} ${nums}`);
      }
    }
    const unlocked=p.locator('[data-row]').filter({has:p.locator('[data-check]:not(:disabled)')}).first();
    const id=await unlocked.getAttribute('data-row');
    await unlocked.locator('[data-check]').check();await unlocked.locator('[data-lock]').click();
    const target=p.locator(`[data-row="${id}"]`);
    assert.equal(await target.locator('[data-lock]').getAttribute('aria-pressed'),'true');assert.match(await target.locator('[data-lock]').innerText(),/固定/);
    assert.ok(await target.locator('[data-check]').isDisabled());assert.ok(!(await target.locator('[data-check]').isChecked()));
    await target.locator('[data-lock]').click();await p.locator('#pt-confirm').click();assert.equal(await target.locator('[data-lock]').getAttribute('aria-pressed'),'false');
    await target.locator('[data-detail]').click();await p.locator('.dialog-close').click();
    await p.locator('.gear-weapon-list').evaluate(e=>e.scrollTop=0);
    await p.screenshot({path:`${out}/samples-${width}-${kind}.png`});
    genres.push({kind,...state});
    await p.locator('#pt-genres').click();
  }
  const saved=await p.evaluate(()=>({normal:localStorage.getItem('swarm-front-progression-v2-normal'),test:localStorage.getItem('swarm-front-progression-v2-test'),legacy:localStorage.getItem('swarm-front-save-v1'),mode:sessionStorage.getItem('swarm-front-playtest-mode'),retry:sessionStorage.getItem('swarm-front-playtest-retry')}));
  assert.deepEqual(saved,{normal:'normal-save-sentinel',test:'test-save-sentinel',legacy:'legacy-save-sentinel',mode:'test',retry:'retry-sentinel'});
  await p.reload();await p.locator('[data-row]').first().waitFor();assert.equal(await p.locator('[data-row]').count(),48);
  assert.deepEqual(errors,[]);results.push({width,height,gear,genres,saveIsolation:true,touchScroll:width===640,errors});await p.close();
 }
 fs.writeFileSync(out+'/samples.json',JSON.stringify(results,null,2));console.log('PASS samples, 3 genres, 7 sorts, lock protection, details, touch scroll, save isolation at 4 sizes');
}finally{await browser.close();}
