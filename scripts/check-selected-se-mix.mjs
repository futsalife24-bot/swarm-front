import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'chrome'});
try {
  const p=await browser.newPage();
  await p.goto('http://127.0.0.1:5346/scripts/se-preview.html');
  await p.getByRole('button',{name:'ライフル',exact:true}).click();
  await p.waitForFunction(()=>sound.buffers.size===26);
  const results=await p.evaluate(async()=>{
    const keys=['rifle','shotgun','rocket'], levels=[.62,.8,.75], rows=[];
    for(const key of keys){sound.stop();sound.last.clear();sound.play(key);const v=[...sound.voices][0];rows.push({key,selectedBuffer:v?.buffer===sound.buffers.get(key),duration:v?.buffer.duration});}
    sound.stop();
    const peaks=[];
    for(const offset of [0,.003]){
      const c=new OfflineAudioContext(2,128000,32000),bus=c.createGain(),comp=c.createDynamicsCompressor(),headroom=c.createGain();
      comp.threshold.value=-12;comp.knee.value=12;comp.ratio.value=6;comp.attack.value=.003;comp.release.value=.16;headroom.gain.value=.6;bus.connect(comp).connect(headroom).connect(c.destination);
      for(let i=0;i<32;i++){const src=c.createBufferSource(),g=c.createGain();src.buffer=sound.buffers.get(keys[i%3]);g.gain.value=levels[i%3];src.connect(g).connect(bus);src.start(i*offset);}
      const rendered=await c.startRendering();let peak=0;for(const v of rendered.getChannelData(0))peak=Math.max(peak,Math.abs(v));peaks.push({offset,peak});
    }
    return {rows,peaks};
  });
  assert.ok(results.rows.every(r=>r.selectedBuffer));assert.ok(results.peaks.every(r=>r.peak<1),JSON.stringify(results));
  fs.writeFileSync('dist-validation/selected-se/three-weapons.json',JSON.stringify(results,null,2));console.log('PASS',results);
}finally{await browser.close();}

