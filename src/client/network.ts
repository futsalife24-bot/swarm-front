import {
  DEFAULT_PLAYER_NAME,
  CHAT_HISTORY_LIMIT,
  normalizePlayerName,
  normalizeChatText,
  isChatMessage,
  type ChatMessage,
} from "../shared/social";
import type { World, Input } from "../shared/game";
import type { Weapon } from "../shared/defs";
import { validStage } from "../shared/stages";
import { EquipmentCache } from "../shared/state-wire";
import type { RoomOptions } from "../shared/room-directory";
export interface Member {
  id: string;
  name?: string;
  ready: boolean;
  connected: boolean;
  weapons?: Weapon[];
}
export interface NetworkSession {
  version: 1;
  endpoint: string;
  code: string;
  token: string;
  expiresAt?: number;
}
export const NETWORK_SESSION_KEY = "swarm-front-session";
export function clearNetworkSession() {
  try {
    sessionStorage.removeItem(NETWORK_SESSION_KEY);
  } catch {
    // Navigation/socket cleanup still works when storage is unavailable.
  }
  try {
    localStorage.removeItem(NETWORK_SESSION_KEY);
  } catch {
    /* Keep cleanup best-effort. */
  }
}
export function loadNetworkSession(
  storage?: Pick<Storage, "getItem" | "removeItem">,
): NetworkSession | null {
  if (!storage) {
    try {
      const inTab = loadNetworkSession(sessionStorage);
      if (inTab) return inTab;
      const saved = loadNetworkSession(localStorage);
      return saved?.expiresAt ? saved : null;
    } catch {
      return null;
    }
  }
  try {
    const value = JSON.parse(storage.getItem(NETWORK_SESSION_KEY) ?? "null");
    if (
      value?.version !== 1 ||
      typeof value.endpoint !== "string" ||
      !/^https?:\/\/[^\s]+$/.test(value.endpoint) ||
      !/^[a-f0-9]{32}$/.test(value.code) ||
      !/^[a-f0-9]{32}$/.test(value.token) ||
      (value.expiresAt !== undefined &&
        (!Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()))
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
  roomId = "";
  roomName = "";
  retry = 0;
  closed = false;
  last = 0;
  members: Member[] = [];
  stage = 1;
  preparing = false;
  assetReady = false;
  preparationGeneration = 0;
  playerName = DEFAULT_PLAYER_NAME;
  messages: ChatMessage[] = [];
  onChat: () => void = () => {};
  onWorld: (w: World) => void = () => {};
  onLobby: () => void = () => {};
  onStatus: (s: string, fatal: boolean) => void = () => {};
  ready: () => void = () => {};
  timer: ReturnType<typeof setInterval>;
  equip: Weapon[] = [];
  private inputAt = -Infinity;
  private pendingInput: Input | undefined;
  private usesInputAck = false;
  private inFlightInputs: number[] = [];
  constructor(public endpoint: string) {
    this.timer = setInterval(() => {
      if (this.ws?.readyState === 1 && this.id) this.send({ type: "ping" });
      if (this.ws?.readyState === 1 && Date.now() - this.last > 12000)
        this.ws.close();
    }, 5000);
  }
  async create(
    turnstileToken: string,
    localCreationKey = "",
    options?: RoomOptions,
  ) {
    const headers: Record<string, string> = {};
    if (turnstileToken) headers["X-Turnstile-Token"] = turnstileToken;
    if (localCreationKey) headers["X-Room-Creation-Key"] = localCreationKey;
    const res = await fetch(`${this.endpoint}/rooms`, {
      method: "POST",
      headers,
      body: options ? JSON.stringify(options) : undefined,
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
    if (this.code !== code) {
      this.messages = [];
      this.members = [];
      this.assetReady = false;
    }
    this.assetReady = false;
    this.code = code;
    this.token = token;
    this.closed = false;
    this.last = Date.now();
    const ws = new WebSocket(
      `${this.endpoint.replace(/^http/, "ws")}/rooms/${code}`,
    );
    this.ws = ws;
    this.inputAt = -Infinity;
    this.pendingInput = undefined;
    this.usesInputAck = false;
    this.inFlightInputs = [];
    const equipmentCache = new EquipmentCache();
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
        equipmentCache: 1,
        name: this.playerName,
        ...(this.token ? { token: this.token } : {}),
      });
    };
    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
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
          (!Number.isSafeInteger(m.preparationGeneration) ||
            m.preparationGeneration < 0 ||
            !Array.isArray(m.members) ||
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
      if (
        m.type === "state" &&
        !equipmentCache.restore(m.world, m.equipmentCached === true)
      ) {
        ws.close(); // A fresh connection always starts with complete equipment.
        return;
      }
      if (m.type === "state" || m.type === "lobby") {
        if (this.preparationGeneration !== m.preparationGeneration) {
          this.preparationGeneration = m.preparationGeneration;
          this.assetReady = false;
        }
      }
      if (m.type === "welcome") {
        welcomed = true;
        clearTimeout(timeout);
        this.id = m.id;
        this.usesInputAck = m.inputAck === true;
        this.roomId = typeof m.roomId === "string" ? m.roomId : "";
        this.roomName = typeof m.roomName === "string" ? m.roomName : "";
        this.token = m.token;
        this.retry = 0;
        // Keep identity in this tab across reloads. Never put the token in URLs or logs.
        try {
          const stored = JSON.stringify({
            version: 1,
            endpoint: this.endpoint,
            code: this.code,
            token: this.token,
            expiresAt: Date.now() + 60 * 60 * 1000,
          } satisfies NetworkSession);
          sessionStorage.setItem(NETWORK_SESSION_KEY, stored);
          localStorage.setItem(NETWORK_SESSION_KEY, stored);
        } catch {
          // A blocked/full session store must not break the live connection.
        }
        this.onStatus("接続済み", false);
        this.send({
          type: "equip",
          weapons: this.equip,
          ready: !this.preparing && this.assetReady,
          stage: this.stage,
          preparationGeneration: this.preparationGeneration,
        });
        this.ready();
      } else if (m.type === "state") {
        if (this.usesInputAck && Number.isSafeInteger(m.inputAck))
          this.inFlightInputs = this.inFlightInputs.filter(
            (seq) => seq > m.inputAck,
          );
        if (validStage(m.stage) && this.stage !== m.stage) {
          this.stage = m.stage;
          this.assetReady = false;
        }
        this.members = m.members;
        this.onWorld(m.world);
      } else if (m.type === "lobby") {
        if (validStage(m.stage) && this.stage !== m.stage) {
          this.stage = m.stage;
          this.assetReady = false;
        }
        this.members = m.members;
        this.onLobby();
      } else if (m.type === "chatHistory" && Array.isArray(m.messages)) {
        this.messages = m.messages
          .filter(isChatMessage)
          .slice(-CHAT_HISTORY_LIMIT);
        this.onChat();
      } else if (m.type === "chat" && isChatMessage(m.message)) {
        if (!this.messages.some((entry) => entry.id === m.message.id))
          this.messages = [...this.messages, m.message].slice(
            -CHAT_HISTORY_LIMIT,
          );
        this.onChat();
      } else if (m.type === "error") {
        this.closed = true;
        try {
          clearNetworkSession();
        } catch {
          // The fatal server response is still shown when storage is unavailable.
        }
        this.onStatus(m.reason, true);
      } else if (m.type === "notice") this.onStatus(m.reason, false);
    };
    ws.onclose = (e) => {
      clearTimeout(timeout);
      if (this.closed || this.ws !== ws) return;
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
    if (this.ws?.readyState !== 1) return;
    const pending = this.pendingInput;
    this.pendingInput = {
      ...input,
      reload: input.reload || !!pending?.reload,
      swap: input.swap || !!pending?.swap,
      dodge: input.dodge || !!pending?.dodge,
    };
    const now = performance.now();
    // Rendering stalls must not produce a burst of catch-up packets. Keep taps.
    if (
      now - this.inputAt < 50 ||
      this.ws.bufferedAmount > 4096 ||
      (this.usesInputAck && this.inFlightInputs.length >= 4)
    )
      return;
    this.send({ type: "input", input: this.pendingInput });
    if (this.usesInputAck) this.inFlightInputs.push(this.pendingInput.seq);
    this.inputAt = now;
    this.pendingInput = undefined;
  }
  equipment(weapons: Weapon[]) {
    this.equip = weapons;
    this.assetReady = false;
    this.send({
      type: "equip",
      weapons,
      ready: !this.preparing && this.assetReady,
      stage: this.stage,
      preparationGeneration: this.preparationGeneration,
    });
  }
  preparation(preparing: boolean) {
    this.preparing = preparing;
    this.send({
      type: "ready",
      ready: !preparing && this.assetReady,
      stage: this.stage,
      preparationGeneration: this.preparationGeneration,
    });
  }
  setAssetReady(ready: boolean, generation = this.preparationGeneration) {
    if (generation !== this.preparationGeneration) return;
    this.assetReady = ready;
    this.send({
      type: "ready",
      ready: ready && !this.preparing,
      stage: this.stage,
      preparationGeneration: this.preparationGeneration,
    });
  }
  setPlayerName(name: string) {
    this.playerName = normalizePlayerName(name) || DEFAULT_PLAYER_NAME;
    if (this.id) this.send({ type: "profile", name: this.playerName });
  }
  private chatSentAt = 0;
  sendChat(text: string): boolean {
    const normalized = normalizeChatText(text);
    if (
      !normalized ||
      !this.id ||
      this.closed ||
      this.ws?.readyState !== 1 ||
      Date.now() - this.chatSentAt < 1100
    )
      return false;
    this.chatSentAt = Date.now();
    this.send({ type: "chat", text: normalized });
    return true;
  }
  close() {
    this.closed = true;
    clearInterval(this.timer);
    this.ws?.close(1000, "退出");
    clearNetworkSession();
  }
}
