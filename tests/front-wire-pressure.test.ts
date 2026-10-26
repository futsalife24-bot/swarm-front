import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { denseWireFixture } from "../scripts/state-wire-fixture";
import { encodeState, prepareState } from "../src/shared/state-wire";
import { StateOmissionCache } from "../src/client/state-omissions";
import { FrontNetwork } from "../src/client/front-network";
import { Network } from "../src/client/network";

const bytes = (value: string) => new TextEncoder().encode(value).length;

describe("密集時の状態送信", () => {
  it("4人・混在96体・PLEAT・オーブ160個・多数の弾でも容量内で切断しない", () => {
    const { w, ids, metadata } = denseWireFixture();
    const original = JSON.stringify(w);
    expect(w.enemies).toHaveLength(96);
    expect(new Set(w.enemies.map((e) => e.kind)).size).toBeGreaterThan(4);
    expect(w.enemies.filter((e) => e.pleat).length).toBeGreaterThan(0);
    expect(w.front!.orbs).toHaveLength(160);
    const payload = prepareState(w, 0, metadata).packet(ids[0]);
    expect(bytes(payload)).toBeLessThanOrEqual(65536);
    const packet = JSON.parse(payload);
    expect(packet.world.projectiles).toHaveLength(180);
    expect(packet.world.players).toHaveLength(4);
    expect(JSON.stringify(w)).toBe(original);

    // 本物の送信メソッドを使って上限切断されないことを確認する。
    const source = readFileSync("server/worker.ts", "utf8");
    const start = source.indexOf("  private sendEncoded(");
    const end = source.indexOf("  error(", start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const code = stripTypeScriptTypes(
      `class Harness {${source.slice(start, end)}}; new Harness()`,
    );
    const worker = runInNewContext(code, { TextEncoder });
    const sent: string[] = [],
      closed: number[] = [];
    worker.disconnected = () => {
      throw new Error("予期しない切断");
    };
    expect(
      worker.sendEncoded(
        {
          send: (value: string) => sent.push(value),
          close: (code: number) => closed.push(code),
        },
        payload,
      ),
    ).toBe(true);
    expect(sent).toEqual([payload]);
    expect(closed).toEqual([]);
  });

  it("演出、遠いオーブ、遠い敵の順に省略し、受信者ごとに距離を判定する", () => {
    const { w, ids, metadata } = denseWireFixture(280);
    Object.assign(w.players[0], { x: -18, y: 0, z: -12 });
    Object.assign(w.players[1], { x: 50, y: 0, z: 20 });
    const before = JSON.stringify(w);
    const state = prepareState(w, 0, metadata);
    const a = JSON.parse(state.packet(ids[0]));
    const b = JSON.parse(state.packet(ids[1]));
    expect(bytes(JSON.stringify(a))).toBeLessThanOrEqual(65536);
    expect(bytes(JSON.stringify(b))).toBeLessThanOrEqual(65536);
    expect(a.world.events).toHaveLength(0);
    expect(a.omitted.orbs.length).toBeGreaterThan(0);
    expect(a.omitted.enemies.length).toBeGreaterThan(0);
    expect(a.world.front.orbs).toHaveLength(0);
    expect(a.world.projectiles).toHaveLength(280);
    const d = (p: { x: number; y: number; z: number }) =>
      (p.x - w.players[0].x) ** 2 +
      (p.y - (w.players[0].y ?? 0)) ** 2 +
      (p.z - w.players[0].z) ** 2;
    const kept = w.enemies.filter((e) => !a.omitted.enemies.includes(e.id));
    const omitted = w.enemies.filter((e) => a.omitted.enemies.includes(e.id));
    expect(Math.max(...kept.map(d))).toBeLessThanOrEqual(
      Math.min(...omitted.map(d)),
    );
    expect(a.omitted.enemies).not.toEqual(b.omitted.enemies);
    expect(JSON.stringify(w)).toBe(before);
    // 非対応の旧クライアントへ省略IDを送り、誤って撃破表示させない。
    expect(
      JSON.parse(state.packet(ids[0], false, -1, undefined, false)).omitted,
    ).toBeUndefined();
  });

  it("オーブだけで収まる場合は遠い順に省略し、敵は全て残す", () => {
    const { w, ids, metadata } = denseWireFixture(40);
    const packet = JSON.parse(prepareState(w, 0, metadata).packet(ids[0]));
    expect(packet.world.events).toHaveLength(0);
    expect(packet.world.enemies).toHaveLength(96);
    expect(packet.omitted.enemies).toEqual([]);
    expect(packet.omitted.orbs.length).toBeGreaterThan(0);
    expect(packet.world.front.orbs.length).toBeGreaterThan(0);
    const p = w.players[0];
    const distance = (o: { x: number; y: number; z: number }) =>
      (o.x - p.x) ** 2 + (o.y - (p.y ?? 0)) ** 2 + (o.z - p.z) ** 2;
    const kept = w.front!.orbs.filter(
      (o) => !packet.omitted.orbs.includes(o.id),
    );
    const removed = w.front!.orbs.filter((o) =>
      packet.omitted.orbs.includes(o.id),
    );
    expect(Math.max(...kept.map(distance))).toBeLessThanOrEqual(
      Math.min(...removed.map(distance)),
    );
  });

  it("削減対象を全て除いても収まらない場合は上限切断の最終手段を残す", () => {
    const { w, ids, metadata } = denseWireFixture(900);
    const payload = prepareState(w, 0, metadata).packet(ids[0]);
    expect(bytes(payload)).toBeGreaterThan(65536);
    const source = readFileSync("server/worker.ts", "utf8");
    const start = source.indexOf("  private sendEncoded(");
    const end = source.indexOf("  error(", start);
    const worker = runInNewContext(
      stripTypeScriptTypes(
        `class Harness {${source.slice(start, end)}}; new Harness()`,
      ),
      { TextEncoder },
    );
    const closed: number[] = [];
    worker.disconnected = vi.fn();
    worker.sendEncoded(
      {
        send: () => {
          throw new Error("大きすぎる状態を送信した");
        },
        close: (code: number) => closed.push(code),
      },
      payload,
    );
    expect(closed).toEqual([4009]);
    expect(worker.disconnected).toHaveBeenCalledOnce();
  });

  it("省略時は直前表示を保持し、本当に消えた個体は次の状態で除く", () => {
    const { w } = denseWireFixture();
    const cache = new StateOmissionCache();
    const first = structuredClone(w);
    first.enemies = first.enemies.slice(0, 2);
    first.front!.orbs = first.front!.orbs.slice(0, 2);
    cache.restore(first, undefined);
    const second = structuredClone(first);
    const enemy = second.enemies.pop()!,
      orb = second.front!.orbs.pop()!;
    cache.restore(second, { enemies: [enemy.id], orbs: [orb.id] });
    expect(second.enemies.map((e) => e.id)).toContain(enemy.id);
    expect(second.front!.orbs.map((o) => o.id)).toContain(orb.id);
    const third = structuredClone(second);
    third.enemies = third.enemies.filter((e) => e.id !== enemy.id);
    third.front!.orbs = third.front!.orbs.filter((o) => o.id !== orb.id);
    cache.restore(third, { enemies: [], orbs: [] });
    expect(third.enemies.map((e) => e.id)).not.toContain(enemy.id);
    expect(third.front!.orbs.map((o) => o.id)).not.toContain(orb.id);
    const nextRun = structuredClone(first);
    nextRun.run = "new-run";
    nextRun.enemies = [];
    nextRun.front!.orbs = [];
    cache.restore(nextRun, { enemies: [enemy.id], orbs: [orb.id] });
    expect(nextRun.enemies).toEqual([]);
    expect(nextRun.front!.orbs).toEqual([]);
  });

  it("生存と旧版の受信経路は対応を通知し、省略中だけ前の表示を引き継ぐ", () => {
    class Socket {
      readyState = 1;
      send = vi.fn();
      close = vi.fn();
      onopen?: () => void;
      onmessage?: (e: { data: string }) => void;
      message(value: unknown) {
        this.onmessage?.({ data: JSON.stringify(value) });
      }
    }
    vi.stubGlobal("WebSocket", Socket);
    try {
      for (const front of [true, false]) {
        const net = front
          ? new FrontNetwork("http://127.0.0.1")
          : new Network("http://127.0.0.1");
        const seen: number[][] = [];
        net.onWorld = (world) =>
          seen.push(world.enemies.map((enemy) => enemy.id));
        net.connect("test");
        const socket = net.ws as unknown as Socket;
        socket.onopen?.();
        expect(JSON.parse(socket.send.mock.calls[0][0]).stateOmissions).toBe(1);
        socket.message({
          type: "welcome",
          id: "p",
          token: "test",
          ...(front ? { ruleset: "front-v1", frontOpening: 2 } : {}),
        });
        const { w } = denseWireFixture(0);
        w.enemies = w.enemies.slice(0, 2);
        w.front!.orbs = [];
        const missing = w.enemies[1].id;
        const state = (world: typeof w, omitted?: object) =>
          socket.message({
            type: "state",
            world,
            members: [],
            preparationGeneration: 0,
            omitted,
          });
        state(w);
        const shorter = structuredClone(w);
        shorter.enemies.pop();
        state(shorter, { enemies: [missing], orbs: [] });
        state(shorter);
        expect(seen[0]).toContain(missing);
        expect(seen[1]).toContain(missing);
        expect(seen[2]).not.toContain(missing);
        clearInterval(net.timer);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("表示用の種類別状態を維持し、権威用の経路やタイマーを送らない", () => {
    const { w, ids, metadata } = denseWireFixture(0);
    w.events = [];
    w.front!.orbs = [];
    w.enemies = [
      w.enemies[0],
      ...w.enemies
        .filter((e) => ["bastion", "calyx", "harrow", "boss"].includes(e.kind))
        .slice(0, 4),
    ];
    const crawler = w.enemies[0];
    const bastion = w.enemies.find((e) => e.kind === "bastion")!;
    const harrow = w.enemies.find((e) => e.kind === "harrow")!;
    const worm = w.enemies.find((e) => e.kind === "boss")!;
    bastion.bastion!.streak = 5;
    bastion.bastion!.phase = "warn";
    bastion.bastion!.volley = { count: 6, turn: 1.234567, x: 1, y: 2, z: 3 };
    harrow.harrow = {
      kind: "Dash",
      started: 1.234567,
      yaw: 2.345678,
      fired: false,
      from: { x: 1, y: 2, z: 3 },
      to: { x: 4, y: 5, z: 6 },
      hitIds: ["private"],
    };
    const packet = JSON.parse(prepareState(w, 0, metadata).packet(ids[0]));
    const result = packet.world.enemies.find(
      (e: { id: number }) => e.id === crawler.id,
    );
    expect(result.targetId).toBe(crawler.targetId);
    expect(result.wallYaw).toBe(1.23);
    expect(result.pleat.feet).toHaveLength(4);
    for (const key of [
      "navigation",
      "steerUntil",
      "steerAngle",
      "wallCooldown",
      "jumpFrom",
      "jumpWait",
      "flightUntil",
      "flightHeight",
    ])
      expect(result).not.toHaveProperty(key);
    const wireBastion = packet.world.enemies.find(
      (e: { id: number }) => e.id === bastion.id,
    ).bastion;
    expect(wireBastion).not.toHaveProperty("streak");
    expect(wireBastion).toMatchObject({
      phase: "warn",
      volley: { count: 6, turn: 1.23, x: 1, y: 2, z: 3 },
    });
    const wireHarrow = packet.world.enemies.find(
      (e: { id: number }) => e.id === harrow.id,
    ).harrow;
    expect(wireHarrow).toMatchObject({
      kind: "Dash",
      started: 1.23,
      yaw: 2.35,
      from: { x: 1, y: 2, z: 3 },
      to: { x: 4, y: 5, z: 6 },
    });
    expect(wireHarrow).not.toHaveProperty("hitIds");
    const wireWorm = packet.world.enemies.find(
      (e: { id: number }) => e.id === worm.id,
    );
    expect(wireWorm.segments).toHaveLength(7);
    expect(wireWorm.segments[0]).toMatchObject({
      partHp: 100,
      heading: 1.12,
      pulseAim: { x: 0, y: 1, z: 0 },
    });
    expect(wireWorm.segments[0]).not.toHaveProperty("trail");
    expect(
      JSON.parse(
        encodeState({
          value: 1.234567,
          weapon: {
            kind: "rifle",
            rarity: 1,
            power: 1.234567,
            rolls: { mag: 1.234567 },
          },
        }),
      ),
    ).toEqual({
      value: 1.23,
      weapon: {
        kind: "rifle",
        rarity: 1,
        power: 1.234567,
        rolls: { mag: 1.234567 },
      },
    });
  });
});
