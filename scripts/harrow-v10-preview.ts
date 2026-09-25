import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {LatestRequest} from './harrow-v10-load-gate.mjs';
const canvas=document.querySelector('canvas')!;
const renderer=new T.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x28343f);
renderer.toneMapping=T.ACESFilmicToneMapping;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1,.05,200);
const controls=new OrbitControls(camera,canvas);controls.target.set(0,5,0);camera.position.set(-19,11,24);controls.update();
scene.add(new T.HemisphereLight(0xd9eeff,0x544335,3));
for(const [x,y,z,power] of [[-10,15,10,4],[12,10,-8,3]]){const l=new T.DirectionalLight(0xffffff,power);l.position.set(x,y,z);scene.add(l);}
const version=document.querySelector<HTMLSelectElement>('#version')!,clip=document.querySelector<HTMLSelectElement>('#clip')!,seek=document.querySelector<HTMLInputElement>('#time')!;
const status=document.querySelector('#status')!;
let model:T.Group,mixer:T.AnimationMixer,clips:T.AnimationClip[]=[],time=0,paused=false,last=performance.now(),installedVersion='';
let loadState:'loading'|'ready'|'error'='loading',requestedVersion=version.value;
const loadGate=new LatestRequest();
function dispose(root:T.Object3D){root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});}
async function load(){
 requestedVersion=version.value;const request=loadGate.begin(requestedVersion);loadState='loading';
 try{
  const gltf=await new GLTFLoader().loadAsync(`/assets/blender/candidates/harrow/${request.version}/harrow.glb`);
  if(!loadGate.isCurrent(request)){dispose(gltf.scene);return;}
  if(model){scene.remove(model);dispose(model);}
  model=gltf.scene;model.traverse(o=>{if(o instanceof T.SkinnedMesh)o.frustumCulled=false;});scene.add(model);clips=gltf.animations;mixer=new T.AnimationMixer(model);installedVersion=request.version;loadState='ready';choose();
 }catch(error){if(!loadGate.isCurrent(request))return;loadState='error';console.error(`HARROW ${request.version} load failed`,error);}
}
function choose(){const c=clips.find(c=>c.name===clip.value)!;mixer.stopAllAction();mixer.clipAction(c).play();time=0;seek.max=String(c.duration);}
version.onchange=()=>void load();clip.onchange=choose;
document.querySelector<HTMLButtonElement>('#play')!.onclick=e=>{paused=!paused;(e.target as HTMLElement).textContent=paused?'再生':'一時停止';};
document.querySelector<HTMLButtonElement>('#body')!.onclick=()=>{const y=['Flight','AirThreat','Takeoff'].includes(clip.value)?5:3;controls.target.set(-.6,y,0);camera.position.set(-4,y+1.2,11);controls.update();};
document.querySelector<HTMLButtonElement>('#full')!.onclick=()=>{controls.target.set(0,5,0);camera.position.set(-19,11,24);controls.update();};
seek.oninput=()=>{time=Number(seek.value);paused=true;document.querySelector('#play')!.textContent='再生';};
function draw(now:number){requestAnimationFrame(draw);const dt=Math.min(.05,(now-last)/1000);last=now;if(mixer){if(!paused)time=(time+dt)%Number(seek.max);mixer.setTime(time);seek.value=String(time);}if(loadState==='ready')status.textContent=`${installedVersion} · ${clip.value} · ${time.toFixed(2)}秒`;else status.textContent=`${requestedVersion} ${loadState==='loading'?'読込中':'読込失敗'} · 表示中 ${installedVersion||'なし'}`;
 const w=innerWidth,h=Math.max(200,innerHeight-90);if(canvas.width!==w*renderer.getPixelRatio()||canvas.height!==h*renderer.getPixelRatio()){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}controls.update();renderer.render(scene,camera);}
void load();requestAnimationFrame(draw);
if(location.hostname==='127.0.0.1'&&location.port==='5200'){
 const button=document.createElement('button');button.textContent='飛行動画を保存';document.querySelector('nav')!.append(button);
 button.onclick=()=>{if(!mixer)return;button.disabled=true;clip.value='Flight';choose();paused=false;const rec=new MediaRecorder(canvas.captureStream(30),{mimeType:'video/webm'});const chunks:BlobPart[]=[];
 rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};rec.onstop=async()=>{await fetch('/record',{method:'POST',body:new Blob(chunks,{type:'video/webm'})});button.textContent='動画保存済み';button.disabled=false;};rec.start();setTimeout(()=>rec.stop(),17000);};
}
