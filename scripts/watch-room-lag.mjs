// Same short-lived tail protocol as Wrangler; only numeric anomaly rows leave memory.
import { WebSocket } from "ws";
import {
  readFileSync,
  appendFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import assert from "node:assert/strict";
import { numericLagRows, LAG_PREFIX } from "./lag-tail-filter.mjs";

const seconds = Math.min(1800, Math.max(15, Number(process.argv[2] ?? 600)));
assert(Number.isFinite(seconds));
const out = `dist-validation/lag-live-20261101/tail-${Date.now()}`;
mkdirSync(out, { recursive: true });
const state = {
  startedAt: new Date().toISOString(),
  connected: false,
  closed: false,
  messages: 0,
  records: 0,
  failed: false,
  cleanedUp: false,
};
const save = () =>
  writeFileSync(`${out}/status.json`, JSON.stringify(state, null, 2));
const token = /^oauth_token\s*=\s*"([^"]+)"/m.exec(
  readFileSync(
    join(homedir(), "AppData/Roaming/xdg.config/.wrangler/config/default.toml"),
    "utf8",
  ),
)?.[1];
assert(token);
const api = async (path, method = "GET", body) => {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    redirect: "error",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!response.ok || data.success === false)
    throw Error(`tail API HTTP ${response.status}`);
  return data.result;
};
let tail, tailPath;
try {
  const accounts = await api("/accounts");
  assert(accounts.length === 1);
  const path = `/accounts/${accounts[0].id}/workers/scripts/swarm-front/tails`;
  const created = await api(path, "POST", { filters: [{ query: LAG_PREFIX }] });
  tailPath = `${path}/${created.id}`;
  assert(new URL(created.url).protocol === "wss:");
  tail = new WebSocket(created.url, "trace-v1", {
    maxPayload: 5_000_000,
    handshakeTimeout: 30000,
  });
  await new Promise((resolve) => {
    const timeout = setTimeout(() => tail.close(), seconds * 1000);
    const force = setTimeout(() => tail.terminate(), (seconds + 5) * 1000);
    tail.on("open", () => {
      state.connected = true;
      tail.send(JSON.stringify({ debug: false }));
      save();
      console.log(JSON.stringify({ connected: true, out, seconds }));
    });
    tail.on("message", (buffer) => {
      state.messages++;
      try {
        for (const row of numericLagRows(JSON.parse(buffer.toString()))) {
          if (state.records >= 1000) break;
          appendFileSync(`${out}/lag.jsonl`, JSON.stringify(row) + "\n");
          state.records++;
        }
      } catch {
        state.failed = true;
      }
      save();
    });
    tail.on("error", () => {
      state.failed = true;
      save();
    });
    tail.on("close", (code) => {
      state.closed = true;
      state.closeCode = code;
      clearTimeout(timeout);
      clearTimeout(force);
      save();
      resolve();
    });
  });
} catch {
  state.failed = true;
  process.exitCode = 1;
} finally {
  tail?.terminate();
  if (tailPath) {
    try {
      await api(tailPath, "DELETE");
      state.cleanedUp = true;
    } catch {
      state.failed = true;
    }
  }
  save();
  console.log(JSON.stringify({ out, ...state }));
}
