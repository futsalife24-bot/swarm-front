import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

// Real local Worker/WebSockets, no rendering, no real saves. Never log credentials.
const out = "dist-validation/coop-comfort-20261030/clock-current";
mkdirSync(out, { recursive: true });
const bundle = path.resolve(out, "helpers.mjs");
await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `export {frontTemporaryWeapons} from './src/shared/front-run';export {FRONT_BASE_IDS} from './src/shared/front-upgrades';export {neutral} from './src/shared/game';export {localCreationKey} from './tests/credentials';export {StateChunkAssembler} from './src/shared/state-chunks';export {restoreStateTuples} from './src/shared/state-tuples';`,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundle,
});
const {
  frontTemporaryWeapons,
  FRONT_BASE_IDS,
  neutral,
  localCreationKey,
  StateChunkAssembler,
  restoreStateTuples,
} = await import(pathToFileURL(bundle));
const base = "http://127.0.0.1:8793";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const percentile = (values, p) =>
  [...values].sort((a, b) => a - b)[
    Math.min(values.length - 1, Math.floor(values.length * p))
  ] ?? null;
const results = {
  head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  workingChanges: true,
  mode: "survival",
  secondsPerTrial: 30,
  trials: [],
  limitations: [
    "同一PCのローカル実Worker・WebSocket。描画/実スマホ/実インターネットは含まない。",
    "部屋seedは試行ごとにサーバー生成。通常移動と強化選択のみで、射撃・長期混戦の検証ではない。",
  ],
};
class Client {
  messages = [];
  rows = [];
  errors = [];
  closes = [];
  id = "";
  seq = 0;
  chosen = new Set();
  measuring = false;
  frames = 0;
  wireBytes = 0;
  frameMax = 0;
  chunks = new StateChunkAssembler();
  constructor(code, key) {
    this.ws = new WebSocket(
      `${base.replace("http", "ws")}/rooms/${code}?ruleset=front-v1&testClient=${key}`,
    );
    this.ws.onopen = () =>
      this.send({
        type: "hello",
        frontGrowth: 3,
        frontCatalog: 2,
        frontOpening: 2,
        equipmentCache: 1,
        stateOmissions: 1,
        stateTuples: 1,
        stateChunks: 1,
      });
    this.ws.onclose = (e) => {
      if (this.measuring) this.closes.push({ code: e.code, reason: e.reason });
    };
    this.ws.onmessage = (e) => {
      const at = performance.now(),
        raw = String(e.data),
        size = Buffer.byteLength(raw);
      if (this.measuring) {
        this.frames++;
        this.wireBytes += size;
        this.frameMax = Math.max(this.frameMax, size);
      }
      const m = this.chunks.read(raw);
      if (!m) return;
      if (!restoreStateTuples(m)) {
        this.errors.push("戦況の復元失敗");
        return;
      }
      this.messages.push(m);
      if (this.messages.length > 500) this.messages.shift();
      if (m.type === "welcome") this.id = m.id;
      if (m.type === "error") this.errors.push(m.reason);
      if (m.type === "state") {
        if (this.measuring)
          this.rows.push({
            at,
            time: m.world.time,
            phase: m.frontView?.phase,
            enemies: m.world.enemies.length,
            orbs: m.world.front?.orbs.length ?? 0,
            omittedEnemies: m.omitted?.enemies?.length ?? 0,
          });
        const offer = m.frontView?.offer;
        if (offer && !this.chosen.has(offer.id)) {
          this.chosen.add(offer.id);
          this.send({
            type: "frontChoose",
            request: {
              runId: m.world.run,
              offerId: offer.id,
              revision: offer.revision,
              requestId: offer.id + ":" + this.id,
              cardId: offer.defaultCardId,
            },
          });
        }
      }
    };
  }
  send(value) {
    if (this.ws.readyState === WebSocket.OPEN)
      this.ws.send(JSON.stringify(value));
  }
  async wait(predicate) {
    const until = performance.now() + 15000;
    while (performance.now() < until) {
      const m = this.messages.findLast(predicate);
      if (m) return m;
      if (this.errors.length) throw Error(this.errors.join(","));
      await sleep(25);
    }
    throw Error("必要な応答の待機がタイムアウト");
  }
  latest() {
    return this.messages.findLast((m) => m.members);
  }
}
for (const count of [1, 4]) {
  const key = `comfort-clock-${Date.now()}-${count}`;
  const response = await fetch(base + "/rooms", {
    method: "POST",
    headers: {
      "X-Room-Creation-Key": localCreationKey(),
      "X-Test-Client": key,
    },
    body: JSON.stringify({
      name: "隔離時計計測",
      listed: false,
      ruleset: "front-v1",
      mode: "survival",
    }),
  });
  assert.ok(response.ok, `部屋作成HTTP ${response.status}`);
  const { code } = await response.json(),
    members = [];
  let timer;
  try {
    for (let i = 0; i < count; i++) {
      const c = new Client(code, key);
      members.push(c);
      await c.wait((m) => m.type === "welcome");
      c.send({
        type: "equip",
        upgradePool: FRONT_BASE_IDS,
        weapons: frontTemporaryWeapons("measurement", `p${i}`, [
          "rifle",
          "smg",
        ]),
      });
      await c.wait(
        (m) =>
          m.type === "lobby" &&
          m.members.find((p) => p.id === c.id)?.weapons?.length === 2,
      );
    }
    await sleep(250);
    const generation = members[0].latest().preparationGeneration;
    for (const c of members)
      c.send({
        type: "ready",
        ready: true,
        stage: members[0].latest().stage,
        preparationGeneration: generation,
      });
    await members[0].wait(
      (m) => m.members?.length === count && m.members.every((p) => p.ready),
    );
    members[0].send({ type: "start" });
    await Promise.all(
      members.map((c) =>
        c.wait((m) => m.type === "state" && m.frontView?.phase === "combat"),
      ),
    );
    const start = performance.now();
    for (const c of members) c.measuring = true;
    timer = setInterval(() => {
      const t = (performance.now() - start) / 1000;
      members.forEach((c, i) =>
        c.send({
          type: "input",
          input: {
            ...neutral(),
            seq: ++c.seq,
            mx: Math.sin(t * 0.3 + i),
            mz: Math.cos(t * 0.3 + i),
            yaw: Math.atan2(Math.sin(t * 0.3 + i), Math.cos(t * 0.3 + i)),
          },
        }),
      );
    }, 50);
    await sleep(results.secondsPerTrial * 1000);
    clearInterval(timer);
    const trial = {
      players: count,
      wallMs: performance.now() - start,
      clients: members.map((c) => {
        c.measuring = false;
        const combat = c.rows.filter(
          (r) => r.phase === "combat" || r.phase === "boss",
        );
        const intervals = combat.slice(1).map((r, i) => r.at - combat[i].at);
        return {
          packets: c.rows.length,
          frames: c.frames,
          wireBytes: c.wireBytes,
          frameMax: c.frameMax,
          intervalP95: percentile(intervals, 0.95),
          intervalMax: Math.max(...intervals),
          over250ms: intervals.filter((v) => v > 250).length,
          enemiesMax: Math.max(...c.rows.map((r) => r.enemies)),
          omittedMax: Math.max(...c.rows.map((r) => r.omittedEnemies)),
          gameTimeFirst: c.rows[0]?.time,
          gameTimeLast: c.rows.at(-1)?.time,
          errors: c.errors,
          closes: c.closes,
          rows: c.rows,
        };
      }),
    };
    results.trials.push(trial);
    writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
    console.log(
      JSON.stringify({
        ...trial,
        clients: trial.clients.map(({ rows, ...rest }) => rest),
      }),
    );
    assert.ok(
      trial.clients.every(
        (c) =>
          c.errors.length === 0 && c.closes.length === 0 && c.omittedMax === 0,
      ),
    );
  } finally {
    clearInterval(timer);
    for (const c of members) {
      c.measuring = false;
      c.ws.close();
    }
  }
}
