import { describe, expect, it } from "vitest";
import {
  StateDeltaReceiver,
  StateDeltaSender,
} from "../src/shared/state-delta";
import { STATE_SNAPSHOT_BYTES } from "../src/shared/state-chunks";
import { denseWireFixture } from "../scripts/state-wire-fixture";
import { prepareState } from "../src/shared/state-wire";
import { restoreStateTuples } from "../src/shared/state-tuples";

const bytes = (value: string) => new TextEncoder().encode(value).length;
function packet(stateId: number): any {
  return {
    type: "state",
    stateId,
    stateEncoding: "tuples-v1",
    stateOwners: ["隊員😀"],
    members: [{ id: "隊員😀", name: "星空🌟" }],
    padding: "固定".repeat(100),
    world: {
      time: stateId / 30,
      run: "run-1",
      nested: { keep: 1, remove: true },
      enemies: [
        [63, 1, "crawler", 2, 3, 4, 5],
        [63, 2, "crawler", 4, 5, 6, 7],
      ],
      projectiles: [[31, 10, 1, 2, 3, 4]],
      front: {
        phase: "wave",
        nested: { gone: true },
        orbs: [[31, 20, 1, 2, 3, 4]],
      },
    },
  };
}
function setup() {
  const sender = new StateDeltaSender(),
    receiver = new StateDeltaReceiver();
  const initial = packet(1),
    full = sender.encode(JSON.stringify(initial), 1);
  expect(full).toBe(JSON.stringify(initial));
  expect(receiver.decode(JSON.parse(full))).toEqual(initial);
  expect(sender.acknowledge(1)).toBe(true);
  return { sender, receiver };
}
describe("ACK済み基準の状態差分", () => {
  it("浅い追加・削除、nested削除、Unicode、tuple追加・削除・並替え・ID再利用を復元する", () => {
    const { sender, receiver } = setup();
    const next = packet(2);
    delete next.members;
    next.notice = "🌧️ 新しい隊員";
    delete next.world.nested.remove;
    delete next.world.front.nested;
    next.world.front.phase = "clear";
    next.world.enemies = [next.world.enemies[1], [63, 3, "new", 8, 9, 1, 2]];
    next.world.enemies[0][3] = 7.125;
    next.world.projectiles = [];
    next.world.front.orbs.push([31, 21, 1, 2, 3, 4]);
    const wire = sender.encode(JSON.stringify(next), 2);
    expect(JSON.parse(wire).type).toBe("stateDelta");
    expect(receiver.decode(JSON.parse(wire))).toEqual(next);
    sender.acknowledge(2);
    const reused = structuredClone(next);
    reused.stateId = 3;
    reused.world.enemies = [[127, 3, "different-kind", 1, 2, 3, 4, 5]];
    expect(
      receiver.decode(JSON.parse(sender.encode(JSON.stringify(reused), 3))),
    ).toEqual(reused);
  });
  it("ACK前はfull、送信中は2件までで古いACK・未来ACKは基準にしない", () => {
    const sender = new StateDeltaSender();
    for (const id of [1, 2])
      expect(
        JSON.parse(sender.encode(JSON.stringify(packet(id)), id)).type,
      ).toBe("state");
    expect(() => sender.encode(JSON.stringify(packet(3)), 3)).toThrow();
    expect(sender.acknowledge(100)).toBe(false);
    expect(sender.acknowledge(2)).toBe(true);
    expect(sender.acknowledge(1)).toBe(false);
    expect(JSON.parse(sender.encode(JSON.stringify(packet(3)), 3)).base).toBe(
      2,
    );
    expect(() => sender.encode(JSON.stringify(packet(3)), 3)).toThrow();
  });
  it("直近3件を保持し、2件目受信後も古いACK基準を復元できる", () => {
    const { sender, receiver } = setup();
    for (const id of [2, 3])
      expect(
        receiver.decode(
          JSON.parse(sender.encode(JSON.stringify(packet(id)), id)),
        ),
      ).toEqual(packet(id));
    sender.acknowledge(2);
    const fourth = sender.encode(JSON.stringify(packet(4)), 4);
    expect(JSON.parse(fourth).base).toBe(2);
    expect(receiver.decode(JSON.parse(fourth))).toEqual(packet(4));
    const stale = JSON.parse(fourth);
    stale.base = 1;
    stale.stateId = 5;
    expect(() => receiver.decode(stale)).toThrow();
  });
  it("復元後のtuple展開・利用側の変更は差分基準へ影響しない", () => {
    const { w, ids, metadata } = denseWireFixture(10);
    const sender = new StateDeltaSender(),
      receiver = new StateDeltaReceiver();
    const make = (stateId: number) =>
      JSON.stringify({
        ...JSON.parse(
          prepareState(w, 0, metadata).packet(
            ids[0],
            false,
            -1,
            undefined,
            true,
            true,
          ),
        ),
        stateId,
      });
    const first = receiver.decode(JSON.parse(sender.encode(make(1), 1))) as any;
    expect(restoreStateTuples(first)).toBe(true);
    first.world.time = 999;
    sender.acknowledge(1);
    const wire = sender.encode(make(2), 2),
      restored = receiver.decode(JSON.parse(wire));
    expect(restored).toEqual(JSON.parse(make(2)));
    expect(restoreStateTuples(restored)).toBe(true);
  });
  it("小さくならない時はfullをそのまま送り、reset後もfullへ戻る", () => {
    const sender = new StateDeltaSender(),
      receiver = new StateDeltaReceiver();
    const small = (stateId: number) =>
      JSON.stringify({ type: "state", stateId, world: {} });
    receiver.decode(JSON.parse(sender.encode(small(1), 1)));
    sender.acknowledge(1);
    expect(sender.encode(small(2), 2)).toBe(small(2));
    sender.reset();
    receiver.reset();
    expect(sender.encode(small(1), 1)).toBe(small(1));
    expect(receiver.decode({ type: "welcome" })).toEqual({ type: "welcome" });
    expect(receiver.decode({ type: "state", world: {} })).toEqual({
      type: "state",
      world: {},
    });
    const compact = (stateId: number) =>
      JSON.stringify({
        type: "state",
        stateId,
        stateEncoding: "tuples-v1",
        stateOwners: [String(stateId)],
        world: { enemies: [[3, stateId, stateId]], projectiles: [] },
      });
    sender.reset();
    sender.encode(compact(1), 1);
    sender.acknowledge(1);
    expect(sender.encode(compact(2), 2)).toBe(compact(2));
  });
  it("world.frontの出現・消滅も復元する", () => {
    const { sender, receiver } = setup();
    const second = packet(2);
    delete second.world.front;
    expect(
      receiver.decode(JSON.parse(sender.encode(JSON.stringify(second), 2))),
    ).toEqual(second);
    sender.acknowledge(2);
    expect(
      receiver.decode(JSON.parse(sender.encode(JSON.stringify(packet(3)), 3))),
    ).toEqual(packet(3));
  });
  it("world.frontを残したままorbsの追加・削除も復元する", () => {
    const { sender, receiver } = setup();
    const second = packet(2);
    delete second.world.front.orbs;
    expect(
      receiver.decode(JSON.parse(sender.encode(JSON.stringify(second), 2))),
    ).toEqual(second);
    sender.acknowledge(2);
    expect(
      receiver.decode(JSON.parse(sender.encode(JSON.stringify(packet(3)), 3))),
    ).toEqual(packet(3));
  });
  it("基準欠損・不一致・重複ID・不正field・余計なキー・prototypeを拒否し履歴を汚さない", () => {
    const { sender, receiver } = setup();
    const next = packet(2);
    next.world.enemies[0][3] = 4;
    const wire = sender.encode(JSON.stringify(next), 2),
      delta = JSON.parse(wire);
    const bad = [
      { ...delta, base: 999 },
      { ...delta, version: 2 },
      { ...delta, extra: 1 },
      { ...delta, stateId: 1 },
      { ...delta, patch: delta.patch.slice(1) },
    ];
    const duplicate = structuredClone(delta);
    duplicate.patch[3] = [0, 0];
    bad.push(duplicate);
    const field = structuredClone(delta);
    field.patch[3] = [[0, 1, 999]];
    bad.push(field);
    const proto = structuredClone(delta);
    proto.patch[0] = [JSON.parse('{"__proto__":{"polluted":true}}'), []];
    bad.push(proto);
    const nestedProto = structuredClone(delta);
    nestedProto.patch[0] = [{ bad: JSON.parse('{"constructor":{}}') }, []];
    bad.push(nestedProto);
    for (const value of bad) expect(() => receiver.decode(value)).toThrow();
    expect(() => new StateDeltaReceiver().decode(delta)).toThrow();
    expect(receiver.decode(delta)).toEqual(next);
    expect(() => receiver.decode(delta)).toThrow();
    expect(({} as any).polluted).toBeUndefined();
  });
  it("256KiBの復元上限をUTF-8で適用し、小さいdeltaによる展開超過も拒否する", () => {
    const { sender, receiver } = setup();
    const tooLarge = packet(2);
    tooLarge.padding = "😀".repeat(STATE_SNAPSHOT_BYTES / 4);
    expect(() => sender.encode(JSON.stringify(tooLarge), 2)).toThrow();
    expect(() => receiver.decode(tooLarge)).toThrow();
    const next = packet(2),
      delta = JSON.parse(sender.encode(JSON.stringify(next), 2));
    delta.patch[0] = [{ padding: "x".repeat(STATE_SNAPSHOT_BYTES - 200) }, []];
    expect(() => receiver.decode(delta)).toThrow();
    expect(
      receiver.decode(JSON.parse(sender.encode(JSON.stringify(packet(3)), 3))),
    ).toEqual(packet(3));
    const edge = packet(1);
    edge.padding = "";
    edge.padding = "x".repeat(
      STATE_SNAPSHOT_BYTES - bytes(JSON.stringify(edge)),
    );
    const edgeWire = JSON.stringify(edge);
    expect(bytes(edgeWire)).toBe(STATE_SNAPSHOT_BYTES);
    expect(new StateDeltaSender().encode(edgeWire, 1)).toBe(edgeWire);
    expect(new StateDeltaReceiver().decode(JSON.parse(edgeWire))).toEqual(edge);
  });
  it("構造予算を超えても256KiB内のfullを壊さず、差分だけを見送る", () => {
    const sender = new StateDeltaSender(),
      receiver = new StateDeltaReceiver();
    const first = packet(1);
    first.extra = Array.from({ length: 20 }, () => Array(3000).fill(0));
    const full = JSON.stringify(first);
    expect(bytes(full)).toBeLessThan(STATE_SNAPSHOT_BYTES);
    expect(sender.encode(full, 1)).toBe(full);
    expect(receiver.decode(JSON.parse(full))).toEqual(first);
    sender.acknowledge(1);
    const second = { ...first, stateId: 2 };
    expect(sender.encode(JSON.stringify(second), 2)).toBe(
      JSON.stringify(second),
    );
    expect(receiver.decode(second)).toEqual(second);
  });
  it("実データ生成器の96敵・PLEAT48・4人・160オーブ・400弾を可逆に縮小する", () => {
    const { w, ids, metadata } = denseWireFixture(400);
    const sender = new StateDeltaSender(),
      receiver = new StateDeltaReceiver();
    const make = (stateId: number) =>
      JSON.stringify({
        ...JSON.parse(
          prepareState(w, 0, metadata).packet(
            ids[0],
            true,
            stateId,
            undefined,
            true,
            true,
          ),
        ),
        stateId,
      });
    receiver.decode(JSON.parse(sender.encode(make(1), 1)));
    sender.acknowledge(1);
    w.time += 1 / 30;
    for (const enemy of w.enemies) {
      enemy.x += 0.03;
      enemy.z += 0.02;
      enemy.cool -= 1 / 30;
    }
    for (const shot of w.projectiles) {
      shot.x += 0.1;
      shot.z += 0.1;
      shot.life -= 1 / 30;
    }
    for (const player of w.players) player.x += 0.03;
    const full = make(2),
      delta = sender.encode(full, 2);
    expect(receiver.decode(JSON.parse(delta))).toEqual(JSON.parse(full));
    expect(bytes(delta)).toBeLessThan(bytes(full) * 0.75);
    console.info(
      JSON.stringify({
        tupleFullBytes: bytes(full),
        deltaBytes: bytes(delta),
        ratio: bytes(delta) / bytes(full),
      }),
    );
  });
});

it("長い接続でも定期的に全量を送り、差分を自己増殖させない", () => {
  const sender = new StateDeltaSender(),
    receiver = new StateDeltaReceiver();
  let fullCount = 0;
  for (let id = 1; id <= 120; id++) {
    const full = JSON.stringify(packet(id));
    const wire = JSON.parse(sender.encode(full, id));
    if (wire.type === "state") fullCount++;
    expect(receiver.decode(wire)).toEqual(JSON.parse(full));
    sender.acknowledge(id);
  }
  expect(fullCount).toBeGreaterThanOrEqual(3);
});
