import {chromium} from '@playwright/test';import {readFileSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
const key=/^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(readFileSync('.dev.vars','utf8'))?.[1];if(!key)throw Error('Local test credential unavailable');
const api='http://127.0.0.1:8934',dir='dist-validation/trooper-run';
const created=await fetch(api+'/rooms',{method:'POST',headers:{'X-Room-Creation-Key':key}});assert.equal(created.status,200);const {code}=await created.json();
const b=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});const pages=[],errors=[];
try{
 for(let index=0;index<2;index++){
  const p=await b.newPage({viewport:{width:640,height:400},serviceWorkers:'block'});pages.push(p);p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:5314/e2e/structure-fixture.html');
  await p.evaluate(async({code,index})=>{
   const {STARTERS}=await import('/src/shared/defs.ts'),{neutral}=await import('/src/shared/game.ts'),{Renderer}=await import('/src/client/render.ts'),{loadStandardTrooper}=await import('/src/client/standard-trooper.ts');
   await loadStandardTrooper();const canvas=document.createElement('canvas'),damage=document.createElement('div');damage.id='damage';damage.style.cssText='position:fixed;inset:0;pointer-events:none';document.body.append(canvas,damage);window.view=new Renderer(canvas);window.historyStates=[];window.modes=[];window.input=neutral();window.sequence=0;window.dodged=false;
   const socket=new WebSocket(`ws://127.0.0.1:8934/rooms/${code}`);window.socket=socket;
   await new Promise((resolve,reject)=>{
    socket.onerror=()=>reject(Error('WebSocket failure'));socket.onopen=()=>socket.send(JSON.stringify({type:'hello'}));
    socket.onmessage=event=>{const m=JSON.parse(event.data);if(m.type==='welcome'){window.member=m.id;socket.send(JSON.stringify({type:'equip',weapons:STARTERS.slice(0,2)}))}if(m.type==='lobby'&&m.members.find(p=>p.id===window.member)?.ready)resolve();if(m.type==='state'){window.world=m.world;window.historyStates.push(m.world);if(index===1&&!window.dodged&&m.world.enemies[0]?.wind>0&&m.world.enemies[0].wind<.21){window.dodged=true;window.input.dodge=true;window.sendInput()}if(window.historyStates.length>160)window.historyStates.shift()}};
   });
   window.sendInput=()=>{socket.send(JSON.stringify({type:'input',input:{...window.input,seq:++window.sequence}}));window.input.swap=false;window.input.dodge=false};
   window.sender=setInterval(window.sendInput,60);
   let previous=performance.now(),dodged=false;
   function draw(now){window.frame=requestAnimationFrame(draw);const dt=Math.min(.1,(now-previous)/1000);previous=now;const w=window.world;if(w){window.view.render(w,window.member,dt,0,0);const model=window.view.players.get(window.member)?.userData.trooper;if(model){window.modes.push({time:w.time,mode:model.mode});if(window.modes.length>600)window.modes.shift()}}}requestAnimationFrame(draw);
  },{code,index});
 }
 assert.ok((await fetch(`${api}/fixtures/${code}/trooper`,{method:'POST'})).ok);
  await Promise.all(pages.map(p=>p.waitForFunction(()=>window.world?.players.length===2&&view.players.size===2&&[...view.players.values()].every(p=>p.userData.trooper))));
  await Promise.all(pages.map(p=>p.waitForTimeout(2000)));
  await Promise.all(pages.map(p=>p.evaluate(()=>{window.historyStates=[];window.modes=[];window.dodged=false;})));
  assert.ok((await fetch(`${api}/fixtures/${code}/trooper`,{method:'POST'})).ok);
  await pages[0].evaluate(()=>{window.input.swap=true;window.input.fire=true;window.sendInput()});
  await pages[0].waitForFunction(()=>world.players.find(p=>p.id===member).slot===1,null,{timeout:8000});
 await pages[0].waitForFunction(()=>modes.some(s=>s.mode==='heavy'||s.mode==='switch_heavy'),{timeout:15000});
 await pages[0].screenshot({path:`${dir}/network-heavy.png`});await pages[1].screenshot({path:`${dir}/network-evaded.png`});
 await pages[0].waitForFunction(()=>historyStates.some(w=>w.players.find(p=>p.id===member).ammo[1]<7));
 const data=await Promise.all(pages.map(p=>p.evaluate(()=>({id:member,states:historyStates.filter(w=>w.run===world.run),modes,models:[...view.players.values()].map(m=>({bones:m.userData.trooper?.bones.length,loaded:!!m.userData.trooper}))}))));
 const victim=data[0].id,evader=data[1].id;
 const impact=data[0].states.find(w=>w.players.find(p=>p.id===victim).heavyHit>0&&data[1].states.some(v=>v.time===w.time));assert.ok(impact);
 assert.equal(impact.players.find(p=>p.id===evader).hp,160);assert.equal(impact.players.find(p=>p.id===evader).heavyHit??0,0);
 const peer=data[1].states.find(w=>w.time===impact.time);assert.deepEqual(peer.players,impact.players);
 const blocked=data[0].states.filter(w=>{const p=w.players.find(p=>p.id===victim);return p.slot===1&&p.swapCd>0});assert.ok(blocked.length>=3);assert.ok(blocked.every(w=>w.players.find(p=>p.id===victim).ammo[1]===7));
 assert.ok(data.every(d=>d.models.length===2&&d.models.every(m=>m.bones===24&&m.loaded)));assert.deepEqual(errors,[]);
 writeFileSync(`${dir}/network-validation.json`,JSON.stringify({realWorker:true,clients:2,fixture:'boss telegraph placement only; real damage, dodge, inputs and WebSockets',impact,blockedSnapshots:blocked.length,models:data.map(d=>d.models),heavyRendered:data[0].modes.some(m=>m.mode.includes('heavy')),errors},null,2));console.log('PASS: 2 real Worker clients, authoritative switch fire gate, heavy hit and dodge immunity, both skinned players rendered');
}catch(error){console.log('BROWSER_ERRORS',errors);writeFileSync(`${dir}/network-failure.json`,JSON.stringify({errors,pages:await Promise.all(pages.map(p=>p.evaluate(()=>({input:window.input,member:window.member,players:window.world?.players,modes:window.modes?.slice(-8)}))))},null,2));throw error;}finally{await b.close()}


