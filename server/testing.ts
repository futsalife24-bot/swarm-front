// Isolated integration fixtures. NEVER referenced by wrangler.jsonc or the browser.
// They shorten setup of downed/result states; they are not evidence of full-mission balance.
import production, { Room, Gate } from "./worker";
import { addPlayer, createWorld, start, spawn } from "../src/shared/game";
export { Gate };
export class TestRoom extends Room {
  override async fetch(req: Request) {
    const u = new URL(req.url);
    if (u.pathname === "/fixture") {
      this.stop();
      const w = createWorld("fixture-" + crypto.randomUUID(), 314);
      for (const m of this.saved.members) addPlayer(w, m.id, m.weapons);
      start(w);
      w.nextSpawn = 1e9;
      if (u.searchParams.get("case") === "revive") {
        w.players[0].hp = 0;
        w.players[0].down = 25;
        w.players[1].x = w.players[0].x + 1;
        w.players[1].z = w.players[0].z;
      } else if (u.searchParams.get("case") === "reward") {
        spawn(w, "boss", w.players[0].x, w.players[0].z - 8);
        w.enemies[0].hp = 1;
      } else if (u.searchParams.get("case") === "load") {
        for (let n = 0; n < 40; n++)
          spawn(
            w,
            n % 3 ? "crawler" : "spitter",
            ((n % 8) - 4) * 2,
            -15 - Math.floor(n / 8) * 3,
          );
      }
      this.saved.world = w;
      this.inputs = {};
      await this.persist();
      this.broadcast();
      this.run();
      return Response.json({ ok: true });
    }
    return super.fetch(req);
  }
}
export default {
  async fetch(req: Request, env: Parameters<typeof production.fetch>[1]) {
    const u = new URL(req.url);
    const match = /^\/fixtures\/([a-f0-9]{32})\/(revive|reward|load)$/.exec(
      u.pathname,
    );
    if (match && req.method === "POST") {
      return env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(
        new Request(`https://internal/fixture?case=${match[2]}`),
      );
    }
    return production.fetch(req, env);
  },
};
