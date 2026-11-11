import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const out='dist-validation/floor-side-prototype';
await fs.mkdir(out,{recursive:true});
const prior=await fs.readFile('scripts/weapon-back-surface-probe.mjs','utf8');
const geometry=prior.slice(prior.indexOf('const v=(x,y,z)'),prior.indexOf('window.result=(async()=>'));
const source=`
import * as T from 'three';
import {StandardTrooper,loadStandardTrooper} from '../../src/client/standard-trooper.ts';
import {loadProgressionWeapons} from '../../src/client/progression-weapons.ts';
import {makeWeapon} from '../../src/shared/progression.ts';
import {createWorld,addPlayer} from '../../src/shared/game.ts';
${geometry}
const make=(id,kind)=>makeWeapon(id,kind,0,{power:0,reload:0,range:0,rate:0},true,0);
function minWeapon(gun){let min=Infinity;const v=new T.Vector3();gun.updateWorldMatrix(true,true);gun.traverse(o=>{if(!o.isMesh||o.name==='WeaponNeonCore'||o.name==='WeaponNeonHalo')return;const a=o.geometry.getAttribute('position');for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);min=Math.min(min,v.y)}});return min;}
const smooth=x=>{x=Math.min(1,Math.max(0,x));return x*x*(3-2*x)};
window.result=(async()=>{
 const assets=await loadStandardTrooper(),records=[],scene=new T.Scene();
 scene.add(new T.HemisphereLight(0xffffff,0x53636c,3));const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(3,4,3);scene.add(sun);
 const floor=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({color:0x506752,roughness:1,side:T.DoubleSide}));floor.rotation.x=-Math.PI/2;scene.add(floor);
 const grid=new T.GridHelper(20,40,0x819c80,0x6d866e);grid.position.y=.001;scene.add(grid);
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(280,205);renderer.setClearColor(0x12232d);
 const camera=new T.PerspectiveCamera(35,280/205,.01,100);camera.position.set(2.8,1.6,3.8);camera.lookAt(0,.65,0);
 document.body.style.cssText='margin:0;background:#12232d;color:white;font:12px sans-serif';document.body.innerHTML='<h2>ダウン時に背負い武器を体側へ移す隔離試作</h2><p>緑は平面の床。下は床からの最下高・体表交差の組数・元の背負い位置からの移動。製品未反映。</p><main></main>';
 const sample=[0,.5,.8,1,1.5,2.4,2.6,2.8,3.1];
 for(const kind of ['shotgun','sniper'])for(const index of [0,1]){
  const actor=new StandardTrooper(assets),p=addPlayer(createWorld('side-proto'),'p');p.weapons[index]=make('target',kind);p.weapons[1-index]=make('other','rifle');p.slot=index===0?1:0;p.reload=0;p.evade=0;p.hp=160;p.swapCd=0;
  scene.add(actor.model);await loadProgressionWeapons(p.weapons);for(let i=0;i<20;i++)actor.update(p,0,i/60,'runtime',1/60);
  const gun=actor.weapons[index];if(!gun.parent?.name.startsWith('BackWeaponSocket'))throw Error('not back socket');
  const recordsHere=[],frames=[],row=document.createElement('section');row.style.cssText='display:flex;gap:2px;margin:10px 0';document.querySelector('main').append(row);
  for(let n=0;n<=Math.round(3.1*60);n++){
   const t=n/60;gun.position.set(0,0,0);gun.rotation.set(Math.PI/2,0,0);p.hp=t<2.5?0:160;actor.update(p,0,t,'runtime',1/60);actor.model.updateMatrixWorld(true);
   const baseline=minWeapon(gun),weight=t<2.5?smooth((t-.4)/.6):1-smooth((t-2.5)/.4);
   const dx=(index===0?-1:1)*.32*weight;
   const inv=new T.Matrix4().copy(gun.parent.matrixWorld).invert();
   const horizontal=new T.Vector3(dx,0,0).applyMatrix3(new T.Matrix3().setFromMatrix4(inv));gun.position.add(horizontal);gun.updateWorldMatrix(true,true);
   const lift=Math.max(0,.002-minWeapon(gun))*weight;
   const vertical=new T.Vector3(0,lift,0).applyMatrix3(new T.Matrix3().setFromMatrix4(inv));gun.position.add(vertical);gun.updateWorldMatrix(true,true);
   const min=minWeapon(gun),frame={t,baseline,min,weight,dx,lift,offset:Math.hypot(dx,lift)};frames.push(frame);
   if(sample.some(x=>Math.abs(t-x)<.001)){
    const body=collect(actor.model,true),weapon=collect(gun,false),hits=intersections(body,weapon);frame.crossingPairs=hits.pairs;
    renderer.render(scene,camera);const box=document.createElement('div');box.innerHTML='<b>'+kind+' '+(index+1)+' '+t.toFixed(2)+'s<br>床 '+(min*1000).toFixed(0)+'mm / 交差 '+hits.pairs+' / 移動 '+(frame.offset*1000).toFixed(0)+'mm</b><br><img src="'+renderer.domElement.toDataURL()+'">';row.append(box);
    recordsHere.push(frame);
   }
  }
  records.push({kind,index,socket:gun.parent.name,frames,samples:recordsHere});scene.remove(actor.model);actor.dispose();
 }
 renderer.dispose();renderer.forceContextLoss();return records;
})();`;
await build({stdin:{contents:source,resolveDir:path.resolve(out),sourcefile:'entry.js'},bundle:true,format:'esm',platform:'browser',define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'},outfile:out+'/bundle.js'});
const server=http.createServer(async(req,res)=>{const n=new URL(req.url,'http://localhost').pathname;const root=path.resolve(n.startsWith('/assets/')?'public':out),name=n.startsWith('/assets/')?n.slice(1):path.basename(n),file=path.resolve(root,name);if(!file.startsWith(root+path.sep))return void res.writeHead(403).end();try{const b=await fs.readFile(file);res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':'application/octet-stream'}).end(b);}catch{res.writeHead(404).end();}});
let browser;try{await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});const page=await browser.newPage({viewport:{width:2600,height:900},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('pageerror:',e.message)});page.on('requestfailed',r=>console.error('requestfailed:',r.url(),r.failure()?.errorText));page.on('response',r=>{if(r.status()>=400)console.error('badresponse:',r.status(),r.url())});page.on('console',m=>{if(m.type()==='error')console.error('console:',m.text())});await page.route('**/fixture',r=>r.fulfill({contentType:'text/html',body:'<script type="module" src="/bundle.js"></script>'}));await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');await page.waitForFunction(()=>!!window.result,{},{timeout:6000});const records=await page.evaluate(()=>window.result);await page.screenshot({path:out+'/timeline.png',fullPage:true});await fs.writeFile(out+'/report.json',JSON.stringify({scope:'隔離された平面、固定60fps、直接StandardTrooper.update。兵士の体表と武器の辺・面交差は9時点のみ。完全内包・共平面・ネオン・他スロットとの交差・実ゲーム・通信・実機は未確認。',records,errors},null,2));console.log(JSON.stringify({errors,records:records.map(x=>({kind:x.kind,index:x.index,min:Math.min(...x.frames.map(f=>f.min)),maxOffset:Math.max(...x.frames.map(f=>f.offset)),maxCrossings:Math.max(...x.samples.map(f=>f.crossingPairs)),samples:x.samples}))}));if(errors.length||records.length!==4)process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.close(r));}

