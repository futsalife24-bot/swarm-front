export type AppId = "lmfdb" | "swarm-front" | "katamon" | "mayoi";
export const APPS: readonly { id: AppId; name: string; url: string }[] = [
  {
    id: "lmfdb",
    name: "LMF能力DB",
    url: "https://futsalife24-bot.github.io/lMfDB/ux/",
  },
  {
    id: "swarm-front",
    name: "スワフロ",
    url: "https://swarm-front.melosalife-24.workers.dev/",
  },
  {
    id: "katamon",
    name: "カタモン",
    url: "https://futsalife24-bot.github.io/katamon/",
  },
  {
    id: "mayoi",
    name: "まよいの砦",
    url: "https://mossline-bastion.melosalife-24.chatgpt.site/",
  },
];
export type Day = {
  date: string;
  views: number;
  visitors: number;
  sorties: number;
  clears: number;
};
export const jstDate = (now: number) =>
  new Date(now + 9 * 3600000).toISOString().slice(0, 10);
const dateOffset = (date: string, offset: number) =>
  new Date(Date.parse(date + "T00:00:00Z") + offset * 86400000)
    .toISOString()
    .slice(0, 10);

export function summary(days: Day[], period: number, now: number) {
  const today = jstDate(now);
  const first = dateOffset(today, 1 - period);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const selected = Array.from(
    { length: period },
    (_, i) =>
      byDate.get(dateOffset(first, i)) ?? {
        date: dateOffset(first, i),
        views: 0,
        visitors: 0,
        sorties: 0,
        clears: 0,
      },
  );
  const totals = selected.reduce(
    (a, d) => ({
      views: a.views + d.views,
      visitors: a.visitors + d.visitors,
      sorties: a.sorties + d.sorties,
      clears: a.clears + d.clears,
    }),
    { views: 0, visitors: 0, sorties: 0, clears: 0 },
  );
  const yesterday = byDate.get(dateOffset(today, -1))?.views ?? 0;
  const todayViews = byDate.get(today)?.views ?? 0;
  return {
    totals,
    days: selected,
    todayViews,
    yesterdayViews: yesterday,
    change: yesterday
      ? Math.round(((todayViews - yesterday) / yesterday) * 100)
      : null,
  };
}

export async function readEvent(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw new Error("body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 512) {
      await reader.cancel();
      throw new Error("size");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const b = JSON.parse(new TextDecoder().decode(bytes)) as {
    visitor?: unknown;
    admin?: unknown;
  };
  if (!b || typeof b !== "object" || Array.isArray(b)) throw new Error("body");
  if (
    b.visitor !== null &&
    (typeof b.visitor !== "string" || !/^[a-f0-9]{32}$/.test(b.visitor))
  )
    throw new Error("visitor");
  if (b.admin !== undefined && typeof b.admin !== "boolean")
    throw new Error("admin");
  return {
    visitor: b.visitor as string | null,
    ...(b.admin === undefined ? {} : { admin: b.admin }),
  };
}

/** Migration-only read. No schema creation, expiry, alarms, or visitor mutations. */
export async function exportAppAnalytics(
  req: Request,
  storage: DurableObjectStorage,
  now = Date.now(),
) {
  if (req.headers.get("X-Developer-Verified") !== "1")
    return Response.json({ error: "認証が必要です" }, { status: 401 });
  const sql = storage.sql;
  const tables = new Set(
    sql
      .exec<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('app_days','app_admin_days','app_admin_only')",
      )
      .toArray()
      .map((row) => row.name),
  );
  if (!tables.has("app_days")) return Response.json({ days: [] });
  const exclude = new URL(req.url).searchParams.get("excludeAdmin") === "1";
  const days = sql
    .exec<{ date: string; views: number; visitors: number }>(
      "SELECT date,views,visitors FROM app_days WHERE date >= ? ORDER BY date",
      dateOffset(jstDate(now), -364),
    )
    .toArray();
  return Response.json({
    days: days.map((d) => ({
      date: d.date,
      views:
        d.views -
        (exclude && tables.has("app_admin_days")
          ? (sql
              .exec<{ views: number }>(
                "SELECT views FROM app_admin_days WHERE date=?",
                d.date,
              )
              .toArray()[0]?.views ?? 0)
          : 0),
      visitors:
        d.visitors -
        (exclude && tables.has("app_admin_only")
          ? sql
              .exec<{ n: number }>(
                "SELECT COUNT(*) AS n FROM app_admin_only WHERE date=?",
                d.date,
              )
              .toArray()[0].n
          : 0),
      sorties: 0,
      clears: 0,
    })),
  });
}

// New applications have separate objects; the existing Swarm Front analytics object is unchanged.
export async function appAnalytics(
  req: Request,
  storage: DurableObjectStorage,
  now = Date.now(),
) {
  const sql = storage.sql;
  sql.exec(
    "CREATE TABLE IF NOT EXISTS app_days (date TEXT PRIMARY KEY, views INTEGER NOT NULL, visitors INTEGER NOT NULL, updated INTEGER NOT NULL)",
  );
  sql.exec(
    "CREATE TABLE IF NOT EXISTS app_visitors (date TEXT NOT NULL, id TEXT NOT NULL, PRIMARY KEY(date,id))",
  );
  sql.exec(
    "CREATE TABLE IF NOT EXISTS app_admin_days (date TEXT PRIMARY KEY, views INTEGER NOT NULL)",
  );
  sql.exec(
    "CREATE TABLE IF NOT EXISTS app_admin_only (date TEXT NOT NULL, id TEXT NOT NULL, PRIMARY KEY(date,id))",
  );
  const today = jstDate(now),
    cutoff = dateOffset(today, -364);
  sql.exec("DELETE FROM app_days WHERE date < ?", cutoff);
  sql.exec("DELETE FROM app_visitors WHERE date < ?", cutoff);
  sql.exec("DELETE FROM app_admin_days WHERE date < ?", cutoff);
  sql.exec("DELETE FROM app_admin_only WHERE date < ?", cutoff);
  if (new URL(req.url).pathname === "/app-analytics-read") {
    if (req.headers.get("X-Developer-Verified") !== "1")
      return Response.json({ error: "認証が必要です" }, { status: 401 });
    const exclude = new URL(req.url).searchParams.get("excludeAdmin") === "1";
    const days = sql
      .exec<{ date: string; views: number; visitors: number; updated: number }>(
        "SELECT * FROM app_days ORDER BY date",
      )
      .toArray();
    return Response.json({
      days: days.map((d) => ({
        date: d.date,
        views:
          d.views -
          (exclude
            ? (sql
                .exec<{ views: number }>(
                  "SELECT views FROM app_admin_days WHERE date = ?",
                  d.date,
                )
                .toArray()[0]?.views ?? 0)
            : 0),
        visitors:
          d.visitors -
          (exclude
            ? sql
                .exec<{ n: number }>(
                  "SELECT COUNT(*) AS n FROM app_admin_only WHERE date = ?",
                  d.date,
                )
                .toArray()[0].n
            : 0),
        sorties: 0,
        clears: 0,
      })),
      lastEventAt: days.at(-1)?.updated ?? null,
    });
  }
  const { visitor, admin = false } = await readEvent(req);
  const current = sql
    .exec<{ views: number }>("SELECT views FROM app_days WHERE date = ?", today)
    .toArray()[0];
  // Bounded daily storage/work; public browser telemetry is indicative, not tamper-proof.
  if ((current?.views ?? 0) >= 20000)
    return Response.json({ error: "計測上限" }, { status: 429 });
  storage.transactionSync(() => {
    let fresh = 0;
    if (visitor) {
      const exists = sql
        .exec(
          "SELECT 1 FROM app_visitors WHERE date = ? AND id = ?",
          today,
          visitor,
        )
        .toArray().length;
      if (!exists) {
        sql.exec(
          "INSERT INTO app_visitors(date,id) VALUES (?,?)",
          today,
          visitor,
        );
        fresh = 1;
        if (admin)
          sql.exec(
            "INSERT INTO app_admin_only(date,id) VALUES (?,?)",
            today,
            visitor,
          );
      }
    }
    if (visitor && !admin)
      sql.exec(
        "DELETE FROM app_admin_only WHERE date = ? AND id = ?",
        today,
        visitor,
      );
    if (admin)
      sql.exec(
        "INSERT INTO app_admin_days(date,views) VALUES (?,1) ON CONFLICT(date) DO UPDATE SET views=views+1",
        today,
      );
    sql.exec(
      "INSERT INTO app_days(date,views,visitors,updated) VALUES (?,1,?,?) ON CONFLICT(date) DO UPDATE SET views=views+1, visitors=visitors+excluded.visitors, updated=excluded.updated",
      today,
      fresh,
      now,
    );
  });
  // Expire data even after an application stops sending events.
  if ((await storage.getAlarm()) === null)
    await storage.setAlarm(now + 86400000);
  return Response.json({ ok: true });
}

export async function expireAppAnalytics(
  storage: DurableObjectStorage,
  now = Date.now(),
) {
  const cutoff = dateOffset(jstDate(now), -364);
  storage.sql.exec("DELETE FROM app_days WHERE date < ?", cutoff);
  storage.sql.exec("DELETE FROM app_visitors WHERE date < ?", cutoff);
  // A pre-upgrade object may not have these tables until its next request.
  for (const table of ["app_admin_days", "app_admin_only"]) {
    if (
      storage.sql
        .exec(
          "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
          table,
        )
        .toArray().length
    )
      storage.sql.exec(`DELETE FROM ${table} WHERE date < ?`, cutoff);
  }
  if (storage.sql.exec("SELECT 1 FROM app_days LIMIT 1").toArray().length)
    await storage.setAlarm(now + 86400000);
}
