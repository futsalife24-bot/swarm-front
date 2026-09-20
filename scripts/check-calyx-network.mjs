import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const api = process.env.CALYX_TEST_API ?? "http://127.0.0.1:8797";
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  readFileSync(".dev.vars", "utf8"),
)?.[1];
const clients = [];
async function until(fn, label) {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw Error("Timeout: " + label);
}
try {
  assert.ok(key);
  const response = await fetch(api + "/rooms", {
    method: "POST",
    headers: { "X-Room-Creation-Key": key },
  });
  assert.equal(response.status, 200);
  const { code } = await response.json();
  for (let i = 0; i < 2; i++) {
    const c = {
      ws: new WebSocket(api.replace("http", "ws") + "/rooms/" + code),
      id: null,
      states: [],
      errors: [],
    };
    clients.push(c);
    c.ws.onopen = () => c.ws.send(JSON.stringify({ type: "hello" }));
    c.ws.onmessage = (event) => {
      const m = JSON.parse(event.data);
      if (m.type === "welcome") c.id = m.id;
      if (m.type === "state") c.states.push(m.world);
      if (m.type === "error") c.errors.push(m.message ?? m.error);
    };
    await until(() => c.id, "join");
  }
  assert.ok(
    (await fetch(`${api}/fixtures/${code}/calyx`, { method: "POST" })).ok,
  );
  const shot = await until(
    () =>
      clients[0].states.find((w) =>
        w.projectiles.some((q) => q.style === "pollen"),
      ),
    "Worker-fired pollen projectile",
  );
  const cloud = await until(
    () =>
      clients[0].states.find(
        (w) => w.pollen?.length && w.players.every((p) => p.hp < 10000),
      ),
    "cloud damages both players",
  );
  const peer = await until(
    () =>
      clients[1].states.find(
        (w) => w.run === cloud.run && w.time === cloud.time,
      ),
    "same peer tick",
  );
  assert.deepEqual(peer.pollen, cloud.pollen);
  assert.deepEqual(peer.enemies, cloud.enemies);
  assert.deepEqual(
    peer.players.map((p) => p.hp),
    cloud.players.map((p) => p.hp),
  );
  assert.ok(cloud.players.every((p) => p.hp === 9996));
  assert.ok(clients.every((c) => c.errors.length === 0));
  mkdirSync("dist-validation/calyx", { recursive: true });
  const result = {
    pass: true,
    realLocalWorker: true,
    clients: 2,
    fixture:
      "one CALYX and stationary high-HP players; ordinary step/projectile/cloud/transport",
    projectile: shot.projectiles.find((q) => q.style === "pollen"),
    cloud: cloud.pollen,
    matchingTick: cloud.time,
    playerHp: cloud.players.map((p) => p.hp),
    peerMatches: true,
  };
  writeFileSync(
    "dist-validation/calyx/network.json",
    JSON.stringify(result, null, 2),
  );
  console.log(result);
} finally {
  for (const c of clients) c.ws.close();
}
