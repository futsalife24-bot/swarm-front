import {chromium} from '@playwright/test';import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const page=await browser.newPage();await page.goto('http://127.0.0.1:5314/assets/blender/preview-trooper/');await page.waitForFunction(()=>window.trooperQA);
const results=await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js');const {trooper:t}=trooperQA;const result={};
 for(const clip of ['Weapon_Idle_Rifle','Run','Fire_Shotgun','Fire_Rocket','Dodge_Roll','Hit_Heavy','Switch_1_to_2','Switch_2_to_1']){
  trooperQA.weapon(clip.endsWith('Rocket')?'rocket':clip.endsWith('Shotgun')?'shotgun':'rifle');
  const duration=t.clips.get(clip).duration;let min=Infinity;let worst=0;let minWeapon=Infinity;
  for(let f=0;f<=30;f++){
   trooperQA.set(clip,duration*f/30);t.model.updateMatrixWorld(true);
   t.model.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();const v=new T.Vector3();for(let i=0;i<o.geometry.attributes.position.count;i++){o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld);if(v.y<min){min=v.y;worst=duration*f/30}}}});
   for(const w of t.weapons){const b=new T.Box3().setFromObject(w,true);minWeapon=Math.min(minWeapon,b.min.y)}
  }
  result[clip]={minGround:min,worstTime:worst,minWeaponGround:minWeapon};
 }
 return result;
});writeFileSync('dist-validation/standard-trooper/ground-validation.json',JSON.stringify(results,null,2));console.log(results);
}finally{await browser.close()}
