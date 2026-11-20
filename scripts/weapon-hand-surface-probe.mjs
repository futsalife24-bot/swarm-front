// Isolated local geometry diagnostic. Distances are not a contact/pass criterion.
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const out='dist-validation/weapon-hand-surface-probe';
await fs.mkdir(out,{recursive:true});
const kinds=['rifle','smg','shotgun','slug','rocket','heavy','sniper','laser','grenade','sticky','kick','medic'];
const missing=[];
for(const kind of kinds){
 const dir=['rifle','shotgun','rocket'].includes(kind)?'realism-v2':'unique-v1';
 try{await fs.access(`public/assets/weapons/${dir}/${kind}_0.glb`);}catch(e){if(e.code==='ENOENT')missing.push(kind);else throw e;}
}
if(missing.length&&!process.argv.includes('--available'))throw Error('未生成: '+missing.join(','));
const present=kinds.filter(kind=>!missing.includes(kind));
if(!present.length)throw Error('検査できる武器がありません');
const source=`
import * as T from 'three';
import {StandardTrooper,loadStandardTrooper} from '../../src/client/standard-trooper.ts';
import {loadProgressionWeapons} from '../../src/client/progression-weapons.ts';
import {makeWeapon} from '../../src/shared/progression.ts';
import {poseOf,reloadDuration} from '../../src/shared/defs.ts';
import {createWorld,addPlayer} from '../../src/shared/game.ts';
const kinds=${JSON.stringify(present)};
const make=(id,kind)=>makeWeapon(id,kind,0,{power:0,reload:0,range:0,rate:0},true,0);
window.result=(async()=>{
 const assets=await loadStandardTrooper(),scene=new T.Scene(),records=[];
 scene.add(new T.HemisphereLight(0xffffff,0x526070,3));const light=new T.DirectionalLight(0xffffff,3);light.position.set(3,4,3);scene.add(light);
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(420,300);renderer.setClearColor(0x12232d);
 const camera=new T.PerspectiveCamera(35,1.4,.01,100);camera.zoom=1.8;camera.updateProjectionMatrix();camera.position.set(-3.6,1.8,0);camera.lookAt(0,1.18,-.08);
 const sphere=(color)=>new T.Mesh(new T.SphereGeometry(.012,12,8),new T.MeshBasicMaterial({color,depthTest:false}));
 const handMarker=sphere(0xff4848),gunMarker=sphere(0x50e7ff),line=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:0xffe458,depthTest:false}));
 handMarker.renderOrder=gunMarker.renderOrder=line.renderOrder=100;scene.add(handMarker,gunMarker,line);
 document.body.style.cssText='margin:0;background:#12232d;color:white;font:12px sans-serif';
 document.body.innerHTML='<h2>左手に強く重み付けされた頂点と武器表面の最短距離</h2><p>赤:兵士頂点、青:武器三角面上の最近点、黄:距離。接触・貫通判定ではない。装填中に手が離れることは動作の一部。</p><main></main>';
 const tri=new T.Triangle(),near=new T.Vector3(),tmp=new T.Vector3();
 function weaponTriangles(root){
  const out=[];root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert();
  root.traverse(o=>{if(!o.isMesh||o.name==='WeaponNeonCore'||o.name==='WeaponNeonHalo')return;const p=o.geometry.getAttribute('position'),index=o.geometry.index;if(!p)return;
   const n=index?index.count:p.count;
   for(let i=0;i+2<n;i+=3){const v=[];for(let k=0;k<3;k++){const j=index?index.getX(i+k):i+k;v.push(new T.Vector3().fromBufferAttribute(p,j).applyMatrix4(o.matrixWorld));}
    const lo=new T.Vector3(Math.min(...v.map(q=>q.x)),Math.min(...v.map(q=>q.y)),Math.min(...v.map(q=>q.z)));
    const hi=new T.Vector3(Math.max(...v.map(q=>q.x)),Math.max(...v.map(q=>q.y)),Math.max(...v.map(q=>q.z)));
    const support=v.some(q=>{const local=q.clone().applyMatrix4(inverse);return -local.z>=.18&&-local.z<=.40&&local.y>=-.05&&local.y<=.03;});out.push({v,lo,hi,support});}
  });return out;
 }
 function handVertices(root){
  const pts=[];root.traverse(o=>{if(!o.isSkinnedMesh||!o.visible)return;const b=o.skeleton.bones.findIndex(x=>x.name==='Hand_L');if(b<0)return;
   const g=o.geometry,p=g.getAttribute('position'),idx=g.getAttribute('skinIndex'),weights=g.getAttribute('skinWeight');if(!p||!idx||!weights)return;
   for(let i=0;i<p.count;i++){let w=0;for(let j=0;j<4;j++)if(idx.getComponent(i,j)===b)w+=weights.getComponent(i,j);
    if(w>=.5){o.getVertexPosition(i,tmp);pts.push(tmp.clone().applyMatrix4(o.matrixWorld));}}
  });return pts;
 }
 function nearest(pts,faces){
  let best=Infinity,pa=null,pb=null;
  for(const p of pts)for(const f of faces){
   let dx=Math.max(f.lo.x-p.x,0,p.x-f.hi.x),dy=Math.max(f.lo.y-p.y,0,p.y-f.hi.y),dz=Math.max(f.lo.z-p.z,0,p.z-f.hi.z);
   if(dx*dx+dy*dy+dz*dz>=best)continue;
   tri.set(...f.v);tri.closestPointToPoint(p,near);const d=p.distanceToSquared(near);
   if(d<best){best=d;pa=p.clone();pb=near.clone();}
  }
  return {distance:Math.sqrt(best),pa,pb};
 }
 const control=nearest([new T.Vector3(.25,.25,.2)],[{v:[new T.Vector3(0,0,0),new T.Vector3(1,0,0),new T.Vector3(0,1,0)],lo:new T.Vector3(0,0,0),hi:new T.Vector3(1,1,0)}]);
 if(Math.abs(control.distance-.2)>1e-9)throw Error('point-to-triangle analytic control failed');
 for(const kind of kinds){
  const actor=new StandardTrooper(assets),p=addPlayer(createWorld('surface-'+kind),'probe'),target=make('target-'+kind,kind),spare=make('spare-'+kind,'rifle');
  scene.add(actor.model);await loadProgressionWeapons([target,spare]);p.weapons=[target,spare];p.slot=0;p.swapCd=0;
  const settle=()=>{for(let i=0;i<4;i++)actor.update(p,0,2+i*.1,'runtime',.1);};
  const duration=reloadDuration(target,0),samples=[];const section=document.createElement('section');section.style.cssText='display:flex;gap:4px;margin:10px 0';document.querySelector('main').append(section);
  for(const [label,fraction] of [['idle',null],['reload-0',0],['reload-50',.5],['reload-99',.99]]){
   p.ammo[0]=0;p.reload=fraction===null?0:duration*(1-fraction);settle();actor.model.updateMatrixWorld(true);
   if(actor.weapons[0].parent?.name!=='RightHandWeaponSocket')throw Error(kind+' held socket missing');
   const faces=weaponTriangles(actor.weapons[0]),points=handVertices(actor.model);if(!points.length||!faces.length)throw Error(kind+' no hand vertices or gun faces');
   const supportFaces=faces.filter(f=>f.support);if(!supportFaces.length)throw Error(kind+' no support faces');
   const result=nearest(points,faces),support=nearest(points,supportFaces);if(!Number.isFinite(result.distance)||!Number.isFinite(support.distance))throw Error(kind+' bad distance');
   handMarker.position.copy(result.pa);gunMarker.position.copy(result.pb);line.geometry.setFromPoints([result.pa,result.pb]);renderer.render(scene,camera);
   const box=document.createElement('div');box.innerHTML='<b>'+kind+' '+label+' 全体 '+(result.distance*1000).toFixed(1)+' / 支え候補面 '+(support.distance*1000).toFixed(1)+' mm</b><br><img src="'+renderer.domElement.toDataURL()+'">';section.append(box);
   samples.push({label,mode:actor.mode,vertices:points.length,triangles:faces.length,supportTriangles:supportFaces.length,distance:result.distance,supportDistance:support.distance,handPoint:result.pa.toArray(),weaponPoint:result.pb.toArray(),supportHandPoint:support.pa.toArray(),supportWeaponPoint:support.pb.toArray()});
  }
  records.push({kind,pose:poseOf(kind),duration,samples});actor.dispose();scene.remove(actor.model);
 }
 renderer.dispose();renderer.forceContextLoss();return records;
})();`;
await build({stdin:{contents:source,resolveDir:path.resolve(out),sourcefile:'entry.js'},bundle:true,format:'esm',platform:'browser',define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'},outfile:out+'/bundle.js'});
const server=http.createServer(async(req,res)=>{const n=new URL(req.url,'http://127.0.0.1').pathname;const root=path.resolve(n.startsWith('/assets/')?'public':out),name=n.startsWith('/assets/')?n.slice(1):path.basename(n),file=path.resolve(root,name);if(!file.startsWith(root+path.sep))return void res.writeHead(403).end();try{res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':'application/octet-stream'}).end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
let browser;
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});const page=await browser.newPage({viewport:{width:1700,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/fixture',r=>r.fulfill({contentType:'text/html',body:'<script type="module" src="/bundle.js"></script>'}));await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');await page.waitForFunction(()=>!!window.result);
 const records=await page.evaluate(()=>window.result);await page.screenshot({path:out+'/comparison.png',fullPage:true});
 await fs.writeFile(out+'/report.json',JSON.stringify({scope:'Direct trooper update at four fixed poses. Minimum from visible skin vertices >=0.5 weighted to Hand_L to weapon triangles (neon excluded); support triangles have at least one vertex in design forward 0.18–0.40 m and height -0.05–0.03 m, in gun-local coordinates. These are vertex-to-surface upper bounds, not surface intersection, continuous action, actual game input, network or phone.',missing,analyticControl:'0.2 m point-to-triangle distance',records,errors},null,2));
 console.log(JSON.stringify({records:records.map(r=>({kind:r.kind,pose:r.pose,mm:r.samples.map(s=>Math.round(s.distance*10000)/10),supportMm:r.samples.map(s=>Math.round(s.supportDistance*10000)/10),vertices:r.samples[0].vertices,triangles:r.samples[0].triangles,supportTriangles:r.samples[0].supportTriangles})),missing,errors},null,2));if(errors.length||records.length!==present.length||records.some(r=>r.samples.length!==4))process.exitCode=1;
}finally{await browser?.close();await new Promise(r=>server.close(r));}
