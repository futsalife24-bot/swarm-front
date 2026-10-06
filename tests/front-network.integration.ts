/** 実際のローカル Worker と WebSocket。通信モックは使用しない。 */
import { afterEach, describe, it, expect } from "vitest";
import { localCreationKey } from "./credentials";
import { frontTemporaryWeapons } from "../src/shared/front-run";
import {
  FRONT_BASE_IDS,
  FRONT_INITIAL_CARDS,
} from "../src/shared/front-upgrades";
import { neutral } from "../src/shared/game";
const base = "http://127.0.0.1:8789",
  clients: Client[] = [];
class Client {
  ws: WebSocket;
  messages: any[] = [];
  id = "";
  token = "";
  constructor(code: string, token = "", growth: boolean | 3 = true) {
    this.ws = new WebSocket(
      `${base.replace("http", "ws")}/rooms/${code}?ruleset=front-v1`,
    );
    this.ws.onopen = () =>
      this.send({
        type: "hello",
        ...(growth ? { frontGrowth: growth === 3 ? 3 : 2 } : {}),
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
  async wait(predicate: (value: any) => boolean, from = 0, timeout = 6000) {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      const result = this.messages.slice(from).find(predicate);
      if (result) return result;
      const error = this.messages.find((m) => m.type === "error");
      if (error) throw Error(error.reason);
      await new Promise((r) => setTimeout(r, 20));
    }
    throw Error("必要なサーバー応答が届きません");
  }
  latest() {
    return this.messages.findLast((m) => m.members);
  }
  choose(state: any, cardId?: string, requestId?: string) {
    const offer = state.frontView.offer;
    const req = {
      runId: state.world.run,
      offerId: offer.id,
      revision: offer.revision,
      requestId: requestId ?? `${offer.id}:${this.id}`,
      cardId: cardId ?? offer.defaultCardId,
    };
    this.send({ type: "frontChoose", request: req });
    return req;
  }
}
afterEach(() => clients.splice(0).forEach((c) => c.ws.close()));
async function room(mode = "defense") {
  const response = await fetch(base + "/rooms", {
    method: "POST",
    headers: { "X-Room-Creation-Key": localCreationKey() },
    body: JSON.stringify({
      name: "改装版検証",
      listed: true,
      ruleset: "front-v1",
      mode,
    }),
  });
  expect(response.status).toBe(200);
  return response.json();
}
async function team(
  count: number,
  mode = "defense",
  growth: boolean | 3 = true,
) {
  const entry = await room(mode),
    members: Client[] = [];
  for (let i = 0; i < count; i++) {
    const c = new Client(entry.code, "", growth);
    await c.wait((m) => m.type === "welcome");
    members.push(c);
    c.send({
      type: "equip",
      ...(growth === 3
        ? { upgradePool: FRONT_BASE_IDS, initialCards: FRONT_INITIAL_CARDS }
        : {}),
      weapons: frontTemporaryWeapons("client", `p${i}`, ["rifle", "smg"]).map(
        (w) => ({ ...w, power: 1.2, rolls: { power: 1.1 } }),
      ),
    });
    await c.wait(
      (m) =>
        m.type === "lobby" &&
        m.members.find((p: any) => p.id === c.id)?.weapons?.length === 2,
    );
  }
  await members[0].wait(
    (m) => m.members?.filter((p: any) => p.connected).length === count,
  );
  await new Promise((r) => setTimeout(r, 200));
  const generation = members[0].latest().preparationGeneration;
  members.forEach((c) =>
    c.send({
      type: "ready",
      ready: true,
      stage: members[0].latest().stage,
      preparationGeneration: generation,
    }),
  );
  await members[0].wait(
    (m) =>
      m.members?.filter((p: any) => p.connected).length === count &&
      m.members.every((p: any) => p.ready),
  );
  members[0].send({ type: "start" });
  const states = await Promise.all(
    members.map((c) => c.wait((m) => m.type === "state")),
  );
  return { entry, members, states };
}
describe("改装版の実通信", () => {
  it("融合規則：4人の個人設定・持込性能・再接続・途中変更禁止", async () => {
    const entry = await room("survival"),
      members: Client[] = [];
    const pools = [
      [
        "blast-core",
        "armor-piercer",
        "afterimage-mine",
        "armor",
        "reload",
        "magazine",
      ],
      [
        "fuse",
        "ricochet",
        "interceptor",
        "magnet",
        "blast-radius",
        "opening-shot",
      ],
    ];
    for (let i = 0; i < 4; i++) {
      const c = new Client(entry.code, "", 3);
      await c.wait((m) => m.type === "welcome");
      members.push(c);
      c.send({
        type: "equip",
        weapons: frontTemporaryWeapons("fusion", String(i)).map((w) => ({
          ...w,
          power: 1.2,
        })),
        upgradePool: pools[i % 2],
        initialCards: pools[i % 2].slice(0, 3),
      });
      await c.wait(
        (m) =>
          m.type === "lobby" &&
          m.members.find((p: any) => p.id === c.id)?.weapons?.length === 2,
      );
    }
    members[0].send({ type: "profile", name: "融合検証の隊長" });
    await members[0].wait(
      (m) => m.type === "lobby" && m.members[0]?.name === "融合検証の隊長",
    );
    await new Promise((r) => setTimeout(r, 200));
    const generation = members[0].latest().preparationGeneration;
    for (const c of members)
      c.send({
        type: "ready",
        ready: true,
        stage: 1,
        preparationGeneration: generation,
      });
    await members[0].wait(
      (m) => m.members?.length === 4 && m.members.every((p: any) => p.ready),
    );
    members[0].send({ type: "start" });
    members[0].send({ type: "start" });
    const states = await Promise.all(
      members.map((c) => c.wait((m) => m.type === "state")),
    );
    states.forEach((s, i) => {
      expect(s.frontView.growthVersion).toBe(3);
      expect(s.frontView.returnAt - s.serverNow).toBeGreaterThan(3590);
      expect(s.frontView.returnAt - s.serverNow).toBeLessThanOrEqual(3600);
      expect(s.frontView.offer.cardIds).toEqual(pools[i % 2].slice(0, 3));
      expect(
        s.world.players.every((p: any) =>
          p.weapons.every((w: any) => w.power === 1.2),
        ),
      ).toBe(true);
    });
    await new Promise((r) => setTimeout(r, 200));
    expect(
      new Set(
        members[0].messages
          .filter((m) => m.type === "state")
          .map((m) => m.world.run),
      ).size,
    ).toBe(1);
    const original = states[1].frontView.offer;
    members[1].send({
      type: "equip",
      weapons: frontTemporaryWeapons("changed", "x"),
      upgradePool: pools[0],
      initialCards: pools[0].slice(0, 3),
    });
    members[1].ws.close();
    await new Promise((r) => setTimeout(r, 100));
    const restored = new Client(entry.code, members[1].token, 3);
    const snapshot = await restored.wait((m) => m.type === "state");
    expect(snapshot.frontView.offer).toEqual(original);
    expect(snapshot.frontView.returnAt).toBe(states[1].frontView.returnAt);
    expect(restored.messages.find((m) => m.type === "welcome").expiresAt).toBe(
      snapshot.frontView.returnAt * 1000 + 120000,
    );
    const active = [members[0], restored, members[2], members[3]];
    active.forEach((c, i) => c.choose(i === 1 ? snapshot : states[i]));
    await members[0].wait(
      (m) => m.type === "state" && m.frontView.phase === "combat",
    );
  });
  it("60分の帰還境界で全員へ戦果を配信し、結果へ再接続できる", async () => {
    const { entry, members, states } = await team(2, "survival", 3);
    const initial = states[0];
    expect(initial.frontView.returnAt - initial.serverNow).toBeGreaterThan(
      3590,
    );
    const fixture = await fetch(
      base + "/fixtures/" + entry.code + "/front-return",
      { method: "POST" },
    );
    expect(fixture.status).toBe(200);
    for (const c of members) {
      const ended = await c.wait((m) => m.frontView?.phase === "victory");
      expect(ended.world.time).toBe(3600);
      expect(ended.world.reason).toContain("60分");
    }
    members[1].ws.close();
    await new Promise((r) => setTimeout(r, 100));
    const restored = new Client(entry.code, members[1].token, 3);
    const ended = await restored.wait((m) => m.type === "state");
    expect(ended.frontView.phase).toBe("victory");
    expect(ended.world.run).toBe(initial.world.run);
  });
  it("旧版の一覧・解決・接続と分離し、作成認証を維持する", async () => {
    const denied = await fetch(base + "/rooms", {
      method: "POST",
      body: JSON.stringify({ ruleset: "front-v1" }),
    });
    expect(denied.status).toBe(401);
    const entry = await room();
    const c = new Client(entry.code);
    await c.wait((m) => m.type === "welcome");
    expect(
      (await (await fetch(base + "/rooms")).json()).rooms.some(
        (r: any) => r.roomId === entry.roomId,
      ),
    ).toBe(false);
    expect(
      (await (await fetch(base + "/rooms?ruleset=front-v1")).json()).rooms.some(
        (r: any) => r.roomId === entry.roomId,
      ),
    ).toBe(true);
    expect((await fetch(base + `/rooms/${entry.roomId}`)).status).toBe(404);
    expect(
      (await fetch(base + `/rooms/${entry.roomId}?ruleset=front-v1`)).status,
    ).toBe(200);
    const status = await new Promise<number>((resolve, reject) => {
      const ws = new WebSocket(
        `${base.replace("http", "ws")}/rooms/${entry.code}`,
      );
      ws.onerror = () => resolve(409);
      ws.onopen = () => {
        ws.close();
        reject(Error("旧版接続が通りました"));
      };
    });
    expect(status).toBe(409);
  });
  it("4人で停止・個別選択・性能標準化・再接続・重複防止・再開を確認する", async () => {
    const { entry, members, states } = await team(4);
    states.forEach((state) => {
      expect(state.frontView.phase).toBe("selection");
      expect(state.frontView.growthVersion).toBe(2);
      expect(state.frontView.maxPicks).toBe(12);
      expect(state.world.time).toBe(0);
      expect(state.world.players).toHaveLength(4);
      expect(state.world.defense.armory.hp).toBe(2000);
      expect(
        state.world.players.every((p: any) =>
          p.weapons.every((w: any) => w.power === 1 && !w.rolls?.power),
        ),
      ).toBe(true);
      expect(state.world.seed).toBe(0);
      const text = JSON.stringify(state);
      expect(text).not.toContain("rngState");
      expect(text).not.toContain("processedRequestIds");
      expect(text).not.toContain("seenCombinations");
      expect(Buffer.byteLength(text)).toBeLessThan(65536);
    });
    const a = members[0],
      from = a.messages.length,
      req = a.choose(states[0]);
    const selected = await a.wait((m) => m.frontView?.picks === 1, from);
    expect(selected.frontView.offer).toBeNull();
    expect(selected.frontView.phase).toBe("selection");
    a.send({ type: "frontChoose", request: req });
    a.send({
      type: "input",
      input: { ...neutral(), seq: 1, fire: true, mx: 1 },
    });
    const token = members[1].token,
      id = members[1].id,
      offer = states[1].frontView.offer;
    members[1].ws.close();
    await a.wait(
      (m) => m.members?.find((p: any) => p.id === id)?.connected === false,
      from,
    );
    const rejoin = new Client(entry.code, token),
      restored = await rejoin.wait((m) => m.type === "state");
    expect(rejoin.id).toBe(id);
    expect(restored.frontView.offer).toEqual(offer);
    expect(restored.frontView.selectionDeadline).toBe(
      states[1].frontView.selectionDeadline,
    );
    expect(restored.frontView.rerollsRemaining).toBe(2);
    rejoin.choose(restored);
    members[2].choose(states[2]);
    members[3].choose(states[3]);
    const start = await a.wait(
      (m) => m.frontView?.phase === "combat" && m.world.time > 0,
      from,
    );
    expect(start.frontView.picks).toBe(1);
    expect(start.world.players[0].ammo[0]).toBe(32);
    expect(start.world.players[0].x).toBe(-3);
    a.send({ type: "input", input: { ...neutral(), seq: 2, mx: 1 } });
    const moved = await a.wait(
      (m) => m.type === "state" && m.world.players[0].x > -3,
      from,
    );
    expect(moved.world.time).toBeGreaterThan(0);
  });
  it("2人の共通期限15秒で未選択・切断者を確定し、復帰しても増殖しない", async () => {
    const { entry, members, states } = await team(2, "survival");
    const a = members[0],
      b = members[1];
    a.choose(states[0]);
    b.ws.close();
    const result = await a.wait(
      (m) => m.frontView?.phase === "combat" && m.world.time > 0,
      0,
      19000,
    );
    expect(result.frontView.selectionDeadline).toBeNull();
    expect(
      result.world.players.find((p: any) => p.id === b.id).weapons,
    ).toHaveLength(2);
    const restored = new Client(entry.code, b.token),
      state = await restored.wait((m) => m.type === "state");
    expect(state.frontView.picks).toBe(1);
    expect(state.frontView.offer).toBeNull();
    expect(state.frontView.rerollsRemaining).toBe(2);
  });
  it("旧画面だけの部隊は7回ルールで出撃し、新作戦へ古い画面で復帰すると更新案内を返す", async () => {
    const old = await team(1, "survival", false);
    expect(old.states[0].frontView.growthVersion).toBe(1);
    expect(old.states[0].frontView.maxPicks).toBe(7);
    const modern = await team(1, "survival");
    const c = new Client(modern.entry.code, modern.members[0].token, false);
    const error = await c.wait((m) => m.type === "notice");
    expect(error.reason).toContain("再読み込み");
  });
});
