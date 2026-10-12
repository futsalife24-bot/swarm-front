import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const canvas=document.querySelector('canvas')!;
const renderer=new T.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x29313a);renderer.toneMapping=T.ACESFilmicToneMapping;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1,.05,300),controls=new OrbitControls(camera,canvas);
scene.add(new T.HemisphereLight(0xecf3ff,0x66594a,2.3));
for(const [x,y,z,power] of [[-15,25,20,3.5],[15,20,-15,2.5]]){const l=new T.DirectionalLight(0xffffff,power);l.position.set(x,y,z);scene.add(l);}
const grid=new T.GridHelper(60,30,0x668899,0x3b4c5c);scene.add(grid);
const clip=document.querySelector<HTMLSelectElement>('#clip')!,seek=document.querySelector<HTMLInputElement>('#time')!,view=document.querySelector<HTMLSelectElement>('#view')!,status=document.querySelector('#status')!;
let model:T.Group,mixer:T.AnimationMixer,clips:T.AnimationClip[]=[],time=0,paused=false,last=performance.now(),calls=0,triangles=0;
const center=new T.Vector3(7,6.5,0);
function frame(){const dirs:Record<string,[number,number,number]>={hero:[-1.3,.8,1.6],front:[-2,0,0],side:[0,0,2],back:[2,0,0],top:[0,2,0.001]};controls.target.copy(center);camera.position.copy(center).add(new T.Vector3(...dirs[view.value]).normalize().multiplyScalar(48));controls.update();}
function choose(){mixer.stopAllAction();const c=clips.find(c=>c.name===clip.value)!;mixer.clipAction(c).setLoop(T.LoopRepeat,Infinity).play();time=0;seek.max=String(c.duration);}
clip.onchange=choose;view.onchange=frame;
document.querySelector<HTMLButtonElement>('#play')!.onclick=e=>{paused=!paused;(e.target as HTMLElement).textContent=paused?'再生':'一時停止';};
seek.oninput=()=>{time=Number(seek.value);paused=true;document.querySelector('#play')!.textContent='再生';};
function save(blob:Blob,name:string){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),10000);}
document.querySelector('#capture')!.addEventListener('click',()=>{renderer.render(scene,camera);canvas.toBlob(b=>{if(b)save(b,`harrow-${clip.value}-${time.toFixed(2)}-${view.value}.png`);});});
document.querySelector<HTMLButtonElement>('#record')!.onclick=e=>{const b=e.target as HTMLButtonElement;b.disabled=true;time=0;paused=false;const chunks:Blob[]=[];const recorder=new MediaRecorder(canvas.captureStream(30),{mimeType:'video/webm'});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=()=>{save(new Blob(chunks,{type:'video/webm'}),`harrow-${clip.value}.webm`);b.disabled=false;};recorder.start();setTimeout(()=>recorder.stop(),Number(seek.max)*1000);};
function draw(now:number){requestAnimationFrame(draw);const dt=Math.min(.05,(now-last)/1000);last=now;if(mixer){if(!paused)time=(time+dt)%Number(seek.max);mixer.setTime(time);if(document.activeElement!==seek)seek.value=time.toFixed(2);status.textContent=`${clip.value} ${time.toFixed(2)}秒・描画 ${calls}回・三角形 ${triangles.toLocaleString()}・材質と動作を実GLBから表示`;}
const w=innerWidth,h=Math.max(200,innerHeight-92);if(canvas.width!==w*renderer.getPixelRatio()||canvas.height!==h*renderer.getPixelRatio()){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}controls.update();renderer.render(scene,camera);calls=renderer.info.render.calls;triangles=renderer.info.render.triangles;}
new GLTFLoader().loadAsync('./harrow.glb?rev=b0d0664b7ea6').then(g=>{model=g.scene;model.traverse(o=>{if(o instanceof T.SkinnedMesh)o.frustumCulled=false});scene.add(model);clips=g.animations;mixer=new T.AnimationMixer(model);for(const c of clips){const option=document.createElement('option');option.value=c.name;option.textContent=c.name;clip.append(option)}clip.value='Idle';choose();frame();}).catch(e=>{status.textContent=`読込失敗: ${String(e)}`;console.error(e)});
requestAnimationFrame(draw);
