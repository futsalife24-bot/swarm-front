import { describe, expect, it } from "vitest";
import {
  HIYORI_RELEASE,
  LOGIN_BONUS_TABLE,
  SUPPLY_BOX_KEY,
  SUPPLY_BOX_LIMIT,
  emptySupplyBox,
  grantLoginBonus,
  grantOnce,
  loadSupplyBox,
  receiveSupplyBox,
  refreshSupplyBox,
  saveSupplyBox,
} from "../src/client/supply-box";
import {
  CONTROL_VOICE_STORAGE_KEY,
  CONTROL_VOICE_UNLOCK_KEY,
  loadControlVoice,
  unlockedControlVoices,
} from "../src/client/control-voice";

const store = (initial: Record<string, string> = {}) => {
  const m = new Map(Object.entries(initial));
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};
// 2026-11-14 12:00 JST
const NOON = Date.UTC(2026, 10, 14, 3);
const DAY = 86_400_000;

describe("supply box: one-time distribution", () => {
  it("delivers the Hiyori unlock once on first launch, kept until received", () => {
    const s = store();
    const first = refreshSupplyBox(NOON, s);
    expect(first.items.map((i) => i.id)).toEqual([
      HIYORI_RELEASE.id,
      "login-2026-11-14",
    ]);
    // 2回目の起動・同じ日は増えない。
    expect(refreshSupplyBox(NOON + 1000, s).items).toHaveLength(2);
    // 配布だけでは解放されない（受け取りで初めて付与）。
    expect(unlockedControlVoices(s)).toEqual(["hiromi"]);
    const { received } = receiveSupplyBox([HIYORI_RELEASE.id], { store: s });
    expect(received.map((i) => i.id)).toEqual([HIYORI_RELEASE.id]);
    expect(unlockedControlVoices(s)).toEqual(["hiromi", "hiyori"]);
    // 受け取った後も再配布しない。ヨウコは配らない。
    const later = refreshSupplyBox(NOON + 2 * DAY, s);
    expect(later.items.some((i) => i.id === HIYORI_RELEASE.id)).toBe(false);
    expect(later.items.some((i) => i.reward.kind === "control-voice")).toBe(
      false,
    );
    expect(later.granted).toEqual([HIYORI_RELEASE.id]);
  });
  it("keeps Hiromi as the default voice until Hiyori is received and chosen", () => {
    const s = store({ [CONTROL_VOICE_STORAGE_KEY]: "hiyori" });
    refreshSupplyBox(NOON, s);
    expect(loadControlVoice(s)).toBe("hiromi");
    receiveSupplyBox([HIYORI_RELEASE.id], { store: s });
    expect(loadControlVoice(s)).toBe("hiyori");
    expect(s.getItem(CONTROL_VOICE_UNLOCK_KEY)).toBe('["hiyori"]');
  });
  it("does not touch existing save keys", () => {
    const progress = '{"version":2,"coins":10}';
    const s = store({ "swarm-front-progress-normal": progress });
    refreshSupplyBox(NOON, s);
    expect(s.getItem("swarm-front-progress-normal")).toBe(progress);
    expect([...s.m.keys()].sort()).toEqual(
      ["swarm-front-progress-normal", SUPPLY_BOX_KEY].sort(),
    );
  });
  it("grantOnce ignores an already granted id", () => {
    const once = grantOnce(emptySupplyBox(), HIYORI_RELEASE, NOON);
    expect(grantOnce(once, HIYORI_RELEASE, NOON)).toBe(once);
  });
});

describe("supply box: daily login bonus", () => {
  it("grants once per Japan day, never twice the same day", () => {
    let box = grantLoginBonus(emptySupplyBox(), NOON);
    expect(box.items).toHaveLength(1);
    expect(box.login).toEqual({ day: "2026-11-14", count: 1 });
    expect(grantLoginBonus(box, NOON + 3 * 3600_000)).toBe(box);
    // 日本時間の0時（UTC 15時）で日付が変わる。
    const jstMidnight = Date.UTC(2026, 10, 14, 15);
    expect(grantLoginBonus(box, jstMidnight - 1)).toBe(box);
    box = grantLoginBonus(box, jstMidnight);
    expect(box.items.map((i) => i.id)).toEqual([
      "login-2026-11-14",
      "login-2026-11-15",
    ]);
    expect(box.login).toEqual({ day: "2026-11-15", count: 2 });
  });
  it("ignores a clock moved back before the last grant", () => {
    const box = grantLoginBonus(emptySupplyBox(), NOON);
    expect(grantLoginBonus(box, NOON - 2 * DAY)).toBe(box);
  });
  it("cycles the data table by cumulative login days", () => {
    let box = emptySupplyBox();
    for (let d = 0; d < 8; d++) box = grantLoginBonus(box, NOON + d * DAY);
    expect(box.items.map((i) => i.reward)).toEqual([
      ...LOGIN_BONUS_TABLE,
      LOGIN_BONUS_TABLE[0],
    ]);
    expect(box.items[6].title).toBe("ログインボーナス 7日目");
    expect(box.items[7].title).toBe("ログインボーナス 1日目");
    // 補給券・ガチャ関連は配らない。
    expect(LOGIN_BONUS_TABLE.every((r) => r.kind === "coins")).toBe(true);
  });
  it("does not overflow the box", () => {
    let box = emptySupplyBox();
    for (let d = 0; d < SUPPLY_BOX_LIMIT + 5; d++)
      box = grantLoginBonus(box, NOON + d * DAY);
    expect(box.items).toHaveLength(SUPPLY_BOX_LIMIT);
  });
});

describe("supply box: receiving", () => {
  const filled = () => {
    const s = store();
    let box = emptySupplyBox();
    for (let d = 0; d < 3; d++) box = grantLoginBonus(box, NOON + d * DAY);
    box = grantOnce(box, HIYORI_RELEASE, NOON);
    saveSupplyBox(box, s);
    return s;
  };
  it("applies coins only when received, individually or all at once", () => {
    const s = filled();
    let coins = 0;
    const receiver = {
      store: s,
      addCoins: (n: number) => void (coins += n),
    };
    receiveSupplyBox(["login-2026-11-14"], receiver);
    expect(coins).toBe(50);
    expect(loadSupplyBox(s).items).toHaveLength(3);
    // 同じIDを再度受け取っても増えない。
    receiveSupplyBox(["login-2026-11-14"], receiver);
    expect(coins).toBe(50);
    const rest = loadSupplyBox(s).items.map((i) => i.id);
    const { received } = receiveSupplyBox(rest, receiver);
    expect(received).toHaveLength(3);
    expect(coins).toBe(150);
    expect(loadSupplyBox(s).items).toEqual([]);
    expect(unlockedControlVoices(s)).toContain("hiyori");
  });
  it("keeps coin items until the progression has started", () => {
    const s = filled();
    const all = loadSupplyBox(s).items.map((i) => i.id);
    const { received } = receiveSupplyBox(all, { store: s });
    expect(received.map((i) => i.id)).toEqual([HIYORI_RELEASE.id]);
    expect(loadSupplyBox(s).items).toHaveLength(3);
  });
  it("restores the box when saving the coins fails", () => {
    const s = filled();
    const before = s.getItem(SUPPLY_BOX_KEY);
    expect(() =>
      receiveSupplyBox(["login-2026-11-15"], {
        store: s,
        addCoins: () => {
          throw Error("保存が別の画面で更新されました");
        },
      }),
    ).toThrow("保存が別の画面で更新されました");
    expect(s.getItem(SUPPLY_BOX_KEY)).toBe(before);
  });
  it("refuses to overwrite an unreadable box", () => {
    const s = store({ [SUPPLY_BOX_KEY]: '{"version":9}' });
    expect(() => refreshSupplyBox(NOON, s)).toThrow(
      "支給ボックスの保存を読めません",
    );
    expect(s.getItem(SUPPLY_BOX_KEY)).toBe('{"version":9}');
  });
});
