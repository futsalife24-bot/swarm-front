import { WEAPONS, familyOf } from "../shared/defs";
import { GRADES } from "../shared/progression";
import type { SupplyReward } from "../shared/supply-contract";
import { BUDDY_ASSETS } from "./buddy-assets";

export interface Reveal {
  ready: Promise<unknown>;
  play(results: object[], options?: object): Promise<void>;
  destroy(): void;
  state(): { waiting: string | null; effect: number };
}
let styleReady: Promise<void> | undefined;
function revealStyle() {
  return (styleReady ??= new Promise<void>((resolve, reject) => {
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = import.meta.env.BASE_URL + "supply-reveal/gacha.css";
    style.onload = () => resolve();
    style.onerror = () => {
      styleReady = undefined;
      style.remove();
      reject(Error("補給演出を読み込めません。再試行してください"));
    };
    document.head.appendChild(style);
  }));
}
export async function loadSupplyReveal() {
  const moduleUrl = import.meta.env.BASE_URL + "supply-reveal/runtime.js";
  const [module] = await Promise.all([
    import(/* @vite-ignore */ moduleUrl),
    revealStyle(),
  ]);
  return module as {
    createSupplyReveal(host: HTMLElement, options: object): Reveal;
  };
}

/** 表示へ変換するだけ。受領・保存・券の更新は行わない。 */
export function supplyResults(
  rewards: readonly SupplyReward[],
  owned: ReadonlySet<string> = new Set(),
) {
  const acquired = new Set(owned);
  return rewards.map((reward) => {
    if (reward.type === "shard")
      return { type: "shard", amount: reward.amount };
    if (reward.type === "buddy") {
      const result = {
        type: "buddy",
        name: BUDDY_ASSETS[reward.buddyId].name,
        art: `b-${reward.buddyId}`,
        new: !acquired.has(reward.buddyId),
      };
      acquired.add(reward.buddyId);
      return result;
    }
    const family = familyOf(reward.weapon.kind);
    return {
      type: "weapon",
      rarity: GRADES[reward.weapon.rarity],
      name: WEAPONS[reward.weapon.kind].name,
      art:
        family === "shotgun"
          ? "w-shotgun"
          : family === "rocket" || family === "grenade"
            ? "w-rocket"
            : "w-rifle",
      new: true,
    };
  });
}
