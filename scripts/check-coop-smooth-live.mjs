import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createLocalWebSocketShaper } from "./local-websocket-shaper.mjs";

// Isolated local Worker, two fresh Chrome profiles, real network/Renderer/AI.
const endpoint = "http://127.0.0.1:8796",
  origin = "http://127.0.0.1:5186";
const output = "dist-validation/coop-smooth-20261117/live";
fs.mkdirSync(output, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    loader: "ts",
    contents: `
import {Renderer} from './src/client/render';
import {FrontNetwork} from './src/client/front-network';
import {prepareBattle} from './src/client/battle-loading';
import {createFrontRun,frontTemporaryWeapons} from './src/shared/front-run';
import {neutral} from './src/shared/game';
window.boot=(endpoint,code,renderEnabled)=>{
 const view=new Renderer(document.querySelector('canvas'),60), net=new FrontNetwork(endpoint);
 net.clearedStage=0; net.equip=frontTemporaryWeapons('smooth','pilot',['rifle','smg']);
 let world,seq=0,last=performance.now(),measuring=false,frames=0,states=0,buffered=0,enemyFrames=0;
 const intervals=[],positions=[],errors=[]; let received=0;
 net.onStatus=(text,fatal)=>{if(fatal)errors.push(text)};
 net.onWorld=(snapshot,first)=>{
  world=snapshot;const now=performance.now(),phase=net.frontView?.phase;
  if(first||(phase!=='combat'&&phase!=='boss'))view.enemyMotion.reset();
  if(phase==='combat'||phase==='boss')view.enemyMotion.receive(snapshot,now);
  if(measuring){states++;if(received)intervals.push(now-received);received=now;}
 };
 net.setInputSource(()=>({...neutral(),seq:++seq,mx:.3,fire:true}));
 function frame(now){requestAnimationFrame(frame);const dt=Math.min(.1,(now-last)/1000);last=now;
  if(!world)return;if(renderEnabled)view.render(world,net.id,dt,0,0,undefined,true);
  if(measuring){frames++;if(view.enemyMotion.enabled)buffered++;if(world.enemies.length){enemyFrames++;
   const e=world.enemies[0],v=view.visual.get(String(e.id));if(v&&positions.length<120)positions.push({time:world.time,authority:e.x,visual:v.x});}}
 }requestAnimationFrame(frame);
 window.check={ready:()=>net.members.length===2&&net.members.every(m=>m.connected&&m.weapons?.length),
  prepare:async()=>{if(!renderEnabled){net.setAssetReady(true);return;}const run=createFrontRun({runId:'preview',seed:42,mode:'survival',fusion:true,survivalBuildVersion:1,catalogVersion:3,clearedStage:0,players:net.members.map(m=>({id:m.id,equipment:net.equip}))},Date.now()/1000);
   await prepareBattle(view,run.world,net.id,()=>false);net.setAssetReady(true);},
  allReady:()=>net.members.length===2&&net.members.every(m=>m.ready),start:()=>net.send({type:'start'}),
  combat:()=>net.frontView?.phase==='combat',begin:()=>{measuring=true},
  end:()=>({renderEnabled,frames,states,buffered,enemyFrames,intervals,positions,errors,phase:net.frontView?.phase,glError:view.renderer.getContext().getError()}),
  close:()=>net.close()};net.connect(code);
};`,
  },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  outfile: "live.js",
  loader: { ".png": "dataurl" },
  define: { "import.meta.env.BASE_URL": '"/"', "import.meta.env.DEV": "false" },
  logLevel: "silent",
});
const javascript = bundle.outputFiles.find((f) => f.path.endsWith(".js")).text;
const root = path.resolve("public");
const server = createServer((req, res) => {
  if (req.url === "/") {
    res.setHeader("Content-Type", "text/html");
    res.end(
      "<style>body{margin:0}canvas{width:100vw;height:100vh;display:block}</style><canvas></canvas><div id=damage></div>",
    );
    return;
  }
  const file = path.resolve(root, "." + new URL(req.url, origin).pathname);
  if (
    !file.startsWith(root + path.sep) ||
    !fs.existsSync(file) ||
    !fs.statSync(file).isFile()
  ) {
    res.writeHead(404).end();
    return;
  }
  res.end(fs.readFileSync(file));
});
const browsers = [],
  pages = [],
  errors = [];
let shaper;
try {
  await new Promise((r) => server.listen(5186, "127.0.0.1", r));
  const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
    fs.readFileSync(".dev.vars", "utf8"),
  )?.[1];
  assert.ok(key);
  const response = await fetch(endpoint + "/rooms", {
    method: "POST",
    headers: {
      "X-Room-Creation-Key": key,
      "X-Test-Client": createHash("sha256")
        .update("smooth" + Date.now())
        .digest("hex"),
    },
    body: JSON.stringify({
      name: "協力補間検証",
      listed: false,
      ruleset: "front-v1",
      mode: "survival",
    }),
  });
  assert.equal(response.status, 200);
  const { code } = await response.json();
  // 143ms each way approximates the reported 286ms spike; unit tests vary jitter.
  shaper = await createLocalWebSocketShaper({
    upstream: endpoint,
    origin,
    latencyMs: 143,
  });
  for (let i = 0; i < 2; i++) {
    const browser = await chromium.launch({
      channel: "chrome",
      args: ["--use-angle=d3d11"],
    });
    browsers.push(browser);
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    pages.push(page);
    page.setDefaultTimeout(90000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin);
    await page.addScriptTag({ content: javascript });
    await page.evaluate(
      ({ endpoint, code, renderEnabled }) =>
        boot(endpoint, code, renderEnabled),
      {
        endpoint: shaper.endpoint,
        code,
        renderEnabled: i === 1,
      },
    );
  }
  await Promise.all(pages.map((p) => p.waitForFunction(() => check.ready())));
  await Promise.all(pages.map((p) => p.evaluate(() => check.prepare())));
  await Promise.all(
    pages.map((p) => p.waitForFunction(() => check.allReady())),
  );
  await pages[0].evaluate(() => check.start());
  await Promise.all(pages.map((p) => p.waitForFunction(() => check.combat())));
  await Promise.all(pages.map((p) => p.evaluate(() => check.begin())));
  await new Promise((r) => setTimeout(r, 15000));
  const clients = await Promise.all(
    pages.map((p) => p.evaluate(() => check.end())),
  );
  const result = {
    errors,
    clients,
    method:
      "実ローカルWorker・2人・ゲストChrome D3D11描画・ホスト通信のみ・片道143ms。友達の実端末/公衆回線/人間の体感は未確認。",
  };
  fs.writeFileSync(
    path.join(output, "result.json"),
    JSON.stringify(result, null, 2),
  );
  for (const c of clients) {
    assert.ok(c.states > 20);
    assert.ok(c.enemyFrames > 10);
    if (c.renderEnabled) assert.ok(c.buffered > 10);
    assert.equal(c.glError, 0);
    assert.deepEqual(c.errors, []);
    if (c.renderEnabled)
      assert.ok(
        c.positions.some((p) => Math.abs(p.authority - p.visual) > 0.001),
      );
  }
  assert.deepEqual(errors, []);
  await pages[1].screenshot({ path: path.join(output, "guest.png") });
  console.log(
    JSON.stringify({
      passed: true,
      clients: clients.map((c) => ({
        frames: c.frames,
        states: c.states,
        enemyFrames: c.enemyFrames,
        buffered: c.buffered,
      })),
      output,
    }),
  );
} finally {
  await Promise.allSettled(pages.map((p) => p.evaluate(() => check.close())));
  await Promise.allSettled(browsers.map((b) => b.close()));
  await shaper?.close();
  await new Promise((r) => server.close(r));
}
