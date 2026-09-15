import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir='dist-validation/map-context';
const layout=JSON.parse(fs.readFileSync(`${dir}/layout.json`));
const server=await createServer({server:{port:5498,strictPort:true,hmr:false}});await server.listen();
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],rows=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto('http://127.0.0.1:5498/e2e/map-detail-fixture.html');
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Renderer}=await import('/src/client/render.ts'),g=await import('/src/shared/game.ts'),m=await import('/src/shared/stages.ts'),t=await import('/src/shared/terrain.ts');
  const canvas=document.createElement('canvas'),damage=document.createElement('div');damage.id='damage';document.body.replaceChildren(canvas,damage);window.qa={T,view:new Renderer(canvas),g,m,t};
 });
 for(const quality of [1,.65])for(const entry of layout){
  await page.evaluate(({quality,entry})=>{
   const {view,g,m,t}=window.qa,index=entry.index;
   const w=g.createWorld('context',42,m.STAGES.find(s=>s.map===index).id),p=g.addPlayer(w,'p');w.phase='battle';
   const old=entry.before[0];p.x=old.x-(index===5?0:6);p.z=old.z+(index===5?7:5);p.y=t.supportHeight(p.x,p.z,m.MAPS[index].blocks);
   view.quality=quality;view.resize();view.mapAssets.setQuality(quality);Object.assign(window.qa,{w,p});view.render(w,'p',1,index===5?0:Math.PI/2-.25,-.12);
  },{quality,entry});
  await page.waitForFunction(index=>window.qa.view.mapAssets.status[index].state==='ready',entry.index,{timeout:90000});
  const report=await page.evaluate(entry=>{
   const {view,w,m,t,g,T}=window.qa,index=entry.index,map=m.MAPS[index];
   view.render(w,'p',1,index===5?0:Math.PI/2-.25,-.12);view.render(w,'p',1,index===5?0:Math.PI/2-.25,-.12);
   const unexpected=[];view.mapAssets.groups[index].traverse(o=>{if(/^(TRAVERSABLE_|DOCK_)/.test(o.name))unexpected.push(o.name);});
   const ghostContacts=entry.before.filter(b=>g.blocked(b.x,b.z,.1,t.groundHeight(b.x,b.z,map.blocks),map.blocks)).map(b=>({x:b.x,z:b.z}));
   const ray=new T.Raycaster(),floors=[];view.mapAssets.groups[index].traverse(o=>{if(o.isMesh&&/^(road_asphalt|meadow_ground|granular_snow|earth)$/.test(o.name))floors.push(o);});
   const floorErrors=[];for(const b of entry.before){const h=t.groundHeight(b.x,b.z,map.blocks);ray.set(new T.Vector3(b.x,h+2,b.z),new T.Vector3(0,-1,0));const hit=ray.intersectObjects(floors,false)[0];if(!hit)throw Error('Missing floor at former prop');floorErrors.push(Math.abs(hit.point.y-h));}
   return {index,props:t.terrainProps(map.blocks).length,unexpected,ghostContacts,floorSamples:floorErrors.length,maxFloorError:Math.max(...floorErrors),triangles:view.renderer.info.render.triangles,calls:view.renderer.info.render.calls,detailed:view.mapAssets.groups[index].children[0].userData.detailed};
  },entry);
  assert.equal(report.props,0);assert.deepEqual(report.unexpected,[]);assert.deepEqual(report.ghostContacts,[]);assert.ok(report.maxFloorError<.08);assert.equal(report.detailed,quality===1);
  rows.push({quality,...report});await page.screenshot({path:`${dir}/context-${quality}-${entry.index}.png`,timeout:90000});
  if(quality===1){
   await page.evaluate(()=>{const {view,T}=window.qa;const camera=new T.OrthographicCamera(-200,200,113,-113,1,600);camera.position.set(0,300,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);view.renderer.render(view.scene,camera);});
   await page.screenshot({path:`${dir}/overview-${entry.index}.png`,timeout:90000});
  }
 }
 fs.writeFileSync(`${dir}/browser.json`,JSON.stringify({rows,errors},null,2));assert.deepEqual(errors,[]);console.log('PASS all six maps in both modes; no props, decorations or ghost collisions; former 125 prop locations match floor');
}finally{await browser.close();await server.close();}
