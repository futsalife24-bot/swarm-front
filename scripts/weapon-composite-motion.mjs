import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
const out='dist-validation/weapon-composite-motion';await fs.mkdir(out,{recursive:true});
const src=await fs.readFile('scripts/weapon-back-surface-probe.mjs','utf8');
const staticResults=JSON.parse(await fs.readFile('dist-validation/weapon-composite-probe/static-report.json','utf8')).result;
const geometry=src.slice(src.indexOf('const v=(x,y,z)'),src.indexOf('window.result=(async()=>'));
const entry=`
import * as T from 'three';
import {StandardTrooper,loadStandardTrooper} from './src/client/standard-trooper.ts';
import {loadProgressionWeapons} from './src/client/progression-weapons.ts';
import {makeWeapon} from './src/shared/progression.ts';
import {createWorld,addPlayer} from './src/shared/game.ts';
${geometry}
const staticResults=${JSON.stringify(staticResults)};
const seed0=20261112;let seed=seed0;
function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
function grid(body){const m=new Map();for(let i=0;i<body.length;i++)cells(body[i].lo,body[i].hi,k=>{if(!m.has(k))m.set(k,[]);m.get(k).push(i)});return m}
function anyHit(body,map,gun){for(const g of gun){const candidates=new Set();cells(g.lo,g.hi,k=>{for(const i of map.get(k)||[])candidates.add(i)});for(const i of candidates){const b=body[i];if(g.hi.x<b.lo.x||g.lo.x>b.hi.x||g.hi.y<b.lo.y||g.lo.y>b.hi.y||g.hi.z<b.lo.z||g.lo.z>b.hi.z)continue;if(crossing(g.q,b.q))return true}}return false}
function minWeapon(gun){let min=Infinity,v=new T.Vector3();gun.updateWorldMatrix(true,true);gun.traverse(o=>{if(!o.isMesh||o.name==='WeaponNeonCore'||o.name==='WeaponNeonHalo')return;const a=o.geometry.getAttribute('position');for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);min=Math.min(min,v.y)}});return min}
function minBody(root){let min=Infinity,v=new T.Vector3();root.traverse(o=>{if(!o.isSkinnedMesh||!o.visible)return;const a=o.geometry.getAttribute('position');for(let i=0;i<a.count;i++){o.getVertexPosition(i,v);v.applyMatrix4(o.matrixWorld);min=Math.min(min,v.y)}});return min}
const make=(id,kind)=>makeWeapon(id,kind,0,{power:0,reload:0,range:0,rate:0},true,0);
function apply(gun,c,w=1){gun.position.set(c.pos[0]*w,c.pos[1]*w,c.pos[2]*w);const base=new T.Quaternion().setFromEuler(new T.Euler(Math.PI/2,0,0)),extra=new T.Quaternion().setFromEuler(new T.Euler(...c.angles));base.multiply(new T.Quaternion().slerp(extra,w));gun.quaternion.copy(base);gun.updateWorldMatrix(true,true)}
window.result=(async()=>{
 const assets=await loadStandardTrooper(),scene=new T.Scene();scene.add(new T.HemisphereLight(0xffffff,0x53636c,3));const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(3,4,3);scene.add(sun);
 const floor=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({color:0x506752,roughness:1,side:T.DoubleSide}));floor.rotation.x=-Math.PI/2;scene.add(floor);const gridFloor=new T.GridHelper(20,40,0x819c80,0x6d866e);gridFloor.position.y=.001;scene.add(gridFloor);
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(280,205);renderer.setClearColor(0x12232d);
 const camera=new T.PerspectiveCamera(35,280/205,.01,100);camera.position.set(1.9,1.2,2.8);camera.lookAt(0,.55,0);
 document.body.style.cssText='margin:0;background:#12232d;color:white;font:14px sans-serif';document.body.innerHTML='<h2>ダウン・復帰時の動き比較</h2><p>各時点の左：現行、右：複数軸試作。平面上、60Hz固定の隔離描画。</p></p><main></main>';


 const result=[];const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};const captures=[71,145,152,185];
 for(const rec of staticResults){if(!rec.best)continue;const kind=rec.kind,index=rec.index,c=rec.best;
  const actor=new StandardTrooper(assets),p=addPlayer(createWorld('composite-timeline'),'p');p.weapons[index]=make('target',kind);p.weapons[1-index]=make('other','rifle');p.slot=index===0?1:0;p.reload=0;p.evade=0;p.hp=160;p.swapCd=0;scene.add(actor.model);await loadProgressionWeapons(p.weapons);for(let i=0;i<20;i++)actor.update(p,0,i/60,'runtime',1/60);
  const gun=actor.weapons[index],frames=[],row=document.createElement('section');row.style.cssText='display:flex;gap:2px;margin:10px 0';let prevPos=null,prevQ=null,prevBasePos=null,prevBaseQ=null;
  for(let n=0;n<=210;n++){
   const t=n/60;p.hp=n<150?0:160;actor.update(p,0,t,'runtime',1/60);actor.model.updateMatrixWorld(true);
   if(!gun.parent?.name.startsWith('BackWeaponSocket'))throw Error('target changed back socket');
   const w=n<150?smooth(t/.8):1-smooth((t-2.5)/.55);
   apply(gun,c,0);actor.model.updateMatrixWorld(true);const basePos=gun.getWorldPosition(new T.Vector3()),baseQ=gun.getWorldQuaternion(new T.Quaternion());
   const add=(label)=>{renderer.render(scene,camera);const el=document.createElement('div');el.innerHTML='<b>'+kind+' '+(index+1)+' '+t.toFixed(2)+'s '+label+'</b><br><img src="'+renderer.domElement.toDataURL()+'">';row.append(el)};
   if(captures.includes(n))add('現行');apply(gun,c,w);actor.model.updateMatrixWorld(true);const pos=gun.getWorldPosition(new T.Vector3()),q=gun.getWorldQuaternion(new T.Quaternion());
   frames.push({n,t,w,baselineStep:prevBasePos?basePos.distanceTo(prevBasePos):0,baselineAngleStep:prevBaseQ?baseQ.angleTo(prevBaseQ):0,candidateStep:prevPos?pos.distanceTo(prevPos):0,candidateAngleStep:prevQ?q.angleTo(prevQ):0});prevPos=pos;prevQ=q;prevBasePos=basePos;prevBaseQ=baseQ;
   if(captures.includes(n))add('試作');
  }
  document.querySelector('main').append(row);result.push({kind,index,frames});scene.remove(actor.model);actor.dispose();
 }
 renderer.dispose();return {seed0,result};
})();`;
await build({stdin:{contents:entry,resolveDir:process.cwd(),sourcefile:'composite-entry.js'},bundle:true,format:'esm',platform:'browser',define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'},outfile:out+'/bundle.js'});
const server=http.createServer(async(req,res)=>{const n=new URL(req.url,'http://localhost').pathname;if(n==='/')return void res.writeHead(200,{'Content-Type':'text/html'}).end('<meta charset="utf-8"><script type="module" src="/bundle.js"></script>');const root=path.resolve(n.startsWith('/assets/')?'public':out),name=n.startsWith('/assets/')?n.slice(1):path.basename(n),file=path.resolve(root,name);if(!file.startsWith(root+path.sep))return void res.writeHead(403).end();try{const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':'application/octet-stream'}).end(data)}catch{res.writeHead(404).end()}});
let browser;try{await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});const page=await browser.newPage({viewport:{width:2300,height:1100},serviceWorkers:'block'}),errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push([r.url(),r.status()])});await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForFunction(()=>!!window.result,null,{timeout:30000});const result=await page.evaluate(()=>window.result);await page.screenshot({path:out+'/motion-comparison.png',fullPage:true});await fs.writeFile(out+'/motion-report.json',JSON.stringify({scope:'Isolated direct product update for SG-4/SR-1 x two sockets, 60Hz; baseline and candidate back-weapon world origin and rotation only. Collision checked separately in timeline-report, not this test. Not continuous time between frames, game input, terrain, network, device, or proof of naturalness.',errors,failed,...result},null,2));console.log(JSON.stringify({errors,failed,result:result.result.map(r=>({kind:r.kind,index:r.index,frames:r.frames.length,baselineMax:Math.max(...r.frames.map(x=>x.baselineStep)),candidateMax:Math.max(...r.frames.map(x=>x.candidateStep)),baselineAngleMax:Math.max(...r.frames.map(x=>x.baselineAngleStep)),candidateAngleMax:Math.max(...r.frames.map(x=>x.candidateAngleStep))}))}));}finally{await browser?.close();await new Promise(r=>server.close(r))}
