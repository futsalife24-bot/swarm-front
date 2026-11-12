// Isolated flat-ground feasibility study. Does not modify product or existing clips.
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
const out='dist-validation/prone-down-probe';
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
const smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x)};
function minimum(root,skin){let low=Infinity;const tmp=new T.Vector3();root.traverse(o=>{
 if(skin?(!o.isSkinnedMesh||!o.visible):(!o.isMesh||o.name==='WeaponNeonCore'||o.name==='WeaponNeonHalo'))return;
 const a=o.geometry?.getAttribute('position');if(!a)return;
 for(let i=0;i<a.count;i++){if(skin)o.getVertexPosition(i,tmp);else tmp.fromBufferAttribute(a,i);tmp.applyMatrix4(o.matrixWorld);low=Math.min(low,tmp.y);}
});return low;}
window.result=(async()=>{
 const assets=await loadStandardTrooper(), records=[], scene=new T.Scene();
 scene.add(new T.HemisphereLight(0xffffff,0x53636c,3));const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(3,4,3);scene.add(sun);
 const floor=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({color:0x506752,roughness:1,side:T.DoubleSide}));floor.rotation.x=-Math.PI/2;scene.add(floor);
 const grid=new T.GridHelper(20,40,0x819c80,0x6d866e);grid.position.y=.001;scene.add(grid);
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(300,220);renderer.setClearColor(0x12232d);
 const camera=new T.PerspectiveCamera(35,300/220,.01,100);camera.position.set(2.8,1.6,3.8);camera.lookAt(0,.65,0);
 document.body.style.cssText='margin:0;background:#12232d;color:white;font:12px sans-serif';
 document.body.innerHTML='<h2>うつ伏せ寄りダウンの隔離試作（平面）</h2><p>既存ポーズを胴の軸で回す簡易試作。非製品。体表交差は指定した静止時点だけ。</p><main></main>';
 const selected=[0,.7,1.0,1.4,1.9,2.02,2.15,2.35,2.6];
 for(const kind of ['shotgun','heavy','sniper'])for(const index of [0,1]){
  const actor=new StandardTrooper(assets),p=addPlayer(createWorld('prone-study'),'p');
  p.weapons=[make('first-'+kind,kind),make('second-'+kind,kind)];p.slot=index===0?1:0;p.reload=0;p.evade=0;p.hp=160;p.swapCd=0;
  scene.add(actor.model);await loadProgressionWeapons(p.weapons);for(let i=0;i<20;i++)actor.update(p,0,i/60,'warmup',1/60);
  const back=actor.weapons[index], held=actor.weapons[1-index];
  if(!back.parent?.name.startsWith('BackWeaponSocket')||held.parent?.name!=='RightHandWeaponSocket')throw Error('socket setup failed');
  const row=document.createElement('section');row.style.cssText='display:flex;gap:2px;margin:10px 0';document.querySelector('main').append(row);
  const frames=[],samples=[];let previousQ=null,previousChest=null;
  for(let n=0;n<=Math.round(2.6*60);n++){
   const t=n/60;
   actor.model.position.set(0,0,0);actor.model.quaternion.identity();
   p.hp=t<2?0:160;actor.update(p,0,t,'down-study',1/60);actor.model.updateMatrixWorld(true);
   const weight=t<2?smooth((t-.7)/.5):1-smooth((t-2)/.5);
   const pelvis=actor.model.getObjectByName('Pelvis').getWorldPosition(new T.Vector3());
   const chest=actor.model.getObjectByName('Chest').getWorldPosition(new T.Vector3());
   const axis=chest.clone().sub(pelvis).normalize(),rotation=new T.Quaternion().setFromAxisAngle(axis,Math.PI*weight);
   actor.model.quaternion.copy(rotation);actor.model.position.copy(pelvis).sub(pelvis.clone().applyQuaternion(rotation));actor.model.updateMatrixWorld(true);
   const rawBody=minimum(actor.model,true),lift=weight>0?Math.max(0,.002-rawBody):0;
   actor.model.position.y+=lift;actor.model.updateMatrixWorld(true);
   const bodyMin=rawBody+lift,heldMin=minimum(held,false),backMin=minimum(back,false);
   const chestNow=actor.model.getObjectByName('Chest').getWorldPosition(new T.Vector3());
   const frame={t,weight,bodyMin,heldMin,backMin,lift,chest:chestNow.toArray(),angleStep:previousQ?rotation.angleTo(previousQ):0,
     chestStep:previousChest?chestNow.distanceTo(previousChest):0};
   previousQ=rotation.clone();previousChest=chestNow.clone();frames.push(frame);
   if(selected.some(s=>Math.abs(t-s)<.009)){
    const body=collect(actor.model,true),backFaces=collect(back,false),heldFaces=collect(held,false);
    const b=intersections(body,backFaces),h=intersections(body,heldFaces),weapons=intersections(backFaces,heldFaces);
    Object.assign(frame,{bodyBackPairs:b.pairs,bodyHeldPairs:h.pairs,weaponPairs:weapons.pairs});
    renderer.render(scene,camera);
    const box=document.createElement('div');box.innerHTML='<b>'+kind+' 背負い'+(index+1)+' '+t.toFixed(2)+'秒<br>床 '+(bodyMin*1000).toFixed(0)+' / '+(heldMin*1000).toFixed(0)+' / '+(backMin*1000).toFixed(0)+' mm<br>交差 '+b.pairs+' / '+h.pairs+' / '+weapons.pairs+'</b><br><img src="'+renderer.domElement.toDataURL()+'">';row.append(box);samples.push(frame);
   }
  }
  records.push({kind,index,frames,samples});scene.remove(actor.model);actor.dispose();
 }
 renderer.dispose();renderer.forceContextLoss();return records;
})();`;
await build({stdin:{contents:source,resolveDir:path.resolve(out),sourcefile:'entry.js'},bundle:true,format:'esm',platform:'browser',define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'},outfile:out+'/bundle.js'});
const server=http.createServer(async(req,res)=>{const n=new URL(req.url,'http://localhost').pathname;const root=path.resolve(n.startsWith('/assets/')?'public':out),name=n.startsWith('/assets/')?n.slice(1):path.basename(n),file=path.resolve(root,name);if(!file.startsWith(root+path.sep))return void res.writeHead(403).end();try{const b=await fs.readFile(file);res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':'application/octet-stream'}).end(b);}catch{res.writeHead(404).end();}});
let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
 const page=await browser.newPage({viewport:{width:2800,height:900},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
 await page.route('**/fixture',r=>r.fulfill({contentType:'text/html',body:'<script type="module" src="/bundle.js"></script>'}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');await page.waitForFunction(()=>!!window.result,null,{timeout:10000});
 const records=await page.evaluate(()=>window.result);await page.screenshot({path:out+'/timeline.png',fullPage:true});
 await fs.writeFile(out+'/report.json',JSON.stringify({scope:'Single pose rotation prototype, flat plane, StandardTrooper.update at 60Hz. Surface crossings at selected timestamps only; no terrain, network, phone, unseen-parent visibility or solid containment. Held/body crossings include intentional contact.',records,errors},null,2));
 console.log(JSON.stringify({errors,records:records.map(r=>({kind:r.kind,index:r.index,minBody:Math.min(...r.frames.map(x=>x.bodyMin)),minHeld:Math.min(...r.frames.map(x=>x.heldMin)),minBack:Math.min(...r.frames.map(x=>x.backMin)),maxLift:Math.max(...r.frames.map(x=>x.lift)),maxChestStep:Math.max(...r.frames.map(x=>x.chestStep)),maxAngleStepDeg:Math.max(...r.frames.map(x=>x.angleStep))*180/Math.PI,samples:r.samples.map(({t,bodyBackPairs,bodyHeldPairs,weaponPairs})=>({t,bodyBackPairs,bodyHeldPairs,weaponPairs}))}))}));
 if(errors.length||records.length!==6)process.exitCode=1;
}finally{await browser?.close();await new Promise(r=>server.close(r));}
