import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { buildTower } from './tower.mjs';
import { landscape, random } from './landscape.mjs';
import { makeRecorder } from './recorder.mjs';

const params=new URLSearchParams(location.search);
const width=Number(params.get('w'))||1920, height=Math.round(width*816/1920/2)*2;
const output=document.querySelector('canvas');
output.width=width;output.height=height;
const ctx=output.getContext('2d',{alpha:false});
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
renderer.setSize(width,height,false);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.99;
const scene=new T.Scene(), camera=new T.PerspectiveCamera(35,width/height,.1,900);
const updateWorld=landscape(scene);
const tower=buildTower();scene.add(tower.root);
tower.root.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});
const recorder=makeRecorder();
const asset=await new GLTFLoader().loadAsync('/public/assets/enemies/ray_motion_v1.glb');
const anim=asset.animations.find(clip=>clip.name==='Locomotion');
if(!anim)throw new Error('RAYの遊泳クリップがありません');
const rays=[],rnd=random(419);
for(let i=0;i<11;i++) {
  const root=new T.Group(), model=clone(asset.scene);
  const mixer=new T.AnimationMixer(model);mixer.clipAction(anim).play();
  model.updateMatrixWorld(true);const box=new T.Box3().setFromObject(model), center=box.getCenter(new T.Vector3());
  const factor=(i===0?11.6:4.9+rnd()*2.6)/(box.max.x-box.min.x);
  model.position.copy(center).multiplyScalar(-factor);model.scale.setScalar(factor);
  root.add(model);scene.add(root);
  rays.push({root,mixer,phase:rnd()*6.28,side:i===0?0:(i%2===0?1:-1)*Math.ceil(i/2)*3.6,
    lag:i===0?0:3+Math.ceil(i/2)*3.75+rnd()*3.1,level:i===0?0:rnd()*3.5-.8});
}
const ease=(a,b,x)=>{const v=T.MathUtils.clamp((x-a)/(b-a),0,1);return v*v*(3-2*v);};
const lerp=T.MathUtils.lerp;
const v=(a)=>new T.Vector3(...a);
function dustField() {
  const xyz=[],col=[];
  for(let i=0;i<530;i++) {
    xyz.push((rnd()-.5)*115,rnd()**1.4*34,(rnd()-.5)*100);
    const k=.36+rnd()*.57;col.push(k,k*.85,k*.65);
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(xyz,3));geo.setAttribute('color',new T.Float32BufferAttribute(col,3));
  const material=new T.PointsMaterial({size:.040,vertexColors:true,opacity:.52,transparent:true,depthWrite:false});
  const dust=new T.Points(geo,material);scene.add(dust);return dust;
}
const dust=dustField();
const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
const sh=shadowCanvas.getContext('2d'), grad=sh.createRadialGradient(64,64,0,64,64,62);
grad.addColorStop(0,'rgba(10,19,18,.88)');grad.addColorStop(.40,'rgba(14,20,17,.68)');grad.addColorStop(1,'rgba(14,22,20,0)');
sh.fillStyle=grad;sh.fillRect(0,0,128,128);
const shadowMap=new T.CanvasTexture(shadowCanvas);
const baseShadow=new T.Mesh(new T.PlaneGeometry(20,12),new T.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false,opacity:.59}));
baseShadow.rotation.x=-Math.PI/2;baseShadow.position.set(2,-.069,-1);scene.add(baseShadow);
const shadows=rays.map(()=>{const s=baseShadow.clone();s.material=baseShadow.material.clone();s.material.opacity=.26;scene.add(s);return s;});
const noise=document.createElement('canvas');noise.width=noise.height=192;
const nc=noise.getContext('2d'),pixels=nc.createImageData(192,192);
for(let i=0;i<pixels.data.length;i+=4){const val=Math.floor(rnd()*255);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=val;pixels.data[i+3]=255;}nc.putImageData(pixels,0,0);
const grain=ctx.createPattern(noise,'repeat');
function setupCamera(pos,aim,fov,roll=0) {
  camera.position.copy(pos);camera.up.set(0,1,0);camera.lookAt(aim);camera.rotateZ(roll);camera.fov=fov;camera.updateProjectionMatrix();
}
function move(a,b,u) {return v(a).lerp(v(b),u);}
function stamp(x,y,scale) {
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.fillStyle='#ba5036';ctx.fillRect(0,0,44,44);
  ctx.strokeStyle='#f3d8a6';ctx.lineWidth=2;ctx.lineCap='square';
  for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(9,13+i*8);ctx.lineTo(17,13+i*8);ctx.lineTo(22,8+i*8);ctx.lineTo(27,13+i*8);ctx.lineTo(35,13+i*8);ctx.stroke();}
  ctx.restore();
}
function typeset(t) {
  const intro=ease(.45,1.15,t)*(1-ease(3.85,4.7,t));
  if(intro>0){
    ctx.save();ctx.globalAlpha=intro;
    const box=ctx.createLinearGradient(0,500,0,817);box.addColorStop(0,'#16232700');box.addColorStop(1,'#102025a8');
    ctx.fillStyle=box;ctx.fillRect(0,500,1920,316);
    stamp(88,632,.83);ctx.fillStyle='#fbe6c5';ctx.font='500 22px "Yu Gothic",sans-serif';ctx.fillText('前線観測記録',143,661);
    ctx.font='500 48px "Yu Mincho",serif';ctx.fillText('第七聴測所',85,742);
    ctx.restore();
  }
  const end=ease(35.15,36.0,t);
  if(end>0) {
    ctx.save();ctx.globalAlpha=end;
    const veil=ctx.createLinearGradient(0,0,1110,0);veil.addColorStop(0,'#142524d9');veil.addColorStop(.58,'#1e30284d');veil.addColorStop(1,'#20352b00');
    ctx.fillStyle=veil;ctx.fillRect(0,0,1120,816);
    stamp(112,222,.86);ctx.fillStyle='#f2ddbb';ctx.font='600 27px Bahnschrift,sans-serif';ctx.letterSpacing='5px';ctx.fillText('SWARM FRONT',176,252);
    ctx.letterSpacing='10px';ctx.font='600 155px "Yu Mincho",serif';ctx.fillStyle='#f7ead5';ctx.fillText('残響線',100,450);
    ctx.letterSpacing='2px';ctx.fillStyle='#e9d3ac';ctx.fillRect(115,499,63,2);ctx.font='500 24px "Yu Gothic",sans-serif';ctx.fillText('第七聴測所の記録',195,508);ctx.restore();
  }
}
function draw(t) {
  const dawn=ease(8,34,t);
  updateWorld(t,dawn);tower.update(t,ease(11.5,19.8,t),Math.exp(-((t%.625)*7.9)));
  dust.position.set(Math.sin(t*.16)*2.3,Math.sin(t*.21)*.3,t*.067);
  for(let i=0;i<rays.length;i++) {
    const r=rays[i],x=(t-25.4)*3.35-r.lag;
    r.root.position.set(x,22.6+4.1*Math.exp(-(x*x)/280)+r.level+Math.sin(t*.73+r.phase)*.57,6+Math.sin(x*.067)*3.1+r.side);
    r.root.rotation.order='YXZ';r.root.rotation.set(.045*Math.sin(t*.59+r.phase),-Math.PI/2-.20*Math.cos(x*.067),.15*Math.sin(t*.65+r.phase));
    r.root.visible=t>=18;r.mixer.setTime(t*.88+r.phase);
    const s=shadows[i];s.visible=r.root.visible;s.position.set(x+3,-.066,r.root.position.z-2);s.scale.set(i? .48:.85,i?.29:.5,1);
  }
  const lead=rays[0].root.position;
  let set=scene;
  if(t<5){
    const u=t/5;setupCamera(move([17.2,3.5,63],[13.4,4.8,58],u),move([-8,8.1,.5],[-7,8.6,.8],u),31);
  }else if(t<10){
    set=recorder.scene;recorder.update(t);const u=(t-5)/5;
    setupCamera(move([3.7,4.1,4.5],[2.35,4.0,3.68],u),move([.42,.28,-.11],[.26,.26,-.10],u),27,-.056);
  }else if(t<15){
    const u=(t-10)/5;setupCamera(move([-11.3,3.8,10.0],[-13.5,6.2,13.5],u),move([-1.55,6.6,.55],[-.8,12.0,.2],ease(0,1,u)),38,-.035);
  }else if(t<20){
    const u=(t-15)/5;setupCamera(move([4.6,16.4,20.2],[1.2,16.7,25.8],u),move([.4,13,1],[.1,12.35,.6],u),37,.016*(1-u));
  }else if(t<25){
    const u=(t-20)/5;setupCamera(lead.clone().add(move([3.9,4.6,14.7],[5.3,6.5,16.5],u)),lead.clone().add(v([-1,-.55,-.2])),32,-.055);
  }else if(t<28.75){
    const u=(t-25)/3.75;setupCamera(move([-4,56,12],[3.2,61,9],u),move([2,0,4],[6,0,4.1],u),45,-.05+.13*u);
  }else if(t<32.5){
    const u=(t-28.75)/3.75;
    setupCamera(move([41.5,9.7,36.8],[48.6,11.5,39.4],u),move([2,15.7,1.3],[7.4,15.4,0],u),36,.026);
  }else if(t<35){
    set=recorder.scene;recorder.update(t);const u=(t-32.5)/2.5;
    setupCamera(move([.45,4.2,2.3],[.18,4.6,2.6],u),v([-.12,.25,-.10]),30,.063);
  }else{
    const u=(t-35)/5;setupCamera(move([6.4,4.0,60],[5.0,4.35,62.2],u),v([-13,9.1,0]),33);
  }
  renderer.render(set,camera);
  ctx.setTransform(width/1920,0,0,height/816,0,0);ctx.globalAlpha=1;ctx.drawImage(renderer.domElement,0,0,1920,816);
  const vignette=ctx.createRadialGradient(960,355,370,960,398,1190);
  vignette.addColorStop(0,'rgba(31,21,17,0)');vignette.addColorStop(.78,'rgba(40,22,18,.055)');vignette.addColorStop(1,'rgba(22,22,18,.23)');
  ctx.fillStyle=vignette;ctx.fillRect(0,0,1920,816);
  ctx.save();const frame=Math.floor(t*24);ctx.translate(-((frame*47)%191),-((frame*71)%191));
  ctx.fillStyle=grain;ctx.globalAlpha=.034;ctx.fillRect(0,0,2140,1015);ctx.restore();
  typeset(t);
  const black=Math.max(1-ease(0,.68,t),ease(39.30,40,t));
  if(black>0){ctx.fillStyle='rgba(12,18,18,'+black+')';ctx.fillRect(0,0,1920,816);}
}
await document.fonts.ready;
draw(0);
window.film={draw, duration:40, renderer:renderer.getContext().getParameter(renderer.getContext().RENDERER)};
