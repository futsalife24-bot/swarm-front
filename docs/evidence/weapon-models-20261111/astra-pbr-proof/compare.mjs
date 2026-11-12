import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
const out='dist-validation/astra-pbr-proof';
const source=`
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {previewWeapon} from './src/client/weapon-sharing.ts';
import {makeWeapon} from './src/shared/progression.ts';
import {StandardTrooper,loadStandardTrooper} from './src/client/standard-trooper.ts';
import {loadProgressionWeapons} from './src/client/progression-weapons.ts';
import {createWorld,addPlayer} from './src/shared/game.ts';
window.ready=(async()=>{
 const w=makeWeapon('review','heavy',0,{power:0,reload:0,range:0,rate:0},false,1);
 const loader=new GLTFLoader(), original=(await loader.loadAsync('/assets/weapons/unique-v1/heavy_0.glb')).scene;
 const candidate=(await loader.loadAsync('/candidate.glb')).scene;
 const materials=[];candidate.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.material))materials.push({name:m.name,map:!!m.map,normal:!!m.normalMap,roughness:!!m.roughnessMap,metalness:!!m.metalnessMap,ao:!!m.aoMap})});
 const scene=new T.Scene(), renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
 renderer.setSize(620,330);renderer.setClearColor(0x11232f);
 scene.add(new T.HemisphereLight(0xe7f4ff,0x39494e,3));const sun=new T.DirectionalLight(0xffffff,4);sun.position.set(2,4,3);scene.add(sun);
 const box=new T.Box3().setFromObject(original),center=box.getCenter(new T.Vector3());
 const camera=new T.PerspectiveCamera(35,620/330,.001,100);camera.position.copy(center).add(new T.Vector3(.43,.21,.51));camera.lookAt(center);camera.updateMatrixWorld();
 const capture=g=>{scene.add(g);renderer.render(scene,camera);const u=renderer.domElement.toDataURL();scene.remove(g);return u};
 const heroBefore=capture(original),heroAfter=capture(candidate);
 const host=document.createElement('div');host.style.width='620px';document.body.append(host);
 let dispose=await previewWeapon(host,w);const beforeCanvas=host.querySelector('canvas'),previewSize={width:beforeCanvas.width,height:beforeCanvas.height};const previewBefore=beforeCanvas.toDataURL();dispose();host.replaceChildren();
 const load=GLTFLoader.prototype.loadAsync;let intercepted=0;
 GLTFLoader.prototype.loadAsync=function(url,...args){if(String(url).includes('/unique-v1/heavy_0.glb')){intercepted++;url='/candidate.glb'}return load.call(this,url,...args)};
 dispose=await previewWeapon(host,w);const previewAfter=host.querySelector('canvas').toDataURL();dispose();host.remove();GLTFLoader.prototype.loadAsync=load;
 const other=makeWeapon('other','rifle',0,{power:0,reload:0,range:0,rate:0},false,1),assets=await loadStandardTrooper();await loadProgressionWeapons([w,other]);
 const actor=new StandardTrooper(assets),p=addPlayer(createWorld('review'),'p');p.weapons=[w,other];p.slot=0;p.hp=160;p.reload=0;p.evade=0;
 scene.add(actor.model);for(let i=0;i<30;i++)actor.update(p,0,i/60,'runtime',1/60);actor.model.updateMatrixWorld(true);
 const gun=actor.weapons[0];if(!gun?.parent)throw Error('gun missing');gun.traverse(o=>{if(o.name==='WeaponNeonCore'||o.name==='WeaponNeonHalo')o.visible=false});
 const focus=new T.Box3().setFromObject(gun).getCenter(new T.Vector3());camera.position.copy(focus).add(new T.Vector3(1,.3,-1.4));camera.lookAt(focus);camera.updateMatrixWorld();renderer.render(scene,camera);const heldBefore=renderer.domElement.toDataURL();
 const variant=candidate.clone(true);variant.position.copy(gun.position);variant.quaternion.copy(gun.quaternion);variant.scale.copy(gun.scale);gun.parent.add(variant);gun.visible=false;variant.updateWorldMatrix(true,true);renderer.render(scene,camera);const heldAfter=renderer.domElement.toDataURL();
 document.body.innerHTML='<h2>RL-9：表面の作り分け比較（隔離試作）</h2><p>左：現行 ／ 右：候補。形状・照明・カメラは各組で同じ。画像禁止条件は未適合、製品未変更。</p><main></main>';
 for(const [label,url] of [['大きな比較：現行',heroBefore],['大きな比較：候補',heroAfter],['製品の詳細プレビュー：現行（等倍）',previewBefore],['製品の詳細プレビュー：候補（等倍）',previewAfter],['兵士の局所表示：現行',heldBefore],['兵士の局所表示：候補',heldAfter]]){
 const section=document.createElement('section'),title=document.createElement('b'),im=new Image();title.textContent=label;im.src=url;section.append(title,im);document.querySelector('main').append(section)}
 const gl=renderer.getContext(),error=gl.getError();actor.dispose();renderer.dispose();renderer.forceContextLoss();
 return {materials,intercepted,previewSize,error,scope:'Product preview function and isolated StandardTrooper; not actual game input, share, phone or performance test'};
})();`;
const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'pbr-compare.js'},bundle:true,format:'esm',platform:'browser',write:false,define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'}});
const html='<html lang="ja"><meta charset="utf-8"><style>body{margin:0;padding:12px;background:#10212a;color:white;font:16px sans-serif}h2{margin:0}p{margin:8px 0}main{display:grid;grid-template-columns:620px 620px;gap:8px}section{display:flex;flex-direction:column}img{width:620px}</style><script type="module" src="/bundle.js"></script></html>';
const server=http.createServer(async(req,res)=>{
 const n=new URL(req.url,'http://localhost').pathname;
 if(n==='/')return void res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(html);
 if(n==='/bundle.js')return void res.writeHead(200,{'Content-Type':'text/javascript'}).end(bundle.outputFiles[0].contents);
 const root=path.resolve('public/assets'),file=n==='/candidate.glb'?path.resolve(out,'heavy_0.glb'):path.resolve(root,n.slice('/assets/'.length));
 if(n!=='/candidate.glb'&&(!n.startsWith('/assets/')||!file.startsWith(root+path.sep)))return void res.writeHead(404).end();
 try{res.writeHead(200,{'Content-Type':'application/octet-stream'}).end(await fs.readFile(file))}catch{res.writeHead(404).end()}
});
let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});const page=await browser.newPage({viewport:{width:1280,height:900},serviceWorkers:'block'}),errors=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push([r.url(),r.status()])});
 await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForFunction(()=>!!window.ready,null,{timeout:30000});const result=await page.evaluate(()=>window.ready);
 await page.screenshot({path:out+'/comparison.png',fullPage:true});await fs.writeFile(out+'/comparison-report.json',JSON.stringify({...result,errors,failed},null,2));
 assert.equal(result.intercepted,1);assert.equal(result.error,0);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);console.log(JSON.stringify({materials:result.materials,previewSize:result.previewSize,errors,failed}));
}finally{await browser?.close();await new Promise(r=>server.close(r))}
