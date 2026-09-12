import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({channel:'chrome'});
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5321');
  const result = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const { MapAssets } = await import('/src/client/map-assets.ts');
    const scene = new T.Scene(), assets = new MapAssets(scene);
    const check = (value, message) => { if(!value) throw Error(message); };
    assets.select(0, true);
    assets.select(5, false);
    const deadline = Date.now()+30000;
    while(assets.distantStatus[0].state==='loading' && Date.now()<deadline)
      await new Promise(r=>setTimeout(r,50));
    check(assets.distantStatus[0].state==='ready','GLB failed to parse');
    check(assets.distantGroups.every(g=>!g.visible),'Late load appeared in cave');
    check(assets.distantStatus[5].state==='idle','Cave requested distant GLB');
    assets.select(0,false,false);
    check(!assets.distantGroups[0].visible,'Weather hide failed');
    assets.select(0,false,true);
    check(assets.distantGroups[0].visible,'Restore failed');
    let meshes=0;
    assets.distantGroups[0].traverse(o=>{
      if(!o.isMesh)return;
      meshes++;
      check(!o.castShadow&&!o.receiveShadow,'Distant shadows enabled');
      const hits=[];o.raycast({},hits);check(hits.length===0,'Distant mesh has hit tests');
    });
    check(meshes===7,'Missing city scenery meshes');
    return {lateLoadHidden:true,caveExcluded:true,hideRestore:true,noRaycast:true,noShadows:true,meshes};
  });
  writeFileSync('dist-validation/distant-scenery/lifecycle.json',JSON.stringify(result,null,2));
  console.log(result);
} finally { await browser.close(); }
