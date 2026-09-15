import {chromium} from '@playwright/test';
import fs from 'node:fs';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
const page=await browser.newPage({viewport:{width:1200,height:460},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto('http://127.0.0.1:5347/?playtest=1');await page.waitForFunction(()=>window.__playtest);
 const data=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{StandardTrooper,loadStandardTrooper}=await import('/src/client/standard-trooper.ts'),{loadProgressionWeapons}=await import('/src/client/progression-weapons.ts'),{makeWeapon}=await import('/src/shared/progression.ts'),{createWorld,addPlayer}=await import('/src/shared/game.ts');
  const assets=await loadStandardTrooper(),v=new StandardTrooper(assets),p=addPlayer(createWorld('pose'),'pose');
  const samples=[];
  for(const duration of [1,.35,.5]){
   p.slot=0;p.swapCd=0;p.swapDuration=duration===.5?undefined:duration;v.update(p,0,0,`motion-${duration}`,0);
   p.slot=1;
   for(const progress of [0,.4,.65]){p.swapCd=duration*(1-progress);v.update(p,0,0,`motion-${duration}`,0);samples.push({duration,progress,clipProgress:v.switchTime/.5,oldOnHand:v.weapons[0].parent===v.hand,newOnHand:v.weapons[1].parent===v.hand});}
  }
  const scene=new T.Scene();scene.add(v.model,new T.HemisphereLight(0xffffff,0x526070,3));const light=new T.DirectionalLight(0xffffff,3);light.position.set(3,4,3);scene.add(light);
  const camera=new T.PerspectiveCamera(35,220/350,.01,100);camera.position.set(3,1.9,3.6);camera.lookAt(0,1,0);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(220,350);renderer.setClearColor(0x12232d);
  document.querySelector('#ui').innerHTML='<div id="poses" style="position:absolute;inset:0;display:flex;gap:10px;background:#12232d;padding:10px"></div>';
  const attached=[];p.slot=0;p.swapCd=0;
  for(const kind of ['rifle','shotgun','rocket'])for(let grade=0;grade<5;grade++){
   const weapon=makeWeapon(`pose-${kind}-${grade}`,kind,grade,{power:0,reload:0,range:0,rate:0},true,0);await loadProgressionWeapons([weapon]);p.weapons[0]=weapon;v.update(p,0,0,`pose-${kind}-${grade}`,0);
   let modules=0;v.weapons[0].traverse(o=>{if(o.name.includes('_realism_v2'))modules++;});attached.push({kind,grade,modules,parent:v.weapons[0].parent.name});
   if(grade===0){renderer.render(scene,camera);const host=document.createElement('div');host.innerHTML=`<b>${kind} ${['N','R','SR','SSR','LR'][grade]}</b><img style="display:block" src="${renderer.domElement.toDataURL()}">`;document.querySelector('#poses').append(host);}
  }
  v.dispose();renderer.dispose();renderer.forceContextLoss();return {samples,attached};
 });
 assert.ok(data.samples.every(s=>Math.abs(s.clipProgress-s.progress)<.0001));
 assert.ok(data.samples.every(s=>s.oldOnHand===(s.progress<.45)&&s.newOnHand===(s.progress>=.6)));
 assert.ok(data.attached.every(s=>s.modules>=1&&s.parent==='RightHandWeaponSocket'));
 await page.screenshot({path:'dist-validation/weapon-realism/held.png'});assert.deepEqual(errors,[]);
 fs.writeFileSync('dist-validation/weapon-realism/motion.json',JSON.stringify({...data,errors},null,2));console.log('PASS normalized Lv0/Lv5/legacy motion, 15 held models');
}finally{await browser.close();}


