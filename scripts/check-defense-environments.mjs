import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const out = "dist-validation/defense-environments";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=d3d11"] });
try {
  const p = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = []; p.on("pageerror", e => errors.push(e.message));
  await p.goto("http://127.0.0.1:5197");
  await p.waitForFunction(() => !!window.__playtest);
  await p.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js");
    const { DefenseVisual } = await import("/src/client/defense-visual.ts");
    const { defenseYard } = await import("/src/client/defense-yard.ts");
    const { DEFENSE_MAPS } = await import("/src/shared/stages.ts");
    const canvas = document.createElement("canvas"); canvas.id = "defense-fixture";
    Object.assign(canvas.style, { position: "fixed", inset: "0", zIndex: "999999", width: "100%", height: "100%" }); document.body.append(canvas);
    const renderer = new T.WebGLRenderer({ canvas }); renderer.setSize(844, 390);
    window.renderDefenseFixture = (index, hp) => {
      const map = DEFENSE_MAPS[index], scene = new T.Scene(); scene.background = new T.Color(map.sky);
      scene.add(new T.HemisphereLight(0xffffff, 0x334444, 3));
      const camera = new T.PerspectiveCamera(55, 844/390, 0.1, 200); camera.position.set(5, 3, 7); camera.lookAt(0, 0.7, 0);
      const floor = new T.Mesh(new T.PlaneGeometry(110,110), new T.MeshStandardMaterial({color:map.ground})); floor.rotation.x=-Math.PI/2; scene.add(floor);
      const yard = new T.Group(); defenseYard(yard,map); scene.add(yard);
      for(const b of map.blocks){const box=new T.Mesh(new T.BoxGeometry(b.w,b.h,b.d),new T.MeshStandardMaterial({color:map.color}));box.position.set(b.x,b.h/2,b.z);scene.add(box);}
      const visual = new DefenseVisual(scene);
      visual.update({run:"visual-fixture",phase:"battle",defense:{armory:{x:0,z:0,hp},maxHp:2000}},0.05);
      renderer.render(scene,camera);
      return {level:visual.group.userData.damageLevel,biome:map.biome};
    };
  });
  const results=[];
  for(let index=0;index<6;index++){
    const hp=[2000,1400,1000,600,200,0][index];
    const result=await p.evaluate(({index,hp})=>window.renderDefenseFixture(index,hp),{index,hp});
    assert.equal(result.level,[5,4,3,2,1,0][index]); results.push(result);
    await p.screenshot({path:`${out}/environment-${index}-level-${result.level}.png`});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(out+"/checks.json",JSON.stringify({pass:true,results,errors},null,2));console.log("SIX ENVIRONMENTS / SIX DAMAGE STATES PASS");
} finally {await browser.close();}
