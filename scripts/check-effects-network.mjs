import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const base = "http://127.0.0.1:8791";
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"/m.exec(
  readFileSync(".dev.vars", "utf8"),
)?.[1];
if (!key) throw Error("Local credential unavailable");
const response = await fetch(base + "/rooms", {
  method: "POST",
  headers: { "X-Room-Creation-Key": key },
  signal: AbortSignal.timeout(7000),
});
assert.equal(response.status, 200);
const { code } = await response.json();
const sockets = [];
function connect(token) {
  const ws = new WebSocket(base.replace("http", "ws") + "/rooms/" + code);
  sockets.push(ws);
  const messages = [];
  ws.onmessage = (e) => messages.push(JSON.parse(e.data));
  ws.onopen = () =>
    ws.send(JSON.stringify({ type: "hello", ...(token ? { token } : {}) }));
  const send = (m) => ws.send(JSON.stringify(m));
  const wait = async (predicate) => {
    const end = Date.now() + 7000;
    while (Date.now() < end) {
      const m = messages.find(predicate);
      if (m) return m;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw Error("Expected network state not received");
  };
  return { send, wait, messages };
}
const weapon = (kind, effect) => ({
  id: kind + "-" + effect,
  kind,
  effect,
  rarity: 1,
  power: 1,
});
const input = (seq, extra = {}) => ({
  type: "input",
  input: {
    seq,
    mx: 0,
    mz: 0,
    yaw: 0,
    pitch: 0.8,
    fire: false,
    reload: false,
    dodge: false,
    swap: false,
    revive: false,
    ...extra,
  },
});
try {
  let a = connect();
  const aw = await a.wait((m) => m.type === "welcome");
  const b = connect(),
    bw = await b.wait((m) => m.type === "welcome");
  a.send({
    type: "equip",
    weapons: [weapon("rifle", "chain"), weapon("rocket", "reserve")],
  });
  await a.wait((m) => m.type === "error");
  a = connect(aw.token);
  await a.wait((m) => m.type === "welcome");
  a.send({
    type: "equip",
    weapons: [weapon("rifle", "reserve"), weapon("rocket", "chain")],
  });
  b.send({
    type: "equip",
    weapons: [weapon("shotgun", "repel"), weapon("rifle", "pierce")],
  });
  await a.wait(
    (m) =>
      m.type === "lobby" &&
      m.members.length === 2 &&
      m.members.every((p) => p.ready),
  );
  a.send({ type: "start" });
  const state = await a.wait(
    (m) => m.type === "state" && m.world.phase === "battle",
  );
  const aid = aw.id,
    bid = bw.id;
  assert(state.world.players.some((p) => p.id === aid));
  a.send(input(1, { fire: true }));
  await a.wait(
    (m) =>
      m.type === "state" &&
      m.world.players.some((p) => p.id === aid && p.ammo[0] < 32),
  );
  a.send(input(2, { reload: true }));
  const loading = await b.wait(
    (m) =>
      m.type === "state" &&
      m.world.players.some((p) => p.id === aid && p.reload > 0),
  );
  const reloader = loading.world.players.find((p) => p.id === aid);
  assert(reloader.reload < 1 && reloader.reload > 0);
  await a.wait(
    (m) =>
      m.type === "state" &&
      m.world.time > loading.world.time &&
      m.world.players.some(
        (p) => p.id === aid && p.reload <= 0 && p.ammo[0] === 32,
      ),
  );
  a.send(input(3, { swap: true, fire: true }));
  const projectile = await b.wait(
    (m) =>
      m.type === "state" &&
      m.world.projectiles.some((q) => q.owner === aid && q.chain === true),
  );
  assert(
    projectile.world.players.find((p) => p.id === bid).weapons[0].effect ===
      "repel",
  );
  const result = {
    passed: true,
    transport: "two real WebSockets to local workerd",
    wrongKindRejected: true,
    reserveReloadSeconds: reloader.reload,
    refilled: true,
    chainProjectileShared: true,
    repelEquipped: true,
  };
  writeFileSync(
    "dist-validation/unique-network.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  for (const ws of sockets) ws.close();
}
