// Isolated local game fixture using the actual Renderer and authoritative fire/step.
// Captures real rendering only; no overlaid helper lines or markers.
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const out = "dist-validation/grenade-renderer-shot";
const fps = process.argv.includes("--30") ? 30 : 60;
const stepped = process.argv.includes("--stepped");
await fs.mkdir(out, { recursive: true });
const source = `
import * as T from 'three';
import { Renderer } from './src/client/render.ts';
import { loadStandardTrooper } from './src/client/standard-trooper.ts';
import { loadProgressionWeapons } from './src/client/progression-weapons.ts';
import { makeWeapon } from './src/shared/progression.ts';
import { createWorld, addPlayer, fire, neutral, step } from './src/shared/game.ts';
window.review=(async()=>{
  const weapon=makeWeapon('grenade-review','grenade',0,{power:0,reload:0,range:0,rate:0},false,0);
  const spare=makeWeapon('rifle-review','rifle',0,{power:0,reload:0,range:0,rate:0},false,0);
  await Promise.all([loadStandardTrooper(),loadProgressionWeapons([weapon,spare])]);
  const canvas=document.createElement('canvas'),damage=document.createElement('div');damage.id='damage';
  document.body.append(canvas,damage);
  const view=new Renderer(canvas),w=createWorld('grenade-renderer-review',42),p=addPlayer(w,'review',[weapon,spare]);
  w.phase='battle';w.wave=1;w.waveAt=100000;w.training=true;w.enemies=[];
  // Real Renderer creates the soldier asynchronously; wait for it, then pose it.
  view.render(w,p.id,.05,0,0);await new Promise(resolve=>setTimeout(resolve,100));
  for(let n=0;n<5;n++)view.render(w,p.id,.05,0,0);
  const trooper=view.players.get(p.id)?.userData.trooper;
  if(!trooper)throw Error('実兵士モデルが読み込まれません');
  view.frameRate=${fps}; view.framePacer.reset();
  if (${stepped}) step(w,{[p.id]:{...neutral(),yaw:0,pitch:0,fire:true}},.05);
  else fire(w,p,{...neutral(),yaw:0,pitch:0});
  const shot=w.events.find(e=>e.type==='shot'&&e.owner===p.id), initial=w.projectiles[0];
  if(!shot||!initial)throw Error('実発射イベントまたは弾体がありません');
  const initialProjectile={x:initial.x,y:initial.y,z:initial.z,dx:initial.dx,dy:initial.dy,dz:initial.dz};
  const captures=[], records=[];
  for(const time of [0,.05,.1]){
    if(time>0)step(w,{},.05);
    // Hold each 20 Hz world snapshot while the 60 Hz renderer advances; this
    // keeps short-lived visual effects on the same clock as the snapshots.
    const frames=time===0?1:Math.round(.05*${fps});
    for(let frame=0;frame<frames;frame++){
      let drawn=false;
      for(let attempt=0;attempt<5&&!drawn;attempt++)drawn=!!view.render(w,p.id,1/${fps},0,0);
      if(!drawn)throw Error('描画フレームを取得できません');
    }
    const projectile=w.projectiles[0], muzzle=trooper.muzzle(), barrel=trooper.barrel();
    const bullet=view.combat.items.find(e=>e.kind==='bullet');
    const flash=view.combat.items.find(e=>e.kind==='muzzle');
    const project=(v)=>{const n=v.clone().project(view.camera);return {x:(n.x+1)*innerWidth/2,y:(1-n.y)*innerHeight/2,depth:n.z}};
    const row={time,projectile:projectile?{position:[projectile.x,projectile.y,projectile.z],screen:project(new T.Vector3(projectile.x,projectile.y,projectile.z))}:null,
      muzzle:muzzle?.toArray(),muzzleScreen:muzzle?project(muzzle):null,
      muzzleFlash:!!flash,bullet:bullet?{position:bullet.mesh.position.toArray(),screen:project(bullet.mesh.position),velocity:bullet.velocity.toArray(),angleFromBarrel:barrel.angleTo(bullet.velocity.clone().normalize())*180/Math.PI}:null};
    records.push(row);
    const enlarged=document.createElement('canvas');enlarged.width=enlarged.height=390;
    const at=row.muzzleScreen;enlarged.getContext('2d').drawImage(view.renderer.domElement,Math.max(0,at.x-70),Math.max(0,at.y-70),140,140,0,0,390,390);
    captures.push({full:view.renderer.domElement.toDataURL(),zoom:enlarged.toDataURL()});
  }
  canvas.remove();damage.remove();
  document.body.innerHTML='<h1>GL-6：実Rendererの発射（${fps}fps）</h1><p>${stepped ? 'ゲームのstepで発射・移動した後に描画。' : 'fire直後、step前の中間状態を描画。'}線・位置の補助表示はありません。</p><main></main>';
  for(let i=0;i<captures.length;i++){const section=document.createElement('section'),h=document.createElement('h2'),grid=document.createElement('div'),img=document.createElement('img'),zoom=document.createElement('img');h.textContent=(${stepped} ? ['発射後の初回状態','追加50ミリ秒後','追加100ミリ秒後'] : ['発射直後（step前）','50ミリ秒後','100ミリ秒後'])[i]+'（左：全画面、右：同画面の拡大）';grid.className='pair';img.src=captures[i].full;zoom.src=captures[i].zoom;grid.append(img,zoom);section.append(h,grid);document.querySelector('main').append(section);}
  return {initialProjectile,shot,records};
})();`;
const bundled=await build({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'grenade-renderer-review.js'},bundle:true,write:false,format:'esm',platform:'browser',loader:{'.png':'dataurl','.css':'empty'},define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false','import.meta.env.VITE_PUBLIC_GAME_URL':'""'}});
const html=`<html lang="ja"><meta charset="utf-8"><style>body{margin:0;background:#11232f;color:white;font:14px sans-serif}h1,h2,p{margin:8px;font-size:16px}.pair{display:grid;grid-template-columns:422px 390px;gap:8px}.pair img:first-child{display:block;width:422px;height:195px}.pair img:last-child{display:block;width:390px;height:390px}</style><body><script type="module" src="/bundle.js"></script></body></html>`;
const server=http.createServer(async(req,res)=>{
  const name=new URL(req.url,'http://127.0.0.1').pathname;
  if(name==='/')return void res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(html);
  if(name==='/bundle.js')return void res.writeHead(200,{'Content-Type':'text/javascript'}).end(bundled.outputFiles[0].contents);
  if(!name.startsWith('/assets/'))return void res.writeHead(404).end();
  const root=path.resolve('public','assets'),target=path.resolve('public',name.slice(1));
  if(!target.startsWith(root+path.sep))return void res.writeHead(403).end();
  try{res.writeHead(200,{'Content-Type':'application/octet-stream'}).end(await fs.readFile(target));}catch{res.writeHead(404).end();}
});
let browser;
try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
  const page=await browser.newPage({viewport:{width:844,height:390},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.waitForFunction(()=>!!window.review);
  const data=await page.evaluate(()=>window.review);
  const suffix=fps+(stepped?'-stepped':'-prestep');
  await page.screenshot({path:out+'/grenade-renderer-'+suffix+'.png',fullPage:true});
  const report={scope:'Actual local Renderer, game fire and step; isolated fixture, no UI, network, or phone',viewport:[844,390],fps,stepped,...data,errors};
  await fs.writeFile(out+'/report-'+suffix+'.json',JSON.stringify(report,null,2));
  if(errors.length)process.exitCode=1;
  console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
