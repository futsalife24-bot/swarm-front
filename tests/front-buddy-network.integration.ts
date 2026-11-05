import { afterEach, expect, it } from "vitest";
import { STARTERS } from "../src/shared/defs";
import { neutral } from "../src/shared/game";
import { localCreationKey } from "./credentials";
import { mkdirSync, writeFileSync } from "node:fs";
const endpoint = process.env.SWARM_BUDDY_SERVER ?? "http://127.0.0.1:8821";
const clients: Client[] = [];
class Client {
  ws: WebSocket;
  messages: any[] = [];
  id = "";
  token = "";
  constructor(code: string, token = "") {
    this.ws = new WebSocket(`${endpoint.replace("http", "ws")}/rooms/${code}`);
    this.ws.onopen = () => this.send({ type: "hello", token });
    this.ws.onmessage = (event) => {
      const message = JSON.parse(String(event.data));
      this.messages.push(message);
      if (message.type === "welcome") {
        this.id = message.id;
        this.token = message.token;
      }
    };
    clients.push(this);
  }
  send(value: unknown) {
    this.ws.send(JSON.stringify(value));
  }
  async wait(predicate: (value: any) => boolean, after = 0) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const message = this.messages.slice(after).find(predicate);
      if (message) return message;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw Error(
      `応答待ち期限: ${this.messages
        .slice(-2)
        .map((m) => m.type + ":" + (m.reason ?? ""))
        .join(",")}`,
    );
  }
}
afterEach(() => clients.splice(0).forEach((client) => client.ws.close()));
it("実Workerで4人の装備を同期し、発動・変更拒否・同一所有者再接続・CD保持を確認", async () => {
  const response = await fetch(`${endpoint}/rooms`, {
    method: "POST",
    headers: { "X-Room-Creation-Key": localCreationKey() },
    body: JSON.stringify({ name: "バディ戦闘接続検証", listed: false }),
  });
  expect(response.status).toBe(200);
  const { code } = (await response.json()) as { code: string };
  const peers: Client[] = [];
  for (const id of ["tatara", "yosuga", "tobari", "oriha"]) {
    const c = new Client(code);
    peers.push(c);
    await c.wait((m) => m.type === "welcome");
    c.send({
      type: "equip",
      weapons: STARTERS.slice(0, 2),
      buddy: { id, level: 1 },
    });
    await c.wait((m) =>
      m.members?.some((p: any) => p.id === c.id && p.buddy?.id === id),
    );
  }
  const a = peers[0];
  const equipped = await a.wait(
    (m) => m.members?.length === 4 && m.members.every((p: any) => p.buddy),
  );
  for (const c of peers)
    c.send({
      type: "ready",
      ready: true,
      stage: equipped.stage,
      preparationGeneration: equipped.preparationGeneration,
    });
  const prepared = await a.wait(
    (m) => m.members?.length === 4 && m.members.every((p: any) => p.ready),
  );
  a.send({
    type: "start",
    stage: prepared.stage,
    preparationGeneration: prepared.preparationGeneration,
  });
  const battle = await a.wait(
    (m) => m.type === "state" && m.world.phase === "battle",
  );
  expect(Object.keys(battle.world.buddies.entries)).toHaveLength(4);
  expect(
    Object.values(battle.world.buddies.entries)
      .map((b: any) => b.buddyId)
      .sort(),
  ).toEqual(["oriha", "tatara", "tobari", "yosuga"]);
  const guardian = peers[2];
  guardian.send({
    type: "input",
    input: { ...neutral(), buddySkill: true, seq: 1 },
  });
  const cast = await a.wait(
    (m) => m.world?.buddies?.entries[guardian.id]?.skillReadyAt > 0,
  );
  const readyAt = cast.world.buddies.entries[guardian.id].skillReadyAt;
  expect(cast.world.buddies.buffs[guardian.id].guardUntil).toBeGreaterThan(
    cast.world.time,
  );
  guardian.send({
    type: "equip",
    weapons: STARTERS.slice(0, 2),
    buddy: { id: "oriha", level: 40 },
  });
  guardian.ws.close();
  await a.wait((m) =>
    m.world?.players.some((p: any) => p.id === guardian.id && !p.connected),
  );
  const restored = new Client(code, guardian.token);
  const welcome = await restored.wait((m) => m.type === "welcome");
  expect(welcome.id).toBe(guardian.id);
  const resumed = await restored.wait((m) =>
    m.world?.players.some((p: any) => p.id === guardian.id && p.connected),
  );
  expect(Object.keys(resumed.world.buddies.entries)).toHaveLength(4);
  expect(resumed.world.run).toBe(battle.world.run);
  expect(resumed.world.buddies.entries[guardian.id].buddyId).toBe("tobari");
  expect(resumed.world.buddies.entries[guardian.id].skillReadyAt).toBe(readyAt);
  restored.send({
    type: "input",
    input: { ...neutral(), buddySkill: true, seq: 1 },
  });
  const offset = a.messages.length;
  await a.wait((m) => m.world?.time > resumed.world.time + 0.15, offset);
  const latest = a.messages.findLast((m) => m.world);
  expect(latest.world.buddies.entries[guardian.id].skillReadyAt).toBe(readyAt);
  mkdirSync("dist-validation/buddy-network", { recursive: true });
  writeFileSync(
    "dist-validation/buddy-network/results.json",
    JSON.stringify(
      {
        endpoint,
        clients: 4,
        ids: ["tatara", "yosuga", "tobari", "oriha"],
        observed: {
          fourOwners: true,
          authoritativeSkill: true,
          battleEquipRejected: true,
          sameOwnerReconnected: true,
          noDuplicate: true,
          cooldownPreserved: true,
        },
        transport:
          "実ローカルWorkerとWebSocket。UI・インターネット回線・実スマホは未確認。",
        cooldown: readyAt,
      },
      null,
      2,
    ),
  );
});

it("実Workerで旧装備パケットは選択を保持し、null解除と不正level拒否を区別", async () => {
  const response = await fetch(`${endpoint}/rooms`, {
    method: "POST",
    headers: { "X-Room-Creation-Key": localCreationKey() },
    body: JSON.stringify({ name: "バディ装備互換検証", listed: false }),
  });
  expect(response.status).toBe(200);
  const { code } = (await response.json()) as { code: string };
  const c = new Client(code);
  await c.wait((m) => m.type === "welcome");
  c.send({
    type: "equip",
    weapons: STARTERS.slice(0, 2),
    buddy: { id: "oriha", level: 40 },
  });
  const selected = await c.wait((m) => m.members?.[0]?.buddy?.level === 40);
  c.send({ type: "equip", weapons: STARTERS.slice(1, 3) });
  const legacy = await c.wait(
    (m) => m.preparationGeneration > selected.preparationGeneration,
  );
  expect(legacy.members[0].buddy).toEqual({ id: "oriha", level: 40 });
  c.send({ type: "equip", weapons: STARTERS.slice(0, 2), buddy: null });
  const cleared = await c.wait(
    (m) => m.preparationGeneration > legacy.preparationGeneration,
  );
  expect(cleared.members[0].buddy).toBeUndefined();
  c.send({
    type: "equip",
    weapons: STARTERS.slice(0, 2),
    buddy: { id: "oriha", level: 41 },
  });
  await c.wait(
    (m) => m.type === "error" && m.reason === "バディ装備が不正です",
  );
});
