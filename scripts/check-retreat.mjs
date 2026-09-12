import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
// Route-only fixtures: no production debug hooks, mission cheats or network mocks.
const base=process.argv[2]??'http://127.0.0.1:5198',out='dist-validation/retreat-fix';
const b=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:844,height:390},serviceWorkers:'block'}),errors=[];
p.on('pageerror',e=>errors.push(e.message));
await p.route('**/src/main.ts*',async r=>{const x=await r.fetch();await r.fulfill({response:x,body:(await x.text())+'\nwindow.__testState=()=>({world,view});\n'})});
const state=()=>p.evaluate(()=>({screen:window.__swarm.screen,time:window.__swarm.world?.time,camera:window.__swarm.camera}));
async function launch(stage){await p.locator('#solo').click();await p.locator('#stage-select').selectOption(String(stage));await p.locator('#launch').click();await p.waitForFunction(()=>window.__swarm.world?.time>.2)}
async function retreat(){await p.locator('#pause').click();const t=(await state()).time;await p.waitForTimeout(200);assert.equal((await state()).time,t);await p.locator('#pause-leave').click();await p.locator('#pause-quit').click();await p.locator('#home').click();await p.waitForFunction(()=>window.__swarm.camera.x===8&&window.__swarm.camera.z===30);assert.equal((await state()).screen,'title');}
const report={base,cases:[],errors};
try{
 await p.goto(base);await launch(16);await retreat();await launch(20);await retreat();report.cases.push('ordinary ST16/ST20 pause, retreat and redeploy');
 await launch(16);
 await p.evaluate(async()=>{const {world:w}=window.__testState(),{spawn,event}=await import('/src/shared/game.ts');w.enemies=[];for(let i=0;i<40;i++){const a=i*Math.PI*2/40;spawn(w,['crawler','ant','spider','spitter','hornet','boss'][i%6],w.players[0].x+8*Math.sin(a),w.players[0].z+8*Math.cos(a),i%12===5?'worm':'crown');}w.players[0].hp=10000;event(w,{type:'kill',x:0,y:1,z:30});event(w,{type:'hit',owner:'solo',amount:100,x:0,y:1,z:30});});
 await p.waitForFunction(()=>{const {view}=window.__testState();return ['crawler','ant','spider'].every(k=>view.structures.get(k)?.batch?.group.visible)});
 const variants=await p.evaluate(()=>{const {view}=window.__testState();return ['crawler','ant','spider'].map(k=>{const m=view.structures.get(k);return {kind:k,count:m.batch.parts[0].count,legacyVisible:view.enemies.get(k).visible,sameAsset:m.batch.asset===view.structures.get('crawler').batch.asset};})});for(const v of variants){assert(v.count>0);assert.equal(v.legacyVisible,false);assert(v.sameAsset)}report.variants=variants;
 await p.screenshot({path:out+'/crowd.png'});await retreat();
 const clean=await p.evaluate(()=>{const {view:v}=window.__testState();return {players:v.players.size,effects:v.effects.length,floaters:v.floaters.length,visual:v.visual.size,combat:v.combat.items.length,particles:v.particles.count,structures:[...v.structures.values()].every(m=>m.controller.states.size===0&&!m.batch?.group.visible)}});assert.deepEqual(clean,{players:0,effects:0,floaters:0,visual:0,combat:0,particles:0,structures:true});report.cleanup=clean;report.cases.push('40-enemy mixed crowd, worm coexistence, full exit cleanup');
 await launch(16);await p.evaluate(()=>{const {view}=window.__testState(),render=view.render;view.render=function(...args){view.render=render;throw Error('Injected transient render failure')}});await p.waitForTimeout(300);await retreat();await launch(16);const a=(await state()).time;await p.waitForFunction(t=>window.__swarm.world.time>t+.2,a);report.cases.push('one-shot render exception cannot freeze home or later sorties');await retreat();
 assert.deepEqual(errors,['Injected transient render failure']);await p.screenshot({path:out+'/recovered-home.png'});report.pass=true;writeFileSync(out+'/regression.json',JSON.stringify(report,null,2));console.log('RETREAT PASS',JSON.stringify(report));
}finally{await b.close()}
