import type { World } from "./game";
import { frontSurvivalRewardCount } from "./front-survival";

/** 報酬判定だけのラン内状態。World配信・分析送信・個人の永久保存へ載せない。 */
export interface FrontSupportRewards {
  version: 1;
  roster: string[];
  tickAt: number;
  players: Record<
    string,
    { present: number; active: number; actionAt?: number; presentAt?: number }
  >;
  settled?: FrontSupportAllocation;
}
export interface FrontSupportAllocation {
  counts: Record<string, number>;
  eligible: Record<string, boolean>;
  budget: number;
  teamKills: number;
}
export const SUPPORT_REWARD_RULES = {
  grace: 10,
  minimumPresence: 30,
  minimumActivity: 10,
  ratio: 0.1,
  recent: 30,
} as const;
const bindings = new WeakMap<World, FrontSupportRewards>();

export function createSupportRewards(
  ids: readonly string[],
  time: number,
): FrontSupportRewards {
  if (
    ids.length < 2 ||
    ids.length > 4 ||
    new Set(ids).size !== ids.length ||
    ids.some(
      (id) => !id || ["__proto__", "constructor", "prototype"].includes(id),
    ) ||
    !Number.isFinite(time)
  )
    throw new RangeError("支援報酬の出撃設定が不正です");
  return {
    version: 1,
    roster: [...ids],
    tickAt: time,
    players: Object.fromEntries(
      ids.map((id) => [id, { present: 0, active: 0 }]),
    ),
  };
}
export function bindSupportRewards(
  w: World,
  state: FrontSupportRewards | undefined,
) {
  if (state?.version === 1) bindings.set(w, state);
  else bindings.delete(w);
}
/** 既に権威処理が成立させた有効命中・味方回復・蘇生の通知だけ。入力や演出を信用しない。 */
export function noteSupportRewardAction(w: World, id: string) {
  const state = bindings.get(w),
    p = w.players.find((p) => p.id === id);
  if (
    w.phase !== "battle" ||
    !state ||
    !Object.hasOwn(state.players, id) ||
    !p?.connected ||
    !(p.hp > 0)
  )
    return;
  state.players[id].actionAt = w.time;
}
/** 実際に進んだゲーム時刻だけ。切断・ポーズ・選択・復帰時の時刻飛びを加算しない。 */
export function sampleSupportRewards(w: World, state: FrontSupportRewards) {
  if (state.version !== 1 || !Number.isFinite(state.tickAt)) return;
  const elapsed = Math.min(0.1, Math.max(0, w.time - state.tickAt));
  state.tickAt = w.time;
  if (!(elapsed > 0)) return;
  for (const id of state.roster) {
    const p = w.players.find((p) => p.id === id),
      record = state.players[id];
    if (!record || !p?.connected || !(p.hp > 0)) continue;
    record.present += elapsed;
    record.presentAt = w.time;
    if (
      record.actionAt !== undefined &&
      record.actionAt <= w.time + 1e-9 &&
      w.time - record.actionAt <= SUPPORT_REWARD_RULES.grace + 1e-9
    )
      record.active += elapsed;
  }
}

export function supportRewardAllocation(
  w: World,
  state: FrontSupportRewards,
  allowed: readonly string[],
) {
  if (state.settled) return state.settled;
  const counts: Record<string, number> = {},
    eligible: Record<string, boolean> = {};
  const allowedSet = new Set(allowed);
  // 同点の端数を常にホストへ寄せない。戦闘/報酬の乱数列は消費しない。
  let rotation = 0;
  for (const c of w.run)
    rotation = (Math.imul(rotation, 31) + c.charCodeAt(0)) >>> 0;
  rotation %= state.roster.length;
  let budget = 0,
    teamKills = 0;
  const entries = state.roster.map((id, index) => {
    const player = w.players.find((p) => p.id === id),
      r = state.players[id];
    counts[id] = 0;
    eligible[id] = false;
    const kills =
      player && Number.isSafeInteger(player.kills) && player.kills > 0
        ? player.kills
        : 0;
    teamKills += kills;
    if (allowedSet.has(id)) budget += frontSurvivalRewardCount(w.time, kills);
    const valid =
      state.version === 1 &&
      r &&
      Number.isFinite(r.present) &&
      Number.isFinite(r.active) &&
      r.present >= 0 &&
      r.active >= 0 &&
      r.active <= r.present + 1e-6;
    const present = valid ? Math.min(r.present, w.time) : 0,
      active = valid ? Math.min(r.active, present) : 0;
    const qualifies =
      !!player &&
      allowedSet.has(id) &&
      present + 1e-6 >= SUPPORT_REWARD_RULES.minimumPresence &&
      active + 1e-6 >= SUPPORT_REWARD_RULES.minimumActivity &&
      active + 1e-6 >= present * SUPPORT_REWARD_RULES.ratio &&
      r.actionAt !== undefined &&
      r.presentAt !== undefined &&
      Number.isFinite(r.actionAt) &&
      Number.isFinite(r.presentAt) &&
      r.actionAt >= 0 &&
      r.presentAt + 1e-6 >= present &&
      r.presentAt <= w.time + 1e-9 &&
      r.actionAt <= r.presentAt + 1e-9 &&
      r.presentAt - r.actionAt <= SUPPORT_REWARD_RULES.recent + 1e-9;
    return {
      id,
      index: (index - rotation + state.roster.length) % state.roster.length,
      present,
      qualifies,
      cap: 0,
      ideal: 0,
    };
  });
  if (
    !Number.isFinite(w.time) ||
    w.time < 60 ||
    teamKills < 1 ||
    state.version !== 1 ||
    state.roster.length < 2 ||
    state.roster.length > 4 ||
    new Set(state.roster).size !== state.roster.length
  )
    return { counts, eligible, budget: 0, teamKills };
  const teamCap = frontSurvivalRewardCount(w.time, teamKills),
    participants = entries.filter((e) => e.qualifies);
  const weight = participants.reduce((n, e) => n + e.present, 0);
  for (const entry of participants) {
    eligible[entry.id] = true;
    entry.cap = Math.min(
      30,
      teamCap,
      Math.ceil((teamCap * entry.present) / w.time - 1e-9),
    );
    entry.ideal = (budget * entry.present) / weight;
    counts[entry.id] = Math.min(entry.cap, Math.floor(entry.ideal));
  }
  let remaining = budget - Object.values(counts).reduce((n, v) => n + v, 0);
  // 最大120個、参加者4人。最大剰余を順に配り、個人の参加時間按分上限を超えない。
  while (remaining > 0) {
    const next = participants
      .filter((e) => counts[e.id] < e.cap)
      .sort(
        (a, b) =>
          b.ideal - counts[b.id] - (a.ideal - counts[a.id]) ||
          a.index - b.index,
      )[0];
    if (!next) break;
    counts[next.id]++;
    remaining--;
  }
  return { counts, eligible, budget, teamKills };
}
