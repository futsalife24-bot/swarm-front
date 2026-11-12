// Local actual fire events + StandardTrooper + CombatEffects. No helper lines.
// --available permits unfinished assets; without it all twelve are required.
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const out = "dist-validation/weapon-shot-effects";
const kinds = ["rifle", "smg", "shotgun", "slug", "rocket", "heavy", "sniper", "laser", "grenade", "sticky", "kick", "medic"];
const available = [], missing = [];
for (const kind of kinds) {
  const folder = ["rifle", "shotgun", "rocket"].includes(kind) ? "realism-v2" : "unique-v1";
  try { await fs.access(`public/assets/weapons/${folder}/${kind}_0.glb`); available.push(kind); }
  catch { missing.push(kind); }
}
await fs.mkdir(out, { recursive: true });
const source = `
import * as T from 'three';
import { StandardTrooper, loadStandardTrooper, weaponBore } from './src/client/standard-trooper.ts';
import { CombatEffects } from './src/client/combat-effects.ts';
import { loadProgressionWeapons, progressionWeaponModel } from './src/client/progression-weapons.ts';
import { makeWeapon } from './src/shared/progression.ts';
import { WEAPONS, poseOf } from './src/shared/defs.ts';
import { createWorld, addPlayer, fire, neutral } from './src/shared/game.ts';
const kinds=${JSON.stringify(kinds)}, available=${JSON.stringify(available)};
document.body.innerHTML='<h1>発射エフェクトの検証</h1><p>ゲームの発射イベントとエフェクトを表示。補助線・銃口マーカーはありません。弾体の飛行経路は未検証。</p><main></main>';
window.review=(async()=>{
  const assets=await loadStandardTrooper(), records=[];
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true}); renderer.setSize(360,260); renderer.setClearColor(0x12232d);
  const camera=new T.PerspectiveCamera(35,360/260,.01,200);camera.position.set(3.3,1.8,1.8);camera.lookAt(0,1.1,-.4);camera.updateMatrixWorld(true);
  for(const kind of kinds){
    const cell=document.createElement('section');document.querySelector('main').append(cell);
    const title=document.createElement('h2');title.textContent=WEAPONS[kind].name;cell.append(title);
    if(!available.includes(kind)){cell.append('未生成');records.push({kind,missing:true});continue;}
    const w=createWorld('effect-'+kind,42), weapon=makeWeapon('target-'+kind,kind,0,{power:0,reload:0,range:0,rate:0},false,0), spare=makeWeapon('spare','rifle',0,{power:0,reload:0,range:0,rate:0},false,0);
    const p=addPlayer(w,'review',[weapon,spare]);p.x=0;p.y=0;p.z=0;p.cool=0;p.reload=0;p.swapCd=0;
    w.enemies=[]; w.events=[];w.projectiles=[];
    await loadProgressionWeapons(p.weapons);
    const sourceModel=progressionWeaponModel(weapon);if(!sourceModel)throw Error(kind+': model missing');
    const actor=new StandardTrooper(assets), scene=new T.Scene();scene.add(actor.model,new T.HemisphereLight(0xffffff,0x526070,3));
    const light=new T.DirectionalLight(0xffffff,3);light.position.set(3,4,3);scene.add(light);
    for(let i=0;i<10;i++)actor.update(p,0,i/60,'effect-'+kind,1/60);
    fire(w,p,{...neutral(),yaw:0,pitch:0});
    // Renderer positions the soldier from the post-shot snapshot; kickback can
    // move the player during fire(), so position both soldier and camera here.
    actor.model.position.set(p.x,p.y,p.z);
    camera.position.set(p.x+3.3,p.y+1.8,p.z+1.8);camera.lookAt(p.x,p.y+1.1,p.z-.4);camera.updateMatrixWorld(true);
    const shots=w.events.filter(e=>e.type==='shot' && e.owner===p.id);
    if(!shots.length) throw Error(kind+': no actual shot event');
    // Same target handling as Renderer: extend two-metre projectile direction markers.
    const aim=shots.map(e=>{const d=new T.Vector3(e.tx-e.x,e.ty-e.y,e.tz-e.z), len=d.length();return new T.Vector3(e.x,e.y,e.z).addScaledVector(d,len<3?30/len:1)});
    actor.aimAt(aim);actor.update(p,0,.2,'effect-'+kind,1/60);actor.model.updateMatrixWorld(true);
    const muzzle=actor.muzzle(), barrel=actor.barrel();if(!muzzle||!barrel)throw Error(kind+': no held muzzle');
    const rawBore=weaponBore(sourceModel), heldBore=weaponBore(actor.weapons[0]);
    const effectScene=new CombatEffects(scene), body=new T.Vector3(p.x,p.y,p.z);
    for(const shot of shots)effectScene.event(shot,body,out=>actor.muzzle(out));
    const flashes=effectScene.items.filter(e=>e.kind==='muzzle'), bullets=effectScene.items.filter(e=>e.kind==='bullet');
    if(flashes.length!==shots.length)throw Error(kind+': missing muzzle effect');
    const distances=flashes.map(e=>e.mesh.position.distanceTo(muzzle));
    const bulletOffsets=bullets.map(e=>e.mesh.position.distanceTo(muzzle));
    const directionAngles=bullets.map(e=>barrel.angleTo(e.velocity.clone().normalize())*180/Math.PI);
    const aimMean=aim.reduce((sum,v)=>sum.add(v),new T.Vector3()).divideScalar(aim.length);
    const aimAngle=barrel.angleTo(aimMean.sub(muzzle).normalize())*180/Math.PI;
    const projectile=w.projectiles[0];
    effectScene.update(0,camera); renderer.render(scene,camera);
    const image=document.createElement('img');image.src=renderer.domElement.toDataURL();cell.append(image);
    const note=document.createElement('p');note.textContent='構え '+poseOf(kind)+' / 銃口炎 '+flashes.length+' / 発光弾 '+bullets.length+(projectile?' / 弾体の飛行は未検証':'');cell.append(note);
    records.push({kind,pose:poseOf(kind),eventFamily:shots[0].weapon,shots:shots.length,localBore:rawBore.muzzle.toArray(),heldBore:heldBore.muzzle.toArray(),boreDifference:heldBore.muzzle.distanceTo(rawBore.muzzle),worldMuzzle:muzzle.toArray(),flashOffsets:distances,bulletOffsets,barrelToBulletDegrees:directionAngles,barrelToMeanAimDegrees:aimAngle,projectile:projectile?{initial:[projectile.x,projectile.y,projectile.z],initialDistanceFromMuzzle:new T.Vector3(projectile.x,projectile.y,projectile.z).distanceTo(muzzle),flight:'未検証'}:null});
    effectScene.clear();actor.dispose();
  }
  renderer.dispose();renderer.forceContextLoss();return records;
})();`;
const bundle = await build({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:"shot-effects-review.js"},bundle:true,write:false,format:"esm",platform:"browser",loader:{".png":"dataurl"},define:{"import.meta.env.BASE_URL":'"/"',"import.meta.env.DEV":"false"}});
const html=`<html lang="ja"><meta charset="utf-8"><style>body{margin:0;padding:10px;background:#12232d;color:white;font:14px sans-serif}h1{font-size:20px}main{display:grid;grid-template-columns:repeat(3,360px);gap:8px}section{min-height:300px;background:#203846}section h2,section p{margin:4px;font-size:13px}section img{display:block;width:360px}</style><body><script type="module" src="/bundle.js"></script></body></html>`;
const server=http.createServer(async(req,res)=>{
  const name=new URL(req.url,"http://127.0.0.1").pathname;
  if(name==="/")return void res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"}).end(html);
  if(name==="/bundle.js")return void res.writeHead(200,{"Content-Type":"text/javascript"}).end(bundle.outputFiles[0].contents);
  if(!name.startsWith('/assets/'))return void res.writeHead(404).end();
  const root=path.resolve('public','assets'),target=path.resolve('public',name.slice(1));
  if(!target.startsWith(root+path.sep))return void res.writeHead(403).end();
  try{res.writeHead(200,{"Content-Type":"application/octet-stream"}).end(await fs.readFile(target));}catch{res.writeHead(404).end();}
});
let browser;
try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
  const page=await browser.newPage({viewport:{width:1120,height:390},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.waitForFunction(()=>!!window.review);
  const rows=await page.evaluate(()=>window.review);
  await page.screenshot({path:out+'/shot-effects.png',fullPage:true});
  const report={scope:'Real local fire events, StandardTrooper and CombatEffects; not full Renderer, network, projectile flight, or device',missing,rows,errors};
  await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));
  const problems=rows.filter(r=>!r.missing&&(r.flashOffsets.some(n=>n>0.001)||r.bulletOffsets.some(n=>n>0.001)));
  if(errors.length||problems.length||(missing.length&&!process.argv.includes('--available')))process.exitCode=1;
  console.log(JSON.stringify({...report,problems:problems.map(r=>r.kind)},null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
