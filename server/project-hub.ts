import { APPS, type Day } from "./app-analytics";

export async function legacyEvent(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw Error("body");
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 512) {
      await reader.cancel();
      throw Error("size");
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let pos = 0;
  for (const p of parts) {
    bytes.set(p, pos);
    pos += p.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Export aggregate day counters only; never sessions, player saves or visitor IDs. */
export async function exportProjectAnalytics(
  req: Request,
  gate: DurableObjectNamespace,
  key?: string,
) {
  const headers = { "Cache-Control": "no-store" };
  const supplied = req.headers.get("Authorization") ?? "";
  if (req.method !== "GET")
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers },
    );
  if (!key || !/^Bearer [a-f0-9]{64}$/.test(supplied))
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  const left = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(supplied.slice(7)),
    ),
    right = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(key),
    );
  let difference = 0;
  new Uint8Array(left).forEach((v, i) => {
    difference |= v ^ new Uint8Array(right)[i];
  });
  if (difference)
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  const apps = await Promise.all(
    APPS.map(async (app) => {
      const legacy = app.id === "swarm-front",
        stub = gate.get(
          gate.idFromName(legacy ? "analytics" : "app-analytics/" + app.id),
        );
      const read = async (exclude: boolean) => {
        const r = await stub.fetch(
          new Request(
            "https://internal/" +
              (legacy ? "analytics-read" : "app-analytics-export") +
              "?excludeAdmin=" +
              (exclude ? "1" : "0"),
            { headers: { "X-Developer-Verified": "1" } },
          ),
        );
        if (!r.ok) throw Error("Export read failed");
        const { days } = (await r.json()) as { days: Day[] };
        const cutoff = new Date(Date.now() + 9 * 3600000 - 364 * 86400000)
          .toISOString()
          .slice(0, 10);
        return days
          .filter((d) => d.date >= cutoff)
          .map((d) => ({
            date: d.date,
            views: d.views,
            visitors: d.visitors,
            sorties: d.sorties,
            clears: d.clears,
          }));
      };
      return { id: app.id, all: await read(false), excluded: await read(true) };
    }),
  );
  return Response.json(
    { version: 1, exportedAt: new Date().toISOString(), apps },
    { headers },
  );
}

/** The original collection URL remains compatible for older cached applications. */
export async function forwardAnalytics(
  binding: Fetcher,
  req: Request,
  id: string,
  input: unknown,
) {
  return binding.fetch(
    new Request(
      "https://project-hub.melosalife-24.workers.dev/api/analytics/collect/" +
        id,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: req.headers.get("Origin") ?? new URL(req.url).origin,
          "CF-Connecting-IP": req.headers.get("CF-Connecting-IP") ?? "local",
        },
        body: JSON.stringify(input),
      },
    ),
  );
}
