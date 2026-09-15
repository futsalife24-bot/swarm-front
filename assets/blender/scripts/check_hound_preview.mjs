// From repo: node assets/blender/scripts/check_hound_preview.mjs [http://127.0.0.1:5186]
import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out='dist-validation/hound-v1';mkdirSync(out,{recursive:true});
const bytes=readFileSync('public/assets/enemies/hound_blockout_v1.glb');
assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
assert.equal(gltf.materials.length,3);assert.equal(gltf.meshes.length,10);
assert.equal(gltf.textures?.length??0,0);assert.equal(gltf.cameras?.length??0,0);
assert.equal(gltf.nodes.length,11);assert.equal(gltf.animations?.length??0,0);
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1000,height:720},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(`${process.argv[2]??'http://127.0.0.1:5186'}/assets/blender/preview/index.html`);
 await page.waitForFunction(()=>window.houndPreview?.ready);
 const stats=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');const p=window.houndPreview;const b=new T.Box3().setFromObject(p.model);let triangles=0,meshes=0;const legs=[];
  p.model.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;if(o.name.includes('_leg_'))legs.push({name:o.name,ground:new T.Box3().setFromObject(o).min.y});}});
  const cb=new T.Box3().setFromObject(p.current);
  return{bounds:{min:b.min.toArray(),max:b.max.toArray()},currentBounds:{min:cb.min.toArray(),max:cb.max.toArray()},triangles,meshes,legs,ring:p.model.getObjectByName('shoulder_ring').material.name,drawCalls:p.renderer.info.render.calls};
 });
 assert.equal(stats.triangles,1532);assert.equal(stats.meshes,10);assert.equal(stats.legs.length,5);assert.ok(Math.abs(stats.bounds.min[1])<1e-5);
 for(const l of stats.legs)assert.ok(Math.abs(l.ground)<1e-5);
 assert.equal(stats.ring,'HOUND_ring_emission');
 const capture=async(name,model,view,mono=false)=>{await page.evaluate(({model,view,mono})=>{const p=window.houndPreview;p.select(model);p.setView(view);p.mono(mono)}, {model,view,mono});await page.screenshot({path:`${out}/${name}.png`});};
 await capture('current-hound','current','oblique');
 for(const view of ['front','side','oblique','gameview'])await capture(`blender-hound-${view}`,'new',view);
 for(const model of ['current','new'])await capture(`${model}-hound-silhouette`,model,'oblique',true);
 await page.evaluate(()=>{window.houndPreview.mono(false);window.houndPreview.cue(true)});
 await page.screenshot({path:`${out}/blender-hound-ring-cue.png`});
 await page.evaluate(()=>window.houndPreview.cue(false));
 await page.setViewportSize({width:844,height:390});
 await capture('blender-hound-mobile','new','gameview');
 await capture('current-hound-mobile','current','gameview');
 assert.deepEqual(errors,[]);writeFileSync(`${out}/three-validation.json`,JSON.stringify({...stats,errors,renderer:'Chrome SwiftShader; visual/structural QA, not mobile GPU benchmark'},null,2));
 console.log(JSON.stringify(stats,null,2));
}finally{await browser.close()}
