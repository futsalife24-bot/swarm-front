import { createServer } from 'vite';import fs from 'node:fs';import assert from 'node:assert/strict';
const vite=await createServer({server:{middlewareMode:true}}),clients=[];
const g=await vite.ssrLoadModule('/src/shared/game.ts'),{STARTERS}=await vite.ssrLoadModule('/src/shared/defs.ts'),{CombatAudio}=await vite.ssrLoadModule('/src/client/combat-audio.ts');
const key=/^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(fs.readFileSync('.dev.vars','utf8'))?.[1];if(!key)throw Error('Local test credential unavailable');
const api='http://127.0.0.1:8789';
async function wait(fn,label){const until=Date.now()+15000;while(Date.now()<until){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,50))}throw Error('Timeout '+label)}
try {
 const response=await fetch(api+'/rooms',{method:'POST',headers:{'X-Room-Creation-Key':key}});assert.equal(response.status,200);const {code}=await response.json();
 for(let i=0;i<2;i++){
  const c={ws:new WebSocket(`ws://127.0.0.1:8789/rooms/${code}`),id:null,states:[],cues:[],audio:new CombatAudio(),errors:[]};clients.push(c);
  c.ws.onopen=()=>c.ws.send(JSON.stringify({type:'hello'}));c.ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.type==='welcome'){c.id=m.id;c.ws.send(JSON.stringify({type:'equip',weapons:STARTERS.slice(0,2)}))}if(m.type==='state'){c.states.push(m.world);c.cues.push(...c.audio.collect(m.world))}if(m.type==='error')c.errors.push(m.message??m.error)};
  await wait(()=>c.id,'join');
 }
 assert.ok((await fetch(`${api}/fixtures/${code}/trooper`,{method:'POST'})).ok);
 await wait(()=>clients.every(c=>c.states.some(w=>w.run.startsWith('fixture-'))),'fixture');
 const sender=clients[0],w=sender.states.at(-1),p=w.players.find(p=>p.id===sender.id),e=w.enemies[0];
 const input={...g.neutral(),seq:1,fire:true,yaw:Math.atan2(e.x-p.x,-(e.z-p.z)),pitch:Math.atan2(g.eye(e)-((p.y??0)+1.5),Math.hypot(e.x-p.x,e.z-p.z))};
 sender.ws.send(JSON.stringify({type:'input',input}));
 await wait(()=>clients.every(c=>c.cues.some(q=>q.type==='impactHard')),'both clients material hit');
 sender.ws.send(JSON.stringify({type:'input',input:{...input,seq:2,fire:false}}));
 const hit=sender.states.flatMap(w=>w.events).find(e=>e.type==='hit'&&e.weapon==='rifle');assert.equal(hit.enemyKind,'boss');
 const peer=clients[1].states.flatMap(w=>w.events).find(e=>e.id===hit.id&&e.type==='hit');assert.deepEqual(peer,hit);assert.ok(clients.every(c=>!c.errors.length));
 fs.writeFileSync('dist-validation/ar-hit/network.json',JSON.stringify({realWorker:true,clients:2,hit,peerMatches:true,cues:clients.map(c=>c.cues.filter(q=>q.type.startsWith('impact'))),errors:clients.map(c=>c.errors)},null,2));console.log('PASS 2 real WebSockets, identical rifle/boss hit, both clients impactHard');
} finally {for(const c of clients)c.ws.close();await vite.close()}
