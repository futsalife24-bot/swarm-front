import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
// Existing OAuth; read-only. Do not print identity, credentials or response headers.
const token = /^oauth_token\s*=\s*"([^"]+)"/m.exec(
  readFileSync(
    join(homedir(), "AppData/Roaming/xdg.config/.wrangler/config/default.toml"),
    "utf8",
  ),
)?.[1];
assert(token);
async function get(path, body) {
  const r = await fetch("https://api.cloudflare.com/client/v4" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  const d = await r.json();
  return { status: r.status, data: d };
}
const accounts = await get("/accounts");
assert.equal(accounts.status, 200);
assert.equal(accounts.data.result.length, 1);
const account = accounts.data.result[0].id;
const subscriptions = await get(`/accounts/${account}/subscriptions`);
const now = new Date().toISOString(),
  since = now.slice(0, 10) + "T00:00:00Z";
const metrics = await get("/graphql", {
  query: `query { viewer { accounts(filter:{accountTag:"${account}"}) { workersInvocationsAdaptive(limit:1,filter:{datetime_geq:"${since}",datetime_leq:"${now}"}) { sum { requests errors subrequests } } } } }`,
});
const result = {
  checkedAt: now,
  accountCount: 1,
  subscriptions: {
    status: subscriptions.status,
    ...(subscriptions.status === 200
      ? {
          plans: subscriptions.data.result.map((s) => ({
            name: s.rate_plan?.public_name ?? s.rate_plan?.name,
            currency: s.currency,
            price: s.price,
            state: s.state,
          })),
        }
      : {
          errors: subscriptions.data.errors?.map((e) => ({
            code: e.code,
            message: e.message,
          })),
        }),
  },
  metrics: {
    status: metrics.status,
    errors: metrics.data.errors?.map((e) => ({ message: e.message })),
    data: metrics.data.data?.viewer?.accounts?.map(
      (a) => a.workersInvocationsAdaptive,
    ),
  },
};
writeFileSync(
  "docs/evidence/coop-comfort-close-20261113/account.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
