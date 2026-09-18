import { assertSaveWriter } from "./save-writer";
import type { DefenseLedger } from "../shared/daily-rewards";
import {
  WEEKLY_MISSIONS,
  type WeeklyProgress,
} from "../shared/weekly-missions";
import {
  SKILLS,
  COSTS,
  CAPACITY,
  ACCESSORY_NAMES,
  missionKey,
  victoryCoins,
  makeWeapon,
  rollWeapon,
  weighted,
  type Skill,
  type NewWeapon,
  type StoredWeapon,
  validNewWeapon,
  weaponYield,
  type Accessory,
  type AccessoryKind,
  type Difficulty,
} from "../shared/progression";
import { WEAPONS, validWeapon, type Kind } from "../shared/defs";
import { parseSave, fresh, SAVE_KEY, type Save } from "./save";
export type SaveMode = "normal" | "test";
export const legacyProgressKey = "swarm-front-progression-v2-normal";
export const newSaveKey = (mode: SaveMode) =>
  mode === "normal"
    ? "swarm-front-shared-progress-v3"
    : "swarm-front-progression-v2-test";
export class SaveConflictError extends Error {
  constructor(
    message = "別の画面で保存が更新されました。最新の保存へ戦果を回復してください。",
  ) {
    super(message);
    this.name = "SaveConflictError";
  }
}
export interface Soldier {
  id: string;
  name: string;
  levels: Record<Skill, number>;
  equipped: string[];
  accessory?: string;
}
export interface Receipt {
  run: string;
  stage: number;
  difficulty: Difficulty;
  win: boolean;
  time: number;
  kills: number;
  missions: boolean[];
  first: boolean;
  coins: number;
  firstCoins: number;
  weapons: NewWeapon[];
  bonus: NewWeapon[];
  collected: number;
  choice: "pending" | "normal" | "ad";
  collectionDone: boolean;
}
export interface ProgressSave {
  weekly?: WeeklyProgress;
  weeklyPending?: string[];
  dailyDefense?: DefenseLedger;
  version: 2;
  mode: SaveMode;
  inventory: StoredWeapon[];
  pending: StoredWeapon[];
  revision?: number;
  armoryMigration?: 1;
  coopPreferences?: Pick<
    Save,
    | "volume"
    | "sensitivity"
    | "fireSensitivity"
    | "gyroEnabled"
    | "gyroSensitivity"
    | "quality"
    | "frameRate"
    | "mapRotates"
    | "damageNumbers"
  >;
  locks: string[];
  soldiers: Soldier[];
  selectedSoldier: string;
  unlocked: Skill[];
  materials: number;
  points: number;
  coins: number;
  powder: number;
  accessories: Accessory[];
  missions: Record<string, boolean[]>;
  branch: boolean;
  encounters: Record<string, "coop" | "solo">;
  tutorials: string[];
  result?: Receipt;
  receipts: string[];
  weaponReceipts?: { ids: string[]; runs: string[] };
  serial: number;
}
export const blankLevels = () => ({ hp: 0, aim: 0, move: 0, swap: 0 });
export function freshProgress(mode: SaveMode): ProgressSave {
  const inventory = (["rifle", "shotgun", "rocket"] as Kind[]).map((k, i) =>
    makeWeapon(
      `v2-starter-${k}`,
      k,
      0,
      { power: 0, reload: 0, range: 0, rate: 0 },
      mode === "test",
      i,
    ),
  );
  return {
    version: 2,
    mode,
    inventory,
    pending: [],
    locks: [],
    soldiers: [
      {
        id: "standard",
        name: "STANDARD TROOPER",
        levels: blankLevels(),
        equipped: inventory.slice(0, 2).map((w) => w.id),
      },
    ],
    selectedSoldier: "standard",
    unlocked: mode === "test" ? [...SKILLS] : [],
    materials: 0,
    points: 0,
    coins: 0,
    powder: 0,
    accessories: [],
    missions: {},
    branch: false,
    encounters: {},
    tutorials: [],
    receipts: [],
    serial: 3,
  };
}
export const allWeapons = (s: ProgressSave) =>
  [...s.inventory, ...s.pending].sort((a, b) => a.acquired - b.acquired);
/** A result's weapons have already been banked, even before reward choice. */
export function weaponReceiptSnapshot(s: ProgressSave) {
  return {
    ids: [
      ...new Set([
        ...(s.weaponReceipts?.ids ?? []),
        ...allWeapons(s).map((w) => w.id),
        ...(s.result?.weapons.map((w) => w.id) ?? []),
      ]),
    ],
    runs: [
      ...new Set([
        ...(s.weaponReceipts?.runs ?? []),
        ...(s.result ? [s.result.run] : []),
      ]),
    ],
  };
}
export const soldier = (s: ProgressSave) =>
  s.soldiers.find((x) => x.id === s.selectedSoldier)!;
export const spent = (levels: Record<Skill, number>) =>
  SKILLS.reduce((n, k) => n + COSTS[levels[k]], 0);
export const weaponProtected = (s: ProgressSave, id: string) =>
  s.locks.includes(id) || s.soldiers.some((p) => p.equipped.includes(id));
export const accessoryProtected = (s: ProgressSave, id: string) =>
  s.accessories.find((a) => a.id === id)?.locked ||
  s.soldiers.some((p) => p.accessory === id);
export function validateProgress(s: ProgressSave) {
  const integer = (v: number) => Number.isSafeInteger(v) && v >= 0;
  if (
    s?.weeklyPending &&
    (!Array.isArray(s.weeklyPending) ||
      s.weeklyPending.length > 128 ||
      s.weeklyPending.some(
        (id) => typeof id !== "string" || !s.receipts.includes(id),
      ))
  )
    throw Error("週間実績の保存を読めません。上書きを停止しました");
  if (s?.weekly) {
    const w = s.weekly;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(w.week) ||
      ![w.campaign, w.defense, w.claimed].every(
        (a) =>
          Array.isArray(a) &&
          a.every((v) => typeof v === "string") &&
          new Set(a).size === a.length,
      ) ||
      w.campaign.length > 10 ||
      w.defense.length > 3 ||
      w.claimed.some((id) => !WEEKLY_MISSIONS.some((m) => m.id === id))
    )
      throw Error("週間ミッション保存を読めません。上書きを停止しました");
  }
  if (s?.dailyDefense) {
    const d = s.dailyDefense;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(d.day) ||
      typeof d.run !== "string" ||
      !integer(d.stage) ||
      d.stage < 1 ||
      d.stage > 20 ||
      !["active", "victory", "defeat", "interrupted"].includes(d.state) ||
      !integer(d.bonus) ||
      d.bonus > 5 ||
      !Array.isArray(d.collected) ||
      !d.collected.every(
        (id) => typeof id === "string" && id.startsWith(`${d.run}-drop-`),
      )
    )
      throw Error("防衛作戦の保存を読めません。上書きを停止しました");
  }
  if (
    !s ||
    (s.revision !== undefined && !integer(s.revision)) ||
    (s.armoryMigration !== undefined && s.armoryMigration !== 1) ||
    s.version !== 2 ||
    !["normal", "test"].includes(s.mode) ||
    ![s.materials, s.points, s.coins, s.powder, s.serial].every(integer) ||
    s.points > 120 ||
    !Array.isArray(s.inventory) ||
    !Array.isArray(s.pending) ||
    !Array.isArray(s.soldiers) ||
    !s.soldiers.length ||
    !Array.isArray(s.accessories) ||
    !Array.isArray(s.locks) ||
    !Array.isArray(s.unlocked) ||
    !Array.isArray(s.receipts) ||
    !Array.isArray(s.tutorials) ||
    typeof s.branch !== "boolean" ||
    !s.missions ||
    !s.encounters
  )
    throw new Error("進行保存を読めません。上書きを停止しました");
  if (
    s.weaponReceipts &&
    ![s.weaponReceipts.ids, s.weaponReceipts.runs].every(
      (values) =>
        Array.isArray(values) &&
        values.every((id) => typeof id === "string") &&
        new Set(values).size === values.length,
    )
  )
    throw new Error("武器の受領履歴を読めません。上書きを停止しました");
  if (s.coopPreferences)
    parseSave(JSON.stringify({ ...fresh(), ...s.coopPreferences }));
  const weapons = allWeapons(s),
    ids = weapons.map((w) => w.id);
  if (
    new Set(ids).size !== ids.length ||
    s.inventory.length > CAPACITY.total ||
    Object.keys(WEAPONS).some(
      (k) => s.inventory.filter((w) => w.kind === k).length > CAPACITY.perKind,
    )
  )
    throw new Error("武器保存の上限・IDが不正です");
  for (const w of weapons) {
    if (
      !(w.format === 2 ? validNewWeapon(w) : validWeapon(w)) ||
      w.testData !== (s.mode === "test") ||
      !integer(w.acquired) ||
      typeof w.id !== "string"
    )
      throw new Error("武器保存の形式が不正です");
  }
  if (
    s.locks.some((id) => !ids.includes(id)) ||
    s.unlocked.some((k) => !SKILLS.includes(k)) ||
    new Set(s.unlocked).size !== s.unlocked.length ||
    !soldier(s)
  )
    throw new Error("兵士・ロック保存が不正です");
  for (const p of s.soldiers)
    if (
      !p.levels ||
      !SKILLS.every(
        (k) =>
          Number.isInteger(p.levels[k]) &&
          p.levels[k] >= 0 &&
          p.levels[k] <= 5 &&
          (!p.levels[k] || s.unlocked.includes(k)),
      ) ||
      spent(p.levels) > s.points ||
      p.equipped.length !== 2 ||
      new Set(p.equipped).size !== 2 ||
      p.equipped.some((id) => !s.inventory.some((w) => w.id === id)) ||
      (p.accessory && !s.accessories.some((a) => a.id === p.accessory))
    )
      throw new Error("兵士の配分・装備保存が不正です");
  for (const a of s.accessories)
    if (
      !Object.hasOwn(ACCESSORY_NAMES, a.kind) ||
      !Number.isInteger(a.rarity) ||
      a.rarity < 1 ||
      a.rarity > 6 ||
      a.testData !== (s.mode === "test") ||
      typeof a.locked !== "boolean"
    )
      throw new Error("アクセサリ保存が不正です");
  for (const [key, m] of Object.entries(s.missions))
    if (
      !/^(?:[1-9]|1[0-9]|20|21):(normal|medium)$/.test(key) ||
      !Array.isArray(m) ||
      m.length !== 3 ||
      m.some((v) => typeof v !== "boolean")
    )
      throw new Error("ミッション保存が不正です");
  for (const state of Object.values(s.encounters))
    if (!["solo", "coop"].includes(state))
      throw new Error("遭遇保存が不正です");
  if (s.result) {
    const r = s.result;
    if (
      !s.receipts.includes(r.run) ||
      !["pending", "normal", "ad"].includes(r.choice) ||
      !Array.isArray(r.weapons) ||
      !Array.isArray(r.bonus) ||
      (r.choice === "pending" && r.weapons.some((w) => !ids.includes(w.id))) ||
      !integer(r.collected) ||
      !integer(r.coins) ||
      !integer(r.firstCoins)
    )
      throw new Error("報酬保存が不正です");
  }
  return s;
}
export function loadProgress(
  mode: SaveMode,
  storage: Pick<Storage, "getItem"> &
    Partial<Pick<Storage, "setItem">> = localStorage,
): ProgressSave | null {
  if (mode === "normal" && storage.setItem)
    return migrateSharedArmory(storage as Pick<Storage, "getItem" | "setItem">);
  const raw = storage.getItem(newSaveKey(mode));
  if (raw === null) return null;
  const s = validateProgress(JSON.parse(raw));
  if (s.mode !== mode) throw new Error("保存モードが不一致です");
  return s;
}

export function coopPreferences(
  save: Save,
): NonNullable<ProgressSave["coopPreferences"]> {
  return {
    volume: save.volume,
    sensitivity: save.sensitivity,
    quality: save.quality,
    frameRate: save.frameRate ?? 60,
    fireSensitivity: save.fireSensitivity,
    gyroEnabled: save.gyroEnabled,
    gyroSensitivity: save.gyroSensitivity,
    mapRotates: save.mapRotates,
    damageNumbers: save.damageNumbers,
  };
}

/** Retain every earlier migration snapshot, including failed-attempt snapshots. */
function backupSource(
  storage: Pick<Storage, "getItem" | "setItem">,
  key: string,
  raw: string,
) {
  for (let attempt = 0; ; attempt++) {
    const candidate = attempt === 0 ? key : `${key}-${attempt}`;
    const previous = storage.getItem(candidate);
    if (previous === raw) return;
    if (previous !== null) continue;
    storage.setItem(candidate, raw);
    if (storage.getItem(candidate) !== raw)
      throw new Error("移行前の控えを保存できません。");
    return;
  }
}

/** A single successful normal-save write publishes the migration. Sources stay intact. */
export function migrateSharedArmory(
  storage: Pick<Storage, "getItem" | "setItem">,
): ProgressSave | null {
  const targetKey = newSaveKey("normal");
  const published = storage.getItem(targetKey);
  if (published !== null) {
    const current = validateProgress(JSON.parse(published));
    if (current.mode !== "normal") throw new Error("保存モードが不一致です");
    return current;
  }
  assertSaveWriter(storage);
  const key = legacyProgressKey,
    raw = storage.getItem(key);
  const existing = raw === null ? null : validateProgress(JSON.parse(raw));
  if (existing && existing.mode !== "normal")
    throw new Error("保存モードが不一致です");
  if (existing?.armoryMigration === 1) {
    // The previous shared release already merged v1: preserve its latest rewards.
    const backupKey = `${key}-before-shared-v3`;
    backupSource(storage, backupKey, raw!);
    if (storage.getItem(key) !== raw || storage.getItem(targetKey) !== null)
      throw new SaveConflictError(
        "移行中に保存が更新されました。再読み込みしてください。",
      );
    const next = structuredClone(existing);
    next.revision = 0;
    persistProgress(next, storage);
    return next;
  }
  const oldRaw = storage.getItem(SAVE_KEY);
  if (!existing && oldRaw === null) return null;
  const old = oldRaw === null ? null : parseSave(oldRaw);
  if (
    old &&
    [...old.inventory, ...(old.pendingWeapons ?? [])].some(
      (w) => "testData" in w && w.testData !== false,
    )
  )
    throw new Error("管理者用武器が旧保存に含まれるため、移行を停止しました。");
  const next = existing ? structuredClone(existing) : freshProgress("normal");
  if (!existing && old) {
    next.inventory = [];
    next.pending = [];
  }
  if (old) {
    const ids = new Set(allWeapons(next).map((w) => w.id));
    const mapped = new Map<string, string>();
    const incoming = [...old.inventory, ...(old.pendingWeapons ?? [])];
    if (!existing)
      incoming.sort(
        (a, b) =>
          Number(old.equipped.includes(b.id)) -
          Number(old.equipped.includes(a.id)),
      );
    for (const w of incoming) {
      let id = w.id,
        suffix = 0;
      while (ids.has(id)) id = `legacy-${w.id.slice(0, 80)}-${++suffix}`;
      ids.add(id);
      mapped.set(w.id, id);
      bank(next, [
        { ...structuredClone(w), id, acquired: next.serial++, testData: false },
      ]);
    }
    next.locks = [
      ...new Set([
        ...next.locks,
        ...(old.favorites ?? []).map((id) => mapped.get(id)!),
      ]),
    ];
    if (!existing)
      soldier(next).equipped = old.equipped.map((id) => mapped.get(id)!);
    next.powder += old.powder ?? 0;
    next.receipts = [...new Set([...next.receipts, ...old.receipts])];
    next.coopPreferences = coopPreferences(old);
  }
  next.armoryMigration = 1;
  validateProgress(next);
  for (const [sourceKey, sourceRaw] of [
    [key, raw],
    [SAVE_KEY, oldRaw],
  ] as const) {
    if (sourceRaw === null) continue;
    const backupKey = `${sourceKey}-before-shared-armory`;
    backupSource(storage, backupKey, sourceRaw);
  }
  if (storage.getItem(key) !== raw || storage.getItem(SAVE_KEY) !== oldRaw)
    throw new SaveConflictError(
      "移行中に保存が更新されました。再読み込みしてください。",
    );
  if (storage.getItem(targetKey) !== null) throw new SaveConflictError();
  next.revision = 0;
  persistProgress(next, storage);
  return next;
}
export function persistProgress(
  s: ProgressSave,
  storage: Pick<Storage, "setItem"> &
    Partial<Pick<Storage, "getItem">> = localStorage,
) {
  assertSaveWriter(storage);
  validateProgress(s);
  const raw = storage.getItem?.(newSaveKey(s.mode));
  if (
    s.mode === "normal" &&
    storage.getItem &&
    raw === null &&
    (s.revision ?? 0) > 0
  )
    throw new SaveConflictError(
      "保存が別の画面で削除されました。再読み込みしてください。",
    );
  const current =
    s.mode === "normal" && raw ? validateProgress(JSON.parse(raw)) : null;
  if (current) {
    if ((current.revision ?? 0) !== (s.revision ?? 0))
      throw new SaveConflictError();
  }
  const next = { ...s, revision: (s.revision ?? 0) + 1 };
  const incomingReceipts = weaponReceiptSnapshot(s);
  const previousReceipts = current
    ? weaponReceiptSnapshot(current)
    : { ids: [], runs: [] };
  next.weaponReceipts = {
    ids: [...new Set([...previousReceipts.ids, ...incomingReceipts.ids])],
    runs: [...new Set([...previousReceipts.runs, ...incomingReceipts.runs])],
  };
  try {
    storage.setItem(newSaveKey(s.mode), JSON.stringify(next));
  } catch {
    throw new Error(
      "端末へ保存できません。「保存を再試行」してください。保存成功前に終了すると復元できない場合があります。",
    );
  }
  s.revision = next.revision;
  s.weaponReceipts = next.weaponReceipts;
  if (typeof window !== "undefined" && storage === window.localStorage)
    window.dispatchEvent(new Event("swarm-progress-saved"));
}
export function initializeProgress(
  mode: SaveMode,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
) {
  if (mode === "normal") {
    const existing = migrateSharedArmory(storage);
    if (existing) return existing;
    const created = freshProgress(mode);
    created.armoryMigration = 1;
    persistProgress(created, storage);
    return created;
  }
  if (storage.getItem(newSaveKey(mode)) !== null)
    throw new Error("保存は既に存在します");
  const s = freshProgress(mode);
  persistProgress(s, storage);
  return s;
}
export function canSortie(s: ProgressSave, stage: number, d: Difficulty) {
  if (s.pending.length || s.result?.choice === "pending") return false;
  if (!Number.isInteger(stage) || stage < 1 || stage > 21) return false;
  if (s.mode === "test") return true;
  if (d === "medium") return !!s.missions[missionKey(stage, "normal")]?.[0];
  return stage === 21
    ? s.branch
    : stage === 1 || !!s.missions[missionKey(stage - 1, "normal")]?.[0];
}
export function bank(s: ProgressSave, items: StoredWeapon[]) {
  const ids = new Set(allWeapons(s).map((w) => w.id));
  for (const w of items) {
    if (ids.has(w.id)) continue;
    ids.add(w.id);
    if (
      s.inventory.length < CAPACITY.total &&
      s.inventory.filter((a) => a.kind === w.kind).length < CAPACITY.perKind
    )
      s.inventory.push(w);
    else s.pending.push(w);
  }
  s.weaponReceipts = weaponReceiptSnapshot(s);
}
export function refill(s: ProgressSave) {
  const waiting = [...s.pending].sort(
    (a, b) =>
      Number(s.locks.includes(b.id)) - Number(s.locks.includes(a.id)) ||
      a.acquired - b.acquired,
  );
  s.pending = [];
  for (const w of waiting) bank(s, [w]);
}
export function dismantle(s: ProgressSave, ids: string[]) {
  const n = structuredClone(s),
    unique = new Set(ids),
    items = allWeapons(n).filter((w) => unique.has(w.id));
  if (
    items.length !== unique.size ||
    items.some((w) => weaponProtected(n, w.id))
  )
    throw new Error("登録装備・ロック品は解体できません");
  n.weaponReceipts = weaponReceiptSnapshot(n);
  n.powder += items.reduce((v, w) => v + weaponYield(w), 0);
  n.inventory = n.inventory.filter((w) => !unique.has(w.id));
  n.pending = n.pending.filter((w) => !unique.has(w.id));
  refill(n);
  return n;
}
export function unlockSkill(s: ProgressSave, k: Skill) {
  const n = structuredClone(s);
  if (!SKILLS.includes(k) || n.unlocked.includes(k) || n.materials < 1)
    throw new Error("解放素材が必要です");
  n.materials--;
  n.unlocked.push(k);
  return n;
}
export function allocate(
  s: ProgressSave,
  id: string,
  levels: Record<Skill, number>,
) {
  const n = structuredClone(s),
    p = n.soldiers.find((p) => p.id === id);
  if (
    !p ||
    !SKILLS.every(
      (k) =>
        Number.isInteger(levels[k]) &&
        levels[k] >= 0 &&
        levels[k] <= 5 &&
        (!levels[k] || n.unlocked.includes(k)),
    ) ||
    spent(levels) > n.points
  )
    throw new Error("ポイント・解放状況を確認してください");
  if (SKILLS.some((k) => levels[k] < p.levels[k])) {
    if (n.coins < 500) throw new Error("振り直しには500コイン必要です");
    n.coins -= 500;
  }
  p.levels = { ...levels };
  return n;
}
export function grantResult(
  s: ProgressSave,
  input: Omit<
    Receipt,
    "first" | "coins" | "firstCoins" | "choice" | "collectionDone" | "bonus"
  >,
  rng: () => number,
) {
  if (s.receipts.includes(input.run)) return s;
  const n = structuredClone(s),
    key = missionKey(input.stage, input.difficulty),
    old = n.missions[key] ?? [false, false, false],
    first = input.win && !old[0];
  n.weaponReceipts = weaponReceiptSnapshot(n);
  n.serial = Math.max(n.serial, ...input.weapons.map((w) => w.acquired + 1));
  const r: Receipt = {
    ...structuredClone(input),
    first,
    coins: input.win ? victoryCoins(input.stage, input.difficulty) : 0,
    firstCoins: first && input.stage === 21 ? 500 : 0,
    choice: input.win ? "pending" : "normal",
    collectionDone: !input.win,
    bonus: [],
  };
  if (input.win) {
    n.missions[key] = old.map((v, i) => v || input.missions[i]);
    if (first && input.stage !== 21) {
      n.points = Math.min(120, n.points + 3);
      if (input.stage <= 4 && input.difficulty === "normal") n.materials++;
    }
    if (first && input.stage === 21)
      for (let i = 0; i < 3; i++)
        r.weapons.push(
          rollWeapon(
            `${input.run}-first-${i}`,
            21,
            input.difficulty,
            n.mode === "test",
            n.serial++,
            rng,
          ),
        );
    bank(n, r.weapons);
  }
  n.coins += r.coins + r.firstCoins;
  n.receipts.push(input.run);
  if (input.win && n.mode === "normal")
    n.weeklyPending = [
      ...new Set([...(n.weeklyPending ?? []), input.run]),
    ].slice(-128);
  n.result = r;
  n.weaponReceipts = weaponReceiptSnapshot(n);
  return n;
}
export function appendCollected(s: ProgressSave, items: NewWeapon[]) {
  const n = structuredClone(s),
    r = n.result;
  if (!r || !r.win || r.collectionDone || r.choice !== "pending")
    throw new Error("回収受付は終了しました");
  const known = new Set(r.weapons.map((w) => w.id)),
    fresh = items.filter((w) => !known.has(w.id));
  r.collected += fresh.length;
  n.serial = Math.max(n.serial, ...fresh.map((w) => w.acquired + 1));
  r.weapons.push(...fresh);
  bank(n, fresh);
  return n;
}
export function prepareChoice(s: ProgressSave, rng: () => number) {
  const n = structuredClone(s),
    r = n.result;
  if (!r || r.collectionDone) return s;
  r.collectionDone = true;
  r.bonus = Array.from({ length: r.collected + 2 }, (_, i) =>
    rollWeapon(
      `${r.run}-ad-${i}`,
      r.stage,
      r.difficulty,
      n.mode === "test",
      n.serial++,
      rng,
    ),
  );
  return n;
}
export function chooseReward(s: ProgressSave, ad: boolean) {
  const n = structuredClone(s),
    r = n.result;
  if (!r || r.choice !== "pending") return s;
  if (!r.collectionDone) throw new Error("回収が完了していません");
  if (ad && s.mode !== "test") throw new Error("追加報酬は現在利用できません");
  r.choice = ad ? "ad" : "normal";
  if (ad) {
    bank(n, r.bonus);
    r.weapons.push(...r.bonus);
    n.coins += r.coins;
  }
  return n;
}
export function createAccessory(
  s: ProgressSave,
  kind?: AccessoryKind,
  rng: () => number = Math.random,
) {
  const n = structuredClone(s),
    cost = kind ? 30 : 10;
  if (n.powder < cost) throw new Error("武装片が不足しています");
  n.powder -= cost;
  n.accessories.push({
    id: `accessory-${n.serial++}`,
    kind:
      kind ??
      (["pickup", "healing", "recovery"] as AccessoryKind[])[
        Math.floor(rng() * 3)
      ],
    rarity: weighted([0.7, 0.2, 0.08, 0.015, 0.004, 0.001], rng) + 1,
    locked: false,
    testData: n.mode === "test",
  });
  return n;
}
export function synthesize(s: ProgressSave, only?: string[]) {
  const n = structuredClone(s),
    consumed: Accessory[] = [],
    created: Accessory[] = [];
  for (const kind of Object.keys(ACCESSORY_NAMES) as AccessoryKind[])
    for (let rarity = 1; rarity < 6; rarity++) {
      let available = n.accessories.filter(
        (a) =>
          a.kind === kind &&
          a.rarity === rarity &&
          !accessoryProtected(n, a.id) &&
          (!only || only.includes(a.id) || created.some((b) => b.id === a.id)),
      );
      while (available.length >= rarity + 1) {
        const use = available.splice(0, rarity + 1);
        consumed.push(...use);
        n.accessories = n.accessories.filter(
          (a) => !use.some((b) => a.id === b.id),
        );
        const next: Accessory = {
          id: `accessory-${n.serial++}`,
          kind,
          rarity: rarity + 1,
          locked: false,
          testData: n.mode === "test",
        };
        n.accessories.push(next);
        created.push(next);
      }
    }
  return {
    save: n,
    consumed: consumed.filter((a) => !created.some((b) => b.id === a.id)),
    created: created.filter((a) => n.accessories.some((b) => b.id === a.id)),
  };
}
