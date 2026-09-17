import { japanDay, japanWeek } from "../src/shared/calendar";
import { beginDefense, type DefenseSave } from "../src/shared/daily-rewards";
import {
  recordWeekly,
  claimWeekly,
  type WeeklyProgress,
} from "../src/shared/weekly-missions";

export const cloudReply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function cloudHash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
}
export async function cloudBody(req: Request) {
  if (!req.headers.get("Content-Type")?.startsWith("application/json"))
    throw Error("JSONが必要です");
  const reader = req.body?.getReader();
  if (!reader) throw Error("保存データがありません");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 1_048_576) {
      await reader.cancel();
      throw Error("保存データは1MBまでです");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}
// The vault is a backup, not an authority proving legitimately earned equipment.
export function validCloudSave(
  value: unknown,
): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const s = value as Record<string, unknown>;
  return (
    s.version === 2 &&
    s.mode === "normal" &&
    !!s.missions &&
    typeof s.missions === "object" &&
    !Array.isArray(s.missions) &&
    ["inventory", "pending", "soldiers", "receipts"].every((k) =>
      Array.isArray(s[k]),
    ) &&
    ["coins", "points", "materials", "powder", "serial"].every(
      (k) => Number.isSafeInteger(s[k]) && Number(s[k]) >= 0,
    )
  );
}
interface Vault {
  credential: string;
  version: number;
  updatedAt: number;
  save: Record<string, unknown>;
  lastMutation: string;
  daily?: { day: string; run: string; startedAt: number };
}
interface VaultStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  deleteAll(): Promise<void>;
}
/** Store the bounded save as one atomic SQLite row, avoiding KV's per-value limit. */
export function sqlVaultStorage(storage: DurableObjectStorage): VaultStorage {
  storage.sql.exec(
    "CREATE TABLE IF NOT EXISTS player_vault (id INTEGER PRIMARY KEY CHECK(id = 1), payload TEXT NOT NULL)",
  );
  return {
    async get<T>() {
      const row = storage.sql
        .exec<{ payload: string }>(
          "SELECT payload FROM player_vault WHERE id = 1",
        )
        .toArray()[0];
      return row ? (JSON.parse(row.payload) as T) : undefined;
    },
    async put(_key, value) {
      storage.sql.exec(
        "INSERT INTO player_vault (id, payload) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
        JSON.stringify(value),
      );
    },
    async deleteAll() {
      storage.sql.exec("DELETE FROM player_vault");
    },
  };
}
export async function playerVault(
  req: Request,
  storage: VaultStorage,
  initialize = false,
  now = Date.now(),
) {
  const action = new URL(req.url).pathname.split("/").pop();
  const token = req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  if (!/^[a-f0-9]{64}$/.test(token))
    return cloudReply({ error: "引き継ぎコードを確認してください" }, 401);
  const credential = await cloudHash(token);
  let state = await storage.get<Vault>("vault");
  if (initialize) {
    if (state) return cloudReply({ error: "既に作成されています" }, 409);
    const body = await cloudBody(req);
    if (!validCloudSave(body.save))
      return cloudReply({ error: "通常プレイの保存が必要です" }, 400);
    state = {
      credential,
      version: 1,
      updatedAt: now,
      save: body.save,
      lastMutation: "",
    };
    await storage.put("vault", state);
  } else if (!state || state.credential !== credential) {
    return cloudReply({ error: "引き継ぎコードを確認してください" }, 401);
  }
  if (!state) return cloudReply({ error: "保存がありません" }, 404);
  const result = () =>
    cloudReply({
      version: state!.version,
      updatedAt: state!.updatedAt,
      save: state!.save,
      serverNow: now,
      day: japanDay(now),
      week: japanWeek(now),
      daily: state!.daily ?? null,
    });
  if (initialize || req.method === "GET") return result();
  if (action === "delete" && req.method === "POST") {
    await storage.deleteAll();
    return cloudReply({ ok: true });
  }
  if (req.method !== "POST")
    return cloudReply({ error: "操作が違います" }, 405);
  const body = await cloudBody(req);
  if (action === "daily") {
    if (typeof body.run !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(body.run))
      return cloudReply({ error: "作戦IDが不正です" }, 400);
    if (state.daily?.run === body.run) return result();
    if (state.daily?.day === japanDay(now)) {
      return cloudReply(
        { error: "今日の挑戦権は使用済みです", daily: state.daily },
        409,
      );
    }
    if (body.day !== japanDay(now))
      return cloudReply(
        { error: "日付が更新されました。確認し直してください" },
        409,
      );
    if (body.version !== state.version)
      return cloudReply(
        { error: "別端末の進行が更新されています", conflict: true },
        409,
      );
    if (
      (state.save.pending as unknown[]).length ||
      (state.save.result as { choice?: string } | undefined)?.choice ===
        "pending"
    )
      return cloudReply(
        { error: "戦果の受取りと武器庫の整理を完了してください" },
        409,
      );
    const rng = () =>
      crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
    const granted = beginDefense(
      state.save as unknown as DefenseSave,
      japanDay(now),
      body.run,
      rng,
    );
    state.save = recordWeekly(
      granted as DefenseSave & { coins: number },
      "defense",
      body.run,
      now,
    ) as unknown as Record<string, unknown>;
    state.daily = { day: japanDay(now), run: body.run, startedAt: now };
    state.version++;
    state.updatedAt = now;
    await storage.put("vault", state);
    return result();
  }
  if (action === "weekly") {
    if (body.version !== state.version)
      return cloudReply(
        { error: "別端末の進行が更新されています", conflict: true },
        409,
      );
    if (typeof body.id !== "string")
      return cloudReply({ error: "ミッションを選んでください" }, 400);
    state.save = claimWeekly(
      state.save as { coins: number; weekly?: WeeklyProgress },
      body.id,
      now,
    );
    state.version++;
    state.updatedAt = now;
    await storage.put("vault", state);
    return result();
  }
  if (
    action !== "save" ||
    !validCloudSave(body.save) ||
    typeof body.mutation !== "string" ||
    !/^[a-f0-9-]{36}$/.test(body.mutation)
  )
    return cloudReply({ error: "保存形式が不正です" }, 400);
  if (state.lastMutation === body.mutation) return result();
  if (!Number.isSafeInteger(body.version) || body.version !== state.version)
    return cloudReply(
      {
        error: "別端末の進行が更新されています",
        conflict: true,
        version: state.version,
        updatedAt: state.updatedAt,
      },
      409,
    );
  const pending = body.save.weeklyPending;
  const receivedReceipts = body.save.receipts as unknown[];
  if (
    pending !== undefined &&
    (!Array.isArray(pending) ||
      pending.length > 128 ||
      !pending.every(
        (id) => typeof id === "string" && receivedReceipts.includes(id),
      ))
  )
    return cloudReply({ error: "週間実績の形式が不正です" }, 400);
  let incoming = { ...body.save, weekly: state.save.weekly } as {
    coins: number;
    weekly?: WeeklyProgress;
  } & Record<string, unknown>;
  for (const run of (pending ?? []) as string[]) {
    if (!(state.save.receipts as unknown[]).includes(run))
      incoming = recordWeekly(incoming, "campaign", run, now);
  }
  incoming.weeklyPending = [];
  state.save = incoming;
  state.version++;
  state.updatedAt = now;
  state.lastMutation = body.mutation;
  // Keep the admission separate from uploaded progress, so a save rollback cannot
  // buy another attempt. A delayed retry can still fetch the already granted item.
  await storage.put("vault", state);
  return result();
}

export async function cloudAdmission(
  req: Request,
  storage: DurableObjectStorage,
  now = Date.now(),
) {
  const day = japanDay(now);
  const key = await cloudHash(req.headers.get("CF-Connecting-IP") ?? "local");
  const saved = await storage.get<{
    day: string;
    count: number;
    clients: Record<string, number>;
  }>("cloud-admission");
  const state = saved?.day === day ? saved : { day, count: 0, clients: {} };
  if (state.count >= 100 || (state.clients[key] ?? 0) >= 5)
    return cloudReply({ error: "作成回数の上限です。翌日お試しください" }, 429);
  state.count++;
  state.clients[key] = (state.clients[key] ?? 0) + 1;
  await storage.put("cloud-admission", state);
  return cloudReply({ ok: true });
}

export async function cloudRateLimit(
  req: Request,
  storage: DurableObjectStorage,
  now = Date.now(),
) {
  const day = japanDay(now),
    window = Math.floor(now / 60000);
  const key = await cloudHash(req.headers.get("CF-Connecting-IP") ?? "local");
  const saved = await storage.get<{
    day: string;
    total: number;
    window: number;
    clients: Record<string, number>;
  }>("cloud-rate");
  const state =
    saved?.day === day ? saved : { day, total: 0, window, clients: {} };
  if (state.window !== window) {
    state.window = window;
    state.clients = {};
  }
  if (
    state.total >= 20000 ||
    (state.clients[key] ?? 0) >= 60 ||
    (!state.clients[key] && Object.keys(state.clients).length >= 1000)
  )
    return cloudReply(
      { error: "同期回数の上限です。端末の進行は保存されています" },
      429,
    );
  state.total++;
  state.clients[key] = (state.clients[key] ?? 0) + 1;
  await storage.put("cloud-rate", state);
  return cloudReply({ ok: true });
}
