import {chromium} from '@playwright/test';import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const base=process.argv[2]??'https://swarm-front.melosalife-24.workers.dev',local=base.includes('127.0.0.1');const out='dist-validation/enemies-release';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const p=await browser.newPage({viewport:{width:844,height:390},serviceWorkers:'block'}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const page=await p.goto(base);assert.equal(page.status(),200);const script=await p.locator('script[type="module"]').getAttribute('src');assert.equal(script,readFileSync('dist/index.html','utf8').match(/src="([^"]+\.js)"/)[1]);
 const glbs=[];for(const name of ['hound','prism','ray','foundry_zero']){const path=`assets/enemies/${name}_motion_v1.glb`,r=await p.request.get(base+'/'+path);assert.equal(r.status(),200);const hash=createHash('sha256').update(await r.body()).digest('hex');assert.equal(hash,createHash('sha256').update(readFileSync('public/'+path)).digest('hex'));glbs.push({name,hash})}
 await p.getByRole('button',{name:/ソロで出撃準備/}).click();await p.locator('#stage-select').selectOption('20');await p.locator('#launch').click();await p.locator('#hud').waitFor({state:'visible'});await p.waitForTimeout(1600);await p.screenshot({path:out+`/${local?'local':'published'}-solo.png`});
 let health;if(!local){const r=await p.request.get(base+'/api/health');health=await r.json();assert.equal(r.status(),200);assert.equal(health.ok,true)}
 assert.deepEqual(errors,[]);writeFileSync(out+`/${local?'local':'published'}-smoke.json`,JSON.stringify({pass:true,base,script,glbs,solo:true,health,errors},null,2));console.log('SMOKE PASS',base);
}finally{await browser.close()}
