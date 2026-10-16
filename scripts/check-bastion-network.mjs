// BASTION（仮称）の協力同期チェック。実ローカルWorker（wrangler.test.jsonc）へ
// 2クライアントで接続し、通常のstep・弾・入力・配信だけを使う。
//  1) preset: 硬化100のフィクスチャから 予備動作→赤予告→12発→開放 を観測
//  2) fire:   硬化0から2人の実射撃入力（初期装備AR）だけで硬化・軽減・反撃まで進める
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const api = process.env.BASTION_TEST_API ?? "http://127.0.0.1:8797";
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  readFileSync(".dev.vars", "utf8"),
)?.[1];
async function until(fn, label, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw Error("Timeout: " + label);
}
const bastion = (w) => w.enemies.find((e) => e.kind === "bastion");

async function room(fixture) {
  assert.ok(key);
  const response = await fetch(api + "/rooms", {
    method: "POST",
    headers: { "X-Room-Creation-Key": key },
  });
  assert.equal(response.status, 200);
  const { code } = await response.json();
  const clients = [];
  for (let i = 0; i < 2; i++) {
    const c = {
      ws: new WebSocket(api.replace("http", "ws") + "/rooms/" + code),
      id: null,
      states: [],
      events: new Map(),
      errors: [],
    };
    clients.push(c);
    c.ws.onopen = () => c.ws.send(JSON.stringify({ type: "hello" }));
    c.ws.onmessage = (event) => {
      const m = JSON.parse(event.data);
      if (m.type === "welcome") c.id = m.id;
      if (m.type === "state") {
        c.states.push(m.world);
        for (const e of m.world.events ?? []) c.events.set(e.id, e);
      }
      if (m.type === "error") c.errors.push(m.message ?? m.error);
    };
    await until(() => c.id, "join");
  }
  assert.ok(
    (await fetch(`${api}/fixtures/${code}/${fixture}`, { method: "POST" })).ok,
  );
  return clients;
}
const close = (clients) => clients.forEach((c) => c.ws.close());

async function preset() {
  const clients = await room("bastion");
  try {
    const phases = {};
    for (const phase of ["brace", "warn", "open"])
      phases[phase] = await until(
        () => clients[0].states.find((w) => bastion(w)?.bastion?.phase === phase),
        "phase " + phase,
      );
    const fired = await until(
      () =>
        clients[0].states.find(
          (w) => w.projectiles.filter((q) => q.style === "bastion").length === 12,
        ),
      "12 counter rounds",
    );
    const peer = await until(
      () =>
        clients[1].states.find(
          (w) => w.run === fired.run && w.time === fired.time,
        ),
      "same peer tick",
    );
    assert.deepEqual(peer.enemies, fired.enemies);
    assert.deepEqual(peer.projectiles, fired.projectiles);
    const warn = bastion(phases.warn).bastion;
    assert.equal(warn.volley.count, 12);
    assert.equal(bastion(phases.brace).bastion.volley, undefined);
    const timeline = {
      brace: phases.brace.time,
      warn: phases.warn.time,
      open: phases.open.time,
    };
    assert.ok(timeline.warn - timeline.brace >= 0.7);
    assert.ok(timeline.open - timeline.warn >= 0.7);
    assert.ok(clients.every((c) => c.errors.length === 0));
    return {
      timeline,
      committedVolley: warn.volley,
      firedRounds: 12,
      matchingTick: fired.time,
      peerMatches: true,
      openState: bastion(phases.open).bastion,
    };
  } finally {
    close(clients);
  }
}

async function fire() {
  const clients = await room("bastion-fire");
  let seq = 1;
  const send = () => {
    for (const c of clients) {
      const w = c.states.at(-1);
      const p = w?.players.find((p) => p.id === c.id);
      const e = w && bastion(w);
      if (!p || !e) continue;
      const cy = e.y + 1.7;
      c.ws.send(
        JSON.stringify({
          type: "input",
          input: {
            mx: 0,
            mz: 0,
            yaw: Math.atan2(e.x - p.x, -(e.z - p.z)),
            pitch: Math.atan2(cy - ((p.y ?? 0) + 1.5), Math.hypot(e.x - p.x, e.z - p.z)),
            fire: true,
            reload: false,
            dodge: false,
            jump: false,
            swap: false,
            revive: false,
            seq: seq++,
          },
        }),
      );
    }
  };
  const timer = setInterval(send, 50);
  try {
    const hardened = await until(
      () => clients[0].states.find((w) => (bastion(w)?.bastion?.armor ?? 0) >= 75),
      "hardened by real fire",
    );
    const volley = await until(
      () =>
        clients[0].states.find(
          (w) => w.projectiles.filter((q) => q.style === "bastion").length >= 6,
        ),
      "counter volley under fire",
    );
    clearInterval(timer);
    const peer = await until(
      () =>
        clients[1].states.find(
          (w) => w.run === hardened.run && w.time === hardened.time,
        ),
      "same peer tick",
    );
    assert.deepEqual(bastion(peer), bastion(hardened));
    // 両クライアントが同じ被弾イベント（段階・軽減後ダメージ）を受け取る。
    const hits = (c) =>
      [...c.events.values()]
        .filter((e) => e.type === "hit" && e.enemyKind === "bastion")
        .map((e) => `${e.id}:${e.guard ?? 0}:${e.amount}`);
    const a = new Set(hits(clients[0])),
      b = new Set(hits(clients[1]));
    const shared = [...a].filter((h) => b.has(h));
    assert.ok(shared.length >= 20, "shared hit events");
    const byGuard = {};
    for (const h of shared) {
      const [, guard, amount] = h.split(":").map(Number);
      (byGuard[guard] ??= new Set()).add(amount);
    }
    // AR 24 × 距離減衰1（22m以内）× (1 - 軽減) の丸め。
    const expected = { 0: 24, 1: 19, 2: 14, 3: 10 };
    for (const [guard, amounts] of Object.entries(byGuard))
      assert.deepEqual([...amounts], [expected[guard]], `guard ${guard}`);
    assert.ok(byGuard[3], "hits at the 60% step");
    assert.ok(clients.every((c) => c.errors.length === 0));
    const armorSeries = clients[0].states
      .filter((w) => bastion(w) && w.time <= volley.time)
      .map((w) => [w.time, Math.round(bastion(w).bastion.armor), bastion(w).bastion.phase]);
    return {
      hardenedAt: hardened.time,
      volleyAt: volley.time,
      volleyRounds: volley.projectiles.filter((q) => q.style === "bastion").length,
      peerMatchesAtHardened: true,
      sharedHitEvents: shared.length,
      amountsByGuard: Object.fromEntries(
        Object.entries(byGuard).map(([g, s]) => [g, [...s]]),
      ),
      armorSeries,
    };
  } finally {
    clearInterval(timer);
    close(clients);
  }
}

const result = {
  pass: true,
  realLocalWorker: true,
  clients: 2,
  preset: await preset(),
  fire: await fire(),
};
mkdirSync("dist-validation/bastion", { recursive: true });
writeFileSync("dist-validation/bastion/network.json", JSON.stringify(result, null, 2));
console.log(
  JSON.stringify(
    { ...result, fire: { ...result.fire, armorSeries: `${result.fire.armorSeries.length} samples` } },
    null,
    2,
  ),
);
