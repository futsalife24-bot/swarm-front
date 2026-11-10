// 本番Room/Workerにv2 WebSocketを2本接続し、ΩとHPの同時刻一致を照合する。
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.env.SWARM_TEST_SERVER_URL ?? "http://127.0.0.1:8797";
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  readFileSync(".dev.vars", "utf8"),
)?.[1];
const clients = [];
const enemyField = (tuple, index) => {
  const mask = tuple[0];
  if (Math.floor(mask / 2 ** index) % 2 === 0) return undefined;
  let offset = 1;
  for (let i = 0; i < index; i++) if (Math.floor(mask / 2 ** i) % 2) offset++;
  return tuple[offset];
};
const wait = async (fn, label) => {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw Error(
    "待機期限: " +
      label +
      " / " +
      JSON.stringify(
        clients.map((c) => ({
          states: c.states.length,
          lastTime: c.states.at(-1)?.time,
          lastPhase: c.states.at(-1)?.phase,
          lastOmega: Boolean(c.states.at(-1)?.enemies?.[0]?.omega),
          errors: c.errors,
        })),
      ),
  );
};
try {
  const r = await fetch(base + "/rooms", {
    method: "POST",
    headers: { "X-Room-Creation-Key": key },
  });
  assert.equal(r.status, 200);
  const { code } = await r.json();
  for (let i = 0; i < 2; i++) {
    const c = {
      ws: new WebSocket(base.replace("http", "ws") + "/rooms/" + code),
      id: null,
      states: [],
      errors: [],
    };
    clients.push(c);
    c.ws.onopen = () =>
      c.ws.send(JSON.stringify({ type: "hello", stateTuples: 2 }));
    c.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.type === "welcome") c.id = m.id;
      if (m.type === "state") {
        assert.equal(m.stateEncoding, "tuples-v2");
        m.world.enemies = m.world.enemies.map((enemy) => ({
          segments: enemyField(enemy, 32),
          omega: enemyField(enemy, 33),
        }));
        c.states.push(m.world);
      }
      if (m.type === "error") c.errors.push(m.message ?? m.error);
    };
    await wait(() => c.id, "入室");
  }
  const fixture = await fetch(`${base}/fixtures/${code}/catena-omega`, {
    method: "POST",
  });
  assert.equal(fixture.status, 200, await fixture.text());
  await wait(
    () =>
      clients.every((c) =>
        c.states.some((w) => w.enemies?.[0]?.omega && w.time > 1.8),
      ),
    "Ω飛行",
  );
  await wait(
    () =>
      clients.every((c) =>
        c.states.some(
          (w) => w.players.find((p) => p.id === clients[0].id)?.hp < 1000,
        ),
      ),
    "着地",
  );
  const first = clients[0].states.filter(
    (w) => w.enemies?.[0]?.segments?.length === 14,
  );
  let matched = 0;
  const phases = new Set();
  let maxBytes = 0;
  for (const w of first) {
    const peer = clients[1].states.find(
      (v) => v.run === w.run && v.time === w.time,
    );
    if (!peer) continue;
    const a = w.enemies[0],
      b = peer.enemies[0];
    assert.deepEqual(a, b);
    assert.deepEqual(
      w.players.map((p) => p.hp),
      peer.players.map((p) => p.hp),
    );
    matched++;
    const age = a.omega ? w.time - a.omega.at : -1;
    phases.add(
      age < 0 ? "完了" : age < 0.7 ? "予備" : age < 1.6 ? "赤予告" : "飛行",
    );
    maxBytes = Math.max(maxBytes, Buffer.byteLength(JSON.stringify(w)));
  }
  assert.ok(matched > 10);
  for (const p of ["予備", "赤予告", "飛行", "完了"])
    assert.ok(phases.has(p), p);
  const last = first.at(-1);
  const hit = last.players.find((p) => p.id === clients[0].id),
    safe = last.players.find((p) => p.id === clients[1].id);
  assert.equal(hit.hp, 992);
  assert.equal(safe.hp, 1000);
  assert.ok(clients.every((c) => !c.errors.length));
  mkdirSync("dist-validation/catena-omega", { recursive: true });
  writeFileSync(
    "dist-validation/catena-omega/network.json",
    JSON.stringify(
      {
        pass: true,
        realWorker: true,
        sockets: 2,
        fixture: "通常市街地の安全配置・size0.8・Ω即開始のみ",
        matched,
        phases: [...phases],
        maxBytes,
        hp: [hit.hp, safe.hp],
        errors: clients.map((c) => c.errors),
      },
      null,
      2,
    ),
  );
  console.log("実Worker Ω通信合格", matched, [hit.hp, safe.hp]);
} finally {
  for (const c of clients) c.ws.close();
}
