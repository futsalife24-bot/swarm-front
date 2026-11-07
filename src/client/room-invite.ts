import { normalizeRoomId, validRoomId } from "../shared/room-directory";

/** 同じ設置先の招待だけを受け付け、貼り付けた接続先設定は採用しない。 */
export function parseRoomEntry(
  value: string,
  currentUrl: string,
  ruleset?: "front-v1",
): string {
  const text = value.trim();
  const id = normalizeRoomId(text);
  if (validRoomId(id) || /^[A-F0-9]{32}$/.test(id)) return id;
  try {
    const url = new URL(text);
    const current = new URL(currentUrl);
    if (
      url.origin !== current.origin ||
      url.pathname !== current.pathname ||
      url.username ||
      url.password
    )
      return "";
    const invitation = url.searchParams.get("frontRoom");
    if (
      ruleset === "front-v1" &&
      invitation &&
      validRoomId(normalizeRoomId(invitation))
    )
      return normalizeRoomId(invitation);
    return /^[a-f0-9]{32}$/.test(url.hash.slice(1))
      ? url.hash.slice(1).toUpperCase()
      : "";
  } catch {
    return "";
  }
}

/** 共有リンクに開発用設定や以前の招待を持ち込まない。 */
export function frontRoomInvite(currentUrl: string, roomId: string): string {
  if (!validRoomId(roomId)) return "";
  const url = new URL(currentUrl);
  url.search = "";
  url.hash = "";
  url.searchParams.set("frontRoom", roomId);
  return url.href;
}
