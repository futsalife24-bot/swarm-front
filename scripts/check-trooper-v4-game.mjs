import { chromium } from '@playwright/test';
import { mkdirSync,writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const dir='dist-validation/trooper-v4';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const results=[];
try{for(const [width,height] of [[1280,720],[844,390]]){
 const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();await page.goto('http://127.0.0.1:5314/');
 await page.getByRole('button',{name:/ソロで出撃準備/}).click();await page.locator('#launch').click();
 await page.waitForFunction(()=>window.__swarm?.trooper?.loaded,{timeout:60000});
 await page.clock.pauseAt(new Date((await page.evaluate(()=>Date.now()))+1000));
 const snap=()=>page.evaluate(()=>({trooper:__swarm.trooper,p:__swarm.world.players[0],calls:__swarm.drawCalls}));
 const start=await snap();assert.equal(start.trooper.bones,57);assert.equal(start.trooper.weapons[0],'RightHandWeaponSocket');
 await page.screenshot({path:`${dir}/game-${width}-idle.png`});
 await page.keyboard.down('KeyW');await page.clock.runFor(180);const run=await snap();assert.ok(Math.hypot(run.p.x-start.p.x,run.p.z-start.p.z)>.1);
 await page.screenshot({path:`${dir}/game-${width}-run.png`});await page.keyboard.up('KeyW');
 await page.mouse.move(width*.5,height*.5);await page.mouse.down();await page.clock.runFor(180);await page.mouse.up();const fire=await snap();assert.ok(fire.p.ammo[0]<start.p.ammo[0]);
 await page.screenshot({path:`${dir}/game-${width}-fire.png`});
 await page.keyboard.press('KeyQ');await page.clock.runFor(250);const switching=await snap();assert.equal(switching.trooper.mode,'switch');
 await page.screenshot({path:`${dir}/game-${width}-switch.png`});await page.clock.runFor(350);const switched=await snap();assert.equal(switched.trooper.weapons[1],'RightHandWeaponSocket');assert.equal(switched.trooper.weapons[0],'BackWeaponSocket');
 await page.mouse.down();await page.clock.runFor(100);await page.mouse.up();const fire2=await snap();assert.ok(fire2.p.ammo[1]<start.p.ammo[1]);
 await page.keyboard.down('KeyD');await page.keyboard.press('Space');await page.clock.runFor(160);const roll=await snap();assert.equal(roll.trooper.mode,'roll');assert.ok(roll.p.evade>0);await page.screenshot({path:`${dir}/game-${width}-roll.png`});
 await page.clock.runFor(250);await page.keyboard.up('KeyD');const recovered=await snap();assert.equal(recovered.p.evade,0);assert.notEqual(recovered.trooper.mode,'roll');
 await page.keyboard.press('KeyQ');await page.clock.runFor(1100);const back=await snap();assert.equal(back.trooper.weapons[0],'RightHandWeaponSocket');
 assert.deepEqual(errors,[]);results.push({width,height,start,run,fire,switching,switched,fire2,roll,recovered,back,errors});await page.close();
}writeFileSync(`${dir}/game-validation.json`,JSON.stringify(results,null,2));console.log('PASS: real solo input, both slots, run/fire/switch/roll at desktop and mobile viewport');}finally{await browser.close()}




