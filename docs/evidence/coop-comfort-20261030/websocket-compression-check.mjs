import fs from 'node:fs';
import WebSocket from 'ws';
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(fs.readFileSync('.dev.vars','utf8'))?.[1];
if(!key)throw new Error('Local test credential unavailable');
const created=await fetch('http://127.0.0.1:8793/rooms',{method:'POST',headers:{'X-Room-Creation-Key':key,'X-Test-Client':'extension-check-'+Date.now()},body:JSON.stringify({name:'隔離通信検査',listed:false,ruleset:'front-v1',mode:'survival'})});
if(!created.ok)throw new Error('Local creation failed: '+created.status);
const {code}=await created.json();
const result = { scope:'local test Worker handshake only; no gameplay or production', priorAttempt:'Expired previous local test room returned HTTP 410; created a new local room', offeredPerMessageDeflate:true, negotiated:null, opened:false };
const socket = new WebSocket(`ws://127.0.0.1:8793/rooms/${code}?ruleset=front-v1`, { origin:'http://127.0.0.1:5186', perMessageDeflate:true, handshakeTimeout:5000 });
await new Promise((resolve, reject) => {
  socket.on('upgrade', response => { result.negotiated=response.headers['sec-websocket-extensions'] ?? null; });
  socket.on('open', () => { result.opened=true; result.extensions=socket.extensions; socket.close(1000); });
  socket.on('close', resolve);
  socket.on('error', reject);
});
fs.writeFileSync('dist-validation/coop-comfort-20261030/local-ws-extension.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
