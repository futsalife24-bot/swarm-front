import { build } from "esbuild";
import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

// 描画部品の負荷試験。敵AI・通信・実機の性能を測ったものではない。
const out = "dist-validation/play-polish-20261022/effects";
fs.mkdirSync(out, { recursive: true });
const label = process.argv[2] ?? "after";
assert.match(label, /^(before|after)$/);
const baseline = "a3d8f076935620b2c264825bb3b849c544e2842f";
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
    import * as T from 'three';
    import { CombatEffects } from './src/client/combat-effects';
    window.runEffects = async () => {
      const renderer = new T.WebGLRenderer({canvas:document.querySelector('canvas')});
      renderer.setSize(844,390);
      const scene = new T.Scene(), camera = new T.PerspectiveCamera(60,844/390,.1,200);
      camera.position.set(0,20,35); camera.lookAt(0,0,0);
      const geometry = new T.IcosahedronGeometry(.6), material = new T.MeshBasicMaterial({color:0x445566});
      for(let i=0;i<97;i++){const m=new T.Mesh(geometry,material);m.position.set((i%12)*2-12,0,Math.floor(i/12)*2-8);scene.add(m);}
      const fx = new CombatEffects(scene), frames=[], cpu=[], heaps=[];
      let replaced=0, previous=performance.now();
      for(let frame=0;frame<720;frame++){
        await new Promise(requestAnimationFrame);
        const now=performance.now(); if(frame>=120)frames.push(now-previous); previous=now;
        const began=performance.now();
        for(let i=0;i<12;i++)fx.add(i%2?'spark':'bullet',(i%6)*3-8,1,(frame%12)-6,.3,.25,0xff9944,new T.Vector3(0,0,-2));
        const original=fx.items;fx.update(1/60,camera); if(original!==fx.items)replaced++;
        renderer.render(scene,camera); if(frame>=120)cpu.push(performance.now()-began);
        if(frame%120===0)heaps.push(performance.memory?.usedJSHeapSize??null);
      }
      const percentile=(xs,p)=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length*p)];
      const result={frames:frames.length,frameP50:percentile(frames,.5),frameP95:percentile(frames,.95),stallsOver50ms:frames.filter(x=>x>50).length,maxFrame:Math.max(...frames),cpuP50:percentile(cpu,.5),cpuP95:percentile(cpu,.95),heaps,arrayReplacements:replaced,active:fx.items.length,drawCalls:renderer.info.render.calls,geometries:renderer.info.memory.geometries};
      fx.clear(); renderer.dispose();geometry.dispose();material.dispose(); return result;
    };`,
  },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  plugins:
    label === "before"
      ? [
          {
            name: "修正前の演出処理",
            setup(b) {
              b.onLoad({ filter: /combat-effects\.ts$/ }, () => ({
                contents: execFileSync(
                  "git",
                  ["show", `${baseline}:src/client/combat-effects.ts`],
                  { encoding: "utf8" },
                ),
                loader: "ts",
                resolveDir: path.resolve("src/client"),
              }));
            },
          },
        ]
      : [],
});
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  await page.setContent("<canvas></canvas>");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = {
    label,
    browser: browser.version(),
    platform: process.platform,
    renderer: "SwiftShader",
    viewport: [844, 390],
    fixedDt: 1 / 60,
    warmup: 120,
    samples: 600,
    enemyRepresentations: 97,
    effectsPerFrame: 12,
    measurements: [],
  };
  for (let trial = 0; trial < 3; trial++)
    result.measurements.push(await page.evaluate(() => runEffects()));
  await page.screenshot({ path: out + "/" + label + ".png" });
  fs.writeFileSync(
    out + "/" + label + ".json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
