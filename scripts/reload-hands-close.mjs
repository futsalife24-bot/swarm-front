import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
const out='dist-validation/reload-hands-close';
await fs.mkdir(out,{recursive:true});
const kinds=['rifle','smg','shotgun','slug','rocket','heavy','sniper','laser','grenade','sticky','kick','medic'];
const files=[];
for(const kind of kinds){const dir=['rifle','shotgun','rocket'].includes(kind)?'realism-v2':'unique-v1';const file=`public/assets/weapons/${dir}/${kind}_0.glb`;const bytes=await fs.readFile(file);files.push({kind,file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}
const source=`
import * as T from 'three';
import {StandardTrooper,loadStandardTrooper} from '../../src/client/standard-trooper.ts';
import {loadProgressionWeapons,progressionWeaponModel} from '../../src/client/progression-weapons.ts';
import {makeWeapon} from '../../src/shared/progression.ts';
import {poseOf,reloadDuration} from '../../src/shared/defs.ts';
import {createWorld,addPlayer} from '../../src/shared/game.ts';
const tri=new T.Triangle(),v=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),near=new T.Vector3();
function distanceToMesh(root,point){let best=Infinity,reference=null,count=0;root.traverse(o=>{if(!o.isMesh||o.name==='WeaponNeonCore'||o.name==='WeaponNeonHalo')return;const g=o.geometry,p=g.getAttribute('position'),idx=g.index;if(!p)return;for(let i=0;i<(idx?idx.count:p.count);i+=3){a.fromBufferAttribute(p,idx?idx.getX(i):i).applyMatrix4(o.matrixWorld);b.fromBufferAttribute(p,idx?idx.getX(i+1):i+1).applyMatrix4(o.matrixWorld);c.fromBufferAttribute(p,idx?idx.getX(i+2):i+2).applyMatrix4(o.matrixWorld);tri.set(a,b,c);tri.closestPointToPoint(point,near);const d=near.distanceTo(point);if(d<best){best=d;reference=near.clone()}count++}});return {distance:best,closest:reference?.toArray(),triangles:count}}
tri.set(new T.Vector3(0,0,0),new T.Vector3(1,0,0),new T.Vector3(0,1,0));tri.closestPointToPoint(new T.Vector3(.2,.2,0),near);if(near.distanceTo(new T.Vector3(.2,.2,0))>1e-8)throw Error('正例失敗');tri.closestPointToPoint(new T.Vector3(.2,.2,.05),near);if(Math.abs(near.distanceTo(new T.Vector3(.2,.2,.05))-.05)>1e-8)throw Error('距離の負例失敗');
window.result=(async()=>{
 const assets=await loadStandardTrooper(),scene=new T.Scene(),records=[];
 scene.add(new T.HemisphereLight(0xffffff,0x465665,2.6));const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(3,5,-4);scene.add(sun);
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(360,245);renderer.setClearColor(0x12232d);
 const camera=new T.PerspectiveCamera(35,360/245,.01,100);
 document.body.style.cssText='margin:0;background:#10212a;color:#fff;font:14px sans-serif';document.body.innerHTML='<h2>装填中の両手と武器：製品モデルの拡大局所表示</h2><p>各段 25・50・75％、各時点２方向。数値は手首ボーン中心から武器表面までの距離で、手・指と弾倉の接触判定ではありません。</p><main></main>';
 const weapon=(id,kind)=>makeWeapon(id,kind,0,{power:0,reload:0,range:0,rate:0},true,0);
 for(const kind of ${JSON.stringify(kinds)}){
  const actor=new StandardTrooper(assets),p=addPlayer(createWorld('reload-near-'+kind),'review'),target=weapon('target-'+kind,kind),spare=weapon('spare-'+kind,'rifle');scene.add(actor.model);await loadProgressionWeapons([target,spare]);if(!progressionWeaponModel(target))throw Error('weapon unavailable '+kind);p.weapons=[target,spare];p.slot=0;p.ammo[0]=0;p.swapCd=0;const duration=reloadDuration(target,0);
  const row=document.createElement('section');row.style.cssText='display:grid;grid-template-columns:repeat(6,360px);gap:3px;margin:12px 0';const header=document.createElement('b');header.style.cssText='grid-column:1 / -1;font-size:16px';header.textContent=kind+' / '+poseOf(kind);row.append(header);document.querySelector('main').append(row);
  const samples=[];for(const fraction of [.25,.5,.75]){
   p.reload=duration*(1-fraction);for(let i=0;i<4;i++)actor.update(p,0,2+i*.1,'reload-near',.1);actor.model.updateMatrixWorld(true);const gun=actor.weapons[0];if(gun.parent?.name!=='RightHandWeaponSocket'||!actor.mode.includes('_reload_'))throw Error('unexpected mode/socket '+kind);
   const left=actor.model.getObjectByName('Hand_L').getWorldPosition(new T.Vector3()),right=actor.model.getObjectByName('Hand_R').getWorldPosition(new T.Vector3());const ld=distanceToMesh(gun,left),rd=distanceToMesh(gun,right);if(!Number.isFinite(ld.distance)||!Number.isFinite(rd.distance))throw Error('missing weapon surfaces');
   if(kind==='rifle'&&fraction===.25){const test=new T.Vector3().fromArray(ld.closest),on=distanceToMesh(gun,test).distance,far=distanceToMesh(gun,test.clone().add(new T.Vector3(10,10,10))).distance;if(on>1e-6||far<1)throw Error('実モデル正負対照失敗 '+on+'/'+far);}
   const focus=left.clone().lerp(right,.5);focus.y+=.015;for(const [label,offset] of [['前',new T.Vector3(1.05,.35,-1.35)],['横',new T.Vector3(1.6,.35,.20)]]){camera.position.copy(focus).add(offset.multiplyScalar(.58));camera.lookAt(focus);renderer.render(scene,camera);const cell=document.createElement('div');const title=document.createElement('div');title.textContent=Math.round(fraction*100)+'% / '+label+'  L '+Math.round(ld.distance*1000)+' R '+Math.round(rd.distance*1000)+' mm';const img=document.createElement('img');img.src=renderer.domElement.toDataURL();cell.append(title,img);row.append(cell)}
   samples.push({fraction,mode:actor.mode,left:left.toArray(),right:right.toArray(),leftBoneToWeapon:ld,rightBoneToWeapon:rd});
  }
  records.push({kind,pose:poseOf(kind),duration,samples});scene.remove(actor.model);actor.dispose();
 }
 renderer.dispose();renderer.forceContextLoss();return records;
})();`;
await fs.writeFile(out+'/entry.js',source);await build({stdin:{contents:source,resolveDir:path.resolve(out),sourcefile:'entry.js'},bundle:true,format:'esm',platform:'browser',define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'},outfile:out+'/bundle.js'});
const server=http.createServer(async(req,res)=>{const n=new URL(req.url,'http://localhost').pathname;if(n==='/')return void res.writeHead(200,{'Content-Type':'text/html'}).end('<meta charset="utf-8"><script type="module" src="/bundle.js"></script>');const root=path.resolve(n.startsWith('/assets/')?'public':out),name=n.startsWith('/assets/')?n.slice(1):path.basename(n),file=path.resolve(root,name);if(!file.startsWith(root+path.sep))return void res.writeHead(403).end();try{const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':'application/octet-stream'}).end(data)}catch{res.writeHead(404).end()}});
let browser;try{await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});const page=await browser.newPage({viewport:{width:2200,height:900},serviceWorkers:'block'}),errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push([r.url(),r.status()])});await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForFunction(()=>!!window.result,null,{timeout:30000});const records=await page.evaluate(()=>window.result);assert.equal(records.length,12);assert(records.every(r=>r.samples.length===3));assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);await page.screenshot({path:out+'/comparison.png',fullPage:true});await fs.writeFile(out+'/report.json',JSON.stringify({scope:'Isolated product StandardTrooper with fixed reload fractions, not actual game loop. Hand bone pivot to nearest weapon triangle distance is not hand surface or magazine contact. No hand/finger skin intersections, hidden meshes, intermediate frames, phone or performance.',controls:'synthetic exact zero and 50mm triangle distances; real gun surface point zero and remote point >1m',files,records,errors,failed},null,2));console.log(JSON.stringify({kinds:records.length,samples:records.reduce((a,r)=>a+r.samples.length,0),errors,failed}));}finally{await browser?.close();await new Promise(r=>server.close(r))}
