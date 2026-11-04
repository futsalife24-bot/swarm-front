import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
const stage=document.querySelector('#stage'),scene=new T.Scene();
scene.background=new T.Color('#343c37');
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
stage.append(renderer.domElement);
const camera=new T.PerspectiveCamera(36,1,.01,100);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.3,0);
scene.add(new T.HemisphereLight(0xe9f1e4,0x706451,2.5));
const light=new T.DirectionalLight(0xffead0,3.5);light.position.set(-3,6,4);light.castShadow=true;
light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:20});light.shadow.bias=-.0004;light.shadow.normalBias=.012;scene.add(light);
const ground=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:0x555c50,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.001;ground.receiveShadow=true;scene.add(ground);
const grid=new T.GridHelper(20,20,0x687260,0x606859);grid.position.y=.001;grid.visible=false;scene.add(grid);
const loader=new GLTFLoader();
const source=await loader.loadAsync('tatara.glb');
const soldierGLTF=await loader.loadAsync('/soldier/swarm-soldier.glb');
const soldier=soldierGLTF.scene;
// 製品GLBをそのまま読み、単位・縮尺を変えない。
soldier.position.set(-.95,0,0);scene.add(soldier);
const soldierIdle=soldierGLTF.animations.find(a=>a.name==='Idle');
if(soldierIdle){const m=new T.AnimationMixer(soldier);m.clipAction(soldierIdle).play();m.update(.1);}
soldier.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
const buddies=[],mixers=[];
for(let i=0;i<4;i++){
 const b=clone(source.scene);scene.add(b);b.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});buddies.push(b);mixers.push(new T.AnimationMixer(b));
}
let paused=false,current='Idle',time=0,view='hero';
function motion(name){current=name;document.querySelector('#motion').value=name;mixers.forEach(m=>{m.stopAllAction();m.clipAction(source.animations.find(a=>a.name===name)).play();});}
function count(n){document.querySelector('#count').value=String(n);buddies.forEach((b,i)=>{b.visible=i<n;b.position.set(n===1?0:(i%2)*1.6-.8,0,view==='game'?-1.2-Math.floor(i/2)*1.5:Math.floor(i/2)*1.5);});}
function setView(name){view=name;const game=name==='game';soldier.visible=game||name==='scale';grid.visible=game;
 document.querySelector('#view').value=name;document.body.classList.toggle('game',game);resize();
 camera.fov=game?65:36;controls.target.set(0,soldier.visible?.7:.3,0);
 const positions={hero:[-1.5,1.1,2],front:[0,.6,2.7],side:[-2.7,.6,0],back:[0,.8,-2.7],scale:[2.8,1.9,4],game:[-.187,2.853,4.955]};camera.position.set(...positions[name]);
 if(game)controls.target.set(-.95,1.5,-30);
 buddies.forEach(b=>b.rotation.y=game?Math.PI:0);count(+document.querySelector('#count').value);controls.update();camera.updateProjectionMatrix();
}
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();motion('Idle');count(1);setView('hero');
document.querySelector('#motion').onchange=e=>motion(e.target.value);
document.querySelector('#view').onchange=e=>setView(e.target.value);
document.querySelector('#count').onchange=e=>count(+e.target.value);
document.querySelector('#pause').onclick=()=>{paused=!paused;document.querySelector('#pause').textContent=paused?'再生':'一時停止';};
let last=performance.now();
function draw(now){const dt=Math.min((now-last)/1000,.05);last=now;if(!paused){time+=dt;mixers.forEach((m,i)=>{if(buddies[i].visible)m.update(dt);});}controls.update();renderer.render(scene,camera);document.querySelector('#status').textContent=`${current==='Idle'?'待機':current==='Follow'?'移動・追従':'掌を前へ'} ｜ 1,924三角形 / 1材質 / 11骨 ｜ 描画 ${renderer.info.render.calls}回 ｜ 独立プレビュー・実戦性能未検証`;requestAnimationFrame(draw);}
requestAnimationFrame(draw);
window.buddy={source,renderer,scene,camera,buddies,mixers,soldier,setView,count,motion,
 freeze(t=0){paused=true;mixers.forEach(m=>m.setTime(t));renderer.render(scene,camera);},
 play(){paused=false;},
 stats(){let tris=0,meshes=0,bones=0;source.scene.traverse(o=>{if(o.isMesh){meshes++;tris+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}if(o.isBone)bones++;});return {tris,meshes,bones,clips:source.animations.map(a=>({name:a.name,duration:a.duration,tracks:a.tracks.length})),soldierBounds:new T.Box3().setFromObject(soldier).getSize(new T.Vector3()).toArray(),draw:renderer.info.render.calls,triangles:renderer.info.render.triangles};},
 async measure(n,shadow){count(n);renderer.shadowMap.enabled=shadow;mixers.forEach(m=>m.setTime(0));const frames=[];for(let i=0;i<150;i++){await new Promise(requestAnimationFrame);const start=performance.now();mixers.forEach((m,j)=>{if(buddies[j].visible)m.update(1/60);});renderer.render(scene,camera);if(i>=30)frames.push(performance.now()-start);}frames.sort((a,b)=>a-b);return {n,shadow,cpuSubmitMedianMs:frames[60],cpuSubmitP95Ms:frames[114],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};}
};
window.ready=true;
