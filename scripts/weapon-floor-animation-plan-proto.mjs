// Isolated lift prototype; this is not a product change or gameplay test.
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';

const out='dist-validation/weapon-ground-animation-plan-prototype';
await fs.mkdir(out,{recursive:true});
await fs.writeFile(`${out}/entry.js`, `
import * as T from 'three';
import { StandardTrooper, loadStandardTrooper } from '../../src/client/standard-trooper.ts';
import { loadProgressionWeapons } from '../../src/client/progression-weapons.ts';
import { makeWeapon } from '../../src/shared/progression.ts';
import { EVADE_DURATION } from '../../src/shared/defs.ts';
import { createWorld, addPlayer } from '../../src/shared/game.ts';
window.review=(async()=>{
 const assets=await loadStandardTrooper(),scene=new T.Scene();
 scene.add(new T.HemisphereLight(0xffffff,0x53636c,3));
 const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(3,4,3);scene.add(sun);
 const floor=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({color:0x506752,roughness:1,side:T.DoubleSide}));
 floor.rotation.x=-Math.PI/2;floor.position.y=0;scene.add(floor);
 const grid=new T.GridHelper(20,40,0x819c80,0x6d866e);grid.position.y=.001;scene.add(grid);
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(300,220);renderer.setClearColor(0x12232d);
 const camera=new T.PerspectiveCamera(35,300/220,.01,100);camera.position.set(2.8,1.6,3.8);camera.lookAt(0,.65,0);
 document.body.style.cssText='margin:0;background:#12232d;color:white;font:12px sans-serif';
 document.body.innerHTML='<h2>隔離試作：背負い武器の姿勢先読み回転と押し上げ（製品未反映）</h2><p>緑の面は y=0 の床。各セルは時点と武器の最下点（mm）を表示。60fps固定入力・平面の局所試験。</p><main id="rows"></main>';
 const make=(id,kind)=>makeWeapon(id,kind,0,{power:0,reload:0,range:0,rate:0},true,0);
 function minWeapon(gun){let min=Infinity,v=new T.Vector3();gun.updateWorldMatrix(true,true);gun.traverse(o=>{if(!o.isMesh||o.name==='WeaponNeonCore'||o.name==='WeaponNeonHalo')return;const a=o.geometry.getAttribute('position');for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);min=Math.min(min,v.y)}});return min;}
 function smooth(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);}
 function weight(action,t){return action==='roll'?(t<.25?smooth(t/.25):1-smooth((t-.25)/.30)):smooth(t/.8);}
 function boxParts(gun){
  gun.updateWorldMatrix(true,true);const inverse=gun.matrixWorld.clone().invert(),parts=[];
  gun.traverse(o=>{if(!o.isMesh||o.name==='WeaponNeonCore'||o.name==='WeaponNeonHalo')return;
   if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();parts.push({box:o.geometry.boundingBox.clone(),local:inverse.clone().multiply(o.matrixWorld)});});return parts;
 }
 function candidateMin(parts,parent,axis,angle){
  const q=new T.Quaternion().setFromEuler(new T.Euler(Math.PI/2,0,0));
  q.multiply(new T.Quaternion().setFromAxisAngle(axis,angle*Math.PI/180));
  const m=parent.clone().multiply(new T.Matrix4().compose(new T.Vector3(),q,new T.Vector3(1,1,1)));
  let min=Infinity;for(const part of parts)min=Math.min(min,part.box.clone().applyMatrix4(m.clone().multiply(part.local)).min.y);return min;
 }
 function selectPlan(parts,snapshots,action){
  let best=null;const axes=[new T.Vector3(1,0,0),new T.Vector3(0,1,0),new T.Vector3(0,0,1)];
  for(let a=0;a<3;a++)for(let deg=-40;deg<=40;deg+=10){let maxLift=0,total=0,maxRate=0,prev=0;
   for(const s of snapshots){const angle=deg*weight(action,s.t);const lift=Math.max(0,.002-candidateMin(parts,s.parent,axes[a],angle));
    maxLift=Math.max(maxLift,lift);total+=lift;maxRate=Math.max(maxRate,Math.abs(angle-prev)*60);prev=angle;}
   const cost=maxLift+.08*Math.abs(deg)*Math.PI/180+.05*total/snapshots.length;
   if(!best||cost<best.cost)best={axis:a,degrees:deg,maxLift,maxRate,cost};}
  return best;
 }
 function applyPlan(gun,plan,action,t){
  const axis=new T.Vector3(plan.axis===0?1:0,plan.axis===1?1:0,plan.axis===2?1:0),angle=plan.degrees*weight(action,t);
  gun.position.set(0,0,0);gun.quaternion.setFromEuler(new T.Euler(Math.PI/2,0,0));gun.quaternion.multiply(new T.Quaternion().setFromAxisAngle(axis,angle*Math.PI/180));gun.updateWorldMatrix(true,true);
  const bounds=new T.Box3(),box=new T.Box3();bounds.makeEmpty();gun.traverse(o=>{if(!o.isMesh||o.name==='WeaponNeonCore'||o.name==='WeaponNeonHalo')return;if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();bounds.union(box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));});
  const lift=Math.max(0,.002-bounds.min.y);if(lift){const inv=gun.parent.matrixWorld.clone().invert();gun.position.add(new T.Vector3(0,lift,0).applyMatrix3(new T.Matrix3().setFromMatrix4(inv)));}
  gun.updateWorldMatrix(true,true);gun.userData.prototypeRotation={axis:plan.axis,degrees:angle};return lift;
 }

 const records=[];
 for(const kind of ['shotgun','sniper'])for(const slot of [1,2])for(const action of ['down','roll']){
  const trooper=new StandardTrooper(assets),p=addPlayer(createWorld('ground-'+kind+slot+action),'review');scene.add(trooper.model);
  const target=make('target',kind),spare=make('spare','rifle');
  p.weapons=slot===1?[target,spare]:[spare,target];p.slot=slot===1?1:0;
  await loadProgressionWeapons(p.weapons);p.reload=0;p.evade=0;p.hp=160;p.swapCd=0;
  for(let i=0;i<12;i++)trooper.update(p,0,i/60,'runtime',1/60);
  const expected=slot===1?'BackWeaponSocket':'BackWeaponSocket_2',gun=trooper.weapons[slot===1?0:1];
  if(gun.parent?.name!==expected)throw Error('背負いソケット不一致: '+kind+' '+slot);
  // Offline planning uses the full known animation only as an upper-bound experiment.
  const duration=action==='down'?2.5:.55, snapshots=[],parts=boxParts(gun);
  for(let n=0;n<=Math.round(duration*60);n++){const t=n/60;p.hp=action==='down'?0:160;p.evade=action==='roll'?Math.max(0,EVADE_DURATION-t):0;trooper.update(p,0,t,'runtime',1/60);trooper.model.updateMatrixWorld(true);snapshots.push({t,parent:gun.parent.matrixWorld.clone()});}
  const plan=selectPlan(parts,snapshots,action);
  // Restore a fresh trooper to replay the selected plan from the beginning.
  scene.remove(trooper.model);trooper.dispose();
  const replay=new StandardTrooper(assets);scene.add(replay.model);p.hp=160;p.evade=0;
  for(let n=0;n<12;n++)replay.update(p,0,n/60,'runtime',1/60);
  const replayGun=replay.weapons[slot===1?0:1];
  const section=document.createElement('section');section.style.cssText='margin:10px 0';
  const heading=document.createElement('b');heading.textContent=kind+' / '+expected+' / '+action;section.append(heading);
  const row=document.createElement('div');row.style.cssText='display:flex;gap:2px';section.append(row);document.querySelector('#rows').append(section);
  const frames=[],shots=[];let best={min:Infinity};
  const snap=(t,min,label)=>{renderer.render(scene,camera);return {t,min,label,data:renderer.domElement.toDataURL()};};
  const times=action==='down'?[0,.25,.5,1,1.5,2,2.4]:[0,.05,.1,.15,.2,.25,.32,.48];
  const end=duration;
  for(let n=0;n<=Math.round(end*60);n++){
   const t=n/60;p.hp=action==='down'?0:160;
   p.evade=action==='roll'?Math.max(0,EVADE_DURATION-t):0;
   replay.update(p,0,t,'runtime',1/60);replay.model.updateMatrixWorld(true);const lift=applyPlan(replayGun,plan,action,t);
   const min=minWeapon(replayGun),entry={time:t,min,lift,rotation:replayGun.userData.prototypeRotation,mode:replay.mode,socketPosition:replayGun.parent.getWorldPosition(new T.Vector3()).toArray(),socketQuaternion:replayGun.parent.getWorldQuaternion(new T.Quaternion()).toArray(),spinePosition:replay.model.getObjectByName('Spine').getWorldPosition(new T.Vector3()).toArray(),pelvisPosition:replay.model.getObjectByName('Pelvis').getWorldPosition(new T.Vector3()).toArray()};frames.push(entry);
   if(min<best.min){best={...entry,shot:snap(t,min,'最低点')};}
   if(times.some(x=>Math.abs(x-t)<1/120+.00001)) shots.push(snap(t,min,'時点'));
  }
  shots.push(best.shot);
  for(const shot of shots){const cell=document.createElement('div'),label=document.createElement('div'),img=document.createElement('img');
   label.textContent=shot.label+' '+shot.t.toFixed(3)+'s / '+(shot.min*1000).toFixed(1)+' mm';img.src=shot.data;cell.append(label,img);row.append(cell);}
  records.push({kind,slot:expected,action,plan,frames,minimum:best.min,timeAtMinimum:best.time,expectedSampledTimes:times,numberOfShots:shots.length});
  scene.remove(replay.model);replay.dispose();
 }
 renderer.dispose();renderer.forceContextLoss();return records;
})();`);
await build({entryPoints:[`${out}/entry.js`],bundle:true,format:'esm',platform:'browser',define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'},outfile:`${out}/bundle.js`});
await fs.writeFile(`${out}/index.html`,'<!doctype html><html lang="ja"><meta charset="utf-8"><body><script type="module" src="./bundle.js"></script></body></html>');
const server=http.createServer(async(req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;const root=path.resolve(pathname.startsWith('/assets/')?'public':out);const name=pathname.startsWith('/assets/')?pathname.slice(1):path.basename(pathname),file=path.resolve(root,name);if(!file.startsWith(root+path.sep))return void res.writeHead(403).end();try{const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'}).end(data)}catch{res.writeHead(404).end()}});
let browser;
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
 const page=await browser.newPage({viewport:{width:2720,height:900},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);await page.waitForFunction(()=>!!window.review);
 const records=await page.evaluate(()=>window.review);assert.equal(records.length,8);assert.deepEqual(errors,[]);
 await page.screenshot({path:`${out}/timeline.png`,fullPage:true});
 await fs.writeFile(`${out}/report.json`,JSON.stringify({records,errors,limitations:['未来のアニメーションを全て知る隔離オフライン計画。製品には未反映','60fps固定入力・平面・直接StandardTrooper.update。実ゲーム操作・Rendererの移動補間・地形・通信は未検証','ネオンは床下測定から除外','ダウン2.5秒、回避0.55秒の範囲']},null,2));
 console.log(JSON.stringify(records.map(({kind,slot,action,minimum,timeAtMinimum})=>({kind,slot,action,minimum,timeAtMinimum}))));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
