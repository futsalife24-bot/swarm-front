import { createServer } from "node:http";
import { build } from "esbuild";
import path from "node:path";
import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const options = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")),
);
if (options.candidate)
  throw new Error("立体目印は本体へ実装済みです。候補の重複追加はできません。");
const out =
  options.out ?? "dist-validation/play-polish-20261026/harrow-beacon-product";
console.log("HARROW検証: サーバー準備");
fs.mkdirSync(out, { recursive: true });
const sources = [
  "scripts/harrow-preview.ts",
  "src/shared/harrow.ts",
  "src/shared/harrow-motion.ts",
  "src/client/harrow-effects.ts",
  "src/client/harrow-warning-beacons.ts",
  "src/client/harrow-spin-effects.ts",
  "src/client/render.ts",
];
const results = {
  captured: false,
  visualReview: "未実施",
  errors: [],
  views: [],
  sources: sources.map((path) => ({
    path,
    sha256: createHash("sha256").update(fs.readFileSync(path)).digest("hex"),
  })),
};
// 既存プレビューに検証専用の固定時刻・視点を注入し、配布ソースを変更しない。
const probe = `
let candidateObjects=[];
window.polishMatrix = {
  get assets(){return {pending:matrixPending,errors:matrixAssetErrors};},
  capture(modeName, target, view) {
    for(const object of candidateObjects){renderer.scene.remove(object);object.geometry.dispose();object.material.dispose();}
    candidateObjects=[];
    renderer.visual.clear();
    reset(modeName); paused = true; overview = false; groundCamera = true;
    w.run = 'harrow-matrix-4520';
    while(w.time < target - 1e-9) {
      const dt = Math.min(0.025, target - w.time);
      step(w, {viewer: neutral()}, dt); draw(dt);
    }
    if(view === 'dense' || view === 'wall') {
      for(let i=0;i<39;i++) {
        const e=spawn(w,'ant', (i%8-3.5)*2.3, 8+Math.floor(i/8)*2.3);
        if(e) {
          // spawnの障害物回避で遠方へ移った個体を密集と数えない。静止遮蔽fixtureを明示配置する。
          e.x=(i%8-3.5)*2.3; e.z=w.players[0].z-4-Math.floor(i/8)*2.3;
          e.y=groundHeight(e.x,e.z,mapFor(w).blocks); e.active=true; e.cool=999;
        }
      }
    }
    // dt=0は製品FramePacerが描画を省く。世界時刻を動かさず1描画枠を渡す。
    draw(1/60);
    if(view==='wall') {
      const wall=new T.Mesh(new T.BoxGeometry(80,24,1),new T.MeshBasicMaterial({color:0x475569}));
      wall.position.set(0,12,w.players[0].z-2);renderer.scene.add(wall);candidateObjects.push(wall);
    }
    renderer.renderer.render(renderer.scene,renderer.camera);
    if(view === 'edge') {
      renderer.camera.rotateY(0.5);
      renderer.renderer.render(renderer.scene,renderer.camera);
    }
    const beacons=renderer.scene.getObjectByName('harrow-warning-beacons');
    const withBeacons=renderer.renderer.info.render.calls;
    const beaconVisible=beacons.visible;
    beacons.visible=false;renderer.renderer.render(renderer.scene,renderer.camera);
    const withoutBeacons=renderer.renderer.info.render.calls;
    beacons.visible=beaconVisible;renderer.renderer.render(renderer.scene,renderer.camera);
    const gl=renderer.renderer.getContext();
    const ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {mode:modeName,target,view,time:w.time, enemies:w.enemies.length,
      beacons:{count:beacons.count,visible:beacons.visible,depthTest:beacons.material.depthTest,withBeacons,withoutBeacons},
      denseRendered:renderer.enemies.get('ant').count,
      densePositions:w.enemies.filter(e=>e.kind==='ant').map(e=>({x:e.x,y:e.y,z:e.z,ndc:new T.Vector3(e.x,e.y+1,e.z).project(renderer.camera).toArray()})),
      attack:w.enemies.find(e=>e.kind==='harrow')?.harrow,
      missiles:w.harrowMissiles, camera:renderer.camera.position.toArray(),
      quaternion:renderer.camera.quaternion.toArray(),
      gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
      status:JSON.parse(document.querySelector('#status').textContent)};
  }
};
`;
const bundle = await build({
  stdin: {
    contents:
      `import * as T from 'three';
    let matrixPending=0; const matrixAssetErrors=[];
    T.DefaultLoadingManager.onStart=(_url,loaded,total)=>{matrixPending=total-loaded;};
    T.DefaultLoadingManager.onProgress=(_url,loaded,total)=>{matrixPending=total-loaded;};
    T.DefaultLoadingManager.onError=url=>matrixAssetErrors.push(url);
    ` +
      fs
        .readFileSync("scripts/harrow-preview.ts", "utf8")
        .replaceAll("requestAnimationFrame(frame);", "")
        .replace("1, 20);", "4520, 20);") +
      probe,
    resolveDir: path.resolve("scripts"),
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  outfile: "harrow.js",
  define: { "import.meta.env.BASE_URL": '"/"', "import.meta.env.DEV": "true" },
});
const root = path.resolve("public");
const server = createServer((req, res) => {
  if (req.url === "/") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      fs
        .readFileSync("scripts/harrow-preview.html", "utf8")
        .replace(/<script[\s\S]*?<\/script>/g, ""),
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
    res.writeHead(404);
    res.end();
    return;
  }
  res.end(fs.readFileSync(file));
});
let browser;
try {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  console.log("HARROW検証: ブラウザ起動");
  browser = await chromium.launch({ channel: "chrome" });
  results.browser = browser.version();
  const page = await browser.newPage({
    viewport: { width: 844, height: 390 },
    serviceWorkers: "block",
  });
  const origin = `http://127.0.0.1:${server.address().port}/`;
  await page.route("**/*", (route) =>
    route.request().url().startsWith(origin) ? route.continue() : route.abort(),
  );
  page.on("pageerror", (e) => results.errors.push(e.message));
  await page.goto(origin);
  await page.addScriptTag({
    content: bundle.outputFiles.find((f) => f.path.endsWith(".js")).text,
  });
  const css = bundle.outputFiles.find((f) => f.path.endsWith(".css"));
  if (css) await page.addStyleTag({ content: css.text });
  console.log("HARROW検証: ページ読込");
  await page.waitForFunction(() => !!window.polishMatrix);
  await page.evaluate(() => polishMatrix.capture("spin", 0, "ground"));
  await page.waitForFunction(
    () =>
      performance
        .getEntriesByType("resource")
        .some((e) => e.name.includes("harrow_motion_") && e.responseEnd > 0),
    null,
    { timeout: 120000 },
  );
  await page.locator("aside").evaluate((e) => (e.style.visibility = "hidden"));
  const cases = {
    spin: [0.6, 1.1, 1.675],
    dash: [0.4, 0.75, 1.15],
    snipe: [1, 1.9, 2.4],
    missile: [1.8, 3.4, 4.4],
    "ground-missile": [1.8, 3.4, 4.4],
    bomb: [0.8, 1.45, 2.2],
    dive: [0.6, 2, 2.6, 3.05],
  };
  const selectedCases = options.modes
    ? Object.fromEntries(
        Object.entries(cases).filter(([mode]) =>
          options.modes.split(",").includes(mode),
        ),
      )
    : cases;
  const views = options.views?.split(",") ?? ["ground", "edge", "dense"];
  for (const [mode, times] of Object.entries(selectedCases)) {
    for (const view of views) {
      for (const time of times) {
        await page.evaluate(
          ({ mode, time, view }) => polishMatrix.capture(mode, time, view),
          { mode, time, view },
        );
        await page.waitForFunction(
          () => polishMatrix.assets.pending === 0,
          null,
          { timeout: 60000 },
        );
        const state = await page.evaluate(
          ({ mode, time, view }) => polishMatrix.capture(mode, time, view),
          { mode, time, view },
        );
        assert.equal(state.status.model, "GLB loaded");
        assert(Math.abs(state.time - time) < 1e-8);
        const dense = view === "dense" || view === "wall";
        assert.equal(state.enemies, dense ? 40 : 1);
        assert.equal(state.denseRendered, dense ? 39 : 0);
        if (dense)
          assert(
            state.densePositions.filter((p) =>
              p.ndc.every((n) => Math.abs(n) <= 1),
            ).length >= 20,
            "密集敵20体以上の中心が画角内にあること",
          );
        const file = `${mode}-${view}-${time}.png`;
        await page.screenshot({ path: `${out}/${file}` });
        results.views.push({ file, ...state });
      }
    }
    console.log(`${mode}: ${times.length * views.length}画面取得`);
  }
  assert.deepEqual(results.errors, []);
  results.assets = await page.evaluate(() => polishMatrix.assets);
  assert.deepEqual(results.assets, { pending: 0, errors: [] });
  assert.equal(
    results.views.length,
    Object.values(selectedCases).reduce(
      (n, times) => n + times.length * views.length,
      0,
    ),
  );
  results.implementation = "承認済みの本体実装、検証用目印追加なし";
  results.captured = true;
} catch (error) {
  results.failure = String(error.stack ?? error);
  throw error;
} finally {
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  await browser?.close();
  await new Promise((r) => server.close(r));
}
