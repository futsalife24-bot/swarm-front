import { normalizeRoomId } from "../shared/room-directory";

/** Accept only this installation's links; never use pasted server/query settings. */
export function parseRoomEntry(value: string, currentUrl: string): string {
  const text = value.trim();
  const id = normalizeRoomId(text);
  if (/^(?:[A-F0-9]{8}|[A-F0-9]{32})$/.test(id)) return id;
  try {
    const url = new URL(text);
    const current = new URL(currentUrl);
    if (
      url.origin !== current.origin ||
      url.pathname !== current.pathname ||
      url.username ||
      url.password ||
      !/^[a-f0-9]{32}$/.test(url.hash.slice(1))
    )
      return "";
    return url.hash.slice(1).toUpperCase();
  } catch {
    return "";
  }
}
