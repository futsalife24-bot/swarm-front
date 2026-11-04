import {chromium} from 'playwright';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const here=fileURLToPath(new URL('.',import.meta.url));
const server=spawn(process.execPath,[here+'server.mjs'],{env:{...process.env,BUDDY_PORT:'4319'},windowsHide:true});
process.on('exit',()=>server.kill());await new Promise(r=>server.stdout.once('data',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:960,height:640}});
await page.goto('http://127.0.0.1:4319');await page.waitForFunction(()=>window.ready);
fs.mkdirSync(here+'review/frames',{recursive:true});
for(let i=0;i<480;i++){
 const segment=Math.floor(i/120),name=['Idle','Follow','Display','Coil'][segment];
 await page.evaluate(({name,segment,i})=>{buddy.setView(segment===3?'top':'hero');buddy.motion(name);buddy.freeze((i%120)/30);},{name,segment,i});
 await page.screenshot({path:here+`review/frames/${String(i).padStart(4,'0')}.png`});
}
await browser.close();server.kill();console.log('480 frames / 30 fps / 16 seconds');
