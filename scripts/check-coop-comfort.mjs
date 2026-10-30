import { build } from "esbuild";
import { chromium } from "@playwright/test";
import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  statSync,
} from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import assert from "node:assert/strict";

// Isolated browser contexts + real FrontNetwork/Renderer + local Worker only.
const origin = "http://127.0.0.1:5186",
  endpoint = "http://127.0.0.1:8793";
const out = "dist-validation/coop-comfort-20261030/browser";
mkdirSync(out, { recursive: true });
mkdirSync("dist-mobile-network", { recursive: true });
writeFileSync(
  "dist-mobile-network/fixture.html",
  '<!doctype html><meta charset="utf-8"><style>body{margin:0}canvas{width:100vw;height:100vh;display:block}</style><canvas></canvas>',
);
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  readFileSync(".dev.vars", "utf8"),
)?.[1];
assert.ok(key, "Local credential required");
const response = await fetch(`${endpoint}/rooms`, {
  method: "POST",
  headers: {
    "X-Room-Creation-Key": key,
    "X-Test-Client": `comfort-${Date.now()}`,
  },
  body: JSON.stringify({
    name: "隔離快適化検証",
    listed: false,
    ruleset: "front-v1",
    mode: "survival",
  }),
});
assert.ok(response.ok, `Room creation HTTP ${response.status}`);
const { code } = await response.json();
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
    import {Renderer} from './src/client/render';
    import {FrontNetwork} from './src/client/front-network';
    import {frontTemporaryWeapons} from './src/shared/front-run';
    import {neutral} from './src/shared/game';
    window.boot=async(endpoint,code,index)=>{
      const view=new Renderer(document.querySelector('canvas'),120);
      const net=new FrontNetwork(endpoint);
      net.equip=frontTemporaryWeapons('comfort',String(index),['rifle','smg']);
      let world,seq=0,last=performance.now(),measure=false,frames=[],updates=0,firsts=0;
      const chosen=new Set(),errors=[];let gpuError=0;
      net.onStatus=(text,fatal)=>{if(fatal)errors.push(text)};
      net.onWorld=(value,first)=>{
        world=value;updates++;if(first)firsts++;
        const offer=net.frontView?.offer;
        if(offer&&!chosen.has(offer.id)){
          chosen.add(offer.id);
          net.send({type:'frontChoose',request:{runId:world.run,offerId:offer.id,revision:offer.revision,requestId:offer.id+':'+net.id,cardId:offer.defaultCardId}});
        }
      };
      net.connect(code);
      function frame(now){
        const dt=Math.min(.1,(now-last)/1000);if(measure)frames.push(now-last);last=now;
        if(world){net.input({...neutral(),seq:++seq});view.render(world,net.id,dt,0,-.15,undefined,true);gpuError ||= view.renderer.getContext().getError();}
        requestAnimationFrame(frame);
      }requestAnimationFrame(frame);
      window.check={
        net,view,
        ready:()=>net.setAssetReady(true),start:()=>net.send({type:'start'}),
        measure:()=>{frames=[];measure=true},
        reconnect:()=>net.ws.close(),
        state:()=>({connected:net.members.filter(m=>m.connected).length,ready:net.members.filter(m=>m.ready).length,
          phase:net.frontView?.phase,updates,firsts,errors,frames,geometry:view.renderer.info.render,
          assets:[...view.structures.values()].map(s=>({loaded:!!s.batch,error:s.error})),
          time:world?.time,enemies:world?.enemies.map(e=>({id:e.id,x:e.x,y:e.y,z:e.z,hp:e.hp})),
          orbs:world?.front?.orbs.length,projectiles:world?.projectiles.length,
          player:world?.players.find(p=>p.id===net.id),stateClosed:net.closed,
          projectileInstances:view.projectiles.count+view.foundryLasers.count,
          gpuError,
          structureCount:[...view.structures.values()].reduce((n,s)=>n+(s.batch?.parts[0]?.count??0),0)}),
        close:()=>net.close(),
      };
    };`,
  },
  bundle: true,
  write: false,
  outfile: "dist-mobile-network/browser-bundle.js",
  format: "iife",
  platform: "browser",
  define: { "import.meta.env.BASE_URL": '"/"', "import.meta.env.DEV": "false" },
});
const publicRoot = path.resolve("public");
const server = createServer((req, res) => {
  if (req.url === "/fixture") {
    res.setHeader("content-type", "text/html");
    res.end(readFileSync("dist-mobile-network/fixture.html"));
    return;
  }
  const file = path.resolve(
    publicRoot,
    "." + decodeURIComponent(new URL(req.url, origin).pathname),
  );
  if (
    !file.startsWith(publicRoot + path.sep) ||
    !existsSync(file) ||
    !statSync(file).isFile()
  ) {
    res.statusCode = 404;
    res.end();
    return;
  }
  res.end(readFileSync(file));
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(5186, "127.0.0.1", resolve);
});
const browser = await chromium.launch({
  channel: "chrome",
  args: [
    "--use-angle=d3d11",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
  ],
});
const pages = [],
  errors = [],
  packets = [[], [], [], []],
  sent = [0, 0, 0, 0];
const result = {
  passed: false,
  context:
    "同一PCの4独立ブラウザ・実ローカルWorker・密集fixture。実スマホ/本番回線の証明ではない。",
  errors,
  trials: [],
};
const percentile = (a, p) =>
  [...a].sort((a, b) => a - b)[
    Math.min(a.length - 1, Math.floor(a.length * p))
  ] ?? 0;
try {
  for (let i = 0; i < 4; i++) {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      hasTouch: true,
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    pages.push(page);
    page.setDefaultTimeout(30000);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("websocket", (ws) => {
      ws.on("framesent", ({ payload }) => {
        if (JSON.parse(payload.toString()).type === "input") sent[i]++;
      });
      ws.on("framereceived", ({ payload }) => {
        const m = JSON.parse(payload.toString());
        if (m.type === "state" || m.type === "stateChunk")
          packets[i].push({
            bytes: Buffer.byteLength(payload),
            encoding:
              m.type === "stateChunk"
                ? "chunk-v1"
                : (m.stateEncoding ?? "legacy"),
            omitted: m.omitted?.enemies?.length ?? 0,
          });
        if (m.type === "error") errors.push(m.reason);
      });
    });
    await page.goto(`${origin}/fixture`);
    await page.addScriptTag({
      content: bundle.outputFiles.find((f) => f.path.endsWith(".js")).text,
    });
    await page.evaluate(({ endpoint, code, i }) => boot(endpoint, code, i), {
      endpoint,
      code,
      i,
    });
    await page.waitForFunction(
      () => check.net.id && check.net.members.length > 0,
    );
  }
  await Promise.all(
    pages.map((p) => p.waitForFunction(() => check.state().connected === 4)),
  );
  await Promise.all(pages.map((p) => p.evaluate(() => check.ready())));
  await pages[0].waitForFunction(() => check.state().ready === 4);
  await pages[0].evaluate(() => check.start());
  await Promise.all(
    pages.map((p) => p.waitForFunction(() => check.state().phase === "combat")),
  );
  // Normal traffic first. The dense fixture then freezes simulation for visual correspondence.
  await pages[0].waitForTimeout(4000);
  assert.ok(
    (
      await fetch(`${endpoint}/fixtures/${code}/front-wire-heavy`, {
        method: "POST",
      })
    ).ok,
  );
  await Promise.all(
    pages.map((p) =>
      p.waitForFunction(
        () =>
          check.state().enemies?.length === 96 &&
          check.state().projectiles === 400,
      ),
    ),
  );
  await Promise.all(
    pages.map((p) =>
      p.waitForFunction(() => check.state().assets.every((a) => a.loaded)),
    ),
  );
  const states = await Promise.all(
    pages.map((p) => p.evaluate(() => check.state())),
  );
  for (const s of states) {
    assert.equal(s.orbs, 160);
    assert.equal(s.projectileInstances, 400);
    assert.equal(s.gpuError, 0);
    assert.equal(s.errors.length, 0);
    assert.deepEqual(s.enemies, states[0].enemies);
  }
  await Promise.all(pages.map((p) => p.evaluate(() => check.measure())));
  await pages[0].waitForTimeout(6000);
  for (let i = 0; i < 4; i++) {
    const s = await pages[i].evaluate(() => check.state());
    result.trials.push({
      client: i,
      enemies: s.enemies.length,
      orbs: s.orbs,
      projectiles: s.projectiles,
      projectileInstances: s.projectileInstances,
      gpuError: s.gpuError,
      structureCount: s.structureCount,
      frames: s.frames.length,
      frameP50: percentile(s.frames, 0.5),
      frameP95: percentile(s.frames, 0.95),
      frameMax: Math.max(...s.frames),
      over50: s.frames.filter((n) => n > 50).length,
      inputPackets: sent[i],
      packetMax: Math.max(...packets[i].map((p) => p.bytes)),
      tuplePackets: packets[i].filter((p) => p.encoding === "tuples-v1").length,
      omittedMax: Math.max(...packets[i].map((p) => p.omitted)),
      errors: s.errors,
    });
    await pages[i].screenshot({ path: `${out}/client-${i}.png` });
  }
  assert.ok(
    (
      await fetch(`${endpoint}/fixtures/${code}/front-wire-overflow`, {
        method: "POST",
      })
    ).ok,
  );
  await Promise.all(
    pages.map((p) =>
      p.waitForFunction(
        () =>
          check.state().projectiles === 1000 &&
          check.state().projectileInstances === 1000,
      ),
    ),
  );
  result.chunked = [];
  for (let i = 0; i < 4; i++) {
    const s = await pages[i].evaluate(() => check.state());
    assert.equal(s.enemies.length, 96);
    assert.equal(s.orbs, 160);
    assert.equal(s.gpuError, 0);
    const chunks = packets[i].filter((p) => p.encoding === "chunk-v1");
    assert.ok(chunks.length > 1);
    assert.ok(chunks.every((p) => p.bytes <= 65536));
    result.chunked.push({
      client: i,
      enemies: 96,
      projectiles: 1000,
      projectileInstances: s.projectileInstances,
      chunks: chunks.length,
      frameMaxBytes: Math.max(...chunks.map((p) => p.bytes)),
      gpuError: s.gpuError,
    });
  }
  const beforeStall = await pages[2].evaluate(() => check.state().updates);
  await pages[2].evaluate(() => {
    const until = performance.now() + 500;
    while (performance.now() < until) {}
  });
  await pages[2].waitForFunction((n) => check.state().updates > n, beforeStall);
  assert.equal(
    (await pages[2].evaluate(() => check.state())).projectiles,
    1000,
  );
  result.stallRecovery = { blockedMs: 500, completeWorld: true };
  const firsts = await pages[3].evaluate(() => check.state().firsts);
  await pages[3].evaluate(() => check.reconnect());
  await pages[3].waitForFunction((n) => check.state().firsts > n, firsts);
  assert.ok(
    (
      await fetch(`${endpoint}/fixtures/${code}/front-wire-overflow`, {
        method: "POST",
      })
    ).ok,
  );
  await pages[3].waitForFunction(
    () =>
      check.state().enemies?.length === 96 &&
      check.state().projectiles === 1000,
  );
  result.reconnect = { freshWorld: true, enemies: 96, projectiles: 1000 };
  assert.equal(errors.length, 0);
  result.passed = true;
} catch (error) {
  result.failure = String(error);
  result.failureStates = await Promise.all(
    pages.map((p, i) =>
      p
        .evaluate(() => {
          const s = check.state();
          return {
            enemies: s.enemies?.length,
            projectiles: s.projectiles,
            updates: s.updates,
            phase: s.phase,
            closed: s.stateClosed,
            errors: s.errors,
            gpuError: s.gpuError,
          };
        })
        .then((s) => ({ client: i, ...s, wire: packets[i].slice(-3) }))
        .catch((e) => ({ client: i, error: String(e) })),
    ),
  );
  throw error;
} finally {
  writeFileSync(`${out}/results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  for (const p of pages) await p.evaluate(() => check?.close()).catch(() => {});
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
