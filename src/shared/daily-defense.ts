import { addPlayer, spawn, type World, type Player, type Enemy } from "./game";
import { stageFor } from "./stages";
export const DEFENSE_SECONDS = 180;
export const ARMORY_HP = 2000;
export interface DailyDefense {
  day: string;
  armory: Player;
  maxHp: number;
  duration: number;
  nextSpawn: number;
}
export function initDailyDefense(w: World, day: string) {
  if (!w.solo || w.players.length !== 1)
    throw Error("武器庫防衛は1人プレイ専用です");
  // Use the same damage/collision target shape without creating a second soldier.
  const holder = { ...w, players: [], pending: {}, rewards: {} };
  const armory = addPlayer(holder, "daily-armory", []);
  Object.assign(armory, { x: 0, y: 0, z: 0, hp: ARMORY_HP });
  w.defense = {
    day,
    armory,
    maxHp: ARMORY_HP,
    duration: DEFENSE_SECONDS,
    nextSpawn: 0,
  };
  Object.assign(w.players[0], { x: 0, y: 0, z: 8 });
}
export function defenseTarget(w: World, enemy: Enemy, soldiers: Player[]) {
  const defense = w.defense!;
  const candidate = soldiers.find(
    (p) =>
      p.hp > 0 &&
      p.connected &&
      Math.hypot(p.x, p.z) <= 24 &&
      (Math.hypot(p.x - enemy.x, p.z - enemy.z) <= 8 ||
        (enemy.defenseAggroUntil ?? 0) > w.time),
  );
  return candidate ?? (defense.armory.hp > 0 ? defense.armory : undefined);
}
export function defenseSpawn(w: World) {
  const d = w.defense!;
  if (w.time < d.nextSpawn || w.enemies.filter((e) => e.hp > 0).length >= 24)
    return;
  const roster = Object.entries(stageFor(w).waves[0].troops)
    .filter(([, count]) => count > 0)
    .map(([kind]) => kind) as Enemy["kind"][];
  const ordinal = w.spawned++;
  const angle = ordinal * 2.399963229728653;
  spawn(
    w,
    roster[ordinal % roster.length] ?? "crawler",
    Math.sin(angle) * 34,
    Math.cos(angle) * 34,
  );
  d.nextSpawn = w.time + Math.max(1.1, 3 - w.time / 120);
}
export function finishDefenseTick(w: World) {
  const d = w.defense!;
  const defeat = d.armory.hp <= 0 || w.players[0].hp <= 0;
  if (!defeat && w.time < d.duration) return;
  w.phase = defeat ? "defeat" : "victory";
  w.pollen = [];
  w.reason =
    d.armory.hp <= 0
      ? "武器庫が破壊されました"
      : defeat
        ? "防衛隊員が倒れました"
        : "武器庫を守り抜きました";
  // Daily drops are banked as they are collected. Never erase them on defeat.
  w.projectiles = [];
}
export function defenseBonus(hp: number, maxHp: number) {
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || hp <= 0 || maxHp <= 0)
    return 0;
  return Math.min(5, Math.floor(Math.min(1, hp / maxHp) * 5) + 1);
}
