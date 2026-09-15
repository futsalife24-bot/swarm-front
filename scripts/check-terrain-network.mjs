import {createServer} from 'vite';import fs from 'node:fs';import assert from 'node:assert/strict';
const vite=await createServer({server:{middlewareMode:true}}),g=await vite.ssrLoadModule('/src/shared/game.ts'),{STARTERS}=await vite.ssrLoadModule('/src/shared/defs.ts'),{MAPS}=await vite.ssrLoadModule('/src/shared/stages.ts'),t=await vite.ssrLoadModule('/src/shared/terrain.ts');
const key=/^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(fs.readFileSync('.dev.vars','utf8'))?.[1];assert.ok(key);
const clients=[];let ticker;
const wait=async(fn,label)=>{const end=Date.now()+20000;while(Date.now()<end){const result=fn();if(result)return result;await new Promise(r=>setTimeout(r,40));}throw Error('timeout '+label)};
try{
const response=await fetch('http://127.0.0.1:8789/rooms',{method:'POST',headers:{'X-Room-Creation-Key':key}});assert.equal(response.status,200);const {code}=await response.json();
for(let n=0;n<2;n++){const c={ws:new WebSocket('ws://127.0.0.1:8789/rooms/'+code),states:[],id:null,ready:false,errors:[]};clients.push(c);c.ws.onopen=()=>c.ws.send(JSON.stringify({type:'hello'}));c.ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='welcome'){c.id=m.id;c.ws.send(JSON.stringify({type:'equip',weapons:[STARTERS[0],STARTERS[1]]}));}if(m.type==='lobby')c.ready=m.members.length===2&&m.members.every(p=>p.ready);if(m.type==='state')c.states.push(m.world);if(m.type==='error')c.errors.push(m.message);};await wait(()=>c.id,'join');}
await wait(()=>clients.every(c=>c.ready),'ready');const sender=clients[0];sender.ws.send(JSON.stringify({type:'stage',stage:2}));sender.ws.send(JSON.stringify({type:'start'}));await wait(()=>sender.states.length,'start');
let seq=1;ticker=setInterval(()=>{sender.ws.send(JSON.stringify({type:'input',input:{...g.neutral(),mx:-.7,mz:.7,seq:seq++}}));},50);
const state=await wait(()=>sender.states.find(w=>w.players.find(p=>p.id===sender.id).y>1.5),'uphill');clearInterval(ticker);ticker=undefined;sender.ws.send(JSON.stringify({type:'input',input:{...g.neutral(),seq:seq++}}));
const p=state.players.find(p=>p.id===sender.id);const peer=await wait(()=>clients[1].states.find(w=>w.time===state.time),'peer snapshot');assert.deepEqual(peer.players,state.players);assert.ok(Math.abs(p.y-t.supportHeight(p.x,p.z,MAPS[3].blocks))<.04);assert.ok(clients.every(c=>c.errors.length===0));
fs.writeFileSync('dist-validation/terrain-refresh/network.json',JSON.stringify({pass:true,realWorker:true,clients:2,stage:state.stage,time:state.time,position:{x:p.x,y:p.y,z:p.z},support:t.supportHeight(p.x,p.z,MAPS[3].blocks),peerMatches:true},null,2));console.log('PASS real Worker, two WebSockets, uphill altitude and peer snapshot match');
}finally{if(ticker)clearInterval(ticker);for(const c of clients)c.ws.close();await vite.close();}
