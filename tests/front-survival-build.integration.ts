import { createHash } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { localCreationKey } from "./credentials";
import { STARTERS, stats } from "../src/shared/defs";
import { FRONT_BASE_IDS, FRONT_FUSION_IDS } from "../src/shared/front-upgrades";
import { neutral } from "../src/shared/game";
import { isFrontSurvivalWeapon } from "../src/shared/front-weapon";

/** 実ローカル Worker への WebSocket 通信。 */
const base = process.env.SWARM_TEST_SERVER_URL ?? "http://127.0.0.1:8807";
const clients: Client[] = [];
const narrowPool = FRONT_BASE_IDS.slice(0, 6);
const testClient = () =>
  createHash("sha256")
    .update(expect.getState().currentTestName ?? "survival-build-integration")
    .digest("hex");

class Client {
  ws: WebSocket;
  messages: any[] = [];
  id = "";
  token = "";
  closeCode = 0;

  constructor(code: string, modern: boolean, token = "") {
    this.ws = new WebSocket(
      `${base.replace("http", "ws")}/rooms/${code}?ruleset=front-v1&testClient=${testClient()}`,
    );
    this.ws.onopen = () =>
      this.send({
        type: "hello",
        frontGrowth: 3,
        frontCatalog: 2,
        frontOpening: 2,
        inputReceipt: 1,
        ...(modern ? { frontSurvivalBuild: 1 } : {}),
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
    this.ws.onclose = (event) => (this.closeCode = event.code);
    clients.push(this);
  }

  send(message: unknown) {
    this.ws.send(JSON.stringify(message));
  }

  async wait(predicate: (message: any) => boolean, from = 0) {
    const until = Date.now() + 9000;
    while (Date.now() < until) {
      const result = this.messages.slice(from).find(predicate);
      if (result) return result;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw Error(`サーバー応答待ち失敗: ${this.messages.at(-1)?.type}`);
  }

  async closed() {
    const until = Date.now() + 9000;
    while (Date.now() < until && !this.closeCode)
      await new Promise((resolve) => setTimeout(resolve, 20));
    expect(this.closeCode).toBe(4000);
  }

  latestLobby() {
    return this.messages.findLast((message) => message.type === "lobby");
  }
}

afterEach(() => clients.splice(0).forEach((client) => client.ws.close()));

async function room() {
  const response = await fetch(`${base}/rooms`, {
    method: "POST",
    headers: {
      "X-Room-Creation-Key": localCreationKey(),
      "X-Test-Client": testClient(),
    },
    body: JSON.stringify({
      ruleset: "front-v1",
      mode: "survival",
      name: "生存戦専用武器通信検証",
      listed: false,
    }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as { code: string };
}

async function upgradePools(code: string): Promise<Record<string, string[]>> {
  const response = await fetch(`${base}/fixtures/${code}/snapshot`);
  expect(response.status).toBe(200);
  const snapshot = await response.json();
  return snapshot.frontUpgradePools;
}

async function equip(
  client: Client,
  modern: boolean,
  forged = false,
  pool = FRONT_BASE_IDS,
) {
  await client.wait((message) => message.type === "welcome");
  const weapon = forged
    ? {
        ...STARTERS[0],
        id: `forged-${client.id}`,
        rarity: 1,
        power: 1.2,
        effect: "reserve",
        level: 25,
        mods: { damage: 3, mag: 2 },
        rolls: { power: 1.1, mag: 1.1 },
      }
    : { ...STARTERS[0], id: `legacy-${client.id}` };
  client.send({
    type: "equip",
    upgradePool: pool,
    weapons: modern
      ? [weapon]
      : [weapon, { ...STARTERS[1], id: `legacy-b-${client.id}` }],
  });
  return client.wait(
    (message) =>
      message.type === "lobby" &&
      message.members?.find((member: any) => member.id === client.id)?.weapons
        ?.length === (modern ? 1 : 2),
  );
}

async function readyAndStart(host: Client, members: Client[]) {
  const lobby = await host.wait(
    (message) =>
      message.type === "lobby" &&
      message.members?.length === members.length &&
      message.members.every((member: any) => member.weapons.length > 0),
  );
  const generation = host.latestLobby().preparationGeneration;
  for (const member of members)
    member.send({
      type: "ready",
      ready: true,
      stage: lobby.stage,
      preparationGeneration: generation,
    });
  await host.wait(
    (message) =>
      message.type === "lobby" &&
      message.preparationGeneration === generation &&
      message.members?.every((member: any) => member.ready),
  );
  host.send({ type: "start" });
}

it("新規生存戦は偽装装備を捨てて2人とも専用武器1本で進み、カードと再接続でも維持する", async () => {
  const entry = await room();
  const host = new Client(entry.code, true);
  const guest = new Client(entry.code, true);
  await equip(host, true, true, narrowPool);
  await equip(guest, true, true, narrowPool);
  const lobby = await host.wait(
    (message) =>
      message.type === "lobby" &&
      message.members?.length === 2 &&
      message.members.every((member: any) => member.weapons.length === 1),
  );
  for (const member of lobby.members) {
    expect(member.weapons).toHaveLength(1);
    expect(isFrontSurvivalWeapon(member.weapons[0])).toBe(true);
    expect(member.weapons[0]).toMatchObject({
      kind: "rifle",
      rarity: 0,
      power: 1,
      effect: "none",
    });
    expect(member.weapons[0].level).toBeUndefined();
    expect(member.weapons[0].mods).toBeUndefined();
    expect(member.weapons[0].rolls).toBeUndefined();
    expect(stats(member.weapons[0]).mag).toBe(stats(STARTERS[0]).mag);
  }
  await readyAndStart(host, [host, guest]);
  const initial = await Promise.all(
    [host, guest].map((client) =>
      client.wait((message) => message.type === "state"),
    ),
  );
  expect(initial[0].world.front.survivalBuildVersion).toBe(1);
  const pools = await upgradePools(entry.code);
  for (const client of [host, guest])
    expect(pools[client.id]).toEqual(FRONT_BASE_IDS);
  for (const state of initial) {
    expect(
      state.frontView.offer.cardIds.every((id: string) =>
        FRONT_BASE_IDS.includes(id as (typeof FRONT_BASE_IDS)[number]),
      ),
    ).toBe(true);
    expect(
      state.frontView.offer.cardIds.some((id: string) =>
        FRONT_FUSION_IDS.includes(id as (typeof FRONT_FUSION_IDS)[number]),
      ),
    ).toBe(false);
    expect(state.world.players).toHaveLength(2);
    expect(
      state.world.players.every((player: any) => player.weapons.length === 1),
    ).toBe(true);
  }
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
  const combat = await host.wait(
    (message) =>
      message.type === "state" && message.frontView?.phase === "combat",
  );
  expect(
    combat.world.players.every((player: any) => player.weapons.length === 1),
  ).toBe(true);
  const from = host.messages.length;
  host.send({ type: "input", input: { ...neutral(), seq: 1, swap: true } });
  const swapped = await host.wait(
    (message) => message.type === "state" && message.inputAck >= 1,
    from,
  );
  expect(
    swapped.world.players.find((player: any) => player.id === host.id).slot,
  ).toBe(0);

  const token = guest.token;
  guest.ws.close();
  const rejoin = new Client(entry.code, true, token);
  const restored = await rejoin.wait((message) => message.type === "state");
  expect(rejoin.id).toBe(guest.id);
  expect(rejoin.token).toBe(token);
  expect(restored.world.front.survivalBuildVersion).toBe(1);
  expect(
    restored.world.players.find((player: any) => player.id === guest.id)
      .weapons,
  ).toHaveLength(1);
  expect(restored.frontView.picks).toBe(1);

  rejoin.ws.close();
  const old = new Client(entry.code, false, token);
  const notice = await old.wait((message) => message.type === "notice");
  expect(notice.reason).toContain("再読み込み");
  await old.closed();
  expect(old.messages.some((message) => message.type === "welcome")).toBe(
    false,
  );
  const updated = new Client(entry.code, true, token);
  const resumed = await updated.wait((message) => message.type === "state");
  expect(updated.token).toBe(token);
  expect(
    resumed.world.players.find((player: any) => player.id === guest.id).weapons,
  ).toHaveLength(1);
});

it("旧clientだけの新規runは従来の武器2本と能力を維持する", async () => {
  const entry = await room();
  const old = new Client(entry.code, false);
  await equip(old, false, false, narrowPool);
  await readyAndStart(old, [old]);
  const state = await old.wait((message) => message.type === "state");
  expect(state.world.front.survivalBuildVersion).toBeUndefined();
  expect(state.world.players[0].weapons).toHaveLength(2);
  expect((await upgradePools(entry.code))[old.id]).toEqual(narrowPool);
  expect(
    state.frontView.offer.cardIds.every((id: string) =>
      narrowPool.includes(id as (typeof narrowPool)[number]),
    ),
  ).toBe(true);
});

it("新規則は不正な候補指定を拒み、省略時はサーバー既定値で装備できる", async () => {
  const entry = await room();
  const client = new Client(entry.code, true);
  await client.wait((message) => message.type === "welcome");
  const weapons = [{ ...STARTERS[0], id: `test-${client.id}` }];
  client.send({ type: "equip", weapons, upgradePool: ["armor"] });
  expect(
    (await client.wait((message) => message.type === "notice")).reason,
  ).toContain("強化候補");
  client.send({ type: "equip", weapons });
  const lobby = await client.wait(
    (message) =>
      message.type === "lobby" && message.members?.[0]?.weapons.length === 1,
  );
  expect(isFrontSurvivalWeapon(lobby.members[0].weapons[0])).toBe(true);
});

it("新旧混在の出撃は拒否され、ロビーの装備を維持する", async () => {
  const entry = await room();
  const modern = new Client(entry.code, true);
  const old = new Client(entry.code, false);
  await equip(modern, true);
  await equip(old, false);
  await readyAndStart(modern, [modern, old]);
  const notice = await modern.wait((message) => message.type === "notice");
  expect(notice.reason).toContain("画面を更新");
  expect(modern.messages.some((message) => message.type === "state")).toBe(
    false,
  );
  expect(
    modern.latestLobby().members.map((member: any) => member.weapons.length),
  ).toEqual([1, 2]);
});
