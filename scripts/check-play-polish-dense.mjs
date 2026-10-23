import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import path from "node:path";
import fs from "node:fs";

// 実Rendererと実敵モデルの固定密集状態を比較。AI/通信は計測対象外。
const options = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")),
);
const gpu = options.gpu ?? "swiftshader";
if (!["swiftshader", "native"].includes(gpu))
  throw new Error("gpuはswiftshaderまたはnativeです");
const integer = (name, fallback, min) => {
  const value = Number(options[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < min)
    throw new Error(`${name}の値が不正です`);
  return value;
};
const warmup = integer("warmup", 180, 0);
const samples = integer("samples", 360, 1);
const timeout = integer("timeout", 180000, 1000);
const out = options.out ?? "dist-validation/play-polish-20261023/dense-" + gpu;
fs.mkdirSync(out, { recursive: true });
const before = execFileSync(
  "git",
  [
    "show",
    "a3d8f076935620b2c264825bb3b849c544e2842f:src/client/combat-effects.ts",
  ],
  { encoding: "utf8" },
);
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
    import * as T from 'three';
    import {Renderer} from './src/client/render';
    import {CombatEffects as Before} from 'before-effects';
    import {CombatEffects as After} from './src/client/combat-effects';
    import {createFrontRun} from './src/shared/front-run';
    import {spawn} from './src/shared/game';
    window.measure = async ({label,warmup,samples,draw}) => {
      let randomSeed=4520;
      Math.random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;};
      const started=performance.now();
      const longTasks=[];
      let sampleStarted=Infinity;
      const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())if(entry.startTime>=sampleStarted)longTasks.push(entry.duration);});
      observer.observe({entryTypes:['longtask']});
      let pendingAssets=0;
      const assetErrors=[];
      T.DefaultLoadingManager.onStart=(_url,loaded,total)=>{pendingAssets=total-loaded;};
      T.DefaultLoadingManager.onProgress=(_url,loaded,total)=>{pendingAssets=total-loaded;};
      T.DefaultLoadingManager.onError=url=>assetErrors.push(url);
      console.log('dense:'+JSON.stringify({stage:'construct',hidden:document.hidden}));
      const view=new Renderer(document.querySelector('canvas'),120);
      view.quality=1;view.mapAssets.setQuality(1);view.resize();
      const world=createFrontRun({runId:'dense-fixed',seed:4520,players:[{id:'p0'}]},0).world;
      world.phase='battle';world.enemies=[];world.events=[];
      const p=world.players[0];Object.assign(p,{x:0,y:0,z:20});
      for(let i=0;i<97;i++){const e=spawn(world,'crawler',(i%12)*2-12,Math.floor(i/12)*2-15);if(!e)throw Error('敵数不足');e.active=true;}
      view.combat.clear();view.combat=new (label==='before'?Before:After)(view.scene);
      const gl=view.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
      const renderer=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null;
      console.log('dense:'+JSON.stringify({stage:'ready',renderer,enemies:world.enemies.length,elapsed:performance.now()-started}));
      const frames=[],cpu=[];let previous=performance.now(),replaced=0;
      for(let frame=0;frame<warmup+samples;frame++){
        await new Promise(requestAnimationFrame);
        if(frame===warmup)sampleStarted=performance.now();
        const now=performance.now();if(frame>=warmup)frames.push(now-previous);previous=now;
        const begin=performance.now();world.time=frame/60;
        for(let i=0;i<12;i++)view.combat.add(i%2?'spark':'bullet',(i%6)*3-8,1,(frame%12)-6,.3,.25,0xff9944,new T.Vector3(0,0,-2));
        const list=view.combat.items;view.render(world,'p0',1/60,0,-.15,undefined,true,false,false,draw);
        if(list!==view.combat.items)replaced++;
        if(frame>=warmup)cpu.push(performance.now()-begin);
        if(frame%30===0)console.log('dense:'+JSON.stringify({stage:'frame',frame,elapsed:performance.now()-started,cpu:performance.now()-begin,pendingAssets,geometries:view.renderer.info.memory.geometries}));
      }
      await new Promise(requestAnimationFrame);
      for(const entry of observer.takeRecords())if(entry.startTime>=sampleStarted)longTasks.push(entry.duration);
      observer.disconnect();
      const pct=(a,p)=>[...a].sort((a,b)=>a-b)[Math.floor(a.length*p)];
      return {enemies:world.enemies.length,frames:frames.length,p50:pct(frames,.5),p95:pct(frames,.95),max:Math.max(...frames),stalls50:frames.filter(x=>x>50).length,cpuP95:pct(cpu,.95),arrayReplacements:replaced,active:view.combat.items.length,renderInfo:view.renderer.info.render,memory:view.renderer.info.memory,renderer,elapsed:performance.now()-started,hidden:document.hidden,pixelRatio:view.renderer.getPixelRatio(),longTasks,pendingAssets,assetErrors};
    };`,
  },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  outfile: "dense.js",
  define: { "import.meta.env": JSON.stringify({ DEV: false, BASE_URL: "/" }) },
  plugins: [
    {
      name: "比較前ソース",
      setup(b) {
        b.onResolve({ filter: /^before-effects$/ }, () => ({
          path: "before-effects",
          namespace: "baseline",
        }));
        b.onLoad({ filter: /.*/, namespace: "baseline" }, () => ({
          contents: before,
          loader: "ts",
          resolveDir: path.resolve("src/client"),
        }));
      },
    },
  ],
});
const root = path.resolve("public");
const server = createServer((req, res) => {
  if (req.url === "/") {
    res.setHeader("content-type", "text/html");
    res.end(
      '<style>body{margin:0}canvas{display:block}</style><canvas></canvas><div id="damage"></div>',
    );
    return;
  }
  const file = path.resolve(
    root,
    "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
  );
  if (
    !file.startsWith(root + path.sep) ||
    !fs.existsSync(file) ||
    !fs.statSync(file).isFile()
  ) {
    res.statusCode = 404;
    res.end();
    return;
  }
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({
  channel: "chrome",
  args: [
    ...(gpu === "swiftshader"
      ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
      : []),
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
  ],
});
const results = {
  passed: false,
  browser: browser.version(),
  head: "a3d8f076935620b2c264825bb3b849c544e2842f",
  seed: 4520,
  viewport: [844, 390],
  gpu,
  draw: options.draw !== "false",
  warmup,
  samples,
  trials: [],
  errors: [],
  progress: [],
};
try {
  for (const label of ["before", "after", "after", "before"]) {
    console.log(`密集計測開始: ${label} ${results.trials.length + 1}/4`);
    const page = await browser.newPage({
      viewport: { width: 844, height: 390 },
      serviceWorkers: "block",
    });
    page.setDefaultTimeout(30000);
    console.log("描画ページ作成");
    page.on("pageerror", (e) => results.errors.push(e.message));
    page.on("console", (message) => {
      if (!message.text().startsWith("dense:")) return;
      const progress = {
        label,
        trial: results.trials.length,
        ...JSON.parse(message.text().slice(6)),
      };
      results.progress.push(progress);
      console.log(JSON.stringify(progress));
      fs.writeFileSync(
        out + "/progress.json",
        JSON.stringify(results.progress, null, 2),
      );
    });
    await page.goto("http://127.0.0.1:" + server.address().port);
    console.log("ローカルページ読込");
    await page.addScriptTag({
      content: bundle.outputFiles.find((f) => f.path.endsWith(".js")).text,
    });
    console.log("描画モジュール読込");
    const css = bundle.outputFiles.find((f) => f.path.endsWith(".css"));
    if (css) await page.addStyleTag({ content: css.text });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    const initialMetrics = await cdp.send("Performance.getMetrics");
    console.log("固定フレーム計測");
    let timer;
    const value = await Promise.race([
      page.evaluate((settings) => measure(settings), {
        label,
        warmup,
        samples,
        draw: results.draw,
      }),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(new Error(`密集計測が${timeout}ms以内に完了しませんでした`)),
          timeout,
        );
        timer.unref();
      }),
    ]).finally(() => clearTimeout(timer));
    const metrics = await cdp.send("Performance.getMetrics");
    await page.screenshot({
      path: out + "/" + label + "-" + results.trials.length + ".png",
    });
    results.trials.push({
      label,
      ...value,
      heapBytes: metrics.metrics.find((x) => x.name === "JSHeapUsedSize")
        ?.value,
      heapBeforeBytes: initialMetrics.metrics.find(
        (x) => x.name === "JSHeapUsedSize",
      )?.value,
    });
    await page.close();
  }
  if (results.errors.length) throw new Error(results.errors.join("\n"));
  results.passed = true;
} catch (error) {
  results.failure = String(error.stack ?? error);
  throw error;
} finally {
  fs.writeFileSync(out + "/results.json", JSON.stringify(results, null, 2));
  await browser.close();
  await new Promise((r) => server.close(r));
}
console.log(JSON.stringify(results));
