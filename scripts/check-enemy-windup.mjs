import {chromium} from '@playwright/test';import fs from 'node:fs';import assert from 'node:assert/strict';
const out='dist-validation/enemy-windup';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
try {
const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/windup-check',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0;background:#10202a;color:white;font:22px sans-serif"><div id="label" style="position:absolute;left:25px;top:20px"></div></body>'}));
await page.goto('http://127.0.0.1:5351/windup-check');
const rows=await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js'),{GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js'),{loadEnemyMotion,HoundMotionBatch}=await import('/src/client/hound-motion.ts');
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1280,720);document.body.append(renderer.domElement);renderer.setScissorTest(true);
 const scene=new T.Scene();scene.background=new T.Color('#10202a');scene.add(new T.HemisphereLight(0xdcefff,0x566577,2.6));const light=new T.DirectionalLight(0xffffff,3);light.position.set(4,8,-6);scene.add(light);
 const camera=new T.PerspectiveCamera(38,640/720,.01,500),rows=[],entries=[];
 const snapshot=(model,bones)=>{model.updateMatrixWorld(true);return bones.map(b=>({p:b.getWorldPosition(new T.Vector3()),q:b.getWorldQuaternion(new T.Quaternion()).normalize(),s:b.scale.clone()}));};
 for(const name of ['pleat','hound','leaper','prism','ray','foundry_zero']){
  const fresh=await loadEnemyMotion(name),{scene:old,animations}=await new GLTFLoader().loadAsync(`/assets/enemies/${name}_motion_${name==='pleat'?'v5':name==='leaper'?'v2':'v1'}.glb`);
  let mesh;old.traverse(o=>{if(o.isSkinnedMesh)mesh=o});const oldBones=mesh.skeleton.bones,newBones=fresh.meshes[0].skeleton.bones,clip=fresh.clips.find(c=>c.name==='Lunge'),original=animations.find(c=>c.name==='Lunge'||c.name==='Attack');
  const mixer=new T.AnimationMixer(fresh.model),oldMixer=new T.AnimationMixer(old);
  for(const [m,c] of [[mixer,clip],[oldMixer,original]]){const a=m.clipAction(c);a.setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();}
  const impact=({prism:.8,ray:2.05,foundry_zero:3.1})[name]??.45;
  let contactError=0,impactError=0,maxDifference=0,minY=Infinity,oldMinY=Infinity,maxStep=0,previous,plateTurns=Array(8).fill(0),prevPlate;
  for(let f=0;f<=Math.round(clip.duration*60);f++){
   const time=f/60;mixer.setTime(time);oldMixer.setTime(time);const a=snapshot(fresh.model,newBones),b=snapshot(old,oldBones);
   a.forEach((p,i)=>{const d=p.p.distanceTo(b[i].p),angle=p.q.angleTo(b[i].q);if(!Number.isFinite(d+angle))throw Error(name+' nonfinite');maxDifference=Math.max(maxDifference,d,angle);if(time>=impact)impactError=Math.max(impactError,d,angle);if(['pleat','hound','leaper'].includes(name)&&newBones[i].name.endsWith('_toe'))contactError=Math.max(contactError,d);if(previous)maxStep=Math.max(maxStep,p.p.distanceTo(previous[i].p));});
   if(name==='prism'&&time<=impact){const plates=newBones.filter(b=>b.name.startsWith('shield_')).map(b=>b.quaternion.clone());if(prevPlate)plates.forEach((q,i)=>plateTurns[i]+=q.angleTo(prevPlate[i]));prevPlate=plates;}
   if(f%6===0){for(const mesh of fresh.meshes){mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i+=3){const p=new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i);mesh.applyBoneTransform(i,p);p.applyMatrix4(mesh.matrixWorld);if(!Number.isFinite(p.lengthSq()))throw Error(name+' invalid mesh');minY=Math.min(minY,p.y);}}}if(f%6===0){old.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();for(let i=0;i<o.geometry.attributes.position.count;i+=3){const p=new T.Vector3().fromBufferAttribute(o.geometry.attributes.position,i);o.applyBoneTransform(i,p);p.applyMatrix4(o.matrixWorld);oldMinY=Math.min(oldMinY,p.y);}}});}previous=a;
  }
  if(minY<oldMinY-1e-4||contactError>1e-4||impactError>1e-4||maxDifference<.2||plateTurns.some(v=>name==='prism'&&v<5.8))throw Error(JSON.stringify({name,contactError,impactError,maxDifference,plateTurns}));
  rows.push({name,contactError,impactError,maxDifference,minY,oldMinY,maxStep,plateTurns,duration:clip.duration});
  mixer.stopAllAction();const batch=new HoundMotionBatch(fresh,1);batch.setTransform(0,new T.Matrix4());batch.finish(1);
  const bounds=new T.Box3().setFromObject(old);entries.push({name,batch,old,oldMixer,impact,bounds,original});
 }
 window.windupDraw=(index,fraction)=>{const e=entries[index],center=e.bounds.getCenter(new T.Vector3()),radius=e.bounds.getBoundingSphere(new T.Sphere()).radius;camera.position.copy(center).add(new T.Vector3(.65,.4,-.65).normalize().multiplyScalar(radius/Math.sin(19*Math.PI/180)*1.55));camera.lookAt(center);
  e.oldMixer.clipAction(e.original).paused=false;e.oldMixer.setTime(e.impact*fraction);e.batch.setPose(0,'Lunge',e.impact*fraction);e.batch.finish(1);
  for(const [i,obj] of [[0,e.old],[1,e.batch.group]]){scene.add(obj);renderer.setViewport(i*640,0,640,720);renderer.setScissor(i*640,0,640,720);renderer.render(scene,camera);scene.remove(obj);}
  document.querySelector('#label').textContent=`${e.name} — OLD (left) / NEW (right) — wind-up ${Math.round(fraction*100)}%`;
 };
 return rows;
});
fs.writeFileSync(out+'/numeric.json',JSON.stringify(rows,null,2));
for(let i=0;i<rows.length;i++)for(const phase of [.3,.65,.9]){await page.evaluate(({i,phase})=>window.windupDraw(i,phase),{i,phase});await page.screenshot({path:`${out}/${rows[i].name}-${phase}.png`});}
assert.deepEqual(errors,[]);console.log(JSON.stringify(rows));
} finally {await browser.close()}

