// Isolated integration fixtures. NEVER referenced by wrangler.jsonc or the browser.
// They shorten setup of downed/result states; they are not evidence of full-mission balance.
import { stageFor, troopCount } from "../src/shared/stages";
import { STARTERS } from "../src/shared/defs";
import production, { Room, Gate } from "./worker";
import {
  addPlayer,
  createWorld,
  start,
  spawn,
  hurtEnemy,
  finish,
} from "../src/shared/game";
export { Gate };
export class TestGate extends Gate {
  override async fetch(req: Request) {
    if (new URL(req.url).pathname === "/stats") {
      const state = await this.ctx.storage.get<{
        total: number;
        connections?: number;
      }>("gate");
      return Response.json({
        total: state?.total ?? 0,
        connections: state?.connections ?? 0,
      });
    }
    return super.fetch(req);
  }
}
export class TestRoom extends Room {
  override async fetch(req: Request) {
    const u = new URL(req.url);
    if (u.pathname === "/snapshot") {
      return Response.json({
        world: this.saved.world,
        paused: this.saved.paused ?? false,
        running: !!this.timer,
      });
    }
    if (u.pathname === "/fixture") {
      this.stop();
      if (
        ["terminal-victory", "terminal-defeat"].includes(
          u.searchParams.get("case") ?? "",
        )
      ) {
        if (this.saved.world?.phase !== "battle")
          return new Response("Active run required", { status: 409 });
        // Shorten mission duration only; preserve the real room, players and run.
        finish(
          this.saved.world,
          u.searchParams.get("case") === "terminal-victory",
          "Local result-flow fixture",
        );
        await this.persist();
        this.broadcast();
        return Response.json({ ok: true });
      }
      const w = createWorld("fixture-" + crypto.randomUUID(), 314);
      for (const m of this.saved.members) addPlayer(w, m.id, m.weapons);
      start(w);
      w.nextSpawn = 1e9;
      w.enemies = [];
      if (u.searchParams.get("case") === "trooper") {
        w.players.forEach((p, i) => {
          p.x = i * 1.5;
          p.z = 0;
        });
        spawn(w, "boss", 0, -10, "crown");
        Object.assign(w.enemies[0], {
          active: true,
          wind: 1.5,
          tx: 0,
          tz: 0,
          cool: 0,
        });
      } else if (u.searchParams.get("case") === "freeze") {
        Object.assign(w.players[0], {
          hp: 50,
          safe: 0,
          cool: 2,
          reload: 3,
          ammo: [1, 1],
        });
      } else if (u.searchParams.get("case") === "revive") {
        w.players[0].hp = 0;
        w.players[0].down = 25;
        this.saved.members[0].last = Date.now() - 181000;
        w.players[1].x = w.players[0].x + 1;
        w.players[1].z = w.players[0].z;
      } else if (
        ["reward", "reward-overflow"].includes(u.searchParams.get("case") ?? "")
      ) {
        w.wave = stageFor(w).waves.length;
        w.spawned = troopCount(stageFor(w).waves[w.wave - 1]);
        spawn(w, "boss", w.players[0].x, w.players[0].z - 8);
        w.enemies[0].hp = 1;
        if (u.searchParams.get("case") === "reward-overflow") {
          for (const p of w.players)
            w.pending[p.id] = [
              { ...STARTERS[1], id: "fixture-lr", rarity: 3, effect: "pierce" },
              ...Array.from({ length: 9 }, (_, i) => ({
                ...STARTERS[2],
                id: `fixture-rocket-${i}`,
              })),
            ];
        }
      } else if (u.searchParams.get("case") === "worm-split") {
        w.stage = 6;
        spawn(w, "boss", 0, -15, "worm");
        hurtEnemy(w, w.enemies[0], 1e6, w.players[0].id, 4);
      } else if (u.searchParams.get("case") === "foundry") {
        w.stage = 6;
        w.players.forEach((p, i) => {
          p.x = i * 3;
          p.z = -32;
          p.hp = 10000;
        });
        const boss = spawn(w, "boss", 0, -15, "worm")!;
        hurtEnemy(w, boss, 1e6, w.players[0].id, 4);
        boss.partHp = 1;
        boss.hp =
          1 + boss.segments!.reduce((sum, part) => sum + (part.partHp ?? 0), 0);
      } else if (u.searchParams.get("case") === "structures") {
        w.players.forEach((p, i) => {
          p.x = 0;
          p.z = [-2, 0, 2, 16][i];
        });
        for (const [kind, z] of [
          ["crawler", -4],
          ["spitter", -10],
          ["hornet", 6],
          ["boss", -14],
        ] as const) {
          spawn(w, kind, 0, z, "crown");
          const e = w.enemies[w.enemies.length - 1];
          e.active = true;
          e.cool = 0;
        }
      } else if (u.searchParams.get("case") === "enemies") {
        w.stage = 5;
        spawn(w, "ant", -4, 5);
        spawn(w, "spider", 4, 5);
        spawn(w, "hornet", 0, -1);
        spawn(w, "boss", 0, -15, "worm");
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
    if (u.pathname === "/admission-stats")
      return env.GATE.get(env.GATE.idFromName("admission")).fetch(
        new Request("https://internal/stats"),
      );
    const match =
      /^\/fixtures\/([a-f0-9]{32})\/(revive|reward|reward-overflow|load|freeze|enemies|structures|worm-split|foundry|trooper|snapshot|terminal-victory|terminal-defeat)$/.exec(
        u.pathname,
      );
    if (match && req.method === "POST") {
      return env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(
        new Request(
          match[2] === "snapshot"
            ? "https://internal/snapshot"
            : `https://internal/fixture?case=${match[2]}`,
        ),
      );
    }
    return production.fetch(req, env);
  },
};
