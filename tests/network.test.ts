import { request as httpRequest } from "node:http";
import { localCreationKey } from "./credentials";
import { afterEach, describe, it, expect } from "vitest";
import { STARTERS } from "../src/shared/defs";
import { neutral } from "../src/shared/game";
import { fresh, rewards } from "../src/client/save";
import { writeFileSync } from "node:fs";
const base = "http://127.0.0.1:8787";
class Client {
  ws: WebSocket;
  messages: any[] = [];
  id = "";
  token = "";
  constructor(code: string, token = "", endpoint = base) {
    this.ws = new WebSocket(`${endpoint.replace("http", "ws")}/rooms/${code}`);
    this.ws.onopen = () =>
      this.send({ type: "hello", ...(token ? { token } : {}) });
    this.ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      this.messages.push(m);
      if (m.type === "welcome") {
        this.id = m.id;
        this.token = m.token;
      }
    };
  }
  send(m: unknown) {
    this.ws.send(JSON.stringify(m));
  }
  async wait(predicate: (m: any) => boolean, timeout = 5000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const found = this.messages.find(predicate);
      if (found) return found;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error("Expected server event did not arrive");
  }
  close() {
    this.ws.close();
  }
}
const clients: Client[] = [];
afterEach(() => {
  clients.splice(0).forEach((c) => c.close());
});

describe("P1 admission and reconnect regressions over real Workers", () => {
  const endpoint = "http://127.0.0.1:8789";
  const fixture = async (code: string, name: string) => {
    const response = await fetch(`${endpoint}/fixtures/${code}/${name}`, {
      method: "POST",
    });
    expect(response.status).toBe(200);
    return response.json();
  };
  it("requires credentials even with a forged/missing Origin; fake codes consume no global slots", async () => {
    const stats = async () =>
      (await fetch(`${endpoint}/admission-stats`)).json();
    const before = await stats();
    for (const headers of [
      {},
      { Origin: "http://127.0.0.1:5186" },
      { "X-Room-Creation-Key": "wrong", Origin: "http://127.0.0.1:5186" },
    ]) {
      const response = await fetch(`${endpoint}/rooms`, {
        method: "POST",
        headers: headers as Record<string, string>,
      });
      expect(response.status).toBe(401);
      expect((await response.text()).includes(localCreationKey())).toBe(false);
    }
    expect(await stats()).toEqual(before);
    for (let n = 0; n < 65; n++) {
      const code = crypto.randomUUID().replaceAll("-", "");
      const status = await new Promise<number>((resolve, reject) => {
        const req = httpRequest(
          endpoint + "/rooms/" + code,
          { headers: { Upgrade: "websocket", Connection: "Upgrade" } },
          (res) => {
            res.resume();
            resolve(res.statusCode!);
          },
        );
        req.on("error", reject);
        req.setTimeout(5000, () => req.destroy(new Error("Handshake timeout")));
        req.end();
      });
      expect(status).toBe(404);
    }
    expect(await stats()).toEqual(before);
    const code = await room(endpoint); // correct credential succeeds after invalid attempts
    expect(code).toMatch(/^[a-f0-9]{32}$/);
    const cs = [];
    for (let n = 0; n < 4; n++) cs.push(await join(code, "", endpoint));
    const fifth = new Client(code, "", endpoint);
    clients.push(fifth);
    expect((await fifth.wait((m) => m.type === "error")).reason).toContain(
      "満員",
    );
    const after = await stats();
    expect(after.total - before.total).toBe(1);
    expect(after.connections - before.connections).toBe(5);
    for (const c of cs) {
      expect(c.ws.url.includes(c.token)).toBe(false);
      expect(c.ws.url.includes(localCreationKey())).toBe(false);
      for (const m of c.messages.filter((m) => m.type !== "welcome")) {
        const raw = JSON.stringify(m);
        expect(raw.includes(localCreationKey())).toBe(false);
        expect(cs.some((peer) => raw.includes(peer.token))).toBe(false);
      }
    }
  });
  it("keeps disconnected HP/ammo/timers, pauses all-disconnected, resumes identical state within 30 seconds", async () => {
    const code = await room(endpoint),
      a = await join(code, "", endpoint),
      b = await join(code, "", endpoint);
    await fixture(code, "freeze");
    a.close();
    await b.wait(
      (m) => m.type === "state" && m.world.players[0].connected === false,
    );
    const before = await fixture(code, "snapshot");
    await new Promise((r) => setTimeout(r, 10000));
    const later = await fixture(code, "snapshot");
    expect(later.world.players[0]).toEqual(before.world.players[0]);
    expect(later.world.players[0].hp).toBe(50);
    expect(later.world.time).toBeGreaterThan(before.world.time);
    b.close();
    await new Promise((r) => setTimeout(r, 150));
    const paused = await fixture(code, "snapshot");
    expect(paused.paused).toBe(true);
    expect(paused.running).toBe(false);
    expect(paused.world.phase).toBe("battle");
    await new Promise((r) => setTimeout(r, 500));
    expect((await fixture(code, "snapshot")).world).toEqual(paused.world);
    const back = await join(code, a.token, endpoint);
    expect(back.id).toBe(a.id);
    const resumed = await back.wait((m) => m.type === "state");
    const p = resumed.world.players[0],
      old = paused.world.players[0];
    for (const key of ["hp", "cool", "reload", "safe", "x", "z"])
      expect(p[key]).toBe(Math.round(old[key] * 100) / 100);
    expect(p.ammo).toEqual(old.ammo);
    expect(p.connected).toBe(true);
    expect(resumed.world.phase).toBe("battle");
    expect(resumed.world.time).toBe(Math.round(paused.world.time * 100) / 100);
    expect(JSON.stringify(resumed).includes(back.token)).toBe(false);
  });
  it("retains the 30-second disconnected participant expiry", async () => {
    const code = await room(endpoint),
      a = await join(code, "", endpoint),
      b = await join(code, "", endpoint);
    await fixture(code, "freeze");
    a.close();
    await b.wait((m) => m.type === "state" && !m.world.players[0].connected);
    await new Promise((r) => setTimeout(r, 30500));
    const late = new Client(code, a.token, endpoint);
    clients.push(late);
    expect((await late.wait((m) => m.type === "error")).reason).toContain(
      "期限",
    );
  }, 40000);
});

describe("isolated real-Workers fixtures (not full-mission proof)", () => {
  it("server revives a downed ally, persists individual results, and replays identical rewards safely", async () => {
    const endpoint = "http://127.0.0.1:8789",
      code = await room(endpoint),
      a = await join(code, "", endpoint),
      b = await join(code, "", endpoint);
    a.send({ type: "equip", weapons: STARTERS.slice(0, 2) });
    b.send({ type: "equip", weapons: STARTERS.slice(0, 2) });
    await a.wait(
      (m) => m.type === "lobby" && m.members.every((p: any) => p.ready),
    );
    const fixture = async (name: string) => {
      const r = await fetch(`${endpoint}/fixtures/${code}/${name}`, {
        method: "POST",
        signal: AbortSignal.timeout(7000),
      });
      expect(r.ok).toBe(true);
    };
    await fixture("revive");
    const down = await a.wait(
      (m) => m.type === "state" && m.world.players[0].hp === 0,
    );
    let seq = 0;
    const aid = setInterval(
      () =>
        b.send({
          type: "input",
          input: { ...neutral(), seq: ++seq, revive: true },
        }),
      50,
    );
    try {
      const revived = await a.wait(
        (m) =>
          m.type === "state" &&
          m.world.run === down.world.run &&
          m.world.players[0].hp >= 90,
        15000,
      );
      const same = await b.wait(
        (m) =>
          m.type === "state" &&
          m.world.time === revived.world.time &&
          m.world.run === revived.world.run,
      );
      expect(same.world.players[0].hp).toBe(revived.world.players[0].hp);
    } finally {
      clearInterval(aid);
    }
    await fixture("load");
    const load = await a.wait(
      (m) => m.type === "state" && m.world.enemies.length === 40,
    );
    const bytes = Buffer.byteLength(JSON.stringify(load));
    expect(bytes).toBeLessThan(65536);
    await fixture("reward");
    const prepared = await a.wait(
      (m) => m.type === "state" && m.world.enemies[0]?.kind === "boss",
    );
    a.send({
      type: "input",
      input: { ...neutral(), fire: true, seq: 1, pitch: 0.15 },
    });
    const clear = await a.wait(
      (m) =>
        m.type === "state" &&
        m.world.phase === "victory" &&
        m.world.run === prepared.world.run,
    );
    const other = await b.wait(
      (m) =>
        m.type === "state" &&
        m.world.phase === "victory" &&
        m.world.run === clear.world.run,
    );
    expect(clear.world.rewards[a.id].length).toBeGreaterThan(0);
    expect(Object.keys(clear.world.rewards)).toEqual([a.id]);
    expect(Object.keys(other.world.rewards)).toEqual([b.id]);
    expect(
      new Set(
        [...clear.world.rewards[a.id], ...other.world.rewards[b.id]].map(
          (w) => w.id,
        ),
      ).size,
    ).toBe(4);
    const token = a.token,
      id = a.id;
    a.close();
    await new Promise((r) => setTimeout(r, 150));
    const back = await join(code, token, endpoint);
    expect(back.id).toBe(id);
    const replay = await back.wait(
      (m) => m.type === "state" && m.world.phase === "victory",
    );
    expect(replay.world.rewards[id]).toEqual(clear.world.rewards[id]);
    const saved = rewards(
      fresh(),
      clear.world.run,
      clear.world.rewards[id],
    ).save;
    expect(
      rewards(saved, replay.world.run, replay.world.rewards[id]).save.inventory,
    ).toEqual(saved.inventory);
    writeFileSync(
      "dist-validation/evidence/network.json",
      JSON.stringify(
        {
          transport: "real local workerd WebSocket",
          clients: 2,
          revive: true,
          individualRewards: true,
          reconnect: true,
          rewardDedup: true,
          loadEnemies: 40,
          snapshotBytes: bytes,
          fixtureSetup: true,
        },
        null,
        2,
      ),
    );
  });
});
async function room(endpoint = base) {
  const r = await fetch(`${endpoint}/rooms`, {
    headers: { "X-Room-Creation-Key": localCreationKey() },
    method: "POST",
    signal: AbortSignal.timeout(7000),
  });
  expect(r.status).toBe(200);
  return (await r.json()).code as string;
}
async function join(code: string, token = "", endpoint = base) {
  const c = new Client(code, token, endpoint);
  clients.push(c);
  await c.wait((m) => m.type === "welcome");
  return c;
}
describe("real local workerd WebSocket authority", () => {
  it("accepts four participants and rejects the fifth, without BroadcastChannel", async () => {
    const code = await room();
    const cs = [];
    for (let n = 0; n < 4; n++) cs.push(await join(code));
    const fifth = new Client(code);
    clients.push(fifth);
    expect((await fifth.wait((m) => m.type === "error")).reason).toContain(
      "満員",
    );
    expect(new Set(cs.map((c) => c.id)).size).toBe(4);
  });
  it("two sockets share enemy HP, kills, phase and reconnect identity; late joins rejected", async () => {
    const code = await room(),
      a = await join(code),
      b = await join(code);
    a.send({ type: "equip", weapons: STARTERS.slice(0, 2) });
    b.send({ type: "equip", weapons: STARTERS.slice(0, 2) });
    await a.wait(
      (m) => m.type === "lobby" && m.members.every((p: any) => p.ready),
    );
    a.send({ type: "start" });
    await a.wait((m) => m.type === "state" && m.world.enemies.length > 0);
    await b.wait((m) => m.type === "state" && m.world.enemies.length > 0);
    const first = a.messages.find(
      (m) => m.type === "state" && m.world.enemies.length > 0,
    );
    const other = await b.wait(
      (m) => m.type === "state" && m.world.time === first.world.time,
    );
    expect(other.world.enemies).toEqual(first.world.enemies);
    expect(other.world.phase).toBe("battle");
    let seq = 0;
    const timer = setInterval(() => {
      const w = a.messages.at(-1)?.world;
      if (!w) return;
      const p = w.players.find((p: any) => p.id === a.id),
        e = w.enemies[0];
      if (e)
        a.send({
          type: "input",
          input: {
            ...neutral(),
            seq: ++seq,
            fire: true,
            yaw: Math.atan2(e.x - p.x, -(e.z - p.z)),
          },
        });
    }, 50);
    try {
      const kill = await a.wait(
        (m) => m.type === "state" && m.world.totalKills > 0,
        10000,
      );
      const matching = await b.wait(
        (m) => m.type === "state" && m.world.time === kill.world.time,
      );
      expect(matching.world.totalKills).toBe(kill.world.totalKills);
      expect(matching.world.enemies).toEqual(kill.world.enemies);
    } finally {
      clearInterval(timer);
    }
    const stranger = new Client(code);
    clients.push(stranger);
    expect((await stranger.wait((m) => m.type === "error")).reason).toContain(
      "進行中",
    );
    const token = b.token,
      id = b.id;
    b.close();
    await new Promise((r) => setTimeout(r, 150));
    const back = await join(code, token);
    expect(back.id).toBe(id);
    const state = await back.wait((m) => m.type === "state");
    expect(state.world.players).toHaveLength(2);
    expect(state.world.players.find((p: any) => p.id === id).connected).toBe(
      true,
    );
  });
  it("rejects invalid input, oversized packets and flooding", async () => {
    const code = await room(),
      bad = await join(code);
    bad.send({ type: "input", input: { ...neutral(), mx: 100 } });
    expect((await bad.wait((m) => m.type === "error")).reason).toContain(
      "入力値",
    );
    const big = await join(code);
    big.send({ type: "equip", payload: "x".repeat(3000) });
    expect((await big.wait((m) => m.type === "error")).reason).toContain(
      "サイズ",
    );
    const flood = await join(code);
    for (let n = 0; n < 45; n++) flood.send({ type: "ping" });
    expect((await flood.wait((m) => m.type === "error")).reason).toContain(
      "頻度",
    );
  });
});
