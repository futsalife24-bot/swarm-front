export const LAG_PREFIX = "ROOM_LAG_V1";
export const LAG_FIELDS = [
  "at",
  "reason",
  "slot",
  "phase",
  "tick",
  "pendingWrites",
  "droppedMs",
  "inFlight",
  "inputAgeMs",
  "ackAgeMs",
  "sendAgeMs",
  "oldestAgeMs",
  "inputsSinceOldest",
  "tickGapMs",
  "persistMs",
];

/** Never return the request, headers, script metadata, identity, or arbitrary log strings. */
export function numericLagRows(event) {
  const rows = [];
  for (const log of (Array.isArray(event?.logs) ? event.logs : []).slice(
    0,
    1000,
  )) {
    if (
      !Array.isArray(log?.message) ||
      log.message[0] !== LAG_PREFIX ||
      typeof log.message[1] !== "string" ||
      log.message[1].length > 4096
    )
      continue;
    try {
      const value = JSON.parse(log.message[1]);
      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        !LAG_FIELDS.every((key) => Number.isFinite(value[key]))
      )
        continue;
      if (![1, 2, 4, 8].includes(value.reason) || value.at < 0) continue;
      rows.push(Object.fromEntries(LAG_FIELDS.map((key) => [key, value[key]])));
    } catch {}
  }
  return rows;
}
