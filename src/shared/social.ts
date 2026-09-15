export const DEFAULT_PLAYER_NAME = "隊員";
export const PLAYER_NAME_LIMIT = 20;
export const CHAT_TEXT_LIMIT = 200;
export const CHAT_HISTORY_LIMIT = 50;
export interface ChatMessage {
  id: string;
  memberId: string;
  name: string;
  text: string;
  at: number;
}
function clean(value: unknown, limit: number): string {
  if (typeof value !== "string") return "";
  return Array.from(
    value
      .normalize("NFC")
      .replace(
        /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g,
        " ",
      )
      .replace(/\s+/g, " ")
      .trim(),
  )
    .slice(0, limit)
    .join("")
    .trim();
}
export const normalizePlayerName = (value: unknown): string =>
  clean(value, PLAYER_NAME_LIMIT);
export const normalizeChatText = (value: unknown): string =>
  clean(value, CHAT_TEXT_LIMIT);
export function isChatMessage(value: unknown): value is ChatMessage {
  const m = value as ChatMessage | null;
  return (
    !!m &&
    typeof m.id === "string" &&
    typeof m.memberId === "string" &&
    typeof m.at === "number" &&
    Number.isFinite(m.at) &&
    typeof m.name === "string" &&
    !!m.name &&
    normalizePlayerName(m.name) === m.name &&
    typeof m.text === "string" &&
    !!m.text &&
    normalizeChatText(m.text) === m.text
  );
}
