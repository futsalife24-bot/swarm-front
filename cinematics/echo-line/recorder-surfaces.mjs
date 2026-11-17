import * as T from 'three';
import {random} from './landscape.mjs';

const tau = Math.PI * 2;
const clamp = (n, lo=0, hi=1) => Math.max(lo,Math.min(hi,n));
const mix = (a,b,t) => a+(b-a)*t;
const smooth = n => n*n*(3-2*n);
const rng=random(32197);
const lattice=Float32Array.from({length:65536},rng);
function field(u,v,nx,ny) {
  const x=u*nx,y=v*ny,ix=Math.floor(x),iy=Math.floor(y),fx=smooth(x-ix),fy=smooth(y-iy);
  const a=(ix%nx+nx)%nx,b=(iy%ny+ny)%ny,c=(a+1)%nx,d=(b+1)%ny;
  return mix(mix(lattice[a+b*256],lattice[c+b*256],fx),mix(lattice[a+d*256],lattice[c+d*256],fx),fy);
}
function tex(bytes,w,h,color=false) {
  const map=new T.DataTexture(bytes,w,h);
  if(color) map.colorSpace=T.SRGBColorSpace;
  map.wrapS=map.wrapT=T.RepeatWrapping;
  map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;
  map.anisotropy=8;map.needsUpdate=true;
  return map;
}

// The four maps share the same wear mask, so an exposed polished spot also reflects its surroundings.
function finish(kind) {
  const enamel=kind==='enamel',steel=kind==='steel',knurl=kind==='knurl';
  const w=enamel?640:256,h=enamel?384:768;
  const color=new Uint8Array(w*h*4),packed=new Uint8Array(w*h*4);
  const rnd=random(steel?751:knurl?963:349);
  for (let y=0;y<h;y++) for(let x=0;x<w;x++) {
    const u=x/w,v=y/h,i=(y*w+x)*4;
    const cloud=field(u,v,4,7)*.54+field(u+.125,v,11,19)*.29+field(u,v,39,51)*.17;
    const speck=rnd(),grain=field(u,v,78,105);
    let r,g,b,rough,metal,height;
    if(enamel) {
      const sx=u*83+field(u,v,11,9)*.76,sy=v*53+field(u,v,17,13)*.68;
      const row=Math.floor(sy),dx=(sx+(row%2)*.50)%1-.5,dy=sy%1-.5;
      const dist=Math.sqrt(dx*dx+dy*dy);
      const dent=clamp(1-dist*2.32),rim=Math.exp(-((dist-.405)**2)/.0045);
      const edge=Math.min(u,1-u,v*.76,(1-v)*.76);
      const loss=clamp((.012+cloud*.028-edge)*57+(grain-.65)*3.2-1.02);
      const chip=smooth(clamp((loss-.09)*2.1));
      const oxide=clamp((cloud-.39)*3.7);
      const lift=(cloud-.5)*28+rim*7-dent*7+(speck-.5)*4;
      r=mix(47+lift,117-oxide*36,chip);g=mix(80+lift,103-oxide*34,chip);b=mix(76+lift,72-oxide*29,chip);
      rough=mix(.32+cloud*.23,.45+oxide*.38,chip);metal=mix(.20,.81-oxide*.46,chip);
      height=.49+dent*.20-rim*.07-chip*.19+(speck-.5)*.038;
    } else {
      const line=.5+.5*Math.sin(tau*(v*191+.095*Math.sin(u*tau)+field(u,v,2,9)*.12));
      const shoulder=Math.max(Math.exp(-((v-.1)**2)/.0017),Math.exp(-((v-.89)**2)/.0028));
      const rubbed=Math.exp(-((v-.43)**2)/.037)*.25+Math.exp(-((v-.74)**2)/.0011)*.27;
      const soil=smooth(clamp((cloud+shoulder*.16-rubbed*.32-.385)*3.4));
      const oxide=smooth(clamp((cloud+shoulder*.22-.585)*6.0));
      const pit=smooth(clamp((grain+soil*.13-.77)*4));
      const ring=clamp((line-.64)*2.8), scratch=Math.max(0,speck-.94)*89;
      let relief=ring*.075+(speck-.5)*.05-pit*.17;
      if(knurl) {
        const a=Math.abs(((u*36+v*12)%1+1)%1-.5),b=Math.abs(((u*36-v*12)%1+1)%1-.5);
        relief += (Math.min(a,b)*2-.4)*.72;
      }
      const polish=clamp(.66+rubbed-soil*.84);
      const ridge=knurl?relief*39:line*8+scratch;
      r=mix(steel?48:111,steel?124:225,polish)+ridge;
      g=mix(steel?55:91,steel?130:177,polish)+ridge;
      b=mix(steel?55:58,steel?124:103,polish)+ridge;
      r=mix(r,steel?66:87,oxide*.85);g=mix(g,steel?62:104,oxide*.85);b=mix(b,steel?46:79,oxide*.85);
      rough=clamp(.20+soil*.42+oxide*.15+pit*.12+ring*.075-rubbed*.11,.16,.92);
      metal=clamp(.96-soil*.13-oxide*.36-pit*.15);
      height=.47+relief+cloud*.15;
    }
    color[i]=clamp(r,0,255);color[i+1]=clamp(g,0,255);color[i+2]=clamp(b,0,255);color[i+3]=255;
    packed[i]=clamp(height)*255;packed[i+1]=rough*255;packed[i+2]=metal*255;packed[i+3]=255;
  }
  const pbr=tex(packed,w,h);
  return new T.MeshStandardMaterial({map:tex(color,w,h,true),roughnessMap:pbr,metalnessMap:pbr,bumpMap:pbr,
    roughness:1,metalness:1,bumpScale:enamel?.012:knurl?.0095:.0038});
}

// A small, off-camera workshop window and the dark timber around it are visible in polished metal.
function reflection() {
  const w=256,h=128,data=new Float32Array(w*h*4);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
    const u=x/w,v=y/h,i=(y*w+x)*4,sky=v>.51?.24:.052;
    const pane=(u>.10&&u<.35&&v>.52&&v<.81&&Math.abs(u-.225)>.004&&Math.abs(v-.675)>.007)?2.6:0;
    const strip=(u>.64&&u<.69&&v>.50&&v<.87)?2.1:0;
    data[i]=sky+pane*.88+strip*1.2;data[i+1]=sky*.97+pane*.99+strip*.84;
    data[i+2]=sky*.89+pane*1.09+strip*.48;data[i+3]=1;
  }
  const env=new T.DataTexture(data,w,h,T.RGBAFormat,T.FloatType);
  env.mapping=T.EquirectangularReflectionMapping;env.needsUpdate=true;
  return env;
}

export function recorderFinishes(scene) {
  scene.environment=reflection();scene.environmentIntensity=.84;
  return {enamel:finish('enamel'),brass:finish('brass'),steel:finish('steel'),knurl:finish('knurl')};
}

const paperWidth=1280,paperHeight=576;
export function paperStock() {
  const c=document.createElement('canvas');c.width=paperWidth;c.height=paperHeight;
  const k=c.getContext('2d'),image=k.createImageData(c.width,c.height),rng=random(2234);
  const relief=new Uint8Array(c.width*c.height*4);
  for(let y=0;y<c.height;y++) for(let x=0;x<c.width;x++) {
    const u=x/paperWidth,v=y/paperHeight,i=(y*c.width+x)*4;
    const pulp=field(u,v,12,7)*.54+field(u,v,37,17)*.29+field(u,v,89,47)*.17;
    const edge=clamp((.085-Math.min(v,1-v))*12);
    const fibre=rng(),tint=(pulp-.5)*15+(fibre-.5)*8;
    const fox=edge*(5+pulp*24)+edge*edge*20*field(u,v,64,12);
    image.data[i]=219+tint-fox*.55;image.data[i+1]=210+tint-fox*.76;
    image.data[i+2]=184+tint-fox;image.data[i+3]=255;
    relief[i]=(pulp*.47+fibre*.24+.14)*255;relief[i+1]=226+pulp*23-fibre*8;
    relief[i+2]=0;relief[i+3]=255;
  }
  k.putImageData(image,0,0);
  for(let i=0;i<24000;i++) {
    const x=rng()*c.width,y=rng()*c.height,light=rng()>.45;
    k.strokeStyle=light?'#fff9d438':'#766b5433';k.lineWidth=.35+rng()*.48;
    k.beginPath();k.moveTo(x,y);k.lineTo(x+1.2+rng()*6,y+(rng()-.5)*3);k.stroke();
  }
  for(let x=0;x<=c.width;x+=16) {
    k.strokeStyle=x%80?'#a66f5c54':'#9c5949ae';k.lineWidth=x%80?.73:1.25;
    k.beginPath();k.moveTo(x,39);k.lineTo(x,c.height-32);k.stroke();
  }
  for(let y=48;y<=c.height-32;y+=16) {
    k.strokeStyle=(y-48)%80?'#a66f5c54':'#9c5949ae';k.lineWidth=(y-48)%80?.73:1.25;
    k.beginPath();k.moveTo(0,y);k.lineTo(c.width,y);k.stroke();
  }
  k.fillStyle='#8c6350';k.font='bold 11px monospace';
  for(let x=0;x<c.width;x+=320) k.fillText('第七聴測所  ・  連続受信記録',x+16,49);
  for(let x=0;x<c.width;x+=40) for(const y of [13,paperHeight-13]) {
    k.fillStyle='#b1a185';k.beginPath();k.roundRect(x+15,y-4.4,10,8.8,2.6);k.fill();
    k.globalCompositeOperation='destination-out';k.beginPath();k.roundRect(x+16,y-3.6,8,7,2.1);k.fill();
    k.globalCompositeOperation='source-over';
  }
  const reliefMap=tex(relief,c.width,c.height);
  reliefMap.flipY=true;
  return {stock:c,reliefMap};
}
