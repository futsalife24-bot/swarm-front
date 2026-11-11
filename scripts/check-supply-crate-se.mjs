import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { render, mix, SR } from '../public/supply-reveal/sfx.js';
import { build } from '../public/supply-reveal/core.js';

const out='docs/evidence/supply-crate-se-20261111';
fs.mkdirSync(out,{recursive:true});
const results=Array.from({length:10},(_,i)=>i===5?{type:'shard',amount:10}:{type:'weapon',rarity:i%3===0?'R':'N',name:'開封SE確認',art:'w-rifle'});
const model=build(results),opens=model.cues.filter(c=>['pop','pop_r'].includes(c.id));
assert.equal(opens.length,10); assert(opens.every(c=>c.rate===1));
const stats=a=>({frames:a.length,peak:Math.max(...a),rms:Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length)});
const expected=Object.fromEntries(['pop','pop_r'].map(id=>{
  const a=render(id)[0];assert(a.every(Number.isFinite));assert(a.length>SR*.3&&a.length<SR*.5);
  assert(Math.max(...a.map(Math.abs))<=.501);assert(Math.abs(a.at(-1))===0);
  return[id,stats(a)];
}));
const wav=(channels,file)=>{
  const n=channels[0].length,b=Buffer.alloc(44+n*4);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(SR,24);b.writeUInt32LE(SR*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*4,40);
  for(let i=0;i<n;i++)for(let c=0;c<2;c++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,channels[c][i]))*32767),44+(i*2+c)*2);
  fs.writeFileSync(file,b);
};
wav(mix(opens.map((c,i)=>({...c,t:.1+i*.47,pan:0})),5.2),`${out}/crate-open-ten.wav`);
const html=`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/supply-reveal/gacha.css"><body style="margin:0"><script type="module">
import{createSupplyReveal}from'/supply-reveal/runtime.js';
window.probe=createSupplyReveal(document.body,{sound:true,fast:true,warm:true,label:'開封SE確認・取得なし'});
await probe.ready;await probe.play(${JSON.stringify(results)},{effects:0});window.probeReady=true;
</script>`;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');if(url.pathname==='/probe'){res.setHeader('Content-Type','text/html');res.end(html);return;}
  const file=path.resolve('public','.'+url.pathname);if(!file.startsWith(path.resolve('public')+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':'application/octet-stream');res.end(fs.readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});let report;
try{
 const page=await browser.newPage({viewport:{width:844,height:390}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
   window.audioSources=[];
   const start=AudioBufferSourceNode.prototype.start;
   AudioBufferSourceNode.prototype.start=function(...args){const a=this.buffer?.getChannelData(0);if(a){let peak=0,sum=0;for(const x of a){peak=Math.max(peak,x);sum+=x*x;}window.audioSources.push({frames:a.length,peak,rms:Math.sqrt(sum/a.length),rate:this.playbackRate.value});}return start.apply(this,args);};
 });
 await page.goto(`http://127.0.0.1:${server.address().port}/probe`);
 await page.waitForFunction(()=>window.probeReady);
 await page.locator('[data-act="sound"]').click();await page.locator('[data-act="sound"]').click();
 const deadline=Date.now()+60000;
 while(await page.evaluate(()=>probe.state().waiting!=='final')){
   assert(Date.now()<deadline,'10連が完走しません');
   await page.locator('.gx-root').click({position:{x:420,y:225}});await page.waitForTimeout(170);
 }
 const all=await page.evaluate(()=>window.audioSources);
 const heard=all.filter(a=>Object.values(expected).some(e=>e.frames===a.frames));
 assert.equal(heard.length,10);assert(heard.every(a=>a.rate===1));
 for(const a of heard){const e=Object.values(expected).find(e=>e.frames===a.frames);assert(Math.abs(a.rms-e.rms)<1e-5);}
 assert.deepEqual(errors,[]);await page.screenshot({path:`${out}/browser-finished.png`});
 report={passed:true,expected,cues:opens.length,browserCrateSources:heard,errors,fixture:'隔離した表示専用10連、実WebAudioのstartを観測。券/取得APIなし'};
 console.log(JSON.stringify({passed:true,opens:heard.length,errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));if(report)fs.writeFileSync(`${out}/audio-check.json`,JSON.stringify(report,null,2));}
