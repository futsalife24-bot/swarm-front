import { describe, expect, it } from "vitest";
import { frontRoomInvite, parseRoomEntry } from "../src/client/room-invite";

const code = "1234567890abcdef1234567890abcdef";
const base = "https://game.example/swarm-front/?coop=1";
describe("room invitation input", () => {
  it("改装版の共有リンクを貼り付けでき、開発用設定を共有しない", () => {
    const link = frontRoomInvite(
      `${base}&server=https://other.example/#old`,
      "ABCD1234",
    );
    expect(link).toBe("https://game.example/swarm-front/?frontRoom=ABCD1234");
    expect(parseRoomEntry(link, base, "front-v1")).toBe("ABCD1234");
    expect(parseRoomEntry(link, base)).toBe("");
    expect(frontRoomInvite(base, "接続中")).toBe("");
    for (const value of [
      "https://other.example/swarm-front/?frontRoom=ABCD1234",
      "https://game.example/other/?frontRoom=ABCD1234",
      "https://user:pass@game.example/swarm-front/?frontRoom=ABCD1234",
      `${base}&frontRoom=not-a-room`,
    ])
      expect(parseRoomEntry(value, base, "front-v1")).toBe("");
  });
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
