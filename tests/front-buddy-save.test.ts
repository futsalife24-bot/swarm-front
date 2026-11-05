import { expect, it } from "vitest";
import { applyBuddyAction } from "../src/client/buddy-controller";
import {
  freshProgress,
  grantResult,
  loadProgress,
  persistProgress,
  validateProgress,
} from "../src/client/progression-save";
import { buddyXpForLevel } from "../src/shared/buddy-progression";
import { preservesGrowthSave } from "../src/shared/growth-save-guard";
import { playerVault, validCloudSave } from "../server/player-vault";

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}
it("旧保存へ追加し、保存失敗時は元の画面状態も通貨も変更しない", () => {
  const storage = memory();
  const old = freshProgress("normal");
  persistProgress(old, storage);
  const before = structuredClone(old);
  const unavailable = {
    getItem: storage.getItem,
    setItem() {
      throw Error("quota");
    },
  };
  expect(() =>
    applyBuddyAction(
      old,
      { kind: "starter", buddyId: "yosuga" },
      { inBattle: false, storage: unavailable },
    ),
  ).toThrow();
  expect(old).toEqual(before);
  expect(loadProgress("normal", storage)!.buddies).toBeUndefined();
  const selected = applyBuddyAction(
    old,
    { kind: "starter", buddyId: "yosuga" },
    { inBattle: false, storage },
  ).save;
  expect(selected.buddies!.selected).toBe("yosuga");
  expect(old.buddies).toBeUndefined();
  expect(selected.inventory).toEqual(old.inventory);
  expect(() =>
    applyBuddyAction(
      selected,
      { kind: "equip", buddyId: null },
      { inBattle: true, storage },
    ),
  ).toThrow("基地");
});
it("別画面の古いrevisionとバディフィールド欠落による上書きを拒否する", () => {
  const storage = memory();
  const old = freshProgress("normal");
  persistProgress(old, storage);
  const latest = applyBuddyAction(
    old,
    { kind: "starter", buddyId: "tatara" },
    { inBattle: false, storage },
  ).save;
  expect(() =>
    applyBuddyAction(
      old,
      { kind: "starter", buddyId: "oriha" },
      { inBattle: false, storage },
    ),
  ).toThrow();
  const stripped = structuredClone(latest);
  delete stripped.buddies;
  expect(() => persistProgress(stripped, storage)).toThrow();
  const read = loadProgress("normal", storage)!;
  expect(read.buddies!.selected).toBe("tatara");
});
it("ソロ進撃の戦果で一度だけ報酬と同行XPを得て、再読込みでも維持する", () => {
  const storage = memory();
  let save = applyBuddyAction(
    freshProgress("normal"),
    { kind: "starter", buddyId: "tatara" },
    { inBattle: false, storage },
  ).save;
  const input = {
    run: "solo-reward",
    stage: 1,
    difficulty: "normal" as const,
    win: true,
    time: 80,
    kills: 30,
    missions: [true, false, false],
    weapons: [],
    collected: 0,
    buddyId: "tatara" as const,
  };
  save = grantResult(save, input, () => 0.5);
  expect(save.buddies!.tickets).toBe(2);
  expect(save.buddies!.owned.tatara!.xp).toBe(110);
  expect(grantResult(save, input, () => 0.5)).toBe(save);
  persistProgress(save, storage);
  expect(loadProgress("normal", storage)!.buddies).toEqual(save.buddies);
});
it("抽選成功後の同じ要求IDは再消費せず、突破の素材消費は保存できる", () => {
  const storage = memory();
  let save = applyBuddyAction(
    freshProgress("normal"),
    { kind: "starter", buddyId: "tatara" },
    { inBattle: false, storage },
  ).save;
  save.buddies!.tickets = 1;
  save.buddies!.fragments = 3;
  save.buddies!.owned.tatara!.xp = buddyXpForLevel(10);
  persistProgress(save, storage);
  const draw = applyBuddyAction(
    save,
    { kind: "draw", requestId: "request" },
    { inBattle: false, storage, rng: () => 0 },
  );
  expect(draw.save.buddies!.fragments).toBe(4);
  const again = applyBuddyAction(
    draw.save,
    { kind: "draw", requestId: "request" },
    {
      inBattle: false,
      storage,
      rng: () => {
        throw Error("再抽選");
      },
    },
  );
  expect(again.replayed).toBe(true);
  expect(again.save).toBe(draw.save);
  save = applyBuddyAction(
    draw.save,
    { kind: "breakthrough", buddyId: "tatara" },
    { inBattle: false, storage },
  ).save;
  expect(save.buddies!.fragments).toBe(1);
  expect(save.buddies!.owned.tatara!.breakthrough).toBe(1);
});
it("欠落・履歴改竄・育成巻戻しを拒否する一方で既存の旧保存は有効", () => {
  const storage = memory();
  const old = freshProgress("normal");
  expect(validateProgress(old)).toBe(old);
  const save = applyBuddyAction(
    old,
    { kind: "starter", buddyId: "tatara" },
    { inBattle: false, storage },
  ).save;
  save.buddies!.owned.tatara!.xp = 100;
  const next = structuredClone(save);
  next.buddies!.owned.tatara!.xp = 0;
  expect(
    preservesGrowthSave(
      save as unknown as Record<string, unknown>,
      next as unknown as Record<string, unknown>,
    ),
  ).toBe(false);
  expect(() =>
    validateProgress({ ...save, buddies: { ...save.buddies!, tickets: -1 } }),
  ).toThrow("バディ保存");
  expect(validCloudSave(save)).toBe(true);
  expect(
    validCloudSave({ ...save, buddies: { ...save.buddies!, tickets: -1 } }),
  ).toBe(false);
});

it("抽選の保存失敗を同じ要求IDで再試行しても結果を引き直さない", () => {
  const backend = memory();
  let fails = false;
  const storage = {
    getItem: backend.getItem,
    setItem: (key: string, value: string) => {
      if (fails) throw Error("quota");
      backend.setItem(key, value);
    },
  };
  const save = applyBuddyAction(
    freshProgress("normal"),
    { kind: "starter", buddyId: "tatara" },
    { inBattle: false, storage },
  ).save;
  save.buddies!.tickets = 1;
  persistProgress(save, storage);
  fails = true;
  expect(() =>
    applyBuddyAction(
      save,
      { kind: "draw", requestId: "retry" },
      { inBattle: false, storage, rng: () => 0.5 },
    ),
  ).toThrow();
  expect(save.buddies!.tickets).toBe(1);
  expect(save.buddies!.owned.tobari).toBeUndefined();
  fails = false;
  const result = applyBuddyAction(
    save,
    { kind: "draw", requestId: "retry" },
    {
      inBattle: false,
      storage,
      rng: () => {
        throw Error("再抽選禁止");
      },
    },
  );
  expect(result.receipt!.buddyId).toBe("tobari");
  expect(result.save.buddies!.tickets).toBe(0);
  expect(loadProgress("normal", storage)!.buddies!.owned.tobari).toBeDefined();
});

it("クラウド保存処理も旧クライアントのバディ欠落を拒否して保持する", async () => {
  const values = new Map<string, unknown>();
  const cloudStorage = {
    get: async (key: string) => structuredClone(values.get(key)),
    put: async (key: string, value: unknown) => {
      values.set(key, structuredClone(value));
    },
  } as unknown as DurableObjectStorage;
  const request = (path: string, body?: unknown) =>
    new Request(`https://internal/cloud/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${"a".repeat(64)}`,
        "Content-Type": "application/json",
        "CF-Connecting-IP": "buddy-test",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const save = applyBuddyAction(
    freshProgress("normal"),
    { kind: "starter", buddyId: "yosuga" },
    { inBattle: false, storage: memory() },
  ).save;
  const now = Date.parse("2026-11-05T00:00:00Z");
  const initial = await playerVault(
    request("initialize", { save }),
    cloudStorage,
    true,
    now,
  );
  expect(initial.status).toBe(200);
  const stripped = structuredClone(save);
  delete stripped.buddies;
  const refused = await playerVault(
    request("save", {
      save: stripped,
      version: 1,
      basisVersion: 1,
      mutation: crypto.randomUUID(),
    }),
    cloudStorage,
    false,
    now,
  );
  expect(refused.status).toBe(409);
  const read = await playerVault(request("save"), cloudStorage, false, now);
  expect(((await read.json()) as { save: typeof save }).save.buddies).toEqual(
    save.buddies,
  );
});
