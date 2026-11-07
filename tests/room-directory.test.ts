import { it, expect } from "vitest";
import {
  roomOptions,
  availableRoomId,
  validRoomId,
  normalizeRoomId,
  visibleRooms,
  type DirectoryEntry,
} from "../src/shared/room-directory";
it("only exposes recruiting public rooms and never internal codes", () => {
  const base: DirectoryEntry = {
    code: "secret-code",
    roomId: "ABCDEF12",
    name: "部隊",
    players: 1,
    stage: 1,
    listed: true,
    expires: 200000,
    updated: 99999,
    phase: "lobby",
  };
  const rooms = visibleRooms(
    [
      base,
      { ...base, listed: false },
      { ...base, players: 4 },
      { ...base, players: 0 },
      { ...base, phase: "battle" },
      { ...base, updated: 0 },
      { ...base, expires: 10 },
    ],
    100000,
  );
  expect(rooms).toEqual([
    { roomId: "ABCDEF12", name: "部隊", players: 1, stage: 1 },
  ]);
  expect(
    visibleRooms(
      Array.from({ length: 25 }, () => base),
      100000,
    ),
  ).toHaveLength(20);
});
it("keeps legacy creations private and normalizes pasted room IDs", () => {
  expect(roomOptions({})).toEqual({ name: "協力部隊", listed: false });
  expect(roomOptions({ name: "\u0000 あいう ", listed: true })).toEqual({
    name: "あいう",
    listed: true,
  });
  expect(Array.from(roomOptions({ name: "🙂".repeat(30) }).name)).toHaveLength(
    24,
  );
  expect(normalizeRoomId(" ａｂ１２ｃｄ３４ ")).toBe("AB12CD34");
});

const entry = (roomId: string, expires = 200): DirectoryEntry => ({
  roomId,
  expires,
  code: roomId,
  name: "部隊",
  players: 1,
  stage: 1,
  listed: false,
  updated: 0,
  phase: "lobby",
});
it("new room IDs preserve three digits including leading zeroes", () => {
  expect(availableRoomId([], 100, () => 0)).toBe("000");
  expect(availableRoomId([], 100, () => 0.007)).toBe("007");
  expect(availableRoomId([], 100, () => 0.99999)).toBe("999");
  expect(normalizeRoomId(" ００７ ")).toBe("007");
  for (const id of ["000", "007", "999", "ABCDEF12"])
    expect(validRoomId(id)).toBe(true);
  for (const id of [
    "7",
    "07",
    "1000",
    "-07",
    "1.2",
    "ABC",
    "１２３",
    "abcdef12",
    "123\n",
  ])
    expect(validRoomId(id)).toBe(false);
});
it("allocation skips active IDs across public/private modes and wraps once", () => {
  const live = [
    entry("999"),
    { ...entry("000"), ruleset: "front-v1" as const, listed: true },
    entry("001", 100),
    entry("ABCDEF12"),
  ];
  expect(availableRoomId(live, 100, () => 0.999)).toBe("001");
  expect(live).toHaveLength(4);
});
it("all 1000 reservations produce a bounded full result without overwriting a room", () => {
  const all = Array.from({ length: 1000 }, (_, i) =>
    entry(String(i).padStart(3, "0")),
  );
  expect(availableRoomId(all, 100, () => 0.5)).toBeUndefined();
  all[7].expires = 100;
  expect(availableRoomId(all, 100, () => 0.5)).toBe("007");
  expect(
    availableRoomId(
      all.filter((e) => e.roomId !== "007"),
      100,
      () => 0.999,
    ),
  ).toBe("007");
});
