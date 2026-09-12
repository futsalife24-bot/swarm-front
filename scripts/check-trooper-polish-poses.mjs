import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const b=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const p=await b.newPage();await p.goto('http://127.0.0.1:5314/assets/blender/preview-trooper/');await p.waitForFunction(()=>window.trooperQA);
 const result=await p.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{StandardTrooper}=await import('/src/client/standard-trooper.ts'),q=trooperQA,t=q.trooper,ground={};
  for(const [name,clip] of t.clips){if(name.startsWith('Upper_')||name.startsWith('Lower_'))continue;
   let min=Infinity,worst=0;
   for(let frame=0;frame<=24;frame++){t.sample(name,clip.duration*frame/24);t.model.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();const v=new T.Vector3();for(let i=0;i<o.geometry.attributes.position.count;i++){o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld);if(v.y<min){min=v.y;worst=frame/24}}}})}
   ground[name]={min,worst};
  }
  t.model.visible=false;const models=[];
  for(let i=0;i<4;i++){const c=new StandardTrooper(t.assets);c.equip([{id:'a',kind:'rifle'},{id:'b',kind:'shotgun'}],0);c.model.position.x=(i-1.5)*1.1;q.scene.add(c.model);models.push(c);}
  q.camera.position.set(3,2.4,-8);q.camera.lookAt(0,1,0);
  const elapsed=[];for(let f=0;f<24;f++){const start=performance.now();models.forEach((c,i)=>c.sample('Run',((f/24+i/4)%1)*c.clips.get('Run').duration));q.renderer.render(q.scene,q.camera);q.renderer.getContext().finish();elapsed.push(performance.now()-start)}
  return {ground,drawCalls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles,fourIndependentSkeletons:new Set(models.map(c=>c.bones[0])).size===4,meanFrameMs:elapsed.slice(4).reduce((a,b)=>a+b)/20};
 });
 writeFileSync('dist-validation/trooper-polish/poses-and-four-players.json',JSON.stringify(result,null,2));console.log(result);
 assert.ok(Object.values(result.ground).every(s=>s.min>-.012),'ground safety across all clips');assert.ok(result.fourIndependentSkeletons);assert.ok(result.drawCalls<70,'four-player draw budget');
}finally{await b.close()}
