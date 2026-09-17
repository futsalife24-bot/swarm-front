import { japanWeek } from "./calendar";
export const WEEKLY_MISSIONS = [
  {
    id: "campaign-3",
    kind: "campaign",
    target: 3,
    coins: 150,
    label: "本編を3回クリア",
  },
  {
    id: "campaign-10",
    kind: "campaign",
    target: 10,
    coins: 400,
    label: "本編を10回クリア",
  },
  {
    id: "defense-3",
    kind: "defense",
    target: 3,
    coins: 250,
    label: "武器庫防衛に3回参加",
  },
] as const;
export interface WeeklyProgress {
  week: string;
  campaign: string[];
  defense: string[];
  claimed: string[];
}
interface WeeklySave {
  coins: number;
  weekly?: WeeklyProgress;
}
function current(save: WeeklySave, serverNow: number): WeeklyProgress {
  const week = japanWeek(serverNow);
  if (save.weekly && save.weekly.week > week)
    throw Error("日付を確認できません。再接続してください");
  return save.weekly?.week === week
    ? structuredClone(save.weekly)
    : { week, campaign: [], defense: [], claimed: [] };
}
/** The caller passes time obtained from the server, never a user-selected date. */
export function recordWeekly<T extends WeeklySave>(
  save: T,
  kind: "campaign" | "defense",
  run: string,
  serverNow: number,
): T {
  const next = structuredClone(save),
    weekly = current(save, serverNow);
  if (!run || typeof run !== "string") throw Error("作戦IDがありません");
  const target = kind === "campaign" ? 10 : 3;
  if (!weekly[kind].includes(run) && weekly[kind].length < target)
    weekly[kind].push(run);
  next.weekly = weekly;
  return next;
}
export function claimWeekly<T extends WeeklySave>(
  save: T,
  id: string,
  serverNow: number,
): T {
  const next = structuredClone(save),
    weekly = current(save, serverNow);
  const mission = WEEKLY_MISSIONS.find((m) => m.id === id);
  if (!mission || weekly[mission.kind].length < mission.target)
    throw Error("週間ミッションは未達成です");
  if (weekly.claimed.includes(id)) return save;
  weekly.claimed.push(id);
  next.coins += mission.coins;
  next.weekly = weekly;
  return next;
}
