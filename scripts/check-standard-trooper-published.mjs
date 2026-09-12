import {chromium} from '@playwright/test';import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const base=process.argv[2]??'https://swarm-front.melosalife-24.workers.dev',dir='dist-validation/standard-trooper';
const script=readFileSync('dist/index.html','utf8').match(/src="([^"]+\.js)"/)[1],hash=b=>createHash('sha256').update(b).digest('hex');
const paths=['trooper','rifle','shotgun','rocket'].map(n=>`/assets/characters/standard_${n}_v1.glb`),assets=[];
for(const path of [script,...paths]){const r=await fetch(base+path);assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(hash(bytes),hash(readFileSync('dist'+path)));assets.push({path,bytes:bytes.length,sha256:hash(bytes)})}
const b=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const results=[];
try{for(const [width,height] of [[1280,720],[844,390]]){
 const p=await b.newPage({viewport:{width,height},serviceWorkers:'block'}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.text().includes('Standard Trooper unavailable'))errors.push(m.text())});
 await p.clock.install();const loaded=Promise.all(paths.map(path=>p.waitForResponse(r=>r.url()===base+path&&r.status()===200,{timeout:60000})));
 assert.equal((await p.goto(base)).status(),200);assert.equal(await p.locator('script[type="module"]').getAttribute('src'),script);
 await p.getByRole('button',{name:/ソロで出撃準備/}).click();await p.locator('#launch').click();await Promise.all((await loaded).map(r=>r.finished()));
 // Wait for packed textures/skins to finish decoding, not merely HTTP headers.
 await p.waitForTimeout(1800);
 await p.clock.pauseAt(new Date((await p.evaluate(()=>Date.now()))+1000));await p.screenshot({path:`${dir}/published-${width}-idle.png`});
 const ammo=async()=>parseInt(await p.locator('.ammo-line b').innerText());
 await p.mouse.move(width/2,height/2);await p.mouse.down();await p.clock.runFor(200);await p.mouse.up();const rifleAmmo=await ammo();assert.ok(rifleAmmo<32);
 await p.keyboard.press('KeyQ');await p.mouse.down();await p.clock.runFor(500);assert.ok((await p.locator('.weapon-hud > span').innerText()).includes('2/2'));assert.equal(await ammo(),7);
 await p.screenshot({path:`${dir}/published-${width}-switch.png`});await p.clock.runFor(700);await p.mouse.up();const shotgunAmmo=await ammo();assert.ok(shotgunAmmo<7);
 await p.keyboard.down('KeyD');await p.keyboard.press('Space');await p.clock.runFor(150);await p.screenshot({path:`${dir}/published-${width}-roll.png`});await p.clock.runFor(250);await p.keyboard.up('KeyD');
 assert.equal(await p.evaluate(()=>typeof window.__swarm),'undefined');assert.deepEqual(errors,[]);results.push({width,height,rifleAmmo,shotgunAmmo,switchFireBlocked:true,modelsLoaded:4,errors});await p.close();
}const health=await fetch(base+'/api/health');assert.equal(health.status,200);assert.equal((await health.json()).ok,true);writeFileSync(`${dir}/published-validation.json`,JSON.stringify({base,assets,results,health:200,date:new Date().toISOString()},null,2));console.log('PASS: published JS/4 GLBs match, both viewports play/fire/switch/dodge, health OK, no development diagnostics');}finally{await b.close()}
