import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const base = "http://127.0.0.1:8793";
const out = "dist-validation/cloud-vault";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
try {
  const p = await browser.newPage();
  await p.goto("http://127.0.0.1:5197");
  const save = await p.evaluate(async () =>
    (await import("/src/client/progression-save.ts")).freshProgress("normal"),
  );
  const call = async (path, body, token) => {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Origin: base,
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    console.log(path.split("/").pop(), response.status);
    return {
      status: response.status,
      cache: response.headers.get("cache-control"),
      data: await response.json(),
    };
  };
  const created = await call("/api/cloud/create", { save });
  assert.equal(created.status, 200);
  const [, id, token] = created.data.code.split("-");
  const path = `/api/cloud/${id}/save`;
  assert.equal((await call(path)).status, 401);
  save.coins += 20;
  const body = { save, version: 1, mutation: crypto.randomUUID() };
  const updated = await call(path, body, token);
  assert.equal(updated.status, 200);
  assert.equal(updated.data.version, 2);
  assert.equal((await call(path, body, token)).data.version, 2);
  assert.equal(
    (await call(path, { ...body, mutation: crypto.randomUUID() }, token))
      .status,
    409,
  );
  const restored = await call(path, undefined, token);
  assert.equal(restored.data.save.coins, save.coins);
  assert.equal(restored.cache, "no-store");
  const daily = await call(
    `/api/cloud/${id}/daily`,
    { version: 2, day: restored.data.day, run: crypto.randomUUID() },
    token,
  );
  assert.equal(daily.status, 200);
  assert.equal(daily.data.save.inventory.length, save.inventory.length + 1);
  assert.equal(
    (
      await call(
        `/api/cloud/${id}/daily`,
        { version: 3, day: restored.data.day, run: crypto.randomUUID() },
        token,
      )
    ).status,
    409,
  );
  const denied = await fetch(base + path, {
    method: "POST",
    headers: {
      Origin: "https://other.example",
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify(body),
  });
  assert.equal(denied.status, 403);
  assert.equal((await call(`/api/cloud/${id}/delete`, {}, token)).status, 200);
  assert.equal((await call(path, undefined, token)).status, 401);
  const result = {
    pass: true,
    transport: "real local Worker and SQLite Durable Object",
    checks: [
      "credential isolation",
      "latest backup",
      "idempotent retry",
      "stale device conflict",
      "daily atomic guarantee",
      "once per day",
      "cross-origin rejection",
      "cloud deletion",
    ],
  };
  fs.writeFileSync(out + "/checks.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
