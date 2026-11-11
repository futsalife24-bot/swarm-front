import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin=process.env.SUPPLY_SITE || 'http://127.0.0.1:8796';
const out=process.env.SUPPLY_OUTPUT || 'docs/evidence/supply-kakutei-20261111';
const secret=()=>crypto.randomUUID().replaceAll('-','');
const id=secret(),token=secret()+secret(),first=crypto.randomUUID(),other=crypto.randomUUID();
const call=async(action,body,overrides={})=>{
  const response=await fetch(`${origin}/api/supply/${id}/${action}`,{
    method:body===undefined?'GET':'POST',
    headers:{Authorization:'Bearer '+token,Origin:origin,'Content-Type':'application/json',...overrides},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
  });
  return {status:response.status,data:await response.json()};
};
const report=[];
const start=await call('initialize',{}); assert.equal(start.status,200);assert.equal(start.data.tickets,10);
assert.equal((await call('initialize',{})).data.tickets,10);report.push('初期化再送で券が増えない');
assert.equal((await call('initialize',{}, {Authorization:'Bearer invalid'})).status,401);
assert.equal((await call('draw',{requestId:first,count:10},{Origin:'https://invalid.example'})).status,403);
assert.equal((await call('draw',{requestId:first,count:10,rewards:[]})).status,400);report.push('認証・Origin・結果の持込み拒否');
const parallel=await Promise.all([call('draw',{requestId:first,count:10}),call('draw',{requestId:other,count:10})]);
assert.deepEqual(parallel.map(r=>r.status).sort(),[200,409]);
const accepted=parallel.find(r=>r.status===200).data;
assert.equal(accepted.tickets,0);assert.equal(accepted.pending.rewards.length,10);
assert(accepted.pending.rewards[9].type==='buddy'||accepted.pending.rewards[9].type==='weapon'&&accepted.pending.rewards[9].weapon.rarity>=2);
const receipt=accepted.pending;
assert.deepEqual((await call('draw',{requestId:receipt.requestId,count:10})).data,accepted);
report.push('並行要求は1回だけ消費・10連保証・同一結果再送');
assert.equal((await call('status')).data.pending.requestId,receipt.requestId);
assert.equal((await call('ack',{requestId:receipt.requestId})).data.pending,null);
assert.equal((await call('ack',{requestId:receipt.requestId})).status,200);
assert.equal((await call('draw',{requestId:receipt.requestId,count:10})).status,409);
assert.equal((await call('initialize',{})).data.tickets,0);report.push('再接続・ACK再送・使用済みID再消費拒否');
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(`${out}/http.json`,JSON.stringify({origin,checks:report,passed:true},null,2));
console.log(JSON.stringify({checks:report.length,passed:true}));
