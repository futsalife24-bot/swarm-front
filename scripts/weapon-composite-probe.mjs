import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
const out='dist-validation/weapon-composite-probe';await fs.mkdir(out,{recursive:true});
const src=await fs.readFile('scripts/weapon-back-surface-probe.mjs','utf8');
const geometry=src.slice(src.indexOf('const v=(x,y,z)'),src.indexOf('window.result=(async()=>'));
const entry=`
import * as T from 'three';
import {StandardTrooper,loadStandardTrooper} from './src/client/standard-trooper.ts';
import {loadProgressionWeapons} from './src/client/progression-weapons.ts';
import {makeWeapon} from './src/shared/progression.ts';
import {createWorld,addPlayer} from './src/shared/game.ts';
${geometry}
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
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(360,250);renderer.setClearColor(0x12232d);
 const camera=new T.PerspectiveCamera(35,360/250,.01,100);camera.position.set(2.8,1.6,3.8);camera.lookAt(0,.65,0);
 document.body.style.cssText='margin:0;background:#12232d;color:white;font:14px sans-serif';document.body.innerHTML='<h2>複数軸の背負い位置・ダウン静止時の限定探索</h2><p>左：現行、右：候補（候補のない場合は灰色）。交差0でも完全内包・接触自然さは未判定。</p><main></main>';
 const result=[];
 for(const kind of ['shotgun','sniper'])for(const index of [0,1]){
  const actor=new StandardTrooper(assets),p=addPlayer(createWorld('composite-probe'),'p');p.weapons[index]=make('target',kind);p.weapons[1-index]=make('other','rifle');p.slot=index===0?1:0;p.reload=0;p.evade=0;p.hp=160;p.swapCd=0;scene.add(actor.model);await loadProgressionWeapons(p.weapons);for(let i=0;i<20;i++)actor.update(p,0,i/60,'runtime',1/60);p.hp=0;for(let i=0;i<145;i++)actor.update(p,0,i/60,'runtime',1/60);actor.model.updateMatrixWorld(true);
  const gun=actor.weapons[index],held=actor.weapons[1-index];if(!gun.parent?.name.startsWith('BackWeaponSocket'))throw Error('target not back socket');
  const body=collect(actor.model,true),bodyGrid=grid(body),heldTris=collect(held,false),heldGrid=grid(heldTris),baseGun=collect(gun,false),base={min:minWeapon(gun),bodyPairs:intersections(body,baseGun).pairs,heldPairs:intersections(heldTris,baseGun).pairs,bodyMin:minBody(actor.model),heldMin:minWeapon(held)};
  const row=document.createElement('section');row.style.cssText='display:flex;gap:6px';const cell=(name,img)=>{const el=document.createElement('div');el.innerHTML='<b>'+kind+' '+(index+1)+' '+name+'</b><br><img src="'+img+'">';row.append(el)};renderer.render(scene,camera);cell('現行',renderer.domElement.toDataURL());
  let best=null, tested=0,bodyRejected=0,heldRejected=0,overLimit=0;const maxTries=100;
  for(let i=0;i<maxTries;i++){
   const c={pos:[(random()-.5)*.32,(random()-.5)*.32,(random()-.5)*.32],angles:[(random()-.5)*Math.PI*.8,(random()-.5)*Math.PI*.8,(random()-.5)*Math.PI*.8]};
   apply(gun,c);const beforeLift=minWeapon(gun),lift=Math.max(0,.002-beforeLift),inv=gun.parent.matrixWorld.clone().invert(),dir=new T.Vector3(0,lift,0).applyMatrix3(new T.Matrix3().setFromMatrix4(inv));c.pos=c.pos.map((x,j)=>x+[dir.x,dir.y,dir.z][j]);c.lift=lift;const offset=Math.hypot(...c.pos);if(offset>.45){overLimit++;continue}
   apply(gun,c);const floorMin=minWeapon(gun);if(floorMin<.002-1e-8)throw Error('floor calculation mismatch');tested++;
   const tri=collect(gun,false);if(anyHit(body,bodyGrid,tri)){bodyRejected++;continue}if(anyHit(heldTris,heldGrid,tri)){heldRejected++;continue}
   const fullBody=intersections(body,tri).pairs,fullHeld=intersections(heldTris,tri).pairs;if(fullBody||fullHeld)throw Error('fast/full mismatch');
   const score=offset+0.1*Math.hypot(...c.angles);if(!best||score<best.score)best={...c,score,offset,floorMin,fullBody,fullHeld};
  }
  if(best){apply(gun,best);renderer.render(scene,camera);cell('静止候補',renderer.domElement.toDataURL())}else {apply(gun,{pos:[0,0,0],angles:[0,0,0]});renderer.render(scene,camera);cell('候補なし',renderer.domElement.toDataURL())}
  document.querySelector('main').append(row);result.push({kind,index,base,best,tested,bodyRejected,heldRejected,overLimit,maxTries});scene.remove(actor.model);actor.dispose();
 }
 renderer.dispose();return {seed0,result};
})();`;
await build({stdin:{contents:entry,resolveDir:process.cwd(),sourcefile:'composite-entry.js'},bundle:true,format:'esm',platform:'browser',define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'},outfile:out+'/bundle.js'});
const server=http.createServer(async(req,res)=>{const n=new URL(req.url,'http://localhost').pathname;if(n==='/')return void res.writeHead(200,{'Content-Type':'text/html'}).end('<meta charset="utf-8"><script type="module" src="/bundle.js"></script>');const root=path.resolve(n.startsWith('/assets/')?'public':out),name=n.startsWith('/assets/')?n.slice(1):path.basename(n),file=path.resolve(root,name);if(!file.startsWith(root+path.sep))return void res.writeHead(403).end();try{const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':'application/octet-stream'}).end(data)}catch{res.writeHead(404).end()}});
let browser;try{await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});const page=await browser.newPage({viewport:{width:750,height:1250},serviceWorkers:'block'}),errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push([r.url(),r.status()])});await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForFunction(()=>!!window.result,null,{timeout:30000});const result=await page.evaluate(()=>window.result);await page.screenshot({path:out+'/static-comparison.png',fullPage:true});await fs.writeFile(out+'/static-report.json',JSON.stringify({scope:'Isolated static down pose, deterministic 100 6DoF candidate combinations per condition, edge/face crossing only; not solid containment, co-planar, contact naturalness, time continuity, game input, ground terrain, network, or device.',errors,failed,...result},null,2));console.log(JSON.stringify({errors,failed,result:result.result}));}finally{await browser?.close();await new Promise(r=>server.close(r))}
