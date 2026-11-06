import { BUDDY_ASSETS } from "./buddy-assets";
import type { ProgressSave } from "./progression-save";
import type {
  BuddyCatalogItem,
  BuddySkillView,
  BuddyUiState,
} from "./buddy-ui";
import { BUDDY_COMBAT, buddyMode } from "../shared/buddy-combat";
import {
  BUDDY_IDS,
  BUDDY_LEVEL_CAPS,
  BUDDY_BREAKTHROUGH_COSTS,
  BUDDY_RECRUIT_RULES,
  buddyLevel,
  buddyXpForLevel,
  freshBuddyProgress,
  validBuddyProgress,
  isBuddyId,
  type BuddyId,
} from "../shared/buddy-progression";
import type { World } from "../shared/game";
import { maxHp } from "../shared/solo-progression";

const percent = (fraction: number) => Math.round(fraction * 100);

export interface AdvanceBuddyView {
  status: "present" | "none" | "unavailable";
  name?: string;
  level?: number | null;
  elementLabel?: string;
  skillName?: string;
  skillText?: string;
  cooldown?: number;
  remaining?: number | null;
  activeRemaining?: number | null;
  unavailable?: string | null;
}

/** 停止画面は出撃中の実体だけを読む。保存中の選択や育成値へ置換しない。 */
export function getAdvanceBuddyView(
  world: World | null,
  ownerId: string,
): AdvanceBuddyView {
  if (!world || !buddyMode(world)) return { status: "unavailable" };
  const state = world.buddies;
  if (!state) return { status: "none" };
  if (state.run !== world.run || !state.entries)
    return { status: "unavailable" };
  const entry = state.entries[ownerId];
  if (!entry) return { status: "none" };
  if (!isBuddyId(entry.buddyId)) return { status: "unavailable" };
  const owner = world.players.find((p) => p.id === ownerId);
  if (!owner) return { status: "unavailable" };
  const item = catalogItem(entry.buddyId);
  const seconds = (until: number | undefined) =>
    Number.isFinite(until) && Number.isFinite(world.time)
      ? Math.max(0, until! - world.time)
      : null;
  const buff = state.buffs?.[ownerId];
  const until =
    entry.buddyId === "yosuga"
      ? entry.healUntil
      : entry.buddyId === "tobari"
        ? state.buffs
          ? (buff?.guardUntil ?? 0)
          : undefined
        : entry.buddyId === "oriha"
          ? state.buffs
            ? (buff?.boostUntil ?? 0)
            : undefined
          : 0;
  return {
    status: "present",
    name: item.name,
    level:
      Number.isSafeInteger(entry.level) && entry.level >= 1 && entry.level <= 40
        ? entry.level
        : null,
    elementLabel: item.elementLabel,
    skillName: item.skillName,
    skillText: item.skillText,
    cooldown: item.cooldown,
    remaining: seconds(entry.skillReadyAt),
    activeRemaining:
      !owner.connected || owner.hp <= 0
        ? 0
        : entry.buddyId === "tatara"
          ? 0
          : seconds(until),
    unavailable: !owner.connected
      ? "接続待ち"
      : owner.hp <= 0
        ? "戦闘不能"
        : entry.visible === false
          ? "バディが移動中です"
          : entry.buddyId === "yosuga" && owner.hp >= maxHp(world)
            ? "HPが満タンです"
            : null,
  };
}
/** 本人の役割・属性指定。外観色からの推測ではない。 */
const identity = {
  tatara: { element: "fire", elementLabel: "火炎", role: "範囲攻撃" },
  yosuga: { element: "wind", elementLabel: "風", role: "自己回復" },
  tobari: { element: "ice", elementLabel: "氷結", role: "防御支援" },
  oriha: { element: "lightning", elementLabel: "電撃", role: "身体強化" },
} as const;
function catalogItem(id: BuddyId): BuddyCatalogItem {
  const c = BUDDY_COMBAT;
  const skillText = {
    tatara: `バディ中心${c.blastRadius}mの敵へ火炎攻撃。`,
    yosuga: `持ち主だけを${c.healDuration}秒で最大HPの${percent(c.healFraction)}%回復。`,
    tobari: `持ち主と${c.supportRadius}m内の味方を${c.supportDuration}秒、被ダメージ${percent(c.guardReduction)}%軽減。`,
    oriha: `持ち主と${c.supportRadius}m内の味方を${c.supportDuration}秒、移動速度${percent(c.moveMultiplier - 1)}%増・回避再使用${percent(1 - c.evadeCooldownMultiplier)}%短縮。`,
  }[id];
  return {
    id,
    name: BUDDY_ASSETS[id].name,
    portrait: `${import.meta.env.BASE_URL}assets/buddy/portraits/${BUDDY_ASSETS[id].portrait}`,
    ...identity[id],
    skillName: identity[id].role,
    skillText,
    cooldown: c.cooldown[id],
  };
}
/** 表示専用。旧保存へ書き込まず、壊れたデータを空の所持に見せない。 */
export function getBuddyUiState(save: ProgressSave): BuddyUiState {
  const progress = save.buddies ?? freshBuddyProgress();
  if (!validBuddyProgress(progress)) throw Error("バディ保存を表示できません");
  const missing = BUDDY_IDS.filter((id) => !progress.owned[id]);
  const guaranteedNext =
    missing.length > 0 &&
    progress.pity >= BUDDY_RECRUIT_RULES.pityDuplicateLimit;
  const pool: readonly BuddyId[] = guaranteedNext ? missing : BUDDY_IDS;
  const owned: BuddyUiState["owned"] = {};
  for (const id of BUDDY_IDS) {
    const growth = progress.owned[id];
    if (!growth) continue;
    const level = buddyLevel(growth),
      levelCap = BUDDY_LEVEL_CAPS[growth.breakthrough];
    owned[id] = {
      level,
      levelCap,
      xpIntoLevel: growth.xp - buddyXpForLevel(level),
      xpForNext:
        level >= levelCap
          ? null
          : buddyXpForLevel(level + 1) - buddyXpForLevel(level),
      breakthrough: growth.breakthrough,
      breakthroughMax: BUDDY_BREAKTHROUGH_COSTS.length,
      nextLevelCap: BUDDY_LEVEL_CAPS[growth.breakthrough + 1] ?? null,
      breakthroughCost: BUDDY_BREAKTHROUGH_COSTS[growth.breakthrough] ?? null,
    };
  }
  return {
    catalog: BUDDY_IDS.map(catalogItem),
    owned,
    selected: progress.selected,
    starterChosen: progress.starterChosen,
    tickets: progress.tickets,
    fragments: progress.fragments,
    recruit: {
      ticketCost: BUDDY_RECRUIT_RULES.ticketCost,
      odds: BUDDY_IDS.map((id) => ({
        id,
        percent: pool.includes(id) ? 100 / pool.length : 0,
      })),
      pityCount: missing.length ? progress.pity : 0,
      // Claude側のpityThresholdも連続被り数の上限を表す。
      pityThreshold: BUDDY_RECRUIT_RULES.pityDuplicateLimit,
      guaranteedNext,
      duplicateFragments: BUDDY_RECRUIT_RULES.duplicateFragments,
      firstClearTickets: BUDDY_RECRUIT_RULES.firstClearTickets,
      repeatUnits: progress.repeatUnits,
      repeatUnitsPerTicket: BUDDY_RECRUIT_RULES.repeatUnitsPerTicket,
    },
  };
}
export function getBuddySkillView(
  world: World | null,
  ownerId: string,
  enabled: boolean,
): BuddySkillView | null {
  if (
    !world ||
    !buddyMode(world) ||
    world.phase !== "battle" ||
    world.buddies?.run !== world.run
  )
    return null;
  const entry = world.buddies.entries?.[ownerId];
  const owner = world.players.find((p) => p.id === ownerId);
  if (!entry || !owner || !isBuddyId(entry.buddyId)) return null;
  const item = catalogItem(entry.buddyId);
  const alive = owner.connected && owner.hp > 0;
  const buff = world.buddies.buffs?.[ownerId];
  const until =
    entry.buddyId === "yosuga"
      ? entry.healUntil
      : entry.buddyId === "tobari"
        ? (buff?.guardUntil ?? 0)
        : entry.buddyId === "oriha"
          ? (buff?.boostUntil ?? 0)
          : 0;
  // Displayは見た目の再生期限であり持続効果ではない。タタラの瞬間攻撃は0。
  const activeRemaining = alive ? Math.max(0, until - world.time) : 0;
  const unavailable = !owner.connected
    ? "接続待ち"
    : owner.hp <= 0
      ? "戦闘不能"
      : !enabled
        ? "操作できません"
        : !entry.visible
          ? "バディが移動中です"
          : entry.buddyId === "yosuga" && owner.hp >= maxHp(world)
            ? "HPが満タンです"
            : null;
  return {
    id: item.id,
    name: item.name,
    element: item.element,
    skillName: item.skillName,
    cooldown: item.cooldown,
    remaining: Math.max(0, entry.skillReadyAt - world.time),
    activeRemaining,
    unavailable,
  };
}
