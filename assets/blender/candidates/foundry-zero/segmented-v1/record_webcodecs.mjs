// Existing PLEAT deterministic WebCodecs/MP4 mux and video readback workflow.
import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {mux} from './video-mux.mjs';
const dir='assets/blender/candidates/foundry-zero/segmented-v1';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const p=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:1});
 await p.goto(`http://127.0.0.1:5199/${dir}/index.html`);await p.waitForFunction(()=>window.foundryCandidate?.ready);
 const encoded=await p.evaluate(async()=>{
  const h=window.foundryCandidate;h.setPlaying(false);h.setView('oblique');h.select('flex');
  const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;const ctx=canvas.getContext('2d');
  const base64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s)};
  const result={chunks:[],config:null};let error;
  const encoder=new VideoEncoder({output(chunk,metadata){const bytes=new Uint8Array(chunk.byteLength);chunk.copyTo(bytes);result.chunks.push({bytes:base64(bytes),key:chunk.type==='key',timestamp:chunk.timestamp});if(metadata?.decoderConfig?.description)result.config=base64(new Uint8Array(metadata.decoderConfig.description))},error(e){error=String(e)}});
  encoder.configure({codec:'avc1.42001f',width:960,height:540,framerate:30,bitrate:3500000,latencyMode:'realtime',avc:{format:'avc'}});
  for(let f=0;f<180;f++){
   h.draw(f/30);ctx.drawImage(h.renderer.domElement,0,0,960,540);ctx.fillStyle='rgba(7,18,25,.86)';ctx.fillRect(0,0,960,50);ctx.fillRect(0,503,960,37);
   ctx.fillStyle='#d7ecf0';ctx.font='bold 22px sans-serif';ctx.fillText('FOUNDRY ZERO / ARTICULATION CANDIDATE',20,32);ctx.font='15px sans-serif';ctx.fillStyle='#68cdda';ctx.fillText('8 units / in-place flex / gameplay behavior not specified',20,527);
   const frame=new VideoFrame(canvas,{timestamp:Math.round(f*1e6/30),duration:Math.round(1e6/30)});encoder.encode(frame,{keyFrame:f%30===0});frame.close();
   if(f%30===29){await encoder.flush();if(error)throw new Error(error)}
  }
  await encoder.flush();encoder.close();if(error)throw new Error(error);return result;
 });
 assert.equal(encoded.chunks.length,180);assert.ok(encoded.config);const bytes=mux(encoded);writeFileSync(`${dir}/review/articulation.mp4`,bytes);
 const playback=await p.evaluate(async base64=>{
  const video=document.createElement('video');video.src=URL.createObjectURL(new Blob([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],{type:'video/mp4'}));video.muted=true;document.body.append(video);await new Promise((ok,no)=>{video.onloadeddata=ok;video.onerror=no});
  const positions=[],posters=[];const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;const ctx=canvas.getContext('2d');
  for(const t of [.1,1,2,3.9,5.5]){video.currentTime=t;await new Promise((ok,no)=>{video.onseeked=ok;video.onerror=no});await video.play();await new Promise(ok=>video.requestVideoFrameCallback(ok));video.pause();ctx.drawImage(video,0,0);const pixels=ctx.getImageData(0,0,960,540).data;let checksum=0;for(let i=0;i<pixels.length;i+=128)checksum+=pixels[i];positions.push({time:t,checksum});if(t===1||t===3.9)posters.push({time:t,png:canvas.toDataURL('image/png').split(',')[1]})}
  const result={duration:video.duration,width:video.videoWidth,height:video.videoHeight,positions,posters};URL.revokeObjectURL(video.src);video.remove();return result;
 },bytes.toString('base64'));
 assert.ok(Math.abs(playback.duration-6)<.01);assert.ok(new Set(playback.positions.map(x=>x.checksum)).size>2);
 for(const poster of playback.posters)writeFileSync(`${dir}/review/video-${poster.time}.png`,Buffer.from(poster.png,'base64'));
 const {posters,...info}=playback;const report={...info,frames:180,fps:30,bytes:bytes.length,method:'Deterministic WebCodecs H264 / existing ISO-BMFF mux; saved bytes decoded and played/seeked at 5 times',limitations:['Structural exercise only; no gameplay speed','Offline 30fps video is not runtime mobile FPS']};
 writeFileSync(`${dir}/video-validation.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close()}
