import { it, expect } from "vitest";
import {
  roomOptions,
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
