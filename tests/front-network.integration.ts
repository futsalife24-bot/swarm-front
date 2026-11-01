import { StateDeltaReceiver } from "../src/shared/state-delta";
/** 実際のローカル Worker と WebSocket。通信モックは使用しない。 */
import { afterEach, describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { localCreationKey } from "./credentials";
import { frontTemporaryWeapons } from "../src/shared/front-run";
import {
  FRONT_BASE_IDS,
  FRONT_INITIAL_CARDS,
} from "../src/shared/front-upgrades";
import { neutral } from "../src/shared/game";
import { restoreTurn } from "../src/shared/state-wire";
import { restoreStateTuples } from "../src/shared/state-tuples";
import { StateChunkAssembler } from "../src/shared/state-chunks";
const base = process.env.SWARM_TEST_SERVER_URL ?? "http://127.0.0.1:8789",
  clients: Client[] = [];
class Client {
  ws: WebSocket;
  messages: any[] = [];
  id = "";
  token = "";
  tuplePackets = 0;
  decodeErrors = 0;
  maxPacketBytes = 0;
  chunkPackets = 0;
  deltaPackets = 0;
  deltaVersions = new Set<number>();
  compactPackets = 0;
  delta = new StateDeltaReceiver();
  chunks = new StateChunkAssembler();
  constructor(
    code: string,
    token = "",
    growth: boolean | 3 = true,
    catalog = 2,
    opening = 2,
    stateOmissions = false,
    stateTuples = false,
    stateChunks = false,
    stateFlow = false,
    optimized = false,
    pleatPose: number | undefined = undefined,
    playerDelta = false,
  ) {
    this.ws = new WebSocket(
      `${base.replace("http", "ws")}/rooms/${code}?ruleset=front-v1&testClient=${createHash(
        "sha256",
      )
        .update(expect.getState().currentTestName ?? "legacy-integration")
        .digest("hex")}`,
    );
    this.ws.onopen = () =>
      this.send({
        type: "hello",
        ...(growth ? { frontGrowth: growth === 3 ? 3 : 2 } : {}),
        ...(growth === 3 && catalog === 2 ? { frontCatalog: 2 } : {}),
        ...(growth === 3 && opening === 2 ? { frontOpening: 2 } : {}),
        ...(stateOmissions ? { stateOmissions: 1 } : {}),
        ...(stateTuples ? { stateTuples: 1 } : {}),
        ...(stateChunks ? { stateChunks: 1 } : {}),
        ...(stateFlow ? { stateFlow: 1 } : {}),
        ...(optimized
          ? { stateDelta: 1, inputReceipt: 1, networkTiming: 1 }
          : {}),
        ...(pleatPose !== undefined ? { pleatPose } : {}),
        ...(playerDelta ? { stateDeltaPlayers: 1 } : {}),
        ...(token ? { token } : {}),
      });
    this.ws.onmessage = (e) => {
      const raw = JSON.parse(String(e.data));
      if (raw.type === "stateChunk") this.chunkPackets++;
      const assembled: any = this.chunks.read(String(e.data));
      if (assembled?.type === "stateDelta") {
        this.deltaPackets++;
        this.deltaVersions.add(assembled.version);
      }
      const m: any = optimized ? this.delta.decode(assembled) : assembled;
      this.maxPacketBytes = Math.max(
        this.maxPacketBytes,
        new TextEncoder().encode(String(e.data)).length,
      );
      if (!m) return;
      if (m.type === "state" && m.pleatPose === 1) this.compactPackets++;
      if (m.stateEncoding === "tuples-v1") this.tuplePackets++;
      if (!restoreStateTuples(m)) {
        this.decodeErrors++;
        return;
      }
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
    headers: {
      "X-Room-Creation-Key": localCreationKey(),
      "X-Test-Client": createHash("sha256")
        .update(expect.getState().currentTestName ?? "legacy-integration")
        .digest("hex"),
    },
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
  stateOmissions: boolean | boolean[] = false,
  stateTuples: boolean | boolean[] = false,
  stateChunks: boolean | boolean[] = false,
  stateFlow: boolean | boolean[] = false,
  optimized: boolean | boolean[] = false,
  pleatPose: (number | undefined)[] = [],
  playerDelta: boolean[] = [],
) {
  const entry = await room(mode),
    members: Client[] = [];
  for (let i = 0; i < count; i++) {
    const c = new Client(
      entry.code,
      "",
      growth,
      2,
      2,
      Array.isArray(stateOmissions) ? stateOmissions[i] : stateOmissions,
      Array.isArray(stateTuples) ? stateTuples[i] : stateTuples,
      Array.isArray(stateChunks) ? stateChunks[i] : stateChunks,
      Array.isArray(stateFlow) ? stateFlow[i] : stateFlow,
      Array.isArray(optimized) ? optimized[i] : optimized,
      pleatPose[i],
      playerDelta[i],
    );
    await c.wait((m) => m.type === "welcome");
    members.push(c);
    c.send({
      type: "equip",
      ...(growth === 3 ? { upgradePool: FRONT_BASE_IDS } : {}),
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
  it("生存戦の大量出現予告と敵を2人へ配信する", async () => {
    const { entry, members, states } = await team(2, "survival", 3);
    members.forEach((c, i) => c.choose(states[i]));
    await members[0].wait(
      (m) => m.type === "state" && m.frontView.phase === "combat",
    );
    const start = members.map((c) => c.messages.length);
    const fixture = await fetch(
      base + "/fixtures/" + entry.code + "/front-survival-wave",
      { method: "POST" },
    );
    expect(fixture.status).toBe(200);
    const warnings = await Promise.all(
      members.map((c, i) =>
        c.wait(
          (m) => m.type === "state" && m.frontView.spawnWarnings.length >= 8,
          start[i],
          10000,
        ),
      ),
    );
    expect(warnings[0].frontView.spawnWarnings).toEqual(
      warnings[1].frontView.spawnWarnings,
    );
    for (const [i, c] of members.entries()) {
      const result = await c.wait(
        (m) => m.type === "state" && m.world.enemies.length >= 8,
        start[i],
        10000,
      );
      expect(result.world.enemies.length).toBeLessThanOrEqual(96);
      expect(c.maxPacketBytes).toBeLessThanOrEqual(64 * 1024);
      expect(c.decodeErrors).toBe(0);
    }
  });
  it("同梱stateAckで解放した最初の状態に同じ入力の最新seqを含める", async () => {
    const { members } = await team(1, "survival", 3, false, false, false, true);
    const c = members[0];
    const handled = new Set<string>();
    let preparing = true;
    const onMessage = c.ws.onmessage!;
    c.ws.onmessage = (e) => {
      onMessage.call(c.ws, e);
      const m = c.messages.at(-1);
      if (!preparing || m?.type !== "state") return;
      c.send({ type: "stateAck", stateAck: m.stateId });
      const offer = m.frontView.offer;
      if (offer && !handled.has(offer.id)) {
        handled.add(offer.id);
        c.choose(m);
      }
    };
    c.send({ type: "stateAck", stateAck: c.latest().stateId });
    await c.wait(
      (m) =>
        m.type === "state" &&
        m.frontView.phase === "combat" &&
        m.serverNow >= m.frontView.resumeUntil,
    );
    preparing = false;
    // No more ACKs: let the two snapshot credits fill and mark the peer dirty.
    await new Promise((r) => setTimeout(r, 300));
    const before = c.messages.length;
    const last = c.latest();
    const seq = 777;
    const sentAt = Date.now() / 1000;
    c.send({
      type: "input",
      stateAck: last.stateId,
      input: { ...neutral(), seq, mx: 1 },
    });
    const first = await c.wait((m) => m.type === "state", before);
    // Checking the first released snapshot matters: the old ordering sent -1
    // here and only acknowledged seq 777 in a later periodic snapshot.
    expect(first.inputAck).toBe(seq);
    expect(first.inputReceivedAt).toBeGreaterThanOrEqual(sentAt);
    expect(first.inputReceivedAt).toBeLessThanOrEqual(first.serverNow);
    const applied = await c.wait(
      (m) =>
        m.type === "state" &&
        m.world.players.find((p: any) => p.id === c.id)?.ack === seq,
      before,
    );
    expect(applied.world.players.find((p: any) => p.id === c.id).x).not.toBe(
      first.world.players.find((p: any) => p.id === c.id).x,
    );
    await new Promise((r) => setTimeout(r, 350));
    const delayedStart = c.messages.length;
    c.send({ type: "stateAck", stateAck: c.latest().stateId });
    const delayed = await c.wait((m) => m.type === "state", delayedStart);
    expect(delayed.inputAck).toBe(seq);
    expect(delayed.inputReceivedAt).toBe(first.inputReceivedAt);
    expect(delayed.serverNow - delayed.inputReceivedAt).toBeGreaterThan(0.3);
    expect(c.ws.readyState).toBe(WebSocket.OPEN);
  });
  it("受信待ちを2状態に制限し、旧接続を止めず、最後の結果と再接続を届ける", async () => {
    const { entry, members } = await team(
      2,
      "survival",
      3,
      false,
      false,
      false,
      [true, false],
    );
    const [slow, legacy] = members;
    expect(slow.messages.find((m) => m.type === "welcome").stateFlow).toBe(
      true,
    );
    expect(
      legacy.messages.find((m) => m.type === "welcome").stateFlow,
    ).toBeUndefined();
    const states = () => slow.messages.filter((m) => m.type === "state");
    await slow.wait((m) => m.type === "state" && states().length === 2);
    const last = states().at(-1).stateId;
    expect(Number.isSafeInteger(last)).toBe(true);
    const legacyBefore = legacy.messages.length;
    await new Promise((r) => setTimeout(r, 300));
    expect(states()).toHaveLength(2);
    expect(legacy.messages.length).toBeGreaterThan(legacyBefore);
    const response = await fetch(
      `${base}/fixtures/${entry.code}/front-growth-result`,
      { method: "POST" },
    );
    expect(response.status).toBe(200);
    await legacy.wait((m) => m.type === "state" && m.world.phase === "defeat");
    expect(states()).toHaveLength(2);
    slow.send({ type: "stateAck", stateAck: last + 1000000 });
    await new Promise((r) => setTimeout(r, 150));
    expect(states()).toHaveLength(2);
    slow.send({ type: "stateAck", stateAck: last });
    const final = await slow.wait(
      (m) => m.type === "state" && m.world.phase === "defeat",
    );
    expect(final.stateId).toBeGreaterThan(last);
    expect(final.frontView.phase).toBe("defeat");
    // Leave the final snapshot unacknowledged: a new socket gets fresh credit.
    slow.ws.close();
    const rejoined = new Client(
      entry.code,
      slow.token,
      3,
      2,
      2,
      false,
      false,
      false,
      true,
    );
    await rejoined.wait((m) => m.type === "welcome" && m.stateFlow === true);
    const restored = await rejoined.wait(
      (m) => m.type === "state" && m.world.phase === "defeat",
    );
    expect(rejoined.id).toBe(slow.id);
    expect(restored.world.run).toBe(final.world.run);
    expect(rejoined.ws.readyState).toBe(WebSocket.OPEN);
  });
  it("分割対応4人へ合成1000弾の全戦況を原子的に復元する", async () => {
    const { entry, members } = await team(4, "survival", 3, true, true, true);
    const offsets = members.map((member) => member.messages.length);
    const response = await fetch(
      `${base}/fixtures/${entry.code}/front-wire-overflow`,
      { method: "POST" },
    );
    expect(response.status).toBe(200);
    const packets = await Promise.all(
      members.map((member, index) =>
        member.wait(
          (m) => m.type === "state" && m.world.projectiles.length === 1000,
          offsets[index],
        ),
      ),
    );
    for (const [index, packet] of packets.entries()) {
      expect(packet.world.enemies).toHaveLength(96);
      expect(packet.world.front.orbs).toHaveLength(160);
      expect(packet.omitted?.enemies ?? []).toHaveLength(0);
      expect(packet.world.enemies).toEqual(packets[0].world.enemies);
      expect(members[index].chunkPackets).toBeGreaterThan(1);
      expect(members[index].decodeErrors).toBe(0);
      expect(members[index].maxPacketBytes).toBeLessThanOrEqual(65536);
      expect(members[index].ws.readyState).toBe(WebSocket.OPEN);
    }
  });
  it("配列対応4人へ400弾・全96敵・160オーブを省略せず送る", async () => {
    const { entry, members } = await team(4, "survival", 3, true, true);
    const offsets = members.map((member) => member.messages.length);
    const response = await fetch(
      `${base}/fixtures/${entry.code}/front-wire-heavy`,
      { method: "POST" },
    );
    expect(response.status).toBe(200);
    const packets = await Promise.all(
      members.map((member, index) =>
        member.wait(
          (m) => m.type === "state" && m.world.projectiles.length === 400,
          offsets[index],
        ),
      ),
    );
    for (const [index, packet] of packets.entries()) {
      expect(packet.world.enemies).toHaveLength(96);
      expect(packet.world.front.orbs).toHaveLength(160);
      expect(packet.omitted?.enemies ?? []).toHaveLength(0);
      expect(packet.omitted?.orbs ?? []).toHaveLength(0);
      expect(packet.world.enemies).toEqual(packets[0].world.enemies);
      expect(members[index].tuplePackets).toBeGreaterThan(0);
      expect(members[index].decodeErrors).toBe(0);
      expect(members[index].maxPacketBytes).toBeLessThanOrEqual(65536);
      expect(members[index].ws.readyState).toBe(WebSocket.OPEN);
    }
  });
  it("新旧画面が混在する実通信でもBASTIONの予告方向を維持する", async () => {
    const { entry, members } = await team(
      2,
      "survival",
      3,
      [true, false],
      [true, false],
    );
    const offsets = members.map((member) => member.messages.length);
    const response = await fetch(
      `${base}/fixtures/${entry.code}/front-wire-bastion`,
      { method: "POST" },
    );
    expect(response.status).toBe(200);
    const packets = await Promise.all(
      members.map((member, index) =>
        member.wait(
          (m) =>
            m.type === "state" &&
            m.world.enemies.some((e: any) => e.kind === "bastion"),
          offsets[index],
        ),
      ),
    );
    const modern = packets[0].world.enemies[0].bastion.volley;
    const legacy = packets[1].world.enemies[0].bastion.volley;
    expect(modern.turn).toBe(0.4);
    expect(restoreTurn(modern.turnBits)).toBe(0.4049998011283004);
    expect(legacy.turn).toBe(0.4049998011283004);
    expect(legacy).not.toHaveProperty("turnBits");
    expect(members[0].tuplePackets).toBeGreaterThan(0);
    expect(members[1].tuplePackets).toBe(0);
    expect(members.every((member) => member.decodeErrors === 0)).toBe(true);
    expect(
      members.every((member) => member.ws.readyState === WebSocket.OPEN),
    ).toBe(true);
    const snapshot = await fetch(`${base}/fixtures/${entry.code}/snapshot`, {
      method: "POST",
    });
    const authority = await snapshot.json();
    expect(authority.world.enemies[0].bastion.volley.turn).toBe(
      0.4049998011283004,
    );
    expect(authority.world.enemies[0].bastion.volley).not.toHaveProperty(
      "turnBits",
    );
  });
  it("4人の密集状態を省略可能なクライアントへ送り、切断せず権威状態を維持する", async () => {
    const { entry, members } = await team(4, "survival", 3, true);
    const offsets = members.map((member) => member.messages.length);
    const response = await fetch(
      `${base}/fixtures/${entry.code}/front-wire-dense`,
      { method: "POST" },
    );
    expect(response.status).toBe(200);
    const packets = await Promise.all(
      members.map((member, index) =>
        member.wait((m) => m.type === "state" && m.omitted, offsets[index]),
      ),
    );
    for (let i = 0; i < members.length; i++) {
      expect(members[i].ws.readyState).toBe(WebSocket.OPEN);
      expect(Buffer.byteLength(JSON.stringify(packets[i]))).toBeLessThanOrEqual(
        65536,
      );
      expect(packets[i].world.projectiles).toHaveLength(180);
      expect(packets[i].omitted.orbs.length).toBeGreaterThan(0);
      expect(
        packets[i].world.enemies.length + packets[i].omitted.enemies.length,
      ).toBe(96);
      expect(
        packets[i].world.front.orbs.length + packets[i].omitted.orbs.length,
      ).toBe(160);
    }
    const snapshotResponse = await fetch(
      `${base}/fixtures/${entry.code}/snapshot`,
      { method: "POST" },
    );
    const authority = await snapshotResponse.json();
    expect(authority.world.enemies).toHaveLength(96);
    expect(authority.world.front.orbs).toHaveLength(160);
    expect(authority.world.projectiles).toHaveLength(180);
  });
  it("開幕世代：旧形式の固定指定を拒否し、トークンを保って更新後に出撃できる", async () => {
    const entry = await room("survival"),
      old = new Client(entry.code, "", 3, 2, 1);
    await old.wait((m) => m.type === "welcome");
    old.send({
      type: "equip",
      weapons: frontTemporaryWeapons("old-opening", "p"),
      upgradePool: FRONT_BASE_IDS,
      initialCards: FRONT_INITIAL_CARDS,
    });
    expect((await old.wait((m) => m.type === "notice")).reason).toContain(
      "再読み込み",
    );
    expect(old.latest().members[0].weapons).toHaveLength(0);
    old.send({ type: "start" });
    await old.wait((m) => m.type === "notice" && m.reason.includes("全員"));
    expect(old.messages.some((m) => m.type === "state")).toBe(false);
    const token = old.token;
    old.ws.close();
    const updated = new Client(entry.code, token, 3);
    const welcome = await updated.wait((m) => m.type === "welcome");
    expect(welcome.frontOpening).toBe(2);
    expect(updated.token).toBe(token);
    updated.send({
      type: "equip",
      weapons: frontTemporaryWeapons("new-opening", "p"),
      upgradePool: FRONT_BASE_IDS,
    });
    await updated.wait(
      (m) => m.type === "lobby" && m.members[0]?.weapons?.length === 2,
    );
    updated.send({
      type: "ready",
      ready: true,
      stage: 1,
      preparationGeneration: updated.latest().preparationGeneration,
    });
    await updated.wait((m) => m.type === "lobby" && m.members[0]?.ready);
    updated.send({ type: "start" });
    expect(
      (await updated.wait((m) => m.type === "state")).frontView.offer.cardIds,
    ).toHaveLength(3);
  });

  it("開幕世代：装備済みロビーへ旧画面が戻りequipを送らなくても混在出撃を止める", async () => {
    const entry = await room("survival");
    const leader = new Client(entry.code, "", 3);
    await leader.wait((m) => m.type === "welcome");
    const modern = new Client(entry.code, "", 3);
    for (const c of [leader, modern]) {
      await c.wait((m) => m.type === "welcome");
      c.send({
        type: "equip",
        weapons: frontTemporaryWeapons("mixed", c.id),
        upgradePool: FRONT_BASE_IDS,
      });
      await c.wait(
        (m) =>
          m.type === "lobby" &&
          m.members.find((p: any) => p.id === c.id)?.weapons?.length === 2,
      );
    }
    modern.ws.close();
    const old = new Client(entry.code, modern.token, 3, 2, 1);
    await old.wait((m) => m.type === "welcome");
    await old.wait((m) => m.type === "lobby");
    const generation = old.latest().preparationGeneration;
    for (const c of [leader, old])
      c.send({
        type: "ready",
        ready: true,
        stage: 1,
        preparationGeneration: generation,
      });
    await leader.wait(
      (m) => m.type === "lobby" && m.members.every((p: any) => p.ready),
    );
    const from = leader.messages.length;
    leader.send({ type: "start" });
    expect(
      (await leader.wait((m) => m.type === "notice", from)).reason,
    ).toContain("再読み込み");
    expect(leader.messages.some((m) => m.type === "state")).toBe(false);
    old.ws.close();
    const updated = new Client(entry.code, modern.token, 3);
    await updated.wait((m) => m.type === "lobby");
    const next = updated.latest().preparationGeneration;
    for (const c of [leader, updated])
      c.send({
        type: "ready",
        ready: true,
        stage: 1,
        preparationGeneration: next,
      });
    await leader.wait(
      (m) =>
        m.type === "lobby" &&
        m.preparationGeneration === next &&
        m.members.every((p: any) => p.ready),
    );
    leader.send({ type: "start" });
    expect(
      (await updated.wait((m) => m.type === "state")).frontView.offer.cardIds,
    ).toHaveLength(3);
  });

  it("開幕世代：進行中の作戦は旧画面の復帰でも抽選し直さず、取得も保持", async () => {
    const { entry, members, states } = await team(1, "survival", 3);
    const first = states[0],
      token = members[0].token;
    members[0].ws.close();
    const old = new Client(entry.code, token, 3, 2, 1);
    const resumed = await old.wait((m) => m.type === "state");
    expect(resumed.frontView.offer).toEqual(first.frontView.offer);
    old.choose(resumed);
    await old.wait((m) => m.frontView?.picks === 1);
    old.ws.close();
    const updated = new Client(entry.code, token, 3);
    const again = await updated.wait((m) => m.type === "state");
    expect(again.frontView.picks).toBe(1);
    expect(again.frontView.levels[first.frontView.offer.defaultCardId]).toBe(1);
  });

  it("新候補を設定したロビーへ旧画面で戻ると出撃を止め、更新後に同じ設定で出撃できる", async () => {
    const entry = await room("survival"),
      modern = new Client(entry.code, "", 3);
    await modern.wait((m) => m.type === "welcome");
    modern.send({
      type: "equip",
      weapons: frontTemporaryWeapons("catalog", "a"),
      upgradePool: FRONT_BASE_IDS,
    });
    await modern.wait(
      (m) => m.type === "lobby" && m.members[0]?.weapons?.length === 2,
    );
    modern.ws.close();
    await new Promise((r) => setTimeout(r, 150));
    const old = new Client(entry.code, modern.token, 3, 1);
    await old.wait((m) => m.type === "lobby");
    old.send({
      type: "ready",
      ready: true,
      stage: old.latest().stage,
      preparationGeneration: old.latest().preparationGeneration,
    });
    await old.wait((m) => m.type === "lobby" && m.members[0]?.ready);
    old.send({ type: "start" });
    expect((await old.wait((m) => m.type === "notice")).reason).toContain(
      "更新",
    );
    expect(old.messages.some((m) => m.type === "state")).toBe(false);
    old.ws.close();
    await new Promise((r) => setTimeout(r, 150));
    const updated = new Client(entry.code, modern.token, 3);
    await updated.wait((m) => m.type === "lobby");
    updated.send({
      type: "ready",
      ready: true,
      stage: updated.latest().stage,
      preparationGeneration: updated.latest().preparationGeneration,
    });
    await updated.wait((m) => m.type === "lobby" && m.members[0]?.ready);
    updated.send({ type: "start" });
    expect(
      (await updated.wait((m) => m.type === "state")).world.front
        .catalogVersion,
    ).toBe(2);
  });
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
      expect(s.frontView.offer.cardIds).toHaveLength(3);
      expect(new Set(s.frontView.offer.cardIds).size).toBe(3);
      expect(
        s.frontView.offer.cardIds.every((card: string) =>
          pools[i % 2].includes(card),
        ),
      ).toBe(true);
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
    expect(states[1].world.front.catalogVersion).toBe(2);
    const previousCatalog = new Client(entry.code, members[1].token, 3, 1);
    expect(
      (await previousCatalog.wait((m) => m.type === "notice")).reason,
    ).toContain("再読み込み");
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
    const resultState = members[0].messages.findLast(
      (m) => m.frontView?.phase === "victory",
    );
    const expiry = resultState.expiresAt;
    members.forEach((c) => c.ws.close());
    await new Promise((r) => setTimeout(r, 31000));
    const restored = new Client(entry.code, members[1].token, 3);
    const ended = await restored.wait((m) => m.type === "state");
    expect(ended.frontView.phase).toBe("victory");
    expect(ended.world.run).toBe(initial.world.run);
    expect(ended.expiresAt).toBe(expiry);
    restored.ws.close();
    await new Promise((r) =>
      setTimeout(r, Math.max(0, expiry - Date.now() + 1000)),
    );
    // 一覧側が残っていても、権威Roomは期限を超えた接続を受け付けない。
    const status = await new Promise<boolean>((resolve, reject) => {
      const ws = new WebSocket(
        base.replace("http", "ws") +
          "/rooms/" +
          entry.code +
          "?ruleset=front-v1",
      );
      ws.onerror = () => resolve(true);
      ws.onopen = () => {
        ws.close();
        reject(Error("結果保存の期限後に接続できました"));
      };
    });
    expect(status).toBe(true);
  }, 150000);
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

it("新通信は戦況2枠が埋まっても入力受信確認を返し、差分で復帰する", async () => {
  const { members, states } = await team(
    1,
    "survival",
    3,
    true,
    true,
    true,
    true,
    true,
  );
  const c = members[0];
  const first = states[0];
  c.send({ type: "stateAck", stateAck: first.stateId });
  c.choose(first);
  const combat = await c.wait(
    (m) => m.type === "state" && m.frontView.phase === "combat",
  );
  c.send({ type: "stateAck", stateAck: combat.stateId });
  await new Promise((r) => setTimeout(r, 500));
  const before = c.messages.length;
  c.send({ type: "input", input: { ...neutral(), seq: 123, mx: 1 } });
  const receipt = await c.wait(
    (m) => m.type === "inputReceipt" && m.inputAck === 123,
    before,
  );
  expect(receipt.inputReceivedAt).toBeGreaterThan(0);
  expect(
    c.messages.slice(before).filter((m) => m.type === "state"),
  ).toHaveLength(0);
  const last = c.messages.findLast((m) => m.type === "state");
  c.send({ type: "stateAck", stateAck: last.stateId });
  const recovered = await c.wait(
    (m) => m.type === "state" && m.inputAck === 123,
    before,
  );
  expect(recovered.world.players.find((p: any) => p.id === c.id)).toBeTruthy();
  expect(c.deltaPackets).toBeGreaterThan(0);
  expect(c.decodeErrors).toBe(0);
  expect(recovered.networkTiming.tickMs).toBeGreaterThanOrEqual(0);
});

it("新旧4人の固定密集戦況を欠落なく復元する", async () => {
  const { entry, members, states } = await team(
    4,
    "survival",
    3,
    true,
    true,
    true,
    true,
    [false, true, true, true],
  );
  let seq = 0;
  const tick = setInterval(() => {
    for (const c of members) {
      const last = c.messages.findLast((m) => m.type === "state");
      if (last && c.ws.readyState === 1)
        c.send({
          type: "input",
          input: { ...neutral(), seq: ++seq },
          stateAck: last.stateId,
        });
    }
  }, 100);
  try {
    members.forEach((c, i) => c.choose(states[i]));
    await members[0].wait(
      (m) => m.type === "state" && m.frontView.phase === "combat",
    );
    const offsets = members.map((c) => c.messages.length);
    const response = await fetch(
      base + "/fixtures/" + entry.code + "/front-wire-heavy",
      { method: "POST" },
    );
    expect(response.status).toBe(200);
    for (let i = 0; i < members.length; i++) {
      const c = members[i];
      const m = await c.wait(
        (m) => m.type === "state" && m.world.projectiles.length === 400,
        offsets[i],
      );
      expect(m.world.enemies).toHaveLength(96);
      expect(m.world.front.orbs).toHaveLength(160);
      expect(c.decodeErrors).toBe(0);
    }
    await new Promise((r) => setTimeout(r, 350));
    expect(members[0].deltaPackets).toBe(0);
    expect(members.slice(1).every((c) => c.deltaPackets > 0)).toBe(true);
  } finally {
    clearInterval(tick);
  }
});

it("新通信の通常戦闘へ再接続すると全量から再開する", async () => {
  const { entry, members, states } = await team(
    1,
    "survival",
    3,
    true,
    true,
    true,
    true,
    true,
    [1],
  );
  const old = members[0];
  old.choose(states[0]);
  old.send({ type: "stateAck", stateAck: states[0].stateId });
  await old.wait((m) => m.type === "state" && m.frontView.phase === "combat");
  old.ws.close();
  await new Promise((r) => setTimeout(r, 100));
  const restored = new Client(
    entry.code,
    old.token,
    3,
    2,
    2,
    true,
    true,
    true,
    true,
    true,
    1,
  );
  await restored.wait((m) => m.type === "welcome");
  const first = await restored.wait((m) => m.type === "state");
  expect(restored.id).toBe(old.id);
  expect(first.world.run).toBe(states[0].world.run);
  expect(restored.deltaPackets).toBe(0);
  expect(restored.compactPackets).toBeGreaterThan(0);
});

it("PLEAT姿勢の新旧JSON・tuple4人が混在しても全量・差分を復元する", async () => {
  const { entry, members } = await team(
    4,
    "survival",
    3,
    true,
    [false, false, true, true],
    true,
    true,
    [false, false, true, true],
    [undefined, 1, 2, 1],
    [false, false, false, true],
  );
  let seq = 0;
  const timer = setInterval(() => {
    for (const c of members) {
      const state = c.messages.findLast((m) => m.type === "state");
      if (state && c.ws.readyState === 1)
        c.send({
          type: "input",
          input: { ...neutral(), seq: ++seq },
          stateAck: state.stateId,
        });
    }
  }, 100);
  try {
    const offsets = members.map((c) => c.messages.length);
    const response = await fetch(
      `${base}/fixtures/${entry.code}/front-wire-heavy`,
      { method: "POST" },
    );
    expect(response.status).toBe(200);
    for (let i = 0; i < members.length; i++) {
      const c = members[i],
        compact = i % 2 === 1;
      const m = await c.wait(
        (m) => m.type === "state" && m.world.projectiles.length === 400,
        offsets[i],
      );
      expect(m.world.enemies).toHaveLength(96);
      for (const e of m.world.enemies.filter(
        (e: any) => e.kind === "crawler",
      )) {
        if (compact) {
          expect(e.pleat.feet).toBeUndefined();
          expect(e.pleat.body.x).toBe(e.x);
        } else expect(e.pleat.feet).toHaveLength(4);
      }
      expect(c.decodeErrors).toBe(0);
      expect(c.compactPackets > 0).toBe(compact);
    }
    await new Promise((r) => setTimeout(r, 350));
    expect(members[2].deltaPackets).toBeGreaterThan(0);
    expect(members[3].deltaPackets).toBeGreaterThan(0);
    expect(members[0].chunkPackets).toBeGreaterThan(0);
    expect([...members[2].deltaVersions]).toEqual([1]);
    expect([...members[3].deltaVersions]).toEqual([2]);
  } finally {
    clearInterval(timer);
  }
});
