import { it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { stripTypeScriptTypes } from "node:module";
import { denseWireFixture } from "./state-wire-fixture";
import { prepareState } from "../src/shared/state-wire";

it("固定状態の変更前・変更後の容量を測る", () => {
  const base = "7c33c877ff87e4ca18043d902c14bb316d7e3067";
  const source = execFileSync(
    "git",
    ["show", `${base}:src/shared/state-wire.ts`],
    { encoding: "utf8" },
  );
  const js =
    stripTypeScriptTypes(source).replace(/^export /gm, "") +
    "\nmodule.exports = { encodeState, prepareState };";
  const module = {
    exports: {} as {
      encodeState: (v: unknown) => string;
      prepareState: typeof prepareState;
    },
  };
  runInNewContext(js, { exports: module.exports, module, TextEncoder });
  const { w, ids, metadata } = denseWireFixture();
  const { pending, rewards, drops, front, ...rest } = w;
  const personal = {
    front: {
      ...front!,
      players: Object.fromEntries(
        Object.entries(front!.players).map(([owner, p]) => [
          owner,
          { ...p, statuses: owner === ids[0] ? p.statuses : {} },
        ]),
      ),
    },
    pending: { [ids[0]]: pending[ids[0]] ?? [] },
    rewards: { [ids[0]]: rewards[ids[0]] ?? [] },
    drops: drops.filter((d) => d.owner === ids[0]),
  };
  const raw = module.exports.encodeState({
    type: "state",
    equipmentCached: false,
    inputAck: -1,
    world: {
      ...rest,
      seed: 0,
      events: w.events.filter((e) => e.id > 0),
      ...personal,
    },
    ...metadata,
  });
  const oldPacket = module.exports.prepareState(w, 0, metadata).packet(ids[0]);
  const newPacket = prepareState(w, 0, metadata).packet(ids[0]);
  const bytes = (s: string) => new TextEncoder().encode(s).length;
  const times: number[] = [];
  for (let i = 0; i < 12; i++) {
    const start = performance.now();
    const state = prepareState(w, 0, metadata);
    for (const id of ids) state.packet(id);
    if (i >= 2) times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const omitted = JSON.parse(newPacket).omitted;
  const result = {
    base,
    players: 4,
    enemies: w.enemies.length,
    pleat: w.enemies.filter((e) => e.pleat).length,
    orbs: w.front!.orbs.length,
    projectiles: w.projectiles.length,
    events: w.events.length,
    beforeFull: bytes(raw),
    beforeAfterEventTrim: bytes(oldPacket),
    phase1: bytes(newPacket),
    omittedEnemies: omitted?.enemies.length ?? 0,
    omittedOrbs: omitted?.orbs.length ?? 0,
    fourRecipientsEncodeMsMedian: times[5],
    fourRecipientsEncodeMsMax: times.at(-1),
  };
  console.info(JSON.stringify(result));
  for (const count of [0, 40, 80, 100, 120, 140, 160]) {
    const fixture = denseWireFixture(count);
    const packet = JSON.parse(
      prepareState(fixture.w, 0, fixture.metadata).packet(fixture.ids[0]),
    );
    console.info(
      JSON.stringify({
        projectiles: count,
        omittedEnemies: packet.omitted?.enemies.length ?? 0,
        omittedOrbs: packet.omitted?.orbs.length ?? 0,
        events: packet.world.events.length,
      }),
    );
  }
  expect(result.beforeFull).toBeGreaterThan(65536);
  expect(result.phase1).toBeLessThanOrEqual(65536);
});
