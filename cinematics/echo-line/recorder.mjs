import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mesh,rod} from './landscape.mjs';
import {recorderFinishes,paperStock} from './recorder-surfaces.mjs';

const tau=2*Math.PI, sheetY=.258, tipX=.79, originZ=-2.26, tipReach=2.22;
const width=1152,height=576,speed=86,worldWidth=5.46,worldDepth=3.30;
const solid=(color,metalness,roughness)=>new T.MeshStandardMaterial({color,metalness,roughness});
const rounded=(parent,x,y,z,w,h,d,r,mat)=>mesh(parent,new RoundedBoxGeometry(w,h,d,2,r),mat,[x,y,z]);

function screw(g,x,y,z,r,metal,slot,angle=0) {
  rod(g,[x,y-.012,z],[x,y+.009,z],r,metal,r*.89,20);
  const cut=rounded(g,x,y+.0095,z,r*1.43,.004,r*.19,.002,slot);
  cut.rotation.y=angle;
}

function dial(g,x,z,r,label,m) {
  const c=document.createElement('canvas');c.width=c.height=384;
  const k=c.getContext('2d');k.translate(192,192);
  const age=k.createRadialGradient(-20,-24,32,6,8,192);
  age.addColorStop(0,'#d7ceaa');age.addColorStop(.78,'#c8bd97');age.addColorStop(1,'#958265');
  k.fillStyle=age;k.fillRect(-192,-192,384,384);
  k.textAlign='center';k.textBaseline='middle';
  for(let i=0;i<=40;i++) {
    const a=(.76+i/40*1.48)*Math.PI,major=i%5===0;
    k.strokeStyle=i>34?'#874931':'#414333';k.lineWidth=major?2.5:1.3;
    k.beginPath();k.moveTo(157*Math.cos(a),157*Math.sin(a));k.lineTo((major?126:144)*Math.cos(a),(major?126:144)*Math.sin(a));k.stroke();
    if(major){k.fillStyle='#444337';k.font='19px serif';k.fillText(String(i/5),111*Math.cos(a),111*Math.sin(a));}
  }
  k.fillStyle='#414239';k.font='bold 20px "Yu Gothic",sans-serif';k.fillText(label,0,52);
  k.font='10px monospace';k.fillText('Nº 047 / L',0,76);
  k.fillStyle='#703b23';k.beginPath();k.moveTo(-5,1);k.lineTo(98,-114);k.lineTo(3,7);k.fill();
  k.beginPath();k.arc(0,0,10,0,tau);k.fill();
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
  rod(g,[x,.085,z],[x,.245,z],r*1.16,m.dark,r*1.15,64);
  rod(g,[x,.22,z],[x,.282,z],r*1.13,m.brass,r*1.08,64);
  rod(g,[x,.277,z],[x,.296,z],r*1.02,m.steel,r,64);
  const face=mesh(g,new T.CircleGeometry(r*.955,64),new T.MeshStandardMaterial({map:tex,roughness:.50}),[x,.297,z]);
  face.rotation.x=-Math.PI/2;
  const glass=mesh(g,new T.CircleGeometry(r*.954,64),new T.MeshPhysicalMaterial({color:0xcedcce,transparent:true,
    opacity:.09,depthWrite:false,metalness:.18,roughness:.15,clearcoat:1}),[x,.307,z]);
  glass.rotation.x=-Math.PI/2;glass.userData.glass=true;
}

function roller(g,x,m) {
  const drum=new T.Group();drum.position.set(x,.28,0);g.add(drum);
  const section=(a,b,r,r2,mat)=>rod(drum,[0,0,a],[0,0,b],r,mat,r2,64);
  section(-1.62,1.62,.205,.205,m.brass);
  for(const s of [-1,1]) {
    section(s*1.44,s*1.46,.206,.206,m.steel);
    section(s*1.46,s*1.50,.206,.207,m.brass);
    section(s*1.53,s*1.58,.209,.209,m.knurl);
    section(s*1.60,s*1.68,.22,.25,m.steel);
    section(s*1.68,s*1.74,.25,.226,m.steel);
    section(s*1.738,s*1.77,.19,.15,m.brass);
    const end=s*1.79;
    rounded(g,x,.19,end,.58,.27,.14,.052,m.enamel);
    rod(g,[x,.28,end-s*.08],[x,.28,end+s*.04],.17,m.steel,.132,32);
    for(const dx of [-.21,.21]) screw(g,x+dx,.31,end,.038,m.brass,m.dark,dx*7);
  }
  return drum;
}

function makeStylus(g,m) {
  // The crosshead slides along two rails bolted to a stationary bridge.
  rounded(g,.79,.18,-2.23,.79,.18,1.04,.064,m.enamel);
  for(const z of [-2.67,-1.81]) {
    rounded(g,.79,.32,z,.66,.27,.15,.035,m.steel);
    for(const x of [.56,1.02]) screw(g,x,.44,z,.053,m.brass,m.dark,z*3+x);
  }
  for(const x of [.62,.96]) rod(g,[x,.424,-2.79],[x,.424,-1.69],.060,m.steel,.060,32);
  const pivot=new T.Group();pivot.position.set(tipX,1,originZ);g.add(pivot);
  rounded(pivot,0,-.555,0,.50,.19,.35,.065,m.enamel);
  for(const [lo,hi,r,r2,mat] of [[-.48,-.40,.24,.21,m.brass],[-.41,-.13,.19,.151,m.enamel],[-.15,-.065,.18,.17,m.steel],[-.065,.06,.166,.144,m.brass]]) {
    rod(pivot,[0,lo,0],[0,hi,0],r,mat,r2,48);
  }
  screw(pivot,0,.065,0,.084,m.steel,m.dark,.56);
  // Work along the existing pen axis. The rear ferrule, grip and feed tube are separate machined pieces.
  const axis=(z)=>[0,-z*.2318,z];
  const piece=(a,b,r,r2,mat)=>rod(pivot,axis(a),axis(b),r,mat,r2,48);
  piece(-.13,.17,.138,.132,m.steel);
  piece(.145,.22,.142,.145,m.brass);
  piece(.212,.85,.132,.123,m.knurl);
  piece(.84,.91,.14,.122,m.brass);
  piece(.90,1.47,.105,.091,m.enamel);
  piece(1.46,1.53,.111,.103,m.brass);
  piece(1.52,1.95,.092,.072,m.steel);
  piece(1.94,2.03,.087,.080,m.knurl);
  piece(2.019,2.17,.080,.061,m.brass);
  for(const z of [.235,.816,1.498,1.95,2.12]) piece(z,z+.011,z<.85?.136:z<1.52?.106:.082,z<.85?.136:z<1.52?.106:.082,m.dark);
  rod(pivot,[.071,-.095,.30],[.069,-.39,1.67],.017,m.brass,.014,12);
  rod(pivot,[-.09,-.03,.17],[.12,-.03,.17],.052,m.steel,.052,24);
  // The two blackened steel cheeks retain the hard, projecting capillary point.
  rod(pivot,[0,-.496,2.13],[0,-.565,2.202],.070,m.steel,.055,24);
  rod(pivot,[0,-.561,2.201],[0,-.696,2.218],.057,m.steel,.017,20);
  rod(pivot,[0,-.695,2.218],[0,sheetY-1,tipReach],.015,m.burnished,.0035,16);
  rod(pivot,[.006,-.579,2.251],[.002,-.689,2.234],.006,m.dark,.002,8);
  return pivot;
}

function casing(g,m) {
  rounded(g,0,-.35,.1,8.8,.88,5.7,.13,m.enamel);
  rounded(g,0,.070,0,6.43,.18,3.99,.095,m.dark);
  rounded(g,0,.131,0,6.32,.136,3.93,.060,m.steel);
  rounded(g,0,.195,0,5.78,.104,3.54,.046,m.brass);
  // The real sprocket holes in the chart open onto the dark gasket below.
  for(const z of [-1.566,1.566]) rounded(g,0,.249,z,5.52,.010,.16,.004,m.dark);
  for(const s of [-1,1]) {
    const z=s*1.92;
    for(const x of [-2.42,-1.27,0,1.27,2.42]) screw(g,x,.197,z,.051,m.brass,m.dark,x*1.8+s);
    rounded(g,0,.201,z,4.78,.021,.025,.009,m.burnished);
  }
  for(let i=0;i<5;i++) {
    const z=-1.34+i*.64;
    rounded(g,-3.76,.125,z,.73,.095,.265,.042,m.steel);
    rounded(g,-3.76,.171,z,.58,.086,.17,.037,m.dark);
    const key=rounded(g,-3.76,.212,z,.48,.092,.145,.036,i<3?m.brass:m.enamel);
    key.rotation.z=i<3?.07:-.08;
    for(let j=0;j<3;j++) rounded(g,-3.83+j*.054,.255,z,.011,.008,.09,.003,m.steel);
  }
  for(const x of [-4.02,4.02]) for(const z of [-2.52,2.52]) screw(g,x,.09,z,.096,m.brass,m.dark,x+z);
}

function wave(s) {
  const amplitude=s>30?1:.46+.18*Math.sin(s*.7);
  const phase=((s%1.875)+1.875)%1.875;
  const harmonic=Math.sin(s*34)*.7+Math.sin(s*62)*.24+Math.sin(s*110)*.10;
  return (Math.exp(-phase*7.8)*harmonic*.62+Math.sin(s*8)*.035+Math.sin(s*67)*.013)*amplitude;
}

export function makeRecorder() {
  const scene=new T.Scene();scene.background=new T.Color('#263632');
  const g=new T.Group();scene.add(g);
  const m=recorderFinishes(scene);
  m.dark=solid('#26302b',.34,.58);m.burnished=solid('#9f9478',.89,.22);
  casing(g,m);
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const {stock,reliefMap}=paperStock(),k=canvas.getContext('2d');
  reliefMap.repeat.x=width/stock.width;
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;
  const sheet=mesh(g,new T.PlaneGeometry(worldWidth,worldDepth),new T.MeshStandardMaterial({map:tex,roughness:1,
    bumpMap:reliefMap,bumpScale:.0014,roughnessMap:reliefMap,metalness:0,alphaTest:.45}),[0,sheetY,0]);sheet.rotation.x=-Math.PI/2;
  const rollers=[roller(g,-2.93,m),roller(g,2.93,m)];
  dial(g,3.72,-1.21,.46,'受 信',m);dial(g,3.72,.06,.39,'利 得',m);
  const stylus=makeStylus(g,m);
  rod(g,[3.74,.10,1.13],[3.74,.23,1.13],.17,m.steel,.154,36);
  rod(g,[3.74,.23,1.13],[3.74,.255,1.13],.14,m.brass,.14,36);
  const bulb=mesh(g,new T.SphereGeometry(.114,24,16),new T.MeshPhysicalMaterial({color:0xe89c4a,emissive:0xe3832d,
    emissiveIntensity:.54,roughness:.19,clearcoat:1}),[3.74,.264,1.13]);
  scene.add(new T.HemisphereLight(0xf8e4bd,0x6b8074,1.6));
  const key=new T.DirectionalLight(0xffd299,3.1);key.position.set(-4,6,-3);scene.add(key);
  key.castShadow=true;key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.3,far:20});key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias=-.00025;key.shadow.normalBias=.008;
  g.traverse(o=>{if(o.isMesh){o.castShadow=!o.userData.glass;o.receiveShadow=true;}});
  const edge=new T.DirectionalLight(0x8bb6ba,1.1);edge.position.set(6,2,2);scene.add(edge);
  const stop=(tipX/worldWidth+.5)*width;
  const traceY=s=>((originZ+tipReach+wave(s))/worldDepth+.5)*height;
  return {scene,update(t) {
    stylus.position.z=originZ+wave(t);
    for(const roller of rollers) roller.rotation.z=t*speed*worldWidth/(width*.205);
    const travel=t*speed,scroll=((travel%stock.width)+stock.width)%stock.width;
    reliefMap.offset.x=scroll/stock.width;
    k.clearRect(0,0,width,height);k.drawImage(stock,-scroll,0);k.drawImage(stock,stock.width-scroll,0);
    k.font='bold 11px monospace';k.fillStyle='#7a6254';
    const first=Math.floor((travel-stop)/160);
    for(let n=first;n<first+9;n++) {
      const x=stop+n*160-travel;
      k.fillRect(x,height-36,1.2,6);k.fillText((n*160/speed+120).toFixed(1)+' s',x+5,height-31);
    }
    k.strokeStyle='#39463b';k.lineWidth=2.15;k.lineJoin='round';k.lineCap='round';k.beginPath();
    k.moveTo(0,traceY(t-stop/speed));
    for(let x=1;x<stop;x+=1.25) k.lineTo(x,traceY(t+(x-stop)/speed));
    k.lineTo(stop,traceY(t));k.stroke();
    tex.needsUpdate=true;bulb.material.emissiveIntensity=.59+.16*Math.cos(t*tau/.625);
  }};
}
