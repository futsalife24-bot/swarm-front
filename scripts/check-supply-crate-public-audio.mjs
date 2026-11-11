import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
const url='https://swarm-front.melosalife-24.workers.dev/supply-reveal/assets/crate-open-preview.mp3';
const browser=await chromium.launch({channel:'chrome'});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('audio,video')?.readyState>=2);
 await page.evaluate(()=>{const a=document.querySelector('audio,video'),b=document.createElement('button');b.id='play-sample';b.textContent='開封SEを再生';b.onclick=()=>a.play();document.body.append(b);});
 await page.locator('#play-sample').click();
 await page.waitForFunction(()=>document.querySelector('audio,video').currentTime>.2&&!document.querySelector('audio,video').paused);
 const result=await page.locator('audio,video').evaluate(a=>({source:a.currentSrc,duration:a.duration,time:a.currentTime,paused:a.paused,error:a.error?.code??null}));
 expect(result.duration).toBeGreaterThan(5);expect(result.duration).toBeLessThan(5.5);expect(result.error).toBe(null);expect(errors).toHaveLength(0);
 fs.writeFileSync('docs/evidence/supply-crate-se-20261111/release/public-audio.json',JSON.stringify({passed:true,checkedAt:new Date().toISOString(),result,errors,note:'公開MP3を実HTMLMediaElementで再生。ゲーム本体の操作確認とは区別する'},null,2));
 console.log(JSON.stringify({passed:true,...result}));
}finally{await browser.close();}
