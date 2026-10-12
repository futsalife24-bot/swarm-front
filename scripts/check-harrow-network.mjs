import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const api = process.env.HARROW_TEST_API ?? "http://127.0.0.1:8798";
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  readFileSync(".dev.vars", "utf8"),
)?.[1];
const directory = "dist-validation/harrow";
mkdirSync(directory, { recursive: true });
const clients = [];
const checks = [];
const sourceHashes = Object.fromEntries(
  [
    "src/shared/harrow.ts",
    "server/testing.ts",
    "scripts/check-harrow-network.mjs",
  ].map((path) => [
    path,
    createHash("sha256").update(readFileSync(path)).digest("hex"),
  ]),
);
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

  run = await fixture("harrow-dash");
  const dashWind = await checkpoint(
    run,
    (w) => w.enemies[0]?.harrow?.kind === "Dash" && w.enemies[0].wind > 0,
    "dash ground warning",
  );
  const dashStart = dashWind.enemies[0].z;
  const dashHit = await checkpoint(
    run,
    (w) =>
      w.enemies[0]?.harrow?.kind === "Dash" &&
      w.enemies[0].z > dashStart + 4 &&
      w.players.some((p) => p.hp < 10000),
    "dash travel and contact",
  );
  assert.ok(dashHit.enemies[0].z <= dashStart + 12.01);

  run = await fixture("harrow-snipe");
  const snipeWarning = await checkpoint(
    run,
    (w) =>
      w.enemies[0]?.harrow?.kind === "Snipe" &&
      w.harrowMissiles?.length === 10 &&
      w.harrowMissiles.every(
        (m) => w.time < m.launch && m.trajectory === "straight",
      ),
    "ten fixed straight claw shots",
  );
  assert.equal(new Set(snipeWarning.harrowMissiles.map((m) => m.id)).size, 10);
  assert.ok(
    Math.abs(snipeWarning.harrowMissiles[0].origin.x + 4.949096154 * 1.95) <
      0.01,
    "Worker uses v12 Snipe claw origin",
  );
  await checkpoint(
    run,
    (w) =>
      w.enemies[0]?.harrow?.kind === "Snipe" &&
      w.harrowMissiles?.some((m) => m.launch <= w.time) &&
      w.harrowMissiles.some((m) => m.launch > w.time),
    "staggered straight shot launch",
  );
  await checkpoint(
    run,
    (w) => !w.harrowMissiles?.length && w.players.some((p) => p.hp < 10000),
    "straight shots resolve and damage synchronizes",
  );

  run = await fixture("harrow-bomb");
  const bombWarning = await checkpoint(
    run,
    (w) =>
      w.enemies[0]?.harrow?.kind === "BombPass" &&
      w.harrowMissiles?.length === 10 &&
      w.harrowMissiles.every((m) => w.time < m.launch),
    "two fixed five-bomb rows",
  );
  assert.equal(
    new Set(bombWarning.harrowMissiles.map((m) => m.launch)).size,
    5,
  );
  for (let row = 0; row < 5; row++) {
    const left = bombWarning.harrowMissiles[row * 2];
    const right = bombWarning.harrowMissiles[row * 2 + 1];
    const intendedZ = bombWarning.players[0].z + (row - 2) * 6;
    assert.equal(left.launch, right.launch);
    assert.ok(Math.abs(left.target.z - intendedZ) < 0.2);
    assert.ok(Math.abs(right.target.z - intendedZ) < 0.2);
  }
  assert.ok(
    Math.abs(bombWarning.harrowMissiles[4].origin.x + 0.549980251 * 1.95) <
      0.01,
    "Worker uses v12 moving BombPass claw origin",
  );
  assert.equal(
    bombWarning.harrowMissiles.filter((m) => m.target.x < 0).length,
    5,
  );
  assert.equal(
    bombWarning.harrowMissiles.filter((m) => m.target.x > 0).length,
    5,
  );
  const bombTargets = bombWarning.harrowMissiles.map((m) => m.target);
  const bombFlight = await checkpoint(
    run,
    (w) =>
      w.enemies[0]?.harrow?.kind === "BombPass" &&
      w.enemies[0].z > -10 &&
      w.harrowMissiles?.some((m) => m.launch <= w.time),
    "bomb pass travels above committed rows",
  );
  assert.deepEqual(
    bombFlight.harrowMissiles.map((m) => m.target),
    bombTargets,
  );
  await checkpoint(
    run,
    (w) => !w.harrowMissiles?.length && w.players.some((p) => p.hp < 10000),
    "bomb rows impact and damage synchronizes",
  );

  run = await fixture("harrow-takeoff");
  const takeoff = await checkpoint(
    run,
    (w) =>
      w.enemies[0]?.harrow?.kind === "Takeoff" &&
      typeof w.enemies[0].harrow.flapSeed === "number",
    "authoritative takeoff wing variant",
  );
  const flapSeed = takeoff.enemies[0].harrow.flapSeed;
  assert.ok(flapSeed >= 0 && flapSeed < 1);
  const takeoffMid = await checkpoint(
    run,
    (w) => w.enemies[0]?.harrow?.kind === "Takeoff" && w.time > 1.5,
    "takeoff wing variant persists between ticks",
  );
  assert.equal(takeoffMid.enemies[0].harrow.flapSeed, flapSeed);
  await checkpoint(
    run,
    (w) =>
      w.enemies[0]?.harrowAirborne &&
      !w.enemies[0].harrow &&
      w.enemies[0].y > 0,
    "takeoff reaches synchronized flight",
  );

  run = await fixture("harrow-dive");
  const diveGlide = await checkpoint(
    run,
    (w) => w.enemies[0]?.harrow?.kind === "Glide",
    "committed glide target",
  );
  const diveRoot = diveGlide.enemies[0].harrow.to;
  assert.ok(Math.abs(diveGlide.players[0].x - (diveRoot.x + 7.1)) < 0.01);
  assert.ok(Math.abs(diveGlide.players[0].z - (diveRoot.z + 1.2)) < 0.01);
  assert.ok(
    Math.hypot(
      diveGlide.players[0].x - diveRoot.x,
      diveGlide.players[0].z - diveRoot.z,
    ) > 1.45,
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
      "High-HP stationary players; natural HARROW spawn/AI/missiles/spin; seeded Dash/Snipe/BombPass/Glide fixtures and natural Takeoff variant; ordinary hurtEnemy starts StaggerFall. All transitions and damage use real Worker ticks and two WebSocket clients.",
    checks,
    sourceHashes,
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
      { pass: false, error: String(error.message), checks, sourceHashes },
      null,
      2,
    ),
  );
  throw error;
} finally {
  for (const client of clients) client.ws.close();
}
