import { afterEach, describe, expect, it, vi } from "vitest";
import {
  denseWireFixture,
  populateDenseWireWorld,
} from "../scripts/state-wire-fixture";
import { createFrontRun, getFrontRunView } from "../src/shared/front-run";
import { encodeState, prepareState } from "../src/shared/state-wire";
import {
  restoreStateTuples,
  STATE_TUPLE_ENCODING,
} from "../src/shared/state-tuples";
import { StateOmissionCache } from "../src/client/state-omissions";
import { Network } from "../src/client/network";
import { FrontNetwork } from "../src/client/front-network";
import { bastionLanes } from "../src/shared/bastion";
import { mapFor } from "../src/shared/stages";

const bytes = (wire: string) => new TextEncoder().encode(wire).length;
function smallFixture() {
  const fixture = denseWireFixture(2);
  const { w } = fixture;
  w.enemies = [
    w.enemies[0],
    w.enemies.find((e) => e.kind === "bastion")!,
    w.enemies.find((e) => e.segments)!,
    w.enemies.find((e) => e.kind === "harrow")!,
  ];
  w.front!.orbs = w.front!.orbs.slice(0, 2);
  w.events = w.events.slice(0, 2);
  w.enemies[0].hp = 0.004;
  w.enemies[2].segments![0].partHp = 0.004;
  w.enemies[2].pulseAim = { x: 0.123456, z: 0.654321 };
  w.enemies[2].segments![1].pulseAim = { x: 1.123456, z: 2.654321 };
  const bastion = w.enemies[1];
  bastion.bastion!.volley = {
    x: 0,
    y: 1,
    z: 0,
    turn: 0.404987654321,
    count: 12,
  };
  const weapon = w.players[0].weapons[0];
  weapon.power = 1.237;
  weapon.rolls = { mag: 1.109, reload: 0.987 };
  w.pending[fixture.ids[0]] = [weapon];
  return fixture;
}
function packet(tuples = true, compact = false) {
  const { w, ids, metadata } = smallFixture();
  return JSON.parse(
    prepareState(w, 0, metadata).packet(
      ids[0],
      false,
      -1,
      undefined,
      true,
      tuples,
      false,
      compact,
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("丸め後の状態tuple", () => {
  it("従来wire値へ可逆で、PLEAT・HP保護・武器端数・角度ビット列を維持する", () => {
    const { w, ids, metadata } = smallFixture();
    const before = JSON.stringify(w);
    const prepared = prepareState(w, 0, metadata);
    const expected = JSON.parse(prepared.packet(ids[0]));
    const compact = JSON.parse(
      prepared.packet(ids[0], false, -1, undefined, true, true),
    );
    expect(compact.stateEncoding).toBe(STATE_TUPLE_ENCODING);
    expect(restoreStateTuples(compact)).toBe(true);
    expect(compact).toEqual(expected);
    expect(compact.world.enemies[0].hp).toBe(0.01);
    expect(compact.world.enemies[2].segments[0].partHp).toBe(0.01);
    expect(compact.world.players[0].weapons[0].power).toBe(1.237);
    expect(compact.world.pending[ids[0]][0].rolls).toEqual({
      mag: 1.109,
      reload: 0.987,
    });
    const cache = new StateOmissionCache();
    cache.restore(compact.world, compact.omitted);
    expect(compact.world.enemies[1].bastion.volley.turn).toBe(
      w.enemies[1].bastion!.volley!.turn,
    );
    expect(
      bastionLanes(compact.world.enemies[1].bastion.volley, mapFor(w).blocks),
    ).toEqual(bastionLanes(w.enemies[1].bastion!.volley!, mapFor(w).blocks));
    expect(JSON.stringify(w)).toBe(before);
  });

  it("次の受信者の準備で共通の敵・弾・オーブtupleを再JSON化しない", () => {
    const { w, ids, metadata } = smallFixture();
    const prepared = prepareState(w, 0, metadata);
    prepared.packet(ids[0], false, -1, undefined, true, true);
    const stringify = vi.spyOn(JSON, "stringify");
    try {
      prepared.packet(ids[1], false, -1, undefined, true, true);
      expect(
        stringify.mock.calls.some(
          ([value]) => Array.isArray(value) && typeof value[0] === "number",
        ),
      ).toBe(false);
    } finally {
      stringify.mockRestore();
    }
  });
  it.each([false, true])(
    "96敵・PLEAT48・4人・160オーブ・400弾で敵を省略せず容量内（装備cache=%s）",
    (equipmentCached) => {
      const { w, ids, metadata } = denseWireFixture(400);
      const before = JSON.stringify(w);
      const prepared = prepareState(w, 0, metadata);
      const reference = JSON.parse(
        prepareState({ ...w, front: undefined }, 0, metadata).packet(ids[0]),
      );
      for (const id of ids) {
        const wire = prepared.packet(
          id,
          equipmentCached,
          7,
          undefined,
          true,
          true,
        );
        const compact = JSON.parse(wire);
        expect(bytes(wire)).toBeLessThanOrEqual(65536);
        expect(compact.omitted?.enemies ?? []).toEqual([]);
        expect(restoreStateTuples(compact)).toBe(true);
        expect(compact.world.enemies).toEqual(reference.world.enemies);
        expect(compact.world.enemies).toHaveLength(96);
        expect(compact.world.enemies.filter((e: any) => e.pleat)).toHaveLength(
          48,
        );
        expect(compact.world.projectiles).toEqual(reference.world.projectiles);
        expect(compact.world.projectiles).toHaveLength(400);
        expect(compact.world.front.orbs).toEqual(
          JSON.parse(encodeState(w.front!.orbs)),
        );
        console.info(
          JSON.stringify({
            tupleBytes: bytes(wire),
            equipmentCached,
            enemies: compact.world.enemies.length,
            orbs: compact.world.front.orbs.length,
            projectiles: compact.world.projectiles.length,
            events: compact.world.events.length,
          }),
        );
      }
      expect(JSON.stringify(w)).toBe(before);
    },
  );

  it("400弾へ実frontView・時刻・最長名・31予告の合成余裕を足しても全数が届く", () => {
    const { ids, metadata } = denseWireFixture(400);
    const run = createFrontRun(
      {
        runId: "recipient-pressure",
        seed: 4520,
        mode: "survival",
        fusion: true,
        clearedStage: 10,
        returnAt: 1900003600,
        players: ids.map((id) => ({ id })),
      },
      1900000000,
    );
    populateDenseWireWorld(run.world, ids, 400);
    run.phase = "combat";
    // 通常のfrontView生成に、実戦より多めの予告を合成して余裕を測る。
    run.pendingSpawns = Array.from({ length: 10 }, (_, n) => ({
      x: n * 3.123456,
      z: n * -2.123456,
      at: 1900000001.5,
      kinds: ["ant", "spitter", "hornet"],
    }));
    run.pendingBoss = { x: 10, z: 10, at: 1900000001.5 };
    metadata.members.forEach((member) => {
      member.name = "隊".repeat(20);
    });
    const common = {
      ...metadata,
      clearedStage: 10,
      ruleset: "front-v1",
      mode: "survival",
    };
    const recipient = {
      frontView: getFrontRunView(run, ids[0]),
      serverNow: 1900000000.123,
      expiresAt: 1900003720000,
    };
    for (const equipmentCached of [false, true]) {
      const prepared = prepareState(run.world, 0, common);
      const wire = prepared.packet(
        ids[0],
        equipmentCached,
        99,
        recipient,
        true,
        true,
      );
      const message = JSON.parse(wire);
      expect(bytes(wire)).toBeLessThanOrEqual(65536);
      expect(restoreStateTuples(message)).toBe(true);
      expect(message.world.enemies).toHaveLength(96);
      expect(message.world.projectiles).toHaveLength(400);
      expect(message.world.front.orbs).toHaveLength(160);
      expect(message.frontView).toEqual(
        JSON.parse(encodeState(recipient.frontView)),
      );
      expect(message.omitted).toBeUndefined();
    }
    run.world.events = [];
    const noEvents = prepareState(run.world, 0, common).packet(
      ids[0],
      false,
      99,
      recipient,
      true,
      true,
    );
    expect(65536 - bytes(noEvents)).toBeGreaterThan(4096);
  });
  it("交渉前は従来形式、同じ準備の新旧送信順・装備cacheで符号列を混同しない", () => {
    const { w, ids, metadata } = smallFixture();
    const prepared = prepareState(w, 0, metadata);
    for (const tuples of [true, false, true, false])
      for (const cached of [false, true]) {
        const message = JSON.parse(
          prepared.packet(ids[0], cached, 8, undefined, true, tuples),
        );
        expect(message.stateEncoding).toBe(
          tuples ? STATE_TUPLE_ENCODING : undefined,
        );
        expect(restoreStateTuples(message)).toBe(true);
        expect(message.world.players[0].weapons === undefined).toBe(cached);
        expect(message.world.enemies.map((e: any) => e.id)).toEqual(
          w.enemies.map((e) => e.id),
        );
      }
  });

  it.each([
    [
      "マーカー欠落",
      (p: any) => {
        delete p.stateEncoding;
        delete p.stateOwners;
      },
    ],
    [
      "角度ビット破損",
      (p: any) => {
        const row = p.world.enemies.find((e: any[]) => e[2] === "bastion");
        row.find(
          (v: any) =>
            v && !Array.isArray(v) && typeof v === "object" && "armor" in v,
        ).volley.turnBits = [0];
      },
    ],
    [
      "owner表なし",
      (p: any) => {
        delete p.stateOwners;
      },
    ],
    [
      "owner表重複",
      (p: any) => {
        p.stateOwners.push(p.stateOwners[0]);
      },
    ],
    [
      "owner不正index",
      (p: any) => {
        p.world.projectiles[0][9] = 100;
      },
    ],
    [
      "owner負index",
      (p: any) => {
        p.world.projectiles[0][9] = -1;
      },
    ],
    [
      "不正版",
      (p: any) => {
        p.stateEncoding = "tuples-v2";
      },
    ],
    [
      "負のmask",
      (p: any) => {
        p.world.enemies[0][0] = -1;
      },
    ],
    [
      "範囲外mask",
      (p: any) => {
        p.world.enemies[0][0] = 2 ** 40;
      },
    ],
    [
      "欠落値",
      (p: any) => {
        p.world.projectiles[0].pop();
      },
    ],
    [
      "余分な値",
      (p: any) => {
        p.world.projectiles[0].push(0);
      },
    ],
    [
      "数値破損",
      (p: any) => {
        p.world.projectiles[0][2] = "bad";
      },
    ],
    [
      "PLEAT破損",
      (p: any) => {
        p.world.enemies[0][p.world.enemies[0].length - 1] = [
          63,
          [0, 0],
          [0, 1, 0],
          [0, 0, 1],
          [0, 0, 1],
          1,
          [],
        ];
      },
    ],
    [
      "オーブ破損",
      (p: any) => {
        p.world.front.orbs[0] = [31, 1];
      },
    ],
    [
      "大量敵",
      (p: any) => {
        p.world.enemies = Array.from({ length: 513 }, () => p.world.enemies[0]);
      },
    ],
    [
      "深い入れ子",
      (p: any) => {
        let v: any = 0;
        for (let n = 0; n < 20; n++) v = { next: v };
        p.world.extra = v;
      },
    ],
  ])("%sを例外なしで拒否し、途中復元しない", (_name, corrupt) => {
    const message = packet();
    corrupt(message);
    const before = structuredClone(message);
    expect(restoreStateTuples(message)).toBe(false);
    expect(message).toEqual(before);
  });

  it.each([Network, FrontNetwork])(
    "新クライアントは旧サーバー、tuple、省略cache、破損受信へ対応する: %s",
    (Class) => {
      vi.useFakeTimers();
      class Socket {
        readyState = 1;
        bufferedAmount = 0;
        sent: any[] = [];
        onopen?: () => void;
        onmessage?: (e: { data: string }) => void;
        send(wire: string) {
          this.sent.push(JSON.parse(wire));
        }
        close() {
          this.readyState = 3;
        }
        message(value: unknown) {
          this.onmessage?.({ data: JSON.stringify(value) });
        }
      }
      vi.stubGlobal("WebSocket", Socket);
      const network = new Class("http://localhost");
      const received: any[] = [];
      network.onWorld = (w) => received.push(w);
      try {
        network.connect("test");
        const ws = network.ws as unknown as Socket;
        ws.onopen?.();
        expect(ws.sent[0].stateTuples).toBe(1);
        expect(ws.sent[0].pleatPose).toBe(1);
        ws.message(packet(false));
        ws.message(packet());
        expect(received).toHaveLength(2);
        expect(received[1].enemies[1].bastion.volley.turn).toBe(0.404987654321);
        const omitted = packet();
        const enemyIds = received[1].enemies.map((e: any) => e.id);
        omitted.world.enemies = [];
        omitted.omitted = { enemies: enemyIds, orbs: [] };
        ws.message(omitted);
        expect(received[2].enemies.map((e: any) => e.id)).toEqual(enemyIds);
        const broken = packet();
        broken.world.projectiles[0].pop();
        expect(() => ws.message(broken)).not.toThrow();
        expect(received).toHaveLength(3);
        ws.message(packet(false));
        expect(received).toHaveLength(4);
        ws.message(packet(false, true));
        ws.message(packet(true, true));
        expect(received).toHaveLength(6);
        for (const w of received.slice(4)) {
          expect(w.enemies[0].pleat.feet).toBeUndefined();
          expect(w.enemies[0].pleat.body.x).toBe(w.enemies[0].x);
        }
      } finally {
        clearInterval(network.timer);
      }
    },
  );
});
