import { describe, expect, it } from "vitest";
import { BUDDY_IDS } from "../src/shared/buddy-progression";
import { KINDS } from "../src/shared/defs";
import { validNewWeapon } from "../src/shared/progression";
import { validSupplyReceipt } from "../src/shared/supply-contract";
import { drawSupply, SUPPLY_RULES } from "../src/shared/supply-policy";
import { supplyVault, type SupplyStorage } from "../server/supply-vault";

const TOKEN = "a".repeat(64);
const OTHER = "b".repeat(64);
const ID1 = "12345678-1234-4123-8123-123456789abc";
const ID2 = "12345678-1234-4123-8123-123456789abd";
const ID3 = "12345678-1234-4123-8123-123456789abe";
const DAY1 = Date.parse("2026-11-11T14:59:59Z");
const DAY2 = Date.parse("2026-11-11T15:00:00Z");

function memory() {
  let row: unknown;
  let writes = 0;
  const storage: SupplyStorage = {
    async get<T>() {
      return row === undefined ? undefined : (structuredClone(row) as T);
    },
    async put(_key, value) {
      row = structuredClone(value);
      writes++;
    },
  };
  return {
    storage,
    get writes() {
      return writes;
    },
    get row() {
      return structuredClone(row);
    },
  };
}

async function call(
  storage: SupplyStorage,
  action: string,
  body: unknown = {},
  now = DAY1,
  token = TOKEN,
  method = "POST",
  rng = () => 0.2,
) {
  const req = new Request(`https://internal/supply/${action}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
  const response = await supplyVault(req, storage, now, rng);
  return {
    status: response.status,
    body: (await response.json()) as Record<string, any>,
  };
}

describe("補給券の権威保存", () => {
  it("初回10枚、同一資格の再試行、別資格拒否、JST日跨ぎで1枚のみ", async () => {
    const db = memory();
    expect((await call(db.storage, "initialize")).body).toMatchObject({
      tickets: 10,
      day: "2026-11-11",
      pending: null,
    });
    expect((await call(db.storage, "initialize")).body.tickets).toBe(10);
    expect(db.writes).toBe(1);
    expect((await call(db.storage, "initialize", {}, DAY1, OTHER)).status).toBe(
      401,
    );
    expect(
      (await call(db.storage, "status", {}, DAY1, TOKEN, "GET")).body.tickets,
    ).toBe(10);
    expect((await call(db.storage, "daily", {}, DAY1)).body.tickets).toBe(10);
    expect((await call(db.storage, "daily", {}, DAY2)).body).toMatchObject({
      tickets: 11,
      day: "2026-11-12",
    });
    expect(
      (await call(db.storage, "daily", {}, DAY2 + 2 * 86400000)).body.tickets,
    ).toBe(12);
    expect((await call(db.storage, "daily", {}, DAY1)).status).toBe(409);
    expect(db.writes).toBe(3);
  });

  it("1回/10連は一括消費し、同一要求は同じ受領書、別要求はACKまで拒否", async () => {
    const db = memory();
    await call(db.storage, "initialize");
    const first = await call(db.storage, "draw", { requestId: ID1, count: 1 });
    expect(first.status).toBe(200);
    expect(first.body.tickets).toBe(9);
    expect(validSupplyReceipt(first.body.pending)).toBe(true);
    expect(db.writes).toBe(2); // initial row + one atomic debit/receipt row
    const writes = db.writes;
    expect(
      await call(db.storage, "draw", { requestId: ID1, count: 1 }),
    ).toEqual(first);
    expect(db.writes).toBe(writes);
    expect(
      (await call(db.storage, "draw", { requestId: ID1, count: 10 })).status,
    ).toBe(409);
    expect(
      (await call(db.storage, "draw", { requestId: ID2, count: 1 })).status,
    ).toBe(409);
    expect(
      (await call(db.storage, "ack", { requestId: ID1 })).body.pending,
    ).toBeNull();
    expect((await call(db.storage, "ack", { requestId: ID1 })).status).toBe(
      200,
    );
    expect(
      (await call(db.storage, "draw", { requestId: ID1, count: 1 })).status,
    ).toBe(409);
    expect(
      (await call(db.storage, "draw", { requestId: ID2, count: 10 })).status,
    ).toBe(409);
    expect((await call(db.storage, "daily", {}, DAY2)).body.tickets).toBe(10);
    const ten = await call(
      db.storage,
      "draw",
      { requestId: ID2, count: 10 },
      DAY2,
    );
    expect(ten.body.tickets).toBe(0);
    expect(ten.body.pending.rewards).toHaveLength(10);
    expect(validSupplyReceipt(ten.body.pending)).toBe(true);
    expect(
      (await call(db.storage, "ack", { requestId: ID2 }, DAY2)).status,
    ).toBe(200);
    expect(
      (await call(db.storage, "draw", { requestId: ID1, count: 1 }, DAY2))
        .status,
    ).toBe(409);
    expect(
      (await call(db.storage, "draw", { requestId: ID2, count: 10 }, DAY2))
        .status,
    ).toBe(409);
    expect(
      (await call(db.storage, "draw", { requestId: ID3, count: 1 }, DAY2))
        .status,
    ).toBe(409);
  });

  it("不正入力・日付指定・資格不正では残高と保存が変わらない", async () => {
    const db = memory();
    await call(db.storage, "initialize");
    const baseline = db.row;
    for (const [action, body] of [
      ["daily", { day: "2027-01-01" }],
      [
        "draw",
        { requestId: ID1, count: 1, rewards: [{ type: "shard", amount: 999 }] },
      ],
      ["draw", { requestId: "bad", count: 1 }],
      ["draw", { requestId: ID1, count: 2 }],
      ["ack", { requestId: ID1, tickets: 100 }],
    ] as const)
      expect((await call(db.storage, action, body)).status).toBe(400);
    expect(
      (
        await call(
          db.storage,
          "draw",
          { requestId: ID1, count: 1 },
          DAY1,
          "wrong",
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await call(
          db.storage,
          "draw",
          { requestId: ID1, count: 1 },
          DAY1,
          OTHER,
        )
      ).status,
    ).toBe(401);
    expect(db.row).toEqual(baseline);
  });

  it("保存失敗時は券消費も受領書も確定しない", async () => {
    const db = memory();
    await call(db.storage, "initialize");
    const failing: SupplyStorage = {
      get: db.storage.get.bind(db.storage),
      async put() {
        throw Error("storage unavailable");
      },
    };
    await expect(
      call(failing, "draw", { requestId: ID1, count: 10 }),
    ).rejects.toThrow("storage unavailable");
    expect(
      (await call(db.storage, "status", {}, DAY1, TOKEN, "GET")).body,
    ).toMatchObject({ tickets: 10, pending: null });
  });
});

describe("抽選方針", () => {
  it("通常区分、武器全種、既存バディ全員、武装片を抽選できる", () => {
    const categories = [
      [0.1, "weapon", 0],
      [0.5, "weapon", 1],
      [0.8, "weapon", 2],
      [0.92, "weapon", 3],
      [0.945, "buddy", -1],
      [0.99, "shard", -1],
    ] as const;
    for (const [value, type, rarity] of categories) {
      const result = drawSupply(1, ID1, DAY1, () => value).rewards[0];
      expect(result.type).toBe(type);
      if (result.type === "weapon") {
        expect(result.weapon.rarity).toBe(rarity);
        expect(result.weapon.level).toBe(1);
        expect(validNewWeapon(result.weapon)).toBe(true);
      }
      if (result.type === "shard")
        expect(result.amount).toBe(SUPPLY_RULES.shardAmount);
    }
    const kinds = new Set<string>();
    for (let i = 0; i < KINDS.length; i++) {
      const draws = [0.1, (i + 0.5) / KINDS.length];
      const result = drawSupply(1, ID1, DAY1, () => draws.shift() ?? 0.4)
        .rewards[0];
      if (result.type === "weapon") kinds.add(result.weapon.kind);
    }
    expect(kinds).toEqual(new Set(KINDS));
    const buddies = new Set<string>();
    for (let i = 0; i < BUDDY_IDS.length; i++) {
      const draws = [0.945, (i + 0.5) / BUDDY_IDS.length];
      const result = drawSupply(1, ID1, DAY1, () => draws.shift() ?? 0.4)
        .rewards[0];
      if (result.type === "buddy") buddies.add(result.buddyId);
    }
    expect(buddies).toEqual(new Set(BUDDY_IDS));
  });

  it("10枠にSR以上がない時だけ末尾を条件付き抽選へ置換", () => {
    const receipt = drawSupply(10, ID1, DAY1, () => 0.1);
    expect(
      receipt.rewards
        .slice(0, 9)
        .every((r) => r.type === "weapon" && r.weapon.rarity === 0),
    ).toBe(true);
    expect(receipt.rewards[9].type).toBe("weapon");
    if (receipt.rewards[9].type === "weapon")
      expect(receipt.rewards[9].weapon.rarity).toBe(2);
    expect(validSupplyReceipt(receipt)).toBe(true);
    const already = drawSupply(10, ID1, DAY1, () => 0.8);
    expect(
      already.rewards.every(
        (r) => r.type === "weapon" && r.weapon.rarity === 2,
      ),
    ).toBe(true);
    expect(
      new Set(
        receipt.rewards
          .filter((r) => r.type === "weapon")
          .map((r) => r.weapon.id),
      ).size,
    ).toBe(10);
  });
});
