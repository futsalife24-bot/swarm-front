// Local visual evidence only. Run: node scripts/check-weapon-trooper-matrix.mjs [kind,kind,...]
// No argument means all 12 kinds; missing production assets/profiles are errors.
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const known = ["rifle", "smg", "shotgun", "slug", "rocket", "heavy", "sniper", "laser", "grenade", "sticky", "kick", "medic"];
const selected = process.argv[2] ? process.argv[2].split(",") : known;
const diagnostic = process.argv[3] === "--diagnostic";
const close = diagnostic || process.argv[3] === "--close";
assert.ok(selected.length && new Set(selected).size === selected.length && selected.every(k => known.includes(k)), "武器IDの指定を確認してください");
const out = `dist-validation/weapon-trooper-matrix${diagnostic ? '-diagnostic' : close ? '-close' : ''}`;
await fs.mkdir(out, { recursive: true });
const browserSource = `
import * as T from 'three';
import { StandardTrooper, loadStandardTrooper, weaponBore } from '../../src/client/standard-trooper.ts';
import { loadProgressionWeapons, progressionWeaponModel } from '../../src/client/progression-weapons.ts';
import { weaponModelUrl } from '../../src/client/weapon-model-url.ts';
import { makeWeapon } from '../../src/shared/progression.ts';
import { poseOf, reloadDuration } from '../../src/shared/defs.ts';
import { createWorld, addPlayer } from '../../src/shared/game.ts';
window.review = (async () => {
  const kinds = ${JSON.stringify(selected)};
  const close = ${JSON.stringify(close)};
  const diagnostic = ${JSON.stringify(diagnostic)};
  const assets = await loadStandardTrooper();
  const scene = new T.Scene();
  scene.add(new T.HemisphereLight(0xffffff,0x526070,3));
  const light = new T.DirectionalLight(0xffffff,3); light.position.set(3,4,3); scene.add(light);
  const renderer = new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  const width=close ? 400 : 250, height=close ? 300 : 270;
  renderer.setSize(width,height); renderer.setClearColor(0x12232d);
  const camera = new T.PerspectiveCamera(35,width/height,.01,100);
  camera.zoom=close ? 1.55 : 1; camera.updateProjectionMatrix();
  const marker = new T.Mesh(new T.SphereGeometry(.022,12,8),new T.MeshBasicMaterial({color:0xff4242}));
  const line = new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:0xff4242}));
  scene.add(marker,line); marker.visible=line.visible=false;
  document.body.style.cssText='margin:0;background:#12232d;color:white;font:12px sans-serif';
  document.body.innerHTML='<h2>武器の兵士表示：手持ち・背負い・装填'+(diagnostic?'11':'3')+'時点</h2><p>赤点と赤線は製品コードの銃口・銃身方向を示す補助表示。実際の射撃線やエフェクトの確認ではない。</p><main id="matrix"></main>';
  const records=[];
  const points={ front:[2.6,1.9,-3.3],side:[3.6,1.8,0],otherSide:[-3.6,1.8,0],back:[-2.6,1.9,3.3],otherBack:[2.6,1.9,3.3] };
  const titles={front:'斜め前',side:'横',otherSide:'反対の横',back:'斜め後',otherBack:'反対の斜め後'};
  const weapon=(id,kind)=>makeWeapon(id,kind,0,{power:0,reload:0,range:0,rate:0},true,0);
  for (const kind of kinds) {
    const actor = new StandardTrooper(assets);
    const p=addPlayer(createWorld('weapon-matrix-'+kind),'review');
    scene.add(actor.model);
    const target=weapon('target-'+kind,kind), spare=weapon('spare-'+kind,'rifle');
    await loadProgressionWeapons([target,spare]);
    const source=progressionWeaponModel(target);
    if (!source) throw Error('製品武器ローダーが対象を返しません: '+kind);
    const pristine=weaponBore(source);
    const row=document.createElement('section'); row.style.cssText='display:grid;grid-template-columns:repeat(5,'+width+'px);gap:3px;margin:12px 0';
    const name=document.createElement('div'); name.style.cssText='grid-column:1 / -1;font-weight:bold;font-size:16px'; name.textContent=kind+' / '+poseOf(kind); row.append(name); document.querySelector('#matrix').append(row);
    const captures=[];
    const sample=(state,view,mark) => {
      actor.model.updateMatrixWorld(true);
      camera.position.set(...points[view]); camera.lookAt(0,close ? 1.18 : 1.05,close ? -.08 : 0);
      marker.visible=line.visible=mark;
      if (mark) {
        const position=actor.muzzle(), direction=actor.barrel();
        if (!position || !direction) throw Error('銃口が取得できません: '+kind);
        marker.position.copy(position);
        line.geometry.setFromPoints([position,position.clone().addScaledVector(direction,.28)]);
      }
      renderer.render(scene,camera);
      const cell=document.createElement('div'); const label=document.createElement('div');
      label.textContent=state+' / '+titles[view]; const img=document.createElement('img'); img.src=renderer.domElement.toDataURL();
      cell.append(label,img); row.append(cell);
      const left=actor.model.getObjectByName('Hand_L'), right=actor.model.getObjectByName('Hand_R');
      if (!left || !right) throw Error('手のボーンが見つかりません');
      captures.push({state,view,mode:actor.mode,parents:actor.weapons.map(w=>w.parent?.name),
        hands:{left:left.getWorldPosition(new T.Vector3()).toArray(),right:right.getWorldPosition(new T.Vector3()).toArray()}});
    };
    const settle=(run)=>{for(let i=0;i<4;i++) actor.update(p,0,2+i*.1,run,.1);};
    p.weapons=[target,spare]; p.slot=0; p.reload=0; p.swapCd=0;
    settle(kind+'-held');
    const held=actor.weapons[0];
    if (held.parent?.name!=='RightHandWeaponSocket') throw Error(kind+': 手持ち位置が違います');
    const actual=weaponBore(held), world=actor.muzzle(), direction=actor.barrel();
    const bore={source:{muzzle:pristine.muzzle.toArray(),forward:pristine.forward.toArray()},
      actual:{muzzle:actual.muzzle.toArray(),forward:actual.forward.toArray(),worldMuzzle:world.toArray(),worldDirection:direction.toArray()}};
    sample('手持ち','front',true); sample('手持ち','side',true);
    p.weapons=[spare,target]; p.slot=0; p.reload=0; settle(kind+'-back');
    if (actor.weapons[1].parent?.name!=='BackWeaponSocket_2') throw Error(kind+': 背負い位置が違います');
    sample('背負い','back',false); sample('背負い','side',false);
    if (diagnostic) { sample('背負い','otherBack',false); sample('背負い','otherSide',false); }
    p.weapons=[target,spare]; p.slot=0; p.ammo[0]=0;
    const duration=reloadDuration(target,p.ammo[0]);
    for(const fraction of diagnostic ? [0,.1,.2,.3,.4,.5,.6,.7,.8,.9,.99] : [.25,.5,.75]){
      p.reload=duration*(1-fraction); settle(kind+'-reload-'+fraction);
      if (!actor.mode.includes('_reload_')) throw Error(kind+': 装填動作になっていません');
      sample('装填 '+Math.round(fraction*100)+'%',diagnostic ? 'otherSide' : 'front',true);
      sample('装填 '+Math.round(fraction*100)+'%','side',true);
    }
    records.push({kind,pose:poseOf(kind),url:weaponModelUrl(kind,0),duration,bore,captures});
    scene.remove(actor.model); actor.dispose();
  }
  renderer.dispose(); renderer.forceContextLoss();
  return records;
})();`;
await fs.writeFile(`${out}/matrix-entry.js`, browserSource);
await build({ entryPoints:[`${out}/matrix-entry.js`], bundle:true, format:"esm", platform:"browser",
  define:{"import.meta.env.BASE_URL":'"/"',"import.meta.env.DEV":"false"}, outfile:`${out}/matrix-bundle.js` });
await fs.writeFile(`${out}/index.html`, '<!doctype html><html lang="ja"><meta charset="utf-8"><body><script type="module" src="./matrix-bundle.js"></script></body></html>');
const server = http.createServer(async (req,res) => {
  const pathname = new URL(req.url,"http://localhost").pathname;
  const root = path.resolve(pathname.startsWith('/assets/') ? 'public' : out);
  const requested = pathname.startsWith('/assets/') ? pathname.slice(1) : path.basename(pathname);
  const file=path.resolve(root,requested);
  if (!file.startsWith(root+path.sep)) return void res.writeHead(403).end();
  try { const data=await fs.readFile(file); res.writeHead(200,{"Content-Type":file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'}).end(data); }
  catch { res.writeHead(404).end(); }
});
let browser;
try {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
  const page=await browser.newPage({viewport:{width:close ? 2020 : 1280,height:900},serviceWorkers:'block'}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(()=>!!window.review);
  const records=await page.evaluate(()=>Promise.race([window.review,new Promise((_,reject)=>setTimeout(()=>reject(Error('検証が120秒で完了しません')),120000))]));
  assert.equal(records.length,selected.length);
  assert.ok(records.every(r=>r.captures.length===(diagnostic ? 28 : 10)));
  assert.deepEqual(errors,[]);
  const files=[];
  for(const record of records){
    const file=path.join('public',new URL(record.url,'http://localhost').pathname);
    const data=await fs.readFile(file);
    files.push({kind:record.kind,file,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')});
  }
  await page.screenshot({path:`${out}/trooper-matrix.png`,fullPage:true});
  await fs.writeFile(`${out}/report.json`,JSON.stringify({records,files,errors,
    limitations:['実際の射撃線・銃口エフェクト・ゲーム画面・詳細プレビュー・共有画像は本ツールでは未検証',
      '背負いのめり込みと装填中の手は画像の目視判断が必要','実スマートフォン・音・負荷は未検証']},null,2));
  console.log(JSON.stringify({image:`${out}/trooper-matrix.png`,report:`${out}/report.json`,kinds:selected,images:records.reduce((n,r)=>n+r.captures.length,0)}));
} finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }
