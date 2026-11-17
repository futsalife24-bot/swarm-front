// In-memory stand-in for the Worker's supply/cloud routing (server/worker.ts):
// each Durable Object is a separate Map, routed exactly like Gate.fetch.
import {
  cloudHash,
  playerVault,
  vaultSupplyGrant,
  vaultSupplyProgress,
} from "../server/player-vault";
import { supplyVault, type SupplyAccess } from "../server/supply-vault";
import { freshProgress } from "../src/client/progression-save";

const hex = () => crypto.randomUUID().replaceAll("-", "");

export function supplyWorld(
  start = Date.parse("2026-11-11T00:00:00Z"),
  rng = () => 0.2,
) {
  let now = start;
  const objects = new Map<string, Map<string, unknown>>();
  const store = (name: string) => {
    let values = objects.get(name);
    if (!values) objects.set(name, (values = new Map()));
    const map = values;
    return {
      async get<T>(key: string) {
        return structuredClone(map.get(key)) as T | undefined;
      },
      async put(key: string, value: unknown) {
        map.set(key, structuredClone(value));
      },
      async deleteAll() {
        map.clear();
      },
    };
  };
  const post = (url: string, auth: string, body: unknown) =>
    new Request(url, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const cloudAccess = (vaultId: string, auth: string): SupplyAccess => ({
    progress: async () => {
      const response = await vaultSupplyProgress(
        new Request("https://internal/cloud-supply-progress", {
          headers: { Authorization: auth },
        }),
        store("cloud/" + vaultId),
      );
      if (!response.ok) return response;
      return (await response.json()) as import("../src/shared/supply-grants").SupplyProgress;
    },
    open: async (claim) => {
      const granted = await vaultSupplyGrant(
        post("https://internal/cloud-supply-grant", auth, { claim }),
        store("cloud/" + vaultId),
      );
      if (!granted.ok) return granted;
      return (await granted.json()) as { grant: boolean };
    },
  });
  const legacyAccess = (legacyId: string): SupplyAccess => ({
    legacyId,
    migrate: (vault, transfer) =>
      supplyVault(
        post(
          `https://internal/supply-cloud/${vault.id}/absorb`,
          "Bearer " + vault.token,
          transfer,
        ),
        store("supply-cloud/" + vault.id),
        now,
        rng,
        cloudAccess(vault.id, "Bearer " + vault.token),
      ),
  });
  let requests = 0;
  const request = (async (url: string, init: RequestInit = {}) => {
    requests++;
    const req = new Request(new URL(url, "https://game.example"), init);
    const match =
      /^\/api\/supply\/(?:(cloud)\/)?([a-f0-9]{32})\/([a-z]+)$/.exec(
        new URL(req.url).pathname,
      );
    if (!match)
      return Response.json({ error: "見つかりません" }, { status: 404 });
    const auth = req.headers.get("Authorization") ?? "";
    return match[1]
      ? supplyVault(
          req,
          store("supply-cloud/" + match[2]),
          now,
          rng,
          cloudAccess(match[2], auth),
        )
      : supplyVault(
          req,
          store("supply/" + match[2]),
          now,
          rng,
          legacyAccess(match[2]),
        );
  }) as typeof fetch;
  return {
    request,
    get requests() {
      return requests;
    },
    setNow(next: number) {
      now = next;
    },
    /** POST /api/cloud/create と同じく、サーバーが保管庫IDとトークンを発行する。 */
    async createVault(save = freshProgress("normal")) {
      const id = hex(),
        token = hex() + hex();
      const res = await playerVault(
        post("https://internal/cloud-initialize", "Bearer " + token, { save }),
        store("cloud/" + id),
        true,
        now,
      );
      if (!res.ok) throw Error("vault");
      return `SF1-${id}-${token}`;
    },
    async deleteVault(code: string) {
      const [, id, token] = code.split("-");
      await playerVault(
        post("https://internal/cloud/delete", "Bearer " + token, {}),
        store("cloud/" + id),
        false,
        now,
      );
    },
    /** 変更前に作られた旧方式（端末生成）の補給口座。 */
    async legacyAccount(tickets: number, day = "2026-11-11") {
      const id = hex(),
        token = hex() + hex();
      await store("supply/" + id).put("supply", {
        credential: await cloudHash(token),
        tickets,
        day,
        pending: null,
        acked: [],
      });
      return { id, token };
    },
    vaultRow(code: string) {
      return objects.get("cloud/" + code.split("-")[1])?.get("vault") as
        Record<string, unknown> | undefined;
    },
  };
}

export function memoryLocal() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  };
}
