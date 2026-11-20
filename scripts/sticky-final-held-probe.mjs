// Isolated body/weapon triangle crossings. Not a full solid-containment test.
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
const dynamic=process.argv.includes('--dynamic');
const out='dist-validation/sticky-final-held-surface';await fs.mkdir(out,{recursive:true});
const known=process.argv[2]?[process.argv[2]]:['sticky']; if(!['rifle','smg','shotgun','slug','rocket','heavy','sniper','laser','grenade','sticky','kick','medic'].includes(known[0]))throw Error('unknown kind');
const missing=[];
if(!dynamic)for(const kind of known){
 const dir=['rifle','shotgun','rocket'].includes(kind)?'realism-v2':'unique-v1';
 try{await fs.access(`public/assets/weapons/${dir}/${kind}_0.glb`);}catch(e){if(e.code==='ENOENT')missing.push(kind);else throw e;}
}
if(missing.length&&!process.argv.includes('--available'))throw Error('未生成: '+missing.join(','));
const present=dynamic?['shotgun','sniper']:known.filter(k=>!missing.includes(k));
if(!present.length)throw Error('検査できる武器がありません');
const profile=JSON.parse(await fs.readFile('design/weapon-models-20261111/out/sticky/report.json','utf8')).neon_profile;
const source=`
import * as T from 'three';
import {NEW_WEAPON_NEON_PROFILES} from '../../src/client/weapon-neon-profiles.ts';
NEW_WEAPON_NEON_PROFILES.sticky.splice(0,NEW_WEAPON_NEON_PROFILES.sticky.length,...${JSON.stringify(profile)});
import {StandardTrooper,loadStandardTrooper} from '../../src/client/standard-trooper.ts';
import {loadProgressionWeapons} from '../../src/client/progression-weapons.ts';
import {makeWeapon} from '../../src/shared/progression.ts';
import {EVADE_DURATION} from '../../src/shared/defs.ts';
import {createWorld,addPlayer} from '../../src/shared/game.ts';
const dynamic=${JSON.stringify(dynamic)};
const make=(id,kind)=>makeWeapon(id,kind,0,{power:0,reload:0,range:0,rate:0},true,0);
const v=(x,y,z)=>new T.Vector3(x,y,z);
const ray=new T.Ray(),point=new T.Vector3();
function segment(a,b,tri){
 const d=b.clone().sub(a),len=d.length();if(len<1e-9)return null;
 ray.set(a,d.multiplyScalar(1/len));const hit=ray.intersectTriangle(tri[0],tri[1],tri[2],false,point);
 return hit&&hit.distanceTo(a)<=len+1e-7?hit.clone():null;
}
function crossing(a,b){
 for(let i=0;i<3;i++){const p=segment(a[i],a[(i+1)%3],b);if(p)return p;}
 for(let i=0;i<3;i++){const p=segment(b[i],b[(i+1)%3],a);if(p)return p;}
 return null;
}
const testA=[v(0,0,0),v(1,0,0),v(0,1,0)];
if(!crossing(testA,[v(.2,.2,-.2),v(.2,.2,.2),v(.6,.2,.2)])||crossing(testA,[v(.2,.2,.2),v(.5,.2,.2),v(.2,.5,.2)]))throw Error('crossing analytic controls failed');
function collect(root,skin){
 const result=[],tmp=new T.Vector3();
 root.traverse(o=>{
  if(skin?(!o.isSkinnedMesh||!o.visible):(!o.isMesh||o.name==='WeaponNeonCore'||o.name==='WeaponNeonHalo'))return;
  const g=o.geometry,p=g.getAttribute('position'),idx=g.index;if(!p)return;
  const vertices=[];for(let i=0;i<p.count;i++){
   if(skin)o.getVertexPosition(i,tmp);else tmp.fromBufferAttribute(p,i);
   vertices.push(tmp.clone().applyMatrix4(o.matrixWorld));
  }
  const n=idx?idx.count:p.count;
  for(let i=0;i+2<n;i+=3){
   const q=[0,1,2].map(j=>vertices[idx?idx.getX(i+j):i+j]);
   const lo=v(Math.min(...q.map(p=>p.x)),Math.min(...q.map(p=>p.y)),Math.min(...q.map(p=>p.z)));
   const hi=v(Math.max(...q.map(p=>p.x)),Math.max(...q.map(p=>p.y)),Math.max(...q.map(p=>p.z)));
   result.push({q,lo,hi,name:o.name});
  }
 });return result;
}
const size=.07,cell=n=>Math.floor(n/size),key=(x,y,z)=>x+','+y+','+z;
function cells(lo,hi,fn){for(let x=cell(lo.x);x<=cell(hi.x);x++)for(let y=cell(lo.y);y<=cell(hi.y);y++)for(let z=cell(lo.z);z<=cell(hi.z);z++)fn(key(x,y,z));}
function intersections(body,gun){
 const map=new Map();for(let i=0;i<body.length;i++)cells(body[i].lo,body[i].hi,k=>{if(!map.has(k))map.set(k,[]);map.get(k).push(i)});
 const hits=[],groups={};let tested=0;
 for(const g of gun){const candidates=new Set();cells(g.lo,g.hi,k=>{for(const i of map.get(k)||[])candidates.add(i)});
  for(const i of candidates){const b=body[i];if(g.hi.x<b.lo.x||g.lo.x>b.hi.x||g.hi.y<b.lo.y||g.lo.y>b.hi.y||g.hi.z<b.lo.z||g.lo.z>b.hi.z)continue;
   tested++;const p=crossing(g.q,b.q);if(p){hits.push(p);groups[b.name]=(groups[b.name]||0)+1;}}
 }
 const bins=new Map();for(const p of hits){const k=[p.x,p.y,p.z].map(n=>Math.round(n/.004)).join(',');if(!bins.has(k))bins.set(k,p)}
 return {pairs:hits.length,tested,groups,points:[...bins.values()]};
}
window.result=(async()=>{
 const assets=await loadStandardTrooper(),records=[],scene=new T.Scene();scene.add(new T.HemisphereLight(0xffffff,0x526070,3));const light=new T.DirectionalLight(0xffffff,3);light.position.set(3,4,3);scene.add(light);
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(420,300);renderer.setClearColor(0x12232d);
 const camera=new T.PerspectiveCamera(35,1.4,.01,100);camera.zoom=1.8;camera.updateProjectionMatrix();
 document.body.style.cssText='margin:0;background:#12232d;color:white;font:13px sans-serif';document.body.innerHTML='<h2>手持ち武器と兵士の表面交差（'+(dynamic?'回避・ダウン':'静止')+'・局所検証）</h2><p>赤い点は交差候補。肌・衣装・装備を区別せず、貫通量や自然さの合否は表しません。</p><main></main>';
 for(const kind of ${JSON.stringify(present)})for(const index of [0,1])for(const action of (dynamic?['roll','down']:['idle'])){
  const actor=new StandardTrooper(assets),p=addPlayer(createWorld('back-probe'),'p');const target=make('test',kind),spare=make('other','rifle');
  p.slot=index;p.weapons[index]=target;p.weapons[1-index]=spare;p.reload=0;p.evade=0;p.hp=160;p.swapCd=0;
  scene.add(actor.model);await loadProgressionWeapons(p.weapons);for(let i=0;i<20;i++)actor.update(p,0,i/60,'runtime',1/60);
  if(action!=='idle')for(let i=0;i<=(action==='roll'?9:72);i++){
   const t=i/60;p.hp=action==='down'?0:160;p.evade=action==='roll'?Math.max(0,EVADE_DURATION-t):0;
   actor.update(p,0,t,'runtime',1/60);
  }
  actor.model.updateMatrixWorld(true);
  const gun=actor.weapons[index];if(gun.parent?.name!=='RightHandWeaponSocket')throw Error('手持ち位置ではありません');
  const body=collect(actor.model,true),weapon=collect(gun,false),result=intersections(body,weapon),helmet=body.filter(t=>/helmet/i.test(t.name)),group=new T.Group();scene.add(group);
  if(!helmet.length)throw Error('ヘルメット形状を検出できません');
  const headResult=intersections(helmet,weapon),farGun=weapon.map(t=>({...t,q:t.q.map(p=>p.clone().add(new T.Vector3(10,0,0))),lo:t.lo.clone().add(new T.Vector3(10,0,0)),hi:t.hi.clone().add(new T.Vector3(10,0,0))})),headFar=intersections(helmet,farGun);
  if(headFar.pairs!==0)throw Error('遠方対照で頭部交差が発生');
  const beforeHead=gun.position.clone(),headCenter=new T.Box3().setFromPoints(helmet.flatMap(t=>t.q)).getCenter(new T.Vector3()),gunCenter=new T.Box3().setFromObject(gun).getCenter(new T.Vector3()),headDirection=headCenter.sub(gunCenter).normalize();
  let headPositive=null;
  for(const distance of [.05,.10,.15,.20,.25,.30,.40,.50,.65,.80]){
   const inverse=new T.Matrix4().copy(gun.parent.matrixWorld).invert();
   const delta=headDirection.clone().multiplyScalar(distance).applyMatrix3(new T.Matrix3().setFromMatrix4(inverse));
   gun.position.copy(beforeHead).add(delta);gun.updateWorldMatrix(true,true);
   const shifted=intersections(helmet,collect(gun,false));
   if(shifted.pairs>0){headPositive={shiftMetres:distance,crossingPairs:shifted.pairs};break;}
  }
  gun.position.copy(beforeHead);gun.updateWorldMatrix(true,true);
  if(!headPositive)throw Error('頭部へ移動する正例を検出できません');
  let positiveControl=null;
  if(kind==='shotgun'&&index===0&&action==='idle'){
   const before=gun.position.clone(),center=new T.Box3().setFromObject(gun).getCenter(new T.Vector3());
   const towards=actor.model.getObjectByName('Chest').getWorldPosition(new T.Vector3()).sub(center).normalize();
   for(const distance of [.05,.10,.15,.20,.25,.30]){
    const inverse=new T.Matrix4().copy(gun.parent.matrixWorld).invert();
    const delta=towards.clone().multiplyScalar(distance).applyMatrix3(new T.Matrix3().setFromMatrix4(inverse));
    gun.position.copy(before).add(delta);gun.updateWorldMatrix(true,true);
    const shifted=intersections(body,collect(gun,false));
    if(shifted.pairs>0){positiveControl={shiftMetres:distance,crossingPairs:shifted.pairs};break;}
   }
   gun.position.copy(before);gun.updateWorldMatrix(true,true);
   if(!positiveControl)throw Error('兵士へ武器を近づける実物負例を検出できません');
  }
  const material=new T.MeshBasicMaterial({color:0xff3b30,depthTest:false});
  for(const p of result.points.slice(0,120)){const marker=new T.Mesh(new T.SphereGeometry(.004,6,4),material);marker.position.copy(p);marker.renderOrder=999;group.add(marker)}
  const row=document.createElement('section');row.style.cssText='display:flex;gap:5px;margin:10px 0';document.querySelector('main').append(row);
  for(const [label,pos] of [['斜め後',[-2.6,1.9,3.3]],['反対後',[2.6,1.9,3.3]],['横',[3.6,1.8,0]]]){
   const focus=dynamic?actor.model.getObjectByName('Chest').getWorldPosition(new T.Vector3()):new T.Vector3(0,1.13,0);
   camera.position.set(pos[0]+focus.x,pos[1]-1.13+focus.y,pos[2]+focus.z);camera.lookAt(focus);renderer.render(scene,camera);
   const box=document.createElement('div');box.innerHTML='<b>'+kind+' 手持ち'+(index+1)+' '+action+' '+label+' / 交差候補 '+result.points.length+'</b><br><img src="'+renderer.domElement.toDataURL()+'">';row.append(box);
  }
  records.push({kind,index,action,mode:actor.mode,socket:gun.parent.name,bodyTriangles:body.length,weaponTriangles:weapon.length,testedPairs:result.tested,crossingPairs:result.pairs,pointBins4mm:result.points.length,bodyMeshPairs:result.groups,helmetTriangles:helmet.length,helmetPairs:headResult.pairs,helmetGroups:headResult.groups,headFarControlPairs:headFar.pairs,headPositiveControl:headPositive,positiveControl,points:result.points.map(p=>p.toArray())});
  group.removeFromParent();group.traverse(o=>o.geometry?.dispose());material.dispose();scene.remove(actor.model);actor.dispose();
 }
 renderer.dispose();renderer.forceContextLoss();return records;
})();`;
await build({stdin:{contents:source,resolveDir:path.resolve(out),sourcefile:'entry.js'},bundle:true,format:'esm',platform:'browser',define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'},outfile:out+'/bundle.js'});
let candidateRequests=0;const server=http.createServer(async(req,res)=>{const n=new URL(req.url,'http://localhost').pathname;if(n==='/assets/weapons/unique-v1/sticky_0.glb'){candidateRequests++;const b=await fs.readFile('public/assets/weapons/unique-v1/sticky_0.glb');res.writeHead(200,{'Content-Type':'model/gltf-binary'}).end(b);return;}const root=path.resolve(n.startsWith('/assets/')?'public':out),name=n.startsWith('/assets/')?n.slice(1):path.basename(n),file=path.resolve(root,name);if(!file.startsWith(root+path.sep))return void res.writeHead(403).end();try{const b=await fs.readFile(file);res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':'application/octet-stream'}).end(b);}catch{res.writeHead(404).end();}});
let browser;try{await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/fixture',r=>r.fulfill({contentType:'text/html',body:'<script type="module" src="/bundle.js"></script>'}));await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');await page.waitForFunction(()=>!!window.result);const records=await page.evaluate(()=>window.result);await page.screenshot({path:out+'/comparison.png',fullPage:true});await fs.writeFile(out+'/report.json',JSON.stringify({scope:(dynamic?'SG-4 and SR-1 roll 0.15 s and down 1.20 s, direct fixed-step update':'Static idle direct StandardTrooper update')+'; crossing tests between deformed visible skinned-mesh triangles and held weapon mesh triangles, excluding neon. Triangle edge/face crossing only: no coplanar handling, containment-only detection, penetration depth or strap/body categorization. No full continuous motion, actual game loop, network or device. Production GLB and matching generated neon profile loaded in an isolated local server/browser.',missing,candidateRequests,analyticControls:'analytic triangle controls; candidate helmet far-shift negative and helmet-directed positive controls',records,errors},null,2));console.log(JSON.stringify({records:records.map(({points,...r})=>r),missing,errors},null,2));if(errors.length||candidateRequests!==1||records.length!==present.length*2*(dynamic?2:1))process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.close(r));}
