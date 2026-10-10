import { expect, it } from "vitest";
import { addPlayer, createWorld } from "../src/shared/game";
import { prepareState } from "../src/shared/state-wire";

it("keeps squad colours when the first player leaves and a replacement joins", () => {
  const world = createWorld("colours");
  for (const id of ["alpha", "bravo", "charlie", "delta"]) addPlayer(world, id);
  expect(world.players.map((p) => p.accentSlot)).toEqual([0, 1, 2, 3]);
  world.players = world.players.filter((p) => p.id !== "alpha");
  addPlayer(world, "echo");
  expect(
    Object.fromEntries(world.players.map((p) => [p.id, p.accentSlot])),
  ).toEqual({ bravo: 1, charlie: 2, delta: 3, echo: 0 });
  const received = JSON.parse(
    prepareState(world, 0, { members: [] }).packet("bravo"),
  ).world;
  received.players.reverse();
  expect(
    Object.fromEntries(
      received.players.map((p: { id: string; accentSlot: number }) => [
        p.id,
        p.accentSlot,
      ]),
    ),
  ).toEqual({ bravo: 1, charlie: 2, delta: 3, echo: 0 });
});

it("does not duplicate the slots occupied by legacy players", () => {
  const world = createWorld("legacy-colours");
  addPlayer(world, "alpha");
  addPlayer(world, "bravo");
  for (const p of world.players) delete p.accentSlot;
  expect(addPlayer(world, "charlie").accentSlot).toBe(2);
});
