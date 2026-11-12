// Isolated solo UI. Passive snapshot of newly inserted projectile and first actual renderer draw.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const kinds=['rocket','heavy'],out='dist-validation/rocket-visual-series';
await fs.mkdir(out,{recursive:true});
const fixtureSource=`import {freshProgress,validateProgress,newSaveKey} from './src/client/progression-save.ts';import {makeWeapon} from './src/shared/progression.ts';
export const key=newSaveKey('normal');export const fixtures={};for(const kind of ${JSON.stringify(kinds)}){const s=freshProgress('normal'),w=makeWeapon('probe-'+kind,kind,0,{power:0,reload:0,range:0,rate:0},false,s.serial++);s.inventory.push(w);s.soldiers[0].equipped[0]=w.id;s.tutorials=['gear','armory','base','battle','combat'];s.armoryMigration=1;fixtures[kind]=JSON.stringify(validateProgress(s));}`;
await build({stdin:{contents:fixtureSource,resolveDir:process.cwd(),sourcefile:'rocket-probe-fixture.js'},bundle:true,format:'esm',platform:'node',packages:'external',outfile:out+'/fixture.mjs',define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'}});
const fixture=await import('../dist-validation/rocket-visual-series/fixture.mjs');
const server=await createServer({configFile:false,define:{__SWARM_BUILD__:JSON.stringify('local-review'),__AUTO_CHANGELOG__:JSON.stringify([])},server:{host:'127.0.0.1',port:0,hmr:false,watch:{ignored:['**/dist-validation/**','**/design/**','**/public/**']}},optimizeDeps:{noDiscovery:true,include:[]}});
let browser,context,page,stage='server';const records=[];
try{
 await server.listen();const base='http://127.0.0.1:'+server.httpServer.address().port;
 browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
 for(const kind of kinds){
  stage=kind+' prepare';context=await browser.newContext({viewport:{width:844,height:390},serviceWorkers:'block'});page=await context.newPage();
  const errors=[],warnings=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning'&&warnings.length<30)warnings.push(m.text().slice(0,500));});
  await page.addInitScript(({key,raw})=>{localStorage.setItem(key,raw);localStorage.setItem('swarm-front-player-name-v1','ローカル検証');},{key:fixture.key,raw:fixture.fixtures[kind]});
  await page.route(/\/src\/client\/playtest-app\.ts(?:\?.*)?$/,async route=>{
   const response=await route.fetch(),body=await response.text();
   await route.fulfill({response,body:body+`
// Edge/face crossing only; containment and coplanar overlap are outside this probe.
const probeRay=new T.Ray(), probePoint=new T.Vector3();
function probeCross(a,b){
 const segment=(x,y,t)=>{const d=y.clone().sub(x),l=d.length();if(l<1e-9)return null;
  probeRay.set(x,d.multiplyScalar(1/l));const p=probeRay.intersectTriangle(t[0],t[1],t[2],false,probePoint);
  return p&&p.distanceTo(x)<=l+1e-7?p.clone():null;};
 for(let i=0;i<3;i++){const p=segment(a[i],a[(i+1)%3],b);if(p)return p;}
 for(let i=0;i<3;i++){const p=segment(b[i],b[(i+1)%3],a);if(p)return p;}return null;
}
const va=new T.Vector3(0,0,0),vb=new T.Vector3(1,0,0),vc=new T.Vector3(0,1,0);
if(!probeCross([va,vb,vc],[new T.Vector3(.2,.2,-.2),new T.Vector3(.2,.2,.2),new T.Vector3(.6,.2,.2)]) ||
 probeCross([va,vb,vc],[new T.Vector3(.2,.2,.2),new T.Vector3(.5,.2,.2),new T.Vector3(.2,.5,.2)]))throw Error('analytic crossing controls failed');
function probeFaces(geometry,matrix,object,skin){
 const p=geometry.getAttribute('position'),idx=geometry.index,vertices=[],v=new T.Vector3(),result=[];
 for(let i=0;i<p.count;i++){if(skin)object.getVertexPosition(i,v);else v.fromBufferAttribute(p,i);vertices.push(v.clone().applyMatrix4(matrix));}
 for(let i=0;i+2<(idx?idx.count:p.count);i+=3){
  const q=[0,1,2].map(j=>vertices[idx?idx.getX(i+j):i+j]);
  const lo=new T.Vector3(Math.min(...q.map(x=>x.x)),Math.min(...q.map(x=>x.y)),Math.min(...q.map(x=>x.z)));
  const hi=new T.Vector3(Math.max(...q.map(x=>x.x)),Math.max(...q.map(x=>x.y)),Math.max(...q.map(x=>x.z)));
  result.push({q,lo,hi,name:object?.name||'projectile'});
 }return result;
}
function probeSceneFaces(root,skin){const out=[];root.updateWorldMatrix(true,true);root.traverse(o=>{
 if(skin?(!o.isSkinnedMesh||!o.visible):(!o.isMesh||o.name==='WeaponNeonCore'||o.name==='WeaponNeonHalo'))return;
 if(o.geometry?.getAttribute('position'))out.push(...probeFaces(o.geometry,o.matrixWorld,o,skin));});return out;}
function probeIntersections(target,projectile,shift=new T.Vector3()){
 let tested=0,hits=0,groups={},examples=[];
 for(const t of target)for(const o of projectile){
  if(t.hi.x<o.lo.x+shift.x||t.lo.x>o.hi.x+shift.x||t.hi.y<o.lo.y+shift.y||t.lo.y>o.hi.y+shift.y||t.hi.z<o.lo.z+shift.z||t.lo.z>o.hi.z+shift.z)continue;
  tested++;const b=o.q.map(v=>v.clone().add(shift)),p=probeCross(t.q,b);if(p){hits++;groups[t.name]=(groups[t.name]||0)+1;if(examples.length<12)examples.push(p.toArray());}}
 return {targetTriangles:target.length,projectileTriangles:projectile.length,testedPairs:tested,crossingPairs:hits,groups,examples};
}
let rocketProbeWorld=null;
function watchRocketWorld(){
 if(!world||world===rocketProbeWorld)return;
 rocketProbeWorld=world;const watched=world;let projectiles=watched.projectiles;
 const watchArray=(a)=>{if(a.__rocketProbeWatched)return;const push=a.push;
  Object.defineProperty(a,'__rocketProbeWatched',{value:true});
  Object.defineProperty(a,'push',{configurable:true,writable:true,value:function(...items){
   for(const q of items)if(!window.rocketInitial&&q.owner==='solo'&&q.family==='rocket')
    window.rocketInitial={projectile:structuredClone(q),worldTime:watched.time};
   return push.apply(this,items);
  }});
 };
 watchArray(projectiles);
 Object.defineProperty(watched,'projectiles',{configurable:true,enumerable:true,get(){return projectiles},set(a){projectiles=a;watchArray(a)}});
}
const oldInstance=view.instance.bind(view), observed=new Map(); let currentProbeSnapshot=null;
view.instance=(mesh,i,x,y,z,sx,sy,sz,rx,ry)=>{
 if(mesh===view.projectiles&&currentProbeSnapshot){
  const q=currentProbeSnapshot.projectiles.filter(p=>p.style!=='laser')[i];
  if(q?.family==='rocket'&&q.rocket&&q.owner){
   const key=q.owner+':'+q.id;let state=observed.get(key);
   const position=new T.Vector3(x,y,z),velocity=new T.Vector3(q.dx,q.dy,q.dz),speed=velocity.length();
   if(!state){
    const trooper=view.players.get(q.owner)?.userData.trooper,muzzle=trooper?.muzzle();
    if(muzzle&&speed>1e-6){const axis=velocity.clone().normalize(),v=position.clone().sub(muzzle),along=v.dot(axis),side=v.clone().addScaledVector(axis,-along).length();
     const half=.65*.8506508;
     // First-seen rocket near the owner's muzzle. Freeze the plane and never
     // activate a correction later if it was initially absent or ambiguous.
     if(along>0&&along<half-.01&&side<.25) state={plane:muzzle.clone(),axis,active:true};
    }
    if(!state)state={active:false};observed.set(key,state);
   }
   if(state.active){
    const along=position.clone().sub(state.plane).dot(state.axis),half=.65*.8506508;
    if(along>=half){state.active=false;}
    else if(along>0){const shrink=(along+half)/(2*half),forward=(half-along)/2;
     x+=state.axis.x*forward;y+=state.axis.y*forward;z+=state.axis.z*forward;sz*=shrink;
     window.rocketClipObservation={q:structuredClone(q),frozenPlane:state.plane.toArray(),scale:shrink,forward};
    }
   }
  }
 }
 return oldInstance(mesh,i,x,y,z,sx,sy,sz,rx,ry);
};
const originalDraw=view.render.bind(view);
view.render=(...args)=>{
 currentProbeSnapshot=args[0];watchRocketWorld();const result=originalDraw(...args);
 if(result&&window.rocketInitial){
  const snapshot=args[0],q=snapshot?.projectiles.find(p=>p.id===window.rocketInitial.projectile.id);
  if(q){const index=snapshot.projectiles.filter(p=>p.style!=='laser').findIndex(p=>p.id===q.id), m=new T.Matrix4();view.projectiles.getMatrixAt(index,m);
   const pos=new T.Vector3(),quat=new T.Quaternion(),scale=new T.Vector3();m.decompose(pos,quat,scale);
   const state=observed.get(q.owner+':'+q.id);
   (window.rocketClipFrames??=[]).push({time:snapshot.time,q:[q.x,q.y,q.z],position:pos.toArray(),scale:scale.toArray(),active:!!state?.active,plane:state?.plane?.toArray()??null});
  }
 }
 if(result&&window.rocketInitial&&!window.rocketFirstDraw){
  const snapshot=args[0],q=snapshot?.projectiles.find(p=>p.id===window.rocketInitial.projectile.id);
  const shot=snapshot?.events.find(e=>e.type==='shot'&&e.owner==='solo'&&e.weapon==='rocket');
  const trooper=view.players.get('solo')?.userData.trooper,muzzle=trooper?.muzzle(),barrel=trooper?.barrel();
  if(q&&muzzle&&barrel){
   const index=snapshot.projectiles.filter(p=>p.style!=='laser').findIndex(p=>p.id===q.id);
   const matrix=new T.Matrix4();view.projectiles.getMatrixAt(index,matrix);
   const meshPosition=new T.Vector3().setFromMatrixPosition(matrix).applyMatrix4(view.projectiles.matrixWorld);
   const project=(p)=>{const v=p.clone().project(view.camera);return [(v.x+1)*.5*view.renderer.domElement.width,(1-v.y)*.5*view.renderer.domElement.height,v.z]};
   const travel=new T.Vector3(q.x,q.y,q.z).sub(muzzle),axis=new T.Vector3(q.dx,q.dy,q.dz).normalize();
   const along=travel.dot(axis),side=travel.clone().addScaledVector(axis,-along).length();
   const points=view.projectiles.geometry.getAttribute('position'),whole=view.projectiles.matrixWorld.clone().multiply(matrix);
   const vertexAxis=[];for(let i=0;i<points.count;i++)vertexAxis.push(new T.Vector3().fromBufferAttribute(points,i).applyMatrix4(whole).sub(muzzle).dot(axis));
   const body=probeSceneFaces(trooper.model,true),gun=probeSceneFaces(trooper.weapons[0],false);
   const projectileFaces=probeFaces(view.projectiles.geometry,whole,view.projectiles,false);
   const bodyCross=probeIntersections(body,projectileFaces),gunCross=probeIntersections(gun,projectileFaces);
   bodyCross.exampleScreen=bodyCross.examples.map(p=>project(new T.Vector3(...p)));
   gunCross.exampleScreen=gunCross.examples.map(p=>project(new T.Vector3(...p)));
   const farControl=probeIntersections(body,projectileFaces,new T.Vector3(100,100,100));
   if(farControl.crossingPairs)throw Error('far negative control failed');
   const center=new T.Vector3().setFromMatrixPosition(whole),chest=trooper.model.getObjectByName('Chest')?.getWorldPosition(new T.Vector3());
   let shiftedControl=null;
   if(chest){const direction=chest.clone().sub(center);for(let i=1;i<=20;i++){
    const shift=direction.clone().multiplyScalar(i/20),test=probeIntersections(body,projectileFaces,shift);
    if(test.crossingPairs){shiftedControl={fraction:i/20,shiftMetres:shift.length(),crossingPairs:test.crossingPairs};break;}}}
   window.rocketFirstDraw={image:view.renderer.domElement.toDataURL(),initial:window.rocketInitial,worldTime:snapshot.time,shot:shot?structuredClone(shot):null,
    projectile:structuredClone(q),instanceIndex:index,instanceCount:view.projectiles.count,meshWorld:meshPosition.toArray(),muzzle:muzzle.toArray(),barrel:barrel.toArray(),
    muzzleScreen:project(muzzle),projectileScreen:project(meshPosition),alongMetres:along,sideMetres:side,meshVertexAlongMin:Math.min(...vertexAxis),meshVertexAlongMax:Math.max(...vertexAxis),heldSocket:trooper.weapons[0].parent?.name,assetNodePresent:!!trooper.weapons[0].getObjectByName(${JSON.stringify(kind==='rocket'?'Weapon_rocket_realism_v2':'Weapon_heavy_v1')}),clipObservation:window.rocketClipObservation??null,crossings:{body:bodyCross,weapon:gunCross,farControl,shiftedControl},screen};
  }
 }
 return result;
};`});
  });
  await page.goto(base+'/?solo=1',{waitUntil:'domcontentloaded',timeout:50000});
  await page.locator('#pt-start').waitFor({state:'visible',timeout:90000});await page.locator('#pt-start').click();
  await page.locator('#pt-enter').waitFor({state:'visible',timeout:90000});await page.locator('#pt-enter').click();
  await page.waitForFunction(()=>window.__playtest?.screen==='battle'&&window.__playtest?.trooper?.loaded,null,{timeout:90000});
  if(await page.locator('#pt-tutorial-skip').count())await page.locator('#pt-tutorial-skip').click();
  if(await page.locator('#pt-intro-skip').count())await page.locator('#pt-intro-skip').click();
  await page.waitForFunction(k=>window.__playtest?.world?.players?.[0]?.weapons?.[0]?.kind===k,kind,{timeout:30000});
  stage=kind+' shooting';const point=await page.evaluate(()=>{for(let y=110;y<innerHeight-40;y+=20)for(let x=100;x<innerWidth-100;x+=20){const e=document.elementFromPoint(x,y);if(e?.id==='world'||e?.id==='look')return{x,y};}return null;});
  if(!point)throw Error('shooting input target not found');
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.waitForFunction(()=>!!window.rocketFirstDraw,null,{timeout:30000});await page.mouse.up();
  await page.waitForFunction(()=>window.rocketClipFrames?.length>=5,null,{timeout:10000});
  await page.evaluate(()=>window.rocketFirstDraw.clipFrames=window.rocketClipFrames);
  const data=await page.evaluate(()=>window.rocketFirstDraw);await fs.writeFile(`${out}/${kind}-first.png`,Buffer.from(data.image.split(',')[1],'base64'));delete data.image;
  await page.screenshot({path:`${out}/${kind}-ui.png`});
  assert.equal(data.screen,'battle');assert.equal(data.heldSocket,'RightHandWeaponSocket');assert.equal(data.assetNodePresent,true);assert.ok(data.instanceIndex>=0&&data.instanceIndex<data.instanceCount);assert.equal(data.projectile.id,data.initial.projectile.id);assert.deepEqual(errors,[]);
  const q=data.projectile,delta=Math.hypot(q.x-data.meshWorld[0],q.y-data.meshWorld[1],q.z-data.meshWorld[2]);if(kind==='rocket')assert.ok(delta<1e-4,'RL-2 unexpectedly adjusted'); if(kind==='heavy')assert.ok(delta>0.01,'RL-9 adjustment absent');
  records.push({kind,...data,meshStateDifference:delta,errors,warnings});await fs.writeFile(`${out}/${kind}-report.json`,JSON.stringify(records.at(-1),null,2));console.log('OBSERVED',kind,'body',data.crossings.body.crossingPairs,'weapon',data.crossings.weapon.crossingPairs,'shiftedControl',JSON.stringify(data.crossings.shiftedControl));
  await context.close();context=undefined;
 }
 await fs.writeFile(out+'/report.json',JSON.stringify({scope:'EXPERIMENTAL visual-only prototype; actual local solo UI/game loop and real renderer, first frame only. Edge/face crossings between projectile and deformed visible skinned body / held-weapon mesh; excludes neon. Does not detect containment, coplanar contact, hidden-parent visibility, full flight, actual network or phone.',analyticControls:'known intersecting / separate triangle pairs and projectile translated 100m away; shifted-toward-chest test where detected',viewport:[844,390],records},null,2));
}catch(e){await fs.writeFile(out+'/failure.json',JSON.stringify({stage,error:String(e),completed:records.map(r=>r.kind)},null,2));if(page&&!page.isClosed())await page.screenshot({path:out+'/failure.png',timeout:5000}).catch(()=>{});throw e;}
finally{await context?.close();await browser?.close();await server.close();}
