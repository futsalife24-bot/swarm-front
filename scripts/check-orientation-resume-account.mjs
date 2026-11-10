// 既存の認証で契約・使用量・既存Versionを読む。秘密値は出力・保存しない。
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const token = /^oauth_token\s*=\s*"([^"]+)"/m.exec(readFileSync(join(homedir(), 'AppData/Roaming/xdg.config/.wrangler/config/default.toml'), 'utf8'))?.[1];
if (!token) throw Error('既存認証が必要です');
async function read(path, body) {
  const r = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method: body ? 'POST' : 'GET', redirect: 'error',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000),
  });
  const data = await r.json();
  return { status: r.status, data };
}
const accounts = await read('/accounts');
if (accounts.status !== 200 || accounts.data.result.length !== 1) throw Error('対象アカウントを一意に確認できません');
const account = accounts.data.result[0].id;
const subscriptions = await read(`/accounts/${account}/subscriptions`);
const versions = {};
for (const worker of ['swarm-front', 'swarm-front-orientation-mock']) {
  const response = await read(`/accounts/${account}/workers/scripts/${worker}/deployments`);
  versions[worker] = { status: response.status, deployments: response.data.result?.deployments?.slice(0, 1).map(d => ({ id: d.id, created_on: d.created_on, versions: d.versions })) };
}
const end = new Date().toISOString(), start = end.slice(0,10) + 'T00:00:00Z';
const usage = await read('/graphql', { query: 'query($account: String!, $start: DateTime!, $end: DateTime!) { viewer { accounts(filter: {accountTag: $account}) { workersInvocationsAdaptive(limit: 10000, filter: {datetime_geq: $start, datetime_leq: $end}) { sum { requests errors subrequests } } } } }', variables: { account, start, end } });
const report = { at: end, subscriptions: { status: subscriptions.status, plans: subscriptions.data.result?.map(s => ({ state: s.state, id: s.rate_plan?.id, name: s.rate_plan?.public_name })), errors: subscriptions.data.errors?.map(e => ({ code: e.code, message: e.message })) }, versions, usage: { status: usage.status, interval: { start, end }, result: usage.data.data, errors: usage.data.errors } };
writeFileSync('dist-validation/orientation-mock/account-current.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
