import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out='dist-validation/leaper-report';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5209/');
 const initial='rest camera preserved (no fit/reset in play)';
 if(!process.env.LEAPER_NUMERIC_ONLY){
 await page.clock.install();
 await page.locator('#open-bestiary').click();await page.locator('[data-enemy="spider"]').click();
 await page.waitForFunction(()=>document.querySelector('.enemy-viewport').dataset.asset==='ready',null,{timeout:120000});
 await page.clock.pauseAt(new Date(Date.now()+1000));
 for(const mode of ['attack','move','idle']){
  await page.locator(`button[data-motion="${mode}"]`).click();
  assert.equal(await page.locator('.enemy-viewport').getAttribute('data-motion'),mode);
 }
 for(const [label,t] of [['rest',0],['crouch',.4],['air',.825],['landing',1.4],['recovered',1.9]]){
  await page.locator('button[data-motion="move"]').click();
  await page.clock.runFor(Math.round(t*1000)+17);
  await page.locator('.enemy-viewport').screenshot({path:`${out}/${label}.png`});
 }
 }
 const legs=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {loadEnemyMotion}=await import('/src/client/hound-motion.ts');
  const a=await loadEnemyMotion('leaper',true),m=new T.AnimationMixer(a.model);
  m.clipAction(a.clips.find(c=>c.name==='Locomotion')).play();
  const points=t=>{m.setTime(t);a.model.updateMatrixWorld(true);return a.meshes[0].skeleton.bones.filter(b=>b.name.endsWith('_upper')||b.name.endsWith('_toe')).map(b=>({name:b.name,p:b.getWorldPosition(new T.Vector3()).toArray()}))};
  const rest=points(0),fold=points(.4);
  const toes=rest.filter(b=>b.name.endsWith('_toe'));
  for(let frame=0;frame<=120;frame++){
   const t=frame/60,ps=points(t);
   for(const toe of toes){
    const p=ps.find(b=>b.name===toe.name).p;
    if(t<=.55||t>=1.25){if(new T.Vector3(...p).distanceTo(new T.Vector3(...toe.p))>1e-4)throw Error('Planted toe slipped: '+toe.name)}
   }
   for(const mesh of a.meshes){
    mesh.skeleton.update();
    for(let i=0;i<mesh.geometry.attributes.position.count;i++){
     const p=new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i);mesh.applyBoneTransform(i,p);p.applyMatrix4(mesh.matrixWorld);
     if(!Number.isFinite(p.lengthSq())||p.y<-.04)throw Error('Invalid skinned vertex '+t+' '+p.y);
    }
   }
  }
  const end=points(2);for(let i=0;i<rest.length;i++)if(new T.Vector3(...rest[i].p).distanceTo(new T.Vector3(...end[i].p))>1e-4)throw Error('Loop seam');
  m.stopAllAction();
  return rest.filter(b=>b.name.endsWith('_upper')).map(b=>{const toe=b.name.replace('_upper','_toe'),distance=(ps)=>new T.Vector3(...ps.find(x=>x.name===b.name).p).distanceTo(new T.Vector3(...ps.find(x=>x.name===toe).p));return {name:b.name,rest:distance(rest),fold:distance(fold)}});
 });
 assert.equal(legs.length,5);for(const leg of legs)assert.ok(leg.fold<leg.rest-.04,JSON.stringify(leg));
 assert.deepEqual(errors,[]);writeFileSync(`${out}/checks.json`,JSON.stringify({pass:true,camera:initial,legs,errors},null,2));
 console.log(JSON.stringify({pass:true,legs}));
}finally{await browser.close()}



