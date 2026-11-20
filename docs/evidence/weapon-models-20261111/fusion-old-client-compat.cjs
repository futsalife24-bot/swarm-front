const fs = require('node:fs');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const old = require('./old.cjs');
const vars = fs.readFileSync(process.env.SWARM_TEST_VARS_PATH ?? 'dist-validation/front-wire-fixture.vars', 'utf8');
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(vars)?.[1];
if (!key) throw Error('test fixture key unavailable');
const clients = [];
const pause = ms => new Promise(r => setTimeout(r, ms));
class Client {
 constructor(code, mode) {
  this.mode=mode;this.items=[];this.errors=[];this.id='';this.cache=new old.EquipmentCache();
  this.ws=new WebSocket('ws://127.0.0.1:8789/rooms/'+code+'?ruleset=front-v1&testClient='+crypto.createHash('sha256').update('old-client-d7-compat').digest('hex'));
  this.ws.onopen=()=>this.send({type:'hello',frontGrowth:3,frontCatalog:2,frontOpening:2,equipmentCache:1,...(mode?{stateTuples:mode}:{})});
  this.ws.onmessage=e=>{const raw=JSON.parse(String(e.data));const msg=structuredClone(raw);const ok=old.restoreStateTuples(msg);if(!ok){this.errors.push('old decoder rejected '+String(raw.stateEncoding));return}if(msg.type==='state'&&!this.cache.restore(msg.world,!!msg.equipmentCached)){this.errors.push('old equipment cache rejected');return}if(msg.type==='welcome')this.id=msg.id;this.items.push({raw,msg});};
  clients.push(this);
 }
 send(x){this.ws.send(JSON.stringify(x))}
 async wait(pred,from=0,timeout=20000){const end=Date.now()+timeout;while(Date.now()<end){const hit=this.items.slice(from).find(x=>pred(x.msg));if(hit)return hit;const err=this.items.find(x=>x.msg.type==='error');if(err)throw Error('server returned error response');await pause(25)}throw Error('timed out waiting for expected local worker state, mode '+this.mode)}
}
(async()=>{
 const response=await fetch('http://127.0.0.1:8789/rooms',{method:'POST',headers:{'X-Room-Creation-Key':key,'X-Test-Client':crypto.createHash('sha256').update('old-client-d7-compat').digest('hex')},body:JSON.stringify({name:'旧版受信検証',listed:false,ruleset:'front-v1',mode:'defense'})});
 assert.equal(response.status,200);const room=await response.json();
 const peers=[new Client(room.code,0),new Client(room.code,1),new Client(room.code,2)];
 const variance={power:0,reload:0,range:0,rate:0};
 const weapons=[old.makeWeapon('old-compat-n','slug',0,variance,false,0),old.makeWeapon('old-compat-lr','slug',4,variance,false,1),{...old.STARTERS[0],id:'old-compat-legacy-r',kind:'slug'}];
 const pool=['blast-core','armor-piercer','afterimage-mine','armor','magnet','interceptor'];
 for(let i=0;i<peers.length;i++){const c=peers[i];await c.wait(m=>m.type==='welcome');c.send({type:'equip',upgradePool:pool,weapons:[weapons[i],{...old.STARTERS[1],id:'old-compat-side-'+i}]});await c.wait(m=>m.members?.find(p=>p.id===c.id)?.weapons?.length===2)}
 const lobby=(await peers[0].wait(m=>m.members?.length===3&&m.members.every(p=>p.weapons?.length===2))).msg;
 for(const c of peers)c.send({type:'ready',ready:true,stage:lobby.stage,preparationGeneration:lobby.preparationGeneration});
 await peers[0].wait(m=>m.members?.length===3&&m.members.every(p=>p.ready));peers[0].send({type:'start'});
 const pre=await Promise.all(peers.map(c=>c.wait(m=>m.type==='state'&&m.frontView?.offer)));
 for(let i=0;i<peers.length;i++){const c=peers[i],m=pre[i].msg,o=m.frontView.offer;c.send({type:'frontChoose',request:{runId:m.world.run,offerId:o.id,revision:o.revision,requestId:'old-check-'+i,cardId:o.defaultCardId}})}
 const expected=[0,4,1];const final=await Promise.all(peers.map(c=>c.wait(m=>m.type==='state'&&peers.every((p,i)=>m.world.players.find(x=>x.id===p.id)?.weapons[0]?.appearanceTier===expected[i]),0,30000)));
 const cached=await Promise.all(peers.map(c=>c.wait(m=>m.type==='state'&&m.equipmentCached===true&&peers.every((p,i)=>m.world.players.find(x=>x.id===p.id)?.weapons[0]?.appearanceTier===expected[i]),0,30000)));
 const modes=final.map((x,i)=>({requested:peers[i].mode,wireEncoding:x.raw.stateEncoding??'json',oldDecoded:true,oldCacheAccepted:true,actualCachedPacket:cached[i].raw.equipmentCached===true,cachedPlayersOnWireHaveWeapons:cached[i].raw.world.players.some(p=>p.weapons!==undefined),tiers:peers.map((p,j)=>({input:['N','LR','legacy R'][j],appearanceTier:cached[i].msg.world.players.find(y=>y.id===p.id).weapons[0].appearanceTier}))}));
 for(const c of peers)assert.deepEqual(c.errors,[]);
 const state=final[0].msg,projected=peers.map(p=>state.world.players.find(x=>x.id===p.id).weapons[0]);
 const root='public';const requests=[];
 const server=http.createServer((req,res)=>{const path=new URL(req.url,'http://127.0.0.1').pathname;requests.push(path);if(!/^\/assets\/weapons\/realism-v2\/shotgun_[04]\.glb$/.test(path)){res.writeHead(404);return res.end()}try{const data=fs.readFileSync(root+path);res.writeHead(200,{'content-type':'model/gltf-binary','content-length':data.length});res.end(data)}catch{res.writeHead(404);res.end()}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 if(!globalThis.ProgressEvent)globalThis.ProgressEvent=class ProgressEvent extends Event{constructor(type,init={}){super(type);Object.assign(this,init)}};
 const native=old.GLTFLoader.prototype.loadAsync;
 old.GLTFLoader.prototype.loadAsync=function(url,...args){return native.call(this,new URL(url,base).href,...args)};
 try{
  await old.loadProgressionWeapons(projected);
  const visuals=projected.map((w,i)=>{const glow=new old.WeaponRarityGlow(new old.Group(),w);const hex='#'+glow.color.getHexString();glow.dispose();return {input:['N','LR','legacy R'][i],wireAppearanceTier:w.appearanceTier,oldComputedTier:old.weaponTier(w),oldGlow:hex,oldProjectionHasFormat:'format' in w,oldUsesLoadedModel:!!old.progressionWeaponModel(w),oldOriginalUsesLoadedModel:!!old.progressionWeaponModel(weapons[i])}});
  assert(visuals.every(v=>!v.oldUsesLoadedModel));assert.equal(visuals[0].oldOriginalUsesLoadedModel,true);assert.equal(visuals[1].oldOriginalUsesLoadedModel,true);
  assert.deepEqual(requests.sort(),['/assets/weapons/realism-v2/shotgun_0.glb','/assets/weapons/realism-v2/shotgun_4.glb']);
  const report={scope:'Local test-only Worker and real WebSocket; d7d1399 state decoder, equipment cache, model loader and neon class bundled from exact base source in Node; real old GLBs loaded from isolated local HTTP. No actual old browser, renderer, network deployment, phone or all upgrade combinations.',source:'d7d1399',modes,glbRequests:requests,visuals,errors:peers.map(x=>x.errors)};
  fs.writeFileSync('dist-validation/oldclient-d7/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{old.GLTFLoader.prototype.loadAsync=native;await new Promise(resolve=>server.close(resolve))}
})().catch(e=>{console.error('Old client compatibility check failed:',e.message);process.exitCode=1}).finally(()=>{for(const c of clients)c.ws.close()});
