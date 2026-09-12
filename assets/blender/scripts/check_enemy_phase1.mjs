import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const enemy=process.argv[2]||'prism',base=process.argv[3]||'http://127.0.0.1:5198',out='dist-validation/'+enemy+'-v1';
const [kind,query,label,counts]={prism:['spitter','Prism','PRISM',[1,10,40]],ray:['hornet','Ray','RAY',[1,10,40]],foundry_zero:['boss','Foundry','FOUNDRY ZERO',[1,5,10]]}[enemy];
const expected=JSON.parse(readFileSync(out+'/blender-validation.json'));
const bytes=readFileSync('public/assets/enemies/'+enemy+'_v1.glb');
const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
assert.equal(gltf.materials.length,expected.source.materials.length);assert.equal(gltf.meshes.length,expected.source.meshes.length);assert.equal(gltf.textures?.length??0,0);
assert.equal(gltf.animations?.length??0,0);assert.equal(bytes.readUInt32LE(8),bytes.length);
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results={};
try {
 const page=await browser.newPage({viewport:{width:1200,height:720},deviceScaleFactor:1});
 await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text()+' '+m.location().url)});
 await page.goto(base+'/assets/blender/preview-enemies/index.html?enemy='+enemy);
 await page.waitForFunction(()=>window.enemyPreview?.ready);
 results.geometry=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');const p=window.enemyPreview;
  const b=new T.Box3().setFromObject(p.model),current=new T.Box3().setFromObject(p.current);let triangles=0;const legs=[],scales=[];
  p.model.traverse(o=>{scales.push(o.scale.toArray());if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;if(o.name.includes('_leg_'))legs.push({name:o.name,ground:new T.Box3().setFromObject(o).min.y});}});
  return {bounds:{min:b.min.toArray(),max:b.max.toArray()},current:{min:current.min.toArray(),max:current.max.toArray()},triangles,legs,scales};
 });
 assert.equal(results.geometry.triangles,expected.source.triangles);assert.ok(Math.abs(results.geometry.bounds.min[1]-expected.ground)<1e-5);
 for(const l of results.geometry.legs)assert.ok(Math.abs(l.ground)<1e-5);
 for(const s of results.geometry.scales)assert.deepEqual(s,[1,1,1]);
 for(const view of ['front','side','oblique']){
  await page.evaluate(view=>{const p=window.enemyPreview;p.select('compare');p.setView(view)},view);
  await page.screenshot({path:`${out}/compare_${view}.png`});
 }
 await page.evaluate(()=>{const p=window.enemyPreview;p.select('new');p.setView('front');p.mono(true)});
 await page.screenshot({path:out+'/prototype_silhouette.png'});
 await page.evaluate(()=>window.enemyPreview.mono(false));
 await page.setViewportSize({width:844,height:390});
 await page.evaluate(()=>{const p=window.enemyPreview;p.select('compare');p.setView('gameview')});
 await page.screenshot({path:`${out}/compare_mobile.png`});
 async function fixture(flag){
  await page.goto(base+'/e2e/structure-fixture.html'+(flag?'?debug'+query+'Glb=v1':''));
  await page.evaluate(async(kind)=>{
   const {Renderer}=await import('/src/client/render.ts');const {createWorld,addPlayer,start,spawn}=await import('/src/shared/game.ts');
   const canvas=document.createElement('canvas');const damage=document.createElement('div');damage.id='damage';document.body.replaceChildren(canvas,damage);
   const view=new Renderer(canvas);const w=createWorld('enemy-phase1-debug',123,1);addPlayer(w,'p');start(w);w.enemies=[];
   const p=w.players[0];p.x=0;p.z=0;
   spawn(w,kind,2.8,kind==='boss'?-18:-8,'crown');Object.assign(w.enemies[0],{targetId:'p',active:true,wind:0,tx:0,tz:0});
   window.fixture={view,w,spawn,kind};view.render(w,'p',.016,0,0);
  },kind);
  if(flag){await page.waitForFunction(()=>window.fixture.view.enemyGlbDebug.get(window.fixture.kind)?.ready);await page.evaluate(()=>{const {view,w}=window.fixture;view.render(w,'p',0,0,0)});}
 }
 await page.setViewportSize({width:1200,height:720});
 const glbRequests=[];page.on('request',r=>{if(r.url().endsWith('.glb'))glbRequests.push(r.url())});
 await fixture(false);
 results.normal=await page.evaluate(()=>({debug:!!window.fixture.view.enemyGlbDebug.get(window.fixture.kind),visible:window.fixture.view.enemies.get(window.fixture.kind).visible}));
 assert.equal(results.normal.debug,false);assert.equal(results.normal.visible,true);assert.equal(glbRequests.length,0);
 await fixture(true);
 async function captureGame(name){
  await page.evaluate(()=>{window.captureActive=true;const draw=()=>{if(!window.captureActive)return;const {view}=window.fixture;view.renderer.render(view.scene,view.camera);requestAnimationFrame(draw)};draw()});
  await page.screenshot({path:out+'/'+name+'.png'});
  await page.evaluate(()=>window.captureActive=false);
 }
 await captureGame('prototype_gameview');
 results.debug=await page.evaluate(()=>{const {view,w}=window.fixture;const before=JSON.stringify(w);view.render(w,'p',0,0,0);return {worldUnchanged:before===JSON.stringify(w),parts:view.enemyGlbDebug.get(window.fixture.kind).parts.length,visible:view.enemyGlbDebug.get(window.fixture.kind).group.visible,currentVisible:view.enemies.get(window.fixture.kind).visible,calls:view.renderer.info.render.calls};});
 assert.equal(results.debug.worldUnchanged,true);assert.equal(results.debug.parts,expected.source.materials.length);assert.equal(results.debug.visible,true);assert.equal(results.debug.currentVisible,false);
 // Switching back must preserve authoritative state, and restore the current visual.
 await page.getByRole('button',{name:label+' v1 → Current',exact:true}).click();
 results.toggle=await page.evaluate(()=>{const {view,w}=window.fixture;const before=JSON.stringify(w);view.render(w,'p',0,0,0);return {worldUnchanged:before===JSON.stringify(w),visible:view.enemies.get(window.fixture.kind).visible,glbVisible:view.enemyGlbDebug.get(window.fixture.kind).group.visible};});
 assert.deepEqual(results.toggle,{worldUnchanged:true,visible:true,glbVisible:false});
 await captureGame('current_gameview');
 await page.getByRole('button',{name:'Current → '+label+' v1',exact:true}).click();
 await page.setViewportSize({width:844,height:390});
 await page.evaluate(()=>{const {view,w}=window.fixture;view.render(w,'p',0,0,0)});
 await captureGame('prototype_mobileview');
 // Additional lateral view avoids hiding the feet behind the player silhouette.
 await page.evaluate(()=>{const {view,w}=window.fixture;w.enemies[0].x=2.8;view.visual.clear();view.render(w,'p',0,0,0)});
 await captureGame('prototype_mobileview_unoccluded');
 results.counts=[];
 for(const count of counts){
 const measurement=await page.evaluate(async(count)=>{
 const T=await import('/node_modules/three/build/three.module.js');const {view,w,spawn,kind}=window.fixture;w.enemies=[];
 for(let i=0;i<count;i++){spawn(w,kind,(i%5-2)*(kind==='boss'?8:3.2),-(kind==='boss'?22:12)-Math.floor(i/5)*(kind==='boss'?9:4),'crown');w.enemies.at(-1).targetId='p';}
 const before=JSON.stringify(w);view.render(w,'p',0,0,0);const totalCalls=view.renderer.info.render.calls;
 const scene=new T.Scene();scene.add(view.enemyGlbDebug.get(window.fixture.kind).group);view.renderer.render(scene,view.camera);const calls=view.renderer.info.render.calls;view.scene.add(view.enemyGlbDebug.get(window.fixture.kind).group);view.render(w,'p',0,0,0);
 return {count,counts:view.enemyGlbDebug.get(window.fixture.kind).parts.map(p=>p.count),modelDrawCalls:calls,sceneDrawCalls:totalCalls,worldUnchanged:before===JSON.stringify(w)};
 },count);
 assert.ok(measurement.counts.every(n=>n===count));assert.equal(measurement.modelDrawCalls,expected.source.materials.length);assert.equal(measurement.worldUnchanged,true);results.counts.push(measurement);
 await captureGame('prototype_'+count+'_mobile');
 }
 results.instancing=await page.evaluate(async(maxCount)=>{
  const T=await import('/node_modules/three/build/three.module.js');const {view,w,spawn,kind}=window.fixture;w.enemies=[];
  for(let i=0;i<maxCount;i++){spawn(w,kind,(i%5-2)*(kind==='boss'?8:3.2),-(kind==='boss'?22:12)-Math.floor(i/5)*(kind==='boss'?9:4),'crown');w.enemies.at(-1).targetId='p';}
  view.render(w,'p',0,0,0);const source=view.enemies.get(window.fixture.kind);
  const matrix=new T.Matrix4(),got=new T.Matrix4();source.getMatrixAt(0,matrix);
  const direction=new T.Vector3(0,0,-1).transformDirection(matrix);const e=w.enemies[0];const expected=new T.Vector3(-e.x,0,-e.z).normalize();
  let grounded=true;const rootTranslation=new T.Vector3().setFromMatrixPosition(matrix);
  for(const part of view.enemyGlbDebug.get(window.fixture.kind).parts){part.getMatrixAt(0,got);part.geometry.computeBoundingBox();const b=part.geometry.boundingBox.clone().applyMatrix4(got);grounded&&=b.min.y>=rootTranslation.y-1e-5;}
  // Mesh-only draw-call measurement uses actual generated instanced meshes.
  const scene=new T.Scene();scene.add(view.enemyGlbDebug.get(window.fixture.kind).group);view.renderer.render(scene,view.camera);const calls=view.renderer.info.render.calls;view.scene.add(view.enemyGlbDebug.get(window.fixture.kind).group);
  view.render(w,'p',0,0,0);const start=performance.now();for(let i=0;i<30;i++)view.render(w,'p',0,0,0);
  return {count:source.count,partCounts:view.enemyGlbDebug.get(window.fixture.kind).parts.map(p=>p.count),modelDrawCalls:calls,grounded,forwardDot:direction.dot(expected),cpuSubmitMsPerFrame:(performance.now()-start)/30};
 },counts.at(-1));
 assert.equal(results.instancing.count,counts.at(-1));assert.ok(results.instancing.partCounts.every(n=>n===counts.at(-1)));assert.equal(results.instancing.modelDrawCalls,expected.source.materials.length);assert.equal(results.instancing.grounded,true);assert.ok(results.instancing.forwardDot>.9999);
 await captureGame('prototype_'+counts.at(-1)+'_mobile');
 results.cleanup=await page.evaluate(()=>{const {view}=window.fixture;view.render(null,'p',0,0,0);return !view.enemyGlbDebug.get(window.fixture.kind).group.visible&&view.enemyGlbDebug.get(window.fixture.kind).parts.every(p=>p.count===0)});assert.equal(results.cleanup,true);
 assert.deepEqual(errors,[]);results.errors=[...errors];
 // Actual Renderer failure path; same static world as successful comparison.
 await page.route('**/'+enemy+'_v1.glb',r=>r.abort());
 await page.goto(base+'/e2e/structure-fixture.html?debug'+query+'Glb=1');
 results.failure=await page.evaluate(async(kind)=>{
 const {Renderer}=await import('/src/client/render.ts');const {createWorld,addPlayer,start,spawn}=await import('/src/shared/game.ts');
 const canvas=document.createElement('canvas'),damage=document.createElement('div');damage.id='damage';document.body.replaceChildren(canvas,damage);
 const view=new Renderer(canvas),w=createWorld('fallback',123,1);addPlayer(w,'p');start(w);w.enemies=[];spawn(w,kind,0,-9,'crown');
 for(let i=0;i<200&&!view.enemyGlbDebug.get(kind);i++)await new Promise(r=>setTimeout(r,10));
 const d=view.enemyGlbDebug.get(kind);await d.loading;const before=JSON.stringify(w);view.render(w,'p',0,0,0);
 return {ready:d.ready,visible:view.enemies.get(kind).visible,hasError:!!d.error,worldUnchanged:before===JSON.stringify(w),glbVisible:d.group.visible};
 },kind);assert.deepEqual(results.failure,{ready:false,visible:true,hasError:true,worldUnchanged:true,glbVisible:false});
 assert.equal(await page.getByRole('button',{name:label+' GLB failed · Current',exact:true}).isDisabled(),true);
 results.expectedFailureNetworkErrors=errors.slice(results.errors.length);
 results.renderer='Chrome SwiftShader; CPU submission only, not a phone GPU benchmark';
 writeFileSync(`${out}/validation.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close()}
