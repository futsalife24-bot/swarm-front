const COOKIE = "swarm_developer";
const LIFE = 8 * 60 * 60 * 1000;
const WINDOW = 15 * 60 * 1000;
type State = {
  attempts: Record<string, { at: number; count: number }>;
  sessions: Record<string, number>;
  window: number;
  failures: number;
  credential: string;
};
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(n => n.toString(16).padStart(2, "0")).join("");
const reply = (body: unknown, status = 200, cookie?: string) => Response.json(body, {
  status, headers: { "Cache-Control": "no-store", ...(cookie ? { "Set-Cookie": cookie } : {}) },
});
function cookie(req: Request, token: string, seconds: number) {
  return `${COOKIE}=${token}; Path=/api/developer; HttpOnly; SameSite=Strict; Max-Age=${seconds}${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`;
}
async function smallJson(req: Request) {
  if (!req.headers.get("Content-Type")?.startsWith("application/json")) throw Error("body");
  const reader = req.body?.getReader();
  if (!reader) throw Error("body");
  const chunks: Uint8Array[] = []; let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 1024) { await reader.cancel(); throw Error("body"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes)) as { password?: unknown };
}

/** Called only inside the dedicated Gate object's concurrency lock. No gameplay access. */
export async function developerAuth(req: Request, storage: DurableObjectStorage, credential?: string) {
  const url = new URL(req.url), action = url.pathname.split("/").pop();
  if (!["session", "login", "logout"].includes(action ?? "")) return reply({ error: "見つかりません" }, 404);
  if (req.method !== (action === "session" ? "GET" : "POST")) return reply({ error: "操作が違います" }, 405);
  if (req.method === "POST" && req.headers.get("Origin") !== url.origin) return reply({ error: "接続元を確認してください" }, 403);
  const now = Date.now();
  const state = (await storage.get<State>("developer-auth")) ?? { attempts: {}, sessions: {}, window: now, failures: 0, credential: credential ?? "" };
  if (state.credential !== credential) { state.sessions = {}; state.credential = credential ?? ""; }
  for (const [key, expiry] of Object.entries(state.sessions)) if (expiry <= now) delete state.sessions[key];
  for (const [key, attempt] of Object.entries(state.attempts)) if (now - attempt.at >= WINDOW) delete state.attempts[key];
  if (now - state.window >= WINDOW) { state.window = now; state.failures = 0; }
  const token = req.headers.get("Cookie")?.split(";").map(s => s.trim()).find(s => s.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1) ?? "";
  const sessionKey = /^[a-f0-9]{64}$/.test(token) ? await digest(token) : "";
  if (action === "logout") {
    delete state.sessions[sessionKey];
    await storage.put("developer-auth", state);
    return reply({ ok: true }, 200, cookie(req, "", 0));
  }
  if (!credential || !/^[a-f0-9]{64}$/.test(credential)) return reply({ error: "開発者モードは準備中です" }, 503);
  if (action === "session") return reply({ authenticated: !!state.sessions[sessionKey] });
  const client = await digest(req.headers.get("CF-Connecting-IP") ?? "local");
  const attempt = state.attempts[client] ?? { at: now, count: 0 };
  if (attempt.count >= 5 || state.failures >= 100 || Object.keys(state.attempts).length >= 1000) return reply({ error: "試行回数が多いため、15分後に再試行してください" }, 429);
  let password: unknown;
  try { password = (await smallJson(req)).password; } catch { return reply({ error: "入力を確認してください" }, 400); }
  if (typeof password !== "string" || password.length < 1 || password.length > 256) return reply({ error: "入力を確認してください" }, 400);
  const supplied = await digest(password);
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= supplied.charCodeAt(i) ^ credential.charCodeAt(i);
  if (difference) {
    attempt.count++; state.attempts[client] = attempt; state.failures++;
    await storage.put("developer-auth", state);
    return reply({ error: "パスワードが違います" }, 401);
  }
  delete state.attempts[client];
  if (Object.keys(state.sessions).length >= 32) {
    const oldest = Object.keys(state.sessions).sort((a, b) => state.sessions[a] - state.sessions[b])[0];
    delete state.sessions[oldest];
  }
  const newToken = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
  state.sessions[await digest(newToken)] = now + LIFE;
  await storage.put("developer-auth", state);
  return reply({ authenticated: true }, 200, cookie(req, newToken, LIFE / 1000));
}
