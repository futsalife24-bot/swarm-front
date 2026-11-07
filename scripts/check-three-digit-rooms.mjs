import fs from "node:fs";
import assert from "node:assert/strict";
const base = process.env.SWARM_TEST_SERVER_URL ?? "http://127.0.0.1:8811";
assert.equal(new URL(base).hostname, "127.0.0.1");
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"/m.exec(
  fs.readFileSync(process.env.SWARM_TEST_VARS_PATH ?? ".dev.vars", "utf8"),
)?.[1];
assert(key, "Existing local test credential required");
const sockets = [],
  checks = [];
const fixture = async (mode) =>
  assert.equal(
    (await fetch(base + "/room-id-fixture", { method: "POST", body: mode }))
      .status,
    200,
  );
const create = async (options = {}) =>
  fetch(base + "/rooms", {
    method: "POST",
    headers: { "X-Room-Creation-Key": key },
    body: JSON.stringify({ name: "3桁検証", ...options }),
  });
const read = async (path) => {
  const r = await fetch(base + path);
  return { status: r.status, data: await r.json() };
};
async function connect(code, front = false) {
  const ws = new WebSocket(
    base.replace("http", "ws") +
      "/rooms/" +
      code +
      (front ? "?ruleset=front-v1" : ""),
  );
  sockets.push(ws);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("WS timeout")), 10000);
    ws.onopen = () =>
      ws.send(
        JSON.stringify({
          type: "hello",
          ...(front
            ? { frontGrowth: 3, frontCatalog: 2, frontOpening: 2 }
            : {}),
        }),
      );
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      if (["welcome", "error"].includes(m.type)) {
        clearTimeout(timer);
        resolve(m);
      }
    };
    ws.onerror = () => {
      clearTimeout(timer);
      reject(Error("WS error"));
    };
  });
}
try {
  await fixture("full");
  assert.equal((await create()).status, 503);
  assert.deepEqual((await read("/room-id-stats")).data, {
    total: 0,
    entries: 1000,
  });
  checks.push("1000枠満杯503・件数と作成枠を維持");
  await fixture("one-expired");
  const r = await create();
  assert.equal(r.status, 200);
  const replacement = await r.json();
  assert.equal(replacement.roomId, "007");
  assert.equal((await read("/rooms/007")).data.code, replacement.code);
  checks.push("期限切れ007を再割当・先頭ゼロを維持");
  await fixture("legacy");
  assert.equal(
    (await read("/rooms/ABCDEF12")).data.code,
    "abcdef1234567890abcdef1234567890",
  );
  assert.equal((await read("/rooms/abcdef12")).status, 200);
  checks.push("旧8文字IDの解決互換");
  await fixture("empty");
  const responses = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      create({
        listed: i % 2 === 0,
        ...(i % 2 ? { ruleset: "front-v1", mode: "survival" } : {}),
      }),
    ),
  );
  const rooms = await Promise.all(
    responses.map(async (r) => {
      assert.equal(r.status, 200);
      return r.json();
    }),
  );
  rooms.forEach((r) => assert.match(r.roomId, /^[0-9]{3}$/));
  assert.equal(new Set(rooms.map((r) => r.roomId)).size, 6);
  assert.equal((await read("/room-id-stats")).data.total, 6);
  checks.push("同時6作成で数字3桁・重複なし・内部32桁維持");
  for (const i of [0, 1]) {
    const room = rooms[i],
      q = i ? "?ruleset=front-v1" : "";
    assert.match(room.code, /^[a-f0-9]{32}$/);
    assert.equal(
      (await read("/rooms/" + room.roomId + q)).data.code,
      room.code,
    );
    assert.equal(
      (await read("/rooms/" + room.roomId + (i ? "" : "?ruleset=front-v1")))
        .status,
      404,
    );
    for (let j = 0; j < 4; j++) {
      const m = await connect(room.code, !!i);
      assert.equal(m.type, "welcome");
      assert.equal(m.roomId, room.roomId);
    }
    const fifth = await connect(room.code, !!i);
    assert.equal(fifth.type, "error");
    checks.push(
      (i ? "生存" : "進撃") + "実4人接続・同ID welcome・5人目拒否・ruleset分離",
    );
  }
  const list = (await read("/rooms")).data.rooms;
  assert(!list.some((r) => r.roomId === rooms[0].roomId));
  checks.push("満員部屋を公開一覧から除外");
  for (const id of ["00", "1234", "ABC", "12.3"])
    assert.equal((await read("/rooms/" + id)).status, 404);
  checks.push("不正ID拒否");
  fs.mkdirSync("dist-validation/room-id", { recursive: true });
  fs.writeFileSync(
    "dist-validation/room-id/network.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        checks,
        roomIds: rooms.map((r) => r.roomId),
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: checks.length, checks }));
} finally {
  for (const ws of sockets) ws.close();
}
