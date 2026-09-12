import type { World, Input } from "../shared/game";
import type { Weapon } from "../shared/defs";
export interface Member {
  id: string;
  ready: boolean;
  connected: boolean;
  weapons?: Weapon[];
}
export interface NetworkSession {
  version: 1;
  endpoint: string;
  code: string;
  token: string;
}
export const NETWORK_SESSION_KEY = "swarm-front-session";
export function loadNetworkSession(
  storage: Pick<Storage, "getItem" | "removeItem"> = sessionStorage,
): NetworkSession | null {
  try {
    const value = JSON.parse(storage.getItem(NETWORK_SESSION_KEY) ?? "null");
    if (
      value?.version !== 1 ||
      typeof value.endpoint !== "string" ||
      !/^https?:\/\/[^\s]+$/.test(value.endpoint) ||
      !/^[a-f0-9]{32}$/.test(value.code) ||
      !/^[a-f0-9]{32}$/.test(value.token)
    )
      throw new Error("invalid session");
    return value as NetworkSession;
  } catch {
    try {
      storage.removeItem(NETWORK_SESSION_KEY);
    } catch {
      // Storage may be unavailable; joining still works for the current page.
    }
    return null;
  }
}
export class Network {
  ws: WebSocket | undefined;
  id = "";
  token = "";
  code = "";
  retry = 0;
  closed = false;
  last = 0;
  members: Member[] = [];
  stage = 1;
  preparing = false;
  onWorld: (w: World) => void = () => {};
  onLobby: () => void = () => {};
  onStatus: (s: string, fatal: boolean) => void = () => {};
  ready: () => void = () => {};
  timer: ReturnType<typeof setInterval>;
  equip: Weapon[] = [];
  constructor(public endpoint: string) {
    this.timer = setInterval(() => {
      if (this.ws?.readyState === 1 && this.id) this.send({ type: "ping" });
      if (this.ws?.readyState === 1 && Date.now() - this.last > 12000)
        this.ws.close();
    }, 5000);
  }
  async create(turnstileToken: string, localCreationKey = "") {
    const headers: Record<string, string> = {};
    if (turnstileToken) headers["X-Turnstile-Token"] = turnstileToken;
    if (localCreationKey) headers["X-Room-Creation-Key"] = localCreationKey;
    const res = await fetch(`${this.endpoint}/rooms`, {
      method: "POST",
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok)
      throw new Error(
        (await res.json()).error ?? "通信サーバーに接続できません",
      );
    return (await res.json()).code as string;
  }
  connect(code: string, token = "") {
    this.code = code;
    this.token = token;
    this.closed = false;
    this.last = Date.now();
    const ws = new WebSocket(
      `${this.endpoint.replace(/^http/, "ws")}/rooms/${code}`,
    );
    this.ws = ws;
    let welcomed = false;
    const timeout = setTimeout(() => {
      if (!welcomed) {
        ws.close();
        this.onStatus("接続がタイムアウトしました。装備画面に戻れます", false);
      }
    }, 7000);
    ws.onopen = () => {
      this.send({
        type: "hello",
        ...(this.token ? { token: this.token } : {}),
      });
    };
    ws.onmessage = (e) => {
      this.last = Date.now();
      let m;
      try {
        if (typeof e.data !== "string" || e.data.length > 65536) return;
        m = JSON.parse(e.data);
        if (!m || typeof m !== "object" || typeof m.type !== "string") return;
        if (
          m.type === "welcome" &&
          (typeof m.id !== "string" || typeof m.token !== "string")
        )
          return;
        if (
          (m.type === "state" || m.type === "lobby") &&
          (!Array.isArray(m.members) ||
            !m.members.every(
              (p: Member) =>
                p &&
                typeof p.id === "string" &&
                typeof p.connected === "boolean" &&
                typeof p.ready === "boolean",
            ))
        )
          return;
        if (
          m.type === "state" &&
          (!m.world ||
            !["battle", "victory", "defeat"].includes(m.world.phase) ||
            !Array.isArray(m.world.players) ||
            !Array.isArray(m.world.enemies))
        )
          return;
        if (
          (m.type === "error" || m.type === "notice") &&
          typeof m.reason !== "string"
        )
          return;
      } catch {
        return;
      }
      if (m.type === "welcome") {
        welcomed = true;
        clearTimeout(timeout);
        this.id = m.id;
        this.token = m.token;
        this.retry = 0;
        // Keep identity in this tab across reloads. Never put the token in URLs or logs.
        try {
          sessionStorage.setItem(
            NETWORK_SESSION_KEY,
            JSON.stringify({
              version: 1,
              endpoint: this.endpoint,
              code: this.code,
              token: this.token,
            } satisfies NetworkSession),
          );
        } catch {
          // A blocked/full session store must not break the live connection.
        }
        this.onStatus("接続済み", false);
        this.send({
          type: "equip",
          weapons: this.equip,
          ready: !this.preparing,
        });
        this.ready();
      } else if (m.type === "state") {
        this.members = m.members;
        this.onWorld(m.world);
      } else if (m.type === "lobby") {
        if (Number.isInteger(m.stage) && m.stage >= 1 && m.stage <= 10)
          this.stage = m.stage;
        this.members = m.members;
        this.onLobby();
      } else if (m.type === "error") {
        this.closed = true;
        try {
          sessionStorage.removeItem(NETWORK_SESSION_KEY);
        } catch {
          // The fatal server response is still shown when storage is unavailable.
        }
        this.onStatus(m.reason, true);
      } else if (m.type === "notice") this.onStatus(m.reason, false);
    };
    ws.onclose = (e) => {
      clearTimeout(timeout);
      if (this.closed) return;
      if (e.code >= 4000) {
        this.closed = true;
        this.onStatus(
          e.reason || "復帰できません。装備画面へ戻ってください",
          true,
        );
        return;
      }
      if (this.retry >= 5) {
        this.closed = true;
        this.onStatus("復帰できませんでした。装備画面へ戻ってください", true);
        return;
      }
      const wait = [500, 1000, 2000, 4000, 6000][this.retry++];
      this.onStatus(
        `通信切断 · 再接続 ${this.retry}/5（未確定品は勝利まで保存されません）`,
        false,
      );
      setTimeout(() => {
        if (!this.closed) this.connect(code, this.token);
      }, wait);
    };
    ws.onerror = () => {};
  }
  send(value: unknown) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(value));
  }
  input(input: Input) {
    this.send({ type: "input", input });
  }
  equipment(weapons: Weapon[]) {
    this.equip = weapons;
    this.send({ type: "equip", weapons, ready: !this.preparing });
  }
  preparation(preparing: boolean) {
    this.preparing = preparing;
    this.send({ type: "ready", ready: !preparing });
  }
  close() {
    this.closed = true;
    clearInterval(this.timer);
    this.ws?.close(1000, "退出");
    try {
      sessionStorage.removeItem(NETWORK_SESSION_KEY);
    } catch {
      // The socket is still closed when browser storage is unavailable.
    }
  }
}
