import {chromium} from '@playwright/test';import fs from 'node:fs';
const b=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
const page=await b.newPage({viewport:{width:1200,height:900}});await page.goto('http://127.0.0.1:5198/assets/blender/preview-enemies/index.html?enemy=foundry_zero');await page.waitForFunction(()=>window.enemyPreview?.ready);
await page.evaluate(async()=>{const T=await import('/node_modules/three/build/three.module.js');const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');const p=window.enemyPreview,old=(await new GLTFLoader().loadAsync('/dist-validation/foundry-polish/before/foundry_zero_v1.glb')).scene;p.select('compare');p.current.visible=false;old.position.x=-5.72;p.scene.add(old);window.polishOld=old;document.querySelector('footer').textContent='LEFT: enlarged + detailed legs / RIGHT: previous prototype · same camera and scale';p.setView('oblique');});
await page.screenshot({path:'dist-validation/foundry-polish/before-after.png'});
await page.evaluate(async()=>{const T=await import('/node_modules/three/build/three.module.js');const p=window.enemyPreview;p.scene.remove(window.polishOld);p.select('new');document.querySelector('nav').style.display='none';document.querySelector('footer').textContent='FOUNDRY ZERO · enlarged prototype / industrial leg detail';const camera=new T.OrthographicCamera(-3.4,3.4,2.55,-2.55,.1,100);camera.position.set(7,4.8,-9);camera.lookAt(1.8,1.45,-2.3);p.renderer.render(p.scene,camera)});
await page.screenshot({path:'dist-validation/foundry-polish/leg-detail.png'});
}finally{await b.close()}
