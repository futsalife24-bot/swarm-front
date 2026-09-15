import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out='dist-work/run-transfer-20260913',results=[];
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{for(const key of ['jog','sprint']){
 const page=await browser.newPage({viewport:{width:800,height:450}}),errors=[],assets=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('ual-run-20260913'))assets.push({url:r.url(),status:r.status()})});
 await page.clock.install();await page.goto('http://127.0.0.1:5340/?runTrial='+key);await page.getByRole('button',{name:/ソロで出撃準備/}).click();await page.locator('#launch').click();await page.waitForFunction(()=>window.__swarm?.trooper?.loaded,null,{timeout:120000});await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));
 const snap=()=>page.evaluate(()=>({p:__swarm.world.players[0],trooper:__swarm.trooper}));const start=await snap(),steps=[];
 for(const direction of ['KeyW','KeyA','KeyD','KeyS']){await page.keyboard.down(direction);await page.clock.runFor(200);const moving=await snap();steps.push({direction,moving});await page.keyboard.up(direction);await page.clock.runFor(230);steps.push({stopped:await snap()})}
 await page.keyboard.down('KeyW');await page.mouse.move(470,180);await page.mouse.down();await page.clock.runFor(180);await page.mouse.up();const fire=await snap();assert.ok(fire.p.ammo[0]<start.p.ammo[0]);
 await page.keyboard.press('KeyR');await page.clock.runFor(180);const reload=await snap();assert.ok(reload.p.reload>0);
 await page.keyboard.press('KeyQ');await page.clock.runFor(250);const switching=await snap();assert.equal(switching.trooper.mode,'switch');await page.clock.runFor(400);const switched=await snap();assert.equal(switched.trooper.weapons[1],'RightHandWeaponSocket');assert.equal(switched.trooper.weapons[0],'BackWeaponSocket');
 await page.mouse.down();await page.clock.runFor(180);await page.mouse.up();const fire2=await snap();assert.ok(fire2.p.ammo[1]<start.p.ammo[1]);await page.keyboard.press('Space');await page.clock.runFor(140);const dodge=await snap();assert.equal(dodge.trooper.mode,'roll');await page.clock.runFor(500);await page.keyboard.up('KeyW');await page.clock.runFor(250);const stopped=await snap();
 await page.screenshot({path:`${out}/${key}-actual-game.png`});assert.deepEqual(errors,[]);assert.ok(assets.some(a=>a.url.endsWith(key+'.glb')&&a.status===200));assert.ok(steps.some(s=>s.moving&&Math.hypot(s.moving.p.x-start.p.x,s.moving.p.z-start.p.z)>.1));results.push({key,start,steps,fire,reload,switching,switched,fire2,dodge,stopped,assets,errors});writeFileSync(out+'/actual-game-qa.json',JSON.stringify(results,null,2));console.log('PASS actual game',key);await page.close();
}}finally{await browser.close()}
