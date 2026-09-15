import { describe, expect, it } from "vitest";
import {
  CHAT_TEXT_LIMIT,
  PLAYER_NAME_LIMIT,
  isChatMessage,
  normalizeChatText,
  normalizePlayerName,
} from "../src/shared/social";

describe("shared lobby identity and chat validation", () => {
  it("normalizes Unicode and removes invisible controls and multiline spacing", () => {
    expect(normalizePlayerName("  メロン\u0000隊長\u202e  ")).toBe(
      "メロン 隊長",
    );
    expect(normalizeChatText("  か\u3099んばる\n\tよろしく  ")).toBe(
      "がんばる よろしく",
    );
    expect(normalizeChatText("\u200b\u2066\ufeff")).toBe("");
  });

  it("limits text by Unicode code point without splitting surrogate pairs", () => {
    expect(normalizePlayerName("😀".repeat(PLAYER_NAME_LIMIT + 1))).toBe(
      "😀".repeat(PLAYER_NAME_LIMIT),
    );
    expect(normalizeChatText("界".repeat(CHAT_TEXT_LIMIT + 1))).toBe(
      "界".repeat(CHAT_TEXT_LIMIT),
    );
  });

  it("rejects non-string inputs rather than turning them into display text", () => {
    for (const value of [undefined, null, 12, {}, [], true]) {
      expect(normalizePlayerName(value)).toBe("");
      expect(normalizeChatText(value)).toBe("");
    }
  });

  it("accepts canonical server messages and rejects malformed history entries", () => {
    const message = {
      id: "message",
      memberId: "member",
      name: "隊員",
      text: "よろしく",
      at: 1,
    };
    expect(isChatMessage(message)).toBe(true);
    for (const value of [
      null,
      {},
      { ...message, at: Number.NaN },
      { ...message, at: Number.POSITIVE_INFINITY },
      { ...message, memberId: 42 },
      { ...message, name: "" },
      { ...message, text: "" },
      { ...message, name: " 隊員" },
      { ...message, text: "改行\nあり" },
      { ...message, text: "x".repeat(CHAT_TEXT_LIMIT + 1) },
    ])
      expect(isChatMessage(value)).toBe(false);
  });
});
