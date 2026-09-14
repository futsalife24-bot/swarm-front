import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import fs from 'node:fs';
const server=await createServer({optimizeDeps:{noDiscovery:true},server:{hmr:false,port:5396,strictPort:true}});await server.listen();
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
await page.goto('http://127.0.0.1:5396/e2e/structure-fixture.html');
await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js');const {Renderer}=await import('/src/client/render.ts');const g=await import('/src/shared/game.ts');const m=await import('/src/shared/stages.ts');const t=await import('/src/shared/terrain.ts');
 const canvas=document.createElement('canvas'),damage=document.createElement('div');damage.id='damage';document.body.replaceChildren(canvas,damage);document.body.style.margin='0';
 window.qa={view:new Renderer(canvas),g,m,t,T};
});
const rows=[];
for(let index=0;index<6;index++){
 await page.evaluate(index=>{const {view,g,m,t}=window.qa;const stage=m.STAGES.find(s=>s.map===index).id;const w=g.createWorld('terrain',42,stage),p=g.addPlayer(w,'p');w.phase='battle';
 const locations=[[-8,20],[10,-8],[0,20],[-18,12],[-5,15],[0,75]];[p.x,p.z]=locations[index];p.y=t.supportHeight(p.x,p.z,m.MAPS[index].blocks);
 window.qa.w=w;window.qa.p=p;view.render(w,'p',1,0,-.1);},index);
 await page.waitForFunction(index=>window.qa.view.mapAssets.status[index].state==='ready',index,{timeout:90000});
 await page.evaluate(()=>{const {view,w}=window.qa;for(let i=0;i<2;i++)view.render(w,'p',1/60,0,-.12);});
 await page.screenshot({timeout:90000,path:`dist-validation/terrain-refresh/map-${index}.png`});
 rows.push(await page.evaluate(index=>{
 const {view,m,t,T}=window.qa,map=m.MAPS[index],meshes=[];
 view.mapAssets.groups[index].traverse(o=>{if(o.isMesh && /^(road_asphalt|meadow_ground|granular_snow|earth)$/.test(o.name))meshes.push(o);});
 const ray=new T.Raycaster(),errors=[];let samples=0;
 for(let x=-85;x<86;x+=10)for(let z=-95;z<96;z+=10){const h=t.groundHeight(x,z,map.blocks);if(h<.25||map.blocks.some(b=>Math.abs(x-b.x)<b.w/2+1&&Math.abs(z-b.z)<b.d/2+1))continue;ray.set(new T.Vector3(x,h+1,z),new T.Vector3(0,-1,0));const hit=ray.intersectObjects(meshes,false)[0];if(hit){errors.push(Math.abs(hit.point.y-h));samples++;}}
 return {index,status:view.mapAssets.status[index],feet:window.qa.p.y,props:t.terrainProps(map.blocks).length,triangles:view.renderer.info.render.triangles,surfaceSamples:samples,maxSurfaceError:Math.max(0,...errors)};
 },index));
}
fs.writeFileSync('dist-validation/terrain-refresh/browser.json',JSON.stringify({rows,errors},null,2));console.log(JSON.stringify({rows,errors}));if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();await server.close();}


