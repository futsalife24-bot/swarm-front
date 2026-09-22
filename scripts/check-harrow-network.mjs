import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const api = process.env.HARROW_TEST_API ?? "http://127.0.0.1:8798";
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  readFileSync(".dev.vars", "utf8"),
)?.[1];
const directory = "dist-validation/harrow";
mkdirSync(directory, { recursive: true });
const clients = [];
const checks = [];
let code;
async function until(fn, label) {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    const value = fn();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw Error("Timeout: " + label);
}
async function fixture(name) {
  const priorRuns = new Set(
    clients.flatMap((client) => client.states.map((world) => world.run)),
  );
  for (const client of clients) client.states = [];
  assert.ok(
    (await fetch(`${api}/fixtures/${code}/${name}`, { method: "POST" })).ok,
  );
  const initial = await until(
    () =>
      clients[0].states.find(
        (w) => w.run.startsWith("fixture-") && !priorRuns.has(w.run),
      ),
    name + " initial snapshot",
  );
  return initial.run;
}
async function checkpoint(run, predicate, label) {
  const world = await until(
    () => clients[0].states.find((w) => w.run === run && predicate(w)),
    label,
  );
  const peer = await until(
    () => clients[1].states.find((w) => w.run === run && w.time === world.time),
    label + " peer tick",
  );
  assert.deepEqual(
    peer.harrowMissiles,
    world.harrowMissiles,
    label + " missiles",
  );
  assert.deepEqual(peer.enemies, world.enemies, label + " enemies");
  assert.deepEqual(
    peer.players.map((p) => p.hp),
    world.players.map((p) => p.hp),
    label + " HP",
  );
  checks.push({
    label,
    time: world.time,
    missiles: world.harrowMissiles?.length ?? 0,
    airborne: world.enemies[0]?.harrowAirborne,
    action: world.enemies[0]?.harrow?.kind ?? null,
    enemyHeight: world.enemies[0]?.y,
    playerHp: world.players.map((p) => p.hp),
    peerMatches: true,
  });
  return world;
}
try {
  assert.ok(key, "Local room creation credential available");
  const response = await fetch(api + "/rooms", {
    method: "POST",
    headers: { "X-Room-Creation-Key": key },
  });
  assert.equal(response.status, 200);
  ({ code } = await response.json());
  for (let i = 0; i < 2; i++) {
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
      if (message.type === "welcome") client.id = message.id;
      if (message.type === "state") client.states.push(message.world);
      if (message.type === "error")
        client.errors.push(message.message ?? message.error);
    };
    client.ws.onerror = () => client.errors.push("WebSocket connection error");
    await until(() => client.id, "join");
  }
  let run = await fixture("harrow");
  const initial = await checkpoint(
    run,
    (w) => w.time === 0 && w.enemies[0]?.harrowAirborne && w.enemies[0].y > 0,
    "initial airborne spawn",
  );
  assert.equal(
    initial.enemies[0].y,
    34.5,
    "Three times RAY maximum flight height",
  );
  const warning = await checkpoint(
    run,
    (w) =>
      w.harrowMissiles?.length === 10 &&
      w.harrowMissiles.every((m) => w.time < m.launch),
    "ten authoritative warning targets",
  );
  assert.equal(new Set(warning.harrowMissiles.map((m) => m.id)).size, 10);
  const fired = await checkpoint(
    run,
    (w) =>
      w.harrowMissiles?.length === 10 &&
      w.harrowMissiles.every((m) => w.time >= m.launch && w.time < m.impact),
    "ten missiles launched",
  );
  assert.deepEqual(fired.harrowMissiles, warning.harrowMissiles);
  await checkpoint(
    run,
    (w) => !w.harrowMissiles?.length && w.players.every((p) => p.hp < 10000),
    "missiles impact and synchronized damage",
  );

  run = await fixture("harrow-spin");
  await checkpoint(
    run,
    (w) => w.enemies[0]?.harrow?.kind === "Spin" && w.enemies[0].wind > 0,
    "spin wind-up",
  );
  await checkpoint(
    run,
    (w) =>
      w.enemies[0]?.harrow?.kind === "Spin" &&
      w.players.every((p) => p.hp < 10000),
    "spin damage",
  );

  run = await fixture("harrow-dive");
  await checkpoint(
    run,
    (w) => w.enemies[0]?.harrow?.kind === "Glide",
    "committed glide target",
  );
  await checkpoint(
    run,
    (w) => w.enemies[0]?.harrow?.kind === "Dive",
    "dive transition",
  );
  await checkpoint(
    run,
    (w) =>
      w.enemies[0]?.harrow?.kind === "Land" &&
      w.players.every((p) => p.hp < 10000),
    "dive landing damage",
  );

  run = await fixture("harrow-stagger");
  await checkpoint(
    run,
    (w) => w.enemies[0]?.harrow?.kind === "StaggerFall",
    "damage-triggered stagger fall",
  );
  await checkpoint(
    run,
    (w) =>
      w.enemies[0]?.harrow?.kind === "Land" && !w.enemies[0].harrowAirborne,
    "stagger landing transition",
  );
  assert.ok(
    clients.every((client) => client.errors.length === 0),
    "No transport errors",
  );
  const result = {
    pass: true,
    realLocalWorker: true,
    mockedTransport: false,
    clients: 2,
    fixtures:
      "High-HP stationary players; natural HARROW spawn/AI/missiles/spin; seeded Glide setup; ordinary hurtEnemy starts StaggerFall. All transitions and damage use real Worker ticks.",
    checks,
  };
  writeFileSync(`${directory}/network.json`, JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify({
      pass: true,
      checks: checks.length,
      realLocalWorker: true,
      clients: 2,
    }),
  );
} catch (error) {
  writeFileSync(
    `${directory}/network.json`,
    JSON.stringify(
      { pass: false, error: String(error.message), checks },
      null,
      2,
    ),
  );
  throw error;
} finally {
  for (const client of clients) client.ws.close();
}
