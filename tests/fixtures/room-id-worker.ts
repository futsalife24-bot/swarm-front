// Local-only fixture entrypoint. Never imported by production configuration.
import production, { Gate, Room } from "../../server/worker";
export { Room };
export class RoomIdTestGate extends Gate {
  override async fetch(req: Request) {
    const path = new URL(req.url).pathname;
    if (path === "/room-id-fixture")
      return this.ctx.blockConcurrencyWhile(async () => {
        const mode = await req.text(),
          now = Date.now();
        const directory: Record<string, unknown> = {},
          rooms: Record<string, number> = {};
        if (mode !== "empty")
          for (let n = 0; n < 1000; n++) {
            const roomId = String(n).padStart(3, "0"),
              code = n.toString(16).padStart(32, "0");
            const expires =
              mode === "one-expired" && n === 7 ? now - 1 : now + 3600000;
            directory[code] = {
              code,
              roomId,
              expires,
              name: "検証部屋",
              listed: false,
              players: 0,
              phase: "lobby",
              updated: now,
              stage: 1,
            };
            rooms[code] = expires;
          }
        if (mode === "legacy") {
          for (const key of Object.keys(directory)) delete directory[key];
          for (const key of Object.keys(rooms)) delete rooms[key];
          const code = "abcdef1234567890abcdef1234567890";
          directory[code] = {
            code,
            roomId: "ABCDEF12",
            expires: now + 3600000,
            name: "旧部屋",
            listed: false,
            players: 0,
            phase: "lobby",
            updated: now,
            stage: 1,
          };
          rooms[code] = now + 3600000;
        }
        await this.ctx.storage.put({
          directory,
          gate: {
            day: Math.floor(now / 86400000),
            total: 0,
            connections: 0,
            clients: {},
            rooms,
          },
        });
        return Response.json({ ok: true });
      });
    if (path === "/room-id-stats") {
      const g = await this.ctx.storage.get<{ total: number }>("gate");
      const d =
        await this.ctx.storage.get<Record<string, unknown>>("directory");
      return Response.json({
        total: g?.total ?? 0,
        entries: Object.keys(d ?? {}).length,
      });
    }
    return super.fetch(req);
  }
}
export default {
  async fetch(req: Request, env: Parameters<typeof production.fetch>[1]) {
    const u = new URL(req.url);
    if (
      u.hostname === "127.0.0.1" &&
      ["/room-id-fixture", "/room-id-stats"].includes(u.pathname)
    )
      return env.GATE.get(env.GATE.idFromName("admission")).fetch(
        new Request("https://internal" + u.pathname, {
          method: req.method,
          body: req.method === "POST" ? await req.text() : undefined,
        }),
      );
    return production.fetch(req, env);
  },
};
