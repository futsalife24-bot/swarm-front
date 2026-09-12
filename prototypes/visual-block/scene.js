import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { finishTrooper, streetShadowProxy, finishStreet, sidewalkSupport } from './finish.js';
import { Renderer } from '/src/client/render.ts';
import { createWorld, addPlayer, start, step, neutral, spawn } from '/src/shared/game.ts';
import { MAPS } from '/src/shared/stages.ts';

// Isolated experiment: the shipped renderer, model, clips and simulation are imported unchanged.
const r = new Renderer(document.querySelector('canvas'));
let w, p, yaw = 0, paused = true, enhanced = false, ready = false;
const keys = new Set(), materials = [], additions = new T.Group();
const receivers=[], casters=[];let costume,street,support;const proxy=streetShadowProxy(MAPS[0].blocks);r.scene.add(proxy);
const block=MAPS[0].blocks.filter(b=>Math.abs(b.x)===34&&b.z===8);
let inspect=false;
additions.name = 'Prototype street edge details'; r.scene.add(additions);
const sun = r.scene.children.find(o => o instanceof T.DirectionalLight);
const originalShadow = { left:-145,right:145,top:150,bottom:-150 };
function reset() { w=createWorld('visual-block',123,1);p=addPlayer(w,'local');start(w);yaw=0;keys.clear(); }
reset();
const batches = new Map();
function box(x,y,z,sx,sy,sz,color) {
  const g = new T.BoxGeometry(sx,sy,sz);g.translate(x,y,z);
  if(!batches.has(color)) batches.set(color,[]);batches.get(color).push(g);
}
// Only the two facing buildings of one block. All detail remains outside the central firing lane.
for(const b of MAPS[0].blocks.filter(b=>Math.abs(b.x)===34 && b.z===8)) {
  const side=Math.sign(b.x), edge=b.x-side*b.w/2;
  box(edge-side*.7,.10,b.z,1.4,.20,b.d+1.2,0x737875);
  box(edge-side*1.45,.08,b.z,.16,.16,b.d+1.2,0xb1aca0);
  box(edge-side*.12,.32,b.z,.24,.48,b.d,0x434847);
  for(const z of [b.z-b.d/2+.15,b.z+b.d/2-.15]) box(edge-side*.10,b.h/2,z,.20,b.h,.30,0x92958a);
  for(let y=2;y<b.h-1;y+=3) for(let z=b.z-b.d/2+1.7;z<b.z+b.d/2-1;z+=2.8) {
    // Deep dark recess, lighter projecting sill, and side reveals; no copied image assets.
    box(edge-side*.13,y+.08,z,.02,1.55,1.35,0x151f22);
    box(edge-side*.24,y-.98,z,.48,.14,1.9,0x9b9c90);
    for(const dz of [-.78,.78])box(edge-side*.21,y,z+dz,.42,1.94,.15,0x6c746f);
    box(edge-side*.18,y,z,.11,1.70,.065,0x727e7c);
  }
  // Sparse drains at the curb instead of noise across the road.
  for(let z=b.z-8;z<b.z+9;z+=6) for(let j=0;j<6;j++)box(edge-side*1.65,.035,z+j*.12,.38,.025,.055,0x20292b);
}
for(const [color,gs] of batches){const m=new T.Mesh(mergeGeometries(gs),new T.MeshStandardMaterial({color,roughness:.9}));m.castShadow=true;m.receiveShadow=true;additions.add(m);gs.forEach(g=>g.dispose());}
function remember(model, actor=false) {
  model.traverse(o=>{if(!(o instanceof T.Mesh))return;
    for(const m of Array.isArray(o.material)?o.material:[o.material]) {
      if(!(m instanceof T.MeshStandardMaterial)||materials.some(v=>v.m===m))continue;
      materials.push({m,color:m.color.clone(),roughness:m.roughness,metalness:m.metalness,actor});
    }
    if(actor)receivers.push({o,value:o.receiveShadow});else casters.push({o,value:o.castShadow});
  });
}
function mode(value){
  enhanced=value; additions.visible=value;
  costume?.set(value);street?.set(value);proxy.visible=value;casters.forEach(({o,value:old})=>o.castShadow=value?false:old);receivers.forEach(({o,value:old})=>o.receiveShadow=value||old);
  for(const v of materials){const {m}=v;m.color.copy(v.color);m.roughness=v.roughness;m.metalness=v.metalness;
    if(value && v.actor){
      if(m.name==='Study_Cloth'){m.color.setHex(0x65705a);m.roughness=.98;m.metalness=0;}
      if(/Cloth|Rubber|Glove/.test(m.name)&&m.name!=='Study_Cloth'){m.color.multiplyScalar(.69);m.roughness=.96;m.metalness=0;}
      if(/Armor/.test(m.name)){m.color.multiplyScalar(.80);m.roughness=.48;m.metalness=.22;}
      if(/Ceramic/.test(m.name)){m.color.multiplyScalar(.84);m.roughness=.62;m.metalness=.04;}
    }
    if(value && !v.actor && m.name==='road_asphalt'){m.color.multiplyScalar(.86);m.roughness=.96;}
  }
  Object.assign(sun.shadow.camera,value?{left:-38,right:38,top:40,bottom:-40}:originalShadow);
  sun.shadow.normalBias=value?.012:.12;sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.needsUpdate=true;
  document.querySelector('#before').setAttribute('aria-pressed',String(!value));document.querySelector('#after').setAttribute('aria-pressed',String(value));
}
document.querySelector('#before').onclick=()=>mode(false);document.querySelector('#after').onclick=()=>mode(true);
document.querySelector('#reset').onclick=reset;document.querySelector('#pause').onclick=()=>paused=!paused;
document.querySelector('#inspect').onclick=()=>inspect=!inspect;
document.querySelector('#crowd').onclick=()=>window.visualBlock.crowd();
for(const button of document.querySelectorAll('[data-key]')){
  button.onpointerdown=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(button.dataset.key);};
  button.onpointerup=button.onpointercancel=()=>keys.delete(button.dataset.key);
}
addEventListener('keydown',e=>{if(['Space','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.add(e.code);});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());addEventListener('resize',()=>r.resize());
let last=performance.now(),lastShadow=-Infinity,shadowUpdates=0;const times=[],loads=[];
function tick(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(ready&&!paused){
    yaw+=(Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')))*dt;
    const i=neutral();Object.assign(i,{mx:Number(keys.has('KeyD'))-Number(keys.has('KeyA')),mz:Number(keys.has('KeyW'))-Number(keys.has('KeyS')),yaw,fire:keys.has('Space'),reload:keys.has('KeyR'),swap:keys.has('KeyQ'),dodge:keys.has('KeyE')});step(w,{local:i},dt);
  }
  // Use the real render path once per frame. onBeforeRender adjusts lighting after its defaults.
  const actor=r.players.get('local');if(actor)actor.position.y=0;
  r.render(w,'local',paused?0:dt,yaw,0);
  if(!ready && r.mapAssets.status[0].state==='ready' && r.players.get('local')?.userData.trooper){
    remember(r.mapAssets.groups[0]);remember(r.players.get('local'),true);costume=finishTrooper(r.players.get('local').userData.trooper.model);
    street=finishStreet(r.mapAssets.groups[0],block);r.scene.add(street.dirt);support=sidewalkSupport(r.players.get('local').userData.trooper,r.players.get('local'),block);ready=true;mode(true);
  }
  times.push(now-lastFrame);lastFrame=now;if(times.length>180)times.shift();
  loads.push({calls:r.renderer.info.render.calls,triangles:r.renderer.info.render.triangles});if(loads.length>180)loads.shift();
  document.querySelector('#status').textContent=`${enhanced?'B 試作':'A 現行'} · ${paused?'停止中':'操作中'} · HP ${p.hp} · 弾 ${p.ammo[p.slot]} · ${r.renderer.info.render.calls} draws · ${r.renderer.info.render.triangles.toLocaleString()} triangles`;
  requestAnimationFrame(tick);
}
// Focus the existing shadow on the subject, retaining the same sunlight direction and one shadow map.
r.scene.onBeforeRender=()=>{
  support?.update(enhanced);
  if(inspect){r.camera.position.set(p.x+2.1,1.8,p.z+2.3);r.camera.lookAt(p.x,1.12,p.z);r.camera.updateMatrixWorld();}
  r.scene.fog.near=70;r.scene.fog.far=enhanced?600:950;
  sun.target.position.set(enhanced?p.x:0,0,enhanced?p.z:0);
  sun.target.updateMatrixWorld();sun.position.set(-65+(enhanced?p.x:0),110,-50+(enhanced?p.z:0));
  if(enhanced&&!paused && performance.now()-lastShadow>=1000/30){sun.shadow.needsUpdate=true;lastShadow=performance.now();}
  if(sun.shadow.needsUpdate)shadowUpdates++;
};
let lastFrame=performance.now();
window.visualBlock={r,get world(){return w},get ready(){return ready},get costume(){return costume},get support(){return support},set inspect(v){inspect=v},mode,reset,crowd:()=>{w.enemies=[];for(let j=0;j<40;j++)spawn(w,'ant',(j%8-3.5)*3,20-Math.floor(j/8)*5)},clearMetrics:()=>{times.length=0;loads.length=0;shadowUpdates=0},set paused(v){paused=v},get paused(){return paused},metrics:()=>({calls:r.renderer.info.render.calls,triangles:r.renderer.info.render.triangles,meanDrawCalls:loads.reduce((a,b)=>a+b.calls,0)/loads.length,peakDrawCalls:Math.max(...loads.map(v=>v.calls)),meanTriangles:loads.reduce((a,b)=>a+b.triangles,0)/loads.length,peakTriangles:Math.max(...loads.map(v=>v.triangles)),textures:r.renderer.info.memory.textures,shadowUpdates,meanFrameMs:times.reduce((a,b)=>a+b,0)/times.length,frames:times.length})};
mode(false);requestAnimationFrame(tick);
