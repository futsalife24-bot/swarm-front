import { expect, it } from "vitest";
import { CombatAudio } from "../src/client/combat-audio";
import { event, type World } from "../src/shared/game";
import * as front from "../src/shared/front-run";
import * as legacy from "../src/shared/front-legacy-run";
import * as rebuild from "../src/shared/rebuild-run";
import { prepareState } from "../src/shared/state-wire";

function check(w: World, audio: CombatAudio, radius: number) {
  const arrivals = w.events.filter(
    (e) => e.type === "burst" && e.radius === radius,
  );
  expect(arrivals.length).toBeGreaterThan(0);
  expect(arrivals.every((e) => e.silent === true)).toBe(true);
  const received = JSON.parse(
    prepareState(w, 0, { serverNow: 0 }).packet(w.players[0].id),
  ).world;
  expect(
    received.events.filter((e: { silent?: boolean }) => e.silent),
  ).toHaveLength(arrivals.length);
  expect(audio.collect(received)).toEqual([]);
  expect(audio.consumed(w.run)).toBe(w.events.at(-1)!.id);
  // A real combat burst at the same radius must still be audible.
  event(w, { type: "burst", radius, x: 0, y: 0, z: 0 });
  expect(audio.collect(w).map((cue) => cue.type)).toEqual(["burst"]);
  expect(audio.collect(w)).toEqual([]);
}

it.each([false, true])(
  "current front arrival stays visible but silent (boss=%s)",
  (boss) => {
    const run = front.createFrontRun({
      runId: "arrival-front",
      seed: 42,
      fusion: true,
      players: [{ id: "p" }],
    });
    const offer = run.upgrades.p.offer!;
    expect(
      front.chooseFrontUpgrade(
        run,
        "p",
        {
          runId: run.world.run,
          offerId: offer.id,
          revision: offer.revision,
          requestId: "arrival-choice",
          cardId: offer.defaultCardId,
        },
        0,
      ),
    ).toBe(true);
    run.resumeUntil = 0;
    run.finalResupplyDone = boss;
    if (boss) run.nextSpawnAt = Infinity;
    const audio = new CombatAudio();
    audio.collect(run.world);
    front.stepFrontRun(run, {}, 0.05, 10);
    if (boss) {
      run.world.time += 2;
      front.stepFrontRun(run, {}, 0.05, 12);
      expect(run.bossId).not.toBeNull();
    }
    check(run.world, audio, boss ? 8 : 2);
  },
);

it.each([false, true])(
  "legacy front arrival stays visible but silent (boss=%s)",
  (boss) => {
    const run = legacy.createFrontRun({
      runId: "arrival-legacy",
      seed: 42,
      players: [{ id: "p" }],
    });
    const offer = run.upgrades.p.offer!;
    expect(
      legacy.chooseFrontUpgrade(
        run,
        "p",
        {
          runId: run.world.run,
          offerId: offer.id,
          revision: offer.revision,
          requestId: "arrival-choice",
          cardId: offer.defaultCardId,
        },
        0,
      ),
    ).toBe(true);
    run.resumeUntil = 0;
    run.finalResupplyDone = boss;
    if (boss) run.nextSpawnAt = Infinity;
    const audio = new CombatAudio();
    audio.collect(run.world);
    legacy.stepFrontRun(run, {}, 0.05, 10);
    if (boss) {
      run.world.time += 2;
      legacy.stepFrontRun(run, {}, 0.05, 12);
      expect(run.bossId).not.toBeNull();
    }
    check(run.world, audio, boss ? 8 : 2);
  },
);

it.each([false, true])(
  "rebuild arrival stays visible but silent (boss=%s)",
  (boss) => {
    const run = rebuild.createRebuildRun({
      runId: "arrival-rebuild",
      seed: 42,
    });
    const audio = new CombatAudio();
    audio.collect(run.world);
    run.finalResupplyDone = boss;
    expect(
      rebuild.chooseRebuildUpgrade(run, run.upgrades.offer!.defaultCardId),
    ).toBe(true);
    if (!boss) rebuild.stepRebuildRun(run);
    else expect(run.bossId).not.toBeNull();
    check(run.world, audio, boss ? 8 : 2);
  },
);
