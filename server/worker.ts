import {
  DEFAULT_PLAYER_NAME,
  CHAT_HISTORY_LIMIT,
  normalizePlayerName,
  normalizeChatText,
  type ChatMessage,
} from "../src/shared/social";
import { validStage } from "../src/shared/stages";
import { developerAuth } from "./developer-auth";
import {
  playerVault,
  sqlVaultStorage,
  cloudAdmission,
  cloudRateLimit,
  cloudBody,
  cloudReply,
  validCloudSave,
} from "./player-vault";
import { DurableObject } from "cloudflare:workers";
import { creationAccess, turnstileAccess } from "./auth";
import { LIMITS, validBattleWeapon, type Weapon } from "../src/shared/defs";
import type { NewWeapon } from "../src/shared/progression";
import {
  addPlayer,
  createWorld,
  finish,
  neutral,
  start,
  step,
  validInput,
  type Input,
  type World,
} from "../src/shared/game";
import { encodeState, prepareState } from "../src/shared/state-wire";
import {
  roomOptions,
  normalizeRoomId,
  visibleRooms,
  type DirectoryEntry,
  type RoomOptions,
} from "../src/shared/room-directory";

interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  GATE: DurableObjectNamespace<Gate>;
  ALLOWED_ORIGINS?: string;
  ROOM_CREATION_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  DEVELOPER_PASSWORD_HASH?: string;
}
interface Member {
  id: string;
  token: string;
  name?: string;
  chatAt?: number;
  profileAt?: number;
  last: number;
  gone: number;
  weapons: Weapon[];
  edits?: number;
  ready?: boolean;
  readyGeneration?: number;
}
interface Saved {
  directory?: RoomOptions & { code: string; roomId: string };
  created: number;
  members: Member[];
  world: World | null;
  interrupted: boolean;
  paused?: boolean;
  stage?: number;
  messages?: ChatMessage[];
  preparationGeneration?: number;
}
const json = (body: unknown, status = 200) => Response.json(body, { status });
const secret = () => crypto.randomUUID().replaceAll("-", "");
const adminPage = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SWARM FRONT 管理</title><style>body{font:16px system-ui;background:#0c1820;color:#e8f1f2;max-width:900px;margin:2rem auto;padding:0 1rem}button,input{font:inherit;padding:.6rem;margin:.3rem}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem}.card{background:#17303a;border-radius:10px;padding:1rem}.bar{height:16px;background:#43c6ac;margin:4px 0;border-radius:4px}.muted{color:#9db4b8}</style><h1>SWARM FRONT 管理</h1><section id="login"><p>開発者パスワード</p><input id="pw" type="password"><button id="go">ログイン</button><p id="msg"></p></section><section id="app" hidden><p class="muted" id="range"></p><main id="cards"></main><h2>日別アクセス</h2><div id="chart"></div><button id="out">ログアウト</button></section><script>(async()=>{const $=id=>document.getElementById(id),j=async(u,o)=>{const r=await fetch(u,{credentials:'same-origin',...o});return [r,await r.json().catch(()=>({}))]};async function load(){const[r,d]=await j('/api/developer/analytics');if(!r.ok){$('msg').textContent=d.error||'ログインしてください';return} $('login').hidden=true;$('app').hidden=false;$('range').textContent='計測開始: '+new Date(d.startedAt).toLocaleDateString('ja-JP')+' / 更新: '+new Date(d.updatedAt).toLocaleString('ja-JP');const labels={views:'アクセス',visitors:'訪問ブラウザ',sorties:'出撃',clears:'クリア'};$('cards').innerHTML=Object.entries(labels).map(([k,v])=>'<div class="card"><div>'+v+'</div><strong>'+d.totals[k]+'</strong></div>').join('');const max=Math.max(1,...d.days.map(x=>x.views));$('chart').innerHTML=d.days.slice(-30).map(x=>'<div title="'+x.date+' '+x.views+'件">'+x.date.slice(5)+' <span class="bar" style="display:inline-block;width:'+Math.round(x.views/max*70)+'%"></span> '+x.views+'</div>').join('')} $('go').onclick=async()=>{const[r,d]=await j('/api/developer/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('pw').value})});if(r.ok)load();else $('msg').textContent=d.error||'認証に失敗しました'};$('out').onclick=async()=>{await j('/api/developer/logout',{method:'POST'});location.reload()};load()})()</script>`;
export default {
  async fetch(req: Request, env: Env) {
    const u = new URL(req.url);
    // The deployed app and its API share one Worker origin.  Local development
    // still uses the explicitly configured Vite origins.
    const allowedOrigins = (env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .filter(Boolean);
    const origin = req.headers.get("Origin");
    if (origin && origin !== u.origin && !allowedOrigins.includes(origin))
      return json({ error: "接続元が許可されていません" }, 403);
    if (req.method === "OPTIONS")
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin":
            origin ?? allowedOrigins[0] ?? u.origin,
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type,X-Room-Creation-Key,X-Turnstile-Token",
          Vary: "Origin",
        },
      });
    let res: Response;
    const path = u.pathname.startsWith("/api/")
      ? u.pathname.slice(4)
      : u.pathname;
    if (u.pathname.startsWith("/api/cloud/")) {
      if (
        req.method !== "GET" &&
        (req.method !== "POST" || origin !== u.origin)
      )
        return cloudReply({ error: "接続元と操作を確認してください" }, 403);
      try {
        if (path === "/cloud/create" && req.method === "POST") {
          const allowed = await env.GATE.get(
            env.GATE.idFromName("cloud-admission"),
          ).fetch(
            new Request("https://internal/cloud-admission", {
              headers: {
                "CF-Connecting-IP":
                  req.headers.get("CF-Connecting-IP") ?? "local",
              },
            }),
          );
          if (!allowed.ok) return allowed;
          const body = await cloudBody(req);
          if (!validCloudSave(body.save))
            return cloudReply({ error: "通常プレイの保存が必要です" }, 400);
          const id = secret(),
            token = secret() + secret();
          const result = await env.GATE.get(
            env.GATE.idFromName("cloud/" + id),
          ).fetch(
            new Request("https://internal/cloud-initialize", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token,
              },
              body: JSON.stringify(body),
            }),
          );
          if (!result.ok) return result;
          return cloudReply({
            ...((await result.json()) as object),
            code: `SF1-${id}-${token}`,
          });
        }
        const match =
          /^\/cloud\/([a-f0-9]{32})\/(save|daily|weekly|delete)$/.exec(path);
        if (!match || (req.method === "GET" && match[2] !== "save"))
          return cloudReply({ error: "見つかりません" }, 404);
        const admission = await env.GATE.get(
          env.GATE.idFromName("cloud-admission"),
        ).fetch(
          new Request("https://internal/cloud-rate", {
            headers: {
              "CF-Connecting-IP":
                req.headers.get("CF-Connecting-IP") ?? "local",
            },
          }),
        );
        if (!admission.ok) return admission;
        const payload =
          req.method === "POST"
            ? JSON.stringify(await cloudBody(req))
            : undefined;
        return await env.GATE.get(
          env.GATE.idFromName("cloud/" + match[1]),
        ).fetch(
          new Request("https://internal/cloud/" + match[2], {
            method: req.method,
            headers: {
              Authorization: req.headers.get("Authorization") ?? "",
              "Content-Type": "application/json",
            },
            ...(payload === undefined ? {} : { body: payload }),
          }),
        );
      } catch {
        return cloudReply(
          {
            error:
              "クラウド保存を処理できません。通信・保存容量を確認してください",
          },
          400,
        );
      }
    }
    if (u.pathname === "/admin/" || u.pathname === "/admin")
      return new Response(adminPage, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    if (path === "/analytics/event" && req.method === "POST") {
      const gate = env.GATE.get(env.GATE.idFromName("analytics"));
      res = await gate.fetch(
        new Request("https://internal/analytics-event", req),
      );
    } else if (path === "/developer/analytics" && req.method === "GET") {
      const auth = await env.GATE.get(
        env.GATE.idFromName("developer-access"),
      ).fetch(
        new Request("https://internal/api/developer/session", {
          headers: req.headers,
        }),
      );
      if (
        !auth.ok ||
        !((await auth.json()) as { authenticated?: boolean }).authenticated
      )
        res = json({ error: "認証が必要です" }, 401);
      else {
        const gate = env.GATE.get(env.GATE.idFromName("analytics"));
        res = await gate.fetch(
          new Request("https://internal/analytics-read", {
            headers: { "X-Developer-Verified": "1" },
          }),
        );
      }
    } else if (path.startsWith("/developer/"))
      res = await env.GATE.get(env.GATE.idFromName("developer-access")).fetch(
        req,
      );
    else if (path === "/health")
      res = json({
        ok: true,
        transport: "websocket",
        authority: "durable-object",
      });
    else if (path === "/turnstile-config")
      res = env.TURNSTILE_SITE_KEY
        ? json({ siteKey: env.TURNSTILE_SITE_KEY })
        : json({ error: "ルーム作成の準備中です" }, 503);
    else if (
      req.method === "GET" &&
      (path === "/rooms" || /^\/rooms\/[A-Fa-f0-9]{8}$/.test(path))
    ) {
      res = await env.GATE.get(env.GATE.idFromName("admission")).fetch(
        new Request(
          path === "/rooms"
            ? "https://internal/list"
            : `https://internal/resolve?id=${path.split("/")[2]}`,
          {
            headers: {
              "X-Client": req.headers.get("CF-Connecting-IP") ?? "local",
            },
          },
        ),
      );
    } else if (path === "/rooms" && req.method === "POST") {
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
      const access = local
        ? await creationAccess(
            env.ROOM_CREATION_KEY,
            req.headers.get("X-Room-Creation-Key"),
          )
        : await turnstileAccess(
            env.TURNSTILE_SECRET_KEY,
            req.headers.get("X-Turnstile-Token"),
            req.headers.get("CF-Connecting-IP"),
          );
      if (access !== 200) {
        res = json(
          {
            error:
              access === 503
                ? "ルーム作成は現在利用できません"
                : local
                  ? "ローカル作成キーを確認してください"
                  : "人間確認を完了して、もう一度ルームを作成してください",
          },
          access,
        );
      } else {
        const invalidOptions = (error: string, status: number) => {
          const response = json({ error }, status);
          if (origin)
            response.headers.set("Access-Control-Allow-Origin", origin);
          response.headers.set("Vary", "Origin");
          response.headers.set("Cache-Control", "no-store");
          return response;
        };
        const raw = await req.text();
        if (raw.length > 512)
          return invalidOptions("部屋設定が長すぎます", 413);
        let options: RoomOptions;
        try {
          options = roomOptions(raw ? JSON.parse(raw) : {});
        } catch {
          return invalidOptions("部屋設定を確認してください", 400);
        }
        const gate = env.GATE.get(env.GATE.idFromName("admission"));
        const allowed = await gate.fetch(
          new Request("https://internal/create", {
            method: "POST",
            body: JSON.stringify(options),
            headers: {
              "X-Client": req.headers.get("CF-Connecting-IP") ?? "local",
            },
          }),
        );
        if (!allowed.ok) res = allowed;
        else {
          const { code, roomId } = (await allowed.json()) as {
            code: string;
            roomId: string;
          };
          await env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(
            new Request("https://internal/init", {
              method: "POST",
              body: JSON.stringify({ ...options, code, roomId }),
            }),
          );
          res = json({ code, roomId });
        }
      }
    } else if (
      /^\/rooms\/[a-f0-9]{32}$/.test(path) &&
      req.headers.get("Upgrade")?.toLowerCase() === "websocket"
    ) {
      const gate = env.GATE.get(env.GATE.idFromName("admission"));
      const allowed = await gate.fetch(
        new Request("https://internal/connect", {
          headers: {
            "X-Client": req.headers.get("CF-Connecting-IP") ?? "local",
            "X-Room": path.split("/")[2],
          },
        }),
      );
      if (!allowed.ok) res = allowed;
      else
        res = await env.ROOMS.get(
          env.ROOMS.idFromName(path.split("/")[2]),
        ).fetch(req);
    } else res = json({ error: "見つかりません" }, 404);
    if (res.status === 101) return res;
    const out = new Response(res.body, res);
    if (path.startsWith("/rooms")) out.headers.set("Cache-Control", "no-store");
    if (origin) out.headers.set("Access-Control-Allow-Origin", origin);
    out.headers.set("Vary", "Origin");
    return out;
  },
} satisfies ExportedHandler<Env>;
// One bounded admission object: persistent daily cap, per-address creation/connection windows.
export class Gate extends DurableObject<Env> {
  private directoryQueries = new Map<string, { at: number; count: number }>();
  async fetch(req: Request) {
    const internal = new URL(req.url).pathname;
    if (internal === "/cloud-admission")
      return this.ctx.blockConcurrencyWhile(() =>
        cloudAdmission(req, this.ctx.storage),
      );
    if (internal === "/cloud-rate")
      return this.ctx.blockConcurrencyWhile(() =>
        cloudRateLimit(req, this.ctx.storage),
      );
    if (internal === "/cloud-initialize" || internal.startsWith("/cloud/"))
      return this.ctx.blockConcurrencyWhile(() =>
        playerVault(
          req,
          sqlVaultStorage(this.ctx.storage),
          internal === "/cloud-initialize",
        ),
      );
    if (internal === "/analytics-event" || internal === "/analytics-read")
      return this.ctx.blockConcurrencyWhile(() =>
        this.analytics(req, internal),
      );
    if (new URL(req.url).pathname.startsWith("/api/developer/"))
      return this.ctx.blockConcurrencyWhile(() =>
        developerAuth(req, this.ctx.storage, this.env.DEVELOPER_PASSWORD_HASH),
      );
    return this.ctx.blockConcurrencyWhile(() => this.admit(req));
  }
  private async analytics(req: Request, path: string) {
    const now = Date.now();
    type Day = {
      date: string;
      views: number;
      visitors: number;
      sorties: number;
      clears: number;
      ids: string[];
    };
    const days = (await this.ctx.storage.get<Day[]>("analytics-days")) ?? [];
    const day = new Date(now).toLocaleDateString("sv-SE", {
      timeZone: "Asia/Tokyo",
    });
    let d = days.find((x) => x.date === day);
    if (!d) {
      d = { date: day, views: 0, visitors: 0, sorties: 0, clears: 0, ids: [] };
      days.push(d);
    }
    if (path === "/analytics-read") {
      if (req.headers.get("X-Developer-Verified") !== "1")
        return json({ error: "認証が必要です" }, 401);
      const totals = days.reduce(
        (a, x) => ({
          views: a.views + x.views,
          visitors: a.visitors + x.visitors,
          sorties: a.sorties + x.sorties,
          clears: a.clears + x.clears,
        }),
        { views: 0, visitors: 0, sorties: 0, clears: 0 },
      );
      return json({
        startedAt: days.length
          ? Date.parse(days[0].date + "T00:00:00+09:00")
          : now,
        updatedAt: now,
        totals,
        days: days.map(({ ids, ...x }) => x),
      });
    }
    try {
      const b = (await req.json()) as { kind?: string; visitor?: string };
      if (!b || !["view", "sortie", "clear"].includes(b.kind ?? ""))
        return json({ ok: false }, 400);
      if (b.kind === "view") d.views++;
      if (b.kind === "sortie") d.sorties++;
      if (b.kind === "clear") d.clears++;
      if (
        typeof b.visitor === "string" &&
        /^[a-zA-Z0-9_-]{8,64}$/.test(b.visitor) &&
        !d.ids.includes(b.visitor)
      ) {
        d.ids.push(b.visitor);
        d.visitors++;
        if (d.ids.length > 50000) d.ids = d.ids.slice(-50000);
      }
      while (days.length > 365) days.shift();
      await this.ctx.storage.put("analytics-days", days);
      return json({ ok: true });
    } catch {
      return json({ ok: false }, 400);
    }
  }
  private async admit(req: Request) {
    const now = Date.now(),
      day = Math.floor(now / 86400000);
    const url = new URL(req.url);
    if (["/list", "/resolve", "/directory"].includes(url.pathname)) {
      if (url.pathname !== "/directory") {
        for (const [key, entry] of this.directoryQueries)
          if (now - entry.at >= 60000) this.directoryQueries.delete(key);
        const key = req.headers.get("X-Client") ?? "local";
        if (
          !this.directoryQueries.has(key) &&
          this.directoryQueries.size >= 1000
        )
          return json({ error: "受付が混雑しています" }, 429);
        const query = this.directoryQueries.get(key) ?? { at: now, count: 0 };
        this.directoryQueries.set(key, query);
        if (++query.count > 30)
          return json(
            { error: "少し待ってから部屋一覧を更新してください" },
            429,
          );
      }
      const directory =
        (await this.ctx.storage.get<Record<string, DirectoryEntry>>(
          "directory",
        )) ?? {};
      if (url.pathname === "/list")
        return json({ rooms: visibleRooms(Object.values(directory), now) });
      if (url.pathname === "/resolve") {
        const id = normalizeRoomId(url.searchParams.get("id") ?? "");
        const entry = Object.values(directory).find(
          (e) => e.roomId === id && e.expires > now,
        );
        return entry
          ? json({ code: entry.code })
          : json({ error: "部屋が見つからないか、有効期限切れです" }, 404);
      }
      const update = (await req.json()) as {
        code: string;
        players: number;
        stage: number;
        phase: string;
        updated: number;
      };
      const entry = directory[update.code];
      if (entry && entry.expires > now && update.updated > entry.updated) {
        Object.assign(entry, {
          players: update.players,
          stage: update.stage,
          phase: update.phase,
          updated: update.updated,
        });
        await this.ctx.storage.put("directory", directory);
      }
      return json({ ok: true });
    }
    const state = (await this.ctx.storage.get<{
      day: number;
      total: number;
      connections?: number;
      rooms?: Record<string, number>;
      clients: Record<string, { at: number; c: number; j: number }>;
    }>("gate")) ?? { day, total: 0, clients: {} };
    const create = new URL(req.url).pathname === "/create";
    const rooms = (state.rooms ??= {});
    for (const [code, expires] of Object.entries(rooms))
      if (expires <= now) delete rooms[code];
    // Check the authoritative, bounded creation registry before any admission counter.
    if (!create && !Object.hasOwn(rooms, req.headers.get("X-Room") ?? ""))
      return json({ error: "ルームが存在しないか、有効期限切れです" }, 404);
    if (state.day !== day) {
      state.day = day;
      state.total = 0;
      state.connections = 0;
      state.clients = {};
    }
    const raw = req.headers.get("X-Client") ?? "local";
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(raw),
    );
    const key = Array.from(new Uint8Array(digest))
      .slice(0, 12)
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    for (const [k, v] of Object.entries(state.clients))
      if (now - v.at > 600000) delete state.clients[k];
    if (!state.clients[key] && Object.keys(state.clients).length >= 1000)
      return json({ error: "受付が混雑しています" }, 429);
    const c = (state.clients[key] ??= { at: now, c: 0, j: 0 });
    if (
      (create && (c.c >= 10 || state.total >= 100)) ||
      (!create && (c.j >= 60 || (state.connections ?? 0) >= 2000))
    )
      return json(
        { error: "接続回数の上限です。10分後に再試行してください" },
        429,
      );
    let code: string | undefined;
    let roomId: string | undefined;
    if (create) {
      c.c++;
      state.total++;
      const directory =
        (await this.ctx.storage.get<Record<string, DirectoryEntry>>(
          "directory",
        )) ?? {};
      for (const [key, entry] of Object.entries(directory))
        if (entry.expires <= now) delete directory[key];
      do {
        code = secret();
        roomId = code.slice(0, 8).toUpperCase();
      } while (Object.values(directory).some((e) => e.roomId === roomId));
      const options = roomOptions(await req.json());
      directory[code] = {
        ...options,
        code,
        roomId,
        expires: now + LIMITS.roomMs,
        updated: now,
        phase: "lobby",
        players: 0,
        stage: 1,
      };
      await this.ctx.storage.put("directory", directory);
      rooms[code] = now + LIMITS.roomMs;
    } else {
      c.j++;
      state.connections = (state.connections ?? 0) + 1;
    }
    await this.ctx.storage.put("gate", state);
    await this.ctx.storage.setAlarm(now + 86400000);
    return json({ ok: true, ...(code ? { code, roomId } : {}) });
  }
  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}
export class Room extends DurableObject<Env> {
  private directorySignature = "";
  private directoryAt = 0;
  private publishDirectory() {
    const entry = this.saved.directory;
    if (!entry) return;
    const state = {
      code: entry.code,
      players: this.saved.members.filter((m) => !m.gone).length,
      stage: this.saved.stage ?? 1,
      phase: this.saved.world?.phase === "battle" ? "battle" : "lobby",
    };
    const signature = JSON.stringify(state),
      now = Date.now();
    if (signature === this.directorySignature && now - this.directoryAt < 30000)
      return;
    this.directorySignature = signature;
    this.directoryAt = Math.max(now, this.directoryAt + 1);
    const updated = this.directoryAt;
    this.ctx.waitUntil(
      this.env.GATE.get(this.env.GATE.idFromName("admission"))
        .fetch(
          new Request("https://internal/directory", {
            method: "POST",
            body: JSON.stringify({ ...state, updated }),
          }),
        )
        .then(() => {})
        .catch(() => {
          this.directorySignature = "";
        }),
    );
  }
  saved: Saved = { created: 0, members: [], world: null, interrupted: false };
  sockets = new Map<
    WebSocket,
    {
      id: string;
      at: number;
      count: number;
      window: number;
      seq: number;
      equipmentCache?: boolean;
      equipmentKey?: string;
    }
  >();
  inputs: Record<string, { i: Input; at: number }> = {};
  timer: ReturnType<typeof setInterval> | undefined;
  ticks = 0;
  sentEvent = 0;
  persisting = false;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<Saved>("room");
      if (saved) {
        this.saved = saved;
        if (saved.world?.phase === "battle" && !saved.paused) {
          this.saved.interrupted = true;
          this.saved.world = null;
          await this.persist();
        }
      }
      for (const ws of ctx.getWebSockets()) {
        const a = ws.deserializeAttachment() as { id: string };
        this.sockets.set(ws, {
          id: a.id,
          at: Date.now(),
          count: 0,
          window: Date.now(),
          seq: -1,
        });
      }
    });
  }
  invalidatePreparation() {
    this.saved.preparationGeneration =
      (this.saved.preparationGeneration ?? 0) + 1;
    for (const member of this.saved.members) {
      member.ready = false;
      member.readyGeneration = undefined;
    }
  }
  async persist() {
    await this.ctx.storage.put("room", this.saved);
  }
  async fetch(req: Request) {
    if (new URL(req.url).pathname === "/init") {
      this.saved.created = Date.now();
      const init = (await req.json()) as RoomOptions & {
        code: string;
        roomId: string;
      };
      this.saved.directory = {
        ...roomOptions(init),
        code: init.code,
        roomId: init.roomId,
      };
      await this.persist();
      await this.ctx.storage.setAlarm(this.saved.created + LIMITS.idleMs);
      return json({ ok: true });
    }
    if (!this.saved.created || Date.now() - this.saved.created > LIMITS.roomMs)
      return json({ error: "ルームの有効期限が切れました" }, 410);
    if (this.sockets.size >= 8) return json({ error: "接続上限です" }, 429);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: "" });
    this.sockets.set(server, {
      id: "",
      at: Date.now(),
      count: 0,
      window: Date.now(),
      seq: -1,
    });
    setTimeout(() => {
      if (this.sockets.get(server)?.id === "") {
        server.close(4001, "認証がタイムアウトしました");
        this.sockets.delete(server);
      }
    }, 5000);
    return new Response(null, { status: 101, webSocket: client });
  }
  send(ws: WebSocket, data: unknown) {
    return this.sendEncoded(ws, encodeState(data));
  }
  private sendEncoded(ws: WebSocket, payload: string) {
    try {
      if (new TextEncoder().encode(payload).length > 65536) {
        ws.close(4009, "状態データの上限");
        this.disconnected(ws);
        return;
      }
      ws.send(payload);
      return true;
    } catch {
      this.disconnected(ws);
    }
  }
  error(ws: WebSocket, reason: string, code = 4001) {
    this.send(ws, { type: "error", reason });
    ws.close(code, reason);
    this.disconnected(ws);
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const s = this.sockets.get(ws);
    if (!s) return;
    if (this.saved.interrupted) {
      this.error(
        ws,
        "サーバー再起動で戦闘が中断しました。装備画面から新しいルームへ",
      );
      return;
    }
    if (
      typeof message !== "string" ||
      new TextEncoder().encode(message).length > LIMITS.messageBytes
    ) {
      this.error(ws, "メッセージサイズ上限", 4009);
      return;
    }
    const now = Date.now();
    if (now - s.window >= 1000) {
      s.window = now;
      s.count = 0;
    }
    if (++s.count > 35) {
      this.error(ws, "送信頻度の上限", 4008);
      return;
    }
    let m;
    try {
      m = JSON.parse(message);
    } catch {
      this.error(ws, "不正なJSON");
      return;
    }
    if (!m || typeof m !== "object") {
      this.error(ws, "不正なメッセージ");
      return;
    }
    if (!s.id) {
      if (m.type !== "hello") {
        this.error(ws, "最初に参加認証が必要です");
        return;
      }
      if (this.saved.interrupted) {
        this.error(
          ws,
          "サーバー再起動で戦闘が中断しました。装備画面から新しいルームへ",
        );
        return;
      }
      let member: Member | undefined;
      if (m.token) {
        member = this.saved.members.find((p) => p.token === m.token);
        if (!member) {
          this.error(ws, "参加者情報が一致しません");
          return;
        }
        if (member.gone && now - member.gone > LIMITS.reconnectMs) {
          this.error(ws, "復帰期限（30秒）が切れました。装備画面へ");
          return;
        }
        for (const [old, a] of this.sockets)
          if (old !== ws && a.id === member.id) {
            old.close(4000, "別の接続で復帰しました");
            this.sockets.delete(old);
          }
      } else {
        if (!this.saved.world)
          this.saved.members = this.saved.members.filter(
            (p) => !p.gone || now - p.gone <= LIMITS.reconnectMs,
          );
        if (this.saved.world && this.saved.world.phase !== "lobby") {
          this.error(ws, "進行中のルームには新規参加できません");
          return;
        }
        if (this.saved.members.length >= 4) {
          this.error(ws, "満員です（最大4人）");
          return;
        }
        member = {
          id: secret(),
          token: secret(),
          last: now,
          gone: 0,
          weapons: [],
        };
        this.saved.members.push(member);
      }
      member.name =
        normalizePlayerName(m.name) || member.name || DEFAULT_PLAYER_NAME;
      member.last = now;
      member.gone = 0;
      s.id = member.id;
      s.equipmentCache = m.equipmentCache === 1;
      s.at = now;
      ws.serializeAttachment({ id: s.id });
      const p = this.saved.world?.players.find((p) => p.id === s.id);
      if (p) p.connected = true;
      this.saved.paused = false;
      this.invalidatePreparation();
      await this.persist();
      await this.ctx.storage.setAlarm(
        Math.min(
          this.saved.created + LIMITS.roomMs,
          this.saved.world?.phase === "battle"
            ? this.saved.created + LIMITS.roomMs
            : this.saved.world
              ? now + 120000
              : this.saved.created + LIMITS.idleMs,
        ),
      );
      this.send(ws, {
        type: "welcome",
        inputAck: true,
        id: member.id,
        token: member.token,
        roomId: this.saved.directory?.roomId,
        roomName: this.saved.directory?.name,
      });
      this.send(ws, {
        type: "chatHistory",
        messages: this.saved.messages ?? [],
      });
      this.broadcast();
      if (this.saved.world?.phase === "battle") this.run();
      return;
    }
    const member = this.saved.members.find((p) => p.id === s.id)!;
    s.at = now;
    if (m.type === "profile") {
      const name = normalizePlayerName(m.name);
      if (!name || name === member.name || now - (member.profileAt ?? 0) < 1000)
        return;
      member.name = name;
      member.profileAt = now;
      await this.persist();
      this.broadcast();
    } else if (m.type === "chat") {
      if (this.saved.world?.phase === "battle") {
        this.send(ws, {
          type: "notice",
          reason: "チャットは出撃前のロビーで利用できます",
        });
        return;
      }
      const text = normalizeChatText(m.text);
      if (!text) return;
      if (now - (member.chatAt ?? 0) < 1000) {
        this.send(ws, {
          type: "notice",
          reason: "少し待ってから送信してください",
        });
        return;
      }
      member.chatAt = now;
      member.last = now;
      const message: ChatMessage = {
        id: secret(),
        memberId: member.id,
        name: member.name || DEFAULT_PLAYER_NAME,
        text,
        at: now,
      };
      this.saved.messages = [...(this.saved.messages ?? []), message].slice(
        -CHAT_HISTORY_LIMIT,
      );
      await this.persist();
      for (const [peer, identity] of this.sockets)
        if (identity.id) this.send(peer, { type: "chat", message });
    } else if (m.type === "input") {
      if (!validInput(m.input)) {
        this.error(ws, "入力値が不正です");
        return;
      }
      if (m.input.seq <= s.seq) return;
      s.seq = m.input.seq;
      const previous = this.inputs[s.id]?.i;
      if (
        m.input.mx ||
        m.input.mz ||
        m.input.fire ||
        m.input.revive ||
        m.input.dodge ||
        m.input.swap ||
        m.input.reload ||
        Math.abs(m.input.yaw - (previous?.yaw ?? 0)) > 0.01
      )
        member.last = now;
      // Retain one-shot actions until the next server tick consumes them.
      this.inputs[s.id] = {
        i: {
          ...m.input,
          swap: m.input.swap || previous?.swap || false,
          dodge: m.input.dodge || previous?.dodge || false,
          reload: m.input.reload || previous?.reload || false,
        },
        at: now,
      };
    } else if (m.type === "ready" || m.type === "stage") {
      // Completed runs retain their world; players must still ready for a rematch.
      if (this.saved.world?.phase === "battle") return;
      if (m.type === "stage") {
        if (s.id !== this.saved.members.find((p) => !p.gone)?.id) return;
        if (!validStage(m.stage) || this.saved.stage === m.stage) return;
        this.saved.stage = m.stage;
        this.invalidatePreparation();
      } else {
        if (typeof m.ready !== "boolean") return;
        // An old load completion must never approve a newer preparation, even
        // when the stage changes A -> B -> A or another player changes gear.
        if (m.preparationGeneration !== (this.saved.preparationGeneration ?? 0))
          return;
        const ready =
          m.ready &&
          member.weapons.length === 2 &&
          m.stage === (this.saved.stage ?? 1);
        if (member.ready === ready) return;
        member.ready = ready;
        member.readyGeneration = ready
          ? this.saved.preparationGeneration
          : undefined;
      }
      member.last = now;
      await this.persist();
      this.broadcast();
    } else if (m.type === "equip") {
      if (this.saved.world?.phase === "battle") return;
      if (
        !Array.isArray(m.weapons) ||
        m.weapons.length !== 2 ||
        !m.weapons.every(validBattleWeapon) ||
        m.weapons[0].id === m.weapons[1].id
      ) {
        this.error(ws, "武器定義が不正です");
        return;
      }
      if ((member.edits ?? 0) >= 120) {
        this.error(ws, "このルームの装備更新上限です。新しいルームへ");
        return;
      }
      member.edits = (member.edits ?? 0) + 1;
      member.last = now;
      // Equipment packets never acknowledge asset readiness. Every participant
      // must load and acknowledge the resulting server generation separately.
      this.invalidatePreparation();
      member.weapons = m.weapons.map((w: Weapon | NewWeapon) => ({
        id: w.id,
        kind: w.kind,
        rarity: w.rarity,
        power: w.power,
        effect: w.effect,
        ...(w.rolls ? { rolls: { ...w.rolls } } : {}),
        ...("format" in w
          ? {
              format: 2 as const,
              variance: { ...w.variance },
              testData: false,
              acquired: w.acquired,
            }
          : {}),
      }));
      await this.persist();
      this.broadcast();
    } else if (m.type === "start") {
      const present = this.saved.members.filter((p) => !p.gone);
      if (s.id !== present[0]?.id || this.saved.world?.phase === "battle")
        return;
      if (
        !present.length ||
        present.some(
          (p) =>
            p.weapons.length !== 2 ||
            p.ready !== true ||
            p.readyGeneration !== (this.saved.preparationGeneration ?? 0),
        )
      ) {
        this.send(ws, {
          type: "notice",
          reason: "全員の装備準備を待っています",
        });
        return;
      }
      if (m.stage !== undefined && !validStage(m.stage)) {
        this.error(ws, "ステージが不正です");
        return;
      }
      const world = createWorld(
        secret(),
        crypto.getRandomValues(new Uint32Array(1))[0],
        this.saved.stage ?? m.stage ?? 1,
      );
      for (const p of present) addPlayer(world, p.id, p.weapons);
      for (const p of present) p.last = now;
      start(world);
      this.saved.world = world;
      this.saved.paused = false;
      this.sentEvent = 0;
      this.inputs = {};
      await this.persist();
      await this.ctx.storage.setAlarm(this.saved.created + LIMITS.roomMs);
      this.broadcast();
      this.run();
    } else if (m.type === "ping") {
      this.send(ws, { type: "pong" });
      this.publishDirectory();
    } else if (m.type === "leave") {
      ws.close(1000, "退出");
      this.disconnected(ws);
    } else {
      this.error(ws, "未対応のメッセージ");
    }
  }
  broadcast() {
    this.publishDirectory();
    const w = this.saved.world;
    const members = this.saved.members.map((p) => ({
      id: p.id,
      name: p.name || DEFAULT_PLAYER_NAME,
      ready:
        p.weapons.length === 2 &&
        p.ready === true &&
        p.readyGeneration === (this.saved.preparationGeneration ?? 0),
      ...(w?.phase !== "battle" ? { weapons: p.weapons } : {}),
      connected: !p.gone,
    }));
    const metadata = {
      members,
      stage: this.saved.stage ?? 1,
      preparationGeneration: this.saved.preparationGeneration ?? 0,
    };
    const state = w ? prepareState(w, this.sentEvent, metadata) : undefined;
    for (const [ws, s] of this.sockets) {
      if (!s.id) continue;
      if (w) {
        const cached =
          !!s.equipmentCache &&
          w.phase === "battle" &&
          s.equipmentKey === state!.equipmentKey;
        if (this.sendEncoded(ws, state!.packet(s.id, cached, s.seq)))
          s.equipmentKey = state!.equipmentKey;
      } else this.send(ws, { type: "lobby", ...metadata });
    }
    if (w) this.sentEvent = w.eventSerial;
  }
  run() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, 50);
  }
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
  async tick() {
    if (this.persisting) return;
    const w = this.saved.world,
      now = Date.now();
    if (!w || w.phase !== "battle") {
      this.stop();
      return;
    }
    for (const [ws, s] of this.sockets) {
      const player = w.players.find((p) => p.id === s.id);
      if (
        player &&
        player.hp > 0 &&
        now - (this.saved.members.find((p) => p.id === s.id)?.last ?? s.at) >
          LIMITS.idleMs
      )
        this.error(ws, "放置時間の上限です");
    }
    for (const m of this.saved.members)
      if (m.gone && now - m.gone > LIMITS.reconnectMs) {
        const p = w.players.find((p) => p.id === m.id);
        if (p) {
          p.hp = 0;
          p.down = 0;
        }
      }
    if (now - this.saved.created > LIMITS.roomMs) {
      finish(w, false, "ルームの有効期限が切れました");
    }
    const active = Object.fromEntries(
      Object.entries(this.inputs).map(([id, v]) => [
        id,
        now - v.at < 250 ? v.i : neutral(),
      ]),
    );
    step(w, active);
    for (const v of Object.values(this.inputs)) {
      v.i.swap = false;
      v.i.dodge = false;
      v.i.reload = false;
    }
    this.ticks++;
    if (w.phase !== "battle") {
      this.invalidatePreparation();
      this.stop();
      this.persisting = true;
      try {
        await this.persist();
        await this.ctx.storage.setAlarm(
          Math.min(this.saved.created + LIMITS.roomMs, Date.now() + 120000),
        );
        this.broadcast();
      } catch {
        this.saved.interrupted = true;
        for (const ws of [...this.sockets.keys()])
          this.error(
            ws,
            "戦果をサーバーに保存できませんでした。装備画面へ戻ってください",
          );
      } finally {
        this.persisting = false;
      }
      return;
    }
    if (this.ticks % 2 === 0) this.broadcast();
  }
  disconnected(ws: WebSocket) {
    const s = this.sockets.get(ws);
    this.sockets.delete(ws);
    if (!s?.id) return;
    if ([...this.sockets.values()].some((a) => a.id === s.id)) return;
    const m = this.saved.members.find((p) => p.id === s.id);
    if (m) m.gone = Date.now();
    this.invalidatePreparation();
    delete this.inputs[s.id];
    const w = this.saved.world;
    const p = w?.players.find((p) => p.id === s.id);
    if (p) p.connected = false;
    if (![...this.sockets.values()].some((a) => a.id)) {
      this.stop();
      this.saved.paused = true;
      void this.ctx.storage.setAlarm(
        Math.min(
          this.saved.created + LIMITS.roomMs,
          Date.now() + LIMITS.reconnectMs,
        ),
      );
    }
    void this.persist().catch(() => {});
    this.broadcast();
  }
  webSocketClose(ws: WebSocket) {
    this.disconnected(ws);
  }
  webSocketError(ws: WebSocket) {
    this.disconnected(ws);
  }
  async alarm() {
    // Empty rooms receive only this single cleanup alarm; no simulation loop.
    const now = Date.now();
    const connected = [...this.sockets.entries()].filter(([, s]) => s.id);
    if (
      now < this.saved.created + LIMITS.roomMs &&
      this.saved.world?.phase === "battle" &&
      connected.length
    ) {
      await this.ctx.storage.setAlarm(this.saved.created + LIMITS.roomMs);
      return;
    }
    this.stop();
    for (const m of this.saved.members) m.gone = now;
    this.publishDirectory();
    for (const ws of this.ctx.getWebSockets())
      ws.close(4002, "ルームの有効期限が切れました");
    this.sockets.clear();
    await this.ctx.storage.deleteAll();
    this.saved = { created: 0, members: [], world: null, interrupted: false };
  }
}
