import {
  validSupplyReceipt,
  validSupplyCredit,
  supplyRequestId,
  type SupplySnapshot,
} from "../shared/supply-contract";
import { transferCode } from "./cloud-save";

/** 旧方式: 端末生成の補給口座。新規作成は不可、残高はクラウド保存へ1回だけ移行する。 */
const LEGACY = "swarm-front-supply-link-v1";
/** クラウド保存に紐づく補給口座の未完了要求。口座自体は引き継ぎコードで決まる。 */
const KEY = "swarm-front-supply-cloud-v1";
type PendingRequest = {
  requestId: string;
  count: 1 | 10;
  phase: "draw" | "ack";
};
interface LegacyLink {
  id: string;
  token: string;
  request?: PendingRequest;
}
interface CloudLink {
  vault: string;
  request?: PendingRequest;
}
type StorageIO = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Account = {
  path: string;
  token: string;
  link: LegacyLink | CloudLink;
  save: (link: LegacyLink | CloudLink) => void;
};
export type SupplyError = Error & {
  status?: number;
  /** サーバーが旧口座の新規作成拒否・移行済みを返した。 */
  retired?: boolean;
  /** 補給券はクラウド保存に紐づく。未作成なら作成を案内する。 */
  cloudRequired?: boolean;
};

const validRequest = (request?: PendingRequest) =>
  !request ||
  (supplyRequestId(request.requestId) &&
    [1, 10].includes(request.count) &&
    ["draw", "ack"].includes(request.phase));

export function createSupplyService(
  storage: StorageIO = localStorage,
  request: typeof fetch = fetch,
  cloudCode: () => string | null = transferCode,
) {
  const broken = () =>
    Error("補給券の接続情報を読めません。上書きを停止しました");
  const readLegacy = (): LegacyLink | null => {
    const raw = storage.getItem(LEGACY);
    if (!raw) return null;
    const link = JSON.parse(raw) as LegacyLink;
    if (
      !/^[a-f0-9]{32}$/.test(link.id) ||
      !/^[a-f0-9]{64}$/.test(link.token) ||
      !validRequest(link.request)
    )
      throw broken();
    return link;
  };
  const vault = () => {
    const code = cloudCode();
    if (!code) return null;
    const match = /^SF1-([a-f0-9]{32})-([a-f0-9]{64})$/.exec(code);
    if (!match) throw broken();
    return { code, id: match[1], token: match[2] };
  };
  const cloudRequired = (): SupplyError =>
    Object.assign(
      Error(
        "補給券はクラウド保存に紐づきます。クラウド保存を作成すると初回10枚を受け取れます。",
      ),
      { cloudRequired: true },
    );
  const legacyAccount = (link: LegacyLink): Account => ({
    path: `/api/supply/${link.id}`,
    token: link.token,
    link,
    save: (next) => storage.setItem(LEGACY, JSON.stringify(next)),
  });
  const cloudAccount = (): Account => {
    const target = vault();
    if (!target) throw cloudRequired();
    const raw = storage.getItem(KEY);
    let link = raw ? (JSON.parse(raw) as CloudLink) : null;
    if (link && (typeof link.vault !== "string" || !validRequest(link.request)))
      throw broken();
    // 別のクラウド保存へ切り替えたら、前の口座の未完了要求を持ち込まない。
    if (link?.vault !== target.id) {
      link = { vault: target.id };
      storage.setItem(KEY, JSON.stringify(link));
    }
    return {
      path: `/api/supply/cloud/${target.id}`,
      token: target.token,
      link,
      save: (next) => storage.setItem(KEY, JSON.stringify(next)),
    };
  };
  /** 未移行の旧口座があればそれを使い、なければクラウド保存の口座。 */
  const account = () => {
    const legacy = readLegacy();
    return legacy ? legacyAccount(legacy) : cloudAccount();
  };
  const send = async (account: Account, action: string, body?: object) => {
    const response = await request(`${account.path}/${action}`, {
      method: body === undefined ? "GET" : "POST",
      cache: "no-store",
      credentials: "same-origin",
      signal: AbortSignal.timeout(12000),
      headers: {
        Authorization: "Bearer " + account.token,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = (await response.json()) as SupplySnapshot & {
      error?: string;
      retired?: boolean;
    };
    if (!response.ok)
      throw Object.assign(
        Error(data.error || "補給に接続できません。再試行してください"),
        { status: response.status, retired: data.retired === true },
      ) as SupplyError;
    return data;
  };
  const call = async (account: Account, action: string, body?: object) => {
    const data = await send(account, action, body);
    if (
      !Number.isSafeInteger(data.tickets) ||
      data.tickets < 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.day) ||
      (data.pending !== null && !validSupplyReceipt(data.pending))
    )
      throw Error("補給の確定結果を読めません。再試行してください");
    if (!validSupplyCredit(data.credited))
      throw Error("補給の付与内容を確認できません");
    return data as SupplySnapshot;
  };
  const clearAck = (target: Account, state: SupplySnapshot) => {
    // 保存成功後のACK応答だけを失った場合。未送信drawのIDは消さない。
    if (!state.pending && target.link.request?.phase === "ack") {
      delete target.link.request;
      target.save(target.link);
    }
  };
  /**
   * 旧口座の残高をクラウド保存の口座へ移す。保留中の補給・要求が残る間は
   * 旧口座のまま続け、受領が終わってから移行する。移行済み・作成拒否なら
   * 旧接続情報を外す。戻り値が状態なら旧口座で続行する。
   */
  const settleLegacy = async (
    legacy: LegacyLink,
  ): Promise<SupplySnapshot | null> => {
    const target = legacyAccount(legacy);
    try {
      let state = await call(target, "initialize", {});
      clearAck(target, state);
      const cloud = vault();
      if (!cloud || state.pending || legacy.request) {
        state = await call(target, "daily", {});
        clearAck(target, state);
        return state;
      }
      await send(target, "migrate", { cloud: cloud.code });
    } catch (error) {
      if (!(error as SupplyError).retired) throw error;
    }
    storage.removeItem(LEGACY);
    return null;
  };
  return {
    async status() {
      const legacy = readLegacy();
      if (legacy) {
        const state = await settleLegacy(legacy);
        if (state) return state;
      }
      const target = cloudAccount();
      await call(target, "initialize", {});
      const state = await call(target, "daily", {});
      clearAck(target, state);
      return state;
    },
    async draw(count: 1 | 10) {
      const target = account();
      const link = target.link;
      if (
        link.request &&
        (link.request.count !== count || link.request.phase !== "draw")
      )
        throw Error("先に前回の補給を再確認してください");
      link.request ??= { requestId: crypto.randomUUID(), count, phase: "draw" };
      target.save(link);
      return call(target, "draw", { requestId: link.request.requestId, count });
    },
    async acknowledge(requestId: string) {
      const target = account();
      // ACKの再送をdrawの再送と区別する。受領保存の後にだけ呼ぶ。
      target.link.request = {
        requestId,
        count: target.link.request?.count ?? 1,
        phase: "ack",
      };
      target.save(target.link);
      const state = await call(target, "ack", { requestId });
      const latest = account();
      if (latest.link.request?.requestId === requestId) {
        delete latest.link.request;
        latest.save(latest.link);
      }
      return state;
    },
    pendingRequest() {
      const legacy = readLegacy();
      if (legacy) return legacy.request;
      // クラウド保存の作成前は要求を持たない（作成案内はstatusで出す）。
      return vault() ? cloudAccount().link.request : undefined;
    },
  };
}
