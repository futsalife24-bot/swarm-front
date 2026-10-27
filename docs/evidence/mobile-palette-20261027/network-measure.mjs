import { build } from 'esbuild';
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';

// 実Worker・合成装備・描画なし。認証値と復帰トークンは記録しない。
await build({stdin:{contents:`export {frontTemporaryWeapons} from './src/shared/front-run';export {FRONT_BASE_IDS} from './src/shared/front-upgrades';export {neutral} from './src/shared/game';export {localCreationKey} from './tests/credentials';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:'dist-mobile-network/shared.mjs'});
const {frontTemporaryWeapons,FRONT_BASE_IDS,neutral,localCreationKey}=await import('./shared.mjs');
const base='http://127.0.0.1:8793';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))]??null;
const results={source:'518c97261fdff13e4f70b7f11ef970a8e9af43c7',mode:'survival',secondsPerTrial:30,trials:[],limitations:['ローカル実Worker、実WebSocket、描画なし','実スマホ・本番回線・長時間混戦の検証ではない','部屋のseedはサーバーが生成するため各試行で異なる']};
class Client{
  messages=[]; rows=[]; errors=[]; closes=[]; id=''; seq=0; chosen=new Set(); measuring=false;
  constructor(code,key){
    this.ws=new WebSocket(`${base.replace('http','ws')}/rooms/${code}?ruleset=front-v1&testClient=${key}`);
    this.ws.onopen=()=>this.send({type:'hello',frontGrowth:3,frontCatalog:2,frontOpening:2,equipmentCache:1,stateOmissions:1});
    this.ws.onclose=e=>{if(this.measuring)this.closes.push({code:e.code,reason:e.reason});};
    this.ws.onmessage=e=>{
      const at=performance.now(),raw=String(e.data),m=JSON.parse(raw);
      this.messages.push(m);if(this.messages.length>500)this.messages.shift();
      if(m.type==='welcome')this.id=m.id;
      if(m.type==='error')this.errors.push(m.reason);
      if(m.type==='state'){
        if(this.measuring)this.rows.push({at,time:m.world.time,phase:m.frontView?.phase,bytes:Buffer.byteLength(raw),enemies:m.world.enemies.length,orbs:m.world.front?.orbs.length??0,omittedEnemies:m.omitted?.enemies?.length??0,hp:m.world.players.find(p=>p.id===this.id)?.hp});
        const offer=m.frontView?.offer;
        if(offer&&!this.chosen.has(offer.id)){
          this.chosen.add(offer.id);
          this.send({type:'frontChoose',request:{runId:m.world.run,offerId:offer.id,revision:offer.revision,requestId:`${offer.id}:${this.id}`,cardId:offer.defaultCardId}});
        }
      }
    };
  }
  send(value){if(this.ws.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify(value));}
  async wait(predicate){const until=performance.now()+15000;while(performance.now()<until){const m=this.messages.findLast(predicate);if(m)return m;if(this.errors.length)throw Error(this.errors.join(','));await sleep(25);}throw Error('必要な応答の待機がタイムアウト');}
  latest(){return this.messages.findLast(m=>m.members);}
}
for(const count of [1,4]){
  const key=`mobile-network-${Date.now()}-${count}`;
  const response=await fetch(base+'/rooms',{method:'POST',headers:{'X-Room-Creation-Key':localCreationKey(),'X-Test-Client':key},body:JSON.stringify({name:'隔離通信計測',listed:false,ruleset:'front-v1',mode:'survival'})});
  if(!response.ok)throw Error(`部屋作成HTTP ${response.status}`);
  const {code}=await response.json(),members=[];
  let timer;
  try{
    for(let i=0;i<count;i++){
      const c=new Client(code,key);members.push(c);await c.wait(m=>m.type==='welcome');
      c.send({type:'equip',upgradePool:FRONT_BASE_IDS,weapons:frontTemporaryWeapons('measurement',`p${i}`,['rifle','smg'])});
      await c.wait(m=>m.type==='lobby'&&m.members.find(p=>p.id===c.id)?.weapons?.length===2);
    }
    await sleep(250);
    const generation=members[0].latest().preparationGeneration;
    for(const c of members)c.send({type:'ready',ready:true,stage:members[0].latest().stage,preparationGeneration:generation});
    await members[0].wait(m=>m.members?.length===count&&m.members.every(p=>p.ready));
    members[0].send({type:'start'});
    await Promise.all(members.map(c=>c.wait(m=>m.type==='state'&&m.frontView?.phase==='combat')));
    const start=performance.now();for(const c of members)c.measuring=true;
    timer=setInterval(()=>{
      const t=(performance.now()-start)/1000;
      members.forEach((c,i)=>c.send({type:'input',input:{...neutral(),seq:++c.seq,mx:Math.sin(t*.3+i),mz:Math.cos(t*.3+i),yaw:Math.atan2(Math.sin(t*.3+i),Math.cos(t*.3+i))}}));
    },50);
    await sleep(results.secondsPerTrial*1000);
    clearInterval(timer);
    const trial={players:count,wallMs:performance.now()-start,clients:members.map(c=>{
      c.measuring=false;
      const combat=c.rows.filter(r=>r.phase==='combat'||r.phase==='boss');
      const intervals=[];for(let i=1;i<combat.length;i++)intervals.push(combat[i].at-combat[i-1].at);
      return {packets:c.rows.length,combatPackets:combat.length,intervalP50:percentile(intervals,.5),intervalP95:percentile(intervals,.95),intervalMax:Math.max(...intervals),over250ms:intervals.filter(v=>v>250).length,sizeMax:Math.max(...c.rows.map(r=>r.bytes)),sizeP95:percentile(c.rows.map(r=>r.bytes),.95),enemiesMax:Math.max(...c.rows.map(r=>r.enemies)),orbsMax:Math.max(...c.rows.map(r=>r.orbs)),gameTimeFirst:c.rows[0]?.time,gameTimeLast:c.rows.at(-1)?.time,lastPhase:c.rows.at(-1)?.phase,errors:c.errors,closes:c.closes,rows:c.rows};
    })};
    results.trials.push(trial);
    fs.writeFileSync('dist-mobile-network/results.json',JSON.stringify(results,null,2));
    console.log(JSON.stringify({...trial,clients:trial.clients.map(({rows,...rest})=>rest)}));
  }finally{clearInterval(timer);for(const c of members){c.measuring=false;c.ws.close();}}
}
