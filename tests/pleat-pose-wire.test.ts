import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { denseWireFixture } from "../scripts/state-wire-fixture";
import { encodeState, prepareState } from "../src/shared/state-wire";
import { restoreStateTuples } from "../src/shared/state-tuples";
import {
  StateDeltaReceiver,
  StateDeltaSender,
} from "../src/shared/state-delta";
import {
  StateChunkAssembler,
  encodeStateChunks,
} from "../src/shared/state-chunks";
import { enemySize } from "../src/shared/enemy-size";
import { createPleat, pleatContactFeet } from "../src/shared/pleat-locomotion";
import {
  addPlayer,
  blocked,
  createWorld,
  neutral,
  spawn,
  start,
  step,
} from "../src/shared/game";
import { LIMITS } from "../src/shared/defs";
import { mapFor } from "../src/shared/stages";

const size = (wire: string) => new TextEncoder().encode(wire).length;
// Actual decoder shipped before capability v1, rather than the new permissive reader.
const oldSource = execFileSync(
  "git",
  ["show", "51bda91:src/shared/state-tuples.ts"],
  { encoding: "utf8" },
);
const oldModule = { exports: {} as any };
new Function(
  "module",
  transformSync(oldSource, { loader: "ts", format: "cjs" }).code,
)(oldModule);
const oldExports = oldModule.exports;

const oldWireModule = { exports: {} as any };
new Function(
  "module",
  "require",
  transformSync(
    execFileSync("git", ["show", "51bda91:src/shared/state-wire.ts"], {
      encoding: "utf8",
    }),
    { loader: "ts", format: "cjs" },
  ).code,
)(oldWireModule, (name: string) => {
  if (name === "./state-tuples") return oldExports;
  if (name === "./pleat-locomotion") return { pleatContactFeet };
  throw new Error(`Unexpected legacy dependency ${name}`);
});

function fixture() {
  const f = denseWireFixture(2);
  f.w.events = [];
  for (const e of f.w.enemies)
    if (e.kind === "crawler") {
      const scale = enemySize(e);
      e.pleat = createPleat(
        { x: e.x, y: e.y, z: e.z },
        { x: 0, y: 0, z: 1 },
        scale,
        { ray: () => undefined },
      );
      e.pleat.body = { x: e.x, y: e.y + 0.8 * scale, z: e.z };
    }
  return f;
}
function packet(
  f: ReturnType<typeof fixture>,
  tuples: boolean,
  compact: boolean,
  id = 1,
) {
  return prepareState(f.w, 0, {}).packet(
    f.ids[0],
    false,
    0,
    { stateId: id },
    true,
    tuples,
    true,
    compact,
  );
}

describe("PLEAT pose negotiation", () => {
  it("preserves the welcome capability for the connection handshake", () => {
    const welcome = { type: "welcome", pleatPose: 1 };
    expect(restoreStateTuples(welcome)).toBe(true);
    expect(welcome.pleatPose).toBe(1);
  });
  it.each([false, true])(
    "keeps old recipients byte-identical and preserves combat fields (tuples=%s)",
    (tuples) => {
      const f = fixture(),
        before = JSON.stringify(f.w);
      const prepared = prepareState(f.w, 0, {});
      const oldWire = prepared.packet(
        f.ids[0],
        false,
        0,
        { stateId: 1 },
        true,
        tuples,
        true,
      );
      expect(oldWire).toBe(
        oldWireModule.exports
          .prepareState(f.w, 0, {})
          .packet(f.ids[0], false, 0, { stateId: 1 }, true, tuples, true),
      );
      const newWire = prepared.packet(
        f.ids[0],
        false,
        0,
        { stateId: 1 },
        true,
        tuples,
        true,
        true,
      );
      expect(
        prepared.packet(
          f.ids[0],
          false,
          0,
          { stateId: 1 },
          true,
          tuples,
          true,
          false,
        ),
      ).toBe(oldWire);
      expect(
        prepared.packet(
          f.ids[0],
          false,
          0,
          { stateId: 1 },
          true,
          tuples,
          true,
          true,
        ),
      ).toBe(newWire);
      const old = JSON.parse(oldWire),
        modern = JSON.parse(newWire);
      expect(oldExports.restoreStateTuples(old)).toBe(true);
      expect(restoreStateTuples(modern)).toBe(true);
      for (let i = 0; i < old.world.enemies.length; i++) {
        const a = old.world.enemies[i],
          b = modern.world.enemies[i];
        if (a.kind !== "crawler") {
          expect(b).toEqual(a);
          continue;
        }
        expect(a.pleat.feet).toHaveLength(4);
        expect(b.pleat.feet).toBeUndefined();
        expect(b.pleat.up).toEqual(a.pleat.up);
        expect(b.pleat.poseForward).toEqual(a.pleat.poseForward);
        expect(b.pleat.scale).toBe(enemySize(b));
        expect(Math.abs(b.pleat.body.y - a.pleat.body.y)).toBeLessThanOrEqual(
          0.011,
        );
        const { pleat: _a, ...combatA } = a,
          { pleat: _b, ...combatB } = b;
        expect(combatB).toEqual(combatA);
      }
      const { enemies: _a, ...restA } = old.world,
        { enemies: _b, ...restB } = modern.world;
      expect(restB).toEqual(restA);
      expect(JSON.stringify(f.w)).toBe(before);
      expect(size(newWire)).toBeLessThan(size(oldWire));
    },
  );

  it("restores floor, wall and ceiling poses across authored sizes", () => {
    for (const up of [
      { x: 0, y: 1, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: -1, z: 0 },
    ])
      for (const size of [0.8, 1, 1.75, 2]) {
        const f = fixture();
        const e = f.w.enemies[0];
        e.size = size;
        e.pleat!.scale = enemySize(e);
        e.pleat!.up = up;
        e.pleat!.body = { x: e.x, y: e.y + 0.8 * enemySize(e), z: e.z };
        for (const tuples of [false, true]) {
          const decoded = JSON.parse(packet(f, tuples, true));
          expect(restoreStateTuples(decoded)).toBe(true);
          expect(decoded.world.enemies[0].pleat.up).toEqual(up);
          expect(decoded.world.enemies[0].pleat.scale).toBe(enemySize(e));
        }
      }
  });

  it("does not compute legacy feet for a new-only broadcast", () => {
    const f = fixture();
    for (const e of f.w.enemies)
      if (e.pleat)
        Object.defineProperty(e.pleat, "feet", {
          get() {
            throw new Error("legacy feet accessed");
          },
        });
    expect(() => packet(f, true, true)).not.toThrow();
    expect(() => packet(f, true, false)).toThrow("legacy feet accessed");
  });

  it.each([false, true])(
    "round-trips delta, chunks, two outstanding states and a reconnect (compact=%s)",
    (compact) => {
      const f = fixture(),
        sender = new StateDeltaSender(),
        receiver = new StateDeltaReceiver(),
        chunks = new StateChunkAssembler();
      let sawDelta = false;
      for (let id = 1; id <= 6; id++) {
        f.w.enemies[0].x += 0.12;
        const full = packet(f, true, compact, id),
          wire = sender.encode(full, id);
        sawDelta ||= JSON.parse(wire).type === "stateDelta";
        const frames = encodeStateChunks(wire, id)!;
        expect(frames).toBeDefined();
        let assembled: unknown;
        for (const frame of frames) assembled = chunks.read(frame);
        const decoded: any = receiver.decode(assembled),
          expected = JSON.parse(full);
        expect(decoded).toEqual(expected);
        expect(restoreStateTuples(decoded)).toBe(true);
        expect(restoreStateTuples(expected)).toBe(true);
        expect(decoded).toEqual(expected);
        decoded.world.enemies[0].pleat.body.x = 999; // must not mutate the delta baseline
        if (id % 2 === 0) expect(sender.acknowledge(id)).toBe(true);
      }
      expect(sawDelta).toBe(true);
      sender.reset();
      receiver.reset();
      const first = sender.encode(packet(f, true, compact, 7), 7);
      expect(JSON.parse(first).type).toBe("state");
      expect(restoreStateTuples(receiver.decode(JSON.parse(first)))).toBe(true);
    },
  );

  it("rejects missing/versioned markers and malformed compact poses without partial restoration", () => {
    const f = fixture();
    for (const mutate of [
      (p: any) => delete p.pleatPose,
      (p: any) => (p.pleatPose = 2),
      (p: any) => (p.world.enemies[1].pleat = [0, 1, 0, 0, 1]),
      (p: any) => (p.world.enemies[1].pleat = [0, 1, 0, 0, "x", 1]),
      (p: any) => (p.world.enemies[1].pleat = [0, 0, 0, 0, 0, 1]),
      (p: any) => (p.world.enemies[1].size = -1),
    ]) {
      const p = JSON.parse(packet(f, false, true));
      mutate(p);
      const before = structuredClone(p);
      expect(restoreStateTuples(p)).toBe(false);
      expect(p).toEqual(before);
    }
    const tuple = JSON.parse(packet(f, true, true));
    delete tuple.pleatPose;
    expect(restoreStateTuples(tuple)).toBe(false);
  });
});

it("measures old/new JSON, tuples and delta against the same 96-PLEAT simulation", () => {
  const w = createWorld("pleat-wire", 11, 1),
    p = addPlayer(w, "fixture-player")!;
  start(w);
  w.enemies = [];
  w.nextSpawn = 1e9;
  p.hp = 1000000;
  const blocks = mapFor(w).blocks;
  const originalLimit = LIMITS.enemies;
  LIMITS.enemies = 96;
  try {
    for (let ring = 0; w.enemies.length < 96 && ring < 40; ring++) {
      for (let k = 0; k < 24 && w.enemies.length < 96; k++) {
        const a = (k / 24) * Math.PI * 2 + ring * 0.37,
          r = 14 + ring * 2;
        const x = Math.sin(a) * r,
          z = Math.cos(a) * r;
        if (!blocked(x, z, 2.5, 0, blocks)) {
          const e = spawn(w, "crawler", x, z)!;
          e.active = true;
        }
      }
    }
  } finally {
    LIMITS.enemies = originalLimit;
  }
  expect(w.enemies).toHaveLength(96);
  const rows = [false, true].flatMap((tuples) =>
    [false, true].map((compact) => ({
      tuples,
      compact,
      packets: 0,
      fullBytes: 0,
      framedBytes: 0,
      lastFullBytes: 0,
      sender: new StateDeltaSender(),
      receiver: new StateDeltaReceiver(),
    })),
  );
  let maxBodyDifference = 0;
  for (let tick = 0; tick < 400; tick++) {
    step(w, {
      [p.id]: {
        ...neutral(),
        mx: Math.cos(tick * 0.05),
        mz: Math.sin(tick * 0.05),
        seq: tick,
      },
    });
    if (tick % 2) continue;
    const prepared = prepareState(w, 0, {}),
      id = tick / 2 + 1;
    for (const row of rows) {
      const full = prepared.packet(
        p.id,
        false,
        tick,
        { stateId: id },
        true,
        row.tuples,
        true,
        row.compact,
      );
      row.packets++;
      row.fullBytes += size(full);
      row.lastFullBytes = size(full);
      const wire = row.tuples ? row.sender.encode(full, id) : full;
      row.framedBytes += encodeStateChunks(wire, id)!.reduce(
        (sum, frame) => sum + size(frame),
        0,
      );
      const decoded: any = row.tuples
        ? row.receiver.decode(JSON.parse(wire))
        : JSON.parse(wire);
      expect(restoreStateTuples(decoded)).toBe(true);
      expect(decoded.world.enemies).toHaveLength(96);
      if (row.tuples) row.sender.acknowledge(id);
      if (row.compact)
        for (const enemy of decoded.world.enemies) {
          const real = w.enemies.find((e) => e.id === enemy.id)!;
          const delta = Math.hypot(
            enemy.pleat.body.x - real.pleat!.body.x,
            enemy.pleat.body.y - real.pleat!.body.y,
            enemy.pleat.body.z - real.pleat!.body.z,
          );
          maxBodyDifference = Math.max(maxBodyDifference, delta);
        }
    }
  }
  expect(maxBodyDifference).toBeLessThan(0.02);
  for (const tuples of [false, true]) {
    const old = rows.find((r) => r.tuples === tuples && !r.compact)!,
      modern = rows.find((r) => r.tuples === tuples && r.compact)!;
    expect(modern.fullBytes).toBeLessThan(old.fullBytes);
    expect(modern.framedBytes).toBeLessThan(old.framedBytes);
  }
  if (process.env.PLEAT_WIRE_MEASURE === "1") {
    const dir = "docs/evidence/pleat-pose-wire-20261101";
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      `${dir}/measurements.json`,
      JSON.stringify(
        {
          seed: 11,
          enemies: 96,
          ticks: 400,
          snapshotHz: 10,
          durationSeconds: 20,
          maxBodyDifference,
          conditions:
            "Same authority simulation for all recipients; full equipment; uncompressed UTF-8 application bytes. Tuple streams include ACK-every-state delta and chunk framing. Not real-network latency or smartphone performance.",
          rows: rows.map(({ sender, receiver, ...r }) => r),
        },
        null,
        2,
      ) + "\n",
    );
  }
}, 60000);
