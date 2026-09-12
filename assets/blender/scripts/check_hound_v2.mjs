import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2]??'http://127.0.0.1:5198',out=process.argv[3]??'dist-validation/hound-v2';
const bytes=readFileSync('public/assets/enemies/hound_blockout_v2.glb');
const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
assert.equal(gltf.materials.length,3);assert.equal(gltf.meshes.length,10);assert.equal(gltf.textures?.length??0,0);
assert.equal(gltf.animations?.length??0,0);assert.equal(bytes.readUInt32LE(8),bytes.length);
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results={};
try {
 const page=await browser.newPage({viewport:{width:1200,height:720},deviceScaleFactor:1});
 await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text()+' '+m.location().url)});
 await page.goto(base+'/assets/blender/preview-v2/index.html');
 await page.waitForFunction(()=>window.houndPreview?.ready);
 results.geometry=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');const p=window.houndPreview;
  const b=new T.Box3().setFromObject(p.model),current=new T.Box3().setFromObject(p.current);let triangles=0;const legs=[],scales=[];
  p.model.traverse(o=>{scales.push(o.scale.toArray());if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;if(o.name.includes('_leg_'))legs.push({name:o.name,ground:new T.Box3().setFromObject(o).min.y});}});
  return {bounds:{min:b.min.toArray(),max:b.max.toArray()},current:{min:current.min.toArray(),max:current.max.toArray()},triangles,legs,scales};
 });
 assert.equal(results.geometry.triangles,1532);assert.equal(results.geometry.legs.length,5);
 for(const l of results.geometry.legs)assert.ok(Math.abs(l.ground)<1e-5);
 for(const s of results.geometry.scales)assert.deepEqual(s,[1,1,1]);
 for(const view of ['front','oblique']){
  await page.evaluate(view=>{const p=window.houndPreview;p.select('compare');p.setView(view)},view);
  await page.screenshot({path:`${out}/hound_v1_vs_v2_${view}.png`});
 }
 await page.setViewportSize({width:844,height:390});
 await page.evaluate(()=>{const p=window.houndPreview;p.select('compare');p.setView('gameview')});
 await page.screenshot({path:`${out}/hound_v1_vs_v2_mobile.png`});
 async function fixture(flag){
  await page.goto(base+'/e2e/structure-fixture.html'+(flag?'?debugHoundGlb=1':''));
  await page.evaluate(async()=>{
   const {Renderer}=await import('/src/client/render.ts');const {createWorld,addPlayer,start,spawn}=await import('/src/shared/game.ts');
   const canvas=document.createElement('canvas');const damage=document.createElement('div');damage.id='damage';document.body.replaceChildren(canvas,damage);
   const view=new Renderer(canvas);const w=createWorld('hound-v2-debug',123,1);addPlayer(w,'p');start(w);w.enemies=[];
   const p=w.players[0];p.x=0;p.z=0;
   spawn(w,'crawler',0,-6,'crown');Object.assign(w.enemies[0],{targetId:'p',active:true,wind:0,tx:0,tz:0});
   window.fixture={view,w,spawn};view.render(w,'p',.016,0,0);
  });
  if(flag){await page.waitForFunction(()=>window.fixture.view.houndDebug?.ready);await page.evaluate(()=>{const {view,w}=window.fixture;view.render(w,'p',0,0,0)});}
 }
 await page.setViewportSize({width:1200,height:720});
 const glbRequests=[];page.on('request',r=>{if(r.url().endsWith('.glb'))glbRequests.push(r.url())});
 await fixture(false);
 results.normal=await page.evaluate(()=>({debug:!!window.fixture.view.houndDebug,visible:window.fixture.view.enemies.get('crawler').visible}));
 assert.equal(results.normal.debug,false);assert.equal(results.normal.visible,true);assert.equal(glbRequests.length,0);
 await fixture(true);
 async function captureGame(name){
  await page.evaluate(()=>{window.captureActive=true;const draw=()=>{if(!window.captureActive)return;const {view}=window.fixture;view.renderer.render(view.scene,view.camera);requestAnimationFrame(draw)};draw()});
  await page.screenshot({path:out+'/'+name+'.png'});
  await page.evaluate(()=>window.captureActive=false);
 }
 await captureGame('hound_v2_gameview');
 results.debug=await page.evaluate(()=>{const {view,w}=window.fixture;const before=JSON.stringify(w);view.render(w,'p',0,0,0);return {worldUnchanged:before===JSON.stringify(w),parts:view.houndDebug.parts.length,visible:view.houndDebug.group.visible,currentVisible:view.enemies.get('crawler').visible,calls:view.renderer.info.render.calls};});
 assert.equal(results.debug.worldUnchanged,true);assert.equal(results.debug.parts,10);assert.equal(results.debug.visible,true);assert.equal(results.debug.currentVisible,false);
 // Switching back must preserve authoritative state, and restore the current visual.
 await page.getByRole('button',{name:'HOUND v2 → Current',exact:true}).click();
 results.toggle=await page.evaluate(()=>{const {view,w}=window.fixture;const before=JSON.stringify(w);view.render(w,'p',0,0,0);return {worldUnchanged:before===JSON.stringify(w),visible:view.enemies.get('crawler').visible,glbVisible:view.houndDebug.group.visible};});
 assert.deepEqual(results.toggle,{worldUnchanged:true,visible:true,glbVisible:false});
 await captureGame('hound_current_gameview');
 await page.getByRole('button',{name:'Current → HOUND v2',exact:true}).click();
 await page.setViewportSize({width:844,height:390});
 await page.evaluate(()=>{const {view,w}=window.fixture;view.render(w,'p',0,0,0)});
 await captureGame('hound_v2_mobileview');
 // Additional lateral view avoids hiding the feet behind the player silhouette.
 await page.evaluate(()=>{const {view,w}=window.fixture;w.enemies[0].x=2.8;view.visual.clear();view.render(w,'p',0,0,0)});
 await captureGame('hound_v2_mobileview_unoccluded');
 results.instancing=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');const {view,w,spawn}=window.fixture;w.enemies=[];
  for(let i=0;i<40;i++){spawn(w,'crawler',(i%8-3.5)*2.8,-6-Math.floor(i/8)*4,'crown');w.enemies.at(-1).targetId='p';}
  view.render(w,'p',0,0,0);const source=view.enemies.get('crawler');
  const matrix=new T.Matrix4(),got=new T.Matrix4();source.getMatrixAt(0,matrix);
  const direction=new T.Vector3(0,0,-1).transformDirection(matrix);const e=w.enemies[0];const expected=new T.Vector3(-e.x,0,-e.z).normalize();
  let grounded=true;const rootTranslation=new T.Vector3().setFromMatrixPosition(matrix);
  for(const part of view.houndDebug.parts.filter(p=>p.name.includes('_leg_'))){part.getMatrixAt(0,got);part.geometry.computeBoundingBox();const b=part.geometry.boundingBox.clone().applyMatrix4(got);grounded&&=Math.abs(b.min.y-rootTranslation.y)<1e-5;}
  // Mesh-only draw-call measurement uses actual generated instanced meshes.
  const scene=new T.Scene();scene.add(view.houndDebug.group);view.renderer.render(scene,view.camera);const calls=view.renderer.info.render.calls;view.scene.add(view.houndDebug.group);
  view.render(w,'p',0,0,0);const start=performance.now();for(let i=0;i<30;i++)view.render(w,'p',0,0,0);
  return {count:source.count,partCounts:view.houndDebug.parts.map(p=>p.count),modelDrawCalls:calls,grounded,forwardDot:direction.dot(expected),cpuSubmitMsPerFrame:(performance.now()-start)/30};
 });
 assert.equal(results.instancing.count,40);assert.ok(results.instancing.partCounts.every(n=>n===40));assert.equal(results.instancing.modelDrawCalls,10);assert.equal(results.instancing.grounded,true);assert.ok(results.instancing.forwardDot>.9999);
 await captureGame('hound_v2_40_mobile');
 results.cleanup=await page.evaluate(()=>{const {view}=window.fixture;view.render(null,'p',0,0,0);return !view.houndDebug.group.visible&&view.houndDebug.parts.every(p=>p.count===0)});assert.equal(results.cleanup,true);
 assert.deepEqual(errors,[]);results.errors=errors;
 // A failed request should keep the current HOUND; expected network error is isolated.
 const failure=await browser.newPage();await failure.route('**/hound_blockout_v2.glb',r=>r.abort());
 await failure.goto(base+'/e2e/structure-fixture.html?debugHoundGlb=1');
 results.failure=await failure.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');const {HoundGlbDebug}=await import('/src/client/hound-glb-debug.ts');
  const d=new HoundGlbDebug(new T.Scene(),80);await d.loading;const source=new T.InstancedMesh(new T.BoxGeometry(),new T.MeshBasicMaterial(),80);source.count=1;d.sync(source);return {ready:d.ready,visible:source.visible,hasError:!!d.error};
 });assert.deepEqual(results.failure,{ready:false,visible:true,hasError:true});
 results.renderer='Chrome SwiftShader; CPU submission only, not a phone GPU benchmark';
 writeFileSync(`${out}/three-validation.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close()}
