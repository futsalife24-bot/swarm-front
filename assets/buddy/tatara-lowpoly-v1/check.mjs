import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const out=path.join(path.dirname(fileURLToPath(import.meta.url)),'review');fs.mkdirSync(out,{recursive:true});
const server=spawn(process.execPath,[fileURLToPath(new URL('server.mjs',import.meta.url))],{env:{...process.env,BUDDY_PORT:'4318'},windowsHide:true});
process.on('exit',()=>server.kill());
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',c=>reject(Error('server '+c)));});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1100,height:760},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:4318');await page.waitForFunction(()=>window.ready,null,{timeout:60000});
const stats=await page.evaluate(()=>buddy.stats());
if(stats.tris!==1796||stats.meshes!==1||stats.bones!==8||stats.clips.length!==3)throw Error(JSON.stringify(stats));
for(const view of ['hero','front','side','back','scale']){
 await page.evaluate(v=>{buddy.setView(v);buddy.freeze();},view);await page.screenshot({path:path.join(out,view+'.png')});
}
for(const motion of ['Idle','Follow','Palm'])for(const t of [0,.5,1]){
 await page.evaluate(({motion,t})=>{buddy.setView('hero');buddy.motion(motion);buddy.freeze(t);},{motion,t});await page.screenshot({path:path.join(out,`${motion}-${t}.png`)});
}
const measurements=[];
for(const [width,height] of [[844,390],[640,360]]){
 await page.setViewportSize({width,height});
 for(const n of [0,1,4]){
  await page.evaluate(n=>{buddy.setView('game');buddy.motion('Follow');buddy.count(n);buddy.freeze(.25);},n);
  await page.screenshot({path:path.join(out,`game-${width}-${n}.png`)});
  for(const shadow of [false,true])measurements.push({width,height,...await page.evaluate(({n,shadow})=>buddy.measure(n,shadow),{n,shadow})});
 }
}
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({stats,errors,measurements,browser:await browser.version(),kind:'PC headless Chromium / CPU animation + render submission; not GPU or phone frame time'},null,2));
if(errors.length)throw Error(errors.join('\n'));
await browser.close();server.kill();console.log(JSON.stringify({stats,errors,measurements},null,2));
