const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = __dirname;
const generation = JSON.parse(fs.readFileSync(path.join(root, 'generation.json'), 'utf8'));
if (generation.clips.length !== 6) throw Error('Expected six completed clips');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const labels = {dodge:'回避',rescued:'被救助 ①','rescued-alt':'被救助 ②',danger:'ピンチ ①','danger-alt':'ピンチ ②',start:'バトル開始'};
const acting = {dodge:'一瞬の回避。腹から鋭く、短く。',rescued:'救われた感謝を、戦闘中の仲間へ。','rescued-alt':'助かった安堵から、もう一度戦う気力へ。',danger:'痛みをこらえ、闘志で言い切る。','danger-alt':'危険に気づいた焦りを、低く抑えて。',start:'覚悟を決めてから、仲間を前へ促す。'};
const clips = generation.clips.map(c => {
  const source = fs.readFileSync(path.join(root,c.sourceFile));
  const wav = Buffer.from(source);
  if (source.toString('ascii',0,4)!=='RIFF' || source.toString('ascii',8,12)!=='WAVE' || source.readUInt32LE(4)+8!==source.length) throw Error(`Invalid RIFF: ${c.id}`);
  let fmt, dataOffset, dataBytes;
  for (let p=12;p+8<=source.length;) {
    const n=source.readUInt32LE(p+4), id=source.toString('ascii',p,p+4);
    if (p+8+n>source.length) throw Error('Truncated chunk');
    if(id==='fmt ') fmt={offset:p+8,format:source.readUInt16LE(p+8),channels:source.readUInt16LE(p+10),sampleRate:source.readUInt32LE(p+12),byteRate:source.readUInt32LE(p+16),blockAlign:source.readUInt16LE(p+20),bits:source.readUInt16LE(p+22)};
    if(id==='data'){dataOffset=p+8;dataBytes=n;}
    p+=8+n+(n%2);
  }
  if(!fmt || dataOffset===undefined || fmt.format!==1 || fmt.bits!==16 || fmt.channels!==1 || dataBytes%2!==0 || fmt.blockAlign!==2) throw Error(`Unexpected PCM: ${c.id}`);
  const expectedByteRate=fmt.sampleRate*fmt.blockAlign;
  wav.writeUInt32LE(expectedByteRate,fmt.offset+8);
  let peak=0,sum=0,clipped=0,first=-1,last=-1;
  for(let p=0;p<dataBytes;p+=2){const v=source.readInt16LE(dataOffset+p),a=Math.abs(v);peak=Math.max(peak,a/32768);sum+=(v/32768)**2;if(a>=32767)clipped++;if(a>164){if(first<0)first=p/2;last=p/2;}}
  const samples=dataBytes/2,rms=Math.sqrt(sum/samples),seconds=dataBytes/expectedByteRate;
  if(rms<0.001 || first<0 || seconds<=0 || seconds>8)throw Error(`Invalid or silent clip: ${c.id}`);
  if(clipped>0)throw Error(`Clipped samples require review: ${c.id}`);
  if(!source.subarray(dataOffset,dataOffset+dataBytes).equals(wav.subarray(dataOffset,dataOffset+dataBytes)))throw Error('PCM must remain unchanged');
  const file=c.id+'.wav';fs.writeFileSync(path.join(root,file),wav);
  const previewFile=c.id+'-preview.wav',previewGain=0.85/peak;
  const trimStart=Math.max(0,first-Math.round(fmt.sampleRate*0.030));
  const trimEnd=Math.min(samples,last+1+Math.round(fmt.sampleRate*0.060));
  const previewDataBytes=(trimEnd-trimStart)*2;
  const preview=Buffer.alloc(44+previewDataBytes);
  preview.write('RIFF',0);preview.writeUInt32LE(36+previewDataBytes,4);preview.write('WAVEfmt ',8);preview.writeUInt32LE(16,16);preview.writeUInt16LE(1,20);preview.writeUInt16LE(1,22);preview.writeUInt32LE(fmt.sampleRate,24);preview.writeUInt32LE(expectedByteRate,28);preview.writeUInt16LE(2,32);preview.writeUInt16LE(16,34);preview.write('data',36);preview.writeUInt32LE(previewDataBytes,40);
  let previewPeak=0,previewClipped=0;
  for(let p=0;p<previewDataBytes;p+=2){const v=Math.round(wav.readInt16LE(dataOffset+trimStart*2+p)*previewGain);if(Math.abs(v)>=32767)previewClipped++;previewPeak=Math.max(previewPeak,Math.abs(v)/32768);preview.writeInt16LE(v,44+p)}
  if(previewClipped)throw Error('Preview normalization clipped');
  fs.writeFileSync(path.join(root,previewFile),preview);
  return {...c,label:labels[c.id],acting:c.acting||acting[c.id],file,previewFile,previewGain,previewGainDb:20*Math.log10(previewGain),previewPeak,previewClippedSamples:previewClipped,previewSha256:hash(preview),previewProcessing:'constant gain to peak 0.85; trim only outer near-silence <=164/32768 preserving 30ms head and 60ms tail; no pitch, speed or dynamics processing',trimStartSeconds:trimStart/fmt.sampleRate,trimEndSeconds:(samples-trimEnd)/fmt.sampleRate,previewSeconds:previewDataBytes/expectedByteRate,sampleRate:fmt.sampleRate,channels:fmt.channels,bits:fmt.bits,seconds,peak,rms,clippedSamples:clipped,leadingBelowThresholdSeconds:first/fmt.sampleRate,trailingBelowThresholdSeconds:(samples-1-last)/fmt.sampleRate,sourceByteRate:fmt.byteRate,correctedByteRate:expectedByteRate,headerCorrected:fmt.byteRate!==expectedByteRate,sourceSha256:hash(source),sha256:hash(wav),pcmUnchanged:true};
});
if(new Set(clips.map(c=>c.sha256)).size!==clips.length)throw Error('Duplicate clips');
const manifest={...generation,generatedCount:clips.length,model:'gemini-3.8-flash-tts',voice:'Fenrir',status:'generated; technical validation passed; listening review pending; not yet integrated',qa:'WAV header, RIFF size, non-silence, clipping, unique hash and unchanged PCM verified. No claim of perceptual acting or pronunciation approval.',officialGuide:'https://ai.google.dev/gemini-api/docs/speech-generation',clips};
fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cards=clips.map((c,i)=>`<article><div class="meta"><span>${escape(c.label)}</span><span>${c.previewSeconds.toFixed(2)} 秒</span></div><h2>${escape(c.line)}</h2><p>${escape(c.acting)}</p><audio id="clip-${i}" aria-label="${escape(c.line)}" controls preload="metadata" src="data:audio/wav;base64,${fs.readFileSync(path.join(root,c.previewFile)).toString('base64')}"></audio><details><summary>演技の指示を見る</summary><p>${escape(c.direction)}</p></details></article>`).join('');
const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>スワフロ｜Fenrir 演技ボイス試聴</title><style>*{box-sizing:border-box}body{margin:0;background:#101720;color:#edf4f5;font-family:system-ui,sans-serif;line-height:1.65}main{max-width:900px;margin:auto;padding:28px 20px 40px}.eyebrow{font-size:12px;letter-spacing:.16em;color:#6fe2b7;font-weight:700}h1{font-size:clamp(24px,5vw,34px);line-height:1.3;margin:8px 0 14px}header p{color:#b5c6d2;max-width:640px}.toolbar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:24px 0}button{background:#6fe2b7;color:#12291e;border:0;border-radius:10px;padding:13px 22px;font-weight:750;font-size:16px;cursor:pointer}button:focus-visible,summary:focus-visible{outline:3px solid white;outline-offset:4px}#progress{font-size:14px;color:#cad9df}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}article{background:#1b2835;border:1px solid #3b5263;border-radius:14px;padding:20px;min-width:0}.meta{display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#8cc4b6}h2{font-size:23px;margin:12px 0 6px}article p{font-size:14px;color:#c4d2dc;margin:0 0 18px}audio{width:100%;display:block;height:40px}details{margin-top:16px;border-top:1px solid #3a4b58;padding-top:10px}summary{font-size:13px;color:#a9bbc8;cursor:pointer}details p{margin:12px 0 0;font-size:13px}footer{margin-top:26px;color:#9eb2bf;font-size:13px}a{color:#83d9bd}@media(max-width:600px){main{padding:22px 16px}.grid{grid-template-columns:1fr}article{padding:18px}}</style></head><body><main><header><div class="eyebrow">SWARM FRONT · VOICE TRYOUT</div><h1>同じ兵士、6つの演技。</h1><p>Gemini 3.8 Flash TTS ／ Fenrir<br>回避の瞬発力、救助の安堵、ピンチの強がり。場面に合わせて演技を指定した新しい6台詞です。</p></header><div class="toolbar"><button id="play-all" type="button">6本まとめて再生</button><span id="progress" role="status" aria-live="polite">一つずつでも再生できます</span></div><div class="grid">${cards}</div><footer>試聴用の新規候補です。ゲーム内の採用済み11台詞はそのままです。<br><a href="https://www.youtube.com/watch?v=G_dPRcof2Ks&t=246" target="_blank" rel="noopener">参考動画の演技解説</a>を踏まえ、台詞と演技指示を分けて生成しました。</footer></main><script>const players=Array.from(document.querySelectorAll('audio')),button=document.querySelector('#play-all'),progress=document.querySelector('#progress');let sequence=false,index=0;function stop(){sequence=false;players.forEach(a=>a.pause());button.textContent='6本まとめて再生'}async function next(){if(!sequence)return;if(index>=players.length){stop();progress.textContent='6 / 6 本 再生完了';return}progress.textContent=(index+1)+' / 6 本 再生中';players[index].currentTime=0;try{await players[index].play()}catch{stop();progress.textContent='各音声の再生ボタンを押してください'}}button.addEventListener('click',()=>{if(sequence){stop();progress.textContent='再生を停止しました';return}players.forEach(a=>a.pause());sequence=true;index=0;button.textContent='再生を停止';next()});players.forEach((a,i)=>{a.addEventListener('play',()=>{players.forEach(other=>{if(other!==a)other.pause()});if(sequence&&i!==index){sequence=false;button.textContent='6本まとめて再生'}});a.addEventListener('ended',()=>{if(sequence&&i===index){index++;next()}})});</script></body></html>`;
fs.writeFileSync(path.join(root,'listen.html'),html.replace('同じ兵士、6つの演技。','改訂2・6台詞。').replace('回避の瞬発力、救助の安堵、ピンチの強がり。場面に合わせて演技を指定した新しい6台詞です。','「ほっ！」は軽快な掛け声に。他の5本も、台詞前の吐息・吸気を入れない指定で再生成しました。').replace('試聴用の新規候補です。','試聴用の修正版です。音量と前後のごく小さな無音を整えています。'));
console.log(JSON.stringify(clips.map(({id,seconds,previewSeconds,trimStartSeconds,trimEndSeconds,peak,rms,clippedSamples,headerCorrected})=>({id,seconds,previewSeconds,trimStartSeconds,trimEndSeconds,peak,rms,clippedSamples,headerCorrected})),null,2));
