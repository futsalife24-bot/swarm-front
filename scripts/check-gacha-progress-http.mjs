import assert from "node:assert/strict";
import fs from "node:fs";
const origin = process.env.GACHA_HTTP_ORIGIN || "http://127.0.0.1:8798";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw Error("ローカル専用");
const out = "docs/evidence/gacha-balance-20261117";
const ip = `10.173.${Math.floor(Math.random() * 250)}.1`;
const request = async (path, body, token) => {
  const r = await fetch(origin + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "X-Test-Address": ip,
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: r.status, body: await r.json() };
};
const save = {
  version: 2,
  mode: "normal",
  missions: { "1:normal": [true, true, true] },
  inventory: [],
  pending: [],
  soldiers: [],
  receipts: [],
  coins: 0,
  points: 0,
  materials: 0,
  powder: 0,
  serial: 0,
};
const created = await request("/api/cloud/create", { save });
assert.equal(created.status, 200);
const [, id, token] = created.body.code.split("-"),
  cloud = `/api/cloud/${id}`,
  supply = `/api/supply/cloud/${id}`;
const call = (action, body = {}) => request(supply + "/" + action, body, token);
assert.equal((await call("initialize")).body.tickets, 10);
assert.deepEqual((await call("daily")).body.credited, { past: 7, recent: 0 });
assert.equal((await call("daily")).body.tickets, 17);
let remote = (await request(cloud + "/save", undefined, token)).body;
for (let i = 0; i < 3; i++) {
  const next = structuredClone(remote.save),
    run = `clear-${i}-${crypto.randomUUID()}`;
  next.receipts.push(run);
  next.weeklyPending = [run];
  const mutation = crypto.randomUUID(),
    body = {
      save: next,
      version: remote.version,
      basisVersion: remote.version,
      mutation,
    };
  const uploaded = await request(cloud + "/save", body, token);
  assert.equal(uploaded.status, 200);
  remote = uploaded.body;
  assert.equal((await request(cloud + "/save", body, token)).status, 200);
}
assert.equal((await call("daily")).body.tickets, 21); // 17 + 3 clears + first today
remote = (
  await request(
    cloud + "/weekly",
    { id: "campaign-3", version: remote.version },
    token,
  )
).body;
assert.equal((await call("daily")).body.tickets, 23);
await request(
  cloud + "/weekly",
  { id: "campaign-3", version: remote.version },
  token,
);
assert.equal((await call("daily")).body.tickets, 23);
const rejected = await request(
  cloud + "/save",
  { save, mutation: crypto.randomUUID(), version: 1, basisVersion: 1 },
  token,
);
assert.equal(rejected.status, 409);
assert.equal((await call("daily")).body.tickets, 23);
assert.equal(
  (await request("/api/cloud-supply-progress", {}, token)).status,
  404,
);
const checks = [
  "過去7枚の一度だけの集計",
  "クリア再送で重複なし",
  "週間受領2枚の一度だけの集計",
  "古い保存拒否で券不変",
  "内部進行経路を外部公開しない",
];
fs.writeFileSync(
  out + "/progress-http.json",
  JSON.stringify({ passed: true, checks }, null, 2),
);
console.log(JSON.stringify({ passed: true, checks }));
