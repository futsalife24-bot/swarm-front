import { request as httpRequest } from "node:http";
import { localCreationKey } from "./credentials";
import { afterEach, describe, it, expect } from "vitest";
import { STARTERS, stats } from "../src/shared/defs";
import { makeWeapon } from "../src/shared/progression";
import { neutral } from "../src/shared/game";
import { fresh, rewards } from "../src/client/save";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { pilot } from "./bot";
import { Network } from "../src/client/network";
const base = process.env.SWARM_TEST_ENDPOINT || "http://127.0.0.1:8787";
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
  send(m: any) {
    if (m.type === "ready" && m.preparationGeneration === undefined) {
      const state = this.messages.findLast((value) => value.members);
      m = { ...m, preparationGeneration: state?.preparationGeneration };
    }
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
  it("keeps an idle downed ally connected and revivable, then persists and replays individual rewards safely", async () => {
    const endpoint = "http://127.0.0.1:8789",
      code = await room(endpoint),
      a = await join(code, "", endpoint),
      b = await join(code, "", endpoint);
    a.send({ type: "equip", weapons: STARTERS.slice(0, 2) });
    b.send({ type: "equip", weapons: STARTERS.slice(0, 2) });
    await readyAll([a, b]);
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
async function readyAll(peers: Client[]) {
  const state = await peers[0].wait(
    (m) =>
      m.members?.length === peers.length &&
      m.members.every((p: any) => p.weapons?.length === 2),
  );
  const generation = state.preparationGeneration;
  for (const client of peers)
    client.send({
      type: "ready",
      ready: true,
      stage: state.stage,
      preparationGeneration: generation,
    });
  await peers[0].wait(
    (m) =>
      m.preparationGeneration === generation &&
      m.members?.every((p: any) => p.ready),
  );
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
    await readyAll([a, b]);
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
      const w = a.messages.findLast((m) => m.type === "state")?.world;
      if (!w) return;
      // Use ordinary movement and height-aware aim against the current maps/roster.
      a.send({ type: "input", input: { ...pilot(w, a.id), seq: ++seq } });
    }, 50);
    try {
      const kill = await a.wait(
        (m) => m.type === "state" && m.world.totalKills > 0,
        20000,
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

describe("lobby social and asset readiness over real Workers", () => {
  it("preserves normal v2 and legacy weapon stats across real cooperative transport and rejects invalid v2", async () => {
    const code = await room(),
      a = await join(code),
      b = await join(code);
    const weapons = [
      makeWeapon(
        "normal_lr_rifle",
        "rifle",
        4,
        { power: 20, reload: -10, range: 19, rate: 5 },
        false,
        1,
        "pierce",
      ),
      makeWeapon(
        "normal_sr_rocket",
        "rocket",
        2,
        { power: -10, reload: 20, range: 0, rate: 19 },
        false,
        2,
        "chain",
      ),
    ];
    a.send({ type: "equip", weapons });
    const legacyWeapons = [
      {
        ...STARTERS[0],
        id: "legacy-mag-boundary",
        power: 1.109,
        rolls: {
          power: 1.109,
          mag: 1.109,
          range: 1.123,
          reload: 0.987,
          rate: 1.017,
        },
      },
      {
        ...STARTERS[1],
        id: "legacy-three-decimals",
        rolls: { mag: 1.071, range: 1.117 },
      },
    ];
    expect(stats(legacyWeapons[0]).mag).toBe(35);
    b.send({ type: "equip", weapons: legacyWeapons });
    await readyAll([a, b]);
    for (const peer of [a, b]) {
      const state = await peer.wait((m) =>
        m.members?.every((p: any) => p.ready),
      );
      const received = state.members.find((p: any) => p.id === a.id).weapons;
      expect(received).toEqual(weapons);
      expect(received.map(stats)).toEqual(weapons.map(stats));
      const legacyReceived = state.members.find(
        (p: any) => p.id === b.id,
      ).weapons;
      expect(legacyReceived).toEqual(legacyWeapons);
      expect(legacyReceived.map(stats)).toEqual(legacyWeapons.map(stats));
    }
    a.send({ type: "start" });
    const world = (await a.wait((m) => m.world?.phase === "battle")).world;
    expect(world.players.find((p: any) => p.id === a.id).weapons).toEqual(
      weapons,
    );
    expect(world.players.find((p: any) => p.id === a.id).ammo).toEqual(
      weapons.map((w) => stats(w).mag),
    );
    const legacyPlayer = world.players.find((p: any) => p.id === b.id);
    expect(legacyPlayer.weapons).toEqual(legacyWeapons);
    expect(legacyPlayer.weapons.map(stats)).toEqual(legacyWeapons.map(stats));
    expect(legacyPlayer.ammo).toEqual(legacyWeapons.map((w) => stats(w).mag));

    // The isolated Worker uses the production Room/serializer. Only terminal
    // setup is shortened, with these exact equipment definitions seeded as loot.
    const fixtureEndpoint =
      process.env.SWARM_FIXTURE_ENDPOINT || "http://127.0.0.1:8789";
    const rewardCode = await room(fixtureEndpoint);
    const recipient = await join(rewardCode, "", fixtureEndpoint);
    recipient.send({ type: "equip", weapons: legacyWeapons });
    await readyAll([recipient]);
    recipient.send({ type: "start" });
    await recipient.wait((m) => m.world?.phase === "battle");
    const terminal = await fetch(
      `${fixtureEndpoint}/fixtures/${rewardCode}/terminal-weapon-precision`,
      { method: "POST" },
    );
    expect(terminal.status).toBe(200);
    const result = await recipient.wait((m) => m.world?.phase === "victory");
    const expectedRewards = legacyWeapons.map((weapon) => ({
      ...weapon,
      id: `${weapon.id}-reward`,
    }));
    const receivedRewards = result.world.rewards[recipient.id].filter(
      (weapon: any) => weapon.id.endsWith("-reward"),
    );
    expect(receivedRewards).toEqual(expectedRewards);
    expect(receivedRewards.map(stats)).toEqual(expectedRewards.map(stats));
    const saved = rewards(fresh(), result.world.run, receivedRewards).save;
    const savedWeapons = expectedRewards.map((weapon) =>
      saved.inventory.find((item) => item.id === weapon.id)!,
    );
    expect(savedWeapons).toEqual(expectedRewards);
    recipient.messages.length = 0;
    recipient.send({ type: "equip", weapons: savedWeapons });
    const reequip = await recipient.wait(
      (m) => m.members?.[0]?.weapons?.[0]?.id === savedWeapons[0].id,
    );
    expect(reequip.members[0].weapons).toEqual(expectedRewards);
    expect(reequip.members[0].weapons.map(stats)).toEqual(
      expectedRewards.map(stats),
    );
    for (const invalid of [
      { ...weapons[0], testData: true },
      { ...weapons[0], power: weapons[0].power + 1 },
      { ...weapons[0], variance: { ...weapons[0].variance, rate: 21 } },
      { ...STARTERS[0], testData: true },
    ]) {
      const client = await join(await room());
      client.send({ type: "equip", weapons: [invalid, weapons[1]] });
      expect((await client.wait((m) => m.type === "error")).reason).toContain(
        "武器定義",
      );
    }
    mkdirSync("dist-validation/evidence", { recursive: true });
    writeFileSync(
      "dist-validation/evidence/shared-inventory-transport.json",
      JSON.stringify(
        {
          transport: "real local workerd WebSocket",
          source: {
            head: execFileSync("git", ["rev-parse", "HEAD"], {
              encoding: "utf8",
            }).trim(),
            dirty: execFileSync("git", ["status", "--porcelain"], {
              encoding: "utf8",
            }).trim(),
            sha256: Object.fromEntries(
              [
                "server/worker.ts",
                "server/testing.ts",
                "tests/network.test.ts",
              ].map((path) => [
                path,
                createHash("sha256").update(readFileSync(path)).digest("hex"),
              ]),
            ),
          },
          command:
            'npx vitest run --config vitest.integration.config.ts -t "preserves normal v2 and legacy weapon stats"',
          fixture: {
            productionEndpoint: base,
            rewardEndpoint: fixtureEndpoint,
            name: "terminal-weapon-precision",
            setup:
              "Equipped three-decimal legacy weapons are copied to pending with reward IDs; production finish/Room.send/real WebSocket performs the result transport.",
          },
          clients: 2,
          v2Rarities: [4, 2],
          bothPeersPreserveWeaponsAndStats: true,
          battlePreservesWeaponsAndAmmo: true,
          legacyStatsPreserved: true,
          legacyWeapons,
          legacyStats: legacyWeapons.map(stats),
          legacyReceivedAmmo: legacyPlayer.ammo,
          rewardReceived: receivedRewards,
          rewardSavedAndReequippedWithoutPrecisionLoss: true,
          adminV2Rejected: true,
          invalidPowerRejected: true,
          invalidVarianceRejected: true,
          adminLegacyRejected: true,
        },
        null,
        2,
      ),
    );
  });

  it("rejects stale readiness after ABA stage changes, peer equipment and reconnect", async () => {
    const code = await room(),
      a = await join(code),
      b = await join(code);
    for (const client of [a, b])
      client.send({ type: "equip", weapons: STARTERS.slice(0, 2) });
    await readyAll([a, b]);
    const initial = a.messages.findLast((m) => m.members);
    const generation = initial.preparationGeneration;
    const acknowledge = (client: Client, revision: number, stage = 1) =>
      client.send({
        type: "ready",
        ready: true,
        stage,
        preparationGeneration: revision,
      });
    const blocked = async (revision: number, peer = b) => {
      acknowledge(a, revision);
      acknowledge(peer, revision);
      const before = a.messages.length;
      a.send({ type: "start" });
      await a.wait(
        (m) =>
          a.messages.indexOf(m) >= before &&
          m.type === "notice" &&
          m.reason.includes("準備"),
      );
      expect(a.messages.some((m) => m.world?.phase === "battle")).toBe(false);
    };
    a.send({ type: "stage", stage: 2 });
    a.send({ type: "stage", stage: 1 });
    const aba = await a.wait(
      (m) => m.stage === 1 && m.preparationGeneration === generation + 2,
    );
    expect(aba.members.every((m: any) => !m.ready)).toBe(true);
    await blocked(generation);
    for (const c of [a, b]) acknowledge(c, aba.preparationGeneration);
    await a.wait(
      (m) =>
        m.preparationGeneration === aba.preparationGeneration &&
        m.members?.every((p: any) => p.ready),
    );
    b.send({
      type: "equip",
      weapons: STARTERS.slice(1, 3),
      ready: true,
      preparationGeneration: aba.preparationGeneration,
    });
    const equipment = await a.wait(
      (m) => m.preparationGeneration === aba.preparationGeneration + 1,
    );
    expect(equipment.members.every((m: any) => !m.ready)).toBe(true);
    await blocked(aba.preparationGeneration);
    for (const c of [a, b]) acknowledge(c, equipment.preparationGeneration);
    await a.wait(
      (m) =>
        m.preparationGeneration === equipment.preparationGeneration &&
        m.members?.every((p: any) => p.ready),
    );
    b.close();
    const disconnected = await a.wait(
      (m) =>
        m.preparationGeneration > equipment.preparationGeneration &&
        m.members?.some((p: any) => !p.connected),
    );
    const back = await join(code, b.token);
    const reconnected = await a.wait(
      (m) =>
        m.preparationGeneration > disconnected.preparationGeneration &&
        m.members?.every((p: any) => p.connected),
    );
    expect(reconnected.members.every((m: any) => !m.ready)).toBe(true);
    await blocked(equipment.preparationGeneration, back);
    acknowledge(a, reconnected.preparationGeneration);
    const before = a.messages.length;
    a.send({ type: "start" });
    await a.wait((m) => a.messages.indexOf(m) >= before && m.type === "notice");
    acknowledge(back, reconnected.preparationGeneration);
    await a.wait(
      (m) =>
        m.preparationGeneration === reconnected.preparationGeneration &&
        m.members?.every((p: any) => p.ready),
    );
    a.send({ type: "start" });
    const started = await back.wait((m) => m.world?.phase === "battle");
    expect(started.world.players).toHaveLength(2);
    writeFileSync(
      "dist-validation/evidence/ready-generation.json",
      JSON.stringify(
        {
          transport: "real local workerd WebSocket",
          initial: generation,
          aba: aba.preparationGeneration,
          equipment: equipment.preparationGeneration,
          disconnected: disconnected.preparationGeneration,
          reconnected: reconnected.preparationGeneration,
          staleABARejected: true,
          stalePeerEquipmentRejected: true,
          staleReconnectRejected: true,
          allCurrentAcknowledgementsRequired: true,
          startedPlayers: started.world.players.length,
        },
        null,
        2,
      ),
    );
  });

  it("client blocks immediate chat repeats and clears readiness when equipment changes", async () => {
    const code = await room();
    const observer = await join(code);
    const network = new Network(base);
    network.equip = STARTERS.slice(0, 2);
    network.playerName = "通信テスト";
    try {
      network.connect(code);
      const initialEquipment = await observer.wait(
        (m) =>
          m.type === "lobby" &&
          m.members.some(
            (p: any) => p.name === "通信テスト" && p.weapons?.length === 2,
          ),
      );
      await expect
        .poll(() => network.preparationGeneration)
        .toBe(initialEquipment.preparationGeneration);
      network.setAssetReady(true);
      await observer.wait(
        (m) =>
          m.type === "lobby" &&
          m.members.some((p: any) => p.id === network.id && p.ready),
      );
      const loadedGeneration = network.preparationGeneration;
      network.equipment(STARTERS.slice(1, 3));
      const equipment = await observer.wait(
        (m) =>
          m.type === "lobby" &&
          m.members.some(
            (p: any) =>
              p.id === network.id && p.weapons[0]?.id === STARTERS[1].id,
          ),
      );
      expect(
        equipment.members.find((p: any) => p.id === network.id).ready,
      ).toBe(false);
      await expect
        .poll(() => network.preparationGeneration)
        .toBe(equipment.preparationGeneration);
      expect(network.preparationGeneration).toBeGreaterThan(loadedGeneration);
      network.setAssetReady(true, loadedGeneration);
      expect(network.assetReady).toBe(false);
      expect(network.sendChat("最初の送信")).toBe(true);
      expect(network.sendChat("連続送信")).toBe(false);
      await observer.wait(
        (m) => m.type === "chat" && m.message.text === "最初の送信",
      );
      await new Promise((resolve) => setTimeout(resolve, 1150));
      expect(network.sendChat("次の送信")).toBe(true);
      await observer.wait(
        (m) => m.type === "chat" && m.message.text === "次の送信",
      );
      expect(observer.messages.filter((m) => m.type === "chat")).toHaveLength(
        2,
      );
    } finally {
      network.close();
    }
  });
  it("changes stage after victory, shares rematch equipment and waits for renewed readiness", async () => {
    const endpoint = "http://127.0.0.1:8789";
    const code = await room(endpoint),
      a = await join(code, "", endpoint),
      b = await join(code, "", endpoint);
    for (const client of [a, b])
      client.send({
        type: "equip",
        weapons: STARTERS.slice(0, 2),
        ready: true,
        stage: 1,
      });
    await readyAll([a, b]);
    await a.wait(
      (m) => m.type === "lobby" && m.members.every((p: any) => p.ready),
    );
    const fixture = await fetch(`${endpoint}/fixtures/${code}/reward`, {
      method: "POST",
    });
    expect(fixture.ok).toBe(true);
    const prepared = await a.wait(
      (m) => m.type === "state" && m.world.enemies[0]?.kind === "boss",
    );
    a.send({
      type: "input",
      input: { ...neutral(), fire: true, seq: 1, pitch: 0.15 },
    });
    const victory = await a.wait(
      (m) =>
        m.type === "state" &&
        m.world.phase === "victory" &&
        m.world.run === prepared.world.run,
    );
    expect(victory.members.every((p: any) => p.weapons.length === 2)).toBe(
      true,
    );
    a.send({ type: "stage", stage: 2 });
    const changed = await b.wait(
      (m) =>
        m.type === "state" &&
        m.stage === 2 &&
        m.members.every((p: any) => !p.ready),
    );
    expect(changed.world.phase).toBe("victory");
    expect(changed.world.run).toBe(victory.world.run);
    a.send({
      type: "equip",
      weapons: STARTERS.slice(1, 3),
      ready: false,
      stage: 2,
    });
    await b.wait(
      (m) =>
        m.type === "state" &&
        m.stage === 2 &&
        m.members.find((p: any) => p.id === a.id)?.weapons[0]?.id ===
          STARTERS[1].id,
    );
    for (const client of [a, b])
      client.send({ type: "ready", ready: true, stage: 1 });
    a.send({ type: "start", stage: 2 });
    await a.wait((m) => m.type === "notice" && m.reason.includes("準備"));
    for (const client of [a, b])
      client.send({ type: "ready", ready: true, stage: 2 });
    await a.wait(
      (m) =>
        m.type === "state" &&
        m.stage === 2 &&
        m.members.every((p: any) => p.ready),
    );
    a.send({ type: "start", stage: 2 });
    const rematch = await b.wait(
      (m) =>
        m.type === "state" &&
        m.world.phase === "battle" &&
        m.world.run !== victory.world.run,
    );
    expect(rematch.world.stage).toBe(2);
    expect(rematch.world.players).toHaveLength(2);
    expect(
      rematch.world.players.find((p: any) => p.id === a.id).weapons[0].id,
    ).toBe(STARTERS[1].id);
  });
  it("authenticates names and chat, limits spam, isolates rooms and gates changed stages", async () => {
    const code = await room(),
      a = await join(code),
      b = await join(code);
    const other = await join(await room());
    a.send({ type: "profile", name: "  メロン\u0000隊長  " });
    await b.wait(
      (m) =>
        m.type === "lobby" &&
        m.members.some((p: any) => p.id === a.id && p.name === "メロン 隊長"),
    );
    a.send({
      type: "chat",
      text: "  よろしく\nお願いします  ",
      memberId: b.id,
      name: "偽名",
      at: 0,
    });
    const chat = await b.wait((m) => m.type === "chat");
    expect(chat.message).toMatchObject({
      memberId: a.id,
      name: "メロン 隊長",
      text: "よろしく お願いします",
    });
    expect(chat.message.at).toBeGreaterThan(0);
    a.send({ type: "chat", text: "連投" });
    expect((await a.wait((m) => m.type === "notice")).reason).toContain(
      "少し待って",
    );
    expect(other.messages.some((m) => m.type === "chat")).toBe(false);
    a.send({
      type: "equip",
      weapons: STARTERS.slice(0, 2),
      ready: true,
      stage: 1,
    });
    b.send({
      type: "equip",
      weapons: STARTERS.slice(0, 2),
      ready: true,
      stage: 1,
    });
    await readyAll([a, b]);
    await b.wait(
      (m) => m.type === "lobby" && m.members.every((p: any) => p.ready),
    );
    a.send({ type: "stage", stage: 2 });
    await b.wait(
      (m) =>
        m.type === "lobby" &&
        m.stage === 2 &&
        m.members.every((p: any) => !p.ready),
    );
    a.send({ type: "ready", ready: true, stage: 1 });
    b.send({ type: "ready", ready: true, stage: 1 });
    a.send({ type: "start", stage: 2 });
    await a.wait((m) => m.type === "notice" && m.reason.includes("準備"));
    a.send({ type: "ready", ready: true, stage: 2 });
    b.send({ type: "ready", ready: true, stage: 2 });
    await a.wait(
      (m) =>
        m.type === "lobby" &&
        m.stage === 2 &&
        m.members.every((p: any) => p.ready),
    );
    a.send({ type: "start", stage: 2 });
    await a.wait((m) => m.type === "state");
    a.send({ type: "chat", text: "戦闘中" });
    await a.wait((m) => m.type === "notice" && m.reason.includes("ロビー"));
    expect(b.messages.filter((m) => m.type === "chat")).toHaveLength(1);
  });
  it("retains only the newest 50 messages and synchronizes reconnect without identity leakage", async () => {
    const code = await room(),
      a = await join(code);
    for (let i = 0; i < 51; i++) {
      a.send({
        type: "chat",
        text: i === 50 ? "界".repeat(210) : `message ${i}`,
      });
      await a.wait(
        (m) =>
          m.type === "chat" &&
          (i === 50
            ? m.message.text === "界".repeat(200)
            : m.message.text === `message ${i}`),
      );
      if (i < 50) await new Promise((r) => setTimeout(r, 1010));
    }
    const token = a.token;
    a.close();
    const back = await join(code, token);
    const history = (await back.wait((m) => m.type === "chatHistory")).messages;
    expect(history).toHaveLength(50);
    expect(history[0].text).toBe("message 1");
    expect(history.at(-1).text).toBe("界".repeat(200));
    expect(history.every((m: any) => m.memberId === a.id)).toBe(true);
    expect(JSON.stringify(history)).not.toContain(token);
  }, 90000);
});
