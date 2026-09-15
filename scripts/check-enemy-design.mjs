import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error' && /THREE|WebGL|shader/i.test(m.text()))errors.push(m.text())});page.on('requestfailed',r=>network.push({url:r.url(),error:r.failure()?.errorText}));
await page.goto('http://127.0.0.1:5318');
const result=await page.evaluate(async()=>{
const T=await import('/node_modules/.vite/deps/three.js');
const {enemyGeometry}=await import('/src/client/enemy-model.ts');
const {Renderer}=await import('/src/client/render.ts');
const {createWorld,addPlayer,start,spawn}=await import('/src/shared/game.ts');
document.body.innerHTML='';const canvas=document.createElement('canvas');document.body.append(canvas);
const view=new Renderer(canvas),w=createWorld('design',5,5);addPlayer(w,'p');start(w);w.enemies=[];
const kinds=['crawler','spitter','ant','spider','hornet','boss'];
for(const [i,kind] of kinds.entries())spawn(w,kind,(i-3)*8,0);
view.render(w,'p',.016,0,0);
if(view.bossBody.count!==7||view.enemies.get('boss').count!==1)throw Error('Expected one head and seven body segments');
if(view.enemies.get('hornet').geometry.getAttribute('flight').getX(0)!==1)throw Error('Wings inactive');
view.scene.clear();view.scene.background=new T.Color(0x18232d);view.scene.add(new T.HemisphereLight(0xeaf6ff,0x62707c,2.4));
const light=new T.DirectionalLight(0xffffff,3);light.position.set(-4,10,-6);view.scene.add(light);
const models=[];
for(let i=0;i<6;i++){
const mesh=new T.Mesh(enemyGeometry(kinds[i]),new T.MeshStandardMaterial({vertexColors:true,roughness:.8}));
mesh.position.set((i%3-1)*9,0,Math.floor(i/3)*9-4.5);if(i===5)mesh.scale.setScalar(.60);mesh.rotation.y=-.3;view.scene.add(mesh);models.push(mesh);
}
view.camera.fov=35;view.camera.updateProjectionMatrix();view.camera.position.set(0,23,-27);view.camera.lookAt(0,.5,0);view.renderer.render(view.scene,view.camera);window.fixture={view,models,w};return {kinds,headCount:1,bodyCount:7};
});
await page.screenshot({path:'dist-validation/enemy-design/species.png'});
await page.evaluate(()=>{const {view,models}=window.fixture;for(const m of models){m.material.vertexColors=false;m.material.color.set(0xaab9c4);m.material.needsUpdate=true;}view.renderer.render(view.scene,view.camera)});
await page.screenshot({path:'dist-validation/enemy-design/monochrome.png'});await page.evaluate(async()=>{
 const {view,w}=window.fixture;
 const {enemyGeometry}=await import('/src/client/enemy-model.ts');
 const T=await import('/node_modules/.vite/deps/three.js');
 for(const model of window.fixture.models)view.scene.remove(model);
 const head=new T.Mesh(enemyGeometry('boss'),new T.MeshStandardMaterial({vertexColors:true}));view.scene.add(head);
 for(let i=0;i<7;i++){
 const body=new T.Mesh(enemyGeometry('boss',true),head.material);body.position.set(Math.sin(i*.4)*3,0,(i+1)*3.5);body.scale.set(.92,.95,.92);view.scene.add(body);
 }
 view.camera.position.set(22,25,-25);view.camera.lookAt(1,1,10);view.renderer.render(view.scene,view.camera);
});
await page.screenshot({path:'dist-validation/enemy-design/worm.png'});
assert.deepEqual(errors,[]);
writeFileSync('dist-validation/enemy-design/qa.json',JSON.stringify({...result,errors,network},null,2));console.log(result);
}finally{await browser.close()}

