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
  constructor(
    code: string,
    stage = 3,
    token = "",
    capable = true,
    modern = true,
  ) {
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
        frontCatalog: modern ? 3 : 2,
        ...(modern ? { frontSurvivalBuild: 1 } : {}),
        frontOpening: 2,
        ...(capable ? { frontSupportRewards: 1 } : {}),
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
async function startTeam(count = 2, mixed = false, modern = true) {
  const entry = await room(),
    members: Client[] = [];
  for (let i = 0; i < count; i++) {
    const c = new Client(
      entry.code,
      3,
      "",
      !(mixed && i === count - 1),
      modern,
    );
    await c.wait((m) => m.type === "welcome");
    members.push(c);
  }
  const host = members[0],
    guest = members[1];
  for (const [index, c] of members.entries()) {
    await c.wait((m) => m.type === "welcome");
    c.send({
      type: "equip",
      upgradePool: FRONT_BASE_IDS,
      clearedStage: index ? 25 : 3,
      weapons: STARTERS.slice(0, modern ? 1 : 2).map((w, i) => ({
        ...w,
        id: `net-${index}-${i}`,
        level: 4,
        mods: { damage: 1 },
      })),
    });
    await c.wait(
      (m) =>
        m.type === "lobby" &&
        m.members?.find((p: any) => p.id === c.id)?.weapons?.length ===
          (modern ? 1 : 2),
    );
  }
  const lobby = await host.wait(
    (m) =>
      m.type === "lobby" &&
      m.members?.length === count &&
      m.members.every((p: any) => p.weapons?.length === (modern ? 1 : 2)),
  );
  for (const c of members)
    c.send({
      type: "ready",
      ready: true,
      stage: lobby.stage,
      preparationGeneration: lobby.preparationGeneration,
    });
  await host.wait(
    (m) => m.members?.length === count && m.members.every((p: any) => p.ready),
  );
  host.send({ type: "start" });
  const state = await host.wait((m) => m.type === "state");
  await guest?.wait((m) => m.type === "state");
  return { entry, host, guest, state, members };
}

it.each(
  [1, 2, 4].flatMap((count) =>
    [true, false].map((modern) => ({ count, modern })),
  ),
)(
  "$count クライアント modern=$modern の合成結果を実通信・SQLite保存で検証する",
  async ({ count, modern }) => {
    const { entry, host, members, state } = await startTeam(
      count,
      false,
      modern,
    );
    expect(state.frontView.rewardPolicy).toBe(
      count === 1 ? "individual-v1" : "team-v1",
    );
    expect(
      (
        await fetch(`${base}/fixtures/${entry.code}/front-support-result`, {
          method: "POST",
        })
      ).ok,
    ).toBe(true);
    const counts: number[] = [];
    for (const c of members) {
      const result = await c.wait((m) => m.frontView?.phase === "defeat");
      const rewards = result.world.rewards[c.id];
      expect(result.world.totalKills).toBe(90);
      counts.push(rewards.length);
      expect(result.frontView.rewardCount).toBe(rewards.length);
      expect(Object.keys(result.world.rewards)).toEqual([c.id]);
      expect(JSON.stringify(result)).not.toContain('"supportRewards"');
      expect(JSON.stringify(result)).not.toContain('"actionAt"');
      expect(JSON.stringify(result)).not.toContain('"presentAt"');
    }
    expect(counts.reduce((a, b) => a + b, 0)).toBe(6);
    if (count === 2) expect(counts).toEqual([3, 3]);
    if (count === 4) expect(counts.sort()).toEqual([1, 1, 2, 2]);
    const before = await host.wait((m) => m.frontView?.phase === "defeat");
    const token = host.token;
    host.ws.close();
    if (count > 1) {
      const old = new Client(entry.code, 3, token, false, modern);
      const notice = await old.wait((m) => m.type === "notice");
      expect(notice.reason).toContain("再読み込み");
      expect(old.messages.some((m) => m.type === "welcome")).toBe(false);
    }
    const fresh = new Client(entry.code, 3, token, true, modern);
    const restored = await fresh.wait((m) => m.frontView?.phase === "defeat");
    expect(fresh.id).toBe(host.id);
    expect(restored.world.rewards[host.id]).toEqual(
      before.world.rewards[host.id],
    );
  },
);
it("新旧混在部屋は従来報酬のまま保持する", async () => {
  const { entry, host, guest, state } = await startTeam(2, true);
  expect(state.frontView.rewardPolicy).toBe("individual-v1");
  expect(
    (
      await fetch(`${base}/fixtures/${entry.code}/front-support-result`, {
        method: "POST",
      })
    ).ok,
  ).toBe(true);
  expect(
    (await host.wait((m) => m.frontView?.phase === "defeat")).world.rewards[
      host.id
    ],
  ).toHaveLength(6);
  expect(
    (await guest.wait((m) => m.frontView?.phase === "defeat")).world.rewards[
      guest.id
    ],
  ).toEqual([]);
});
