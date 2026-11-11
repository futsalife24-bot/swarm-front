import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';import http from 'node:http';import path from 'node:path';
const out='dist-validation/floor-body-probe';await fs.mkdir(out,{recursive:true});
const source=`
import * as T from 'three';
import { StandardTrooper, loadStandardTrooper } from '../../src/client/standard-trooper.ts';
import { loadProgressionWeapons } from '../../src/client/progression-weapons.ts';
import { makeWeapon } from '../../src/shared/progression.ts';
import { EVADE_DURATION } from '../../src/shared/defs.ts';
import { createWorld, addPlayer } from '../../src/shared/game.ts';
const make=(id,kind)=>makeWeapon(id,kind,0,{power:0,reload:0,range:0,rate:0},true,0);
window.result=(async()=>{
 const assets=await loadStandardTrooper(),records=[];
 for(const kind of ['shotgun','sniper'])for(const index of [0,1])for(const action of ['roll','down']){
  const v=new StandardTrooper(assets),p=addPlayer(createWorld('x'),'p',[make('test',kind),make('other','rifle')]);
  p.slot=index===0?1:0;p.weapons[index]=make('test',kind);p.weapons[1-index]=make('other','rifle');
  await loadProgressionWeapons(p.weapons);p.reload=0;p.evade=0;p.hp=160;p.swapCd=0;
  for(let i=0;i<20;i++)v.update(p,0,i/60,'runtime',1/60);
  const selected=new Set(action==='roll'?[0,6,8,9,10,11,12,14,16,19]:[0,15,30,45,60,90,120,144]);const rows=[];
  for(let i=0;i<=(action==='roll'?19:144);i++){
   const t=i/60;p.hp=action==='down'?0:160;p.evade=action==='roll'?Math.max(0,EVADE_DURATION-t):0;
   v.update(p,0,t,'runtime',1/60);v.model.updateMatrixWorld(true);
   if(!selected.has(i))continue;
   const gun=v.weapons[index];let weaponMin=Infinity,bodyMin=Infinity,bodyBelow=0,bodyTotal=0,bodyParts={},tmp=new T.Vector3();
   gun.traverse(o=>{if(!o.isMesh||o.name==='WeaponNeonCore'||o.name==='WeaponNeonHalo')return;const a=o.geometry.getAttribute('position');for(let j=0;j<a.count;j++){tmp.fromBufferAttribute(a,j).applyMatrix4(o.matrixWorld);weaponMin=Math.min(weaponMin,tmp.y)}});
   v.model.traverse(o=>{if(!o.isSkinnedMesh||!o.visible)return;const a=o.geometry.getAttribute('position');if(!a)return;let min=Infinity,below=0;
     for(let j=0;j<a.count;j++){o.getVertexPosition(j,tmp).applyMatrix4(o.matrixWorld);min=Math.min(min,tmp.y);if(tmp.y<-.001)below++}
     bodyMin=Math.min(bodyMin,min);bodyBelow+=below;bodyTotal+=a.count;bodyParts[o.name]={min,below,total:a.count};});
   rows.push({t,weaponMin,bodyMin,bodyBelow,bodyTotal,bodyParts,spine:v.model.getObjectByName('Spine').getWorldPosition(new T.Vector3()).toArray(),socket:gun.parent.getWorldPosition(new T.Vector3()).toArray()});
  }
  records.push({kind,index,action,rows});v.dispose();
 }
 return records;
})();`;
await build({stdin:{contents:source,resolveDir:path.resolve(out),sourcefile:'entry.js'},bundle:true,format:'esm',platform:'browser',define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'},outfile:out+'/bundle.js'});
const server=http.createServer(async(req,res)=>{const n=new URL(req.url,'http://localhost').pathname;const root=path.resolve(n.startsWith('/assets/')?'public':out),name=n.startsWith('/assets/')?n.slice(1):path.basename(n),file=path.resolve(root,name);if(!file.startsWith(root+path.sep))return void res.writeHead(403).end();try{res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':'application/octet-stream'}).end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
let browser;try{await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/fixture',(r)=>r.fulfill({contentType:'text/html',body:'<script type="module" src="/bundle.js"></script>'}));await p.goto(`http://127.0.0.1:${server.address().port}/fixture`);await p.waitForFunction(()=>!!window.result);const records=await p.evaluate(()=>window.result);await fs.writeFile(out+'/report.json',JSON.stringify({records,errors,scope:'Direct trooper update; static flat ground, mesh vertices not triangles, no game renderer movement, network or device.'},null,2));console.log(JSON.stringify(records.map(r=>({kind:r.kind,index:r.index,action:r.action,worst:r.rows.reduce((a,b)=>a.weaponMin<b.weaponMin?a:b)})).map(({worst,...rest})=>({...rest,t:worst.t,weaponMin:worst.weaponMin,bodyMin:worst.bodyMin,bodyBelow:worst.bodyBelow,bodyTotal:worst.bodyTotal})),null,2));if(errors.length)process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.close(r));}
