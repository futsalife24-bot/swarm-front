import { describe, expect, it } from "vitest";
import {
  StateDeltaReceiver,
  StateDeltaSender,
} from "../src/shared/state-delta";
import { STATE_SNAPSHOT_BYTES } from "../src/shared/state-chunks";
import { denseWireFixture } from "../scripts/state-wire-fixture";
import { prepareState } from "../src/shared/state-wire";
import { restoreStateTuples } from "../src/shared/state-tuples";
import { neutral, step } from "../src/shared/game";

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
  it("v1を既定のまま保ち、v2だけプレイヤーの並替え・追加・削除・部分更新を復元する", () => {
    const first = packet(1);
    first.world.players = [
      {
        id: "隊員😀",
        x: 1,
        hp: 10,
        weapons: [{ name: "長い装備".repeat(20) }],
      },
      { id: "second", x: 2, hp: 20, removed: true },
    ];
    const next = structuredClone(first);
    next.stateId = 2;
    next.world.players = [
      { id: "second", x: 3, hp: 20 },
      { id: "new", x: 4, hp: 30 },
    ];
    const oldSender = new StateDeltaSender(),
      newSender = new StateDeltaSender(2),
      receiver = new StateDeltaReceiver();
    expect(oldSender.version).toBe(1);
    expect(newSender.version).toBe(2);
    expect(() => new StateDeltaSender(3 as any)).toThrow();
    oldSender.encode(JSON.stringify(first), 1);
    oldSender.acknowledge(1);
    const oldWire = JSON.parse(oldSender.encode(JSON.stringify(next), 2));
    expect(oldWire.version).toBe(1);
    expect(oldWire.patch).toHaveLength(6);
    receiver.decode(JSON.parse(newSender.encode(JSON.stringify(first), 1)));
    newSender.acknowledge(1);
    const wire = newSender.encode(JSON.stringify(next), 2),
      delta = JSON.parse(wire);
    expect(delta.version).toBe(2);
    expect(delta.patch).toHaveLength(7);
    expect(delta.patch[6][0]).toEqual([1, { x: 3 }, ["removed"]]);
    expect(delta.patch[6][1]).toEqual([{ id: "new", x: 4, hp: 30 }]);
    expect(receiver.decode(delta)).toEqual(next);
    newSender.acknowledge(2);
    const third = structuredClone(next);
    third.stateId = 3;
    third.world.players = [third.world.players[1], third.world.players[0]];
    expect(
      receiver.decode(JSON.parse(newSender.encode(JSON.stringify(third), 3))),
    ).toEqual(third);
  });
  it("v2プレイヤー差分の不正参照・重複ID・ID変更・危険キーを拒否し履歴を保つ", () => {
    const sender = new StateDeltaSender(2),
      receiver = new StateDeltaReceiver();
    const first = packet(1);
    first.world.players = [
      { id: "one", x: 1, hp: 10 },
      { id: "two", x: 2, hp: 20 },
    ];
    receiver.decode(JSON.parse(sender.encode(JSON.stringify(first), 1)));
    sender.acknowledge(1);
    const next = structuredClone(first);
    next.stateId = 2;
    next.world.players[0].x = 3;
    const valid = JSON.parse(sender.encode(JSON.stringify(next), 2));
    expect(valid.version).toBe(2);
    const invalidPatches = [
      [999],
      [0, 0],
      Array.from({ length: 5 }, (_, index) => [{ id: String(index) }]),
      [[0, { id: "changed" }, []], 1],
      [[0, {}, ["id"]], 1],
      [[0, {}, [], 1], 1],
      [[{ x: 3 }], 1],
      [[0, JSON.parse('{"__proto__":{"polluted":true}}'), []], 1],
    ];
    for (const players of invalidPatches) {
      const bad = structuredClone(valid);
      bad.patch[6] = players;
      expect(() => receiver.decode(bad)).toThrow();
    }
    const worldChange = structuredClone(valid);
    worldChange.patch[1] = [{ players: [] }, []];
    expect(() => receiver.decode(worldChange)).toThrow();
    const wrongLength = structuredClone(valid);
    wrongLength.patch.pop();
    expect(() => receiver.decode(wrongLength)).toThrow();
    expect(receiver.decode(valid)).toEqual(next);
    expect(({} as any).polluted).toBeUndefined();
  });
  it("v2でプレイヤーIDが不適格ならfullへ戻す", () => {
    const sender = new StateDeltaSender(2);
    sender.encode(JSON.stringify(packet(1)), 1);
    sender.acknowledge(1);
    expect(JSON.parse(sender.encode(JSON.stringify(packet(2)), 2)).type).toBe(
      "state",
    );
    const tooMany = packet(1);
    tooMany.world.players = Array.from({ length: 5 }, (_, index) => ({
      id: String(index),
    }));
    const fiveSender = new StateDeltaSender(2);
    fiveSender.encode(JSON.stringify(tooMany), 1);
    fiveSender.acknowledge(1);
    const next = structuredClone(tooMany);
    next.stateId = 2;
    expect(JSON.parse(fiveSender.encode(JSON.stringify(next), 2)).type).toBe(
      "state",
    );
  });
  it("実ゲーム生成器のプレイヤー移動でv2の通信量を測り、v1と同じ状態へ復元する", () => {
    const { w, ids, metadata } = denseWireFixture(10);
    const make = (stateId: number) =>
      JSON.stringify({
        ...JSON.parse(
          prepareState(w, 0, metadata).packet(
            ids[0],
            false,
            stateId,
            undefined,
            true,
            true,
          ),
        ),
        stateId,
      });
    const first = make(1),
      oldSender = new StateDeltaSender(),
      newSender = new StateDeltaSender(2),
      receiver = new StateDeltaReceiver();
    oldSender.encode(first, 1);
    oldSender.acknowledge(1);
    receiver.decode(JSON.parse(newSender.encode(first, 1)));
    newSender.acknowledge(1);
    w.time += 1 / 30;
    w.players[0].x += 0.03;
    w.players[0].z += 0.02;
    w.players[0].yaw += 0.01;
    w.players[1].x += 0.02;
    const full = make(2),
      oldWire = oldSender.encode(full, 2),
      newWire = newSender.encode(full, 2);
    expect(JSON.parse(oldWire).version).toBe(1);
    expect(JSON.parse(newWire).version).toBe(2);
    expect(receiver.decode(JSON.parse(newWire))).toEqual(JSON.parse(full));
    expect(bytes(newWire)).toBeLessThan(bytes(oldWire));
    console.info(
      JSON.stringify({
        playerFullBytes: bytes(full),
        playerV1Bytes: bytes(oldWire),
        playerV2Bytes: bytes(newWire),
      }),
    );
  });
  it("実ゲームを20step進めた全状態でv1/v2を復元し、同じACK順の合計通信量を測る", () => {
    const { w, ids, metadata } = denseWireFixture(10);
    // The fixture places boss worms without their required safe spawn path.
    w.enemies = w.enemies.filter((enemy) => enemy.kind !== "boss");
    const oldSender = new StateDeltaSender(),
      newSender = new StateDeltaSender(2),
      oldReceiver = new StateDeltaReceiver(),
      newReceiver = new StateDeltaReceiver();
    const make = (stateId: number) =>
      JSON.stringify({
        ...JSON.parse(
          prepareState(w, 0, metadata).packet(
            ids[0],
            false,
            stateId,
            undefined,
            true,
            true,
          ),
        ),
        stateId,
      });
    let oldBytes = 0,
      newBytes = 0,
      deltas = 0;
    for (let stateId = 1; stateId <= 21; stateId++) {
      if (stateId > 1) {
        const inputs = Object.fromEntries(
          ids.map((id, index) => [
            id,
            {
              ...neutral(),
              mx: index % 2 ? 1 : -1,
              mz: 0.5,
              yaw: index * 0.3,
              fire: index === 0,
              seq: stateId,
            },
          ]),
        );
        step(w, inputs, 0.05);
      }
      const full = make(stateId),
        expected = JSON.parse(full),
        oldWire = oldSender.encode(full, stateId),
        newWire = newSender.encode(full, stateId),
        oldMessage = JSON.parse(oldWire),
        newMessage = JSON.parse(newWire);
      expect(oldReceiver.decode(oldMessage)).toEqual(expected);
      expect(newReceiver.decode(newMessage)).toEqual(expected);
      if (newMessage.type === "stateDelta") {
        expect(newMessage.version).toBe(2);
        deltas++;
      }
      oldBytes += bytes(oldWire);
      newBytes += bytes(newWire);
      expect(oldSender.acknowledge(stateId)).toBe(true);
      expect(newSender.acknowledge(stateId)).toBe(true);
    }
    expect(deltas).toBeGreaterThan(0);
    expect(newBytes).toBeLessThan(oldBytes);
    console.info(
      JSON.stringify({ playerSteps: 20, oldBytes, newBytes, deltas }),
    );
  });
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
