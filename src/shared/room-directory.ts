export interface RoomOptions {
  name: string;
  listed: boolean;
  ruleset?: "front-v1";
  mode?: "survival" | "defense" | "daily";
}
export interface RoomListing {
  roomId: string;
  name: string;
  stage: number;
  players: number;
}
export interface DirectoryEntry extends RoomListing {
  ruleset?: "front-v1";
  mode?: "survival" | "defense" | "daily";
  code: string;
  listed: boolean;
  expires: number;
  updated: number;
  phase: string;
}
export function roomOptions(value: unknown): RoomOptions {
  const v =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const name =
    typeof v.name === "string"
      ? Array.from(v.name.replace(/[\u0000-\u001f\u007f]/g, "").trim())
          .slice(0, 24)
          .join("")
      : "";
  return {
    name: name || "協力部隊",
    listed: v.listed === true,
    ...(v.ruleset === "front-v1"
      ? {
          ruleset: "front-v1" as const,
          mode:
            v.mode === "defense" || v.mode === "daily"
              ? v.mode
              : ("survival" as const),
        }
      : {}),
  };
}
export function normalizeRoomId(value: string) {
  return value.normalize("NFKC").trim().toUpperCase();
}
export function visibleRooms(
  entries: DirectoryEntry[],
  now: number,
  ruleset?: "front-v1",
): RoomListing[] {
  return entries
    .filter(
      (e) =>
        e.listed &&
        e.ruleset === ruleset &&
        e.expires > now &&
        now - e.updated < 90000 &&
        e.phase === "lobby" &&
        e.players > 0 &&
        e.players < 4,
    )
    .sort((a, b) => b.updated - a.updated)
    .slice(0, 20)
    .map(({ roomId, name, stage, players }) => ({
      roomId,
      name,
      stage,
      players,
    }));
}
