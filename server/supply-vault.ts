import { japanDay } from "../src/shared/calendar";
import { drawSupply, SUPPLY_RULES } from "../src/shared/supply-policy";
import {
  supplyRequestId,
  type SupplyReceipt,
  type SupplySnapshot,
} from "../src/shared/supply-contract";
import { cloudBody, cloudHash, cloudReply } from "./player-vault";

export interface SupplyStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
}

interface SupplyState {
  credential: string;
  tickets: number;
  day: string;
  pending: SupplyReceipt | null;
  /** Exact, persistent replay ledger. Never evict IDs: an old draw cannot spend again. */
  acked: string[];
}

// Keep the exact replay ledger bounded, matching the existing recruit ledger.
// Never evict old IDs and permit a previously spent draw to consume again.
const MAX_ACKED_IDS = 10_000;

const bodyIs = (body: Record<string, unknown>, keys: string[]) =>
  !!body &&
  typeof body === "object" &&
  !Array.isArray(body) &&
  Object.keys(body).length === keys.length &&
  keys.every((key) => Object.hasOwn(body, key));

export async function supplyVault(
  req: Request,
  storage: SupplyStorage,
  now = Date.now(),
  rng: () => number = () =>
    crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
) {
  const action = new URL(req.url).pathname.split("/").pop();
  const auth = req.headers.get("Authorization") ?? "";
  if (!/^Bearer [a-f0-9]{64}$/.test(auth))
    return cloudReply({ error: "補給認証を確認してください" }, 401);
  const credential = await cloudHash(auth.slice(7));
  const day = japanDay(now);
  let state = await storage.get<SupplyState>("supply");
  if (action === "initialize" && req.method === "POST") {
    const body = await cloudBody(req);
    if (!bodyIs(body, [])) return cloudReply({ error: "指定が不正です" }, 400);
    if (!state) {
      state = {
        credential,
        tickets: SUPPLY_RULES.initialTickets,
        day,
        pending: null,
        acked: [],
      };
      await storage.put("supply", state);
    } else if (state.credential !== credential) {
      return cloudReply({ error: "補給認証を確認してください" }, 401);
    }
  } else if (!state || state.credential !== credential) {
    return cloudReply({ error: "補給認証を確認してください" }, 401);
  }
  if (!state) return cloudReply({ error: "補給データがありません" }, 404);
  const snapshot = (): SupplySnapshot => ({
    tickets: state!.tickets,
    day: state!.day,
    pending: state!.pending,
  });
  if (action === "initialize" && req.method === "POST")
    return cloudReply(snapshot());
  if (action === "status" && req.method === "GET")
    return cloudReply(snapshot());
  if (req.method !== "POST")
    return cloudReply({ error: "操作が違います" }, 405);
  const body = await cloudBody(req);
  if (action === "daily") {
    if (!bodyIs(body, [])) return cloudReply({ error: "指定が不正です" }, 400);
    if (state.day > day)
      return cloudReply({ error: "日付を確認してください" }, 409);
    if (state.day < day) {
      state.day = day;
      state.tickets += SUPPLY_RULES.dailyTickets;
      await storage.put("supply", state);
    }
    return cloudReply(snapshot());
  }
  if (action === "draw") {
    if (
      !bodyIs(body, ["requestId", "count"]) ||
      !supplyRequestId(body.requestId) ||
      (body.count !== 1 && body.count !== 10)
    )
      return cloudReply({ error: "抽選指定が不正です" }, 400);
    if (state.pending) {
      if (
        state.pending.requestId === body.requestId &&
        state.pending.count === body.count
      )
        return cloudReply(snapshot());
      return cloudReply({ error: "前回の補給を受け取ってください" }, 409);
    }
    if (state.acked.includes(body.requestId))
      return cloudReply({ error: "使用済みの抽選IDです" }, 409);
    if (state.acked.length >= MAX_ACKED_IDS)
      return cloudReply({ error: "補給履歴の上限です" }, 409);
    const cost =
      body.count === 10 ? SUPPLY_RULES.tenCost : SUPPLY_RULES.singleCost;
    if (state.tickets < cost)
      return cloudReply({ error: "補給券が足りません" }, 409);
    const receipt = drawSupply(body.count, body.requestId, now, rng);
    state.tickets -= cost;
    state.pending = receipt;
    await storage.put("supply", state);
    return cloudReply(snapshot());
  }
  if (action === "ack") {
    if (!bodyIs(body, ["requestId"]) || !supplyRequestId(body.requestId))
      return cloudReply({ error: "受領指定が不正です" }, 400);
    if (state.acked.includes(body.requestId)) return cloudReply(snapshot());
    if (state.pending?.requestId !== body.requestId)
      return cloudReply({ error: "未受領の補給がありません" }, 409);
    state.acked.push(body.requestId);
    state.pending = null;
    await storage.put("supply", state);
    return cloudReply(snapshot());
  }
  return cloudReply({ error: "見つかりません" }, 404);
}
