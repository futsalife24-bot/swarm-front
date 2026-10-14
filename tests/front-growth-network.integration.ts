import { afterEach, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { localCreationKey } from "./credentials";
import { FRONT_BASE_IDS } from "../src/shared/front-upgrades";
import { STARTERS } from "../src/shared/defs";
const base = process.env.SWARM_TEST_SERVER_URL ?? "http://127.0.0.1:8799";
const clients: Client[] = [];
class Client {
  ws: WebSocket;
  messages: any[] = [];
  id = "";
  token = "";
  constructor(code: string, stage = 3, token = "") {
    this.ws = new WebSocket(
      `${base.replace("http", "ws")}/rooms/${code}?ruleset=front-v1&testClient=${createHash(
        "sha256",
      )
        .update(expect.getState().currentTestName ?? "growth-integration")
        .digest("hex")}`,
    );
    this.ws.onopen = () =>
      this.send({
        type: "hello",
        frontGrowth: 3,
        frontCatalog: 2,
        frontOpening: 2,
        clearedStage: stage,
        ...(token ? { token } : {}),
      });
    this.ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      this.messages.push(m);
      if (m.type === "welcome") {
        this.id = m.id;
        this.token = m.token;
      }
    };
    clients.push(this);
  }
  send(value: unknown) {
    this.ws.send(JSON.stringify(value));
  }
  async wait(test: (m: any) => boolean, from = 0) {
    const until = Date.now() + 9000;
    while (Date.now() < until) {
      const hit = this.messages.slice(from).find(test);
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw Error("サーバー応答待ち失敗: " + this.messages.at(-1)?.type);
  }
}
afterEach(() => clients.splice(0).forEach((c) => c.ws.close()));
async function room() {
  const r = await fetch(base + "/rooms", {
    method: "POST",
    headers: {
      "X-Room-Creation-Key": localCreationKey(),
      "X-Test-Client": createHash("sha256")
        .update(expect.getState().currentTestName ?? "growth-integration")
        .digest("hex"),
    },
    body: JSON.stringify({
      ruleset: "front-v1",
      mode: "survival",
      name: "成長循環検証",
      listed: false,
    }),
  });
  expect(r.status).toBe(200);
  return r.json() as Promise<{ code: string }>;
}
async function startTeam() {
  const entry = await room(),
    host = new Client(entry.code, 3),
    guest = new Client(entry.code, 25);
  for (const [index, c] of [host, guest].entries()) {
    await c.wait((m) => m.type === "welcome");
    c.send({
      type: "equip",
      upgradePool: FRONT_BASE_IDS,
      clearedStage: index ? 25 : 3,
      weapons: STARTERS.slice(0, 2).map((w, i) => ({
        ...w,
        id: `net-${index}-${i}`,
        level: 4,
        mods: { damage: 1 },
      })),
    });
    await c.wait(
      (m) =>
        m.type === "lobby" &&
        m.members?.find((p: any) => p.id === c.id)?.weapons?.length === 2,
    );
  }
  const lobby = await host.wait(
    (m) =>
      m.type === "lobby" &&
      m.members?.length === 2 &&
      m.members.every((p: any) => p.weapons?.length === 2),
  );
  for (const c of [host, guest])
    c.send({
      type: "ready",
      ready: true,
      stage: lobby.stage,
      preparationGeneration: lobby.preparationGeneration,
    });
  await host.wait(
    (m) => m.members?.length === 2 && m.members.every((p: any) => p.ready),
  );
  host.send({ type: "start" });
  const state = await host.wait((m) => m.type === "state");
  await guest.wait((m) => m.type === "state");
  return { entry, host, guest, state };
}
it("rejects invalid progress, holds the host snapshot and keeps personal weapons across reconnect", async () => {
  const { entry, host, guest, state } = await startTeam();
  expect(state.world.scale).toBe(1.75);
  expect(state.frontView.clearedStage).toBe(3);
  expect(state.frontView.weaponLevel).toBe(4);
  expect(state.world.players[0].weapons[0].mods.damage).toBe(1);
  const from = host.messages.length;
  guest.ws.close();
  await host.wait(
    (m) => m.members?.find((p: any) => p.id === guest.id)?.connected === false,
    from,
  );
  const rejoin = new Client(entry.code, 0, guest.token),
    restored = await rejoin.wait((m) => m.type === "state");
  expect(rejoin.id).toBe(guest.id);
  expect(restored.world.scale).toBe(state.world.scale);
  expect(restored.frontView.clearedStage).toBe(3);
  expect(restored.frontView.rewardEligible).toBe(true);
  expect(
    restored.world.players.find((p: any) => p.id === guest.id).weapons[0].level,
  ).toBe(4);
});
it("death results are authoritative and reconnect does not re-roll each player's spoils", async () => {
  const { entry, host, guest } = await startTeam();
  const from = host.messages.length;
  const r = await fetch(`${base}/fixtures/${entry.code}/front-growth-result`, {
    method: "POST",
  });
  expect(r.status).toBe(200);
  const result = await host.wait((m) => m.frontView?.phase === "defeat", from);
  expect(result.world.phase).toBe("defeat");
  expect(result.world.rewards[host.id]).toHaveLength(3);
  expect(result.world.rewards[host.id][0].level).toBe(4);
  expect(result.world.rewards[guest.id]).toBeUndefined(); // Other players' loot stays private.
  const personal = await guest.wait((m) => m.frontView?.phase === "defeat");
  expect(personal.world.rewards[guest.id]).toHaveLength(3);
  host.ws.close();
  const reconnect = new Client(entry.code, 0, host.token),
    saved = await reconnect.wait((m) => m.frontView?.phase === "defeat");
  expect(saved.world.rewards[host.id]).toEqual(result.world.rewards[host.id]);
  expect(saved.frontView.clearedStage).toBe(3);
});
it("invalid progress is rejected before a run can start", async () => {
  const entry = await room(),
    c = new Client(entry.code, 26);
  const error = await c.wait((m) => m.type === "error" || m.type === "notice");
  expect(error.reason).toContain("進度");
});
