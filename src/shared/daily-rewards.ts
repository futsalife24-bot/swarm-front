import {
  CAPACITY,
  rollWeapon,
  validNewWeapon,
  type StoredWeapon,
  type NewWeapon,
} from "./progression";
import { familyOf } from "./defs";
import { defenseBonus } from "./daily-defense";
export interface DefenseLedger {
  day: string;
  run: string;
  stage: number;
  state: "active" | "victory" | "defeat" | "interrupted";
  collected: string[];
  bonus: number;
}
export interface DefenseSave {
  mode: "normal" | "test";
  inventory: StoredWeapon[];
  pending: StoredWeapon[];
  serial: number;
  powder: number;
  missions: Record<string, boolean[]>;
  dailyDefense?: DefenseLedger;
}
export function defenseStage(save: DefenseSave) {
  let stage = 1;
  for (let n = 1; n <= 20; n++)
    if (save.missions[`${n}:normal`]?.[0]) stage = n;
  return stage;
}
function bank(save: DefenseSave, weapon: StoredWeapon) {
  if (
    save.inventory.length < CAPACITY.total &&
    save.inventory.filter((w) => familyOf(w.kind) === familyOf(weapon.kind))
      .length < CAPACITY.perKind
  )
    save.inventory.push(weapon);
  else save.pending.push(weapon);
}
export function beginDefense<T extends DefenseSave>(
  save: T,
  day: string,
  run: string,
  rng: () => number,
): T {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^[a-zA-Z0-9-]{16,80}$/.test(run))
    throw Error("防衛作戦の開始情報が不正です");
  if (save.dailyDefense?.day === day) {
    if (save.dailyDefense.run === run) return save;
    throw Error("今日の防衛作戦は挑戦済みです");
  }
  const next = structuredClone(save),
    stage = defenseStage(save);
  next.dailyDefense = {
    day,
    run,
    stage,
    state: "active",
    collected: [],
    bonus: 0,
  };
  bank(
    next,
    rollWeapon(
      `${run}-daily-guarantee`,
      stage,
      "normal",
      save.mode === "test",
      next.serial++,
      rng,
    ),
  );
  return next;
}
export function collectDefense<T extends DefenseSave>(
  save: T,
  run: string,
  weapons: NewWeapon[],
): T {
  if (save.dailyDefense?.run !== run || save.dailyDefense.state !== "active")
    throw Error("進行中の防衛作戦がありません");
  const next = structuredClone(save),
    ledger = next.dailyDefense!;
  for (const item of weapons) {
    if (
      !validNewWeapon(item) ||
      !item.id.startsWith(`${run}-drop-`) ||
      item.testData !== (save.mode === "test")
    )
      throw Error("防衛戦利品が不正です");
    if (ledger.collected.includes(item.id)) continue;
    ledger.collected.push(item.id);
    bank(next, { ...structuredClone(item), acquired: next.serial++ });
  }
  return next;
}
export function settleDefense<T extends DefenseSave>(
  save: T,
  run: string,
  outcome: "victory" | "defeat" | "interrupted",
  hp: number,
  maxHp: number,
  rng: () => number,
): T {
  if (save.dailyDefense?.run !== run) throw Error("防衛作戦が一致しません");
  if (save.dailyDefense.state !== "active") return save;
  const next = structuredClone(save),
    ledger = next.dailyDefense!;
  ledger.state = outcome;
  if (outcome === "victory") {
    ledger.bonus = defenseBonus(hp, maxHp);
    if (!ledger.bonus) throw Error("武器庫が破壊された作戦は勝利にできません");
    for (let i = 0; i < ledger.bonus; i++)
      bank(
        next,
        rollWeapon(
          `${run}-daily-bonus-${i}`,
          ledger.stage,
          "normal",
          save.mode === "test",
          next.serial++,
          rng,
        ),
      );
  } else if (outcome === "defeat") next.powder += 5;
  return next;
}
