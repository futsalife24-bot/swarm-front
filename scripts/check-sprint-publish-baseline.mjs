import fs from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const out='dist-validation/trooper-sprint-adoption',base='https://swarm-front.melosalife-24.workers.dev',sha=b=>createHash('sha256').update(b).digest('hex');
if(!process.argv.includes('--plan-only')) {
const html=await (await fetch(base,{cache:'no-store'})).text(),local=fs.readFileSync('dist/index.html','utf8');const path=html.match(/src="([^"]+\.js)"/)[1],localPath=local.match(/src="([^"]+\.js)"/)[1];
const bytes=Buffer.from(await(await fetch(base+path)).arrayBuffer());const same=sha(bytes)===sha(fs.readFileSync('dist'+localPath));
const record={base,publishedScript:path,localScript:localPath,identicalProductionBaseline:same,publishedHash:sha(bytes),localHash:sha(fs.readFileSync('dist'+localPath))};fs.writeFileSync(out+'/published-baseline.json',JSON.stringify(record,null,2));console.log(record);assert.ok(same,'Current production baseline differs: inspect before deploying unrelated changes');
}
// Use the existing authenticated account; never log or persist its credential.
const cfg=fs.readFileSync('C:/Users/futsa/AppData/Roaming/xdg.config/.wrangler/config/default.toml','utf8'),token=cfg.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];assert.ok(token,'Cloudflare login unavailable');
const account='5fc5ec277dd3010f25a7c1a7b7e585b3',plan={};
for(const endpoint of ['workers/account-settings','subscriptions']){const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/${endpoint}`,{headers:{Authorization:`Bearer ${token}`}});assert.ok(response.ok,`Plan check HTTP ${response.status}`);const data=await response.json();assert.ok(data.success);plan[endpoint]=endpoint==='subscriptions'?data.result.map(s=>({state:s.state,rate_plan:s.rate_plan?.id,public_name:s.rate_plan?.public_name})): {default_usage_model:data.result.default_usage_model};}
fs.writeFileSync(out+'/account-plan.json',JSON.stringify(plan,null,2));console.log(plan);
