import { describe, it, expect } from "vitest";
import { playerVault, vaultSupplyProgress } from "../server/player-vault";
import { supplyVault } from "../server/supply-vault";
import {
  supplyMilestones,
  SUPPLY_GRANTS,
  type SupplyProgress,
} from "../src/shared/supply-grants";
import { SOLO_STAGE_IDS } from "../src/shared/campaign";
import { recordWeekly } from "../src/shared/weekly-missions";
import { freshProgress } from "../src/client/progression-save";
import { validSupplyCredit } from "../src/shared/supply-contract";
const token = "a".repeat(64);
const start = Date.parse("2026-11-15T14:59:00Z"); // Sunday JST
const post = (action: string, body: unknown, auth = token) =>
  new Request(`https://internal/${action}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
function fixture() {
  const rows = new Map<string, unknown>();
  let failing = false,
    progressFail = false,
    now = start;
  const store = (name: string) => ({
    async get<T>() {
      return structuredClone(rows.get(name)) as T | undefined;
    },
    async put(_k: string, v: unknown) {
      if (failing) throw Error("disk");
      rows.set(name, structuredClone(v));
    },
    async deleteAll() {
      rows.delete(name);
    },
  });
  const cloud = store("vault"),
    account = store("supply");
  const access = {
    open: async () => ({ grant: true }),
    progress: async () => {
      if (progressFail)
        return Response.json({ error: "temporary" }, { status: 503 });
      const r = await vaultSupplyProgress(
        post("cloud-supply-progress", {}),
        cloud,
      );
      return r.ok ? ((await r.json()) as SupplyProgress) : r;
    },
  };
  const supply = async (action = "daily", body = {}) => {
    const r = await supplyVault(
      post(`supply/${action}`, body),
      account,
      now,
      () => 0.2,
      access,
    );
    return { status: r.status, ...((await r.json()) as any) };
  };
  return {
    rows,
    cloud,
    account,
    access,
    supply,
    setNow: (n: number) => (now = n),
    setFail: (b: boolean) => (failing = b),
    setProgressFail: (b: boolean) => (progressFail = b),
    async init(save = freshProgress("normal")) {
      await playerVault(post("cloud/initialize", { save }), cloud, true, now);
      await supply("initialize");
    },
    async save(run: string, missions?: Record<string, boolean[]>) {
      const state = structuredClone(rows.get("vault")) as any;
      const save = state.save;
      save.receipts.push(run);
      save.weeklyPending = [run];
      if (missions) save.missions = missions;
      return playerVault(
        post("cloud/save", {
          save,
          version: state.version,
          basisVersion: state.version,
          mutation: crypto.randomUUID(),
        }),
        cloud,
        false,
        now,
      );
    },
    async claim(id: string) {
      const state = rows.get("vault") as any;
      return playerVault(
        post("cloud/weekly", { id, version: state.version }),
        cloud,
        false,
        now,
      );
    },
  };
}
describe("進行からの券の集計", () => {
  it("有限の187IDと320枚、偽キーを無視、週上限は既存記録と同じ", () => {
    const missions = Object.fromEntries(
      SOLO_STAGE_IDS.flatMap((id) =>
        ["normal", "medium"].map((d) => [`${id}:${d}`, [true, true, true]]),
      ),
    );
    const grants = supplyMilestones({
      ...missions,
      "999:normal": [true, true, true],
    });
    expect(grants).toHaveLength(187);
    expect(new Set(grants.map((g) => g.id)).size).toBe(187);
    expect(grants.reduce((n, g) => n + g.tickets, 0)).toBe(320);
    let s = { coins: 0 };
    for (let n = 0; n < 20; n++)
      s = recordWeekly(s, "campaign", `r${n}`, start);
    expect((s as any).weekly.campaign).toHaveLength(
      SUPPLY_GRANTS.weeklyClearCap,
    );
  });
  it("過去分を一度だけ付与し、保存巻戻し/再試行で増えない", async () => {
    const f = fixture(),
      s = freshProgress("normal");
    s.missions = { "1:normal": [true, true, true] };
    await f.init(s);
    expect(await f.supply()).toMatchObject({
      tickets: 17,
      credited: { past: 7, recent: 0 },
    });
    expect(await f.supply()).toMatchObject({
      tickets: 17,
      credited: { past: 0, recent: 0 },
    });
    expect((await f.save("new", {})).status).toBe(200);
    expect(await f.supply()).toMatchObject({
      tickets: 19,
      credited: { past: 0, recent: 2 },
    });
    await f.save("next", s.missions);
    expect((await f.supply()).tickets).toBe(20);
  });
  it("週10回、JST日/週またぎ、週間受領の再実行は増えない", async () => {
    const f = fixture();
    await f.init();
    for (let n = 0; n < 12; n++) await f.save(`run${n}`);
    expect((await f.supply()).tickets).toBe(21); // 10 clear + daily
    await f.claim("campaign-3");
    expect((await f.supply()).tickets).toBe(23);
    await f.claim("campaign-3");
    expect((await f.supply()).tickets).toBe(23);
    await f.claim("campaign-10");
    expect((await f.supply()).tickets).toBe(28);
    f.setNow(start + 120000); // Monday JST: new week + new day
    await f.save("monday");
    expect((await f.supply()).tickets).toBe(30);
    await f.save("monday2");
    expect((await f.supply()).tickets).toBe(31);
    f.setNow(start + 86400000 + 120000);
    await f.save("tuesday");
    expect((await f.supply()).tickets).toBe(33);
  });
  it("initializeのpendingだけ数え、日次ログイン・過去週は遡及しない", async () => {
    const f = fixture(),
      s = freshProgress("normal");
    s.receipts = ["one"];
    s.weeklyPending = ["one"];
    await f.init(s);
    expect((await f.supply()).tickets).toBe(12);
    f.setNow(start + 86400000);
    expect((await f.supply()).tickets).toBe(12);
    expect((f.rows.get("vault") as any).save.supplyEarned).toBeUndefined();
  });
  it("内部呼出し失敗・口座書込失敗でも減額せず再試行で追いつく", async () => {
    const f = fixture();
    await f.init();
    await f.save("one", { "1:normal": [true, false, false] });
    f.setProgressFail(true);
    expect((await f.supply()).status).toBe(503);
    expect((f.rows.get("supply") as any).tickets).toBe(10);
    f.setProgressFail(false);
    f.setFail(true);
    await expect(f.supply()).rejects.toThrow("disk");
    expect((f.rows.get("supply") as any).tickets).toBe(10);
    f.setFail(false);
    expect((await f.supply()).tickets).toBe(17);
    expect((await f.supply()).tickets).toBe(17);
  });
  it("保管庫書込失敗で券が増えず、未認証の進行参照も拒否", async () => {
    const f = fixture();
    await f.init();
    f.setFail(true);
    await expect(f.save("one")).rejects.toThrow("disk");
    f.setFail(false);
    expect((await f.supply()).tickets).toBe(10);
    expect(
      (
        await vaultSupplyProgress(
          post("cloud-supply-progress", {}, "b".repeat(64)),
          f.cloud,
        )
      ).status,
    ).toBe(401);
  });
  it("旧口座は進行付与なし、移行後の口座では遡及", async () => {
    const f = fixture(),
      s = freshProgress("normal");
    s.missions = { "1:normal": [true, false, false] };
    await f.init(s);
    const { cloudHash } = await import("../server/player-vault");
    const legacy = {
      credential: await cloudHash(token),
      tickets: 4,
      day: "2026-11-15",
      pending: null,
      acked: [],
    };
    await f.account.put("supply", legacy);
    const r = await supplyVault(
      post("supply/daily", {}),
      f.account,
      start + 86400000,
      () => 0.2,
      {},
    );
    expect(((await r.json()) as any).tickets).toBe(4);
    f.setNow(start + 86400000);
    expect((await f.supply()).tickets).toBe(9);
  });
  it("防衛週間報酬は3枚を一度だけ付与する", async () => {
    const f = fixture();
    await f.init();
    const state = f.rows.get("vault") as any;
    state.save.weekly = {
      week: "2026-11-09",
      campaign: [],
      defense: ["a", "b", "c"],
      claimed: [],
    };
    f.rows.set("vault", state);
    await f.claim("defense-3");
    expect((await f.supply()).tickets).toBe(13);
    await f.claim("defense-3");
    expect((await f.supply()).tickets).toBe(13);
  });
  it("付与レスポンスの整数検査", () => {
    expect(validSupplyCredit(undefined)).toBe(true);
    expect(validSupplyCredit({ past: 2, recent: 0 })).toBe(true);
    for (const v of [
      null,
      [],
      { past: -1, recent: 0 },
      { past: 1, recent: 0.1 },
      { past: 0 },
    ])
      expect(validSupplyCredit(v)).toBe(false);
  });
});
