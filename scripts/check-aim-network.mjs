import {createServer} from 'vite';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const vite=await createServer({server:{middlewareMode:true}});
const g=await vite.ssrLoadModule('/src/shared/game.ts');
const {STARTERS}=await vite.ssrLoadModule('/src/shared/defs.ts');
const key=/^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(readFileSync('.dev.vars','utf8'))?.[1];
if(!key)throw Error('Local test credential unavailable');
const api='http://127.0.0.1:8789',clients=[];
const waitFor=async(predicate,label)=>{const until=Date.now()+15000;while(Date.now()<until){const value=predicate();if(value)return value;await new Promise(r=>setTimeout(r,40));}throw Error('Timeout: '+label)};
try {
  const response=await fetch(api+'/rooms',{method:'POST',headers:{'X-Room-Creation-Key':key}});
  assert.equal(response.status,200);const {code}=await response.json();
  for(let index=0;index<2;index++) {
    const client={ws:new WebSocket(`ws://127.0.0.1:8789/rooms/${code}`),id:null,states:[],errors:[]};clients.push(client);
    client.ws.onopen=()=>client.ws.send(JSON.stringify({type:'hello'}));
    client.ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.type==='welcome'){client.id=m.id;client.ws.send(JSON.stringify({type:'equip',weapons:[STARTERS[2],STARTERS[0]]}));}if(m.type==='state')client.states.push(m.world);if(m.type==='error')client.errors.push(m.message??m.error);};
    await waitFor(()=>client.id,'join');
  }
  assert.ok((await fetch(`${api}/fixtures/${code}/trooper`,{method:'POST'})).ok);
  await waitFor(()=>clients.every(c=>c.states.length),'initial state');
  const sender=clients[0],input={...g.neutral(),cameraAim:true,fire:true,seq:1,yaw:0,pitch:0};
  sender.ws.send(JSON.stringify({type:'input',input}));
  const state=await waitFor(()=>sender.states.find(w=>w.events.some(e=>e.type==='shot'&&e.owner===sender.id)),'authoritative shot');
  sender.ws.send(JSON.stringify({type:'input',input:{...input,fire:false,seq:2}}));
  const shot=state.events.find(e=>e.type==='shot'&&e.owner===sender.id);
  const peer=await waitFor(()=>clients[1].states.find(w=>w.run===state.run&&w.events.some(e=>e.id===shot.id)),'peer shot');
  assert.deepEqual(peer.events.find(e=>e.id===shot.id),shot);
  const p=state.players.find(p=>p.id===sender.id),expected=g.cameraShot(state,p,input);
  const delta=[shot.tx-shot.x,shot.ty-shot.y,shot.tz-shot.z],length=Math.hypot(...delta);
  // Wire snapshots quantize decimals, so allow one cm over the 2m rocket event.
  const error=Math.hypot(delta[0]/length-expected.direction.x,delta[1]/length-expected.direction.y,delta[2]/length-expected.direction.z);
  assert.ok(error<.01,`direction error ${error}`);
  assert.ok(clients.every(c=>c.errors.length===0));
  mkdirSync('dist-validation/aim-scope',{recursive:true});
  writeFileSync('dist-validation/aim-scope/network.json',JSON.stringify({pass:true,realWorker:true,clients:2,shot,error,peerMatches:true,errors:clients.map(c=>c.errors)},null,2));
  console.log('NETWORK PASS: 2 real WebSockets, identical shot event, camera-aim direction error',error);
} finally {for(const c of clients)c.ws.close();await vite.close();}
