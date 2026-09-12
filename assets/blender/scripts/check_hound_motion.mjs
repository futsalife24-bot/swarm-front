import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2]??'http://127.0.0.1:5198',out='dist-validation/hound-motion';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results={};
try {
 const p=await browser.newPage({viewport:{width:1200,height:800},deviceScaleFactor:1});await p.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text()+' '+m.location().url)});
 await p.goto(base+'/assets/blender/preview-motion/index.html');await p.waitForFunction(()=>window.houndMotion?.ready);
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
  const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');const gltf=await new GLTFLoader().loadAsync('/assets/enemies/hound_motion_v1.glb');
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
 // Real game Renderer: debug is opt-in and receives only existing visual state.
 async function fixture(flag){await p.goto(base+'/e2e/structure-fixture.html'+(flag?'?debugHoundGlb=motion':''));await p.evaluate(async()=>{
  const {Renderer}=await import('/src/client/render.ts'),g=await import('/src/shared/game.ts');const c=document.createElement('canvas'),d=document.createElement('div');d.id='damage';document.body.replaceChildren(c,d);
  const view=new Renderer(c),w=g.createWorld('hound-motion',44,1);g.addPlayer(w,'p');g.start(w);w.enemies=[];g.spawn(w,'crawler',0,-6,'crown');Object.assign(w.enemies[0],{targetId:'p',active:true,wind:0});window.fixture={view,w,g};view.render(w,'p',.016,0,0);
 });if(flag)await p.waitForFunction(()=>window.fixture.view.houndDebug?.ready);}
 const requests=[];p.on('request',r=>{if(r.url().endsWith('.glb'))requests.push(r.url())});await fixture(false);assert.equal(requests.length,0);
 results.normal=await p.evaluate(()=>!window.fixture.view.houndDebug&&window.fixture.view.enemies.get('crawler').visible);assert.ok(results.normal);
 await fixture(true);
 results.game=await p.evaluate(()=>{const {view,w}=window.fixture;const e=w.enemies[0];const samples=[];
  for(const wind of [.45,.30,.01,0]){e.wind=wind;e.cool=wind===0?1.2:0;const before=JSON.stringify(w);view.render(w,'p',.016,0,0);samples.push({wind,worldUnchanged:before===JSON.stringify(w),clip:view.houndDebug.controller.states.get(e.id)?.clip,time:view.houndDebug.controller.states.get(e.id)?.time});}
  return {samples,parts:view.houndDebug.parts.length,calls:view.renderer.info.render.calls};});
 assert.ok(results.game.samples.every(s=>s.worldUnchanged&&s.clip==='Lunge'));assert.equal(results.game.samples.at(-1).time,.45);
 results.gameCounts=[];
 for(const count of [1,10,40])results.gameCounts.push(await p.evaluate(count=>{
  const {view,w,g}=window.fixture;w.enemies=[];
  for(let i=0;i<count;i++){g.spawn(w,'crawler',(i%8-3.5)*2.8,-6-Math.floor(i/8)*4,'crown');Object.assign(w.enemies.at(-1),{targetId:'p',active:true});}
  const before=JSON.stringify(w);view.render(w,'p',.016,0,0);const calls=view.renderer.info.render.calls;
  return {count,calls,parts:view.houndDebug.parts.map(p=>p.count),worldUnchanged:before===JSON.stringify(w)};
 },count));
 for(const r of results.gameCounts){assert.ok(r.parts.every(n=>n===r.count));assert.ok(r.worldUnchanged);}
 await p.getByRole('button',{name:'HOUND motion → Current',exact:true}).click();
 assert.ok(await p.evaluate(()=>{const {view,w}=window.fixture;view.render(w,'p',0,0,0);return view.enemies.get('crawler').visible&&!view.houndDebug.group.visible}));
 await p.getByRole('button',{name:'Current → HOUND motion',exact:true}).click();
 results.cleanup=await p.evaluate(()=>{const {view}=window.fixture;view.render(null,'p',0,0,0);return !view.houndDebug.group.visible&&view.houndDebug.parts.every(p=>p.count===0)&&view.houndDebug.controller.states.size===0});assert.ok(results.cleanup);
 const failure=await browser.newPage();await failure.route('**/hound_motion_v1.glb',r=>r.abort());await failure.goto(base+'/e2e/structure-fixture.html');
 results.fallback=await failure.evaluate(async()=>{const T=await import('/node_modules/three/build/three.module.js'),{HoundGlbDebug}=await import('/src/client/hound-glb-debug.ts');const d=new HoundGlbDebug(new T.Scene(),80,'motion');await d.loading;const s=new T.InstancedMesh(new T.BoxGeometry(),new T.MeshStandardMaterial(),80);s.count=1;d.sync(s);return !d.ready&&!!d.error&&s.visible;});assert.ok(results.fallback);
 assert.deepEqual(errors,[]);results.errors=errors;writeFileSync(out+'/browser-motion.json',JSON.stringify(results,null,2));console.log('HOUND browser motion PASS',results);
}finally{await browser.close()}
