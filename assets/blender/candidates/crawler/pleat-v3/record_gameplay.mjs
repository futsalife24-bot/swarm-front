import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {mux} from './motion_video_mux.mjs';
const dir='assets/blender/candidates/crawler/pleat-v3';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const p=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:1});
 await p.route('**/assets/enemies/hound_motion_v1.glb',r=>r.fulfill({path:dir+'/pleat_motion_v3.glb',contentType:'model/gltf-binary'}));
 await p.goto('http://127.0.0.1:5199/e2e/structure-fixture.html');
 const encoded=await p.evaluate(async()=>{
  const {Renderer}=await import('/src/client/render.ts'),g=await import('/src/shared/game.ts');
  const canvas=document.createElement('canvas'),d=document.createElement('div');d.id='damage';document.body.replaceChildren(canvas,d);
  const view=new Renderer(canvas),w=g.createWorld('pleat-pursuit',44,1);g.addPlayer(w,'p');g.start(w);w.enemies=[];w.nextSpawn=999;
  Object.assign(w.players[0],{x:0,z:0});g.spawn(w,'crawler',2,-9,'crown');const e=w.enemies[0];Object.assign(e,{x:2,z:-9,active:true,cool:0});
  view.render(w,'p',.016,0,0);await view.structures.get('crawler').loading;
  const output=document.createElement('canvas');output.width=960;output.height=540;const ctx=output.getContext('2d');
  const b64=a=>{let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s)};
  const result={chunks:[],config:null,states:[],worldMutations:0,bursts:[],speedMax:0};let error,accum=0,lastX=e.x,lastZ=e.z;
  const encoder=new VideoEncoder({output(chunk,m){const a=new Uint8Array(chunk.byteLength);chunk.copyTo(a);result.chunks.push({bytes:b64(a),key:chunk.type==='key',timestamp:chunk.timestamp});if(m?.decoderConfig?.description)result.config=b64(new Uint8Array(m.decoderConfig.description))},error:e=>error=String(e)});
  encoder.configure({codec:'avc1.42001f',width:960,height:540,framerate:30,bitrate:2800000,latencyMode:'realtime',avc:{format:'avc'}});
  for(let frame=0;frame<240;frame++){
   accum+=1/30;
   while(accum>=.05-1e-8){g.step(w,{},.05);accum-=.05;result.speedMax=Math.max(result.speedMax,Math.hypot(e.x-lastX,e.z-lastZ)/.05);lastX=e.x;lastZ=e.z}
   const before=JSON.stringify(w);view.render(w,'p',1/30,0,0);if(before!==JSON.stringify(w))result.worldMutations++;
   const state=view.structures.get('crawler').controller.states.get(e.id);if(state&&!result.states.includes(state.clip))result.states.push(state.clip);
   for(const ev of w.events.filter(e=>e.type==='burst'))if(!result.bursts.some(b=>b.id===ev.id))result.bursts.push(ev);
   // Fixed observation camera; same real scene / character / authoritative simulation.
   view.camera.position.set(8,4.3,2);view.camera.lookAt(0,.7,-3.5);view.renderer.render(view.scene,view.camera);
   ctx.drawImage(view.renderer.domElement,0,0,960,540);ctx.fillStyle='#101918';ctx.fillRect(0,0,960,50);ctx.fillRect(0,500,960,40);
   ctx.fillStyle='#e0e8d6';ctx.font='21px sans-serif';ctx.fillText('PLEAT / 現行の追跡・加速・溜め衝撃',20,32);
   ctx.font='15px sans-serif';ctx.fillText(`観察用カメラ · 実戦闘処理 · ${state?.clip??'Idle'} · HP ${w.players[0].hp}`,20,526);ctx.fillText('8秒 / 1× / offline 30fps',724,526);
   const v=new VideoFrame(output,{timestamp:Math.round(frame*1e6/30),duration:33333});encoder.encode(v,{keyFrame:frame%30===0});v.close();if(frame%30===29)await encoder.flush();
  }
  await encoder.flush();encoder.close();if(error)throw new Error(error);result.finalHP=w.players[0].hp;return result;
 });
 const bytes=mux(encoded);writeFileSync(dir+'/review/pleat_gameplay.mp4',bytes);
 assert.ok(encoded.states.includes('Locomotion')&&encoded.states.includes('Lunge'));assert.equal(encoded.worldMutations,0);assert.ok(encoded.bursts.length>0);assert.ok(Math.abs(encoded.speedMax-7.7)<.001);
 const playback=await p.evaluate(async dir=>{
  const v=document.createElement('video');v.muted=true;v.src='/'+dir+'/review/pleat_gameplay.mp4';document.body.append(v);await new Promise((ok,no)=>{v.onloadeddata=ok;v.onerror=no});
  const c=document.createElement('canvas');c.width=960;c.height=540;const ctx=c.getContext('2d'),samples=[];let poster;
  for(const t of [.6,1.7,3.2,6]){v.currentTime=t;await new Promise(ok=>v.onseeked=ok);await v.play();await new Promise(ok=>v.requestVideoFrameCallback(ok));v.pause();ctx.drawImage(v,0,0);const pixels=ctx.getImageData(0,0,960,540).data;let checksum=0;for(let i=0;i<pixels.length;i+=128)checksum+=pixels[i];samples.push({time:t,checksum});if(t===1.7)poster=c.toDataURL('image/png').split(',')[1]}
  return {duration:v.duration,width:v.videoWidth,height:v.videoHeight,samples,poster};
 },dir);
 assert.ok(Math.abs(playback.duration-8)<.01);assert.equal(new Set(playback.samples.map(x=>x.checksum)).size,4);
 writeFileSync(dir+'/review/gameplay-poster.png',Buffer.from(playback.poster,'base64'));
 const {chunks,config,...simulation}=encoded;delete playback.poster;
 writeFileSync(dir+'/validation/gameplay-video.json',JSON.stringify({simulation,playback,frames:240,bytes:bytes.length,scope:'isolated fixture, extra spawns deferred, fixed observation camera; real step and Renderer; not live-device FPS'},null,2));console.log('GAMEPLAY VIDEO PASS');
}finally{await browser.close()}
