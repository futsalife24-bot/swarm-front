import {chromium} from '@playwright/test';
import {writeFileSync,mkdirSync,existsSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out='dist-validation/hound-motion/review';mkdirSync(out,{recursive:true});
// Minimal ISO-BMFF mux for an AVC stream with no reordered frames (realtime baseline profile).
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n>>>0);return b},u16=n=>{const b=Buffer.alloc(2);b.writeUInt16BE(n);return b},zero=n=>Buffer.alloc(n);
const box=(name,...parts)=>{const payload=Buffer.concat(parts);return Buffer.concat([u32(payload.length+8),Buffer.from(name),payload])};
const full=(name,flags,...parts)=>box(name,u32(flags),...parts);
const matrix=Buffer.concat([u32(65536),u32(0),u32(0),u32(0),u32(65536),u32(0),u32(0),u32(0),u32(0x40000000)]);
function mux(encoded){
 const samples=encoded.chunks.map(c=>Buffer.from(c.bytes,'base64')),count=samples.length,duration=count*3000;
 const ftyp=box('ftyp',Buffer.from('isom'),u32(512),Buffer.from('isomiso2avc1mp41'));
 const mdat=box('mdat',...samples);
 const mvhd=full('mvhd',0,u32(0),u32(0),u32(90000),u32(duration),u32(65536),u16(256),zero(10),matrix,zero(24),u32(2));
 const tkhd=full('tkhd',7,u32(0),u32(0),u32(1),u32(0),u32(duration),zero(8),u16(0),u16(0),u16(0),u16(0),matrix,u32(960*65536),u32(540*65536));
 const mdhd=full('mdhd',0,u32(0),u32(0),u32(90000),u32(duration),u16(0x55c4),u16(0));
 const hdlr=full('hdlr',0,u32(0),Buffer.from('vide'),zero(12),Buffer.from('HOUND review\0'));
 const avc1=box('avc1',zero(6),u16(1),zero(16),u16(960),u16(540),u32(0x00480000),u32(0x00480000),u32(0),u16(1),zero(32),u16(24),u16(0xffff),box('avcC',Buffer.from(encoded.config,'base64')));
 const stsd=full('stsd',0,u32(1),avc1),stts=full('stts',0,u32(1),u32(count),u32(3000)),stsc=full('stsc',0,u32(1),u32(1),u32(count),u32(1)),stsz=full('stsz',0,u32(0),u32(count),...samples.map(b=>u32(b.length))),stco=full('stco',0,u32(1),u32(ftyp.length+8));
 const keys=encoded.chunks.map((c,i)=>c.key?i+1:null).filter(Boolean),stss=full('stss',0,u32(keys.length),...keys.map(u32));
 const stbl=box('stbl',stsd,stts,stsc,stsz,stco,stss),dinf=box('dinf',full('dref',0,u32(1),full('url ',1)));
 const minf=box('minf',full('vmhd',1,zero(8)),dinf,stbl),moov=box('moov',mvhd,box('trak',tkhd,box('mdia',mdhd,hdlr,minf)));
 return Buffer.concat([ftyp,mdat,moov]);
}
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const qa=[];
try{
 const p=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:1});await p.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));await p.exposeFunction('frameProgress',(view,frame)=>console.log(view,frame+'/402'));
 await p.goto('http://127.0.0.1:5198/assets/blender/preview-motion/index.html');await p.waitForFunction(()=>window.houndMotion?.ready);await p.evaluate(()=>window.houndMotion.setPlaying(false));
 for(const view of ['oblique','side']){
  const existingPath=`${out}/hound_motion_${view}.mp4`;
  const previous=existsSync(existingPath)?readFileSync(existingPath):Buffer.alloc(0),table=previous.lastIndexOf(Buffer.from('stsz'));
  const valid=table>0&&previous.readUInt32BE(table+12)===402;
  const encoded=valid?null:await p.evaluate(async(view)=>{
   const h=window.houndMotion;h.setPlaying(false);h.setCount(1);h.setView(view);const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;const ctx=canvas.getContext('2d');
   const base64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s)};
   const result={chunks:[],config:null};let error;
   const encoder=new VideoEncoder({output(chunk,metadata){const bytes=new Uint8Array(chunk.byteLength);chunk.copyTo(bytes);result.chunks.push({bytes:base64(bytes),key:chunk.type==='key',timestamp:chunk.timestamp});if(metadata?.decoderConfig?.description)result.config=base64(new Uint8Array(metadata.decoderConfig.description))},error(e){error=String(e)}});
   encoder.configure({codec:'avc1.42001f',width:960,height:540,framerate:30,bitrate:3500000,latencyMode:'realtime',avc:{format:'avc'}});
   let last='';
   for(let f=0;f<402;f++){
    const t=f/30,mode=t<4?'Idle':t<8?'Locomotion':'Lunge',local=t<4?t:t<8?t-4:(t-8)%1.8;if(mode!==last){h.select(mode);last=mode;}h.draw(local);
    ctx.drawImage(h.renderer.domElement,0,0,960,540);ctx.fillStyle='rgba(10,21,31,.85)';ctx.fillRect(0,0,960,56);ctx.fillRect(0,500,960,40);
    ctx.fillStyle='#e4f3f5';ctx.font='bold 22px sans-serif';ctx.fillText('HOUND v3 / MOTION READY',22,35);ctx.font='16px sans-serif';ctx.fillStyle='#62ecf5';ctx.fillText(mode==='Idle'?'待機 / 独立した安定化':mode==='Locomotion'?'移動 / 前脚の引き込みと後脚の支持':local<.45?'攻撃 / 0.45秒予兆':local<.69?'攻撃 / 衝撃動作':'攻撃 / 復帰',22,525);ctx.fillStyle='#d0dce2';ctx.fillText(view==='side'?'SIDE · 1× · 30 fps':'OBLIQUE · 1× · 30 fps',740,525);
    const frame=new VideoFrame(canvas,{timestamp:Math.round(f*1e6/30),duration:Math.round(1e6/30)});encoder.encode(frame,{keyFrame:f%30===0});frame.close();
    if(f%30===29){await encoder.flush();if(error)throw new Error(error);}if(f%90===0)await window.frameProgress(view,f);
   }
   await encoder.flush();encoder.close();if(error)throw new Error(error);return result;
  },view);
  if(encoded){assert.equal(encoded.chunks.length,402);assert.ok(encoded.config);assert.ok(encoded.chunks.every((c,i)=>i===0||c.timestamp>encoded.chunks[i-1].timestamp));}
  const bytes=encoded?mux(encoded):previous,path=`${out}/hound_motion_${view}.mp4`;writeFileSync(path,bytes);
  const playback=await p.evaluate(async(base64)=>{const video=document.createElement('video');video.src=URL.createObjectURL(new Blob([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],{type:'video/mp4'}));video.muted=true;document.body.append(video);await new Promise((ok,no)=>{video.onloadeddata=ok;video.onerror=no});const positions=[];const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;const ctx=canvas.getContext('2d');let poster;
   for(const t of [.1,6,8.4,12.8]){video.currentTime=t;await new Promise((ok,no)=>{video.onseeked=ok;video.onerror=no});await video.play();await new Promise(ok=>video.requestVideoFrameCallback(ok));video.pause();ctx.drawImage(video,0,0);const px=ctx.getImageData(0,0,960,540).data;let sum=0;for(let i=0;i<px.length;i+=128)sum+=px[i];positions.push({time:t,pixelChecksum:sum});if(t===6)poster=canvas.toDataURL('image/png').split(',')[1];}
   const info={duration:video.duration,width:video.videoWidth,height:video.videoHeight,positions,poster};URL.revokeObjectURL(video.src);video.remove();return info;
  },bytes.toString('base64'));
  assert.ok(Math.abs(playback.duration-13.4)<.01);assert.ok(new Set(playback.positions.map(x=>x.pixelChecksum)).size>2);writeFileSync(`${out}/hound_motion_${view}_poster.png`,Buffer.from(playback.poster,'base64'));const {poster,...info}=playback;qa.push({view,...info,frames:402,fps:30,bytes:bytes.length,method:'deterministic WebCodecs H264 / ISO-BMFF; not a runtime FPS measurement'});console.log('VIDEO PASS',qa.at(-1));
 }
 for(const [view,clip,time,name] of [['front','Locomotion',.3,'front'],['oblique','Idle',1,'idle'],['side','Lunge',.40,'charge'],['side','Lunge',.48,'impact']]){await p.evaluate(({view,clip,time})=>{const h=window.houndMotion;h.setView(view);h.select(clip);h.draw(time)},{view,clip,time});await p.screenshot({path:`${out}/hound_motion_${name}.png`});}
 await p.setViewportSize({width:844,height:390});await p.evaluate(()=>{const h=window.houndMotion;h.setView('oblique');h.select('Locomotion');h.draw(.3)});await p.screenshot({path:out+'/hound_motion_mobile.png'});
 writeFileSync('dist-validation/hound-motion/video-validation.json',JSON.stringify(qa,null,2));
}finally{await browser.close()}
