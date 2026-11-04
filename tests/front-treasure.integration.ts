import { createHash } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { localCreationKey } from "./credentials";
import { STARTERS } from "../src/shared/defs";
import { FRONT_V2_UPGRADE_IDS } from "../src/shared/front-upgrades";

const base = process.env.SWARM_TEST_SERVER_URL ?? "http://127.0.0.1:8807";
const clients: Client[] = [];
const testClient = () =>
  createHash("sha256")
    .update(expect.getState().currentTestName ?? "front-treasure")
    .digest("hex");

class Client {
  ws: WebSocket;
  messages: any[] = [];
  id = "";
  token = "";

  constructor(code: string, token = "") {
    this.ws = new WebSocket(
      `${base.replace("http", "ws")}/rooms/${code}?ruleset=front-v1&testClient=${testClient()}`,
    );
    this.ws.onopen = () =>
      this.send({
        type: "hello",
        frontGrowth: 3,
        frontCatalog: 2,
        frontOpening: 2,
        frontSurvivalBuild: 1,
        inputReceipt: 1,
        clearedStage: 3,
        ...(token ? { token } : {}),
      });
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

  send(message: unknown) {
    this.ws.send(JSON.stringify(message));
  }

  async wait(predicate: (message: any) => boolean, from = 0) {
    const until = Date.now() + 9000;
    while (Date.now() < until) {
      const found = this.messages.slice(from).find(predicate);
      if (found) return found;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw Error(`サーバー応答待ち失敗: ${this.messages.at(-1)?.type}`);
  }
}

afterEach(() => clients.splice(0).forEach((client) => client.ws.close()));

it("実通信でボス級の箱を拾い、各人へ報酬と停止を伝えてからXP選択へ進む", async () => {
  const created = await fetch(`${base}/rooms`, {
    method: "POST",
    headers: {
      "X-Room-Creation-Key": localCreationKey(),
      "X-Test-Client": testClient(),
    },
    body: JSON.stringify({
      ruleset: "front-v1",
      mode: "survival",
      name: "宝箱通信検証",
      listed: false,
    }),
  });
  expect(created.status).toBe(200);
  const { code } = (await created.json()) as { code: string };
  const host = new Client(code);
  const guest = new Client(code);
  for (const client of [host, guest]) {
    await client.wait((message) => message.type === "welcome");
    client.send({
      type: "equip",
      upgradePool: FRONT_V2_UPGRADE_IDS,
      weapons: [{ ...STARTERS[0], id: `test-${client.id}` }],
    });
  }
  const lobby = await host.wait(
    (message) =>
      message.type === "lobby" &&
      message.members?.length === 2 &&
      message.members.every((member: any) => member.weapons.length === 1),
  );
  for (const client of [host, guest])
    client.send({
      type: "ready",
      ready: true,
      stage: lobby.stage,
      preparationGeneration: lobby.preparationGeneration,
    });
  await host.wait(
    (message) =>
      message.type === "lobby" &&
      message.members?.every((member: any) => member.ready),
  );
  host.send({ type: "start" });
  const initial = await Promise.all(
    [host, guest].map((client) =>
      client.wait(
        (message) => message.type === "state" && message.frontView?.offer,
      ),
    ),
  );
  for (const [index, client] of [host, guest].entries()) {
    const offer = initial[index].frontView.offer;
    client.send({
      type: "frontChoose",
      request: {
        runId: initial[index].world.run,
        offerId: offer.id,
        revision: offer.revision,
        requestId: `${offer.id}:${client.id}`,
        cardId: offer.defaultCardId,
      },
    });
  }
  await host.wait(
    (message) =>
      message.type === "state" && message.frontView?.phase === "combat",
  );
  const fixture = await fetch(`${base}/fixtures/${code}/front-treasure`, {
    method: "POST",
  });
  expect(fixture.status).toBe(200);
  const pause = await Promise.all(
    [host, guest].map((client) =>
      client.wait(
        (message) =>
          message.type === "state" && message.frontView?.phase === "treasure",
      ),
    ),
  );
  const treasureId = pause[0].frontView.treasure.id;
  for (const state of pause) {
    expect(state.frontView.treasure.id).toBe(treasureId);
    expect(state.frontView.treasure.reward).toMatchObject({ kind: "upgrade" });
    expect(state.frontView.picks).toBe(2);
    expect(state.frontView.treasureCoins).toBe(0);
    expect(state.frontView.levelUpAt).toBeNull();
    expect(state.world.front.chests).toHaveLength(0);
  }
  const xp = await host.wait(
    (message) =>
      message.type === "state" &&
      message.frontView?.phase === "selection" &&
      message.frontView.levelUpAt !== null,
  );
  expect(xp.frontView.treasure).toBeNull();
  expect(xp.frontView.offer.kind).toBe("additional");
  const reconnect = new Client(code, guest.token);
  const restored = await reconnect.wait((message) => message.type === "state");
  expect(reconnect.id).toBe(guest.id);
  expect(restored.frontView.picks).toBe(2);
});
