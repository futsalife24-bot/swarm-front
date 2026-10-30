import { afterEach, describe, expect, it, vi } from "vitest";
import {
  encodeStateChunks,
  StateChunkAssembler,
  STATE_MESSAGE_BYTES,
  STATE_SNAPSHOT_BYTES,
} from "../src/shared/state-chunks";
import { denseWireFixture } from "../scripts/state-wire-fixture";
import { prepareState } from "../src/shared/state-wire";
import { restoreStateTuples } from "../src/shared/state-tuples";
import { spawn } from "../src/shared/game";
import { createPleat } from "../src/shared/pleat-locomotion";
import { Network } from "../src/client/network";
import { FrontNetwork } from "../src/client/front-network";
const size = (value: string) => new TextEncoder().encode(value).length;
function exactPayload(bytes: number) {
  const base = JSON.stringify({ type: "state", padding: "" });
  return JSON.stringify({
    type: "state",
    padding: "a".repeat(bytes - size(base)),
  });
}
function frames(snapshot = 1) {
  return encodeStateChunks(exactPayload(180000), snapshot)!;
}
function change(wire: string, mutate: (value: any) => void) {
  const value = JSON.parse(wire);
  mutate(value);
  return JSON.stringify(value);
}
function roundTrip(
  parts: string[],
  assembler = new StateChunkAssembler(),
  at = 0,
) {
  const result: unknown[] = [];
  for (const part of parts) {
    const decoded = assembler.read(part, at);
    if (decoded !== undefined) result.push(decoded);
  }
  return result;
}
function wallFixture() {
  const { w, ids, metadata } = denseWireFixture(295);
  w.enemies = [];
  for (let n = 0; n < 96; n++) {
    const e = spawn(w, "crawler", (n % 12) * 3, Math.floor(n / 12) * 3)!;
    e.active = true;
    e.pleat = createPleat(
      { x: e.x, y: 8, z: e.z },
      { x: 0.6, y: 0.8, z: 0 },
      1.123456,
      { ray: () => undefined },
    );
    const up = {
      x: 1 / Math.sqrt(3),
      y: 1 / Math.sqrt(3),
      z: 1 / Math.sqrt(3),
    };
    e.pleat.up = { ...up };
    e.pleat.forward = { x: 1 / Math.sqrt(2), y: -1 / Math.sqrt(2), z: 0 };
    e.pleat.poseForward = { ...e.pleat.forward };
    const anchor = { x: e.x, y: 8, z: e.z };
    e.y = 8;
    e.pleat.body = {
      x: anchor.x + up.x * 0.8 * e.pleat.scale,
      y: anchor.y + up.y * 0.8 * e.pleat.scale,
      z: anchor.z + up.z * 0.8 * e.pleat.scale,
    };
    const forward = e.pleat.forward;
    const side = {
      x: up.y * forward.z - up.z * forward.y,
      y: up.z * forward.x - up.x * forward.z,
      z: up.x * forward.y - up.y * forward.x,
    };
    e.pleat.feet.forEach((foot) => {
      const localX = foot.point.x - anchor.x,
        localZ = foot.point.z - anchor.z;
      foot.point = {
        x: anchor.x + side.x * localX + forward.x * localZ,
        y: anchor.y + side.y * localX + forward.y * localZ,
        z: anchor.z + side.z * localX + forward.z * localZ,
      };
      foot.normal = { ...up };
    });
    w.front!.players[ids[0]].statuses[e.id] = {
      marked: true,
      hits: 12,
      lastShot: 9999,
    };
  }
  w.events = [];
  return { w, ids, metadata };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("上限付きsnapshot分割", () => {
  it.each([
    100,
    STATE_MESSAGE_BYTES,
    STATE_MESSAGE_BYTES + 1,
    STATE_SNAPSHOT_BYTES,
  ])("%d byteを片上限内で正確に往復する", (bytes) => {
    const payload = exactPayload(bytes);
    const parts = encodeStateChunks(payload, 1)!;
    expect(parts.every((part) => size(part) <= STATE_MESSAGE_BYTES)).toBe(true);
    expect(parts.length).toBeLessThanOrEqual(16);
    expect(parts.length === 1).toBe(bytes <= STATE_MESSAGE_BYTES);
    expect(roundTrip(parts)).toEqual([JSON.parse(payload)]);
  });
  it("256KiB超と不正なsnapshot番号は分割しない", () => {
    expect(
      encodeStateChunks(exactPayload(STATE_SNAPSHOT_BYTES + 1), 1),
    ).toBeUndefined();
    expect(encodeStateChunks(exactPayload(100), -1)).toBeUndefined();
    expect(
      encodeStateChunks(exactPayload(100), Number.MAX_SAFE_INTEGER + 1),
    ).toBeUndefined();
  });
  it("日本語・絵文字・引用符・逆斜線もUTF8境界と各片上限を維持する", () => {
    const payload = JSON.stringify({
      type: "state",
      padding: '隊🙂"\\\n'.repeat(11000),
    });
    const parts = encodeStateChunks(payload, 3)!;
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((part) => size(part) <= STATE_MESSAGE_BYTES)).toBe(true);
    expect(roundTrip(parts)).toEqual([JSON.parse(payload)]);
  });
  it("最後の片まで部分Worldを返さず、受信期限は最初の片から2秒", () => {
    const parts = frames();
    const a = new StateChunkAssembler();
    parts
      .slice(0, -1)
      .forEach((part) => expect(a.read(part, 0)).toBeUndefined());
    expect(a.read(parts.at(-1)!, 2000)).toEqual(
      JSON.parse(exactPayload(180000)),
    );
    const b = new StateChunkAssembler();
    expect(b.read(parts[0], 0)).toBeUndefined();
    expect(roundTrip(parts.slice(1), b, 2001)).toEqual([]);
  });
  it.each([
    [
      "不正版",
      (p: any) => {
        p.version = 2;
      },
    ],
    [
      "過大片数",
      (p: any) => {
        p.total = 17;
      },
    ],
    [
      "片数0",
      (p: any) => {
        p.total = 0;
      },
    ],
    [
      "不正index",
      (p: any) => {
        p.index = -1;
      },
    ],
    [
      "非整数snapshot",
      (p: any) => {
        p.snapshot = 1.5;
      },
    ],
    [
      "全体上限超",
      (p: any) => {
        p.bytes = STATE_SNAPSHOT_BYTES + 1;
      },
    ],
    [
      "全体byte不一致",
      (p: any) => {
        p.bytes--;
      },
    ],
    [
      "checksum不一致",
      (p: any) => {
        p.checksum ^= 1;
      },
    ],
    [
      "同長内容破損",
      (p: any) => {
        p.data = p.data.replace("aaa", "baa");
      },
    ],
    [
      "不正Unicode",
      (p: any) => {
        p.data = "\ud800";
      },
    ],
    [
      "余分な項目",
      (p: any) => {
        p.extra = 1;
      },
    ],
  ])("%sを拒否し、次の正常snapshotで復帰する", (_name, mutate) => {
    const parts = frames();
    const assembler = new StateChunkAssembler();
    expect(
      roundTrip([change(parts[0], mutate), ...parts.slice(1)], assembler),
    ).toEqual([]);
    expect(roundTrip(frames(2), assembler)).toHaveLength(1);
  });
  it("後半片の内容破損・JSON破損も途中Worldを公開しない", () => {
    const parts = frames();
    const modified = [...parts];
    modified[1] = change(modified[1], (p) => {
      p.data = p.data.replace("aaa", "baa");
    });
    expect(roundTrip(modified)).toEqual([]);
    const malformed = [...parts];
    malformed[1] = "{";
    expect(roundTrip(malformed)).toEqual([]);
  });
  it("順序逆転・重複・古いsnapshot・欠落片は受理しない", () => {
    const parts = frames();
    expect(roundTrip([parts[1], parts[0], ...parts.slice(2)])).toEqual([]);
    expect(roundTrip([parts[0], parts[0], ...parts.slice(1)])).toEqual([]);
    expect(roundTrip([parts[0], ...parts.slice(2)])).toEqual([]);
    const assembler = new StateChunkAssembler();
    expect(roundTrip(frames(2), assembler)).toHaveLength(1);
    expect(roundTrip(frames(1), assembler)).toEqual([]);
    expect(roundTrip(frames(2), assembler)).toEqual([]);
    expect(roundTrip(frames(3), assembler)).toHaveLength(1);
  });
  it("新しいsnapshotまたは通常stateが古い未完snapshotを置き換える", () => {
    const assembler = new StateChunkAssembler();
    assembler.read(frames(1)[0], 0);
    expect(roundTrip(frames(2), assembler)).toHaveLength(1);
    assembler.read(frames(3)[0], 0);
    expect(
      assembler.read(JSON.stringify({ type: "state", world: {} }), 0),
    ).toEqual({ type: "state", world: {} });
    expect(roundTrip(frames(3).slice(1), assembler)).toEqual([]);
  });
  it("実UTF8で64KiB超の単一messageとstate以外の組立結果を拒否する", () => {
    expect(
      new StateChunkAssembler().read(
        JSON.stringify({ type: "state", text: "隊".repeat(22000) }),
      ),
    ).toBeUndefined();
    const payload = JSON.stringify({
      type: "pong",
      padding: "a".repeat(70000),
    });
    expect(roundTrip(encodeStateChunks(payload, 1)!)).toEqual([]);
  });
  it("96体の壁面PLEAT・295弾・160オーブを省略なしで往復する", () => {
    const { w, ids, metadata } = wallFixture();
    const prepared = prepareState(w, 0, metadata);
    const wire = prepared.packet(
      ids[0],
      false,
      10,
      undefined,
      true,
      true,
      true,
    );
    const expected = JSON.parse(wire);
    expect(size(wire)).toBeGreaterThan(STATE_MESSAGE_BYTES);
    expect(expected.omitted).toBeUndefined();
    const pieces = encodeStateChunks(wire, 7)!;
    expect(pieces.every((part) => size(part) <= STATE_MESSAGE_BYTES)).toBe(
      true,
    );
    const [restored] = roundTrip(pieces) as any[];
    expect(restored).toEqual(expected);
    expect(restoreStateTuples(restored)).toBe(true);
    expect(restored.world.enemies).toHaveLength(96);
    expect(restored.world.enemies.every((e: any) => e.pleat)).toBe(true);
    expect(restored.world.projectiles).toHaveLength(295);
    expect(restored.world.front.orbs).toHaveLength(160);
    expect(
      JSON.parse(prepared.packet(ids[0], false, 10, undefined, true, true))
        .omitted,
    ).toBeDefined();
  });
  it.each([
    ["通常", Network],
    ["生存", FrontNetwork],
  ] as const)(
    "接続単位で組み立て、旧serverと再接続へ対応する: %s",
    (_label, Class) => {
      vi.useFakeTimers();
      class Socket {
        readyState = 1;
        bufferedAmount = 0;
        sent: any[] = [];
        onopen?: () => void;
        onmessage?: (event: { data: string }) => void;
        send(wire: string) {
          this.sent.push(JSON.parse(wire));
        }
        close() {
          this.readyState = 3;
        }
        message(wire: string) {
          this.onmessage?.({ data: wire });
        }
      }
      vi.stubGlobal("WebSocket", Socket);
      const net = new Class("http://localhost");
      const received: any[] = [];
      net.onWorld = (world) => received.push(world);
      try {
        net.connect("test");
        let ws = net.ws as unknown as Socket;
        ws.onopen?.();
        expect(ws.sent[0].stateChunks).toBe(1);
        const { w, ids, metadata } = wallFixture();
        const prepared = prepareState(w, 0, metadata);
        const wire = prepared.packet(
          ids[0],
          false,
          10,
          undefined,
          true,
          true,
          true,
        );
        const parts = encodeStateChunks(wire, 1)!;
        parts.slice(0, -1).forEach((part) => ws.message(part));
        expect(received).toHaveLength(0);
        ws.message(parts.at(-1)!);
        expect(received).toHaveLength(1);
        expect(received[0].enemies).toHaveLength(96);
        ws.message(encodeStateChunks(wire, 2)![0]);
        net.connect("test");
        ws = net.ws as unknown as Socket;
        encodeStateChunks(wire, 2)!
          .slice(1)
          .forEach((part) => ws.message(part));
        expect(received).toHaveLength(1);
        expect(ws.readyState).toBe(3); // 欠落片は再接続で回復する。
        net.connect("test");
        ws = net.ws as unknown as Socket;
        encodeStateChunks(wire, 1)!.forEach((part) => ws.message(part));
        expect(received).toHaveLength(2);
        w.enemies = w.enemies.slice(0, 1);
        w.projectiles = [];
        w.front!.orbs = [];
        w.front!.players[ids[0]].statuses = {};
        const legacy = prepareState(w, 0, metadata).packet(ids[0]);
        expect(size(legacy)).toBeLessThanOrEqual(STATE_MESSAGE_BYTES);
        ws.message(legacy);
        expect(received).toHaveLength(3);
      } finally {
        clearInterval(net.timer);
      }
    },
  );
});

it("正常な未完成と期限超過・checksum破損を明確に区別する", () => {
  const parts = frames();
  const receiver = new StateChunkAssembler();
  receiver.read(parts[0], 100);
  expect(receiver.failed).toBe(false);
  expect(receiver.deadline).toBe(2100);
  expect(receiver.expire(2100)).toBe(false);
  expect(receiver.expire(2101)).toBe(true);
  expect(receiver.failed).toBe(true);
  expect(receiver.deadline).toBeUndefined();
  expect(roundTrip(frames(2), receiver, 2200)).toHaveLength(1);
  expect(receiver.failed).toBe(false);
  const broken = frames(3).map((part) =>
    change(part, (value) => (value.checksum ^= 1)),
  );
  expect(roundTrip(broken, receiver, 2300)).toHaveLength(0);
  expect(receiver.failed).toBe(true);
});
