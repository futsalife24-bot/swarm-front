import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

// Real local Worker and WebSockets; never writes room codes, tokens or input bodies.
const base = process.env.SWARM_CLOSE_ENDPOINT ?? "http://127.0.0.1:8796";
assert.equal(new URL(base).hostname, "127.0.0.1");
const out =
  process.env.SWARM_CLOSE_OUTPUT ??
  "dist-validation/coop-comfort-close-20261113/baseline";
mkdirSync(out, { recursive: true });
const bundle = path.resolve(out, "helpers.mjs");
await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
export {frontTemporaryWeapons} from './src/shared/front-run';
export {FRONT_BASE_IDS} from './src/shared/front-upgrades';
export {neutral} from './src/shared/game';
export {localCreationKey} from './tests/credentials';
export {StateChunkAssembler} from './src/shared/state-chunks';
export {StateDeltaReceiver} from './src/shared/state-delta';
export {restoreStateTuples} from './src/shared/state-tuples';`,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundle,
  logLevel: "silent",
});
const {
  frontTemporaryWeapons,
  FRONT_BASE_IDS,
  neutral,
  localCreationKey,
  StateChunkAssembler,
  StateDeltaReceiver,
  restoreStateTuples,
} = await import(pathToFileURL(bundle));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(get, message, ms = 12000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = get();
    if (v) return v;
    await sleep(25);
  }
  throw Error(message);
}
const summary = (a) => {
  a = [...a].sort((a, b) => a - b);
  return {
    samples: a.length,
    p50: a[Math.floor(a.length * 0.5)] ?? 0,
    p95: a[Math.floor(a.length * 0.95)] ?? 0,
    max: a.at(-1) ?? 0,
  };
};
class Client {
  id = "";
  token = "";
  seq = 0;
  latest = null;
  world = null;
  selected = new Set();
  measure = false;
  rows = [];
  sizes = [];
  notices = [];
  closes = [];
  errors = [];
  bytes = 0;
  incoming = 0;
  constructor(code, key, version, token = "") {
    this.chunks = new StateChunkAssembler();
    this.delta = new StateDeltaReceiver();
    this.ws = new WebSocket(
      `${base.replace("http", "ws")}/rooms/${code}?ruleset=front-v1&testClient=${key}`,
    );
    this.ws.onopen = () =>
      this.send({
        type: "hello",
        frontGrowth: 3,
        frontCatalog: 2,
        frontOpening: 2,
        ...(token ? { token } : {}),
        ...(version === "object"
          ? {}
          : {
              stateTuples: version === "v1" ? 1 : 2,
              stateOmissions: 1,
              pleatPose: 1,
            }),
        ...(version === "modern" || version === "chunks-v1"
          ? {
              stateChunks: 1,
              ...(version === "modern" ? { stateChunkBudget: 1 } : {}),
              stateFlow: 1,
              stateDelta: 1,
              stateDeltaPlayers: 1,
              inputReceipt: 1,
              networkTiming: 1,
              equipmentCache: 1,
            }
          : {}),
      });
    this.ws.onmessage = (e) => {
      const raw = String(e.data);
      if (this.measure) {
        this.bytes += Buffer.byteLength(raw);
        this.sizes.push(Buffer.byteLength(raw));
      }
      const assembled = this.chunks.read(raw);
      if (!assembled) return;
      const m = this.delta.decode(assembled);
      if (!m) return;
      if (!restoreStateTuples(m)) {
        this.errors.push("tuple decode");
        return;
      }
      if (m.type === "welcome") {
        this.id = m.id;
        this.token = m.token;
      }
      if (m.members) this.latest = m;
      if (m.type === "notice") this.notices.push(m.reason);
      if (m.type === "error") this.errors.push(m.reason);
      if (m.type === "state") {
        this.world = m.world;
        if (this.measure)
          this.rows.push({
            ms: performance.now(),
            enemies: m.world.enemies.length,
            projectiles: m.world.projectiles.length,
            orbs: m.world.front?.orbs.length,
            mines: m.world.front?.mines?.length,
            omitted: m.omitted?.enemies?.length ?? 0,
            hp: m.world.enemies.filter((e) => e.hp > 0).length,
            tickMs: m.networkTiming?.tickMs,
            encodeMs: m.networkTiming?.previousEncodeMs,
          });
        if (m.stateId) this.send({ type: "stateAck", stateAck: m.stateId });
        const o = m.frontView?.offer;
        if (o && !this.selected.has(o.id)) {
          this.selected.add(o.id);
          this.send({
            type: "frontChoose",
            request: {
              runId: m.world.run,
              offerId: o.id,
              revision: o.revision,
              requestId: o.id + ":" + this.id,
              cardId: o.defaultCardId,
            },
          });
        }
      }
    };
    this.ws.onclose = (e) => {
      if (this.measure) this.closes.push(e.code);
    };
    this.ws.onerror = () => this.errors.push("websocket error");
  }
  send(m) {
    if (this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(m));
      if (this.measure) this.incoming++;
    }
  }
}
const trials = [];
for (const version of (
  process.env.SWARM_CLOSE_VERSIONS ?? "object,v1,modern"
).split(",")) {
  for (const count of (process.env.SWARM_CLOSE_COUNTS ?? "100,400")
    .split(",")
    .map(Number)) {
    const key = createHash("sha256")
      .update(`${Date.now()}-${version}-${count}`)
      .digest("hex");
    const r = await fetch(base + "/rooms", {
      method: "POST",
      headers: {
        "X-Room-Creation-Key": localCreationKey(),
        "X-Test-Client": key,
      },
      body: JSON.stringify({
        name: "隔離境界検査",
        listed: false,
        ruleset: "front-v1",
        mode: "survival",
      }),
    });
    assert.equal(r.status, 200);
    const { code } = await r.json();
    const clients = [];
    try {
      for (let i = 0; i < 4; i++) {
        const c = new Client(
          code,
          key,
          version === "mixed" ? (i ? "modern" : "object") : version,
        );
        clients.push(c);
        await until(() => c.id, "welcome");
        c.send({
          type: "equip",
          upgradePool: FRONT_BASE_IDS,
          weapons: frontTemporaryWeapons("close", String(i), ["rifle", "smg"]),
        });
        await until(
          () =>
            c.latest?.members.find((m) => m.id === c.id)?.weapons?.length === 2,
          "equip",
        );
      }
      await until(() => clients[0].latest?.members.length === 4, "members");
      await sleep(200);
      const lobby = clients[0].latest;
      clients.forEach((c) =>
        c.send({
          type: "ready",
          ready: true,
          stage: lobby.stage,
          preparationGeneration: lobby.preparationGeneration,
        }),
      );
      await until(
        () => clients[0].latest?.members.every((m) => m.ready),
        "ready",
      );
      clients[0].send({ type: "start" });
      await until(() => clients.every((c) => c.world), "state");
      await sleep(350);
      clients.forEach((c) => (c.measure = true));
      const f = await fetch(
        `${base}/fixtures/${code}/front-comfort-close?projectiles=${count}`,
        { method: "POST" },
      );
      assert.equal(f.status, 200);
      const fixture = await f.json();
      await sleep(1200);
      const rows = clients.map((c) => ({
        bytes: c.bytes,
        maxFrame: Math.max(0, ...c.sizes),
        minMargin: 65536 - Math.max(0, ...c.sizes),
        states: c.rows.length,
        first: c.rows.find((row) => row.enemies === 97),
        denseStates: c.rows.filter((row) => row.enemies === 97).length,
        incompleteDenseStates: c.rows.filter(
          (row) =>
            row.enemies > 0 &&
            (row.enemies !== 97 ||
              row.projectiles !== count ||
              row.orbs !== 160 ||
              row.mines !== 20 ||
              row.hp !== 97 ||
              row.omitted !== 0),
        ).length,
        closes: [...c.closes],
        notices: [...c.notices],
        errors: [...c.errors],
      }));
      let reconnect;
      if (version === "object" && count === 400) {
        const old = clients[0],
          restored = new Client(code, key, "modern", old.token);
        clients.push(restored);
        await until(
          () => restored.world?.enemies.length === 97,
          "modern token recovery",
        );
        await sleep(300);
        reconnect = {
          samePlayer: restored.id === old.id,
          enemies: restored.world.enemies.length,
          projectiles: restored.world.projectiles.length,
          errors: [...restored.errors],
        };
        assert.equal(reconnect.samePlayer, true);
        assert.deepEqual(reconnect.errors, []);
      }
      for (const row of rows) {
        assert.equal(row.errors.length, 0);
        assert.ok(row.maxFrame <= 61440);
        assert.equal(row.incompleteDenseStates, 0);
        if (row.notices.length) assert.ok(row.closes.includes(4000));
        else assert.ok(row.denseStates > 0);
      }
      trials.push({ version, count, fixture, clients: rows, reconnect });
      console.log(JSON.stringify({ version, count, clients: rows }));
    } finally {
      clients.forEach((c) => {
        c.measure = false;
        c.ws.close();
      });
      await sleep(250);
    }
  }
}
writeFileSync(
  path.join(out, "results.json"),
  JSON.stringify(
    {
      method:
        "4 real local Worker WebSockets; fixed seed 4520; A-1 composition; 400 projectiles is synthetic overflow, not asserted legal maximum",
      trials,
    },
    null,
    2,
  ),
);
