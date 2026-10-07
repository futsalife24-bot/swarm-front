import { FRONT_BASE_IDS, FRONT_FAMILY_CARDS } from "../shared/front-upgrades";
import { validateFrontLoadout, type FrontLoadout } from "./front-campaign";
import type { FrontStorage } from "./front-progress";

// 同じ保存排他権の内側で使う。進行・所持品・現在の出撃候補には書き込まない。
export const FRONT_DECKS_KEY = "swarm-front-upgrade-decks-v1";
export const FRONT_DECK_SLOTS = 3;
export interface FrontDeck {
  name: string;
  loadout: FrontLoadout;
}
function validDeck(value: unknown): value is FrontDeck {
  if (!value || typeof value !== "object") return false;
  const d = value as FrontDeck,
    v = d.loadout;
  return (
    typeof d.name === "string" &&
    d.name.trim().length > 0 &&
    d.name.length <= 24 &&
    !!v &&
    Array.isArray(v.pool) &&
    v.pool.length >= 6 &&
    v.pool.length <= FRONT_BASE_IDS.length &&
    new Set(v.pool).size === v.pool.length &&
    v.pool.every((id) => FRONT_BASE_IDS.includes(id)) &&
    Array.isArray(v.initialCards) &&
    v.initialCards.length === 3 &&
    Object.values(FRONT_FAMILY_CARDS).every((ids, i) =>
      ids.includes(v.initialCards[i]),
    ) &&
    v.initialCards.every((id) => v.pool.includes(id))
  );
}
export function readFrontDecks(storage: FrontStorage): {
  slots: (FrontDeck | null)[];
  error: string;
} {
  const empty = () => Array<FrontDeck | null>(FRONT_DECK_SLOTS).fill(null);
  try {
    const raw = storage.getItem(FRONT_DECKS_KEY);
    if (raw === null) return { slots: empty(), error: "" };
    const value = JSON.parse(raw);
    if (
      value?.version !== 1 ||
      !Array.isArray(value.slots) ||
      value.slots.length !== FRONT_DECK_SLOTS ||
      !value.slots.every((d: unknown) => d === null || validDeck(d))
    )
      throw new Error();
    return { slots: value.slots, error: "" };
  } catch {
    return {
      slots: empty(),
      error: "デッキを読み込めません。元の保存を保持しています。",
    };
  }
}
export function saveFrontDeck(
  storage: FrontStorage,
  slot: number,
  deck: FrontDeck,
) {
  const current = readFrontDecks(storage);
  if (current.error) throw new Error(current.error);
  const next = { ...deck, name: deck.name.trim() };
  if (
    !Number.isInteger(slot) ||
    slot < 0 ||
    slot >= FRONT_DECK_SLOTS ||
    !validDeck(next)
  )
    throw new Error("デッキ名は1〜24文字、候補は6種以上で保存してください。");
  validateFrontLoadout(storage, next.loadout);
  current.slots[slot] = next;
  storage.setItem(
    FRONT_DECKS_KEY,
    JSON.stringify({ version: 1, slots: current.slots }),
  );
}
