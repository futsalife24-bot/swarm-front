import { isValidFrontUpgradePool } from "../shared/front-upgrades";
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
    isValidFrontUpgradePool(v.pool)
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
    // 旧デッキの開幕指定を引き継がず、名前と選択候補だけを読む。保存原文は変更しない。
    return {
      slots: value.slots.map(
        (d: FrontDeck | null) =>
          d && {
            name: d.name,
            loadout: { pool: [...d.loadout.pool] },
          },
      ),
      error: "",
    };
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
  current.slots[slot] = {
    name: next.name,
    loadout: { pool: [...next.loadout.pool] },
  };
  storage.setItem(
    FRONT_DECKS_KEY,
    JSON.stringify({ version: 1, slots: current.slots }),
  );
}
