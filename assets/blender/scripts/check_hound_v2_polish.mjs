import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2]??'http://127.0.0.1:5198';
const stage=process.argv[3]??'after';
assert.ok(['before','after'].includes(stage));
const out='dist-validation/hound-v2-polish';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1200,height:720},deviceScaleFactor:1});
 await page.goto(base+'/assets/blender/preview-v2/index.html');
 await page.waitForFunction(()=>window.houndPreview?.ready);
 for(const [name,view,width,height,mono] of [
  ['front','front',1200,720,false],['mobile','gameview',844,390,false],
  ['oblique','oblique',1200,720,false],['silhouette','oblique',1200,720,true]]){
  await page.setViewportSize({width,height});
  await page.evaluate(({view,mono})=>{const p=window.houndPreview;p.select('new');p.mono(mono);p.setView(view);p.render()},{view,mono});
  await page.screenshot({path:`${out}/v2-${stage}-${name}.png`});
 }
 if(stage==='before')process.exitCode=0;
 else {
  const bytes=readFileSync('public/assets/enemies/hound_blockout_v2.glb');
  const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  await page.goto(base+'/e2e/structure-fixture.html?debugHoundGlb=1');
  await page.setViewportSize({width:844,height:390});
  await page.evaluate(async()=>{
   const {Renderer}=await import('/src/client/render.ts');
   const game=await import('/src/shared/game.ts');
   const canvas=document.createElement('canvas'),damage=document.createElement('div');damage.id='damage';document.body.replaceChildren(canvas,damage);
   const view=new Renderer(canvas),w=game.createWorld('hound-polish',123,1);game.addPlayer(w,'p');game.start(w);w.enemies=[];w.players[0].x=0;w.players[0].z=0;
   window.fixture={view,w,game};await view.houndDebug?.loading;
  });
  await page.waitForFunction(()=>window.fixture.view.houndDebug?.ready);
  const records=[];
  for(const count of [1,10,40]){
   records.push(await page.evaluate(async count=>{
    const T=await import('/node_modules/three/build/three.module.js');
    const {view,w,game}=window.fixture;w.enemies=[];view.visual.clear();
    for(let i=0;i<count;i++){game.spawn(w,'crawler',count===1?2.8:(i%8-3.5)*2.8,-6-Math.floor(i/8)*4,'crown');Object.assign(w.enemies.at(-1),{targetId:'p',active:true,wind:0,tx:0,tz:0});}
    const before=JSON.stringify(w);view.render(w,'p',0,0,0);
    const only=new T.Scene();only.add(view.houndDebug.group);view.renderer.render(only,view.camera);
    const modelDrawCalls=view.renderer.info.render.calls;view.scene.add(view.houndDebug.group);
    // Wall-clock intervals between rAF callbacks while rendering the full static scene.
    // These are browser frame cadence, not reciprocal CPU submission time or GPU timer queries.
    const timestamps=[];let warmup=30;
    await new Promise(resolve=>{function frame(t){view.render(w,'p',0,0,0);if(warmup>0)warmup--;else timestamps.push(t);if(timestamps.length===121)resolve();else requestAnimationFrame(frame);}requestAnimationFrame(frame)});
    const intervals=timestamps.slice(1).map((t,i)=>t-timestamps[i]);const sorted=[...intervals].sort((a,b)=>a-b);
    const gl=view.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {count,modelDrawCalls,sceneDrawCalls:view.renderer.info.render.calls,partCounts:view.houndDebug.parts.map(p=>p.count),
     fps:120000/(timestamps.at(-1)-timestamps[0]),frameMsMean:(timestamps.at(-1)-timestamps[0])/120,frameMsP95:sorted[Math.ceil(.95*sorted.length)-1],frameIntervalsMs:intervals,
     renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),worldUnchanged:before===JSON.stringify(w)};
   },count));
   assert.equal(records.at(-1).modelDrawCalls,10);assert.ok(records.at(-1).partCounts.every(n=>n===count));assert.equal(records.at(-1).worldUnchanged,true);
   await page.evaluate(()=>{window.capturing=true;function draw(){if(!window.capturing)return;const {view}=window.fixture;view.renderer.render(view.scene,view.camera);requestAnimationFrame(draw)}draw()});
   await page.screenshot({path:`${out}/v2-after-game-${count}-mobile.png`});
   await page.evaluate(()=>window.capturing=false);
  }
  // Same browser context: debug enabled -> normal URL must not inherit the switch.
  const requests=[];page.on('request',r=>{if(r.url().endsWith('hound_blockout_v2.glb'))requests.push(r.url())});
  await page.goto(base+'/e2e/structure-fixture.html');
  const persisted=await page.evaluate(async()=>{const {Renderer}=await import('/src/client/render.ts');const canvas=document.createElement('canvas');document.body.replaceChildren(canvas);const view=new Renderer(canvas);return !!view.houndDebug;});
  assert.equal(persisted,false);assert.equal(requests.length,0);
  const report={meshCount:gltf.meshes.length,materials:gltf.materials.length,glbBytes:bytes.length,viewport:{width:844,height:390},records,debugPersisted:persisted,normalGlbRequests:requests.length,
   method:'30 warmup frames + 120 requestAnimationFrame intervals per count; full static game Renderer, fixed world, no simulation/network. Chrome headless SwiftShader; browser frame cadence, not GPU completion/presentation or Android FPS.'};
  writeFileSync(`${out}/performance.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,records:records.map(({frameIntervalsMs,...r})=>r)},null,2));
 }
} finally {await browser.close()}
