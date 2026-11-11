import {
  validSupplyReceipt,
  supplyRequestId,
  type SupplySnapshot,
} from "../shared/supply-contract";

const KEY = "swarm-front-supply-link-v1";
interface Link {
  id: string;
  token: string;
  request?: { requestId: string; count: 1 | 10; phase: "draw" | "ack" };
}
type StorageIO = Pick<Storage, "getItem" | "setItem">;

export function createSupplyService(
  storage: StorageIO = localStorage,
  request: typeof fetch = fetch,
) {
  const read = (): Link => {
    const raw = storage.getItem(KEY);
    if (raw) {
      const link = JSON.parse(raw) as Link;
      if (
        !/^[a-f0-9]{32}$/.test(link.id) ||
        !/^[a-f0-9]{64}$/.test(link.token) ||
        (link.request &&
          (!supplyRequestId(link.request.requestId) ||
            ![1, 10].includes(link.request.count) ||
            !["draw", "ack"].includes(link.request.phase)))
      )
        throw Error("補給券の接続情報を読めません。上書きを停止しました");
      return link;
    }
    const hex = () => crypto.randomUUID().replaceAll("-", "");
    const link = { id: hex(), token: hex() + hex() };
    // 応答を失っても同じIDへ再接続する。保存できない端末では口座を作らない。
    storage.setItem(KEY, JSON.stringify(link));
    return link;
  };
  const write = (link: Link) => storage.setItem(KEY, JSON.stringify(link));
  const call = async (
    action: string,
    body?: object,
  ): Promise<SupplySnapshot> => {
    const link = read();
    const response = await request(`/api/supply/${link.id}/${action}`, {
      method: body === undefined ? "GET" : "POST",
      cache: "no-store",
      credentials: "same-origin",
      signal: AbortSignal.timeout(12000),
      headers: {
        Authorization: "Bearer " + link.token,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = (await response.json()) as SupplySnapshot & { error?: string };
    if (!response.ok)
      throw Error(data.error || "補給に接続できません。再試行してください");
    if (
      !Number.isSafeInteger(data.tickets) ||
      data.tickets < 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.day) ||
      (data.pending !== null && !validSupplyReceipt(data.pending))
    )
      throw Error("補給の確定結果を読めません。再試行してください");
    return data;
  };
  return {
    async status() {
      await call("initialize", {});
      const state = await call("daily", {});
      const link = read();
      // 保存成功後のACK応答だけを失った場合。未送信drawのIDは消さない。
      if (!state.pending && link.request?.phase === "ack") {
        delete link.request;
        write(link);
      }
      return state;
    },
    async draw(count: 1 | 10) {
      const link = read();
      if (
        link.request &&
        (link.request.count !== count || link.request.phase !== "draw")
      )
        throw Error("先に前回の補給を再確認してください");
      link.request ??= { requestId: crypto.randomUUID(), count, phase: "draw" };
      write(link);
      return call("draw", { requestId: link.request.requestId, count });
    },
    async acknowledge(requestId: string) {
      const link = read();
      // ACKの再送をdrawの再送と区別する。受領保存の後にだけ呼ぶ。
      link.request = {
        requestId,
        count: link.request?.count ?? 1,
        phase: "ack",
      };
      write(link);
      const state = await call("ack", { requestId });
      const latest = read();
      if (latest.request?.requestId === requestId) {
        delete latest.request;
        write(latest);
      }
      return state;
    },
    pendingRequest() {
      return read().request;
    },
  };
}
