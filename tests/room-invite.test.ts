import { describe, expect, it } from "vitest";
import { parseRoomEntry } from "../src/client/room-invite";

const code = "1234567890abcdef1234567890abcdef";
const base = "https://game.example/swarm-front/?coop=1";
describe("room invitation input", () => {
  it("accepts IDs, legacy codes and same-installation invitation links", () => {
    expect(parseRoomEntry(" abcd1234 ", base)).toBe("ABCD1234");
    expect(parseRoomEntry(code, base)).toBe(code.toUpperCase());
    expect(
      parseRoomEntry(`https://game.example/swarm-front/#${code}`, base),
    ).toBe(code.toUpperCase());
  });
  it("rejects other sites, other installation paths, credentials and malformed codes", () => {
    for (const value of [
      `https://other.example/swarm-front/#${code}`,
      `https://game.example/#${code}`,
      `https://user:pass@game.example/swarm-front/#${code}`,
      "javascript:alert(1)",
      "bad",
      `${base}#abcd1234`,
    ])
      expect(parseRoomEntry(value, base)).toBe("");
  });
});
