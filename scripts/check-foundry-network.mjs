import { createServer } from "vite";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const api = process.env.FOUNDRY_TEST_API ?? "http://127.0.0.1:8793";
const vite = await createServer({ server: { middlewareMode: true } });
const g = await vite.ssrLoadModule("/src/shared/game.ts");
const { STARTERS } = await vite.ssrLoadModule("/src/shared/defs.ts");
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  readFileSync(".dev.vars", "utf8"),
)?.[1];
const clients = [];
let ticker;
const waitFor = async (predicate, label) => {
  const until = Date.now() + 18000;
  while (Date.now() < until) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw Error("Timeout: " + label);
};
try {
  assert.ok(key, "local fixture credential available");
  const response = await fetch(api + "/rooms", {
    method: "POST",
    headers: { "X-Room-Creation-Key": key },
  });
  assert.equal(response.status, 200);
  const { code } = await response.json();
  for (let index = 0; index < 2; index++) {
    const client = {
      ws: new WebSocket(api.replace("http", "ws") + "/rooms/" + code),
      id: null,
      states: [],
      errors: [],
    };
    clients.push(client);
    client.ws.onopen = () => client.ws.send(JSON.stringify({ type: "hello" }));
    client.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "welcome") {
        client.id = message.id;
        client.ws.send(
          JSON.stringify({
            type: "equip",
            weapons: [STARTERS[0], STARTERS[1]],
          }),
        );
      }
      if (message.type === "state") client.states.push(message.world);
      if (message.type === "error")
        client.errors.push(message.message ?? message.error);
    };
    await waitFor(() => client.id, "join");
  }
  assert.ok(
    (await fetch(`${api}/fixtures/${code}/foundry`, { method: "POST" })).ok,
  );
  const sender = clients[0];
  const laserState = await waitFor(
    () =>
      sender.states.find(
        (w) => w.stage === 6 && w.projectiles.some((q) => q.style === "laser"),
      ),
    "real Worker laser",
  );
  const source = laserState.enemies.find((e) => e.segments);
  assert.equal(source.segments[3].partHp, 0);
  assert.equal(source.fractured, true);
  const laser = laserState.projectiles.find((q) => q.style === "laser");
  assert.equal(laser.gravity, 0);
  assert.ok(Math.abs(Math.hypot(laser.dx, laser.dy, laser.dz) - 60) < 0.02);
  let seq = 1;
  ticker = setInterval(() => {
    const state = sender.states.at(-1),
      p = state?.players.find((p) => p.id === sender.id);
    const head = state?.enemies.find((e) => e.id === source.id);
    if (!head || !p) return;
    const d = Math.hypot(head.x - p.x, head.z - p.z);
    sender.ws.send(
      JSON.stringify({
        type: "input",
        input: {
          ...g.neutral(),
          seq: seq++,
          fire: true,
          yaw: Math.atan2(head.x - p.x, -(head.z - p.z)),
          pitch: Math.atan2(1.5, d),
        },
      }),
    );
  }, 100);
  const generated = await waitFor(
    () => sender.states.find((w) => w.foundrySpawned === 3),
    "head hit and three generated monsters",
  );
  clearInterval(ticker);
  sender.ws.send(
    JSON.stringify({ type: "input", input: { ...g.neutral(), seq: seq++ } }),
  );
  const peer = await waitFor(
    () =>
      clients[1].states.find(
        (w) => w.run === generated.run && w.time === generated.time,
      ),
    "same authoritative snapshot at peer",
  );
  assert.deepEqual(peer.enemies, generated.enemies);
  assert.deepEqual(peer.foundrySpawns, generated.foundrySpawns);
  const remaining = generated.enemies.find((e) => e.id === source.id);
  assert.equal(remaining.partHp, 0);
  assert.equal(remaining.segments[3].partHp, 0);
  assert.equal(remaining.segments.filter((n) => n.partHp > 0).length, 6);
  const spawned = generated.enemies.filter(
    (e) => e.foundrySource === source.id,
  );
  assert.equal(spawned.length, 3);
  assert.ok(spawned.every((e) => e.kind !== "boss" && !e.segments));
  assert.ok(clients.every((c) => c.errors.length === 0));
  mkdirSync("dist-validation/foundry-concept-implementation", {
    recursive: true,
  });
  writeFileSync(
    "dist-validation/foundry-concept-implementation/network.json",
    JSON.stringify(
      {
        pass: true,
        realWorker: true,
        clients: 2,
        fixture: "initial middle cut and 1HP head only",
        normalInputDestroyedHead: true,
        generationCount: 3,
        detachedExcluded: true,
        survivingBodyCount: 6,
        peerMatches: true,
        straightLaser: laser,
        generated: spawned.map((e) => ({ id: e.id, kind: e.kind })),
        errors: clients.map((c) => c.errors),
      },
      null,
      2,
    ),
  );
  console.log(
    "FOUNDRY NETWORK PASS: real Worker, 2 sockets, actual input head kill, 3 generated, 6 body units remain, equal snapshots.",
  );
} catch (error) {
  const latest = clients[0]?.states.at(-1);
  console.error(
    JSON.stringify(
      {
        time: latest?.time,
        phase: latest?.phase,
        generated: latest?.foundrySpawned,
        pending: latest?.foundrySpawns,
        enemies: latest?.enemies.map((e) => ({
          id: e.id,
          x: e.x,
          z: e.z,
          partHp: e.partHp,
          hp: e.hp,
        })),
        players: latest?.players.map((p) => ({
          id: p.id,
          x: p.x,
          z: p.z,
          hp: p.hp,
          ammo: p.ammo,
          slot: p.slot,
        })),
        shots: clients[0]?.states
          .flatMap((w) => w.events.filter((e) => e.type === "shot"))
          .slice(-2),
        errors: clients.map((c) => c.errors),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  clearInterval(ticker);
  for (const client of clients) client.ws.close();
  await vite.close();
}
