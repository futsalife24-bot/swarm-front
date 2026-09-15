import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base='http://127.0.0.1:5372',out='dist-validation/ar-hit';
const browser=await chromium.launch({channel:'chrome'});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/scripts/se-preview.html');
 await page.getByRole('button',{name:'ライフル',exact:true}).click();
 await page.waitForFunction(()=>sound.buffers.size===30);
 const result=await page.evaluate(async()=>{
  const g=await import('/src/shared/game.ts'),{STARTERS}=await import('/src/shared/defs.ts');
  const s=sound,rows=[];
  for(const [kind,form,key] of [['crawler',undefined,'impactShell'],['ant',undefined,'impactShell'],['spider',undefined,'impactShell'],['spitter',undefined,'impactHard'],['hornet',undefined,'impactSoft'],['boss','crown','impactHard'],['boss','worm','impactHard']]) {
   s.stop();s.last.clear();
   const w=g.createWorld('ar-'+kind+'-'+form),p=g.addPlayer(w,'p',structuredClone(STARTERS.slice(0,2)));g.start(w);w.enemies=[];w.nextSpawn=1e9;
   s.update(w,p.id,0,true);g.spawn(w,kind,p.x,p.z-5,form);const e=w.enemies[0];
   if(form==='worm')g.hurtEnemy(w,e,1,p.id,1,'rifle');
   else g.fire(w,p,{...g.neutral(),fire:true,pitch:Math.atan2(g.eye(e)-((p.y??0)+1.5),5)});
   s.update(JSON.parse(JSON.stringify(w)),p.id,0,true);
   const voices=[...s.voices],selected=voices.filter(v=>v.buffer===s.buffers.get(key)).length;
   const generic=voices.filter(v=>v.buffer===s.buffers.get('impact')).length;
   s.update(w,p.id,0,true);rows.push({kind,form,key,selected,generic,noReplay:s.voices.size===voices.length});
  }
  const clips=['impactShell','impactHard','impactSoft'].map(key=>{const b=s.buffers.get(key),a=b.getChannelData(0);return {key,seconds:b.duration,peak:Math.max(...a),rms:Math.sqrt(a.reduce((v,x)=>v+x*x,0)/a.length)}});
  s.stop();s.last.clear();s.play('impactShell',1,0,'impact:p');s.play('impactHard',1,0,'impact:p');const sameOwner=s.voices.size;s.play('impactSoft',1,0,'impact:other');const otherOwner=s.voices.size;
  s.stop();s.last.clear();for(let i=0;i<40;i++)s.play(['impactShell','impactHard','impactSoft'][i%3],1,0,'cap'+i);const cap=s.voices.size;
  s.volume=0;const muted=s.voices.size;s.play('impactHard');const mutedAfter=s.voices.size;s.volume=.35;
  s.last.clear();s.play('impactShell');s.play('menu');s.stop(true);const pauseRemaining=[...s.voices].map(v=>v.buffer===s.buffers.get('menu'));s.stop();
  // Capture actual gain nodes to ensure enemy-hit distance attenuation still applies.
  const gains=[],old=s.play;s.play=function(...args){gains.push(args);return old.apply(this,args)};
  const w=g.createWorld('distance'),p=g.addPlayer(w,'p');g.start(w);w.enemies=[];s.update(w,'p',0,true);
  w.events.push({id:999999,type:'hit',weapon:'rifle',enemyKind:'spitter',owner:'p',x:p.x+13,z:p.z,y:1});s.update(w,'p',0,true);s.play=old;
  const peaks=[];
  for(const offset of [0,.003]) {
   const c=new OfflineAudioContext(2,96000,48000),bus=c.createGain(),comp=c.createDynamicsCompressor(),head=c.createGain();
   comp.threshold.value=-12;comp.knee.value=12;comp.ratio.value=6;comp.attack.value=.003;comp.release.value=.16;head.gain.value=.6;bus.connect(comp).connect(head).connect(c.destination);
   for(let i=0;i<32;i++){const key=['rifle','impactShell','impactHard','impactSoft'][i%4],src=c.createBufferSource(),gain=c.createGain();src.buffer=s.buffers.get(key);gain.gain.value=key==='rifle'?.62:.24;src.connect(gain).connect(bus);src.start(i*offset)}
   const b=await c.startRendering();let peak=0;for(const x of b.getChannelData(0))peak=Math.max(peak,Math.abs(x));peaks.push({offset,peak});
  }
  return {rows,clips,sameOwner,otherOwner,cap,muted,mutedAfter,pauseRemaining,gains,peaks};
 });
 assert.ok(result.rows.every(r=>r.selected===1&&r.generic===0&&r.noReplay),JSON.stringify(result.rows));
 assert.ok(result.clips.every(c=>c.peak<1&&c.rms>.005));
 assert.equal(result.sameOwner,1);assert.equal(result.otherOwner,2);assert.equal(result.cap,32);assert.equal(result.muted,0);assert.equal(result.mutedAfter,0);assert.deepEqual(result.pauseRemaining,[true]);assert.equal(result.gains[0][1],.5);assert.ok(result.peaks.every(r=>r.peak<1));assert.deepEqual(errors,[]);
 fs.writeFileSync(out+'/browser.json',JSON.stringify({...result,errors},null,2));console.log('PASS',JSON.stringify(result));
} finally {await browser.close()}
