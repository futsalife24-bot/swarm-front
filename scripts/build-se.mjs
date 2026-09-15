import { chromium } from '@playwright/test';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const out='public/assets/audio/se-v1', root='dist-work/se-source/';
const sources={rifle:'Prepared SFX Library/AR-15/D_32P.wav',shotgun:'Prepared SFX Library/Mossberg/N_26P.wav',reload:'reload.wav',cock:'cock.wav',metal:'Audio/impactMetal_medium_000.ogg',plate:'Audio/impactPlate_heavy_000.ogg',cloth:'Audio/footstep_carpet_000.ogg',boot:'Audio/footstep_concrete_000.ogg',punch:'Audio/impactPunch_heavy_000.ogg',click:'Audio/impactMetal_light_000.ogg'};
const browser=await chromium.launch({channel:'chrome'}),page=await browser.newPage();
const decoded={};
try {for(const [key,path] of Object.entries(sources)){
 decoded[key]=await page.evaluate(async base64=>{const c=new OfflineAudioContext(1,1,32000),raw=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),b=await c.decodeAudioData(raw.buffer);const mono=new Float32Array(b.length);for(let ch=0;ch<b.numberOfChannels;ch++){const d=b.getChannelData(ch);for(let i=0;i<d.length;i++)mono[i]+=d[i]/b.numberOfChannels}return {rate:b.sampleRate,data:Array.from(mono)}},fs.readFileSync(root+path).toString('base64'));
 console.log(key,decoded[key].data.length/32000);
}}finally{await browser.close()}
const rate=32000, report=[];let seed=174;
function noise(){seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/2147483648-1}
function sample(key,duration,offset=0,pitch=1){const d=decoded[key].data,peak=d.reduce((a,v)=>Math.max(a,Math.abs(v)),0);let onset=d.findIndex(v=>Math.abs(v)>peak*.025);onset=Math.max(0,onset-64)+Math.floor(offset*rate);const a=new Float32Array(Math.ceil(duration*rate));for(let i=0;i<a.length;i++){const pos=onset+i*pitch,j=Math.floor(pos);a[i]=((d[j]??0)*(1-pos+j)+(d[j+1]??0)*(pos-j))*Math.min(1,i/24,(a.length-i)/640)}return a}
function mix(duration,layers){const a=new Float32Array(Math.ceil(duration*rate));for(const [s,g=1,delay=0] of layers){let start=Math.floor(delay*rate);for(let i=0;i<s.length&&i+start<a.length;i++)a[i+start]+=s[i]*g}return a}
function texture(duration,freq,decay,grit=.7,sweep=0){const a=new Float32Array(Math.ceil(duration*rate));let low=0,phase=0;for(let i=0;i<a.length;i++){const t=i/rate;low+=.22*(noise()-low);phase+=2*Math.PI*(freq+sweep*Math.exp(-t*8))/rate;a[i]=(grit*low+(1-grit)*Math.sin(phase))*Math.exp(-t*decay)*Math.min(1,t/.004,(duration-t)/.03)}return a}
function save(key,a,origin){const peak=a.reduce((m,v)=>Math.max(m,Math.abs(v)),0),gain=.84/Math.max(.001,peak),b=Buffer.alloc(44+a.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(a.length*2,40);let sq=0;for(let i=0;i<a.length;i++){const v=a[i]*gain;sq+=v*v;b.writeInt16LE(Math.round(v*32767),44+i*2)}fs.writeFileSync(out+'/'+key+'.wav',b);report.push({key,seconds:a.length/rate,bytes:b.length,peak:.84,rms:Math.sqrt(sq/a.length),sha256:createHash('sha256').update(b).digest('hex'),origin})}
save('rifle',sample('rifle',.7),['rifle']);save('shotgun',sample('shotgun',1.05),['shotgun']);
save('reload',sample('reload',.65),['reload']);save('ready',sample('cock',.38),['cock']);
save('switch',mix(.42,[[sample('cloth',.25),.6],[sample('cock',.24),.7,.12]]),['cloth','cock']);
save('equip',mix(.5,[[sample('cock',.23),.5],[sample('metal',.25),.65,.2]]),['cock','metal']);
save('unequip',mix(.35,[[sample('click',.15),.6],[sample('cloth',.2),.8,.12]]),['click','cloth']);
save('menu',sample('click',.075,0,1.5),['click']);
save('impact',mix(.22,[[sample('metal',.22),.8],[sample('punch',.14),.45]]),['metal','punch']);
save('dodge',mix(.5,[[sample('cloth',.4,0,.75),1],[sample('boot',.15),.45,.31]]),['cloth','boot']);
save('hurt',sample('punch',.22),['punch']);
save('rocket',mix(.75,[[texture(.75,75,5,.9,90),1],[sample('punch',.2),.8]]),['original synthesis','punch']);
save('burst',mix(1.25,[[texture(1.25,43,4,.85,80),1],[sample('plate',.7,0,.65),.7],[sample('punch',.2),.6]]),['original synthesis','plate','punch']);
save('melee',mix(.43,[[sample('plate',.35,0,.8),.7],[sample('punch',.18),1,.08]]),['plate','punch']);
save('spit',texture(.42,95,9,.96,180),['original synthesis']);
save('acid',texture(.65,180,6,.98,400),['original synthesis']);
save('stake',mix(.35,[[texture(.35,190,12,.85,700),1],[sample('click',.15),.7]]),['original synthesis','click']);
save('laser',mix(.8,[[texture(.8,70,4,.4,1600),.6],[texture(.8,140,6,.85,200),.5]]),['original synthesis']);
save('charge',texture(.7,75,1.5,.35,120),['original synthesis']);
save('warning',sample('metal',.2,0,.6),['metal']);
save('leap',mix(.4,[[sample('cloth',.32,0,.65),1],[sample('plate',.22),.3]]),['cloth','plate']);
save('lunge',mix(.4,[[texture(.4,110,7,.9,60),.6],[sample('metal',.24,0,.7),.5]]),['original synthesis','metal']);
save('land',mix(.45,[[sample('plate',.45,0,.7),.5],[sample('punch',.22),1]]),['plate','punch']);
save('kill',sample('plate',.4,0,.8),['plate']);
save('down',texture(.7,58,4,.3,60),['original synthesis']);
save('revive',mix(.55,[[sample('click',.16),.6],[sample('cock',.3),.5,.2]]),['click','cock']);
fs.writeFileSync(out+'/manifest.json',JSON.stringify({version:1,rate,sources,assets:report},null,2));console.log('Built',report.length,'clips',report.reduce((s,r)=>s+r.bytes,0),'bytes');
