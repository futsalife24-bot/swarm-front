// Fixed-input local fixture: actual game Renderer, weapon and soldier assets.
// Does not use personal saves, networking or authoritative gameplay stepping.
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import assert from "node:assert/strict";

const out = "dist-validation/weapon-floor-renderer";
await fs.mkdir(out, { recursive: true });
const source = `
import * as T from 'three';
import { Renderer } from './src/client/render.ts';
import { loadStandardTrooper } from './src/client/standard-trooper.ts';
import { loadProgressionWeapons } from './src/client/progression-weapons.ts';
import { makeWeapon } from './src/shared/progression.ts';
import { EVADE_DURATION } from './src/shared/defs.ts';
import { createWorld, addPlayer } from './src/shared/game.ts';
import { mapFor } from './src/shared/stages.ts';
import { groundHeight, supportHeight } from './src/shared/terrain.ts';
window.review=(async()=>{
 const make=(id,kind)=>makeWeapon(id,kind,0,{power:0,reload:0,range:0,rate:0},true,0);
 const shotgun=make('shotgun','shotgun'),sniper=make('sniper','sniper'),rifle=make('rifle','rifle');
 await Promise.all([loadStandardTrooper(),loadProgressionWeapons([shotgun,sniper,rifle])]);
 const canvas=document.createElement('canvas'),damage=document.createElement('div');damage.id='damage';document.body.append(canvas,damage);
 const view=new Renderer(canvas);view.frameRate=60;view.framePacer.reset();
 const shot=[];
 function measure(gun,map,p){
  let bottom=Infinity,min=null,v=new T.Vector3();gun.updateWorldMatrix(true,true);
  gun.traverse(o=>{if(!o.isMesh||o.name==='WeaponNeonCore'||o.name==='WeaponNeonHalo')return;
    const a=o.geometry.getAttribute('position');for(let i=0;i<a.count;i++){
      v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);
      if(v.y<bottom){bottom=v.y;min=v.clone();}
    }});
  if(!min)throw Error('weapon geometry missing');
  const ground=groundHeight(min.x,min.z,map.blocks),support=supportHeight(min.x,min.z,map.blocks,p.y??0);
  return {min:min.toArray(),ground,support,relativeToGround:bottom-ground,relativeToSupport:bottom-support};
 }
 function draw(w,p){for(let n=0;n<5;n++)if(view.render(w,p.id,1/60,0,0))return;throw Error('renderer did not draw');}
 for(const kind of ['shotgun','sniper'])for(const targetIndex of [0,1])for(const action of ['down','roll']){
  const target=kind==='shotgun'?shotgun:sniper, equips=targetIndex===0?[target,rifle]:[rifle,target];
  const run='floor-'+kind+'-'+targetIndex+'-'+action,w=createWorld(run,42),p=addPlayer(w,run,equips);
  w.phase='battle';w.wave=1;w.waveAt=100000;w.enemies=[];w.stage=1;
  p.x=-1;p.z=34;p.y=0;p.slot=1-targetIndex;p.hp=160;p.evade=0;p.reload=0;p.swapCd=0;
  const map=mapFor(w),groundAtPlayer=groundHeight(p.x,p.z,map.blocks),supportAtPlayer=supportHeight(p.x,p.z,map.blocks,groundAtPlayer);
  if(Math.abs(groundAtPlayer-supportAtPlayer)>0.001)throw Error('fixture spawn does not have a single known floor');
  p.y=supportAtPlayer;draw(w,p);await new Promise(resolve=>setTimeout(resolve,180));
  for(let i=0;i<15;i++){w.time+=1/60;draw(w,p);}
  let trooper=view.players.get(p.id)?.userData.trooper;
  if(!trooper)throw Error('soldier not loaded for '+run);
  let mapIndex=view.mapAssets.groups.findIndex(g=>g.visible);
  for(let i=0;i<100&&view.mapAssets.status[mapIndex]?.state==='loading';i++)await new Promise(resolve=>setTimeout(resolve,50));
  if(view.mapAssets.status[mapIndex]?.state!=='ready')throw Error('map asset not ready: '+JSON.stringify(view.mapAssets.status[mapIndex]));
  const gun=trooper.weapons[targetIndex],expected=targetIndex===0?'BackWeaponSocket':'BackWeaponSocket_2';
  if(gun.parent?.name!==expected)throw Error('unexpected socket '+gun.parent?.name);
  const times=action==='down'?[0,.25,.5,1,1.5,2,2.4]:[0,.05,.1,.15,.2,.25,.32,.48];
  const end=action==='down'?2.5:.55,frames=[],captures=[];
  for(let n=0;n<=Math.round(end*60);n++){
   const time=n/60;p.hp=action==='down'?0:160;p.evade=action==='roll'?Math.max(0,EVADE_DURATION-time):0;w.time+=1/60;draw(w,p);
   const m=measure(gun,map,p);frames.push({time,...m,mode:trooper.mode});
   if(times.some(x=>Math.abs(x-time)<1/120+.00001)){
    const middle=new T.Vector3(0,action==='down'&&time>=.75?.18:.65,0).applyMatrix4(trooper.model.matrixWorld).project(view.camera);
    const cx=(middle.x+1)*canvas.width/2,cy=(1-middle.y)*canvas.height/2;
    const side=Math.min(220,canvas.width,canvas.height),sx=Math.max(0,Math.min(canvas.width-side,cx-side/2)),sy=Math.max(0,Math.min(canvas.height-side,cy-side/2));
    const crop=document.createElement('canvas');crop.width=crop.height=220;crop.getContext('2d').drawImage(canvas,sx,sy,side,side,0,0,220,220);
    captures.push({time,...m,image:crop.toDataURL()});
   }
  }
  let min=frames.reduce((a,b)=>a.relativeToGround<b.relativeToGround?a:b);
  shot.push({kind,socket:expected,action,map:map.name,groundAtPlayer,supportAtPlayer,mapStatus:view.mapAssets.status[mapIndex],captures,minimum:{time:min.time,...min}});
 }
 canvas.remove();damage.remove();document.body.innerHTML='<h1>背負い武器の床接触：ゲームRenderer</h1><p>同じ街区・地形・カメラ。固定入力による局所試験。画像は実画面の拡大。表示値は最低頂点の高さとその直下の地表との差。</p><main></main>';
 for(const r of shot){const section=document.createElement('section'),h=document.createElement('h2'),row=document.createElement('div');h.textContent=r.kind+' / '+r.socket+' / '+r.action+' / 地形 '+r.map;row.className='row';section.append(h,row);document.querySelector('main').append(section);
 for(const c of r.captures){const cell=document.createElement('div'),label=document.createElement('div'),img=document.createElement('img');label.textContent=c.time.toFixed(2)+'秒 / '+(c.relativeToGround*1000).toFixed(0)+'mm';img.src=c.image;cell.append(label,img);row.append(cell);delete c.image;}}
 return shot;
})();`;
const bundle = await build({ stdin: { contents: source, resolveDir: process.cwd(), sourcefile: "weapon-floor-review.js" }, bundle: true, write: false, format: "esm", platform: "browser", loader: { ".png": "dataurl", ".css": "empty" }, define: { "import.meta.env.BASE_URL": '"/"', "import.meta.env.DEV": "false", "import.meta.env.VITE_PUBLIC_GAME_URL": '""' } });
const html = '<html lang="ja"><meta charset="utf-8"><style>body{margin:0;background:#11232f;color:white;font:14px sans-serif}h1,h2,p{margin:7px;font-size:15px}.row{display:flex;gap:4px}.row img{display:block;width:220px;height:220px}</style><body><script type="module" src="/bundle.js"></script></body></html>';
const server = http.createServer(async (req, res) => {
  const name = new URL(req.url, "http://127.0.0.1").pathname;
  if (name === "/") return void res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(html);
  if (name === "/bundle.js") return void res.writeHead(200, { "Content-Type": "text/javascript" }).end(bundle.outputFiles[0].contents);
  if (!name.startsWith("/assets/")) return void res.writeHead(404).end();
  const root = path.resolve("public", "assets"), target = path.resolve("public", name.slice(1));
  if (!target.startsWith(root + path.sep)) return void res.writeHead(403).end();
  try { res.writeHead(200, { "Content-Type": "application/octet-stream" }).end(await fs.readFile(target)); } catch { res.writeHead(404).end(); }
});
let browser;
try {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=d3d11"] });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, serviceWorkers: "block" }), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => !!window.review);
  const data = await page.evaluate(() => window.review);
  assert.equal(data.length, 8); assert.deepEqual(errors, []);
  // The eight captured renderings used 844x390; enlarge only the HTML contact sheet.
  await page.setViewportSize({ width: 1800, height: 800 });
  await page.screenshot({ path: `${out}/floor-renderer.png`, fullPage: true });
  await fs.writeFile(`${out}/report.json`, JSON.stringify({ scope: "Actual local game Renderer with loaded map at 844x390; fixed stationary player state; no game input, terrain traversal, network or phone", renderViewport: [844, 390], contactSheetViewport: [1800, 800], data, errors }, null, 2));
  console.log(JSON.stringify(data.map(({ kind, socket, action, minimum, groundAtPlayer, supportAtPlayer, mapStatus }) => ({ kind, socket, action, minimum, groundAtPlayer, supportAtPlayer, mapStatus }))));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
