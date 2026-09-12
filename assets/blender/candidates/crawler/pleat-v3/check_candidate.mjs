import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2]??'http://127.0.0.1:5199',out='assets/blender/candidates/crawler/pleat-v3/validation';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results={};
try {
 const p=await browser.newPage({viewport:{width:1200,height:800},deviceScaleFactor:1});await p.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text()+' '+m.location().url)});
 await p.goto(base+'/assets/blender/candidates/crawler/pleat-v3/index.html');await p.waitForFunction(()=>window.houndMotion?.ready);
 await p.evaluate(()=>window.houndMotion.setPlaying(false));
 results.asset=await p.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');const {asset}=window.houndMotion;
  const palette=asset.atlas.image.data,n=asset.bones,ret={clips:{},bones:n,textureBytes:palette.byteLength};
  const v=new T.Vector3(),a=new T.Vector3(),sum=new T.Vector3(),m=new T.Matrix4();
  for(const [name,r] of Object.entries(asset.ranges)){
   let minY=Infinity,maxY=-Infinity,maxLoopDelta=0,nonfinite=0;
   for(let f=0;f<=r.steps;f+=2){
    for(const mesh of asset.meshes){const g=mesh.geometry,ps=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
     for(let i=0;i<ps.count;i++){v.fromBufferAttribute(ps,i);sum.set(0,0,0);
      for(let k=0;k<4;k++){const w=sw.getComponent(i,k);if(w===0)continue;m.fromArray(palette,((r.start+f)*n+si.getComponent(i,k))*16);a.copy(v).applyMatrix4(m);sum.addScaledVector(a,w);}
      minY=Math.min(minY,sum.y);maxY=Math.max(maxY,sum.y);if(!Number.isFinite(sum.x+sum.y+sum.z))nonfinite++;
     }
    }
   }
   for(let i=0;i<n*16;i++)maxLoopDelta=Math.max(maxLoopDelta,Math.abs(palette[r.start*n*16+i]-palette[(r.start+r.steps)*n*16+i]));
   ret.clips[name]={duration:r.duration,steps:r.steps,minY,maxY,maxLoopDelta,nonfinite};
  }
  // Check palette against native THREE skinning at an interior time, independently of the shader.
  const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');const gltf=await new GLTFLoader().loadAsync('/assets/blender/candidates/crawler/pleat-v3/pleat_motion_v3.glb');
  const mixer=new T.AnimationMixer(gltf.scene);mixer.clipAction(gltf.animations.find(c=>c.name==='Locomotion')).play();mixer.setTime(.3);gltf.scene.updateMatrixWorld(true);
  let skinDelta=0;gltf.scene.traverse(o=>{if(!o.isSkinnedMesh)return;o.skeleton.update();const g=o.geometry,range=asset.ranges.Locomotion;
   for(let i=0;i<g.attributes.position.count;i+=7){v.fromBufferAttribute(g.attributes.position,i);const native=o.applyBoneTransform(i,v.clone()).applyMatrix4(o.matrixWorld);sum.set(0,0,0);
    for(let k=0;k<4;k++){const w=g.attributes.skinWeight.getComponent(i,k);if(!w)continue;m.fromArray(palette,((range.start+18)*n+g.attributes.skinIndex.getComponent(i,k))*16);sum.addScaledVector(a.copy(v).applyMatrix4(m),w);}skinDelta=Math.max(skinDelta,sum.distanceTo(native));
   }
  });ret.nativeSkinMaxDelta=skinDelta;return ret;
 });
 writeFileSync(out+'/geometry-check.json',JSON.stringify(results.asset,null,2));console.log('Geometry',results.asset);
 for(const c of Object.values(results.asset.clips)){assert.equal(c.nonfinite,0);assert.ok(c.minY>=-.02,`ground penetration ${c.minY}`);assert.ok(c.maxLoopDelta<.0001,'clip endpoint continuity');}
 assert.ok(results.asset.nativeSkinMaxDelta<.0001);
 for(const [name,time] of [['Idle',1],['Locomotion',.30],['Lunge',.40],['Lunge',.48]]){
  await p.evaluate(({name,time})=>{window.houndMotion.select(name);window.houndMotion.draw(time)},{name,time});await p.screenshot({path:`${out}/${name}-${time}.png`});
 }
 results.counts=[];
 for(const count of [1,10,40]){
  await p.setViewportSize({width:844,height:480});
  results.counts.push(await p.evaluate(count=>{const h=window.houndMotion;h.setCount(count);h.select('Locomotion');h.draw(.30);const calls=h.renderer.info.render.calls;
   return {count,partCounts:h.batch.parts.map(p=>p.count),calls,modelCalls:h.batch.parts.length,phases:[...h.batch.poseB.array].slice(0,count*3)};
  },count));await p.screenshot({path:`${out}/mobile-${count}.png`});
 }
 for(const r of results.counts){assert.ok(r.partCounts.every(n=>n===r.count));assert.equal(r.modelCalls,4);}
 await p.setViewportSize({width:844,height:390});await p.evaluate(()=>{const h=window.houndMotion;h.setCount(1);h.setView('front');h.select('Locomotion');h.draw(.3)});await p.screenshot({path:out+'/mobile-front.png'});
 // Candidate screenshots: fixed camera, lights, scale and neutral pose.
 const review='assets/blender/candidates/crawler/pleat-v3/review';
 await p.setViewportSize({width:1200,height:800});
 for(const view of ['front','side','rear','oblique']){
  await p.evaluate(view=>{const h=window.houndMotion;h.setCount(1);h.setView(view);h.select('Idle');h.draw(0)},view);
  await p.screenshot({path:`${review}/${view}.png`});
 }
 for(const time of [0,.18,.36,.45,.65,1.2]){
  await p.evaluate(time=>{const h=window.houndMotion;h.setView('side');h.select('Lunge');h.draw(time)},time);
  await p.screenshot({path:`${review}/attack-${time}.png`});
 }
 await p.evaluate(()=>{const h=window.houndMotion;h.select('Idle');h.setCompare(true);h.draw(0)});await p.screenshot({path:review+'/comparison.png'});
 await p.evaluate(()=>window.houndMotion.setMono(true));await p.screenshot({path:review+'/silhouette-comparison.png'});
 await p.evaluate(()=>{const h=window.houndMotion;h.setMono(false);h.setCompare(false);h.setView('game');h.draw(0)});
 await p.setViewportSize({width:844,height:390});await p.screenshot({path:review+'/game-size.png'});
 results.previewErrors=[...errors];assert.deepEqual(errors,[]);
 // Reuse the actual game loader / renderer. Route only this test browser's HOUND response.
 const candidate='assets/blender/candidates/crawler/pleat-v3/pleat_motion_v3.glb';
 const fixture=await browser.newPage({viewport:{width:844,height:390}});
 const gameErrors=[];fixture.on('pageerror',e=>gameErrors.push(String(e)));
 await fixture.route('**/assets/enemies/hound_motion_v1.glb',r=>r.fulfill({path:candidate,contentType:'model/gltf-binary'}));
 await fixture.goto(base+'/e2e/structure-fixture.html');
 await fixture.evaluate(async()=>{
  const {Renderer}=await import('/src/client/render.ts'),g=await import('/src/shared/game.ts');
  const c=document.createElement('canvas'),d=document.createElement('div');d.id='damage';document.body.replaceChildren(c,d);
  const view=new Renderer(c),w=g.createWorld('pleat-qa',44,1);g.addPlayer(w,'p');g.start(w);w.enemies=[];
  g.spawn(w,'crawler',0,-3,'crown');Object.assign(w.players[0],{x:0,z:0});Object.assign(w.enemies[0],{x:0,z:-2.3,targetId:'p',active:true,wind:0,cool:0});
  window.fixture={view,w,g};view.render(w,'p',.016,0,0);
 });
 await fixture.waitForFunction(()=>window.fixture.view.structures.get('crawler')?.batch);
 results.realRenderer=await fixture.evaluate(()=>{
  const {view,w,g}=window.fixture,motion=view.structures.get('crawler'),e=w.enemies[0];const samples=[];
  for(const wind of [.45,.30,.01,0]){
   e.wind=wind;e.cool=wind===0?1.2:0;const before=JSON.stringify(w);view.render(w,'p',.016,0,0);
   const s=motion.controller.states.get(e.id);samples.push({wind,time:s.time,clip:s.clip,worldUnchanged:before===JSON.stringify(w)});
  }
  // Native skin bone at authored impact -> authoritative forward burst centre.
  const a=motion.batch.asset,r=a.ranges.Lunge,n=a.bones,sk=a.meshes[0].skeleton;
  return {samples,bones:sk.bones.map(b=>b.name),parts:motion.batch.parts.map(p=>p.count),nativeCandidate:sk.bones.some(b=>b.name==='keel')};
 });
 assert.ok(results.realRenderer.nativeCandidate);assert.ok(results.realRenderer.samples.every(s=>s.worldUnchanged&&s.clip==='Lunge'));assert.equal(results.realRenderer.samples.at(-1).time,.45);
 results.behavior=await fixture.evaluate(()=>{
  const {view,w,g}=window.fixture;w.enemies=[];g.spawn(w,'crawler',0,-2.3,'crown');const e=w.enemies[0];Object.assign(e,{x:0,z:-2.3,wind:0,cool:0,active:true});
  w.players[0].x=0;w.players[0].z=0;w.players[0].hp=160;
  const states=[],bursts=[];let changed=false;
  for(let i=0;i<70;i++){
   g.step(w,{},.05);const before=JSON.stringify(w);view.render(w,'p',.05,0,0);if(before!==JSON.stringify(w))changed=true;
   const s=view.structures.get('crawler').controller.states.get(e.id);states.push(s?.clip);
   for(const ev of w.events.filter(v=>v.type==='burst'))if(!bursts.some(b=>b.id===ev.id))bursts.push({...ev});
  }
  return {states:[...new Set(states)],bursts,worldMutatedByRenderer:changed,hp:w.players[0].hp};
 });
 assert.ok(results.behavior.bursts.length>0);assert.ok(results.behavior.hp<160);assert.equal(results.behavior.worldMutatedByRenderer,false);
 results.countsInRenderer=[];
 for(const count of [1,10,40]){
  results.countsInRenderer.push(await fixture.evaluate(count=>{
   const {view,w,g}=window.fixture;w.enemies=[];
   for(let i=0;i<count;i++){g.spawn(w,'crawler',(i%8-3.5)*2.8,-4-Math.floor(i/8)*3.5,'crown');Object.assign(w.enemies.at(-1),{targetId:'p',active:true})}
   const before=JSON.stringify(w);view.render(w,'p',.016,0,0);
   return {count,parts:view.structures.get('crawler').batch.parts.map(p=>p.count),worldUnchanged:before===JSON.stringify(w),calls:view.renderer.info.render.calls};
  },count));
 }
 assert.ok(results.countsInRenderer.every(x=>x.parts.every(n=>n===x.count)&&x.worldUnchanged));
 results.cleanup=await fixture.evaluate(()=>{const {view}=window.fixture;view.render(null,'p',0,0,0);const m=view.structures.get('crawler');return m.batch.parts.every(p=>p.count===0)&&m.controller.states.size===0});assert.ok(results.cleanup);
 // Actual renderer damage colour and disappearance, candidate bytes still only browser-routed.
 await fixture.evaluate(()=>{const {view,w,g}=window.fixture;w.enemies=[];g.spawn(w,'crawler',0,-4,'crown');Object.assign(w.enemies[0],{active:true,hurt:.15});view.render(w,'p',.016,0,0)});
 await fixture.screenshot({path:review+'/game-hurt.png'});
 results.hurt=await fixture.evaluate(()=>{const m=window.fixture.view.structures.get('crawler');return [...m.batch.parts[0].instanceColor.array].slice(0,3)});
 results.kill=await fixture.evaluate(()=>{const {view,w,g}=window.fixture;g.hurtEnemy(w,w.enemies[0],99999,'p');g.step(w,{},.05);view.render(w,'p',.016,0,0);return {count:view.structures.get('crawler').batch.parts[0].count,kill:w.events.some(e=>e.type==='kill')}});
 assert.equal(results.kill.count,0);assert.ok(results.kill.kill);await fixture.screenshot({path:review+'/game-kill.png'});
 assert.deepEqual(gameErrors,[]);results.gameErrors=gameErrors;
 // Failure fallback uses the unchanged production module, no main game asset edits.
 const fail=await browser.newPage();await fail.route('**/assets/enemies/hound_motion_v1.glb',r=>r.abort());await fail.goto(base+'/e2e/structure-fixture.html');
 results.fallback=await fail.evaluate(async()=>{const T=await import('/node_modules/three/build/three.module.js'),{StructureMotion}=await import('/src/client/structure-motion.ts');const m=new StructureMotion(new T.Scene(),1,'crawler');await m.loading;const src=new T.InstancedMesh(new T.BoxGeometry(),new T.MeshStandardMaterial(),1);m.sync(src,[],0);return !!m.error&&src.visible&&!m.batch});assert.ok(results.fallback);
 writeFileSync(out+'/browser-validation.json',JSON.stringify(results,null,2));console.log('PLEAT browser verification PASS');
}finally{await browser.close()}
