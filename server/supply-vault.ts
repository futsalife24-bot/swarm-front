import {
  supplyMilestones,
  type SupplyProgress,
} from "../src/shared/supply-grants";
import { japanDay } from "../src/shared/calendar";
import { drawSupply, SUPPLY_RULES } from "../src/shared/supply-policy";
import {
  supplyRequestId,
  type SupplyReceipt,
  type SupplySnapshot,
} from "../src/shared/supply-contract";
import { cloudBody, cloudHash, cloudReply } from "./player-vault";

/*
 * Supply accounts and the one-time initial grant (F-17 H-1).
 *
 * New accounts are bound to a cloud vault: the account object is addressed by
 * the server-issued vault ID and authenticated with the vault token. The vault
 * itself records which account consumed its initial grant (`supplyGrant`), so
 * clearing the device-side supply link and re-initializing never grants again.
 *
 * Legacy accounts (device-generated ID/token, created before this change) keep
 * working, can no longer be created, and migrate their balance into the vault
 * account exactly once. A migration marks the vault as already granted.
 *
 * Accepted scope (owner decision 2026-11-17): deleting the cloud vault itself
 * (or abandoning it and creating another one) yields a new vault ID and can be
 * granted again. That also discards the player's cloud save, and vault creation
 * stays limited by cloudAdmission; it is deliberately not prevented here.
 */

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
  /** Legacy account: vault ID that received this balance. Frozen afterwards. */
  migratedTo?: string;
  /** Vault account: legacy account IDs already merged (idempotent migration). */
  absorbed?: string[];
  granted?: string[];
  collected?: number;
}

export interface SupplyTransfer {
  legacy: string;
  tickets: number;
  day: string;
}

export interface SupplyAccess {
  progress?: () => Promise<SupplyProgress | Response>;
  /**
   * Vault-bound account only. Verifies the vault credential and consumes the
   * vault's initial grant for `claim`. Absent for legacy accounts, which can
   * therefore never be created again.
   */
  open?: (claim: string) => Promise<{ grant: boolean } | Response>;
  /** Legacy account only: deliver this balance to the vault-bound account. */
  migrate?: (
    vault: { id: string; token: string },
    transfer: SupplyTransfer,
  ) => Promise<Response>;
  /** Legacy account ID (the object name), used as the migration dedupe key. */
  legacyId?: string;
}

// Keep the exact replay ledger bounded, matching the existing recruit ledger.
// Never evict old IDs and permit a previously spent draw to consume again.
const MAX_ACKED_IDS = 10_000;
const MAX_ABSORBED = 64;

const bodyIs = (body: Record<string, unknown>, keys: string[]) =>
  !!body &&
  typeof body === "object" &&
  !Array.isArray(body) &&
  Object.keys(body).length === keys.length &&
  keys.every((key) => Object.hasOwn(body, key));

const unauthorized = () =>
  cloudReply({ error: "補給認証を確認してください" }, 401);

export async function supplyVault(
  req: Request,
  storage: SupplyStorage,
  now = Date.now(),
  rng: () => number = () =>
    crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
  access: SupplyAccess = {},
) {
  const action = new URL(req.url).pathname.split("/").pop();
  const auth = req.headers.get("Authorization") ?? "";
  if (!/^Bearer [a-f0-9]{64}$/.test(auth)) return unauthorized();
  const credential = await cloudHash(auth.slice(7));
  const day = japanDay(now);
  let state = await storage.get<SupplyState>("supply");
  const snapshot = (): SupplySnapshot => ({
    tickets: state!.tickets,
    day: state!.day,
    pending: state!.pending,
  });

  if (action === "absorb" && req.method === "POST") {
    if (!access.open) return cloudReply({ error: "見つかりません" }, 404);
    const body = await cloudBody(req);
    if (
      !bodyIs(body, ["legacy", "tickets", "day"]) ||
      typeof body.legacy !== "string" ||
      !/^[a-f0-9]{32}$/.test(body.legacy) ||
      !Number.isSafeInteger(body.tickets) ||
      Number(body.tickets) < 0 ||
      typeof body.day !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(body.day)
    )
      return cloudReply({ error: "移行指定が不正です" }, 400);
    if (!state) {
      // The legacy account already received its initial grant before this
      // change: mark the vault as granted and do not add another one.
      const opened = await access.open(`legacy:${body.legacy}`);
      if (opened instanceof Response) return opened;
      state = {
        credential,
        tickets: 0,
        day: body.day,
        pending: null,
        acked: [],
        absorbed: [],
      };
    } else if (state.credential !== credential) return unauthorized();
    const absorbed = (state.absorbed ??= []);
    if (!absorbed.includes(body.legacy)) {
      if (absorbed.length >= MAX_ABSORBED)
        return cloudReply({ error: "補給口座の移行上限です" }, 409);
      absorbed.push(body.legacy);
      state.tickets += Number(body.tickets);
      // Never re-open today's daily ticket by merging an older account day.
      if (body.day > state.day) state.day = body.day;
      await storage.put("supply", state);
    }
    return cloudReply(snapshot());
  }

  if (action === "initialize" && req.method === "POST") {
    const body = await cloudBody(req);
    if (!bodyIs(body, [])) return cloudReply({ error: "指定が不正です" }, 400);
    if (!state) {
      // Device-generated legacy accounts can no longer be created. `retired`
      // tells the client to drop the link and use the vault-bound account.
      if (!access.open)
        return cloudReply(
          { error: "補給はクラウド保存から開始してください", retired: true },
          401,
        );
      const opened = await access.open("cloud");
      if (opened instanceof Response) return opened;
      state = {
        credential,
        tickets: opened.grant ? SUPPLY_RULES.initialTickets : 0,
        day,
        pending: null,
        acked: [],
      };
      await storage.put("supply", state);
    } else if (state.credential !== credential) {
      return unauthorized();
    }
  } else if (!state || state.credential !== credential) {
    return unauthorized();
  }
  if (!state) return cloudReply({ error: "補給データがありません" }, 404);

  if (action === "migrate" && req.method === "POST") {
    if (!access.migrate || !access.legacyId)
      return cloudReply({ error: "見つかりません" }, 404);
    const body = await cloudBody(req);
    const code =
      bodyIs(body, ["cloud"]) && typeof body.cloud === "string"
        ? /^SF1-([a-f0-9]{32})-([a-f0-9]{64})$/.exec(body.cloud)
        : null;
    if (!code) return cloudReply({ error: "移行指定が不正です" }, 400);
    if (state.migratedTo && state.migratedTo !== code[1])
      return cloudReply(
        { error: "補給券は別のクラウド保存へ移行済みです", retired: true },
        409,
      );
    if (state.pending)
      return cloudReply({ error: "前回の補給を受け取ってください" }, 409);
    // Retries resend the same transfer; the vault account dedupes by legacy ID.
    const moved = await access.migrate(
      { id: code[1], token: code[2] },
      { legacy: access.legacyId, tickets: state.tickets, day: state.day },
    );
    if (!moved.ok) return moved;
    if (!state.migratedTo) {
      state.migratedTo = code[1];
      state.tickets = 0;
      await storage.put("supply", state);
    }
    return cloudReply({ ...((await moved.json()) as object), migrated: true });
  }
  if (state.migratedTo)
    return cloudReply(
      { error: "補給券はクラウド保存へ移行済みです", retired: true },
      409,
    );

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
    let credited: SupplySnapshot["credited"];
    if (access.progress) {
      const progress = await access.progress();
      if (progress instanceof Response) return progress;
      if (
        !Number.isSafeInteger(progress.earned) ||
        progress.earned < 0 ||
        !progress.missions ||
        typeof progress.missions !== "object" ||
        Array.isArray(progress.missions)
      )
        return cloudReply({ error: "進行記録を確認できません" }, 502);
      const granted = new Set(state.granted ?? []);
      const fresh = supplyMilestones(progress.missions).filter(
        (g) => !granted.has(g.id),
      );
      const past = fresh.reduce((sum, g) => sum + g.tickets, 0);
      const recent = Math.max(0, progress.earned - (state.collected ?? 0));
      for (const grant of fresh) granted.add(grant.id);
      if (past || recent || state.day < day) {
        state.granted = [...granted];
        state.collected = Math.max(state.collected ?? 0, progress.earned);
        state.tickets += past + recent;
        state.day = day;
        await storage.put("supply", state);
      }
      credited = { past, recent };
    } else if (state.day < day) {
      state.day = day;
      state.tickets += SUPPLY_RULES.dailyTickets;
      await storage.put("supply", state);
    }
    return cloudReply({ ...snapshot(), ...(credited ? { credited } : {}) });
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
