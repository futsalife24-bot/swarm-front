import { readFileSync } from "node:fs";
export function localCreationKey() {
  const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
    readFileSync(".dev.vars", "utf8"),
  )?.[1];
  if (!key)
    throw new Error("Run npm run setup:local before local network tests.");
  return key;
}
