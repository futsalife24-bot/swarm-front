import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out='dist-work/run-transfer-20260913';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:820}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5340/scripts/run-transfer-review.html');await page.waitForFunction(()=>window.ready,null,{timeout:120000});
 const results=await page.evaluate(async()=>{
  review.freeze();const T=await import('/node_modules/three/build/three.module.js'),gaits=[],transitions=[];
  for(const key of ['current','jog','sprint']){
   review.reset(key);const t=review.models()[1];t.model.position.set(0,0,0);const verts=[];
   t.model.traverse(o=>{if(!o.isSkinnedMesh)return;const ix=o.geometry.attributes.skinIndex,w=o.geometry.attributes.skinWeight;for(let j=0;j<ix.count;j++)for(let k=0;k<4;k++)if(w.getComponent(j,k)>.5&&/^(Foot|Toe)_/.test(o.skeleton.bones[ix.getComponent(j,k)].name)){verts.push([o,j,o.skeleton.bones[ix.getComponent(j,k)].name.slice(-1)]);break}});
   const duration=t.clips.get('Lower_Run').duration,stride=review.trials[key]?.stride??2.6,seq=[];
   for(let f=0;f<=120;f++){
    t.sample('Upper_Run',duration*f/120,'Lower_Run',duration*f/120);const sole={L:Infinity,R:Infinity},v=new T.Vector3();t.model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update()});
    for(const [o,j,s]of verts){o.getVertexPosition(j,v).applyMatrix4(o.matrixWorld);sole[s]=Math.min(sole[s],v.y)}
    seq.push({sole,feet:['L','R'].map(s=>t.model.getObjectByName('Foot_'+s).getWorldPosition(new T.Vector3()).toArray()),pelvis:t.model.getObjectByName('Pelvis').getWorldPosition(new T.Vector3()).toArray()});
   }
   const slips=[];for(let f=1;f<120;f++)for(let s=0;s<2;s++){const side=s?'R':'L';if(seq[f].sole[side]<.02&&seq[f-1].sole[side]<.02){slips.push(Math.abs(seq[f].feet[s][2]-seq[f-1].feet[s][2]-stride/120)/(stride/120))}}
   gaits.push({key,stride,minSole:Math.min(...seq.flatMap(s=>Object.values(s.sole))),maxSole:Math.max(...seq.flatMap(s=>Object.values(s.sole))),loopFootError:Math.max(...seq[0].feet.flatMap((p,i)=>p.map((v,j)=>Math.abs(v-seq[120].feet[i][j])))),contactSlipRatioMedian:slips.sort((a,b)=>a-b)[Math.floor(slips.length/2)],contactSlipRatioMax:Math.max(...slips),sequence:seq});
   for(const kind of ['rifle','shotgun','rocket'])for(const direction of [[0,-1],[0,1],[1,0],[-1,0],[.707,-.707]])for(const speed of [3.5,7]){
    review.reset(key,kind);const t=review.models()[1],p=review.players()[1];let time=0;const modes=new Set(),sockets=new Set();let finite=true;
    function tick(move=true){time+=1/60;if(move){p.x+=direction[0]*speed/60;p.z+=direction[1]*speed/60}t.update(p,0,time,'qa',1/60);modes.add(t.mode);t.weapons.forEach(w=>sockets.add(w.parent.name));finite&&=t.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))}
    for(let j=0;j<3;j++){for(let f=0;f<25;f++)tick();for(let f=0;f<16;f++)tick(false)}
    p.pitch=.45;p.cool=.2;tick();p.cool=0;p.reload=.5;for(let f=0;f<15;f++)tick();p.reload=0;
    p.slot=1;p.swapCd=.5;for(let f=0;f<31;f++){p.swapCd=Math.max(0,.5-f/60);tick()}p.swapCd=0;p.cool=.3;tick();
    p.evade=.18;for(let f=0;f<12;f++){p.evade=Math.max(0,.18-f/60);tick()}p.evade=0;p.heavyHit=.2;p.hp-=10;for(let f=0;f<20;f++){p.heavyHit=Math.max(0,.2-f/60);tick()}p.heavyHit=0;for(let f=0;f<20;f++)tick(false);
    transitions.push({key,kind,direction,speed,finite,modes:[...modes],sockets:[...sockets],finalMode:t.mode,trial:t.model.userData.runTrial??'current'});
   }
  }
  return {gaits,transitions};
 });
 writeFileSync(out+'/gait-runtime-qa.json',JSON.stringify({...results,errors},null,2));assert.deepEqual(errors,[]);assert.ok(results.transitions.every(x=>x.finite));assert.ok(results.gaits.every(x=>x.loopFootError<.001&&x.minSole>-.008));
 for(const key of ['jog','sprint'])for(const view of ['side','back','game']){await page.evaluate(({key,view})=>{review.reset(key);for(let f=0;f<45;f++)review.tick();review.draw(view)},{key,view});await page.screenshot({path:`${out}/${key}-${view}-qa.png`})}
 console.log(JSON.stringify({gaits:results.gaits.map(({sequence,...r})=>r),transitionCases:results.transitions.length,errors},null,2));
}finally{await browser.close()}
