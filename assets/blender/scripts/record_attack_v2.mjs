import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {mux} from './motion_video_mux.mjs';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const out='dist-validation/attack-v2',reports=[];
try {
 const p=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:1});
 await p.goto('http://127.0.0.1:5198/assets/blender/preview-enemy-motion/index.html');await p.waitForFunction(()=>window.enemyMotion?.ready);
 for(const name of ['ray','foundry_zero']){
  const encoded=await p.evaluate(async name=>{
   const h=window.enemyMotion;h.setPlaying(false);h.selectEnemy(name);h.setView('oblique');
   const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;const ctx=canvas.getContext('2d');
   const b64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s)};
   const duration=h.assets[name].clips.find(c=>c.name==='Attack').duration;const frames=Math.round(duration*60);const result={chunks:[],config:null,duration:frames/30,frames};let error;
   const encoder=new VideoEncoder({output(chunk,metadata){const bytes=new Uint8Array(chunk.byteLength);chunk.copyTo(bytes);result.chunks.push({bytes:b64(bytes),key:chunk.type==='key',timestamp:chunk.timestamp});if(metadata?.decoderConfig?.description)result.config=b64(new Uint8Array(metadata.decoderConfig.description))},error:e=>error=String(e)});
   encoder.configure({codec:'avc1.42001f',width:960,height:540,framerate:30,bitrate:3000000,latencyMode:'realtime',avc:{format:'avc'}});
   let previous='';
   for(let f=0;f<frames;f++){
    const t=f/30,clip='Attack',local=t%duration;h.setView(t<duration?'oblique':'side');
    if(clip!==previous){h.select(clip);previous=clip}h.draw(local);ctx.drawImage(h.renderer.domElement,0,0);
    ctx.fillStyle='#102029ee';ctx.fillRect(0,0,960,70);ctx.fillRect(0,494,960,46);ctx.fillStyle='#e2eeed';ctx.font='24px sans-serif';ctx.fillText(name.replace('_',' ').toUpperCase()+' / ATTACK STUDY 02',24,43);ctx.font='17px sans-serif';ctx.fillStyle='#8ee3d5';ctx.fillText(({Idle:'待機 / IDLE',Locomotion:'移動 / LOCOMOTION',Attack:'攻撃 / ATTACK'})[clip],24,523);ctx.fillText('1× · 30 fps · LOCAL PROTOTYPE',655,523);
    const frame=new VideoFrame(canvas,{timestamp:Math.round(f*1e6/30),duration:Math.round(1e6/30)});encoder.encode(frame,{keyFrame:f%30===0});frame.close();if(f%30===29){await encoder.flush();if(error)throw Error(error)}
   }await encoder.flush();encoder.close();if(error)throw Error(error);return result;
  },name);
  assert.equal(encoded.chunks.length,encoded.frames);assert.ok(encoded.config);const bytes=mux(encoded);writeFileSync(`${out}/${name}/attack-v2.mp4`,bytes);
  const playback=await p.evaluate(async base64=>{
   const v=document.createElement('video');v.muted=true;v.src=URL.createObjectURL(new Blob([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],{type:'video/mp4'}));document.body.append(v);await new Promise((ok,no)=>{v.onloadeddata=ok;v.onerror=no});
   const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;const ctx=canvas.getContext('2d'),samples=[];
   for(const t of [.4,1.9,3.3]){v.currentTime=t;await new Promise((ok,no)=>{v.onseeked=ok;v.onerror=no});await v.play();await new Promise(ok=>v.requestVideoFrameCallback(ok));v.pause();ctx.drawImage(v,0,0);const pixels=ctx.getImageData(0,0,960,540).data;let checksum=0;for(let i=0;i<pixels.length;i+=128)checksum+=pixels[i];samples.push({time:t,checksum,image:canvas.toDataURL('image/png').split(',')[1]})}
   const report={duration:v.duration,width:v.videoWidth,height:v.videoHeight,samples};URL.revokeObjectURL(v.src);v.remove();return report;
  },bytes.toString('base64'));
  assert.ok(Math.abs(playback.duration-encoded.duration)<.01);assert.equal(new Set(playback.samples.map(s=>s.checksum)).size,3);
  for(const [i,s] of playback.samples.entries()){writeFileSync(`${out}/${name}/video-frame-${i}.png`,Buffer.from(s.image,'base64'));delete s.image}
  reports.push({name,bytes:bytes.length,frames:encoded.frames,fps:30,...playback});console.log('VIDEO PASS',name);
 }
 writeFileSync(out+'/video-validation.json',JSON.stringify(reports,null,2));
}finally{await browser.close()}
