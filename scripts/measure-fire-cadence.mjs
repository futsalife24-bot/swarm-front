import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

// 連射間隔の段ごとの計測。ローカル専用：実Worker・実WebSocket・実Chromeを使い、
// 製品のFrontNetwork・NetworkInputLoop・Renderer・Sound・FireCadenceTraceをそのまま通す。
// 射撃ボタンの物理タッチは模擬しない（入力値を保持状態にする）。同一PCの値は実機の証明ではない。
const origin = process.env.SWARM_FIRE_ORIGIN ?? "http://127.0.0.1:5196",
  endpoint = process.env.SWARM_FIRE_ENDPOINT ?? "http://127.0.0.1:8797";
assert.equal(new URL(endpoint).hostname, "127.0.0.1");
assert.equal(new URL(origin).hostname, "127.0.0.1");
const mode = process.env.SWARM_FIRE_MODE ?? "coop";
assert.ok(["solo", "coop"].includes(mode));
const players =
  mode === "solo" ? 1 : Number(process.env.SWARM_FIRE_PLAYERS ?? 1);
assert.ok([1, 2, 3, 4].includes(players));
const weapon = process.env.SWARM_FIRE_WEAPON ?? "rifle";
assert.ok(["rifle", "smg"].includes(weapon));
const seconds = Number(process.env.SWARM_FIRE_SECONDS ?? 30);
assert.ok(seconds >= 5 && seconds <= 120);
const latencyMs = Number(process.env.SWARM_FIRE_LATENCY_MS ?? 0),
  jitterMs = Number(process.env.SWARM_FIRE_JITTER_MS ?? 0);
const load = process.env.SWARM_FIRE_LOAD ?? "";
assert.ok(["", "mixed"].includes(load));
assert.ok(!load || (mode === "coop" && players === 4 && weapon === "rifle"));
const shapeLink = mode === "coop" && (latencyMs > 0 || jitterMs > 0);
// 切り分け用：サーバー側の診断行を要求しない（端末側の記録だけ残る）。
const serverTrace = process.env.SWARM_FIRE_SERVER_TRACE !== "0";
// 描画と音まで動かす画面の数。残りは通信と入力だけ（同一PCで4画面を描くと
// ローカルのサーバーまで遅くなり、スマホ4台の条件から離れるため）。
const renderClients = Number(process.env.SWARM_FIRE_RENDER_CLIENTS ?? players);
// 0で表示間隔の調整（ShotPacer）を通さず、修正前と同じ「届いた順に即表示」にする。
const pacer = process.env.SWARM_FIRE_PACER !== "0";
assert.ok(renderClients >= 1 && renderClients <= players);
const name =
  process.env.SWARM_FIRE_NAME ??
  `${mode}${mode === "coop" ? players : ""}-${weapon}${shapeLink ? `-jitter${jitterMs}` : ""}${load ? `-${load}` : ""}`;
const output = path.join(
  process.env.SWARM_FIRE_OUTPUT ?? "dist-validation/fire-cadence-20261114",
  name,
);
fs.mkdirSync(output, { recursive: true });
const files = [
  "server/worker.ts",
  "server/room-clock.ts",
  "server/room-network-trace.ts",
  "server/state-delivery.ts",
  "server/testing.ts",
  "scripts/fire-cadence-fixture.ts",
  "scripts/measure-fire-cadence.mjs",
  "scripts/local-websocket-shaper.mjs",
  "src/shared/game.ts",
  "src/shared/defs.ts",
  "src/shared/fire-trace.ts",
  "src/shared/front-run.ts",
  "src/shared/state-wire.ts",
  "src/client/front-network.ts",
  "src/client/network-input-loop.ts",
  "src/client/input-window.ts",
  "src/client/fire-cadence-trace.ts",
  "src/client/shot-pacer.ts",
  "src/client/render.ts",
  "src/client/combat-effects.ts",
  "src/client/audio.ts",
  "src/client/combat-audio.ts",
];
const hashes = () =>
  Object.fromEntries(
    files.map((file) => [
      file,
      createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    ]),
  );
const redact = (value) =>
  String(value).replace(/[a-f0-9]{32,64}/gi, "[redacted]");
const sourceBefore = hashes();
const result = {
  passed: false,
  name,
  condition: {
    mode,
    players,
    weapon,
    seconds,
    link: shapeLink ? { latencyMs, jitterMs } : null,
    load: load || null,
    serverTrace,
    renderClients,
    pacer,
  },
  method:
    "independent Chrome processes with blank profiles; real FrontNetwork/NetworkInputLoop/Renderer/Sound/FireCadenceTrace; fire is held by input value (no physical touch); local test Worker fixture fixes seed and weapon. Solo mirrors the product frame loop (50 ms accumulator, local stepFrontRun).",
  endpoint,
  origin,
  headBefore: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  sourceBefore,
  errors: [],
};
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    loader: "ts",
    contents: String.raw`
import {Renderer} from './src/client/render';
import {FrontNetwork} from './src/client/front-network';
import {Sound} from './src/client/audio';
import {FireCadenceTrace} from './src/client/fire-cadence-trace';
import {ShotPacer,withPresentedEvents} from './src/client/shot-pacer';
import {fireTraceRow} from './src/shared/fire-trace';
import {prepareBattle} from './src/client/battle-loading';
import {createFrontRun,stepFrontRun,chooseFrontUpgrade} from './src/shared/front-run';
import {createFrontSurvivalWeapon} from './src/shared/front-weapon';
import {neutral,retireEvents,validInput} from './src/shared/game';
import {stats} from './src/shared/defs';
import {DEFENSE_MAPS,MAPS} from './src/shared/stages';
import {fireCadenceFixture} from './scripts/fire-cadence-fixture';
if(${JSON.stringify(load)}==='mixed')Object.assign(DEFENSE_MAPS[3],MAPS[3]);
window.boot=async(endpoint,code,weapon,renderEnabled)=>{
  if(!validInput({...neutral(),seq:1}))throw Error('neutral Input contract failed');
  const view=new Renderer(document.querySelector('canvas'),120);
  const trace=new FireCadenceTrace();
  const pacer=${pacer}?new ShotPacer():null;
  const sound=new Sound();
  sound.setVolumes(0.35,0,1);
  sound.shotTrace=(event,result)=>trace.sounded(event,result);
  sound.unlock();
  await sound.load();
  const errors=[],statuses=[],chosen=new Set();
  let world,id='front-solo',seq=0,firing=false,previous=performance.now(),run,net,accumulator=0,tick=0,phase='';
  const yaw=0,pitch=0.35;
  const read=()=>({...neutral(),cameraAim:true,fire:firing,yaw,pitch,seq:++seq});
  const clean=(v)=>String(v).replace(/[a-f0-9]{32,64}/gi,'[redacted]');
  if(endpoint){
    net=new FrontNetwork(endpoint,${serverTrace});net.clearedStage=0;net.fireTrace=trace;
    net.equip=[createFrontSurvivalWeapon('front-lobby','front-client')];
    net.onStatus=(text,fatal)=>{statuses.push({text:clean(text),fatal});if(fatal)errors.push(clean(text));};
    net.onWorld=(value)=>{
      world=value;id=net.id;phase=net.frontView?.phase;
      pacer?.ingest(value,performance.now()/1000);
      const offer=net.frontView?.offer;
      if(offer&&!chosen.has(offer.id)){chosen.add(offer.id);net.send({type:'frontChoose',request:{runId:value.run,offerId:offer.id,revision:offer.revision,requestId:offer.id+':'+net.id,cardId:offer.defaultCardId}});}
    };
    const active=()=>!!world&&!net.closed&&net.ws?.readyState===1&&(phase==='combat'||phase==='boss')&&Date.now()/1000+net.clockOffset>=net.frontView.resumeUntil;
    net.setInputSource(()=>{if(!active())return;const input=read();trace.sampled(input.seq,input.fire);return input;});
    net.connect(code);
  }else{
    const now=()=>performance.now()/1000;
    run=createFrontRun({runId:'cadence-solo',seed:4520,mode:'survival',fusion:true,survivalBuildVersion:1,catalogVersion:3,clearedStage:0,players:[{id,equipment:[createFrontSurvivalWeapon('front-lobby','front-client')]}]},now());
    const offer=run.upgrades[id].offer;
    if(offer)chooseFrontUpgrade(run,id,{runId:run.world.run,offerId:offer.id,revision:offer.revision,requestId:'cadence',cardId:offer.defaultCardId},now());
    for(let n=0;n<40&&run.phase==='selection';n++)stepFrontRun(run,{},0.05,now()+n);
    window.soloFixture=fireCadenceFixture(run,weapon,'quiet');
    world=run.world;phase=run.phase;
  }
  function frame(time){
    requestAnimationFrame(frame);
    trace.frame(time);
    const wallDt=Math.max(0,(time-previous)/1000),dt=Math.min(.1,wallDt);previous=time;
    if(!world)return;
    let active=!!run||(phase==='combat'||phase==='boss');
    if(run){
      // 製品のソロと同じ順：50ms刻みの進行 → 受け取り → 音 → 描画 → 消費済みイベントの整理。
      accumulator+=dt;
      while(accumulator>=0.05){
        const input=read(),floor=run.world.eventSerial;
        stepFrontRun(run,{[id]:input},0.05,performance.now()/1000);
        trace.sampled(input.seq,input.fire);
        trace.local(fireTraceRow(run.world,id,floor,++tick,performance.now(),input,0,false,run.phase!=='combat'&&run.phase!=='boss'));
        accumulator-=0.05;
      }
      world=run.world;phase=run.phase;
      pacer?.ingest(world,performance.now()/1000);
      trace.received(world,id,performance.now(),0);
    }
    if(!renderEnabled)return;
    const present=()=>{
      sound.update(world,id,yaw,active);
      const before=view.consumed(world.run);
      view.render(world,id,dt,yaw,pitch,undefined,active);
      trace.displayed(world,id,before,view.consumed(world.run));
    };
    // 製品のfront-appと同じ：描画と音にだけ均した順番のイベントを見せる。
    if(pacer)withPresentedEvents(world,pacer.present(performance.now()/1000,Math.min(view.consumed(world.run),sound.consumed(world.run))),present);
    else present();
    if(run)retireEvents(world,Math.min(view.consumed(world.run),sound.consumed(world.run)));
  }
  window.live={
    prepare:async()=>{
      const preview=run?run.world:createFrontRun({runId:'cadence-preview',seed:4520,mode:'survival',fusion:true,survivalBuildVersion:1,catalogVersion:3,clearedStage:0,players:net.members.filter(m=>m.connected).map(m=>({id:m.id,equipment:net.equip}))},Date.now()/1000).world;
      const start=performance.now();if(renderEnabled)await prepareBattle(view,preview,id,()=>false);
      net?.setAssetReady(true);
      requestAnimationFrame(frame);
      return{ms:performance.now()-start,audio:sound.context?.state};
    },
    ready:(count)=>!!net.id&&net.members.length===count&&net.members.every(m=>m.connected&&m.weapons?.length===net.equip.length),
    allReady:(count)=>net.members.length===count&&net.members.every(m=>m.ready),
    start:()=>net.send({type:'start'}),phase:()=>phase,
    weapon:()=>{const p=world?.players.find(p=>p.id===id);const s=p&&stats(p.weapons[p.slot]);return s?{kind:p.weapons[p.slot].kind,intervalMs:s.interval*1000,mag:s.mag,reloadMs:s.reload*1000,enemies:world.enemies.length}:null;},
    begin:()=>{firing=true;trace.press(true,performance.now());return{at:performance.now(),time:world?.time};},
    end:()=>{firing=false;trace.press(false,performance.now());const p=world?.players.find(p=>p.id===id);return{trace:trace.details(),audio:sound.context?.state,hp:p?.hp,time:world?.time,enemies:world?.enemies.length,errors,statuses,viewport:{width:innerWidth,height:innerHeight},network:net?.diagnostics.details().samples};},
    close:()=>net?.close(),
  };
};`,
  },
  bundle: true,
  loader: { ".png": "dataurl" },
  write: false,
  outfile: path.join(output, "fire-browser.js"),
  format: "iife",
  platform: "browser",
  define: { "import.meta.env.BASE_URL": '"/"', "import.meta.env.DEV": "false" },
  logLevel: "silent",
});
const javascript = bundle.outputFiles.find((file) =>
  file.path.endsWith(".js"),
).text;
const publicRoot = path.resolve("public"),
  pages = [],
  browsers = [];
const types = {
  ".glb": "model/gltf-binary",
  ".png": "image/png",
  ".wav": "audio/wav",
  ".json": "application/json",
};
const server = createServer((request, response) => {
  if (request.url === "/live") {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.end(
      `<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><style>body{margin:0}canvas{width:100vw;height:100vh;display:block}#damage{position:fixed;inset:0;pointer-events:none}</style><canvas></canvas><div id="damage" aria-hidden="true"></div>`,
    );
    return;
  }
  const file = path.resolve(
    publicRoot,
    "." + decodeURIComponent(new URL(request.url, origin).pathname),
  );
  if (
    !file.startsWith(publicRoot + path.sep) ||
    !fs.existsSync(file) ||
    !fs.statSync(file).isFile()
  ) {
    response.statusCode = 404;
    response.end();
    return;
  }
  response.setHeader(
    "Content-Type",
    types[path.extname(file)] ?? "application/octet-stream",
  );
  response.end(fs.readFileSync(file));
});
let serverStarted = false,
  shaper;
try {
  let code = "";
  if (mode === "coop") {
    const health = await fetch(endpoint + "/api/health");
    assert.equal(health.status, 200, "Local Worker unavailable");
    if (shapeLink) {
      const { createLocalWebSocketShaper } =
        await import("./local-websocket-shaper.mjs");
      shaper = await createLocalWebSocketShaper({
        upstream: endpoint,
        origin,
        latencyMs,
        jitterMs,
      });
    }
    const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
      fs.readFileSync(".dev.vars", "utf8"),
    )?.[1];
    assert.ok(key, "Local credential unavailable");
    const created = await fetch(endpoint + "/rooms", {
      method: "POST",
      headers: {
        "X-Room-Creation-Key": key,
        "X-Test-Client": createHash("sha256")
          .update("fire-" + Date.now())
          .digest("hex"),
      },
      body: JSON.stringify({
        name: "連射間隔の隔離検証",
        listed: false,
        ruleset: "front-v1",
        mode: "survival",
      }),
    });
    assert.equal(created.status, 200, "Local room creation failed");
    ({ code } = await created.json());
  }
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(Number(new URL(origin).port), "127.0.0.1", resolve);
  });
  serverStarted = true;
  for (let index = 0; index < players; index++) {
    const browser = await chromium.launch({
      channel: "chrome",
      args: [
        "--use-angle=d3d11",
        "--autoplay-policy=no-user-gesture-required",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows",
      ],
    });
    browsers.push(browser);
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      hasTouch: true,
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    pages.push(page);
    page.setDefaultTimeout(90000);
    page.on("pageerror", (error) =>
      result.errors.push({
        client: index,
        type: "pageerror",
        message: redact(error.message),
      }),
    );
    page.on("console", (message) => {
      if (message.type() === "error" && result.errors.length < 30)
        result.errors.push({
          client: index,
          type: "console",
          message: redact(message.text()),
        });
    });
    await page.goto(origin + "/live");
    await page.addScriptTag({ content: javascript });
    await page.evaluate(
      ({ endpoint, code, weapon, renderEnabled }) =>
        boot(endpoint, code, weapon, renderEnabled),
      {
        endpoint: mode === "coop" ? (shaper?.endpoint ?? endpoint) : "",
        code,
        weapon,
        renderEnabled: index < renderClients,
      },
    );
  }
  if (mode === "coop") {
    await Promise.all(
      pages.map((page) =>
        page.waitForFunction((count) => live.ready(count), players),
      ),
    );
    result.preparations = await Promise.all(
      pages.map((page) => page.evaluate(() => live.prepare())),
    );
    await pages[0].waitForFunction((count) => live.allReady(count), players);
    await pages[0].evaluate(() => live.start());
    await Promise.all(
      pages.map((page) =>
        page.waitForFunction(() => live.phase() === "combat"),
      ),
    );
    if (load) {
      const dense = await fetch(
        `${endpoint}/fixtures/${code}/front-comfort-close?kind=${load}&projectiles=100`,
        { method: "POST" },
      );
      assert.equal(dense.status, 200);
      result.loadFixture = await dense.json();
    }
    const fixture = await fetch(
      `${endpoint}/fixtures/${code}/fire-cadence?weapon=${weapon}&kind=${load ? "keep" : "quiet"}`,
      { method: "POST" },
    );
    assert.equal(fixture.status, 200, "fire-cadence fixture failed");
    result.fixture = await fixture.json();
  } else {
    result.preparations = [await pages[0].evaluate(() => live.prepare())];
    result.fixture = await pages[0].evaluate(() => window.soloFixture);
  }
  await new Promise((resolve) => setTimeout(resolve, 1500));
  result.weapons = await Promise.all(
    pages.map((page) => page.evaluate(() => live.weapon())),
  );
  for (const w of result.weapons) assert.equal(w?.kind, weapon);
  result.beginnings = await Promise.all(
    pages.map((page) => page.evaluate(() => live.begin())),
  );
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  const raw = await Promise.all(
    pages.map((page) => page.evaluate(() => live.end())),
  );
  result.clients = raw.map((data, index) => {
    fs.writeFileSync(
      path.join(output, `client-${index}.json`),
      JSON.stringify(data),
    );
    return {
      client: index,
      audio: data.audio,
      hp: data.hp,
      enemies: data.enemies,
      shots: data.trace.shots.length,
      ticks: data.trace.ticks.length,
      errors: data.errors,
    };
  });
  await pages[0].screenshot({ path: path.join(output, "client-0.png") });
  result.passed =
    result.errors.length === 0 &&
    result.clients.every(
      (c) =>
        c.shots > 20 && (c.ticks > 20 || !serverTrace) && c.errors.length === 0,
    );
} catch (error) {
  result.failure = redact(error.stack ?? error);
  process.exitCode = 1;
} finally {
  result.sourceAfter = hashes();
  result.sourcesStable = Object.keys(sourceBefore).every(
    (file) => sourceBefore[file] === result.sourceAfter[file],
  );
  if (!result.sourcesStable) result.passed = false;
  if (!result.passed) process.exitCode = 1;
  for (const page of pages)
    await page.evaluate(() => window.live?.close()).catch(() => {});
  for (const browser of browsers) await browser.close().catch(() => {});
  if (shaper) {
    await shaper.close();
    result.link = shaper.metrics;
  }
  if (serverStarted) await new Promise((resolve) => server.close(resolve));
  fs.writeFileSync(
    path.join(output, "results.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(
    JSON.stringify({
      name,
      passed: result.passed,
      sourcesStable: result.sourcesStable,
      fixture: result.fixture,
      clients: result.clients,
      errors: result.errors,
      failure: result.failure,
    }),
  );
}
