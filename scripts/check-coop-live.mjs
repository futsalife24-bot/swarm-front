import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

// Isolated live combat: ordinary input only, no fixture API, no real save/profile.
const origin = "http://127.0.0.1:5186",
  endpoint = "http://127.0.0.1:8793";
const seconds = Number(process.env.SWARM_LIVE_SECONDS ?? 60);
assert.ok(
  Number.isFinite(seconds) && seconds >= 10 && seconds <= 120,
  "Live duration must be 10..120 seconds",
);
const output =
  process.env.SWARM_LIVE_OUTPUT ?? "dist-validation/coop-comfort-20261030/live";
const diagnostics = process.env.SWARM_LIVE_DIAGNOSTICS === "1";
const profileEnabled = diagnostics && process.env.SWARM_LIVE_PROFILE === "1";
const networkTiming = process.env.SWARM_LIVE_NETWORK_TIMING === "1";
const glProbeMode = process.env.SWARM_LIVE_GL_PROBE ?? "interval";
assert.ok(["interval", "end"].includes(glProbeMode));
const renderEnabled = process.env.SWARM_LIVE_RENDER !== "0";
const renderClients = renderEnabled
  ? Number(process.env.SWARM_LIVE_RENDER_CLIENTS ?? 4)
  : 0;
assert.ok(
  Number.isInteger(renderClients) && renderClients >= 0 && renderClients <= 4,
);
const linkLatencyMs = Number(process.env.SWARM_LIVE_LINK_LATENCY_MS ?? 0);
const linkBytesPerSecond = Number(
  process.env.SWARM_LIVE_LINK_BYTES_PER_SECOND ?? 0,
);
const upBytesPerSecond = Number(
  process.env.SWARM_LIVE_UP_BYTES_PER_SECOND ?? 0,
);
const releaseAfterSeconds = Number(process.env.SWARM_LIVE_RELEASE_AFTER ?? 0);
const inputWindowOverride = Number(
  process.env.SWARM_LIVE_INPUT_WINDOW_OVERRIDE ?? 0,
);
assert.ok([0, 4, 16].includes(inputWindowOverride));
assert.ok(
  Number.isFinite(upBytesPerSecond) &&
    upBytesPerSecond >= 0 &&
    upBytesPerSecond <= 16 * 1024 * 1024,
);
assert.ok(
  releaseAfterSeconds === 0 ||
    (releaseAfterSeconds >= 5 && releaseAfterSeconds < seconds),
);
assert.ok(
  Number.isFinite(linkLatencyMs) && linkLatencyMs >= 0 && linkLatencyMs <= 1000,
);
assert.ok(
  linkBytesPerSecond === 0 ||
    (Number.isFinite(linkBytesPerSecond) &&
      linkBytesPerSecond >= 16384 &&
      linkBytesPerSecond <= 16 * 1024 * 1024),
);
const shapeLink =
  linkLatencyMs > 0 || linkBytesPerSecond > 0 || upBytesPerSecond > 0;
fs.mkdirSync(output, { recursive: true });
const files = [
  "server/worker.ts",
  "server/room-clock.ts",
  "server/state-delivery.ts",
  "src/shared/game.ts",
  "src/shared/state-wire.ts",
  "src/shared/state-tuples.ts",
  "src/shared/state-chunks.ts",
  "src/client/front-network.ts",
  "src/client/state-receipt.ts",
  "src/client/input-window.ts",
  "src/client/network-input-loop.ts",
  "src/client/render.ts",
  "src/client/hound-motion.ts",
  "src/client/enemy-spawn-effects.ts",
  "src/client/battle-loading.ts",
  "src/client/bastion-view.ts",
  "tests/bot.ts",
  "src/style.css",
  "scripts/check-coop-live.mjs",
  ...(shapeLink ? ["scripts/local-websocket-shaper.mjs"] : []),
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
const summary = (samples) => {
  const sorted = samples.filter(Number.isFinite).sort((a, b) => a - b);
  const at = (p) =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
  return {
    samples: sorted.length,
    p50: +at(0.5).toFixed(3),
    p95: +at(0.95).toFixed(3),
    max: +(sorted.at(-1) ?? 0).toFixed(3),
  };
};
const sourceBefore = hashes();
const result = {
  passed: false,
  observationCompleted: false,
  secondsRequested: seconds,
  diagnostics,
  profileEnabled,
  networkTiming,
  glProbeMode,
  renderEnabled,
  renderClients,
  releaseAfterSeconds,
  inputWindowOverride,
  linkConfig: shapeLink
    ? {
        latencyMs: linkLatencyMs,
        bytesPerSecond: linkBytesPerSecond || 16 * 1024 * 1024,
        ...(upBytesPerSecond ? { upBytesPerSecond } : {}),
      }
    : null,
  method:
    "4 independent Chrome processes, isolated blank profiles, real FrontNetwork and NetworkInputLoop, normal survival room, legal pilot movement/fire/reload sampled independently of RAF, no fixture API, no Sound; " +
    renderClients +
    " clients use real Renderer+prepareBattle, the others are network-only diagnostic clients; local PC aggregate load is not smartphone performance",
  endpoint,
  origin,
  sourceBefore,
  headBefore: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  errorCounts: {},
  errors: [],
  clients: [],
  preparations: [],
  progress: [],
  wire: Array.from({ length: 4 }, () => ({
    states: 0,
    chunks: 0,
    maxBytes: 0,
    omittedMax: 0,
    closes: 0,
    negotiatedStateFlow: false,
  })),
};
function recordError(entry) {
  const key = `${entry.client}:${entry.type}:${entry.message}`;
  result.errorCounts[key] = (result.errorCounts[key] ?? 0) + 1;
  if (result.errors.length < 30) result.errors.push(entry);
}
const style = fs.readFileSync("src/style.css", "utf8");
const damageStart = style.indexOf("#damage {");
const damageEnd = style.indexOf("#pause {", damageStart);
assert.ok(
  damageStart >= 0 && damageEnd > damageStart,
  "Product damage styles unavailable",
);
const damageStyles = style.slice(damageStart, damageEnd);
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    loader: "ts",
    contents: String.raw`
import {Renderer} from './src/client/render';
import {FrontNetwork} from './src/client/front-network';
import {prepareBattle} from './src/client/battle-loading';
import {createFrontRun,frontTemporaryWeapons} from './src/shared/front-run';
import {neutral,validInput} from './src/shared/game';
import {clampPitch} from './src/shared/aim';
import {stats} from './src/shared/defs';
import {pilot} from './tests/bot';
window.boot=(endpoint,code,index,diagnostics,networkTiming,renderEnabled)=>{
  if(!validInput({...neutral(),seq:1}))throw Error('neutral Input contract failed');
  if(!document.getElementById('damage'))throw Error('Product damage DOM required');
  const view=new Renderer(document.querySelector('canvas'),120);
  const diagnostic={snapshots:[],programTransitions:[],slowRenders:[],slowGlCalls:[]};
  let diagnosticPhase='boot';
  const programInfo=()=>view.renderer.info.programs.map(p=>({id:p.id,name:p.name,cacheKey:p.cacheKey}));
  const batchInfo=()=>[...view.structures].map(([kind,motion])=>({kind,ready:!!motion.batch,parts:(motion.batch?.parts??[]).map(p=>({name:p.name,count:p.count,visible:p.visible,instanceColor:!!p.instanceColor,colorCount:p.instanceColor?.count??0}))}));
  const enemyInfo=()=>Object.fromEntries([...new Set(world?.enemies.map(e=>e.kind)??[])].map(kind=>[kind,world.enemies.filter(e=>e.kind===kind).length]));
  const snapshot=(label)=>({label,ms:measuring?performance.now()-began:null,gameTime:world?.time,enemyKinds:enemyInfo(),programs:programInfo(),batches:batchInfo()});
  const seenKinds=new Set();
  if(diagnostics&&index===0){
    const gl=view.renderer.getContext();
    for(const name of ['compileShader','linkProgram','getProgramParameter','getShaderParameter','getProgramInfoLog','getShaderInfoLog','getActiveUniform','getUniformLocation','getActiveAttrib','getAttribLocation','useProgram','drawElementsInstanced','drawArraysInstanced','drawElements','texImage2D','texSubImage2D','bufferData','bufferSubData']){
      const original=gl[name];if(typeof original!=='function')continue;
      gl[name]=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{const ms=performance.now()-start;if(ms>50&&diagnostic.slowGlCalls.length<128)diagnostic.slowGlCalls.push({name,durationMs:ms,phase:diagnosticPhase,ms:measuring?performance.now()-began:null,gameTime:world?.time,enemyKinds:enemyInfo()});}};
    }
  }
  const net=new FrontNetwork(endpoint); net.clearedStage=0;
  net.equip=frontTemporaryWeapons('live',String(index),['rifle','smg']);
  let world,seq=0,previous=performance.now(),measuring=false,began=0,lastWorld=0,lastSample=0,nextReload=0;
  let cachedInput=neutral(),previousReload=0,previousAmmo,lastEvent=0,lastPhase='',highestAck=0;
  const sentAt=new Map(),receivedSentAt=new Map(),chosen=new Set(),frames=[],renderCpu=[],pilotCpu=[],intervals=[],ackRtt=[],ackEvents=[],inputEvents=[],inputWindowEvents=[],glProbes=[],longFrames=[],receiptAckRtt=[],receiptAckEvents=[],samples=[],phases=[],statuses=[],errors=[],glErrors=[];
  let highestReceiptAck=0;
  const counters={updates:0,firsts:0,sent:0,fire:0,move:0,reloadSent:0,reloadStarted:0,ammoSpentObserved:0,shotsObserved:0,hitsObserved:0,invalidInputs:0,neutralAck:0,maxUnacked:0};
  const clean=(v)=>String(v).replace(/[a-f0-9]{32,64}/gi,'[redacted]');
  const acknowledge=net.inputWindow.acknowledge.bind(net.inputWindow);
  net.inputWindow.acknowledge=(seq,receivedAt)=>{
    const sent=net.inputWindow.sentAt.get(seq),before=net.inputWindow.limit;
    acknowledge(seq,receivedAt);
    if(networkTiming&&measuring&&sent!==undefined)inputWindowEvents.push({ms:performance.now()-began,seq,sentEpochMs:sent,receivedServerMs:typeof receivedAt==='number'?receivedAt*1000:null,excessMs:typeof receivedAt==='number'?receivedAt*1000-sent-net.inputWindow.minimumLag:null,before,after:net.inputWindow.limit});
  };
  function probeGl(label){
    const at=performance.now(),error=view.renderer.getContext().getError(),durationMs=performance.now()-at;
    glProbes.push({label,ms:at-began,durationMs,error});
    if(error)glErrors.push({ms:at-began,error});
  }
  const send=net.send.bind(net);
  net.send=(value)=>{
    if(value?.type==='input'&&measuring){
      if(${releaseAfterSeconds}>0&&performance.now()-began>=${releaseAfterSeconds}*1000)value={...value,input:{...neutral(),seq:value.input.seq}};
      counters.sent++;if(value.input.fire)counters.fire++;if(value.input.mx||value.input.mz)counters.move++;if(value.input.reload)counters.reloadSent++;
      sentAt.set(value.input.seq,performance.now());counters.maxUnacked=Math.max(counters.maxUnacked,sentAt.size);
      if(networkTiming){receivedSentAt.set(value.input.seq,performance.now());inputEvents.push({seq:value.input.seq,ms:performance.now()-began,epochMs:Date.now(),gameTime:world?.time,phase:net.frontView?.phase,resumeUntil:net.frontView?.resumeUntil,serverNow:net.serverNow,inputWindow:net.inputWindow.limit,fire:value.input.fire,moving:!!(value.input.mx||value.input.mz)});}
    }
    return send(value);
  };
  net.onStatus=(text,fatal)=>{statuses.push({ms:measuring?performance.now()-began:null,text:clean(text),fatal});if(fatal)errors.push(clean(text));};
  net.onWorld=(value,first)=>{
    const now=performance.now(),p=value.players.find(p=>p.id===net.id),phase=net.frontView?.phase;
    world=value;
    if(measuring){
      counters.updates++;if(first)counters.firsts++;
      if(lastWorld)intervals.push(now-lastWorld);lastWorld=now;
      if(phase!==lastPhase){phases.push({ms:now-began,phase,time:value.time,resumeUntil:net.frontView?.resumeUntil,serverNow:net.serverNow});lastPhase=phase;net.discardPendingInput();}
      if(p){
        if(p.reload>0&&previousReload<=0)counters.reloadStarted++;
        if(previousAmmo!==undefined&&p.ammo[p.slot]<previousAmmo)counters.ammoSpentObserved+=previousAmmo-p.ammo[p.slot];
        previousReload=p.reload;previousAmmo=p.ammo[p.slot];
        if(p.ack===0&&counters.sent>0&&(phase==='combat'||phase==='boss'))counters.neutralAck++;
        if(Number.isSafeInteger(p.ack)&&p.ack>highestAck){if(sentAt.has(p.ack)){const rtt=now-sentAt.get(p.ack);ackRtt.push(rtt);if(networkTiming)ackEvents.push({seq:p.ack,ms:now-began,sentMs:sentAt.get(p.ack)-began,rtt,gameTime:value.time,phase,resumeUntil:net.frontView?.resumeUntil,serverNow:net.serverNow});}highestAck=p.ack;for(const key of sentAt.keys())if(key<=p.ack)sentAt.delete(key);}
      }
      for(const event of value.events){if(event.id<=lastEvent)continue;if(event.owner===net.id){if(event.type==='shot')counters.shotsObserved++;if(event.type==='hit')counters.hitsObserved++;}lastEvent=Math.max(lastEvent,event.id);}
      samples.push({ms:now-began,...(networkTiming?{receivedEpochMs:Date.now(),serverNow:net.serverNow,resumeUntil:net.frontView?.resumeUntil}:{}),time:value.time,phase,enemies:value.enemies.length,projectiles:value.projectiles.length,totalKills:value.totalKills,hp:p?.hp,x:p?.x,z:p?.z,kills:p?.kills,ammo:p?.ammo[p.slot],reload:p?.reload,ack:p?.ack,highestSent:seq,unacked:sentAt.size,buffered:net.ws?.bufferedAmount??0,inputWindow:net.inputWindow.limit,
        drawCalls:view.renderer.info.render.calls,triangles:view.renderer.info.render.triangles,renderFrame:view.renderer.info.render.frame,adaptiveScale:view.adaptiveQuality.scale});
    }
    const offer=net.frontView?.offer;
    if(offer&&!chosen.has(offer.id)){chosen.add(offer.id);net.send({type:'frontChoose',request:{runId:value.run,offerId:offer.id,revision:offer.revision,requestId:offer.id+':'+net.id,cardId:offer.defaultCardId}});}
  };
  net.connect(code);
  if(networkTiming)net.ws.addEventListener('message',event=>{
    if(!measuring)return;
    const value=JSON.parse(event.data);
    if(value.type!=='state'||!Number.isSafeInteger(value.inputAck)||value.inputAck<=highestReceiptAck)return;
    const now=performance.now(),sent=receivedSentAt.get(value.inputAck);
    if(sent!==undefined){const rtt=now-sent;receiptAckRtt.push(rtt);receiptAckEvents.push({seq:value.inputAck,ms:now-began,sentMs:sent-began,rtt,receivedEpochMs:Date.now(),serverNow:value.serverNow,phase:value.frontView?.phase,appliedAck:world?.players.find(p=>p.id===net.id)?.ack});}
    highestReceiptAck=value.inputAck;for(const key of receivedSentAt.keys())if(key<=value.inputAck)receivedSentAt.delete(key);
  });
  function inputActive(){
    if(!world)return false;
    const phase=net.frontView?.phase,p=world.players.find(p=>p.id===net.id);
    return !document.hidden&&!net.closed&&net.ws?.readyState===1&&p?.hp>0&&(phase==='combat'||phase==='boss')&&Date.now()/1000+net.clockOffset>=net.frontView.resumeUntil;
  }
  net.setInputSource(()=>{
    if(!inputActive())return;
    const now=performance.now(),p=world.players.find(p=>p.id===net.id);
    const start=performance.now();cachedInput=pilot(world,net.id);if(measuring)pilotCpu.push(performance.now()-start);
    if(measuring&&now>=nextReload&&p.ammo[p.slot]<stats(p.weapons[p.slot]).mag&&p.reload<=0&&p.swapCd<=0){cachedInput.reload=true;nextReload=now+9000;}
    const input={...cachedInput,seq:++seq,yaw:Math.atan2(Math.sin(cachedInput.yaw),Math.cos(cachedInput.yaw)),pitch:clampPitch(cachedInput.pitch)};
    cachedInput.reload=false;
    if(validInput(input))return input;
    counters.invalidInputs++;errors.push('invalid pilot input');
  });
  function frame(now){
    requestAnimationFrame(frame);
    const wallDt=Math.max(0,(now-previous)/1000),dt=Math.min(.1,wallDt);previous=now;
    if(networkTiming&&measuring&&wallDt>.1)longFrames.push({ms:now-began,durationMs:wallDt*1000,gameTime:world?.time,phase:net.frontView?.phase,enemyKinds:enemyInfo()});
    if(measuring)frames.push(wallDt*1000);
    if(!world)return;
    const active=inputActive();
    const before=view.renderer.info.render.frame;
    const beforePrograms=diagnostics?view.renderer.info.programs.map(p=>p.id):[];
    const newKinds=diagnostics?[...new Set(world.enemies.map(e=>e.kind))].filter(kind=>!seenKinds.has(kind)):[];
    if(newKinds.length){for(const kind of newKinds)seenKinds.add(kind);diagnostic.snapshots.push(snapshot('before-first-'+newKinds.join('+')));}
    diagnosticPhase='render';
    const start=performance.now();
    if(renderEnabled)view.render(world,net.id,dt,cachedInput.yaw,cachedInput.pitch,undefined,active);
    const durationMs=performance.now()-start;diagnosticPhase='between-frames';
    if(measuring&&view.renderer.info.render.frame!==before)renderCpu.push(durationMs);
    if(diagnostics){
      if(newKinds.length)diagnostic.snapshots.push(snapshot('after-first-'+newKinds.join('+')));
      const added=programInfo().filter(p=>!beforePrograms.includes(p.id));
      if(added.length&&diagnostic.programTransitions.length<128)diagnostic.programTransitions.push({ms:measuring?performance.now()-began:null,gameTime:world.time,enemyKinds:enemyInfo(),durationMs,beforeCount:beforePrograms.length,afterCount:view.renderer.info.programs.length,added});
      if(durationMs>500&&diagnostic.slowRenders.length<128)diagnostic.slowRenders.push({...snapshot('render-over-500ms'),durationMs,beforeProgramIds:beforePrograms,addedProgramIds:added.map(p=>p.id)});
    }
    if(measuring&&${JSON.stringify(glProbeMode)}==='interval'&&now-lastSample>=1000){probeGl('interval');lastSample=now;}
  }requestAnimationFrame(frame);
  window.live={
    prepare:async()=>{
      if(!renderEnabled){net.setAssetReady(true);return{ms:0,preparationSkippedForNetworkIsolation:true};}
      const run=createFrontRun({runId:'live-preview',seed:4520,mode:'survival',fusion:true,clearedStage:0,players:net.members.filter(m=>m.connected).map(m=>({id:m.id,equipment:net.equip}))},Date.now()/1000);
      diagnosticPhase='prepare';
      if(diagnostics)diagnostic.snapshots.push(snapshot('before-prepare'));
      const worldBefore=JSON.stringify(run.world);
      const start=performance.now();await prepareBattle(view,run.world,net.id,()=>false);
      const preparationRestored=JSON.stringify(run.world)===worldBefore&&[...view.structures.values()].every(s=>!s.batch||(s.batch.group.visible===false&&s.batch.parts.every(p=>p.count===0)))&&view.spawnEffects.preparationRoots.every(root=>!root.visible)&&view.bastion.preparationRoots.every(root=>root.isInstancedMesh?root.count===0:!root.visible)&&!view.renderer.getScissorTest();
      if(!preparationRestored)throw Error('Preparation changed preview World or left temporary draws enabled');
      if(diagnostics)diagnostic.snapshots.push(snapshot('after-prepare'));
      diagnosticPhase='prepared';
      net.setAssetReady(true);return{ms:performance.now()-start,actors:run.world.players.length,preparationRestored,programCount:view.renderer.info.programs.length,...(diagnostics?{batches:batchInfo()}: {})};
    },
    ready:()=>!!net.id&&net.members.length===4&&net.members.every(m=>m.connected&&m.weapons?.length===2),
    allReady:()=>net.members.length===4&&net.members.every(m=>m.ready),
    start:()=>net.send({type:'start'}),phase:()=>net.frontView?.phase,
    begin:()=>{if(${inputWindowOverride}>0)Object.defineProperty(net.inputWindow,"limit",{get:()=>${inputWindowOverride}});measuring=true;began=performance.now();lastWorld=0;lastPhase='';nextReload=began+9000;lastEvent=world?.eventSerial??0;return{at:began,time:world?.time};},
    progress:()=>({updates:counters.updates,time:world?.time,phase:net.frontView?.phase,hp:world?.players.find(p=>p.id===net.id)?.hp,kills:world?.players.find(p=>p.id===net.id)?.kills}),
    failureState:()=>({ready:net.assetReady,closed:net.closed,ws:net.ws?.readyState,generation:net.preparationGeneration,members:net.members.map(m=>({connected:m.connected,ready:m.ready})),statuses,errors,diagnostic}),
    end:()=>{const wallMs=performance.now()-began;measuring=false;probeGl('end');const gl=view.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');return{wallMs,counters,frames,renderCpu,pilotCpu,intervals,ackRtt,ackEvents,inputEvents,inputWindowEvents,glProbes,longFrames,receiptAckRtt,receiptAckEvents,samples,phases,statuses,errors,glErrors,diagnostic,remainingUnacked:sentAt.size,webSocketExtensions:net.ws?.extensions??null,renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),viewport:{width:innerWidth,height:innerHeight},renderSize:{width:view.renderer.domElement.width,height:view.renderer.domElement.height}};},
    close:()=>net.close(),
  };
};`,
  },
  bundle: true,
  write: false,
  outfile: path.join(output, "live-browser.js"),
  format: "iife",
  platform: "browser",
  define: { "import.meta.env.BASE_URL": '"/"', "import.meta.env.DEV": "false" },
  logLevel: "silent",
});
const javascript = bundle.outputFiles.find((file) =>
  file.path.endsWith(".js"),
).text;
fs.writeFileSync(path.join(output, "live-browser.js"), javascript);
fs.writeFileSync(
  path.join(output, "method.json"),
  JSON.stringify(
    {
      seconds,
      diagnostics,
      profileEnabled,
      networkTiming,
      renderEnabled,
      renderClients,
      linkConfig: result.linkConfig,
      method: result.method,
      sourceBefore,
    },
    null,
    2,
  ),
);
if (process.argv.includes("--prepare-only")) {
  console.log(JSON.stringify({ prepared: true, output, seconds }));
  process.exit(0);
}
const publicRoot = path.resolve("public"),
  pages = [],
  browsers = [];
const server = createServer((request, response) => {
  if (request.url === "/live") {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.end(
      `<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><style>body{margin:0}canvas{width:100vw;height:100vh;display:block}${damageStyles}</style><canvas></canvas><div id="damage" aria-hidden="true"></div>`,
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
    file.endsWith(".glb")
      ? "model/gltf-binary"
      : file.endsWith(".png")
        ? "image/png"
        : "application/octet-stream",
  );
  response.end(fs.readFileSync(file));
});
let measuring = false,
  serverStarted = false,
  profiler,
  shaper;
try {
  const health = await fetch(endpoint + "/api/health");
  assert.equal(health.status, 200, "Local Worker unavailable");
  if (shapeLink) {
    const { createLocalWebSocketShaper } =
      await import("./local-websocket-shaper.mjs");
    shaper = await createLocalWebSocketShaper({
      upstream: endpoint,
      origin,
      ...result.linkConfig,
    });
  }
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(5186, "127.0.0.1", resolve);
  });
  serverStarted = true;
  const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
    fs.readFileSync(".dev.vars", "utf8"),
  )?.[1];
  assert.ok(key, "Local credential unavailable");
  const created = await fetch(endpoint + "/rooms", {
    method: "POST",
    headers: {
      "X-Room-Creation-Key": key,
      "X-Test-Client": createHash("sha256")
        .update("live-" + Date.now())
        .digest("hex"),
    },
    body: JSON.stringify({
      name: "隔離通常生存検証",
      listed: false,
      ruleset: "front-v1",
      mode: "survival",
    }),
  });
  assert.equal(created.status, 200, "Local room creation failed");
  const { code } = await created.json();
  for (let index = 0; index < 4; index++) {
    const browser = await chromium.launch({
      channel: "chrome",
      args: [
        "--use-angle=d3d11",
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
      recordError({
        client: index,
        type: "pageerror",
        message: redact(error.message),
      }),
    );
    page.on("console", (message) => {
      if (message.type() === "error" && result.errors.length < 30)
        recordError({
          client: index,
          type: "console",
          message: redact(message.text()),
        });
    });
    page.on("websocket", (socket) => {
      socket.on("framereceived", ({ payload }) => {
        const text = payload.toString();
        const m = JSON.parse(text);
        if (m.type === "welcome")
          result.wire[index].negotiatedStateFlow = m.stateFlow === true;
        if (!measuring) return;
        if (m.type === "state" || m.type === "stateChunk") {
          const w = result.wire[index];
          w.states += m.type === "state" ? 1 : 0;
          w.chunks += m.type === "stateChunk" ? 1 : 0;
          w.maxBytes = Math.max(w.maxBytes, Buffer.byteLength(text));
          w.omittedMax = Math.max(
            w.omittedMax,
            m.omitted?.enemies?.length ?? 0,
          );
        }
        if (m.type === "error")
          recordError({
            client: index,
            type: "server",
            message: redact(m.reason),
          });
      });
      socket.on("close", () => {
        if (measuring) result.wire[index].closes++;
      });
    });
    await page.goto(origin + "/live");
    await page.addScriptTag({ content: javascript });
    await page.evaluate(
      ({ endpoint, code, index, diagnostics, networkTiming, renderEnabled }) =>
        boot(endpoint, code, index, diagnostics, networkTiming, renderEnabled),
      {
        endpoint: shaper?.endpoint ?? endpoint,
        code,
        index,
        diagnostics,
        networkTiming,
        renderEnabled: index < renderClients,
      },
    );
  }
  await Promise.all(
    pages.map((page) => page.waitForFunction(() => live.ready())),
  );
  result.preparations = await Promise.all(
    pages.map((page) => page.evaluate(() => live.prepare())),
  );
  if (profileEnabled) {
    profiler = await pages[0].context().newCDPSession(pages[0]);
    await profiler.send("Profiler.enable");
    await profiler.send("Profiler.setSamplingInterval", { interval: 1000 });
    await profiler.send("Profiler.start");
  }
  await pages[0].waitForFunction(() => live.allReady());
  await pages[0].evaluate(() => live.start());
  await Promise.all(
    pages.map((page) => page.waitForFunction(() => live.phase() === "combat")),
  );
  result.beginnings = await Promise.all(
    pages.map((page) => page.evaluate(() => live.begin())),
  );
  measuring = true;
  const started = performance.now();
  while (performance.now() - started < seconds * 1000) {
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.min(15000, seconds * 1000 - (performance.now() - started)),
      ),
    );
    const progress = await Promise.all(
      pages.map((page) => page.evaluate(() => live.progress())),
    );
    result.progress.push({
      wallMs: performance.now() - started,
      clients: progress,
    });
    console.log(
      JSON.stringify({
        liveSeconds: +((performance.now() - started) / 1000).toFixed(1),
        clients: progress.map((p) => ({
          updates: p.updates,
          time: p.time,
          phase: p.phase,
          hp: p.hp,
          kills: p.kills,
        })),
      }),
    );
  }
  measuring = false;
  const raw = await Promise.all(
    pages.map((page) => page.evaluate(() => live.end())),
  );
  if (profiler) {
    const { profile } = await profiler.send("Profiler.stop");
    fs.writeFileSync(
      path.join(output, "client-0.cpuprofile"),
      JSON.stringify(profile),
    );
    await profiler.send("Profiler.disable");
    await profiler.detach();
    profiler = undefined;
  }
  result.observationCompleted = true;
  for (let index = 0; index < raw.length; index++) {
    const data = raw[index];
    fs.writeFileSync(
      path.join(output, `client-${index}-samples.json`),
      JSON.stringify(data, null, 2),
    );
    const first = data.samples[0],
      last = data.samples.at(-1);
    result.clients.push({
      client: index,
      wallMs: data.wallMs,
      gameSeconds: (last?.time ?? 0) - (first?.time ?? 0),
      receiveWindowMs: (last?.ms ?? 0) - (first?.ms ?? 0),
      frames: summary(data.frames),
      renderCpu: summary(data.renderCpu),
      pilotCpu: summary(data.pilotCpu),
      worldIntervals: summary(data.intervals),
      ackObservedRtt: summary(data.ackRtt),
      receiptAckRtt: summary(data.receiptAckRtt),
      counters: data.counters,
      phases: data.phases,
      first,
      last,
      remainingUnacked: data.remainingUnacked,
      webSocketExtensions: data.webSocketExtensions,
      diagnostic: data.diagnostic,
      errors: data.errors,
      glErrors: data.glErrors,
      renderer: data.renderer,
      viewport: data.viewport,
      renderSize: data.renderSize,
    });
    await pages[index].screenshot({
      path: path.join(output, `client-${index}.png`),
    });
  }
  result.passed =
    result.errors.length === 0 &&
    result.clients.every(
      (client) =>
        client.counters.updates > 10 &&
        client.counters.fire > 0 &&
        client.counters.move > 0 &&
        client.counters.reloadStarted > 0 &&
        client.counters.invalidInputs === 0 &&
        client.errors.length === 0 &&
        client.glErrors.length === 0,
    ) &&
    result.wire.every(
      (w) => w.closes === 0 && w.maxBytes <= 65536 && w.negotiatedStateFlow,
    );
} catch (error) {
  result.failure = redact(error.stack ?? error);
  result.failureStates = await Promise.all(
    pages.map(async (page) => {
      try {
        return await page.evaluate(() => window.live?.failureState());
      } catch {
        return { unavailable: true };
      }
    }),
  );
  process.exitCode = 1;
} finally {
  measuring = false;
  result.sourceAfter = hashes();
  result.sourcesStable = Object.keys(sourceBefore).every(
    (file) => sourceBefore[file] === result.sourceAfter[file],
  );
  if (!result.sourcesStable) result.passed = false;
  if (!result.passed) process.exitCode = 1;
  result.headAfter = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  for (const page of pages)
    await page.evaluate(() => live?.close()).catch(() => {});
  for (const browser of browsers) await browser.close().catch(() => {});
  if (shaper) {
    await shaper.close();
    result.link = shaper.metrics;
    if (shaper.metrics.connections.some((connection) => connection.failure)) {
      result.passed = false;
      process.exitCode = 1;
    }
  }
  if (serverStarted) await new Promise((resolve) => server.close(resolve));
  fs.writeFileSync(
    path.join(output, "results.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(
    JSON.stringify({
      passed: result.passed,
      observationCompleted: result.observationCompleted,
      sourcesStable: result.sourcesStable,
      errors: result.errors,
      failure: result.failure,
      clients: result.clients.map((c) => ({
        client: c.client,
        gameSeconds: c.gameSeconds,
        worldIntervals: c.worldIntervals,
        frames: c.frames,
        ackObservedRtt: c.ackObservedRtt,
        receiptAckRtt: c.receiptAckRtt,
        counters: c.counters,
        firstHp: c.first?.hp,
        lastHp: c.last?.hp,
        lastKills: c.last?.kills,
      })),
    }),
  );
}
