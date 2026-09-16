import { chromium } from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const origin = process.env.BGM_ORIGIN || 'http://127.0.0.1:5367';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw Error('Local only');
const out='dist-validation/bgm';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
const page=await browser.newPage({viewport:{width:844,height:390},serviceWorkers:'block'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route(/\/src\/client\/playtest-app.ts(?:\?.*)?$/,async route=>{
 const r=await route.fetch();await route.fulfill({response:r,body:(await r.text())+`\nwindow.bgmFixture={screen:(s,win)=>{if(save)save.result={...save.result,win};setScreen(s);},volume:v=>sound.volume=v,clear:()=>{world.enemies=[];world.phase='victory';world.rewards.solo=[];world.drops=[];victory();}};`});
});
const state=()=>page.locator('audio[data-bgm]').evaluate(a=>({track:a.dataset.track,paused:a.paused,time:a.currentTime,duration:a.duration,loop:a.loop,volume:a.volume,muted:a.muted,error:a.error?.code}));
const playing=async track=>{await page.waitForFunction(t=>{const a=document.querySelector('audio[data-bgm]');return a?.dataset.track===t&&!a.paused&&a.currentTime>0},track);assert.equal(await page.locator('audio[data-bgm]').count(),1);};
try{
 await page.goto(origin);await page.locator('#solo').waitFor();
 if(await page.locator('#landscape-start').isVisible())await page.locator('#landscape-start').click();
 await page.locator('#home-tutorial').click();await playing('title');await page.keyboard.press('Escape');
 await page.locator('#open-bestiary').click();if(await page.locator('#pt-confirm').count())await page.locator('#pt-confirm').click();await playing('report');await page.locator('#report-close').click();await playing('title');
 await page.locator('#open-armory').click();if(await page.locator('#pt-confirm').count())await page.locator('#pt-confirm').click();await playing('base');
 const before=(await state()).time;
 await page.evaluate(()=>window.bgmFixture.screen('accessories'));await playing('base');assert.ok((await state()).time>=before);
 await page.evaluate(()=>window.bgmFixture.volume(0));assert.equal((await state()).paused,true);assert.equal((await state()).muted,true);
 await page.evaluate(()=>window.bgmFixture.volume(.5));await playing('base');assert.equal((await state()).volume,.275);
 await page.evaluate(()=>window.bgmFixture.screen('gear'));await playing('prepare');
 await page.evaluate(()=>window.bgmFixture.screen('loading'));await playing('prepare');
 await page.evaluate(()=>window.bgmFixture.screen('battle'));assert.equal((await state()).paused,true);assert.equal((await state()).track,undefined);
 await page.evaluate(()=>window.bgmFixture.screen('result',false));assert.equal((await state()).track,undefined);
 await page.evaluate(()=>window.bgmFixture.screen('stage-clear'));await playing('clear');assert.equal((await state()).loop,false);
 const clearDuration=(await state()).duration;
 await page.evaluate(()=>window.bgmFixture.screen('result',true));assert.equal((await state()).track,'clear');
 await page.waitForFunction(()=>document.querySelector('audio[data-bgm]').dataset.track==='victory',null,{timeout:30000});await playing('victory');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});assert.equal((await state()).paused,true);await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await playing('victory');
 await page.evaluate(()=>window.bgmFixture.screen('lobby'));await playing('lobby');
 const metadata=await page.evaluate(async()=>{
  const ctx=new AudioContext(),result=[];
  for(const name of ['title','base','prepare','lobby','report','clear','victory']){
   const r=await fetch('/assets/audio/bgm-v1/'+name+'.mp3');const bytes=await r.arrayBuffer();const size=bytes.byteLength;const b=await ctx.decodeAudioData(bytes);let sum=0,peak=0;const d=b.getChannelData(0);for(let i=0;i<d.length;i++){sum+=d[i]*d[i];peak=Math.max(peak,Math.abs(d[i]));}result.push({name,bytes:size,duration:b.duration,channels:b.numberOfChannels,sampleRate:b.sampleRate,rms:Math.sqrt(sum/d.length),peak});
  }await ctx.close();return result;
 });
 assert.deepEqual(errors,[]);assert.ok(metadata.every(m=>m.duration>0&&m.rms>0));
 await page.screenshot({path:out+'/browser.png'});
 fs.writeFileSync(out+'/checks.json',JSON.stringify({metadata,clearDuration,singlePlayer:true,reportReturn:true,sameTrackContinuity:true,muteResume:true,simulatedVisibilityPauseResume:true,clearOnceThenVictory:true,defeatSilent:true,battleSilent:true,errors},null,2));
 console.log(JSON.stringify({pass:true,metadata,clearDuration}));
}catch(e){console.log('DEBUG',await state(),errors,await page.locator('dialog[open]').allTextContents());throw e;}finally{await browser.close();}
