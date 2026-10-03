import { describe, expect, it } from "vitest";
import {
  createRebuildRun,
  chooseRebuildUpgrade,
  stepRebuildRun,
} from "../src/shared/rebuild-run";
import { neutral } from "../src/shared/game";
import {
  createRebuildUiGate,
  acceptRebuildKeydown,
  formatRebuildTime,
  pauseRebuildUi,
  readonlyRebuildSnapshot,
  rebuildUiActive,
  resumeRebuildUi,
  tickRebuildUi,
} from "../src/client/rebuild-ui-state";

describe("P1a presentation pause boundary", () => {
  it("never enables combat under selection, pause, hidden document or resume cue", () => {
    const gate = createRebuildUiGate();
    expect(rebuildUiActive(gate, "selection")).toBe(false);
    expect(rebuildUiActive(gate, "combat", true)).toBe(false);
    expect(rebuildUiActive(gate, "combat")).toBe(true);
    pauseRebuildUi(gate, "blur");
    expect(rebuildUiActive(gate, "combat")).toBe(false);
    resumeRebuildUi(gate, true);
    expect(rebuildUiActive(gate, "combat")).toBe(false);
    expect(tickRebuildUi(gate, 0.6)).toBe(false);
    expect(tickRebuildUi(gate, 0.4)).toBe(true);
    expect(rebuildUiActive(gate, "combat")).toBe(true);
    expect(tickRebuildUi(gate, 1)).toBe(false);
    expect(rebuildUiActive(gate, "victory")).toBe(false);
    expect(rebuildUiActive(gate, "defeat")).toBe(false);
  });
  it("interrupts a resume safely, and returns to selection without starting combat", () => {
    const gate = createRebuildUiGate();
    resumeRebuildUi(gate, true);
    tickRebuildUi(gate, 0.5);
    pauseRebuildUi(gate, "hidden");
    expect(tickRebuildUi(gate, 60)).toBe(false);
    resumeRebuildUi(gate, true);
    expect(gate.resumeRemaining).toBe(1);
    pauseRebuildUi(gate, "menu");
    resumeRebuildUi(gate, false);
    expect(gate.resumeRemaining).toBe(0);
    expect(rebuildUiActive(gate, "selection")).toBe(false);
  });
  it("ignores invalid timer deltas", () => {
    const gate = createRebuildUiGate();
    resumeRebuildUi(gate, true);
    for (const delta of [NaN, Infinity, -1, 0])
      expect(tickRebuildUi(gate, delta)).toBe(false);
    expect(gate.resumeRemaining).toBe(1);
  });
  it("returns detached, deeply immutable diagnostics without changing the run", () => {
    const source = { player: { hp: 160 }, offer: ["a", "b", "c"] };
    const result = readonlyRebuildSnapshot(source);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.player)).toBe(true);
    expect(Object.isFrozen(result.offer)).toBe(true);
    source.player.hp = 10;
    expect(result.player.hp).toBe(160);
    expect(() => result.offer.push("d")).toThrow();
  });
  it("formats only finite nonnegative combat times", () => {
    expect(formatRebuildTime(345.8)).toBe("5:45");
    expect(formatRebuildTime(60)).toBe("1:00");
    expect(formatRebuildTime(NaN)).toBe("0:00");
    expect(formatRebuildTime(-1)).toBe("0:00");
  });
});

describe("P1a held-key resume boundary", () => {
  it.each([
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "KeyR",
    "KeyQ",
    "Space",
    "KeyF",
    "KeyZ",
    "KeyE",
  ])("suppresses %s repeats after reset until a fresh keydown", (code) => {
    const keys = new Set<string>();
    const keydown = (repeat: boolean) => {
      if (acceptRebuildKeydown(code, repeat, keys)) keys.add(code);
    };
    keydown(false);
    expect(keys.has(code)).toBe(true);
    keys.clear();
    for (let i = 0; i < 5; i++) keydown(true);
    expect(keys.has(code)).toBe(false);
    keys.delete(code);
    keydown(false);
    expect(keys.has(code)).toBe(true);
    keydown(true);
    expect(keys.has(code)).toBe(true);
  });
  it("keeps actual soldier position still under stale W repeats, then moves on a fresh press", () => {
    const run = createRebuildRun({ runId: "held-key-position" });
    chooseRebuildUpgrade(run, "blast-core");
    const keys = new Set<string>();
    const keydown = (repeat: boolean) => {
      if (acceptRebuildKeydown("KeyW", repeat, keys)) keys.add("KeyW");
    };
    const tick = () =>
      stepRebuildRun(run, { ...neutral(), mz: keys.has("KeyW") ? 1 : 0 });
    keydown(false);
    tick();
    const p = run.world.players[0],
      before = { x: p.x, z: p.z };
    keys.clear();
    for (let i = 0; i < 10; i++) {
      keydown(true);
      tick();
    }
    expect({ x: p.x, z: p.z }).toEqual(before);
    keys.delete("KeyW");
    keydown(false);
    tick();
    expect(p.z).not.toBe(before.z);
  });
  it("does not intercept navigation and pause shortcuts", () => {
    expect(acceptRebuildKeydown("Escape", true, new Set())).toBe(true);
    expect(acceptRebuildKeydown("Tab", true, new Set())).toBe(true);
  });
});
