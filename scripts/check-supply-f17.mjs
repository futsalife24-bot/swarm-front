// F-17 H-1/H-2 checks against the local TEST Worker only (wrangler.test.jsonc).
// Never point this at production: it presets the daily counter via fixtures.
import assert from "node:assert/strict";
import fs from "node:fs";
const origin = process.env.F17_SITE || "http://127.0.0.1:8797";
const out = process.env.F17_OUTPUT || "dist-validation/f17-supply";
const hex = () => crypto.randomUUID().replaceAll("-", "");
const report = [];
// validCloudSave が受け付ける最小の通常プレイ保存。
const save = {
  version: 2,
  mode: "normal",
  missions: {},
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
// 再実行で作成上限（アドレスごとに5回/日）に当たらないよう、実行ごとに帯を変える。
const run = Math.floor(Math.random() * 250) + 1;
let address = 0;
const fresh = () => `10.${run}.1.${++address}`;
const call = async (path, { body, token, ip = `10.${run}.0.1` } = {}) => {
  const response = await fetch(origin + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: origin,
      "X-Test-Address": ip,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, data: await response.json() };
};
const total = async (scope) =>
  (await (await fetch(`${origin}/rate-fixture/${scope}`)).json()).total ?? 0;
const preset = async (scope, value) => {
  const response = await fetch(`${origin}/rate-fixture/${scope}`, {
    method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(value),
  });
  assert.equal(response.status,200);
  await response.json();
};
const createVault = async () => {
  const created = await call("/api/cloud/create", {
    body: { save },
    ip: fresh(),
  });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const [, id, token] = created.data.code.split("-");
  return { code: created.data.code, id, token };
};

// --- H-2: 認証前の要求は全体カウンターを増やさない ---
const supplyBefore = await total("supply"),
  cloudBefore = await total("cloud");
for (let i = 0; i < 5; i++) {
  assert.equal(
    (await call(`/api/supply/${hex()}/status`, { token: hex() + hex() }))
      .status,
    401,
  );
  assert.equal(
    (await call(`/api/supply/cloud/${hex()}/status`, { token: hex() + hex() }))
      .status,
    401,
  );
  assert.equal(
    (await call(`/api/cloud/${hex()}/save`, { token: hex() + hex() })).status,
    401,
  );
}
assert.equal(await total("supply"), supplyBefore);
assert.equal(await total("cloud"), cloudBefore);
report.push("存在しない口座への status/save は全体カウンターを増やさない");

// --- H-1: 初回10枚は保管庫1つにつき1回 ---
const vault = await createVault();
const supply = (action, body, token = vault.token, id = vault.id) =>
  call(`/api/supply/cloud/${id}/${action}`, { body, token });
const opened = await supply("initialize", {});
assert.equal(opened.status, 200);
assert.equal(opened.data.tickets, 10);
assert.equal(await total("supply"), supplyBefore + 1);
report.push("認証済み要求だけが全体カウンターを1増やす");
const requestId = crypto.randomUUID();
const drawn = await supply("draw", { requestId, count: 10 });
assert.equal(drawn.status, 200);
assert.equal(drawn.data.tickets, 0);
assert.equal((await supply("ack", { requestId })).data.pending, null);
// 接続情報の削除 → 旧方式の新しい口座で再初期化 → 拒否
const legacy = await call(`/api/supply/${hex()}/initialize`, {
  body: {},
  token: hex() + hex(),
});
assert.equal(legacy.status, 401);
assert.equal(legacy.data.retired, true);
// 同じ保管庫で再初期化しても初回付与は入らない
assert.equal((await supply("initialize", {})).data.tickets, 0);
assert.equal((await supply("status")).data.tickets, 0);
assert.equal(
  (await supply("draw", { requestId: crypto.randomUUID(), count: 10 })).status,
  409,
);
assert.equal((await supply("initialize", {}, hex() + hex())).status, 401);
report.push("接続情報の削除→再初期化で初回付与が二重に入らない");

// --- H-2: 上限到達時も認証済みは通し、新規作成だけ止める ---
const day = opened.data.day;
await preset("supply", { day, total: 20000 });
await preset("cloud", { day, total: 20000 });
assert.equal((await supply("status")).status, 200);
assert.equal((await supply("daily", {})).status, 200);
assert.equal(
  (await call(`/api/cloud/${vault.id}/save`, { token: vault.token })).status,
  200,
);
assert.equal(
  (await call("/api/cloud/create", { body: { save }, ip: fresh() })).status,
  429,
);
report.push("上限到達後も認証済みの補給・クラウド保存は通る");
await preset("cloud", { day, total: 0 });
const second = await createVault();
await preset("cloud", { day, total: 20000 });
const blocked = await call(`/api/supply/cloud/${second.id}/initialize`, {
  body: {},
  token: second.token,
});
assert.equal(blocked.status, 429);
report.push("上限到達時は新規の補給口座作成だけ止まる");
await preset("supply", { day, total: 0 });
await preset("cloud", { day, total: 0 });
assert.equal(
  (
    await call(`/api/supply/cloud/${second.id}/initialize`, {
      body: {},
      token: second.token,
    })
  ).data.tickets,
  10,
);

// --- H-1 移行: 旧口座の残高を保ち、保管庫は付与済みになる ---
const legacyId = hex(),
  legacyToken = hex() + hex();
await fetch(`${origin}/legacy-supply-fixture/${legacyId}`, {
  method: "POST",
  body: JSON.stringify({ token: legacyToken, tickets: 7, day }),
});
const old = (action, body) =>
  call(`/api/supply/${legacyId}/${action}`, { body, token: legacyToken });
assert.equal((await old("initialize", {})).data.tickets, 7);
const third = await createVault();
const migrated = await old("migrate", { cloud: third.code });
assert.equal(migrated.status, 200, JSON.stringify(migrated.data));
assert.equal(migrated.data.tickets, 7);
assert.equal((await old("migrate", { cloud: third.code })).data.tickets, 7);
assert.equal((await old("status")).status, 409);
const thirdSupply = (action, body) =>
  call(`/api/supply/cloud/${third.id}/${action}`, {
    body,
    token: third.token,
  });
assert.equal((await thirdSupply("initialize", {})).data.tickets, 7);
assert.equal((await thirdSupply("daily", {})).data.tickets, 7);
report.push("旧口座は残高7枚のまま1回だけ移行し、初回10枚を重ねない");

// --- H-2: IPごとの上限（IPv6は/64単位） ---
// 分の境目をまたぐと窓がリセットされるため、余裕のある時刻から始める。
if (Date.now() % 60000 > 30000)
  await new Promise((r) => setTimeout(r, 60000 - (Date.now() % 60000) + 200));
const flood = async (ip) => {
  for (let i = 0; i < 60; i++)
    assert.notEqual(
      (await call(`/api/supply/${hex()}/status`, { token: hex() + hex(), ip }))
        .status,
      429,
    );
};
await flood(`2001:db8:${run.toString(16)}:1::1`);
assert.equal(
  (
    await call(`/api/supply/${hex()}/status`, {
      token: hex() + hex(),
      ip: `2001:db8:${run.toString(16)}:1:ffff::2`,
    })
  ).status,
  429,
);
assert.equal(
  (
    await call(`/api/supply/${hex()}/status`, {
      token: hex() + hex(),
      ip: `2001:db8:${run.toString(16)}:2::1`,
    })
  ).status,
  401,
);
assert.equal((await supply("status")).status, 200);
report.push("同じ/64は合算して60回/分で429、別の/64と他の利用者は影響なし");

fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(
  `${out}/result.json`,
  JSON.stringify({ origin, checks: report, passed: true }, null, 2),
);
console.log(JSON.stringify({ checks: report, passed: true }, null, 2));
