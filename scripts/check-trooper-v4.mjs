import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir='dist-validation/trooper-v4';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1100,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5314/assets/blender/preview-trooper/');await page.waitForFunction(()=>window.trooperQA,{timeout:90000});
 await page.evaluate(()=>{trooperQA.set('Bind_Pose',0);document.querySelector('aside').style.display='none'});
 for(const view of ['front','back','side','oblique']){
  await page.evaluate(view=>{trooperQA.view(view);trooperQA.set('Bind_Pose',0)},view);
  await page.screenshot({path:`${dir}/model-${view}.png`});
 }
 await page.evaluate(()=>{trooperQA.view('front');trooperQA.scene.children.find(o=>o.type==='SkeletonHelper').visible=true;trooperQA.set('Bind_Pose',0)});
 await page.screenshot({path:`${dir}/skeleton.png`});
 await page.evaluate(()=>{trooperQA.scene.children.find(o=>o.type==='SkeletonHelper').visible=false});
 for(const [clip,time,weapon] of [['Weapon_Idle_Rifle',0,'rifle'],['Run',.16,'rifle'],['Fire_Rocket',.25,'rocket'],['Dodge_Roll',.166,'rifle'],['Hit_Heavy',.5,'rifle'],['Switch_1_to_2',.45,'rifle']]){
  await page.evaluate(([clip,time,weapon])=>{trooperQA.view('oblique');trooperQA.weapon(weapon);trooperQA.set(clip,time)},[clip,time,weapon]);
  await page.screenshot({path:`${dir}/pose-${clip}.png`});
 }
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const {StandardTrooper,TROOPER_SKINS,TROOPER_SWITCH}=await import('/src/client/standard-trooper.ts');
  const q=trooperQA,t=q.trooper,ground={},v=new T.Vector3(),weightErrors=[],used=new Set();let maxInfluences=0;
  t.model.traverse(o=>{if(!o.isSkinnedMesh)return;const {skinWeight:w,skinIndex:ix}=o.geometry.attributes;
   for(let i=0;i<w.count;i++){let total=0,n=0;for(let j=0;j<4;j++){const value=w.getComponent(i,j);total+=value;if(value>1e-5){n++;used.add(o.skeleton.bones[ix.getComponent(i,j)].name)}}maxInfluences=Math.max(n,maxInfluences);if(Math.abs(total-1)>.0001)weightErrors.push(i)}
  });
  const bones=t.bones.map(b=>({name:b.name,parent:b.parent?.name}));
  t.sample('Idle',0);
  const stance=Object.fromEntries(['UpperLeg','LowerLeg','Foot'].map(n=>[n,Math.abs(t.model.getObjectByName(n+'_R').getWorldPosition(new T.Vector3()).x-t.model.getObjectByName(n+'_L').getWorldPosition(new T.Vector3()).x)]));
  for(const [name,clip] of t.clips){if(name.startsWith('Upper_')||name.startsWith('Lower_')||name==='Bind_Pose')continue;
   let min=Infinity;for(let f=0;f<=24;f++){t.sample(name,clip.duration*f/24);t.model.traverse(o=>{if(!o.isSkinnedMesh)return;o.skeleton.update();for(let i=0;i<o.geometry.attributes.position.count;i++){o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld);min=Math.min(min,v.y);if(!Number.isFinite(v.length()))throw Error('nonfinite vertex')}})}ground[name]=min;
  }
  const handoffs=[];for(const from of [0,1])for(const time of [TROOPER_SWITCH.holster,TROOPER_SWITCH.draw]){
   t.sampleSwitch(from,time);const slot=time===TROOPER_SWITCH.holster?from:1-from;
   handoffs.push({from,time,error:t.hand.getWorldPosition(new T.Vector3()).distanceTo(t.back[slot].getWorldPosition(new T.Vector3()))});
  }
  // Compare existing world-space skeleton trajectories, including all sockets.
  const previous=await new GLTFLoader().loadAsync('/assets/characters/standard_trooper_v3.glb');
  const old=new StandardTrooper({...t.assets,character:previous}),trajectory=[];
  for(const clip of previous.animations){let error=0,legChange=0;for(let f=0;f<=8;f++){
   t.sample(clip.name,clip.duration*f/8);old.sample(clip.name,clip.duration*f/8);
   for(const b of old.bones){const n=t.model.getObjectByName(b.name),delta=n.getWorldPosition(new T.Vector3()).distanceTo(b.getWorldPosition(new T.Vector3()));if(/^(UpperLeg|LowerLeg|Foot)_/.test(b.name))legChange=Math.max(legChange,delta);else error=Math.max(error,delta)}
  }trajectory.push({clip:clip.name,maxUpperPositionError:error,maxLegPositionChange:legChange})}old.dispose();
  const models=Object.keys(TROOPER_SKINS).map((skin,i)=>{const c=new StandardTrooper(t.assets);c.setSkin(skin);c.sample('Weapon_Idle_Rifle',0);c.equip([{id:'a',kind:'rifle'},{id:'b',kind:'rocket'}],0);c.model.position.x=(i-1.5)*.95;q.scene.add(c.model);return c});t.model.visible=false;
  const materials=c=>{const a=[];c.model.traverse(o=>{if(o.isSkinnedMesh)a.push(o.material)});return a};
  const independentMaterials=models.every((c,i)=>models.every((d,j)=>i===j||materials(c).every(m=>!materials(d).includes(m))));
  const otherBefore=materials(models[1]).map(m=>m.color.getHex());models[0].setSkin('special');models[0].setSkin('standard');
  const noTintLeak=materials(models[1]).every((m,i)=>m.color.getHex()===otherBefore[i]);
  const sourceRestored=[...models[0].skinMaterials].every(([a,b])=>a.color.equals(b.color));
  q.camera.position.set(3.2,2.1,-6.9);q.camera.lookAt(0,1,0);q.renderer.render(q.scene,q.camera);
  window.v4Models=models;
  return {bones,stance,weightedBones:[...used],weightErrors,maxInfluences,ground,handoffs,trajectory,independentMaterials,noTintLeak,sourceRestored,independentSkeletons:new Set(models.map(c=>c.bones[0])).size===4,drawCalls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles};
 });
 await page.screenshot({path:`${dir}/four-skins.png`});
 writeFileSync(`${dir}/runtime-validation.json`,JSON.stringify({...result,errors},null,2));
 assert.equal(result.bones.length,57);assert.deepEqual(result.weightErrors,[]);assert.ok(result.maxInfluences<=4);
 for(const side of ['L','R'])for(const finger of ['Thumb','Index','Middle','Ring','Little'])for(let i=1;i<=3;i++)assert.ok(result.weightedBones.includes(`${finger}${i}_${side}`));
 for(const n of ['SpineMid','Toe_L','Toe_R'])assert.ok(result.weightedBones.includes(n));
 assert.ok(Object.values(result.ground).every(n=>n>-.012),'no ground penetration >12mm');
 assert.ok(result.handoffs.every(n=>n.error<.001),'socket handoff');
 assert.ok(result.trajectory.every(n=>n.maxUpperPositionError<.005),'legacy upper-body motion preserved within 5mm');
 assert.ok(result.stance.UpperLeg<result.stance.LowerLeg&&result.stance.LowerLeg<result.stance.Foot&&result.stance.Foot>.43,'neutral stance opens from hips to ankles');
 assert.ok(result.independentMaterials&&result.noTintLeak&&result.sourceRestored&&result.independentSkeletons);assert.ok(result.drawCalls<80);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({bones:result.bones.length,stance:result.stance,weightedBones:result.weightedBones.length,ground:result.ground,handoffs:result.handoffs,maxLegacyUpperError:Math.max(...result.trajectory.map(p=>p.maxUpperPositionError)),drawCalls:result.drawCalls,triangles:result.triangles,independentSkins:true}));
}finally{await browser.close()}
